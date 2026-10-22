import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchStudy,
  saveStudy,
  deleteStudy,
  studyError,
  StudyApiError,
} from './study-api'
afterEach(() => vi.unstubAllGlobals())
const summary = {
  weekStart: '2026-10-19',
  weekEnd: '2026-10-25',
  totalMinutes: 90,
  sessionCount: 1,
  goals: [],
  courses: [{ courseId: null, name: 'Tự học', minutes: 90 }],
}
describe('Study API client', () => {
  it('uses session credentials and strips unexpected fields from study rows and summaries', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            study: {
              semesters: [
                {
                  id: 'synthetic',
                  name: 'Synthetic',
                  startDate: '2026-01-01',
                  endDate: '2027-12-31',
                  isActive: true,
                  owner_member_id: 'private',
                },
              ],
              courses: [],
              goals: [],
              sessions: [],
              summary: { ...summary, secret: 'private' },
            },
          }),
        ),
      )
    vi.stubGlobal('fetch', fetch)
    const signal = new AbortController().signal
    const data = await fetchStudy(signal)
    expect(JSON.stringify(data)).not.toMatch(/owner_member_id|secret|private/)
    expect(fetch).toHaveBeenCalledWith('/api/study', {
      signal,
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
  })
  it.each([
    null,
    { study: {} },
    {
      study: {
        semesters: [],
        courses: [],
        goals: [],
        sessions: [],
        summary: { ...summary, totalMinutes: -1 },
      },
    },
  ])('rejects malformed data safely', async (payload) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))),
    )
    await expect(fetchStudy(new AbortController().signal)).rejects.toThrow(
      'Study unavailable',
    )
  })
  it('updates/deletes the existing identity without actor or owner fields', async () => {
    const fetch = vi
      .fn()
      .mockImplementation(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    await saveStudy('goals', 'synthetic', {
      title: 'Synthetic',
      courseId: null,
      targetMinutes: null,
      targetDate: null,
      status: 'COMPLETED',
    })
    await deleteStudy('goals', 'synthetic')
    expect(fetch.mock.calls[0][0]).toBe('/api/study/goals/synthetic')
    expect(fetch.mock.calls[0][1].method).toBe('PUT')
    expect(fetch.mock.calls[1][1].method).toBe('DELETE')
    expect(fetch.mock.calls[0][1].body).not.toContain('owner')
  })
  it('never displays the server error message and explains referenced-record deletion', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              error: { code: 'STUDY_IN_USE', message: 'private SQL detail' },
            }),
            { status: 409 },
          ),
        ),
    )
    await expect(deleteStudy('courses', 'synthetic')).rejects.toMatchObject({
      code: 'STUDY_IN_USE',
    })
    expect(studyError(new StudyApiError('STUDY_IN_USE'))).toContain(
      'chuyển liên kết',
    )
    expect(studyError(new Error('private SQL detail'))).not.toContain('private')
  })
})
