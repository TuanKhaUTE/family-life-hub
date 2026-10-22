export type MealType = 'LUNCH' | 'DINNER'
export type MealMode = 'OPEN_CHOICE' | 'OPTION_POLL'
export type MealStatus = 'OPEN' | 'CLOSED' | 'SELF_SERVICE' | 'CANCELLED'
export type MealResponseState =
  | 'NO_RESPONSE'
  | 'SELECTED_OPTION'
  | 'CUSTOM'
  | 'NOT_EATING'
export interface MealOption {
  id: string
  label: string
  sortOrder: number
}
export interface MealResponse {
  member: {
    id: string
    displayName: string
    avatarType: string | null
    avatarValue: string | null
  }
  state: MealResponseState
  option: { id: string; label: string } | null
  customText: string | null
  updatedAt: string | null
}
export interface MealRequest {
  candidates?: { name: string; chosenBy: string[] }[]
  id: string
  mealDate: string
  mealType: MealType
  mode: MealMode | null
  status: MealStatus
  deadlineAt: string | null
  parentMessage: string | null
  createdBy: { id: string; displayName: string }
  options: MealOption[]
  createdAt: string
  updatedAt: string
  timeZone: string
  isOpen: boolean
  responses: MealResponse[]
}
export type CreateMealRequest = {
  confirmResponseReset?: boolean
  mealDate: string
  mealType: MealType
  parentMessage?: string | null
} & (
  | { mode: 'SELF_SERVICE' }
  | { mode: 'OPEN_CHOICE'; deadlineAt: string }
  | { mode: 'OPTION_POLL'; deadlineAt: string; options: string[] }
)
export type MealSubmission =
  | { responseType: 'NOT_EATING' }
  | { responseType: 'CUSTOM'; customText: string }
  | { responseType: 'SELECTED_OPTION'; optionId: string }

const safeError = 'Meal information is temporarily unavailable.'
export class MealClosedApiError extends Error {}
export class MealConflictApiError extends Error {}
export class MealResetRequiredApiError extends Error {}

export async function fetchCurrentMealRequests(): Promise<MealRequest[]> {
  const body = await requestJson('/api/meals/requests/current')
  if (
    !isObject(body) ||
    !Array.isArray(body.requests) ||
    !body.requests.every(isMealRequest)
  )
    throw new Error(safeError)
  return body.requests
}
export async function createMealRequest(
  input: CreateMealRequest,
): Promise<MealRequest> {
  const body = await requestJson('/api/meals/requests', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!isObject(body) || !isMealRequest(body.request))
    throw new Error(safeError)
  return body.request
}
export async function updateMealRequest(
  id: string,
  input:
    | { parentMessage: string | null }
    | {
        status: MealStatus
        deadlineAt?: string | null
        parentMessage?: string | null
      }
    | {
        status: 'OPEN' | 'SELF_SERVICE'
        mode: MealMode | 'SELF_SERVICE'
        deadlineAt: string | null
        parentMessage?: string | null
        options: string[]
        confirmResponseReset?: boolean
      },
): Promise<MealRequest> {
  const body = await requestJson(
    `/api/meals/requests/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  )
  if (!isObject(body) || !isMealRequest(body.request))
    throw new Error(safeError)
  return body.request
}
export async function saveMealResponse(id: string, input: MealSubmission) {
  const body = await requestJson(
    `/api/meals/requests/${encodeURIComponent(id)}/response`,
    { method: 'PUT', body: JSON.stringify(input) },
  )
  if (!isObject(body) || !isObject(body.response)) throw new Error(safeError)
  return body.response
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  try {
    const response = await fetch(path, {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as unknown
      if (
        response.status === 409 &&
        isObject(body) &&
        isObject(body.error) &&
        body.error.code === 'MEAL_RESPONSE_RESET_REQUIRED'
      )
        throw new MealResetRequiredApiError()
      if (
        response.status === 409 &&
        isObject(body) &&
        isObject(body.error) &&
        body.error.code === 'MEAL_CLOSED'
      )
        throw new MealClosedApiError()
      if (
        response.status === 409 &&
        isObject(body) &&
        isObject(body.error) &&
        body.error.code === 'MEAL_CONFLICT'
      )
        throw new MealConflictApiError()
      throw new Error(safeError)
    }
    return (await response.json()) as unknown
  } catch (error) {
    if (
      error instanceof MealClosedApiError ||
      error instanceof MealConflictApiError ||
      error instanceof MealResetRequiredApiError
    )
      throw error
    throw new Error(safeError)
  }
}
function isMealRequest(value: unknown): value is MealRequest {
  if (
    !isObject(value) ||
    !Array.isArray(value.options) ||
    !Array.isArray(value.responses) ||
    !isObject(value.createdBy)
  )
    return false
  return (
    typeof value.id === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(value.mealDate)) &&
    (value.mealType === 'LUNCH' || value.mealType === 'DINNER') &&
    (value.mode === null ||
      value.mode === 'OPEN_CHOICE' ||
      value.mode === 'OPTION_POLL') &&
    (value.status === 'OPEN' ||
      value.status === 'CLOSED' ||
      value.status === 'SELF_SERVICE' ||
      value.status === 'CANCELLED') &&
    (value.deadlineAt === null || isTimestamp(value.deadlineAt)) &&
    (value.parentMessage === null || typeof value.parentMessage === 'string') &&
    typeof value.createdBy.id === 'string' &&
    typeof value.createdBy.displayName === 'string' &&
    value.options.every(isOption) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt) &&
    typeof value.timeZone === 'string' &&
    typeof value.isOpen === 'boolean' &&
    value.responses.every(isResponse)
  )
}
function isOption(value: unknown) {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    Number.isInteger(value.sortOrder)
  )
}
function isResponse(value: unknown) {
  return (
    isObject(value) &&
    isObject(value.member) &&
    typeof value.member.id === 'string' &&
    typeof value.member.displayName === 'string' &&
    ['NO_RESPONSE', 'SELECTED_OPTION', 'CUSTOM', 'NOT_EATING'].includes(
      String(value.state),
    ) &&
    (value.option === null ||
      (isObject(value.option) &&
        typeof value.option.id === 'string' &&
        typeof value.option.label === 'string')) &&
    (value.customText === null || typeof value.customText === 'string') &&
    (value.updatedAt === null || isTimestamp(value.updatedAt))
  )
}
function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
