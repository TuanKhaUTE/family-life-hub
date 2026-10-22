import { afterEach, expect, it, vi } from 'vitest'
import {
  fetchReceivedShares,
  fetchOwnerShares,
  createShare,
  revokeShare,
} from './share-api'
const id = '11111111-1111-4111-8111-111111111111',
  other = '22222222-2222-4222-8222-222222222222'
const record = {
  id,
  resourceType: 'STUDY_ASSESSMENT',
  sharedAt: '2026-10-22T00:00:00Z',
  owner: {
    displayName: 'Synthetic Owner',
    avatarType: null,
    avatarValue: null,
  },
  assessment: {
    courseName: 'Synthetic Course',
    title: 'Synthetic Midterm',
    assessmentType: 'MIDTERM',
    score: 8.7,
    maxScore: 10,
    percentage: 87,
    letterGrade: null,
    assessedAt: '2026-10-22',
  },
}
afterEach(() => vi.unstubAllGlobals())
function reply(received: unknown) {
  const f = vi.fn(async () => new Response(JSON.stringify({ received })))
  vi.stubGlobal('fetch', f)
  return f
}
it('projects only approved fields and uses uncached, cancellable same-origin requests', async () => {
  const f = reply({
      records: [
        {
          ...record,
          resourceId: other,
          owner: { ...record.owner, id: other },
          assessment: {
            ...record.assessment,
            note: 'private',
            courseId: other,
            weightPercent: 30,
          },
        },
      ],
      page: 1,
      totalCount: 1,
      hasMore: false,
    }),
    signal = new AbortController().signal
  expect(await fetchReceivedShares(1, signal)).toEqual({
    records: [record],
    page: 1,
    totalCount: 1,
    hasMore: false,
  })
  expect(f).toHaveBeenCalledWith(
    '/api/shares/received?page=1',
    expect.objectContaining({
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
    }),
  )
})
it.each([
  { ...record, resourceType: 'FITNESS_SESSION' },
  { ...record, assessment: { ...record.assessment, score: 11 } },
  { ...record, assessment: { ...record.assessment, percentage: 86 } },
  { ...record, assessment: { ...record.assessment, maxScore: 0 } },
  { ...record, assessment: { ...record.assessment, assessedAt: '2026-02-30' } },
  { ...record, owner: { ...record.owner, displayName: '' } },
  { ...record, sharedAt: 'invalid' },
])('rejects invalid/unsupported shared projections %#', async (invalid) => {
  reply({ records: [invalid], page: 1, totalCount: 1, hasMore: false })
  await expect(
    fetchReceivedShares(1, new AbortController().signal),
  ).rejects.toThrow('Invalid sharing response')
})
it('supports pending or letter-only grades without invented percentages', async () => {
  const letter = {
    ...record,
    assessment: {
      ...record.assessment,
      score: null,
      maxScore: null,
      percentage: null,
      letterGrade: 'A',
      assessedAt: null,
    },
  }
  reply({ records: [letter], page: 1, totalCount: 1, hasMore: false })
  expect(
    (await fetchReceivedShares(1, new AbortController().signal)).records,
  ).toEqual([letter])
})
it('rejects contradictory pagination', async () => {
  reply({ records: [], page: 1, totalCount: 1, hasMore: true })
  await expect(
    fetchReceivedShares(1, new AbortController().signal),
  ).rejects.toThrow()
})
it('owner projection keeps only recipient selection and current shares', async () => {
  const recipient = {
    id: other,
    displayName: 'Synthetic Recipient',
    avatarType: null,
    avatarValue: null,
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            sharing: {
              recipients: [{ ...recipient, role: 'PARENT' }],
              shares: [
                { id, recipient, sharedAt: record.sharedAt, internal: 'omit' },
              ],
              note: 'omit',
            },
          }),
        ),
    ),
  )
  expect(await fetchOwnerShares(id, new AbortController().signal)).toEqual({
    recipients: [recipient],
    shares: [{ id, recipient, sharedAt: record.sharedAt }],
  })
})
it('mutations cannot carry owner fields or private notes and never expose error bodies', async () => {
  const f = vi.fn(
    async () =>
      new Response(JSON.stringify({ error: { message: 'SQL private' } }), {
        status: 403,
      }),
  )
  vi.stubGlobal('fetch', f)
  await expect(createShare(id, other)).rejects.toThrow(
    'Sharing request unavailable',
  )
  await expect(revokeShare(id)).rejects.toThrow('Sharing request unavailable')
  expect(f).toHaveBeenNthCalledWith(
    1,
    '/api/shares',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        resourceType: 'STUDY_ASSESSMENT',
        resourceId: id,
        recipientMemberId: other,
      }),
    }),
  )
})
