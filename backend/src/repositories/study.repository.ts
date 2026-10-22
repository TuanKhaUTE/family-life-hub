import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '../config/supabase.js'
import { ApiError } from '../errors/api-error.js'
import {
  normalizeAssessment,
  type AssessmentData,
} from '../services/study-assessment.js'
import {
  normalizeStudy,
  studyId,
  type StudyKind,
  type StudyInput,
  type StudyWorkspace,
  type StudyRepository,
} from '../services/study.service.js'
import { normalizePracticeResult, type PracticeResultInput } from '../services/study-practice.js'
export class SupabaseStudyRepository implements StudyRepository {
  private client?: SupabaseClient
  constructor(
    private readonly factory: () => SupabaseClient = createSupabaseServerClient,
  ) {}
  private async rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await (this.client ??= this.factory()).rpc(
      name,
      args,
    )
    if (error) {
      if (error.code === '42501')
        throw new ApiError(
          403,
          'STUDY_FORBIDDEN',
          'Study access is not permitted',
        )
      if (error.code === 'P0002')
        throw new ApiError(404, 'STUDY_NOT_FOUND', 'Study record not found')
      if (error.code === '23503')
        throw new ApiError(
          409,
          'STUDY_IN_USE',
          'Remove or unlink related Study records first',
        )
      if (['22023', '23514', '23502', '22P02'].includes(error.code))
        throw new ApiError(400, 'STUDY_INVALID', 'Invalid Study input')
      throw new Error('Study storage unavailable')
    }
    return data as unknown
  }
  async read(actorId: string, today: string): Promise<StudyWorkspace> {
    const data = await this.rpc('study_read', {
      p_actor_member_id: actorId,
      p_today: today,
    })
    try {
      return parseStudyWorkspace(data, today)
    } catch {
      throw new Error('Invalid Study storage response')
    }
  }
  async mutate(
    actorId: string,
    kind: StudyKind,
    id: string | null,
    input: StudyInput | null,
    remove: boolean,
  ) {
    await this.rpc(
      kind === 'assessments' ? 'study_assessment_mutate' : 'study_mutate',
      {
        p_actor_member_id: actorId,
        ...(kind === 'assessments' ? {} : { p_kind: kind }),
        p_id: id,
        p_input: input,
        p_remove: remove,
      },
    )
  }
  async readAssessments(
    actorId: string,
    courseId: string | null,
  ): Promise<AssessmentData> {
    const data = await this.rpc('study_assessment_read', {
      p_actor_member_id: actorId,
      p_course_id: courseId,
    })
    try {
      if (
        !object(data) ||
        !Array.isArray(data.courses) ||
        !Array.isArray(data.assessments)
      )
        throw new Error()
      return {
        courses: data.courses.map((c) => {
          if (!object(c) || typeof c.name !== 'string') throw new Error()
          studyId(c.id)
          return { id: c.id, name: c.name }
        }),
        assessments: data.assessments.map((a) => {
          if (
            !object(a) ||
            typeof a.createdAt !== 'string' ||
            typeof a.updatedAt !== 'string' ||
            !Number.isFinite(Date.parse(a.createdAt)) ||
            !Number.isFinite(Date.parse(a.updatedAt))
          )
            throw new Error()
          studyId(a.id)
          const { id, createdAt, updatedAt, ...input } = a
          return { ...normalizeAssessment(input), id, createdAt, updatedAt }
        }),
      }
    } catch {
      throw new Error('Invalid assessment storage response')
    }
  }
  async readPractice(actorId: string, courseId: string | null) {
    const data = await this.rpc('study_practice_read', { p_actor_member_id: actorId, p_course_id: courseId })
    try {
      if (!object(data) || !Array.isArray(data.courses) || !Array.isArray(data.results)) throw new Error()
      const courses = data.courses.map((course) => {
        if (!object(course) || typeof course.name !== 'string' || typeof course.practiceTracking !== 'boolean') throw new Error()
        studyId(course.id)
        return { id: course.id, semesterId: '', name: course.name, code: null, practiceTracking: course.practiceTracking }
      })
      const results = data.results.map((row) => {
        if (!object(row) || typeof row.id !== 'string' || typeof row.courseId !== 'string' || typeof row.courseName !== 'string' || typeof row.studiedAt !== 'string' || typeof row.createdAt !== 'string' || typeof row.updatedAt !== 'string') throw new Error()
        studyId(row.id); studyId(row.sessionId); studyId(row.courseId)
        return { id: row.id, ...normalizePracticeResult({ sessionId: row.sessionId, metricTitle: row.metricTitle, score: row.score, maxScore: row.maxScore, note: row.note }), courseId: row.courseId, courseName: row.courseName, studiedAt: row.studiedAt, createdAt: row.createdAt, updatedAt: row.updatedAt }
      })
      return { courses, results }
    } catch { throw new Error('Invalid practice storage response') }
  }
  async mutatePractice(actorId: string, id: string | null, input: PracticeResultInput | null, remove: boolean) {
    await this.rpc('study_practice_mutate', { p_actor_member_id: actorId, p_id: id, p_input: input, p_remove: remove })
  }
  async togglePractice(actorId: string, courseId: string, enabled: boolean) {
    await this.rpc('study_course_practice_toggle', { p_actor_member_id: actorId, p_course_id: courseId, p_enabled: enabled })
  }
}
export function parseStudyWorkspace(
  value: unknown,
  today: string,
): StudyWorkspace {
  if (!object(value)) throw new Error('Invalid Study response')
  const records = (kind: Exclude<StudyKind, 'assessments'>) => {
    const list = value[kind]
    if (!Array.isArray(list)) throw new Error('Invalid Study response')
    return list.map((row) => {
      if (!object(row)) throw new Error('Invalid Study response')
      studyId(row.id)
      const keys = {
        semesters: ['name', 'startDate', 'endDate', 'isActive'],
        courses: ['name', 'semesterId', 'code', 'practiceTracking'],
        goals: ['title', 'courseId', 'targetMinutes', 'targetDate', 'status'],
        sessions: ['courseId', 'studiedAt', 'durationMinutes', 'note'],
      }[kind]
      return {
        id: row.id,
        ...normalizeStudy(
          kind,
          Object.fromEntries(keys.map((k) => [k, row[k]])),
          today,
        ),
      }
    })
  }
  const summary = value.summary
  if (
    !object(summary) ||
    typeof summary.weekStart !== 'string' ||
    typeof summary.weekEnd !== 'string' ||
    !count(summary.totalMinutes) ||
    !count(summary.sessionCount) ||
    !Array.isArray(summary.goals) ||
    !Array.isArray(summary.courses)
  )
    throw new Error('Invalid Study summary')
  return {
    semesters: records('semesters'),
    courses: records('courses'),
    goals: records('goals'),
    sessions: records('sessions'),
    summary: {
      weekStart: summary.weekStart,
      weekEnd: summary.weekEnd,
      totalMinutes: summary.totalMinutes,
      sessionCount: summary.sessionCount,
      goals: summary.goals.map((g) => {
        if (
          !object(g) ||
          typeof g.id !== 'string' ||
          typeof g.title !== 'string' ||
          !count(g.minutes) ||
          !(g.targetMinutes === null || count(g.targetMinutes)) ||
          !(g.targetDate === null || typeof g.targetDate === 'string')
        )
          throw new Error('Invalid Study goal')
        return {
          id: g.id,
          title: g.title,
          minutes: g.minutes,
          targetMinutes: g.targetMinutes as number | null,
          targetDate: g.targetDate as string | null,
        }
      }),
      courses: summary.courses.map((c) => {
        if (
          !object(c) ||
          !(c.courseId === null || typeof c.courseId === 'string') ||
          typeof c.name !== 'string' ||
          !count(c.minutes)
        )
          throw new Error('Invalid Study course')
        return {
          courseId: c.courseId as string | null,
          name: c.name,
          minutes: c.minutes,
        }
      }),
    },
  } as StudyWorkspace
}
function object(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}
function count(v: unknown): v is number {
  return Number.isSafeInteger(v) && (v as number) >= 0
}
