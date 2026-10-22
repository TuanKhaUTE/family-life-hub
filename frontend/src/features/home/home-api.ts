import { CHORE_CATEGORIES } from '../chores/chore-api'
import { validActivityProgress, type ActivityProgress } from '../activities/activity-api'
import {
  validHouseholdDuty,
  type HouseholdDuty,
} from '../chores/household-duty-api'
import {
  validExpenseHomeSummary,
  type ExpenseHomeSummary,
} from '../expenses/expense-api'
import { validSummary, type StudySummary } from '../study/study-api'
import {
  validFitnessSummary,
  type FitnessHomeSummary,
} from '../fitness/fitness-api'
interface ResponseSummary {
  memberId: string
  displayName: string
  state:
    'NO_RESPONSE' | 'SELECTED' | 'SELECTED_OPTION' | 'CUSTOM' | 'NOT_EATING'
  choice: string | null
}
export interface HomeSummary {
  householdDuty?: HouseholdDuty | null
  personalCalendar?: HomeSummary['calendar']
  familyFood?: ExpenseHomeSummary
  personalExpenses?: ExpenseHomeSummary
  fitness?: FitnessHomeSummary & { activityProgress?: ActivityProgress }
  study?: Omit<StudySummary, 'courses'> & {
    activityProgress?: ActivityProgress
    latestAssessment?: {
      courseName: string
      title: string
      score: number | null
      maxScore: number | null
      letterGrade: string | null
    }
  }
  date: string
  timeZone: string
  actions: { id: string; label: string }[]
  chores: {
    scheduleId: string
    title: string
    category: (typeof CHORE_CATEGORIES)[number]
    scheduledTime: string | null
    date: string
    status: 'PENDING' | 'COMPLETED' | 'CANCELLED'
    assignee: {
      id: string
      displayName: string
      avatarType: string | null
      avatarValue: string | null
    }
  }[]
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
    opensAt?: string
    deadlineAt?: string
    purchaseMessage?: string | null
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
  for (const key of ['study', 'fitness']) {
    const summary = value[key]
    if (object(summary) && summary.activityProgress !== undefined && !validActivityProgress(summary.activityProgress)) return false
  }
  if (
    value.householdDuty !== undefined &&
    value.householdDuty !== null &&
    !validHouseholdDuty(value.householdDuty)
  )
    return false
  if (
    value.personalCalendar !== undefined &&
    (!object(value.personalCalendar) ||
      !Array.isArray(value.personalCalendar.events) ||
      value.personalCalendar.events.length > 3 ||
      !value.personalCalendar.events.every(
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
      ))
  )
    return false
  if (
    value.familyFood !== undefined &&
    !validExpenseHomeSummary(value.familyFood)
  )
    return false
  if (
    value.personalExpenses !== undefined &&
    !validExpenseHomeSummary(value.personalExpenses)
  )
    return false
  if (value.fitness !== undefined && !validFitnessSummary(value.fitness))
    return false
  if (object(value.study) && value.study.latestAssessment !== undefined) {
    const a = value.study.latestAssessment
    if (
      !object(a) ||
      !text(a.courseName) ||
      !text(a.title) ||
      !(
        a.score === null ||
        (typeof a.score === 'number' && Number.isFinite(a.score))
      ) ||
      !(
        a.maxScore === null ||
        (typeof a.maxScore === 'number' && Number.isFinite(a.maxScore))
      ) ||
      !nullableText(a.letterGrade)
    )
      return false
  }
  if (
    value.study !== undefined &&
    (!object(value.study) || !validSummary({ ...value.study, courses: [] }))
  )
    return false
  if (
    !Array.isArray(value.chores) ||
    value.chores.length > 3 ||
    !value.chores.every(
      (c) =>
        object(c) &&
        text(c.scheduleId) &&
        text(c.title) &&
        CHORE_CATEGORIES.includes(c.category as never) &&
        nullableText(c.scheduledTime) &&
        day(c.date) &&
        ['PENDING', 'COMPLETED', 'CANCELLED'].includes(String(c.status)) &&
        object(c.assignee) &&
        text(c.assignee.id) &&
        text(c.assignee.displayName) &&
        nullableText(c.assignee.avatarType) &&
        nullableText(c.assignee.avatarValue),
    )
  )
    return false
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
