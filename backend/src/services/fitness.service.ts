import { ApiError } from '../errors/api-error.js'
import type { SafeFamilyProfile } from './family-auth.service.js'
import { getFamilyDate } from '../time/family-calendar.js'
import { validDate } from './calendar.service.js'
export const FITNESS_KINDS = ['plans', 'days', 'goals', 'sessions'] as const
export type FitnessKind = (typeof FITNESS_KINDS)[number]
export interface FitnessPlanInput {
  name: string
  note: string | null
  isActive: boolean
}
export interface FitnessDayInput {
  planId: string
  weekday: number
  title: string
  note: string | null
}
export interface FitnessGoalInput {
  weeklySessionTarget: number
  isActive: boolean
}
export interface FitnessSessionInput {
  planDayId: string | null
  performedAt: string
  durationMinutes: number | null
  title: string
  note: string | null
}
export type FitnessInput =
  | FitnessPlanInput
  | FitnessDayInput
  | FitnessGoalInput
  | FitnessSessionInput
export interface FitnessPlan extends FitnessPlanInput {
  id: string
}
export interface FitnessDay extends FitnessDayInput {
  id: string
}
export interface FitnessGoal extends FitnessGoalInput {
  id: string
}
export interface FitnessSession extends FitnessSessionInput {
  id: string
}
export interface FitnessSummary {
  weekStart: string
  weekEnd: string
  sessionsThisWeek: number
  weeklyTarget: number | null
  completionPercent: number | null
  totalMinutes: number
  unrecordedDurationCount: number
  nextWorkout: {
    planDayId: string
    title: string
    date: string
    weekday: number
  } | null
}
export interface FitnessWorkspace {
  plans: FitnessPlan[]
  days: FitnessDay[]
  goals: FitnessGoal[]
  sessions: FitnessSession[]
  summary: FitnessSummary
}
export interface FitnessRepository {
  read(actorId: string, today: string): Promise<FitnessWorkspace>
  mutate(
    actorId: string,
    kind: FitnessKind,
    id: string | null,
    input: FitnessInput | null,
    remove: boolean,
  ): Promise<void>
}
export class FitnessService {
  constructor(
    private readonly repository: FitnessRepository,
    private readonly clock = () => new Date(),
  ) {}
  async read(actor: SafeFamilyProfile) {
    allowed(actor)
    return this.run(() =>
      this.repository.read(actor.id, getFamilyDate(this.clock())),
    )
  }
  async summary(actor: SafeFamilyProfile) {
    return (await this.read(actor)).summary
  }
  async save(
    actor: SafeFamilyProfile,
    kind: unknown,
    id: unknown,
    input: unknown,
  ) {
    allowed(actor)
    const k = kindValue(kind)
    if (id !== null) fitnessId(id)
    const data = normalizeFitness(k, input, getFamilyDate(this.clock()))
    await this.run(() =>
      this.repository.mutate(actor.id, k, id as string | null, data, false),
    )
  }
  async remove(actor: SafeFamilyProfile, kind: unknown, id: unknown) {
    allowed(actor)
    const k = kindValue(kind)
    fitnessId(id)
    await this.run(() => this.repository.mutate(actor.id, k, id, null, true))
  }
  private async run<T>(op: () => Promise<T>) {
    try {
      return await op()
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        503,
        'FITNESS_UNAVAILABLE',
        'Fitness is temporarily unavailable',
      )
    }
  }
}
function allowed(actor: SafeFamilyProfile) {
  if (!['ADMIN', 'MEMBER'].includes(actor.role))
    throw new ApiError(
      403,
      'FITNESS_FORBIDDEN',
      'Fitness workspace is private and unavailable for this role',
    )
}
function kindValue(v: unknown): FitnessKind {
  if (!FITNESS_KINDS.includes(v as FitnessKind)) invalid()
  return v as FitnessKind
}
export function fitnessId(v: unknown): asserts v is string {
  if (
    typeof v !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v,
    )
  )
    invalid()
}
export function normalizeFitness(
  kind: FitnessKind,
  value: unknown,
  today: string,
): FitnessInput {
  if (!object(value)) invalid()
  const keys = {
    plans: ['name', 'note', 'isActive'],
    days: ['planId', 'weekday', 'title', 'note'],
    goals: ['weeklySessionTarget', 'isActive'],
    sessions: ['planDayId', 'performedAt', 'durationMinutes', 'title', 'note'],
  }[kind]
  if (Object.keys(value).some((k) => !keys.includes(k))) invalid()
  if (kind === 'plans') {
    if (typeof value.isActive !== 'boolean') invalid()
    return {
      name: text(value.name, 120),
      note: optionalText(value.note),
      isActive: value.isActive,
    }
  }
  if (kind === 'days') {
    fitnessId(value.planId)
    return {
      planId: value.planId,
      weekday: integer(value.weekday, 7),
      title: text(value.title, 120),
      note: optionalText(value.note),
    }
  }
  if (kind === 'goals') {
    if (typeof value.isActive !== 'boolean') invalid()
    return {
      weeklySessionTarget: integer(value.weeklySessionTarget, 21),
      isActive: value.isActive,
    }
  }
  const performedAt = value.performedAt
  if (!validDate(performedAt) || performedAt > today) invalid()
  const day = value.planDayId ?? null
  if (day !== null) fitnessId(day)
  return {
    planDayId: day as string | null,
    performedAt,
    durationMinutes:
      value.durationMinutes === null || value.durationMinutes === undefined
        ? null
        : integer(value.durationMinutes, 1440),
    title: text(value.title, 120),
    note: optionalText(value.note),
  }
}
function integer(v: unknown, max: number) {
  if (!Number.isInteger(v) || (v as number) < 1 || (v as number) > max)
    invalid()
  return v as number
}
function text(v: unknown, max: number) {
  if (typeof v !== 'string' || !v.trim() || Array.from(v.trim()).length > max)
    invalid()
  return v.trim()
}
function optionalText(v: unknown) {
  return v === null || v === undefined || (typeof v === 'string' && !v.trim())
    ? null
    : text(v, 1000)
}
function object(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}
function invalid(): never {
  throw new ApiError(400, 'FITNESS_INVALID', 'Invalid Fitness input')
}
