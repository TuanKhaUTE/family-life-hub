import type {
  FamilyMemberRole,
  SafeFamilyProfile,
} from './family-auth.service.js'
import {
  FAMILY_TIME_ZONE,
  getFamilyDate,
  isFamilyDate,
} from '../time/family-calendar.js'

export type MealType = 'LUNCH' | 'DINNER'
export type MealMode = 'OPEN_CHOICE' | 'OPTION_POLL'
export type MealRequestStatus = 'OPEN' | 'CLOSED' | 'SELF_SERVICE' | 'CANCELLED'
export type MealResponseType = 'SELECTED_OPTION' | 'CUSTOM' | 'NOT_EATING'

export interface MealMember {
  id: string
  displayName: string
  role: FamilyMemberRole
  avatarType: string | null
  avatarValue: string | null
}

export interface MealOption {
  id: string
  label: string
  sortOrder: number
}

export interface MealRequestRecord {
  id: string
  mealDate: string
  mealType: MealType
  mode: MealMode | null
  status: MealRequestStatus
  deadlineAt: string | null
  parentMessage: string | null
  createdBy: { id: string; displayName: string }
  options: MealOption[]
  createdAt: string
  updatedAt: string
}

export interface MealResponseRecord {
  id: string
  requestId: string
  memberId: string
  responseType: MealResponseType
  option: { id: string; label: string } | null
  customText: string | null
  createdAt: string
  updatedAt: string
}

export interface MealRequestView extends MealRequestRecord {
  candidates?: { name: string; chosenBy: string[] }[]
  timeZone: string
  isOpen: boolean
  responses: Array<{
    member: Omit<MealMember, 'role'>
    state: 'NO_RESPONSE' | MealResponseType
    option: { id: string; label: string } | null
    customText: string | null
    updatedAt: string | null
  }>
}

export interface MealRequestRepository {
  configureRequest(input: {
    actorMemberId: string
    requestId: string
    status: 'OPEN' | 'SELF_SERVICE' | 'CANCELLED'
    mode: MealMode | 'SELF_SERVICE'
    deadlineAt: string | null
    parentMessage: string | null
    options: string[]
    confirmResponseReset: boolean
  }): Promise<string>
  listCurrentRequests(fromDate: string): Promise<MealRequestRecord[]>
  listActiveMembers(): Promise<MealMember[]>
  listResponses(
    requestIds: string[],
    memberIds: string[],
  ): Promise<MealResponseRecord[]>
  findRequest(id: string): Promise<MealRequestRecord | null>
  findResponse(id: string): Promise<MealResponseRecord | null>
  createRequest(input: {
    confirmResponseReset?: boolean
    actorMemberId: string
    mealDate: string
    mealType: MealType
    mode: MealMode | 'SELF_SERVICE'
    deadlineAt: string | null
    parentMessage: string | null
    options: string[]
  }): Promise<string>
  updateRequest(input: {
    actorMemberId: string
    requestId: string
    status: MealRequestStatus
    deadlineAt: string | null
    parentMessage: string | null
  }): Promise<string>
  changeSelfServiceRequest(input: {
    actorMemberId: string
    requestId: string
    mode: MealMode
    deadlineAt: string
    parentMessage: string | null
    options: string[]
  }): Promise<string>
  saveResponse(input: {
    actorMemberId: string
    requestId: string
    responseType: MealResponseType
    optionId: string | null
    customText: string | null
  }): Promise<string>
}

type Clock = () => Date
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class MealRequestValidationError extends Error {}
export class MealRequestForbiddenError extends Error {}
export class MealRequestNotFoundError extends Error {}
export class MealRequestClosedError extends Error {}
export class MealRequestConflictError extends Error {}
export class MealResponseResetRequiredError extends MealRequestConflictError {}
export class MealRequestUnavailableError extends Error {}

export class MealRequestService {
  constructor(
    private readonly repository: MealRequestRepository,
    private readonly clock: Clock = () => new Date(),
  ) {}

  async listCurrent(profile: SafeFamilyProfile): Promise<MealRequestView[]> {
    try {
      const requests = await this.repository.listCurrentRequests(
        getFamilyDate(this.clock()),
      )
      return await this.hydrate(
        requests.filter(
          (request) =>
            request.mealDate === getFamilyDate(this.clock()) &&
            request.mealType === 'DINNER' &&
            request.status !== 'CANCELLED',
        ),
        profile,
      )
    } catch (error) {
      if (isKnown(error)) throw error
      throw new MealRequestUnavailableError(
        'Meal requests are temporarily unavailable',
      )
    }
  }

  async create(
    profile: SafeFamilyProfile,
    input: unknown,
  ): Promise<MealRequestView> {
    requireParent(profile)
    const normalized = normalizeCreate(input, this.clock())
    try {
      const id = await this.repository.createRequest({
        actorMemberId: profile.id,
        ...normalized,
        ...(isObject(input) && input.confirmResponseReset === true
          ? { confirmResponseReset: true }
          : {}),
      })
      return await this.getHydrated(id, profile)
    } catch (error) {
      if (error instanceof MealRequestConflictError) throw error
      if (isKnown(error)) throw error
      throw new MealRequestUnavailableError('Meal request could not be created')
    }
  }

  async update(
    profile: SafeFamilyProfile,
    requestId: unknown,
    input: unknown,
  ): Promise<MealRequestView> {
    requireParent(profile)
    requireUuid(requestId)
    const current = await this.safeFind(requestId)
    if (current === null)
      throw new MealRequestNotFoundError('Meal request was not found')
    if (
      isObject(input) &&
      ('mode' in input ||
        input.status === 'CANCELLED' ||
        input.status === 'SELF_SERVICE')
    ) {
      if (
        input.confirmResponseReset !== undefined &&
        typeof input.confirmResponseReset !== 'boolean'
      )
        bad()
      let plan: Omit<
        Parameters<MealRequestRepository['configureRequest']>[0],
        'actorMemberId' | 'requestId'
      >
      if (input.status === 'CANCELLED') {
        if (!onlyKeys(input, ['status'])) bad()
        plan = {
          status: 'CANCELLED',
          mode: current.mode ?? 'SELF_SERVICE',
          deadlineAt: current.deadlineAt,
          parentMessage: current.parentMessage,
          options: current.options.map((option) => option.label),
          confirmResponseReset: false,
        }
      } else {
        const mode =
          input.mode ??
          (input.status === 'SELF_SERVICE' ? 'SELF_SERVICE' : undefined)
        if (
          !onlyKeys(input, [
            'status',
            'mode',
            'deadlineAt',
            'parentMessage',
            'options',
            'confirmResponseReset',
          ]) ||
          input.status !== (mode === 'SELF_SERVICE' ? 'SELF_SERVICE' : 'OPEN')
        )
          bad()
        const normalized = normalizeCreate(
          {
            mealDate: current.mealDate,
            mealType: current.mealType,
            mode,
            deadlineAt: input.deadlineAt,
            parentMessage: input.parentMessage,
            options: input.options,
          },
          this.clock(),
        )
        plan = {
          status: input.status as 'OPEN' | 'SELF_SERVICE',
          mode: normalized.mode,
          deadlineAt: normalized.deadlineAt,
          parentMessage: normalized.parentMessage,
          options: normalized.options,
          confirmResponseReset: input.confirmResponseReset === true,
        }
      }
      try {
        await this.repository.configureRequest({
          actorMemberId: profile.id,
          requestId,
          ...plan,
        })
        return await this.getHydrated(requestId, profile)
      } catch (error) {
        if (isKnown(error)) throw error
        throw new MealRequestUnavailableError(
          'Meal request could not be updated',
        )
      }
    }
    if (
      effectiveStatus(current, this.clock()) !== 'OPEN' &&
      current.status !== 'SELF_SERVICE'
    ) {
      throw new MealRequestClosedError('Meal request can no longer be changed')
    }
    try {
      const update = normalizeUpdate(input, current, this.clock())
      await this.repository.updateRequest({
        actorMemberId: profile.id,
        requestId,
        ...update,
      })
      return await this.getHydrated(requestId, profile)
    } catch (error) {
      if (isKnown(error)) throw error
      throw new MealRequestUnavailableError('Meal request could not be updated')
    }
  }

  async saveResponse(
    profile: SafeFamilyProfile,
    requestId: unknown,
    input: unknown,
  ) {
    if (profile.role === 'PARENT')
      throw new MealRequestForbiddenError(
        'Parents do not submit meal responses',
      )
    requireUuid(requestId)
    const request = await this.safeFind(requestId)
    if (request === null)
      throw new MealRequestNotFoundError('Meal request was not found')
    if (effectiveStatus(request, this.clock()) !== 'OPEN') {
      throw new MealRequestClosedError('Meal responses are closed')
    }
    const response = normalizeResponse(input, request)
    try {
      const id = await this.repository.saveResponse({
        actorMemberId: profile.id,
        requestId,
        ...response,
      })
      const saved = await this.repository.findResponse(id)
      if (saved === null)
        throw new MealRequestUnavailableError(
          'Saved meal response could not be loaded',
        )
      return saved
    } catch (error) {
      if (isKnown(error)) throw error
      throw new MealRequestUnavailableError('Meal response could not be saved')
    }
  }

  private async safeFind(id: string) {
    try {
      return await this.repository.findRequest(id)
    } catch {
      throw new MealRequestUnavailableError(
        'Meal requests are temporarily unavailable',
      )
    }
  }

  private async getHydrated(
    id: string,
    profile: SafeFamilyProfile,
  ): Promise<MealRequestView> {
    const request = await this.repository.findRequest(id)
    if (request === null)
      throw new MealRequestUnavailableError('Meal request could not be loaded')
    return (await this.hydrate([request], profile))[0]!
  }

  private async hydrate(
    requests: MealRequestRecord[],
    profile: SafeFamilyProfile,
  ): Promise<MealRequestView[]> {
    const members =
      profile.role === 'PARENT'
        ? (await this.repository.listActiveMembers()).filter(
            (member) => member.role !== 'PARENT',
          )
        : [{ ...profile }]
    const interactiveIds = requests
      .filter((request) => request.status !== 'SELF_SERVICE')
      .map((request) => request.id)
    const responses =
      interactiveIds.length && members.length
        ? await this.repository.listResponses(
            interactiveIds,
            members.map((member) => member.id),
          )
        : []
    const responseMap = new Map(
      responses.map((response) => [
        `${response.requestId}:${response.memberId}`,
        response,
      ]),
    )
    return requests
      .map<MealRequestView>((request) => ({
        ...request,
        status: effectiveStatus(request, this.clock()),
        timeZone: FAMILY_TIME_ZONE,
        isOpen: effectiveStatus(request, this.clock()) === 'OPEN',
        responses:
          request.status === 'SELF_SERVICE'
            ? []
            : members.map((member) => {
                const response = responseMap.get(`${request.id}:${member.id}`)
                return {
                  member: {
                    id: member.id,
                    displayName: member.displayName,
                    avatarType: member.avatarType,
                    avatarValue: member.avatarValue,
                  },
                  state: response?.responseType ?? 'NO_RESPONSE',
                  option: response?.option ?? null,
                  customText: response?.customText ?? null,
                  updatedAt: response?.updatedAt ?? null,
                }
              }),
      }))
      .map((view) =>
        profile.role === 'PARENT'
          ? { ...view, candidates: deriveMealCandidates(view.responses) }
          : view,
      )
  }
}

export function deriveMealCandidates(responses: MealRequestView['responses']) {
  const candidates = new Map<string, { name: string; chosenBy: string[] }>()
  for (const response of responses) {
    const value =
      response.state === 'SELECTED_OPTION'
        ? response.option?.label
        : response.state === 'CUSTOM'
          ? response.customText
          : null
    const name = value?.normalize('NFC').trim().replace(/\s+/g, ' ')
    if (!name) continue
    const key = name.toLocaleLowerCase('vi-VN')
    const existing = candidates.get(key)
    if (existing) existing.chosenBy.push(response.member.displayName)
    else candidates.set(key, { name, chosenBy: [response.member.displayName] })
  }
  return [...candidates.values()]
}

function normalizeCreate(
  input: unknown,
  now: Date,
): Omit<
  Parameters<MealRequestRepository['createRequest']>[0],
  'actorMemberId'
> {
  if (
    !isObject(input) ||
    !onlyKeys(input, [
      'mealDate',
      'mealType',
      'mode',
      'deadlineAt',
      'parentMessage',
      'options',
      'confirmResponseReset',
    ])
  )
    bad()
  if (
    input.confirmResponseReset !== undefined &&
    typeof input.confirmResponseReset !== 'boolean'
  )
    bad()
  if (!isFamilyDate(input.mealDate) || input.mealDate < getFamilyDate(now))
    bad('Meal date is invalid')
  if (input.mealType !== 'LUNCH' && input.mealType !== 'DINNER') bad()
  if (
    input.mode !== 'OPEN_CHOICE' &&
    input.mode !== 'OPTION_POLL' &&
    input.mode !== 'SELF_SERVICE'
  )
    bad()
  const parentMessage = textOrNull(input.parentMessage, 300)
  const options = normalizeOptions(input.options)
  if (input.mode === 'SELF_SERVICE') {
    if (input.deadlineAt != null || options.length) bad()
    return {
      mealDate: input.mealDate,
      mealType: input.mealType,
      mode: input.mode,
      deadlineAt: null,
      parentMessage,
      options: [],
    }
  }
  const deadlineAt = futureTimestamp(input.deadlineAt, now)
  if (input.mode === 'OPEN_CHOICE' && options.length) bad()
  if (
    input.mode === 'OPTION_POLL' &&
    (options.length < 2 || options.length > 5)
  )
    bad()
  return {
    mealDate: input.mealDate,
    mealType: input.mealType,
    mode: input.mode,
    deadlineAt,
    parentMessage,
    options,
  }
}

function normalizeUpdate(
  input: unknown,
  current: MealRequestRecord,
  now: Date,
): Omit<
  Parameters<MealRequestRepository['updateRequest']>[0],
  'actorMemberId' | 'requestId'
> {
  if (
    !isObject(input) ||
    !onlyKeys(input, ['status', 'deadlineAt', 'parentMessage'])
  )
    bad()
  const status = input.status
  if (status !== 'OPEN' && status !== 'CLOSED' && status !== 'SELF_SERVICE')
    bad()
  if (current.status === 'SELF_SERVICE' && status !== 'SELF_SERVICE') bad()
  const parentMessage = textOrNull(input.parentMessage, 300)
  const deadlineAt =
    status === 'OPEN'
      ? futureTimestamp(input.deadlineAt, now)
      : status === 'CLOSED'
        ? current.deadlineAt
        : null
  return { status, deadlineAt, parentMessage }
}

function normalizeResponse(
  input: unknown,
  request: MealRequestRecord,
): Omit<
  Parameters<MealRequestRepository['saveResponse']>[0],
  'actorMemberId' | 'requestId'
> {
  if (
    !isObject(input) ||
    !onlyKeys(input, ['responseType', 'optionId', 'customText'])
  )
    bad()
  if (input.responseType === 'NOT_EATING') {
    if (input.optionId != null || input.customText != null) bad()
    return {
      responseType: input.responseType,
      optionId: null,
      customText: null,
    }
  }
  if (request.mode === 'OPEN_CHOICE' && input.responseType === 'CUSTOM') {
    return {
      responseType: input.responseType,
      optionId: null,
      customText: requiredText(input.customText, 120),
    }
  }
  if (
    request.mode === 'OPTION_POLL' &&
    input.responseType === 'SELECTED_OPTION' &&
    typeof input.optionId === 'string' &&
    request.options.some((option) => option.id === input.optionId) &&
    input.customText == null
  ) {
    return {
      responseType: input.responseType,
      optionId: input.optionId,
      customText: null,
    }
  }
  bad('Response does not match the meal request mode')
}

function normalizeOptions(value: unknown): string[] {
  if (value == null) return []
  if (!Array.isArray(value)) bad()
  const values = value.map((item) => requiredText(item, 120))
  if (
    new Set(values.map((item) => item.toLocaleLowerCase())).size !==
    values.length
  )
    bad('Meal options must be unique')
  return values
}

function effectiveStatus(
  request: MealRequestRecord,
  now: Date,
): MealRequestStatus {
  return request.status === 'OPEN' &&
    request.deadlineAt &&
    Date.parse(request.deadlineAt) <= now.getTime()
    ? 'CLOSED'
    : request.status
}
function requireParent(profile: SafeFamilyProfile) {
  if (profile.role !== 'PARENT')
    throw new MealRequestForbiddenError(
      'Only a parent can manage meal requests',
    )
}
function requireUuid(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !UUID.test(value))
    bad('Meal request id is invalid')
}
function futureTimestamp(value: unknown, now: Date) {
  if (
    typeof value !== 'string' ||
    Number.isNaN(Date.parse(value)) ||
    Date.parse(value) <= now.getTime()
  )
    bad('Deadline must be a future timestamp')
  return new Date(value).toISOString()
}
function textOrNull(value: unknown, max: number) {
  if (value == null || value === '') return null
  return requiredText(value, max)
}
function requiredText(value: unknown, max: number) {
  if (typeof value !== 'string') bad()
  const result = value.trim()
  if (!result || result.length > max) bad()
  return result
}
function bad(message = 'Invalid meal request'): never {
  throw new MealRequestValidationError(message)
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function onlyKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).every((key) => keys.includes(key))
}
function isKnown(error: unknown) {
  return (
    error instanceof MealRequestValidationError ||
    error instanceof MealRequestForbiddenError ||
    error instanceof MealRequestNotFoundError ||
    error instanceof MealRequestClosedError ||
    error instanceof MealRequestConflictError ||
    error instanceof MealRequestUnavailableError
  )
}
