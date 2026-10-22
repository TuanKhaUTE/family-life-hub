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
import type { ChoreOccurrence } from '../src/services/chore.service.js'

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
    chores: {
      list: vi.fn(
        async (): Promise<{
          from: string
          to: string
          timeZone: string
          members: []
          chores: ChoreOccurrence[]
        }> => ({
          from: '2099-05-01',
          to: '2099-05-01',
          timeZone: 'Asia/Ho_Chi_Minh',
          members: [],
          chores: [],
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
    'projects %s Home chores safely with own filtering and pending priority',
    async (role) => {
      const s = setup(role)
      const schedule = {
        id: member.id,
        requestId: member.id,
        title: 'Synthetic chore',
        category: 'DISHES' as const,
        scheduledDate: '2099-05-01',
        scheduledTime: null,
        assignedMemberId: member.id,
        weeklyAssignments: [],
        recurrenceUntil: null,
        note: 'not needed on Home',
        createdByMemberId: member.id,
        cancelled: false,
        createdAt: '2099-05-01T00:00:00Z',
        updatedAt: '2099-05-01T00:00:00Z',
      }
      const chore: ChoreOccurrence = {
        schedule,
        date: '2099-05-01',
        assignee: member,
        status: 'PENDING',
        completedAt: null,
        completedByMemberId: null,
      }
      s.dependencies.chores.list.mockResolvedValue({
        from: '2099-05-01',
        to: '2099-05-01',
        timeZone: 'Asia/Ho_Chi_Minh',
        members: [],
        chores: [
          {
            ...chore,
            status: 'COMPLETED',
            completedAt: '2099-05-01T01:00:00Z',
            completedByMemberId: member.id,
          },
          { ...chore, assignee: { ...member, id: 'other' } },
          chore,
          { ...chore, status: 'CANCELLED' },
        ],
      })
      const result = await s.service.get(s.profile)
      expect(result.chores).toHaveLength(role === 'PARENT' ? 3 : 2)
      expect(result.chores[0]!.status).toBe('PENDING')
      if (role !== 'PARENT')
        expect(result.chores.every((c) => c.assignee.id === member.id)).toBe(
          true,
        )
      expect(JSON.stringify(result.chores)).not.toMatch(
        /note|requestId|createdBy|completedBy|session/,
      )
      expect(s.dependencies.chores.list).toHaveBeenCalledWith(
        s.profile,
        '2099-05-01',
        '2099-05-01',
        role === 'PARENT' ? undefined : member.id,
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
        role === 'PARENT' ? undefined : member.id,
      )
      if (role !== 'PARENT')
        expect(
          result.calendar.events.every((e) => e.owner.id === member.id),
        ).toBe(true)
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
