import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchGrades, gradesError } from './grades-api'
import { StudyApiError } from './study-api'
afterEach(() => vi.unstubAllGlobals())
describe('grades API boundary', () => {
  it('uses same-origin credentials and course filtering, stripping unexpected fields', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            grades: {
              courses: [
                { id: 'synthetic', name: 'Synthetic', private: 'detail' },
              ],
              assessments: [],
              summaries: [],
            },
          }),
        ),
      )
    vi.stubGlobal('fetch', fetch)
    const signal = new AbortController().signal
    expect(await fetchGrades('synthetic', signal)).toEqual({
      courses: [{ id: 'synthetic', name: 'Synthetic' }],
      assessments: [],
      summaries: [],
    })
    expect(fetch).toHaveBeenCalledWith(
      '/api/study/assessments?courseId=synthetic',
      {
        signal,
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      },
    )
  })
  it.each([
    {},
    null,
    { grades: { courses: [], assessments: [{}], summaries: [] } },
    { grades: { courses: [], assessments: [], summaries: [{}] } },
  ])(
    'rejects malformed grades rather than rendering invented results',
    async (payload) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))),
      )
      await expect(
        fetchGrades(null, new AbortController().signal),
      ).rejects.toThrow('Study unavailable')
    },
  )
  it('does not expose server error text and explains score validation in Vietnamese', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              error: { code: 'STUDY_NOT_FOUND', message: 'private SQL detail' },
            }),
            { status: 404 },
          ),
        ),
    )
    await expect(
      fetchGrades(null, new AbortController().signal),
    ).rejects.toMatchObject({ code: 'STUDY_NOT_FOUND' })
    expect(gradesError(new StudyApiError('STUDY_INVALID'))).toContain(
      'điểm tối đa',
    )
    expect(gradesError(new Error('private SQL detail'))).not.toContain('SQL')
  })
})
