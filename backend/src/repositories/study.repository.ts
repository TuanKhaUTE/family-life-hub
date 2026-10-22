import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '../config/supabase.js'
import { ApiError } from '../errors/api-error.js'
import {
  normalizeStudy,
  studyId,
  type StudyKind,
  type StudyInput,
  type StudyWorkspace,
  type StudyRepository,
} from '../services/study.service.js'
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
    await this.rpc('study_mutate', {
      p_actor_member_id: actorId,
      p_kind: kind,
      p_id: id,
      p_input: input,
      p_remove: remove,
    })
  }
}
export function parseStudyWorkspace(
  value: unknown,
  today: string,
): StudyWorkspace {
  if (!object(value)) throw new Error('Invalid Study response')
  const records = (kind: StudyKind) => {
    const list = value[kind]
    if (!Array.isArray(list)) throw new Error('Invalid Study response')
    return list.map((row) => {
      if (!object(row)) throw new Error('Invalid Study response')
      studyId(row.id)
      const keys = {
        semesters: ['name', 'startDate', 'endDate', 'isActive'],
        courses: ['name', 'semesterId', 'code'],
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
