export type BreakfastResponseState =
  'NO_RESPONSE' | 'SELECTED' | 'CUSTOM' | 'NOT_EATING'

export interface BreakfastCatalogItem {
  id: string
  name: string
  displayOrder: number
}

export interface BreakfastDayResponse {
  member: {
    id: string
    displayName: string
    avatarType: string | null
    avatarValue: string | null
  }
  state: BreakfastResponseState
  catalogItem: { id: string; name: string } | null
  customText: string | null
  updatedAt: string | null
}

export interface BreakfastDay {
  date: string
  opensAt?: string
  deadlineAt: string
  timeZone: string
  isOpen: boolean
  purchase: BreakfastPurchase | null
  responses: BreakfastDayResponse[]
}

export interface BreakfastPurchase {
  id: string
  breakfastDate: string
  confirmedBy: { id: string; displayName: string }
  message: string | null
  purchasedAt: string
  createdAt: string
  updatedAt: string
}

export type BreakfastSubmission =
  | { state: 'SELECTED'; catalogItemId: string }
  | { state: 'CUSTOM'; customText: string }
  | { state: 'NOT_EATING' }

const SAFE_ERROR = 'Breakfast information is temporarily unavailable.'

export class BreakfastClosedApiError extends Error {
  constructor() {
    super('Breakfast choices are closed')
    this.name = 'BreakfastClosedApiError'
  }
}

export async function fetchBreakfastCatalog(): Promise<BreakfastCatalogItem[]> {
  const body = await requestJson('/api/breakfast/catalog')
  if (!isObject(body) || !Array.isArray(body.items)) throw new Error(SAFE_ERROR)

  const items: unknown[] = body.items
  if (!items.every(isCatalogItem)) throw new Error(SAFE_ERROR)
  return items
}

export async function fetchBreakfastDay(date = 'next'): Promise<BreakfastDay> {
  const body = await requestJson(
    `/api/breakfast/days/${encodeURIComponent(date)}`,
  )
  if (!isObject(body) || !isBreakfastDay(body.day)) throw new Error(SAFE_ERROR)
  return body.day
}

export async function saveBreakfastResponse(
  date: string,
  submission: BreakfastSubmission,
): Promise<BreakfastDayResponse> {
  const body = await requestJson(
    `/api/breakfast/days/${encodeURIComponent(date)}/response`,
    {
      method: 'PUT',
      body: JSON.stringify(submission),
    },
  )
  if (!isObject(body) || !isDayResponse(body.response)) {
    throw new Error(SAFE_ERROR)
  }
  return body.response
}

export async function confirmBreakfastPurchase(
  date: string,
  message: string | null,
): Promise<BreakfastPurchase> {
  const body = await requestJson(
    `/api/breakfast/days/${encodeURIComponent(date)}/purchase`,
    {
      method: 'PUT',
      body: JSON.stringify({ message }),
    },
  )
  if (!isObject(body) || !isBreakfastPurchase(body.purchase)) {
    throw new Error(SAFE_ERROR)
  }
  return body.purchase
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
      const errorBody = (await response.json().catch(() => null)) as unknown
      if (
        response.status === 409 &&
        isObject(errorBody) &&
        isObject(errorBody.error) &&
        errorBody.error.code === 'BREAKFAST_CLOSED'
      ) {
        throw new BreakfastClosedApiError()
      }
      throw new Error(SAFE_ERROR)
    }
    return (await response.json()) as unknown
  } catch (error) {
    if (error instanceof BreakfastClosedApiError) throw error
    throw new Error(SAFE_ERROR)
  }
}

function isBreakfastDay(value: unknown): value is BreakfastDay {
  if (!isObject(value) || !Array.isArray(value.responses)) return false

  return (
    /^\d{4}-\d{2}-\d{2}$/.test(String(value.date)) &&
    typeof value.deadlineAt === 'string' &&
    !Number.isNaN(Date.parse(value.deadlineAt)) &&
    typeof value.timeZone === 'string' &&
    typeof value.isOpen === 'boolean' &&
    (value.purchase === null || isBreakfastPurchase(value.purchase)) &&
    value.responses.every(isDayResponse)
  )
}

function isBreakfastPurchase(value: unknown): value is BreakfastPurchase {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(value.breakfastDate)) &&
    isObject(value.confirmedBy) &&
    typeof value.confirmedBy.id === 'string' &&
    typeof value.confirmedBy.displayName === 'string' &&
    isNullableString(value.message) &&
    isTimestamp(value.purchasedAt) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt)
  )
}

function isCatalogItem(value: unknown): value is BreakfastCatalogItem {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Number.isInteger(value.displayOrder) &&
    Number(value.displayOrder) > 0
  )
}

function isDayResponse(value: unknown): value is BreakfastDayResponse {
  if (!isObject(value) || !isObject(value.member)) return false
  const states: BreakfastResponseState[] = [
    'NO_RESPONSE',
    'SELECTED',
    'CUSTOM',
    'NOT_EATING',
  ]

  return (
    typeof value.member.id === 'string' &&
    typeof value.member.displayName === 'string' &&
    isNullableString(value.member.avatarType) &&
    isNullableString(value.member.avatarValue) &&
    typeof value.state === 'string' &&
    states.includes(value.state as BreakfastResponseState) &&
    isSelectedItem(value.catalogItem) &&
    isNullableString(value.customText) &&
    isNullableString(value.updatedAt)
  )
}

function isSelectedItem(value: unknown): boolean {
  return (
    value === null ||
    (isObject(value) &&
      typeof value.id === 'string' &&
      typeof value.name === 'string')
  )
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
