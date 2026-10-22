import type {
  FamilyMemberRole,
  SafeFamilyProfile,
} from './family-auth.service.js'
import {
  FAMILY_TIME_ZONE,
  getBreakfastTiming,
  getNextBreakfastDate,
  isBreakfastDate,
} from '../time/family-calendar.js'

export type PersistedBreakfastState = 'SELECTED' | 'CUSTOM' | 'NOT_EATING'
export type BreakfastResponseState = 'NO_RESPONSE' | PersistedBreakfastState

export interface BreakfastCatalogItem {
  id: string
  name: string
  displayOrder: number
}

export interface BreakfastSelectedItem {
  id: string
  name: string
}

export interface BreakfastMember {
  id: string
  displayName: string
  role: FamilyMemberRole
  avatarType: string | null
  avatarValue: string | null
}

export interface BreakfastSelectionRecord {
  memberId: string
  breakfastDate: string
  state: PersistedBreakfastState
  catalogItem: BreakfastSelectedItem | null
  customText: string | null
  createdAt: string
  updatedAt: string
}

export interface UpsertBreakfastSelection {
  memberId: string
  breakfastDate: string
  state: PersistedBreakfastState
  dishId: string | null
  customText: string | null
}

export interface BreakfastPurchaseRecord {
  id: string
  breakfastDate: string
  confirmedBy: { id: string; displayName: string }
  message: string | null
  purchasedAt: string
  createdAt: string
  updatedAt: string
}

export interface ConfirmBreakfastPurchase {
  actorMemberId: string
  breakfastDate: string
  message: string | null
}

export interface BreakfastRepository {
  listActiveCatalog(): Promise<BreakfastCatalogItem[]>
  listActiveMembers(): Promise<BreakfastMember[]>
  listSelections(
    date: string,
    memberIds: string[],
  ): Promise<BreakfastSelectionRecord[]>
  findActiveCatalogItem(id: string): Promise<BreakfastCatalogItem | null>
  findPurchase(date: string): Promise<BreakfastPurchaseRecord | null>
  confirmPurchase(
    input: ConfirmBreakfastPurchase,
  ): Promise<BreakfastPurchaseRecord>
  upsertSelection(
    input: UpsertBreakfastSelection,
  ): Promise<BreakfastSelectionRecord>
}

export interface BreakfastDayResponse {
  member: {
    id: string
    displayName: string
    avatarType: string | null
    avatarValue: string | null
  }
  state: BreakfastResponseState
  catalogItem: BreakfastSelectedItem | null
  customText: string | null
  updatedAt: string | null
}

export interface BreakfastDay {
  date: string
  opensAt: string
  deadlineAt: string
  timeZone: string
  isOpen: boolean
  purchase: BreakfastPurchaseRecord | null
  responses: BreakfastDayResponse[]
}

interface NormalizedResponse {
  state: PersistedBreakfastState
  catalogItemId: string | null
  customText: string | null
}

type Clock = () => Date

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class BreakfastValidationError extends Error {
  constructor(message = 'Invalid breakfast request') {
    super(message)
    this.name = 'BreakfastValidationError'
  }
}

export class BreakfastForbiddenError extends Error {
  constructor() {
    super('This profile cannot submit a breakfast response')
    this.name = 'BreakfastForbiddenError'
  }
}

export class BreakfastPurchaseForbiddenError extends Error {
  constructor() {
    super('Only a parent can confirm breakfast purchase')
    this.name = 'BreakfastPurchaseForbiddenError'
  }
}

export class BreakfastClosedError extends Error {
  constructor() {
    super('Breakfast choices are closed for this date')
    this.name = 'BreakfastClosedError'
  }
}

export class BreakfastUnavailableError extends Error {
  constructor() {
    super('Breakfast information is temporarily unavailable')
    this.name = 'BreakfastUnavailableError'
  }
}

export class BreakfastService {
  private readonly repository: BreakfastRepository
  private readonly clock: Clock

  constructor(
    repository: BreakfastRepository,
    clock: Clock = () => new Date(),
  ) {
    this.repository = repository
    this.clock = clock
  }

  async getCatalog(): Promise<BreakfastCatalogItem[]> {
    try {
      return await this.repository.listActiveCatalog()
    } catch {
      throw new BreakfastUnavailableError()
    }
  }

  async getDay(
    profile: SafeFamilyProfile,
    requestedDate: unknown,
  ): Promise<BreakfastDay> {
    const now = this.clock()
    const date = resolveRequestedDate(requestedDate, now)
    const timing = getBreakfastTiming(date, now)

    try {
      const members =
        profile.role === 'PARENT'
          ? (await this.repository.listActiveMembers()).filter(
              (member) => member.role !== 'PARENT',
            )
          : [toBreakfastMember(profile)]
      const memberIds = members.map((member) => member.id)
      const selections =
        memberIds.length === 0
          ? []
          : await this.repository.listSelections(date, memberIds)
      const purchase = await this.repository.findPurchase(date)
      const selectionsByMember = new Map(
        selections.map((selection) => [selection.memberId, selection]),
      )

      return {
        date,
        opensAt: timing.opensAt.toISOString(),
        deadlineAt: timing.deadlineAt.toISOString(),
        timeZone: FAMILY_TIME_ZONE,
        isOpen: timing.isOpen && purchase === null,
        purchase,
        responses: members.map((member) =>
          toDayResponse(member, selectionsByMember.get(member.id)),
        ),
      }
    } catch {
      throw new BreakfastUnavailableError()
    }
  }

  async getRecent(
    profile: SafeFamilyProfile,
    throughDate: string,
    limit = 14,
  ): Promise<BreakfastDay[]> {
    if (!isBreakfastDate(throughDate) || !Number.isInteger(limit) || limit < 1 || limit > 31) {
      throw new BreakfastValidationError('Invalid breakfast history request')
    }

    const days: BreakfastDay[] = []
    for (let offset = 0; offset < limit; offset += 1) {
      days.push(await this.getDay(profile, shiftDate(throughDate, -offset)))
    }
    return days
  }

  async saveResponse(
    profile: SafeFamilyProfile,
    requestedDate: unknown,
    input: unknown,
  ): Promise<BreakfastDayResponse> {
    if (profile.role === 'PARENT') {
      throw new BreakfastForbiddenError()
    }

    if (!isBreakfastDate(requestedDate)) {
      throw new BreakfastValidationError('Breakfast date must use YYYY-MM-DD')
    }

    const timing = getBreakfastTiming(requestedDate, this.clock())
    if (!timing.isOpen) {
      throw new BreakfastClosedError()
    }

    const response = normalizeResponse(input)
    try {
      if (await this.repository.findPurchase(requestedDate))
        throw new BreakfastClosedError()
    } catch (e) {
      if (e instanceof BreakfastClosedError) throw e
      throw new BreakfastUnavailableError()
    }
    let catalogItem: BreakfastCatalogItem | null = null

    if (response.catalogItemId !== null) {
      try {
        catalogItem = await this.repository.findActiveCatalogItem(
          response.catalogItemId,
        )
      } catch {
        throw new BreakfastUnavailableError()
      }

      if (catalogItem === null) {
        throw new BreakfastValidationError('Catalog item is not available')
      }
    }

    try {
      const saved = await this.repository.upsertSelection({
        memberId: profile.id,
        breakfastDate: requestedDate,
        state: response.state,
        dishId: catalogItem?.id ?? null,
        customText: response.customText,
      })

      return toDayResponse(toBreakfastMember(profile), saved)
    } catch (e) {
      if (e instanceof BreakfastClosedError) throw e
      throw new BreakfastUnavailableError()
    }
  }

  async confirmPurchase(
    profile: SafeFamilyProfile,
    requestedDate: unknown,
    input: unknown,
  ): Promise<BreakfastPurchaseRecord> {
    if (profile.role !== 'PARENT') {
      throw new BreakfastPurchaseForbiddenError()
    }

    if (!isBreakfastDate(requestedDate)) {
      throw new BreakfastValidationError('Breakfast date must use YYYY-MM-DD')
    }

    const message = normalizePurchaseMessage(input)

    try {
      return await this.repository.confirmPurchase({
        actorMemberId: profile.id,
        breakfastDate: requestedDate,
        message,
      })
    } catch {
      throw new BreakfastUnavailableError()
    }
  }
}

function resolveRequestedDate(value: unknown, now: Date): string {
  if (value === 'next') {
    return getNextBreakfastDate(now)
  }

  if (!isBreakfastDate(value)) {
    throw new BreakfastValidationError('Breakfast date must use YYYY-MM-DD')
  }

  return value
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function normalizeResponse(input: unknown): NormalizedResponse {
  if (!isObject(input) || typeof input.state !== 'string') {
    throw new BreakfastValidationError()
  }

  if (input.state === 'SELECTED') {
    if (
      !hasOnlyKeys(input, ['state', 'catalogItemId']) ||
      typeof input.catalogItemId !== 'string' ||
      !UUID_PATTERN.test(input.catalogItemId)
    ) {
      throw new BreakfastValidationError()
    }

    return {
      state: 'SELECTED',
      catalogItemId: input.catalogItemId,
      customText: null,
    }
  }

  if (input.state === 'CUSTOM') {
    if (
      !hasOnlyKeys(input, ['state', 'customText']) ||
      typeof input.customText !== 'string'
    ) {
      throw new BreakfastValidationError()
    }

    const customText = input.customText.trim()
    if (customText.length < 1 || customText.length > 120) {
      throw new BreakfastValidationError()
    }

    return { state: 'CUSTOM', catalogItemId: null, customText }
  }

  if (input.state === 'NOT_EATING') {
    if (!hasOnlyKeys(input, ['state'])) {
      throw new BreakfastValidationError()
    }

    return { state: 'NOT_EATING', catalogItemId: null, customText: null }
  }

  throw new BreakfastValidationError()
}

function normalizePurchaseMessage(input: unknown): string | null {
  if (!isObject(input) || !hasOnlyKeys(input, ['message'])) {
    throw new BreakfastValidationError()
  }

  if (!Object.hasOwn(input, 'message') || input.message === null) {
    return null
  }

  if (typeof input.message !== 'string') {
    throw new BreakfastValidationError()
  }

  const message = input.message.trim()
  if (message.length > 300) {
    throw new BreakfastValidationError()
  }

  return message.length === 0 ? null : message
}

function toBreakfastMember(profile: SafeFamilyProfile): BreakfastMember {
  return {
    id: profile.id,
    displayName: profile.displayName,
    role: profile.role,
    avatarType: profile.avatarType,
    avatarValue: profile.avatarValue,
  }
}

function toDayResponse(
  member: BreakfastMember,
  selection?: BreakfastSelectionRecord,
): BreakfastDayResponse {
  return {
    member: {
      id: member.id,
      displayName: member.displayName,
      avatarType: member.avatarType,
      avatarValue: member.avatarValue,
    },
    state: selection?.state ?? 'NO_RESPONSE',
    catalogItem: selection?.catalogItem ?? null,
    customText: selection?.customText ?? null,
    updatedAt: selection?.updatedAt ?? null,
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: string[],
): boolean {
  const allowed = new Set(allowedKeys)
  return Object.keys(value).every((key) => allowed.has(key))
}
