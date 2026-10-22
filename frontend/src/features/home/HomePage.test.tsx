import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from './HomePage'
import { greeting } from './home-time'
import { AuthenticatedShell } from '../auth/AuthenticatedShell'
import type { FamilyProfile } from '../auth/auth-api'
import type { HomeSummary } from './home-api'

const profile: FamilyProfile = {
  id: 'synthetic-member',
  displayName: 'Bạn thử nghiệm',
  role: 'MEMBER',
  avatarType: null,
  avatarValue: null,
}
function summary(): HomeSummary {
  return {
    date: '2099-05-01',
    timeZone: 'Asia/Ho_Chi_Minh',
    actions: [],
    breakfast: {
      date: '2099-05-02',
      isOpen: true,
      purchased: false,
      responses: [
        {
          memberId: profile.id,
          displayName: profile.displayName,
          state: 'CUSTOM',
          choice: 'Món sáng thử nghiệm',
        },
      ],
    },
    dinner: { request: null, meal: null },
    recentDishes: [],
    calendar: { events: [] },
    chores: [],
    study: {
      weekStart: '2099-04-27',
      weekEnd: '2099-05-03',
      totalMinutes: 90,
      sessionCount: 1,
      goals: [],
    },
  }
}
function network(home = summary()) {
  const fetchMock = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url === '/api/home'
            ? { home }
            : url === '/api/fitness'
              ? {
                  fitness: {
                    plans: [],
                    days: [],
                    goals: [],
                    sessions: [],
                    summary: {
                      weekStart: '2099-04-27',
                      weekEnd: '2099-05-03',
                      sessionsThisWeek: 0,
                      weeklyTarget: null,
                      completionPercent: null,
                      totalMinutes: 0,
                      unrecordedDurationCount: 0,
                      nextWorkout: null,
                    },
                  },
                }
              : url === '/api/study'
                ? {
                    study: {
                      semesters: [],
                      courses: [],
                      goals: [],
                      sessions: [],
                      summary: { ...home.study, courses: [] },
                    },
                  }
                : { notifications: [], unreadCount: 0 },
        ),
      ),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('warm role-aware Home', () => {
  it.each(['PARENT', 'ADMIN', 'MEMBER'] as const)(
    'keeps %s Fitness Home data own-only and concise',
    async (role) => {
      const home = summary()
      home.fitness = {
        weekStart: '2099-04-27',
        weekEnd: '2099-05-03',
        sessionsThisWeek: 1,
        weeklyTarget: 3,
        completionPercent: 33,
        totalMinutes: 60,
        unrecordedDurationCount: 0,
      }
      network(home)
      const navigate = vi.fn()
      render(<HomePage profile={{ ...profile, role }} onNavigate={navigate} />)
      await screen.findByText('Món sáng thử nghiệm')
      if (role === 'PARENT') {
        expect(
          screen.queryByRole('region', { name: 'Rèn luyện tuần này' }),
        ).toBeNull()
        expect(screen.queryByText('1 / 3 buổi hoàn thành')).toBeNull()
      } else {
        const region = screen.getByRole('region', {
          name: 'Rèn luyện tuần này',
        })
        expect(within(region).getByText('1 / 3 buổi hoàn thành')).toBeTruthy()
        expect(within(region).getByText('1 giờ')).toBeTruthy()
        expect(
          within(region).queryByRole('button', { name: 'Ghi buổi tập' }),
        ).toBeNull()
        await userEvent.click(
          within(region).getByRole('button', { name: 'Xem Học & Luyện' }),
        )
        expect(navigate).toHaveBeenCalledWith('Học & Luyện')
      }
    },
  )
  it.each(['PARENT', 'ADMIN', 'MEMBER'] as const)(
    'shows own Study summary only for eligible %s',
    async (role) => {
      const home = summary()
      home.study = {
        latestAssessment: {
          courseName: 'Môn riêng thử nghiệm',
          title: 'Bài riêng thử nghiệm',
          score: 8.7,
          maxScore: 10,
          letterGrade: null,
        },
        weekStart: '2099-04-27',
        weekEnd: '2099-05-03',
        totalMinutes: 90,
        sessionCount: 1,
        goals: [
          {
            id: 'synthetic-goal',
            title: 'Mục tiêu riêng thử nghiệm',
            targetMinutes: 300,
            minutes: 90,
            targetDate: null,
          },
        ],
      }
      network(home)
      const navigate = vi.fn()
      render(<HomePage profile={{ ...profile, role }} onNavigate={navigate} />)
      await screen.findByText('Món sáng thử nghiệm')
      if (role === 'PARENT') {
        expect(
          screen.queryByRole('region', { name: 'Học tập tuần này' }),
        ).toBeNull()
        expect(screen.queryByText('Mục tiêu riêng thử nghiệm')).toBeNull()
        expect(screen.queryByText(/Bài riêng thử nghiệm/)).toBeNull()
      } else {
        const region = screen.getByRole('region', { name: 'Học tập tuần này' })
        expect(
          within(region).getByText(
            'Môn riêng thử nghiệm · Bài riêng thử nghiệm: 8,7/10',
          ),
        ).toBeTruthy()
        expect(within(region).getByText('1 giờ 30 phút')).toBeTruthy()
        expect(
          within(region).getByRole('progressbar').getAttribute('value'),
        ).toBe('90')
        await userEvent.click(
          within(region).getByRole('button', { name: 'Xem Học & Luyện' }),
        )
        expect(navigate).toHaveBeenCalledWith('Học & Luyện')
      }
    },
  )
  it.each(['PARENT', 'ADMIN', 'MEMBER'] as const)(
    'shows real %s chores without Home management or completion forms',
    async (role) => {
      const home = summary()
      home.chores = [
        {
          scheduleId: 'synthetic',
          title: 'Việc nhà từ API',
          category: 'DISHES',
          scheduledTime: null,
          date: home.date,
          status: 'PENDING',
          assignee: {
            id: profile.id,
            displayName: profile.displayName,
            avatarType: null,
            avatarValue: null,
          },
        },
      ]
      network(home)
      const navigate = vi.fn()
      render(<HomePage profile={{ ...profile, role }} onNavigate={navigate} />)
      const region = await screen.findByRole('region', {
        name: role === 'PARENT' ? 'Việc nhà hôm nay' : 'Việc nhà của bạn',
      })
      expect(within(region).getByText('Việc nhà từ API')).toBeTruthy()
      expect(within(region).getByText(/Sau bữa tối/)).toBeTruthy()
      expect(
        within(region).queryByRole('button', { name: 'Đã làm xong' }),
      ).toBeNull()
      expect(screen.queryByText('Hôm nay mọi việc đang ổn 💚')).toBeNull()
      await userEvent.click(
        within(region).getByRole('button', { name: 'Xem lịch' }),
      )
      expect(navigate).toHaveBeenCalledWith('Lịch')
    },
  )
  it.each(['PARENT', 'ADMIN', 'MEMBER'] as const)(
    'replaces %s calendar placeholder with real upcoming summary and navigation',
    async (role) => {
      const home = summary()
      home.calendar.events = [
        {
          id: 'calendar-summary',
          title: 'Hoạt động thật từ API',
          startsAt: '2099-05-01T02:30:00Z',
          endsAt: '2099-05-01T07:00:00Z',
          owner: {
            id: profile.id,
            displayName: profile.displayName,
            avatarType: null,
            avatarValue: null,
          },
        },
      ]
      network(home)
      const navigate = vi.fn()
      render(<HomePage profile={{ ...profile, role }} onNavigate={navigate} />)
      expect(
        await screen.findByRole('heading', {
          name:
            role === 'PARENT'
              ? 'Lịch gia đình hôm nay'
              : 'Lịch của bạn hôm nay',
        }),
      ).toBeTruthy()
      expect(screen.getByText('Hoạt động thật từ API')).toBeTruthy()
      await userEvent.click(
        within(
          screen.getByRole('region', {
            name:
              role === 'PARENT'
                ? 'Lịch gia đình hôm nay'
                : 'Lịch của bạn hôm nay',
          }),
        ).getByRole('button', { name: 'Xem lịch' }),
      )
      expect(navigate).toHaveBeenCalledWith('Lịch')
    },
  )
  it('parent sees family attention and aggregate scores, not a personal rating prompt', async () => {
    const home = summary()
    home.actions = [
      { id: 'breakfast-synthetic', label: 'Bạn thử nghiệm chưa chọn bữa sáng' },
      { id: 'dinner-finalize', label: 'Bữa tối chưa chốt' },
    ]
    home.recentDishes = [
      {
        id: 'dish',
        name: 'Món gia đình thử nghiệm',
        mealDate: home.date,
        averageRating: 4,
        ratingCount: 2,
        ownRating: null,
      },
    ]
    network(home)
    render(
      <HomePage
        profile={{ ...profile, role: 'PARENT' }}
        onNavigate={() => {}}
      />,
    )
    expect(
      await screen.findByRole('button', { name: /chưa chọn bữa sáng/ }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /Bữa tối chưa chốt/ }),
    ).toBeTruthy()
    expect(screen.getByText(/★ 4 · 2 đánh giá/)).toBeTruthy()
    expect(screen.queryByText('Bạn chưa đánh giá món này')).toBeNull()
  })
  it('Home kitchen shortcut opens the existing kitchen, with no duplicated Home editor', async () => {
    network()
    render(
      <AuthenticatedShell
        profile={profile}
        isLoggingOut={false}
        error={null}
        onLogout={() => {}}
      />,
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Đi tới Bếp' }),
    )
    expect(screen.getByRole('heading', { name: 'Bếp nhà mình' })).toBeTruthy()
    expect(
      screen.queryByRole('heading', { name: 'Hôm nay nhà mình có gì?' }),
    ).toBeNull()
  })
  it.each([
    ['2099-05-01T00:00:00Z', 'Chào buổi sáng'],
    ['2099-05-01T06:00:00Z', 'Chào buổi chiều'],
    ['2099-05-01T12:00:00Z', 'Chào buổi tối'],
    ['2099-05-01T18:00:00Z', 'Chào buổi tối'],
  ])('uses family timezone for %s', (time, expected) => {
    expect(greeting(new Date(time))).toBe(expected)
  })
  it.each(['PARENT', 'ADMIN', 'MEMBER'] as const)(
    'renders real summaries and calm empty state for %s',
    async (role) => {
      network()
      render(<HomePage profile={{ ...profile, role }} onNavigate={() => {}} />)
      expect(
        screen.getByRole('heading', { name: 'Hôm nay nhà mình có gì?' }),
      ).toBeTruthy()
      expect(screen.getByText(new RegExp(profile.displayName))).toBeTruthy()
      expect(
        await screen.findByText('Hôm nay mọi việc đang ổn 💚'),
      ).toBeTruthy()
      expect(screen.getByText('Món sáng thử nghiệm')).toBeTruthy()
      expect(screen.getByText('Chưa có kế hoạch bữa tối')).toBeTruthy()
      expect(
        screen.getByText('Chưa có món nào được đánh giá gần đây'),
      ).toBeTruthy()
      expect(screen.queryByRole('form')).toBeNull()
      expect(
        screen.getByRole('heading', {
          name:
            role === 'PARENT'
              ? 'Việc cần chú ý hôm nay'
              : 'Việc của bạn hôm nay',
        }),
      ).toBeTruthy()
      expect(
        screen.getByRole('heading', {
          name:
            role === 'PARENT'
              ? 'Lịch gia đình hôm nay'
              : 'Lịch của bạn hôm nay',
        }),
      ).toBeTruthy()
      expect(
        screen.getByText(role === 'PARENT' ? 'Chi tiêu gia đình' : 'Cá nhân'),
      ).toBeTruthy()
      expect(screen.getAllByText('Sắp có')).toHaveLength(1)
    },
  )
  it('shows action and recent aggregate without exposing technical identifiers', async () => {
    const home = summary()
    home.actions = [{ id: 'breakfast', label: 'Chọn bữa sáng ngày mai' }]
    home.recentDishes = [
      {
        id: 'private-dish-id',
        name: 'Canh thử nghiệm',
        mealDate: home.date,
        averageRating: 4.5,
        ratingCount: 2,
        ownRating: 5,
      },
    ]
    const navigate = vi.fn()
    network(home)
    render(<HomePage profile={profile} onNavigate={navigate} />)
    const action = await screen.findByRole('button', {
      name: /Chọn bữa sáng ngày mai/,
    })
    await userEvent.click(action)
    expect(navigate).toHaveBeenCalledWith('Bếp')
    expect(screen.getByText(/4,5.*2 đánh giá/)).toBeTruthy()
    expect(screen.getByText('Bạn đã đánh giá 5 sao')).toBeTruthy()
    expect(screen.queryByText('private-dish-id')).toBeNull()
    expect(screen.queryByText('Hôm nay mọi việc đang ổn 💚')).toBeNull()
  })
  it.each(['NO_RESPONSE', 'NOT_EATING'] as const)(
    'keeps %s distinct in breakfast summary',
    async (state) => {
      const home = summary()
      home.breakfast.responses[0] = {
        ...home.breakfast.responses[0]!,
        state,
        choice: null,
      }
      network(home)
      render(<HomePage profile={profile} onNavigate={() => {}} />)
      expect(
        await screen.findByText(
          state === 'NO_RESPONSE' ? 'Chưa trả lời' : 'Không ăn',
        ),
      ).toBeTruthy()
    },
  )
  it.each([false, true])(
    'shows finalized/ready dinner (ready=%s)',
    async (ready) => {
      const home = summary()
      home.dinner.meal = {
        ready,
        readyMessage: ready ? 'Cả nhà ăn nhé' : null,
        dishes: [{ id: 'dish', name: 'Cơm thử nghiệm' }],
        ownUnratedCount: ready ? 1 : 0,
      }
      network(home)
      render(<HomePage profile={profile} onNavigate={() => {}} />)
      expect(
        await screen.findByText(
          ready ? 'Bữa tối đã sẵn sàng' : 'Đã chốt · Đang chuẩn bị',
        ),
      ).toBeTruthy()
      expect(screen.getByText('Cơm thử nghiệm')).toBeTruthy()
      if (ready) expect(screen.getByText('Cả nhà ăn nhé')).toBeTruthy()
    },
  )
  it('shows own dinner response and self-service state', async () => {
    const home = summary()
    home.dinner.request = {
      status: 'SELF_SERVICE',
      isOpen: false,
      responses: [],
    }
    network(home)
    render(<HomePage profile={profile} onNavigate={() => {}} />)
    expect(await screen.findByText('Tối nay cả nhà tự túc')).toBeTruthy()
  })
  it('keeps own saved dinner response visible after finalization', async () => {
    const home = summary()
    home.dinner.request = {
      status: 'OPEN',
      isOpen: true,
      responses: [
        {
          memberId: profile.id,
          displayName: profile.displayName,
          state: 'CUSTOM',
          choice: 'Món tối đã chọn',
        },
      ],
    }
    home.dinner.meal = {
      ready: false,
      readyMessage: null,
      dishes: [{ id: 'dish', name: 'Món đã chốt' }],
      ownUnratedCount: 0,
    }
    network(home)
    render(<HomePage profile={profile} onNavigate={() => {}} />)
    expect(await screen.findByText('Món tối đã chọn')).toBeTruthy()
    expect(screen.getByText('Món đã chốt')).toBeTruthy()
  })
  it('refreshes completed actions when returning Home', async () => {
    const home = summary()
    home.actions = [{ id: 'breakfast', label: 'Chọn bữa sáng ngày mai' }]
    network(home)
    render(
      <AuthenticatedShell
        profile={profile}
        isLoggingOut={false}
        error={null}
        onLogout={() => {}}
      />,
    )
    await screen.findByRole('button', { name: /Chọn bữa sáng ngày mai/ })
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' })
    await userEvent.click(within(nav).getByRole('button', { name: 'Cá nhân' }))
    home.actions = []
    await userEvent.click(
      within(nav).getByRole('button', { name: 'Trang chủ' }),
    )
    expect(await screen.findByText('Hôm nay mọi việc đang ổn 💚')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: /Chọn bữa sáng ngày mai/ }),
    ).toBeNull()
  })
  it('shows lightweight loading then friendly retry without server details', async () => {
    let reject: (error: Error) => void = () => {}
    const pending = new Promise<Response>((_, fail) => {
      reject = fail
    })
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockReturnValueOnce(pending)
        .mockImplementation(
          async () => new Response(JSON.stringify({ home: summary() })),
        ),
    )
    render(<HomePage profile={profile} onNavigate={() => {}} />)
    expect(screen.getByRole('status').textContent).toContain('Đang xem hôm nay')
    reject(new Error('private detail'))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText('private detail')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Món sáng thử nghiệm')).toBeTruthy()
  })
  it('rejects malformed API data with a recoverable error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ home: {} }))),
    )
    render(<HomePage profile={profile} onNavigate={() => {}} />)
    expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeTruthy()
  })
  it.each(['PARENT', 'ADMIN', 'MEMBER'] as const)(
    'navigates Home CTA and role destinations for %s',
    async (role) => {
      network()
      render(
        <AuthenticatedShell
          profile={{ ...profile, role }}
          isLoggingOut={false}
          error={null}
          onLogout={() => {}}
        />,
      )
      const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' })
      expect(screen.getByRole('button', { name: 'Thông báo' })).toBeTruthy()
      expect(
        within(nav).queryByRole('button', { name: 'Chi tiêu' }) !== null,
      ).toBe(role === 'PARENT')
      expect(
        within(nav).queryByRole('button', { name: 'Học & Luyện' }) !== null,
      ).toBe(role !== 'PARENT')
      await screen.findByText('Món sáng thử nghiệm')
      if (role !== 'PARENT') {
        await userEvent.click(
          screen.getByRole('button', { name: 'Xem Học & Luyện' }),
        )
        expect(
          screen.getByRole('heading', { name: 'Học tập & Rèn luyện' }),
        ).toBeTruthy()
        expect(
          await screen.findByRole('button', { name: 'Ghi buổi học' }),
        ).toBeTruthy()
        expect(screen.getByRole('heading', { name: 'Rèn luyện' })).toBeTruthy()
        expect(
          await screen.findByRole('button', { name: 'Ghi buổi tập' }),
        ).toBeTruthy()
        expect(screen.queryByText('Sắp có')).toBeNull()
        expect(
          within(nav)
            .getByRole('button', { name: 'Học & Luyện' })
            .getAttribute('aria-current'),
        ).toBe('page')
      } else {
        await userEvent.click(
          screen.getByRole('button', { name: 'Xem Chi tiêu gia đình' }),
        )
        expect(
          screen.getByRole('heading', { name: 'Góc chi tiêu' }),
        ).toBeTruthy()
      }
    },
  )
})
