import { ApiError } from '../errors/api-error.js'
import type { SafeFamilyProfile } from './family-auth.service.js'
import { getFamilyDate } from '../time/family-calendar.js'
import { validDate } from './calendar.service.js'

export const WELLNESS_ACTIVITY_LEVELS = [
  'SEDENTARY',
  'LIGHT',
  'MODERATE',
  'ACTIVE',
  'VERY_ACTIVE',
] as const
export interface WellnessProfile {
  heightCm: number | null
  targetWeightKg: number | null
  activityLevel: (typeof WELLNESS_ACTIVITY_LEVELS)[number] | null
}
export interface WeightInput {
  loggedDate: string
  weightKg: number
  note: string | null
}
export interface WeightLog extends WeightInput {
  id: string
}
export interface WellnessData {
  profile: WellnessProfile | null
  logs: WeightLog[]
}
export interface WeightTrend {
  fromDate: string
  toDate: string
  changeKg: number
  pointCount: number
}
export interface WellnessSummary {
  currentWeightKg: number | null
  currentLoggedDate: string | null
  previousWeightKg: number | null
  previousLoggedDate: string | null
  changeKg: number | null
  bmi: number | null
  trend7: WeightTrend | null
  trend30: WeightTrend | null
}
export interface WellnessWorkspace extends WellnessData {
  summary: WellnessSummary
}
export interface WellnessRepository {
  // One entry/date means 31 latest rows contain every possible 30-day observation.
  read(actorId: string, today: string): Promise<WellnessData>
  mutate(
    actorId: string,
    kind: 'profile' | 'logs',
    id: string | null,
    input: WellnessProfile | WeightInput | null,
    remove: boolean,
  ): Promise<void>
}
export class WellnessService {
  constructor(
    private readonly repository: WellnessRepository,
    private readonly clock = () => new Date(),
  ) {}
  async read(actor: SafeFamilyProfile): Promise<WellnessWorkspace> {
    allowed(actor)
    return this.run(async () => {
      const today = getFamilyDate(this.clock())
      const data = await this.repository.read(actor.id, today)
      return {
        profile: data.profile,
        logs: data.logs.slice(0, 14),
        summary: calculateWellness(data.profile, data.logs, today),
      }
    })
  }
  async save(
    actor: SafeFamilyProfile,
    kind: 'profile' | 'logs',
    id: string | null,
    input: unknown,
  ) {
    allowed(actor)
    if (id !== null) wellnessId(id)
    const value =
      kind === 'profile'
        ? normalizeWellnessProfile(input)
        : normalizeWeight(input, getFamilyDate(this.clock()))
    await this.run(() =>
      this.repository.mutate(actor.id, kind, id, value, false),
    )
  }
  async remove(
    actor: SafeFamilyProfile,
    kind: 'profile' | 'logs',
    id: string | null,
  ) {
    allowed(actor)
    if (kind === 'logs') wellnessId(id)
    await this.run(() => this.repository.mutate(actor.id, kind, id, null, true))
  }
  private async run<T>(operation: () => Promise<T>) {
    try {
      return await operation()
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        503,
        'WELLNESS_UNAVAILABLE',
        'Wellness is temporarily unavailable',
      )
    }
  }
}
export function calculateWellness(
  profile: WellnessProfile | null,
  logs: WeightLog[],
  today: string,
): WellnessSummary {
  const ordered = [...logs]
    .filter((log) => log.loggedDate <= today)
    .sort((a, b) => b.loggedDate.localeCompare(a.loggedDate))
  const current = ordered[0],
    previous = ordered[1]
  function trend(days: number): WeightTrend | null {
    const start = new Date(today + 'T12:00:00Z')
    start.setUTCDate(start.getUTCDate() - days + 1)
    const points = ordered.filter(
      (log) => log.loggedDate >= start.toISOString().slice(0, 10),
    )
    if (points.length < 2) return null
    const first = points[points.length - 1]!,
      last = points[0]!
    return {
      fromDate: first.loggedDate,
      toDate: last.loggedDate,
      changeKg: rounded(last.weightKg - first.weightKg),
      pointCount: points.length,
    }
  }
  return {
    currentWeightKg: current?.weightKg ?? null,
    currentLoggedDate: current?.loggedDate ?? null,
    previousWeightKg: previous?.weightKg ?? null,
    previousLoggedDate: previous?.loggedDate ?? null,
    changeKg:
      current && previous
        ? rounded(current.weightKg - previous.weightKg)
        : null,
    bmi:
      current && profile?.heightCm
        ? rounded(current.weightKg / (profile.heightCm / 100) ** 2, 1)
        : null,
    trend7: trend(7),
    trend30: trend(30),
  }
}
export function normalizeWellnessProfile(input: unknown): WellnessProfile {
  const value = editable(input, ['heightCm', 'targetWeightKg', 'activityLevel'])
  const activity = value.activityLevel ?? null
  if (
    activity !== null &&
    !WELLNESS_ACTIVITY_LEVELS.includes(
      activity as WellnessProfile['activityLevel'] & string,
    )
  )
    invalid()
  return {
    heightCm:
      value.heightCm == null ? null : measurement(value.heightCm, 100, 250),
    targetWeightKg:
      value.targetWeightKg == null
        ? null
        : measurement(value.targetWeightKg, 20, 350),
    activityLevel: activity as WellnessProfile['activityLevel'],
  }
}
export function normalizeWeight(input: unknown, today: string): WeightInput {
  const value = editable(input, ['loggedDate', 'weightKg', 'note'])
  if (!validDate(value.loggedDate) || value.loggedDate > today) invalid()
  let note: string | null = null
  if (value.note != null) {
    if (
      typeof value.note !== 'string' ||
      Array.from(value.note.trim()).length > 1000
    )
      invalid()
    note = value.note.trim() || null
  }
  return {
    loggedDate: value.loggedDate,
    weightKg: measurement(value.weightKg, 20, 350),
    note,
  }
}
export function wellnessId(v: unknown): asserts v is string {
  if (
    typeof v !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v,
    )
  )
    invalid()
}
function measurement(v: unknown, min: number, max: number) {
  if (
    typeof v !== 'number' ||
    !Number.isFinite(v) ||
    v < min ||
    v > max ||
    Math.abs(v * 100 - Math.round(v * 100)) > 1e-7
  )
    invalid()
  return v
}
function editable(v: unknown, keys: string[]): Record<string, unknown> {
  if (
    !v ||
    typeof v !== 'object' ||
    Array.isArray(v) ||
    Object.keys(v).some((k) => !keys.includes(k))
  )
    invalid()
  return v as Record<string, unknown>
}
function allowed(actor: SafeFamilyProfile) {
  if (!['ADMIN', 'MEMBER'].includes(actor.role))
    throw new ApiError(
      403,
      'WELLNESS_FORBIDDEN',
      'Wellness workspace is private and unavailable for this role',
    )
}
function rounded(v: number, digits = 2) {
  return Number(v.toFixed(digits))
}
function invalid(): never {
  throw new ApiError(400, 'WELLNESS_INVALID', 'Invalid Wellness input')
}
