interface ResponseSummary {
  memberId: string
  displayName: string
  state:
    | 'NO_RESPONSE'
    | 'SELECTED'
    | 'SELECTED_OPTION'
    | 'CUSTOM'
    | 'NOT_EATING'
  choice: string | null
}
export interface HomeSummary {
  date: string
  timeZone: string
  actions: { id: string; label: string }[]
  calendar: {
    events: {
      id: string
      title: string
      startsAt: string
      endsAt: string
      owner: {
        id: string
        displayName: string
        avatarType: string | null
        avatarValue: string | null
      }
    }[]
  }
  breakfast: {
    date: string
    isOpen: boolean
    purchased: boolean
    responses: ResponseSummary[]
  }
  dinner: {
    request: {
      status: 'OPEN' | 'CLOSED' | 'SELF_SERVICE' | 'CANCELLED'
      isOpen: boolean
      responses: ResponseSummary[]
    } | null
    meal: {
      ready: boolean
      readyMessage: string | null
      dishes: { id: string; name: string }[]
      ownUnratedCount: number
    } | null
  }
  recentDishes: {
    id: string
    name: string
    mealDate: string
    averageRating: number | null
    ratingCount: number
    ownRating: number | null
  }[]
}
export async function fetchHome(signal: AbortSignal): Promise<HomeSummary> {
  const response = await fetch('/api/home', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!response.ok) throw new Error('Home unavailable')
  const payload: unknown = await response.json()
  if (!object(payload) || !validHome(payload.home))
    throw new Error('Invalid home summary')
  return payload.home
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
const text = (value: unknown): value is string => typeof value === 'string'
const nullableText = (value: unknown) => value === null || text(value)
const day = (value: unknown) =>
  text(value) &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value))
const score = (value: unknown) =>
  value === null || (typeof value === 'number' && value >= 1 && value <= 5)
const count = (value: unknown) =>
  Number.isInteger(value) && (value as number) >= 0
function responses(value: unknown) {
  return (
    Array.isArray(value) &&
    value.every(
      (r) =>
        object(r) &&
        text(r.memberId) &&
        text(r.displayName) &&
        [
          'NO_RESPONSE',
          'SELECTED',
          'SELECTED_OPTION',
          'CUSTOM',
          'NOT_EATING',
        ].includes(String(r.state)) &&
        nullableText(r.choice),
    )
  )
}
function validHome(value: unknown): value is HomeSummary {
  if (
    !object(value) ||
    !day(value.date) ||
    !text(value.timeZone) ||
    !Array.isArray(value.actions) ||
    !value.actions.every((a) => object(a) && text(a.id) && text(a.label)) ||
    !object(value.breakfast) ||
    !object(value.dinner) ||
    !Array.isArray(value.recentDishes)
  )
    return false
  const b = value.breakfast
  if (
    !object(value.calendar) ||
    !Array.isArray(value.calendar.events) ||
    value.calendar.events.length > 3 ||
    !value.calendar.events.every(
      (item) =>
        object(item) &&
        text(item.id) &&
        text(item.title) &&
        text(item.startsAt) &&
        Number.isFinite(Date.parse(item.startsAt)) &&
        text(item.endsAt) &&
        Number.isFinite(Date.parse(item.endsAt)) &&
        object(item.owner) &&
        text(item.owner.id) &&
        text(item.owner.displayName) &&
        nullableText(item.owner.avatarType) &&
        nullableText(item.owner.avatarValue),
    )
  )
    return false
  const { request, meal } = value.dinner
  return (
    day(b.date) &&
    typeof b.isOpen === 'boolean' &&
    typeof b.purchased === 'boolean' &&
    responses(b.responses) &&
    (request === null ||
      (object(request) &&
        ['OPEN', 'CLOSED', 'SELF_SERVICE', 'CANCELLED'].includes(
          String(request.status),
        ) &&
        typeof request.isOpen === 'boolean' &&
        responses(request.responses))) &&
    (meal === null ||
      (object(meal) &&
        typeof meal.ready === 'boolean' &&
        nullableText(meal.readyMessage) &&
        count(meal.ownUnratedCount) &&
        Array.isArray(meal.dishes) &&
        meal.dishes.every((d) => object(d) && text(d.id) && text(d.name)))) &&
    value.recentDishes.length <= 3 &&
    value.recentDishes.every(
      (d) =>
        object(d) &&
        text(d.id) &&
        text(d.name) &&
        day(d.mealDate) &&
        score(d.averageRating) &&
        count(d.ratingCount) &&
        score(d.ownRating),
    )
  )
}
