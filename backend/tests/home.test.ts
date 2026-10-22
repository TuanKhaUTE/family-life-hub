import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { HomeService } from '../src/services/home.service.js'
import { createHomeRouter } from '../src/routes/home.routes.js'
import { errorHandler } from '../src/middleware/error-handler.js'
import {
  FamilySessionService,
  type FamilySessionOperations,
} from '../src/services/family-session.service.js'
import { generateSessionToken } from '../src/security/session-token.js'
import type { SafeFamilyProfile } from '../src/services/family-auth.service.js'
import type { BreakfastDay } from '../src/services/breakfast.service.js'
import type { MealRequestView } from '../src/services/meal-request.service.js'
import type { FinalMeal } from '../src/services/final-meal.service.js'
import type { CalendarOccurrence } from '../src/services/calendar.service.js'
import type { HouseholdDuty } from '../src/services/household-duty.service.js'

const member: SafeFamilyProfile = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Synthetic Member',
  role: 'MEMBER',
  avatarType: null,
  avatarValue: null,
}
function setup(role: SafeFamilyProfile['role'] = 'MEMBER') {
  const profile = { ...member, role }
  const breakfast: BreakfastDay = {
    date: '2099-05-02',
    deadlineAt: '2099-05-01T17:00:00Z',
    timeZone: 'Asia/Ho_Chi_Minh',
    isOpen: true,
    purchase: null,
    responses: [
      {
        member,
        state: 'NO_RESPONSE',
        catalogItem: null,
        customText: null,
        updatedAt: null,
      },
    ],
  }
  const plan: MealRequestView = {
    id: member.id,
    mealDate: '2099-05-01',
    mealType: 'DINNER',
    mode: 'OPEN_CHOICE',
    status: 'OPEN',
    deadlineAt: '2099-05-01T12:00:00Z',
    parentMessage: null,
    createdBy: member,
    options: [],
    createdAt: '2099-05-01T00:00:00Z',
    updatedAt: '2099-05-01T00:00:00Z',
    timeZone: breakfast.timeZone,
    isOpen: true,
    responses: [
      {
        member,
        state: 'NO_RESPONSE',
        option: null,
        customText: null,
        updatedAt: null,
      },
    ],
  }
  const meal: FinalMeal = {
    id: member.id,
    mealDate: plan.mealDate,
    mealType: 'DINNER',
    mealRequestId: plan.id,
    finalizedByMemberId: member.id,
    readyAt: null,
    readyMessage: null,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    dishes: [
      { id: member.id, name: 'Món thử nghiệm', category: 'MAIN', sortOrder: 0 },
    ],
  }
  const dependencies = {
    activities: { progress: vi.fn(async () => ({ today: { minutes: 90, sessions: 1 }, week: { minutes: 90, sessions: 1, previousMinutes: 60, previousSessions: 1, differenceMinutes: 30, differenceSessions: 0, percentage: 50 }, month: { minutes: 90, sessions: 1, previousMinutes: 0, previousSessions: 0, differenceMinutes: 90, differenceSessions: 1, percentage: null }, consistency: { planned: 2, completed: 1, streak: 1 } })) },
    familyFood: {
      summary: vi.fn(async () => ({
        month: '2099-05',
        currency: 'VND' as const,
        currentTotal: '290000',
        previousTotal: '200000',
        previousMonth: '2099-04',
        differenceAmount: '90000',
        percentageChange: 45,
      })),
    },
    breakfast: { getDay: vi.fn(async () => breakfast) },
    requests: {
      listCurrent: vi.fn(async (): Promise<MealRequestView[]> => [plan]),
    },
    meals: { get: vi.fn(async (): Promise<FinalMeal | null> => null) },
    ratings: {
      get: vi.fn(async () => ({
        mealId: meal.id,
        ready: true,
        dishes: [{ ...meal.dishes[0]!, ratings: [] }],
      })),
    },
    recent: { listRecent: vi.fn(async () => []) },
    expenses: {
      summary: vi.fn(async () => ({
        month: '2099-05',
        currency: 'VND' as const,
        currentTotal: '120000',
        previousMonth: '2099-04',
        previousTotal: '100000',
        differenceAmount: '20000',
        percentageChange: 20,
        expenses: [{ note: 'expense notes' }],
      })),
    },
    fitness: {
      summary: vi.fn(async () => ({
        weekStart: '2099-04-27',
        weekEnd: '2099-05-03',
        sessionsThisWeek: 1,
        weeklyTarget: 3,
        completionPercent: 33,
        totalMinutes: 60,
        unrecordedDurationCount: 0,
        nextWorkout: {
          planDayId: member.id,
          title: 'Synthetic private workout plan',
          date: '2099-05-01',
          weekday: 5,
        },
      })),
    },
    study: {
      summary: vi.fn(async () => ({
        weekStart: '2099-04-27',
        weekEnd: '2099-05-03',
        totalMinutes: 90,
        sessionCount: 1,
        latestAssessment: {
          courseName: 'Synthetic grade course',
          assessment: {
            id: member.id,
            courseId: member.id,
            title: 'Synthetic grade result',
            assessmentType: 'MIDTERM' as const,
            score: 8.7,
            maxScore: 10,
            letterGrade: null,
            weightPercent: 30,
            assessedAt: null,
            note: 'not needed on Home',
            createdAt: '2099-05-01T00:00:00Z',
            updatedAt: '2099-05-01T00:00:00Z',
          },
        },
        goals: [
          {
            id: member.id,
            title: 'Synthetic private goal',
            targetMinutes: 300,
            minutes: 90,
            targetDate: null,
          },
        ],
        courses: [
          {
            courseId: member.id,
            name: 'Synthetic private course',
            minutes: 90,
          },
        ],
      })),
    },
    household: {
      list: vi.fn(
        async (): Promise<{ members: []; duties: HouseholdDuty[] }> => ({
          members: [],
          duties: [],
        }),
      ),
    },
    calendar: {
      list: vi.fn(
        async (): Promise<{
          from: string
          to: string
          timeZone: string
          members: []
          occurrences: CalendarOccurrence[]
        }> => ({
          from: '2099-05-01',
          to: '2099-05-01',
          timeZone: 'Asia/Ho_Chi_Minh',
          members: [],
          occurrences: [],
        }),
      ),
    },
  }
  return {
    profile,
    breakfast,
    plan,
    meal,
    dependencies,
    service: new HomeService(
      dependencies,
      () => new Date('2099-05-01T03:00:00Z'),
    ),
  }
}

describe('role-aware home', () => {
  it.each(['PARENT', 'ADMIN', 'MEMBER'] as const)('%s Home gets completed activity metrics only and never queries child data for Mom', async role => {
    const s = setup(role)
    const result = await s.service.get(s.profile)
    if (role === 'PARENT') {
      expect(s.dependencies.activities.progress).not.toHaveBeenCalled()
      expect(result).not.toHaveProperty('study')
      expect(result).not.toHaveProperty('fitness')
    } else {
      expect(result.study!.activityProgress.today.minutes).toBe(90)
      expect(result.fitness!.activityProgress.consistency).toEqual({ planned: 2, completed: 1, streak: 1 })
      expect(s.dependencies.activities.progress).toHaveBeenCalledWith(s.profile, 'STUDY')
      expect(s.dependencies.activities.progress).toHaveBeenCalledWith(s.profile, 'FITNESS')
    }
  })
  it.each(['PARENT', 'ADMIN', 'MEMBER'] as const)(
    'exposes %s shared food summary separately from private money',
    async (role) => {
      const s = setup(role),
        result = await s.service.get(s.profile)
      expect(s.dependencies.familyFood.summary).toHaveBeenCalledWith(s.profile)
      expect(result.familyFood).toEqual({
        month: '2099-05',
        currency: 'VND',
        currentTotal: '290000',
        previousMonth: '2099-04',
        previousTotal: '200000',
        differenceAmount: '90000',
        percentageChange: 45,
      })
      expect(result.personalExpenses.currentTotal).toBe('120000')
      expect(result.familyFood).not.toHaveProperty('expenses')
    },
  )
  it.each(['PARENT', 'ADMIN', 'MEMBER'] as const)(
    'includes only %s own compact personal-spending summary',
    async (role) => {
      const s = setup(role)
      const result = await s.service.get(s.profile)
      expect(s.dependencies.expenses.summary).toHaveBeenCalledWith(s.profile)
      expect(result).toHaveProperty('personalExpenses', {
        month: '2099-05',
        currency: 'VND',
        currentTotal: '120000',
        previousMonth: '2099-04',
        previousTotal: '100000',
        differenceAmount: '20000',
        percentageChange: 20,
      })
      expect(JSON.stringify(result)).not.toContain('expense notes')
    },
  )
  it.each(['PARENT', 'ADMIN', 'MEMBER'] as const)(
    'keeps %s Fitness Home summary private and compact',
    async (role) => {
      const s = setup(role)
      const result = await s.service.get(s.profile)
      expect(result).not.toHaveProperty('wellness')
      if (role === 'PARENT') {
        expect(result).not.toHaveProperty('fitness')
        expect(s.dependencies.fitness.summary).not.toHaveBeenCalled()
      } else {
        expect(result).toHaveProperty('fitness')
        expect(
          (result as unknown as { fitness: { sessionsThisWeek: number } })
            .fitness.sessionsThisWeek,
        ).toBe(1)
        expect(s.dependencies.fitness.summary).toHaveBeenCalledWith(s.profile)
      }
      expect(JSON.stringify(result)).not.toContain(
        'Synthetic private workout plan',
      )
    },
  )
  it.each(['PARENT', 'ADMIN', 'MEMBER'] as const)(
    'keeps %s Study Home composition private',
    async (role) => {
      const s = setup(role)
      const result = await s.service.get(s.profile)
      if (role === 'PARENT') {
        expect(result).not.toHaveProperty('study')
        expect(s.dependencies.study.summary).not.toHaveBeenCalled()
        expect(JSON.stringify(result)).not.toContain('Synthetic private')
        expect(JSON.stringify(result)).not.toContain('Synthetic grade')
      } else {
        expect(result).toHaveProperty('study')
        expect(
          (result as unknown as { study: { totalMinutes: number } }).study
            .totalMinutes,
        ).toBe(90)
        expect(s.dependencies.study.summary).toHaveBeenCalledWith(s.profile)
        expect(result.study!.latestAssessment).toEqual({
          courseName: 'Synthetic grade course',
          title: 'Synthetic grade result',
          score: 8.7,
          maxScore: 10,
          letterGrade: null,
        })
        expect(
          JSON.stringify((result as unknown as { study: unknown }).study),
        ).not.toContain('Synthetic private course')
      }
    },
  )
  it.each(['PARENT', 'ADMIN', 'MEMBER'] as const)(
    'projects %s combined duty without exposing another child assignment on Home',
    async (role) => {
      const s = setup(role)
      const duty: HouseholdDuty = {
        id: member.id,
        date: '2099-05-01',
        assignee: member,
        cancelled: false,
        completedAt: null,
        completedByMemberId: null,
      }
      s.dependencies.household.list.mockResolvedValue({
        members: [],
        duties: [duty],
      })
      const result = await s.service.get(s.profile)
      expect(result.householdDuty).toEqual({
        ...duty,
        assignee: {
          id: member.id,
          displayName: member.displayName,
          avatarType: null,
          avatarValue: null,
        },
      })
      expect(result.chores).toEqual([])
      s.dependencies.household.list.mockResolvedValue({
        members: [],
        duties: [{ ...duty, assignee: { ...member, id: 'other' } }],
      })
      expect((await s.service.get(s.profile)).householdDuty === null).toBe(
        role !== 'PARENT',
      )
      expect(s.dependencies.household.list).toHaveBeenCalledWith(
        s.profile,
        '2099-05-01',
        '2099-05-01',
      )
    },
  )
  it.each(['PARENT', 'ADMIN', 'MEMBER'] as const)(
    'limits %s Home calendar to three current/upcoming appropriate events',
    async (role) => {
      const s = setup(role)
      const event = {
        id: member.id,
        ownerMemberId: member.id,
        title: 'Synthetic calendar',
        category: 'SCHOOL' as const,
        startsAt: '2099-05-01T04:00:00Z',
        endsAt: '2099-05-01T05:00:00Z',
        note: null,
        weekdays: null,
        recurrenceUntil: null,
        createdAt: '2099-05-01T00:00:00Z',
        updatedAt: '2099-05-01T00:00:00Z',
      }
      const own = {
        event,
        owner: member,
        date: '2099-05-01',
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        note: null,
        cancelled: false,
        isException: false,
      }
      s.dependencies.calendar.list.mockResolvedValue({
        from: '2099-05-01',
        to: '2099-05-01',
        timeZone: 'Asia/Ho_Chi_Minh',
        members: [],
        occurrences: [
          { ...own, endsAt: '2099-05-01T02:00:00Z' },
          { ...own, cancelled: true },
          {
            ...own,
            owner: { ...member, id: 'other' },
            event: { ...event, ownerMemberId: 'other' },
          },
          own,
          { ...own, date: '2099-04-30' },
          { ...own, date: '2099-04-29' },
          { ...own, date: '2099-04-28' },
        ],
      })
      const result = await s.service.get(s.profile)
      expect(result.calendar.events).toHaveLength(3)
      expect(s.dependencies.calendar.list).toHaveBeenCalledWith(
        s.profile,
        '2099-05-01',
        '2099-05-01',
        undefined,
        'FAMILY',
      )
      if (role === 'PARENT') {
        expect(result).not.toHaveProperty('personalCalendar')
        expect(s.dependencies.calendar.list).toHaveBeenCalledTimes(1)
      } else {
        expect(s.dependencies.calendar.list).toHaveBeenCalledWith(
          s.profile,
          '2099-05-01',
          '2099-05-01',
          member.id,
          'PERSONAL',
        )
        expect(
          result.personalCalendar!.events.every(
            (e) => e.owner.id === member.id,
          ),
        ).toBe(true)
      }
      expect(JSON.stringify(result.calendar)).not.toMatch(
        /createdAt|updatedAt|note|session|weekdays/,
      )
    },
  )
  it.each(['ADMIN', 'MEMBER'] as const)(
    '%s receives only own missing actions and safe summaries',
    async (role) => {
      const s = setup(role)
      // Defense in depth even if a dependency accidentally returns extra responses.
      s.breakfast.responses.push({
        ...s.breakfast.responses[0]!,
        member: {
          ...member,
          id: 'other',
          displayName: 'Other private profile',
        },
      })
      s.plan.responses.push({
        ...s.plan.responses[0]!,
        member: { ...member, id: 'other' },
      })
      const result = await s.service.get(s.profile)
      expect(result.actions.map((a) => a.id)).toEqual([
        'breakfast',
        'dinner-response',
      ])
      expect(result.breakfast.responses).toHaveLength(1)
      expect(result.dinner.request?.responses).toHaveLength(1)
      expect(JSON.stringify(result)).not.toMatch(
        /Other private|"session"|"sessionId"|pin_hash|finalizedBy/,
      )
      expect(result.date).toBe('2099-05-01')
    },
  )
  it('parent sees missing family responses and unfinalized dinner', async () => {
    const s = setup('PARENT')
    expect((await s.service.get(s.profile)).actions.map((a) => a.id)).toEqual([
      `breakfast-${member.id}`,
      `dinner-${member.id}`,
      'dinner-finalize',
    ])
  })
  it('successful responses remove member actions and retain custom/not-eating distinction', async () => {
    const s = setup()
    s.breakfast.responses[0]!.state = 'NOT_EATING'
    s.plan.responses[0]!.state = 'CUSTOM'
    s.plan.responses[0]!.customText = 'Món thử nghiệm'
    const result = await s.service.get(s.profile)
    expect(result.actions).toEqual([])
    expect(result.breakfast.responses[0]).toMatchObject({
      state: 'NOT_EATING',
      choice: null,
    })
    expect(result.dinner.request?.responses[0]).toMatchObject({
      state: 'CUSTOM',
      choice: 'Món thử nghiệm',
    })
  })
  it('preserves selected breakfast and dinner labels', async () => {
    const s = setup()
    s.breakfast.responses[0]!.state = 'SELECTED'
    s.breakfast.responses[0]!.catalogItem = { id: member.id, name: 'Bánh mì' }
    s.plan.responses[0]!.state = 'SELECTED_OPTION'
    s.plan.responses[0]!.option = { id: member.id, label: 'Canh rau' }
    const result = await s.service.get(s.profile)
    expect(result.breakfast.responses[0]!.choice).toBe('Bánh mì')
    expect(result.dinner.request?.responses[0]!.choice).toBe('Canh rau')
  })
  it('closed responses do not create impossible actions', async () => {
    const s = setup()
    s.breakfast.isOpen = false
    s.plan.isOpen = false
    expect((await s.service.get(s.profile)).actions).toEqual([])
  })
  it('self-service is not an unfinalized obligation', async () => {
    const s = setup('PARENT')
    s.plan.status = 'SELF_SERVICE'
    s.plan.isOpen = false
    s.breakfast.responses = []
    expect((await s.service.get(s.profile)).actions).toEqual([])
  })
  it('derives private progress, breakfast streak, household consistency, and real meal achievements', async () => {
    const s = setup('MEMBER')
    Object.assign(s.dependencies.breakfast, {
      getRecent: vi.fn(async () => [
        {
          ...s.breakfast,
          date: '2099-05-01',
          deadlineAt: '2099-04-30T18:00:00Z',
          responses: [{ ...s.breakfast.responses[0]!, state: 'SELECTED' }],
        },
        {
          ...s.breakfast,
          date: '2099-04-30',
          deadlineAt: '2099-04-29T18:00:00Z',
          responses: [{ ...s.breakfast.responses[0]!, state: 'NOT_EATING' }],
        },
      ]),
    })
    Object.assign(s.dependencies.household, {
      recentCompletions: vi.fn(async () => ({
        members: [],
        duties: [
          { id: 'd1', date: '2099-04-30', assignee: member, cancelled: false, completedAt: '2099-04-30T10:00:00Z', completedByMemberId: member.id },
          { id: 'd2', date: '2099-04-29', assignee: { ...member, id: 'other' }, cancelled: false, completedAt: '2099-04-29T10:00:00Z', completedByMemberId: 'other' },
        ],
      })),
    })
    s.dependencies.recent.listRecent.mockResolvedValue([
      { id: 'dish-1', name: 'Món 1', mealDate: '2099-05-01', averageRating: 5, ratingCount: 2, ownRating: 5 },
      { id: 'dish-2', name: 'Món 2', mealDate: '2099-04-30', averageRating: 4, ratingCount: 1, ownRating: 4 },
      { id: 'dish-3', name: 'Món 3', mealDate: '2099-04-29', averageRating: 4, ratingCount: 1, ownRating: 4 },
    ])
    const result = await s.service.get(s.profile)
    expect(result.gamification).toMatchObject({
      breakfastStreak: 2,
      household: { completedRecent: 1 },
      achievements: [{ key: 'feedback', label: 'Người góp ý nhiệt tình' }],
      personal: {
        study: { completed: 1, planned: 2, streak: 1 },
        fitness: { completed: 1, planned: 2, streak: 1 },
      },
    })
  })
  it('does not expose personal gamification metrics to Mom', async () => {
    const s = setup('PARENT')
    const result = await s.service.get(s.profile)
    expect(result.gamification).not.toHaveProperty('personal')
  })
  it('parent preparing reminder replaces missing dinner response reminders', async () => {
    const s = setup('PARENT')
    s.dependencies.meals.get.mockResolvedValue(s.meal)
    s.breakfast.responses = []
    const result = await s.service.get(s.profile)
    expect(result.actions.map((a) => a.id)).toEqual(['dinner-ready'])
    expect(result.dinner.meal).toMatchObject({
      ready: false,
      dishes: [{ name: 'Món thử nghiệm' }],
    })
  })
  it('ready member meal offers rating, not already-completed dinner response', async () => {
    const s = setup()
    s.meal.readyAt = '2099-05-01T10:00:00Z'
    s.dependencies.meals.get.mockResolvedValue(s.meal)
    s.breakfast.responses = []
    expect((await s.service.get(s.profile)).actions.map((a) => a.id)).toEqual([
      'dinner-rating',
    ])
    s.dependencies.ratings.get.mockResolvedValue({
      ...(await s.dependencies.ratings.get()),
      dishes: [
        {
          ...s.meal.dishes[0]!,
          ratings: [
            {
              memberId: member.id,
              displayName: member.displayName,
              rating: 5,
              comment: null,
              createdAt: s.plan.createdAt,
              updatedAt: s.plan.updatedAt,
            },
          ],
        },
      ],
    })
    expect((await s.service.get(s.profile)).actions).toEqual([])
  })
  it('member can still respond to an open request while dinner is preparing', async () => {
    const s = setup()
    s.dependencies.meals.get.mockResolvedValue(s.meal)
    s.breakfast.responses = []
    expect((await s.service.get(s.profile)).actions.map((a) => a.id)).toEqual([
      'dinner-response',
    ])
  })
  it('returns calm empty state with no invented dinner or dishes', async () => {
    const s = setup('PARENT')
    s.breakfast.responses = []
    s.dependencies.requests.listCurrent.mockResolvedValue([])
    const result = await s.service.get(s.profile)
    expect(result).toMatchObject({
      actions: [],
      dinner: { request: null, meal: null },
      recentDishes: [],
    })
  })
  it('hides dependency failures behind a safe unavailable error', async () => {
    const s = setup()
    s.dependencies.meals.get.mockRejectedValue(
      new Error('secret database detail'),
    )
    await expect(s.service.get(s.profile)).rejects.toMatchObject({
      status: 503,
      code: 'HOME_UNAVAILABLE',
      message: 'Home information is temporarily unavailable',
    })
  })
})

describe('home API', () => {
  it('returns a safe unavailable response if meal storage fails', async () => {
    const s = setup()
    s.dependencies.meals.get.mockRejectedValue(
      new Error('private storage detail'),
    )
    const sessions = {
      authenticate: async () => ({
        sessionId: 'private-session',
        profile: s.profile,
      }),
    } as unknown as FamilySessionOperations
    const app = express()
      .use('/api/home', createHomeRouter(s.service, sessions))
      .use(errorHandler)
    const result = await request(app).get('/api/home')
    expect(result.status).toBe(503)
    expect(result.body).toEqual({
      error: {
        code: 'HOME_UNAVAILABLE',
        message: 'Home information is temporarily unavailable',
      },
    })
    expect(JSON.stringify(result.body)).not.toMatch(/private|stack/)
  })
  it.each([false, true])(
    'rejects absent or inactive session (inactive=%s)',
    async (inactive) => {
      const s = setup()
      const sessions = new FamilySessionService({
        createSession: async () => {
          throw new Error('unused')
        },
        findAuthenticatedSession: async () => null,
        deleteByTokenHash: async () => {},
      })
      const app = express()
        .use('/api/home', createHomeRouter(s.service, sessions))
        .use(errorHandler)
      const result = await request(app)
        .get('/api/home')
        .set(
          'Cookie',
          inactive ? `family_session=${generateSessionToken()}` : '',
        )
      expect(result.status).toBe(401)
      expect(s.dependencies.breakfast.getDay).not.toHaveBeenCalled()
    },
  )
  it('uses session profile, ignores forged actor/role query and returns no session internals', async () => {
    const s = setup()
    const sessions = {
      authenticate: async () => ({
        sessionId: 'private-session',
        profile: s.profile,
      }),
    } as unknown as FamilySessionOperations
    const app = express()
      .use('/api/home', createHomeRouter(s.service, sessions))
      .use(errorHandler)
    const result = await request(app).get(
      '/api/home?role=PARENT&memberId=other',
    )
    expect(result.status).toBe(200)
    expect(result.body.home.actions.map((a: { id: string }) => a.id)).toEqual([
      'breakfast',
      'dinner-response',
    ])
    expect(JSON.stringify(result.body)).not.toContain('private-session')
    expect(result.headers['cache-control']).toBe('no-store')
  })
})
