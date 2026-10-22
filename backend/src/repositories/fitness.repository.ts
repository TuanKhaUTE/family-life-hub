import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '../config/supabase.js'
import { ApiError } from '../errors/api-error.js'
import {
  fitnessId,
  normalizeFitness,
  type FitnessRepository,
  type FitnessKind,
  type FitnessInput,
  type FitnessWorkspace,
} from '../services/fitness.service.js'
import { validDate } from '../services/calendar.service.js'
export class SupabaseFitnessRepository implements FitnessRepository {
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
          'FITNESS_FORBIDDEN',
          'Fitness access is not permitted',
        )
      if (error.code === 'P0002')
        throw new ApiError(404, 'FITNESS_NOT_FOUND', 'Fitness record not found')
      if (error.code === '23503')
        throw new ApiError(
          409,
          'FITNESS_IN_USE',
          'Fitness record is linked to other records',
        )
      if (error.code === '23505')
        throw new ApiError(
          409,
          'FITNESS_DAY_EXISTS',
          'This plan already has a workout on that weekday',
        )
      if (['22023', '23514', '23502', '22P02'].includes(error.code))
        throw new ApiError(400, 'FITNESS_INVALID', 'Invalid Fitness input')
      throw new Error('Fitness storage unavailable')
    }
    return data as unknown
  }
  async read(actorId: string, today: string): Promise<FitnessWorkspace> {
    const data = await this.rpc('fitness_read', {
      p_actor_member_id: actorId,
      p_today: today,
    })
    try {
      return parseFitness(data, today)
    } catch {
      throw new Error('Invalid Fitness storage response')
    }
  }
  async mutate(
    actorId: string,
    kind: FitnessKind,
    id: string | null,
    input: FitnessInput | null,
    remove: boolean,
  ) {
    await this.rpc('fitness_mutate', {
      p_actor_member_id: actorId,
      p_kind: kind,
      p_id: id,
      p_input: input,
      p_remove: remove,
    })
  }
}
function parseFitness(v: unknown, today: string): FitnessWorkspace {
  if (!object(v)) throw new Error()
  const records = (kind: FitnessKind) => {
    const list = v[kind]
    if (!Array.isArray(list)) throw new Error()
    const keys = {
      plans: ['name', 'note', 'isActive'],
      days: ['planId', 'weekday', 'title', 'note'],
      goals: ['weeklySessionTarget', 'isActive'],
      sessions: [
        'planDayId',
        'performedAt',
        'durationMinutes',
        'title',
        'note',
      ],
    }[kind]
    return list.map((row) => {
      if (!object(row)) throw new Error()
      fitnessId(row.id)
      return {
        id: row.id,
        ...normalizeFitness(
          kind,
          Object.fromEntries(keys.map((k) => [k, row[k]])),
          today,
        ),
      }
    })
  }
  const s = v.summary
  if (
    !object(s) ||
    !validDate(s.weekStart) ||
    !validDate(s.weekEnd) ||
    !count(s.sessionsThisWeek) ||
    !count(s.totalMinutes) ||
    !count(s.unrecordedDurationCount) ||
    !(
      s.weeklyTarget === null ||
      (count(s.weeklyTarget) && s.weeklyTarget >= 1 && s.weeklyTarget <= 21)
    ) ||
    !(
      s.completionPercent === null ||
      (count(s.completionPercent) && s.completionPercent <= 100)
    )
  )
    throw new Error()
  let next = null
  if (s.nextWorkout !== null) {
    const n = s.nextWorkout
    if (
      !object(n) ||
      typeof n.title !== 'string' ||
      !validDate(n.date) ||
      !count(n.weekday) ||
      n.weekday < 1 ||
      n.weekday > 7
    )
      throw new Error()
    fitnessId(n.planDayId)
    next = {
      planDayId: n.planDayId,
      title: n.title,
      date: n.date,
      weekday: n.weekday,
    }
  }
  return {
    plans: records('plans'),
    days: records('days'),
    goals: records('goals'),
    sessions: records('sessions'),
    summary: {
      weekStart: s.weekStart,
      weekEnd: s.weekEnd,
      sessionsThisWeek: s.sessionsThisWeek,
      weeklyTarget: s.weeklyTarget as number | null,
      completionPercent: s.completionPercent as number | null,
      totalMinutes: s.totalMinutes,
      unrecordedDurationCount: s.unrecordedDurationCount,
      nextWorkout: next,
    },
  } as FitnessWorkspace
}
function object(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}
function count(v: unknown): v is number {
  return Number.isSafeInteger(v) && (v as number) >= 0
}
