import { useEffect, useState } from 'react'
import type { FamilyProfile } from '../auth/auth-api'
import { ProfileAvatar } from '../auth/ProfileSelector'
import { FAMILY_TIME_ZONE } from '../meals/family-time'
import { fetchHome, type HomeSummary } from './home-api'
import { greeting } from './home-time'
import { HomeCalendarSummary } from './HomeCalendarSummary'
import { HomeGamification } from './HomeGamification'
import { HouseholdDutyCard } from '../chores/HouseholdDutyCard'
import { StudyProgress } from '../study/StudyProgress'
import { ActivityStatistics } from '../activities/ActivityStatistics'
import { gradeScore } from '../study/grade-display'
import { FitnessSummary } from '../fitness/FitnessSummary'
import { formatVnd, expenseComparisonText } from '../expenses/expense-display'
import '../expenses/expenses.css'
import '../fitness/fitness.css'
import '../study/study.css'
import './home.css'
import {
  breakfastLifecycle,
  relevantBreakfastDate,
  familyDate,
} from '../meals/family-time'
import { useFamilyClock } from '../meals/use-family-clock'
import { AppIcon } from '../../ui/AppIcon'
import { ActionRow } from '../../ui/ActionRow'
import { DashboardTile } from '../../ui/DashboardTile'
import { HomeIllustration } from '../../ui/Illustration'
import { MealTile } from '../../ui/MealTile'

export type HomeDestination =
  | 'Trang chủ'
  | 'Bếp'
  | 'Lịch'
  | 'Chi tiêu'
  | 'Chi tiêu cá nhân'
  | 'Tiền ăn gia đình'
  | 'Học & Luyện'
  | 'Điểm & bài kiểm tra'
  | 'Cá nhân'

function displayDate(date: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: FAMILY_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${date}T12:00:00+07:00`))
}

function responseText(response: HomeSummary['breakfast']['responses'][number]) {
  if (response.state === 'NO_RESPONSE') return 'Chưa trả lời'
  if (response.state === 'NOT_EATING') return 'Không ăn'
  return response.choice ?? 'Đã chọn món'
}

function CompactEmpty({
  icon,
  children,
}: {
  icon: 'calendar' | 'study' | 'fitness' | 'expense' | 'rating' | 'breakfast' | 'chores'
  children: string
}) {
  return (
    <div className="home-empty-compact">
      <span className="home-empty-icon" aria-hidden="true">
        <AppIcon name={icon} size={19} />
      </span>
      <span>{children}</span>
    </div>
  )
}

function DutySummary({
  duty,
  profile,
  onChanged,
  onOpen,
}: {
  duty: NonNullable<HomeSummary['householdDuty']>
  profile: FamilyProfile
  onChanged: () => void
  onOpen: () => void
}) {
  return (
    <div className="home-duty-summary">
      <div className="home-module-heading">
        <span className="home-module-icon" aria-hidden="true">
          <AppIcon name="chores" size={19} />
        </span>
        <h3>Việc nhà hôm nay</h3>
      </div>
      <HouseholdDutyCard duty={duty} profile={profile} onChanged={onChanged} />
      <button className="home-link" onClick={onOpen}>
        Xem lịch
      </button>
    </div>
  )
}

export function HomePage({
  profile,
  onNavigate,
}: {
  profile: FamilyProfile
  onNavigate: (destination: HomeDestination) => void
}) {
  const parent = profile.role === 'PARENT'
  const [data, setData] = useState<HomeSummary | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retry, setRetry] = useState(0)
  const now = useFamilyClock()
  const breakfastCycle = relevantBreakfastDate(now)
  const phase = breakfastLifecycle(breakfastCycle, now).phase
  const todayKey = familyDate(now)

  useEffect(() => {
    const refresh = () => setRetry((value) => value + 1)
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void fetchHome(controller.signal)
      .then((home) => {
        if (!controller.signal.aborted) {
          setData(home)
          setState('ready')
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('error')
      })
    return () => controller.abort()
  }, [retry, breakfastCycle, phase, todayKey])

  const today = new Intl.DateTimeFormat('vi-VN', {
    timeZone: FAMILY_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now)

  return (
    <div className="family-home">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <div className="home-greeting">
            <ProfileAvatar profile={profile} />
            <div>
              <p className="home-eyebrow">{parent ? 'Nhịp nhà hôm nay' : 'Ngày của bạn'}</p>
              <p>
                {greeting(now)}, <strong>{profile.displayName}</strong>!
              </p>
            </div>
          </div>
          <h1 id="home-title">Hôm nay nhà mình có gì?</h1>
          <p className="home-subtitle">
            {parent
              ? 'Một chút quan tâm, để mỗi ngày ở nhà thêm ấm áp.'
              : 'Mình cùng bắt đầu một ngày thật nhẹ nhàng nhé.'}
          </p>
          <span className="home-date-chip">
            <AppIcon name="calendar" size={16} />
            {data ? displayDate(data.date) : today}
          </span>
        </div>
        <div className="home-hero-art">
          <HomeIllustration kind={parent ? 'parent' : 'member'} />
        </div>
      </section>

      {state === 'loading' && (
        <div className="home-loading" role="status" aria-live="polite">
          <p>Đang xem hôm nay nhà mình có gì…</p>
          <div aria-hidden="true" />
          <div aria-hidden="true" />
        </div>
      )}

      {state === 'error' && (
        <section className="home-card home-attention">
          <p role="alert">
            Chưa xem được chuyện hôm nay của nhà mình. Bạn thử lại nhé.
          </p>
          <button
            className="home-link"
            onClick={() => {
              setState('loading')
              setRetry((value) => value + 1)
            }}
          >
            Thử lại
          </button>
        </section>
      )}

      {state === 'ready' && data && (
        <>
          <section
            className="home-card home-attention home-attention-panel"
            aria-labelledby="home-actions-title"
          >
            <div className="home-section-title">
              <span className="home-section-icon" aria-hidden="true">
                <AppIcon name="notification" size={20} />
              </span>
              <h2 id="home-actions-title">
                {parent ? 'Việc cần chú ý hôm nay' : 'Việc của bạn hôm nay'}
              </h2>
            </div>
            {data.actions.length ? (
              <ul className="home-actions">
                {data.actions.map((action) => (
                  <ActionRow
                    key={action.id}
                    id={action.id}
                    label={action.label}
                    onClick={() => onNavigate('Bếp')}
                  />
                ))}
              </ul>
            ) : !data.householdDuty ? (
              <p className="home-calm">Hôm nay mọi việc đang ổn 💚</p>
            ) : null}
            {!parent && data.householdDuty && (
              <div
                className="home-inline-region"
                role="region"
                aria-label="Việc nhà của bạn"
              >
                <DutySummary
                  duty={data.householdDuty}
                  profile={profile}
                  onOpen={() => onNavigate('Lịch')}
                  onChanged={() => {
                    setState('loading')
                    setRetry((value) => value + 1)
                  }}
                />
              </div>
            )}
            {!parent && !data.householdDuty && (
              <div className="home-inline-region" role="region" aria-label="Việc nhà của bạn">
                <div className="home-module-heading">
                  <span className="home-module-icon" aria-hidden="true">
                    <AppIcon name="chores" size={19} />
                  </span>
                  <h3>Việc nhà hôm nay</h3>
                </div>
                <p className="home-meta">Hôm nay chưa có việc nhà giao cho bạn.</p>
                <button className="home-link" onClick={() => onNavigate('Lịch')}>
                  Xem lịch
                </button>
              </div>
            )}
          </section>

          <section aria-labelledby="home-meals-title">
            <div className="home-section-title">
              <span className="home-section-icon" aria-hidden="true">
                <AppIcon name="kitchen" size={20} />
              </span>
              <h2 id="home-meals-title">Bữa ăn hôm nay</h2>
              <button className="home-link" onClick={() => onNavigate('Bếp')}>
                Đi tới Bếp
              </button>
            </div>
            <div className="home-meals-grid">
              <MealTile
                kind="breakfast"
                title="Bữa sáng kế tiếp"
                date={displayDate(data.breakfast.date)}
                actionLabel={!parent && data.actions.some((a) => a.id.includes('breakfast')) ? 'Chọn bữa sáng' : 'Xem bữa sáng'}
                onOpen={() => onNavigate('Bếp')}
              >
                <ul className="home-responses">
                  {data.breakfast.responses.map((response) => (
                    <li key={response.memberId}>
                      {parent && <span>{response.displayName}</span>}
                      <strong>{responseText(response)}</strong>
                    </li>
                  ))}
                </ul>
                {parent && data.breakfast.responses.length === 0 && (
                  <CompactEmpty icon="breakfast">Chưa có thành viên cần chọn món.</CompactEmpty>
                )}
                <p className="home-meta">
                  {data.breakfast.purchased
                    ? 'Mẹ đã mua bữa sáng'
                    : data.breakfast.isOpen
                      ? 'Chọn bữa sáng trước 01:00'
                      : data.breakfast.opensAt && Date.parse(data.breakfast.opensAt) > now.getTime()
                        ? 'Bữa sáng ngày mai chưa mở · mở lúc 18:00'
                        : 'Đã hết thời gian chọn bữa sáng · bữa tiếp theo mở lúc 18:00'}
                </p>
                {data.breakfast.purchased && data.breakfast.purchaseMessage && (
                  <p className="home-note">{data.breakfast.purchaseMessage}</p>
                )}
              </MealTile>

              <MealTile
                kind="dinner"
                title="Bữa tối hôm nay"
                status={
                  data.dinner.meal
                    ? data.dinner.meal.ready
                      ? 'Bữa tối đã sẵn sàng'
                      : 'Đã chốt · Đang chuẩn bị'
                    : data.dinner.request?.status === 'SELF_SERVICE'
                      ? 'Tối nay cả nhà tự túc'
                      : data.dinner.request
                        ? data.dinner.request.isOpen
                          ? 'Đang chờ cả nhà chọn món'
                          : 'Đã đóng phản hồi'
                        : 'Chưa có kế hoạch bữa tối'
                }
                actionLabel={
                  !parent && data.dinner.meal?.ownUnratedCount
                    ? 'Đánh giá bữa tối'
                    : !parent && data.actions.some((a) => a.id.includes('dinner-response'))
                      ? 'Trả lời bữa tối'
                      : 'Xem bữa tối'
                }
                onOpen={() => onNavigate('Bếp')}
              >
                {data.dinner.meal && (
                  <>
                    <ul className="home-dishes">
                      {data.dinner.meal.dishes.map((dish) => (
                        <li key={dish.id}>{dish.name}</li>
                      ))}
                    </ul>
                    {data.dinner.meal.readyMessage && (
                      <p className="home-note">{data.dinner.meal.readyMessage}</p>
                    )}
                  </>
                )}
                {data.dinner.request?.status !== 'SELF_SERVICE' && (
                  <ul className="home-responses">
                    {data.dinner.request?.responses.map((response) => (
                      <li key={response.memberId}>
                        {parent && <span>{response.displayName}</span>}
                        <strong>{responseText(response)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </MealTile>
            </div>
          </section>

          <section className="home-card home-recent-panel" aria-labelledby="home-recent-title">
            <div className="home-section-title">
              <span className="home-section-icon" aria-hidden="true">
                <AppIcon name="rating" size={20} />
              </span>
              <h2 id="home-recent-title">
                {parent ? 'Món được yêu thích gần đây' : 'Món gần đây'}
              </h2>
            </div>
            {data.recentDishes.length ? (
              <ul className="home-recent">
                {data.recentDishes.map((dish) => (
                  <li key={dish.id}>
                    <span className="home-dish-thumb" aria-hidden="true">
                      <AppIcon name="dinner" size={21} />
                    </span>
                    <div>
                      <h3>{dish.name}</h3>
                      <p className="home-meta">{displayDate(dish.mealDate)}</p>
                      <p>
                        {dish.averageRating === null
                          ? 'Chưa có đánh giá'
                          : `★ ${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(dish.averageRating)} · ${dish.ratingCount} đánh giá`}
                      </p>
                      {!parent && (
                        <p className="home-meta">
                          {dish.ownRating === null
                            ? 'Bạn chưa đánh giá món này'
                            : `Bạn đã đánh giá ${dish.ownRating} sao`}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <CompactEmpty icon="rating">Chưa có món nào được đánh giá gần đây</CompactEmpty>
            )}
          </section>

          {!parent && data.study && (
            <DashboardTile
              title="Học tập tuần này"
              icon="study"
              className="home-study"
              ariaLabel="Học tập tuần này"
              onOpen={() => onNavigate('Học & Luyện')}
              openLabel="Xem Học & Luyện"
            >
              {data.study.totalMinutes === 0 &&
              data.study.sessionCount === 0 &&
              data.study.goals.length === 0 ? (
                <CompactEmpty icon="study">Chưa có buổi học tuần này</CompactEmpty>
              ) : (
                <StudyProgress summary={data.study} compact />
              )}
              {data.study.activityProgress && <ActivityStatistics progress={data.study.activityProgress} compact study />}
              {data.study.latestAssessment && (
                <p className="home-meta">
                  {data.study.latestAssessment.courseName} · {data.study.latestAssessment.title}:{' '}
                  {gradeScore(data.study.latestAssessment)}
                </p>
              )}
            </DashboardTile>
          )}

          {!parent && data.fitness && (
            <DashboardTile
              title="Rèn luyện tuần này"
              icon="fitness"
              className="home-fitness"
              ariaLabel="Rèn luyện tuần này"
              onOpen={() => onNavigate('Học & Luyện')}
              openLabel="Xem Học & Luyện"
            >
              {data.fitness.sessionsThisWeek === 0 &&
              data.fitness.totalMinutes === 0 &&
              data.fitness.weeklyTarget === null ? (
                <CompactEmpty icon="fitness">Chưa có buổi tập tuần này</CompactEmpty>
              ) : (
                <FitnessSummary summary={data.fitness} compact />
              )}
              {data.fitness.activityProgress && <ActivityStatistics progress={data.fitness.activityProgress} compact />}
            </DashboardTile>
          )}

          <div className="home-calendar-modules">
            <HomeCalendarSummary calendar={data.calendar} onOpen={() => onNavigate('Lịch')} />
            {!parent && data.personalCalendar && (
              <HomeCalendarSummary
                personal
                calendar={{ events: data.personalCalendar.events.filter((event) => event.owner.id === profile.id) }}
                onOpen={() => onNavigate('Lịch')}
              />
            )}
          </div>

          {parent && (
            <section className="home-card home-chores" aria-label="Việc nhà hôm nay">
              <div className="home-section-title">
                <span className="home-section-icon" aria-hidden="true">
                  <AppIcon name="chores" size={20} />
                </span>
                <h2>Việc nhà hôm nay</h2>
              </div>
              {data.householdDuty ? (
                <HouseholdDutyCard
                  duty={data.householdDuty}
                  profile={profile}
                  onChanged={() => {
                    setState('loading')
                    setRetry((value) => value + 1)
                  }}
                />
              ) : (
                <CompactEmpty icon="chores">Hôm nay chưa có việc nhà cần theo dõi.</CompactEmpty>
              )}
              <button className="home-link" onClick={() => onNavigate('Lịch')}>Xem lịch</button>
            </section>
          )}

          {data.personalExpenses && (
            <DashboardTile
              title="Chi tiêu cá nhân tháng này"
              icon="expense"
              className="home-personal-expenses"
              ariaLabel="Chi tiêu cá nhân tháng này"
              onOpen={() => onNavigate(parent ? 'Chi tiêu' : 'Chi tiêu cá nhân')}
              openLabel="Xem chi tiêu cá nhân"
            >
              {data.personalExpenses.currentTotal === '0' && data.personalExpenses.previousTotal === '0' ? (
                <CompactEmpty icon="expense">Chưa có khoản chi cá nhân tháng này</CompactEmpty>
              ) : (
                <>
                  <p className="fitness-total">{formatVnd(data.personalExpenses.currentTotal)}</p>
                  <p>{expenseComparisonText(data.personalExpenses)}</p>
                  <p className="home-meta">Chỉ những khoản chi của bạn, không phải tiền ăn gia đình.</p>
                </>
              )}
            </DashboardTile>
          )}

          {data.familyFood && (
            <DashboardTile
              title="Tiền ăn gia đình"
              icon="kitchen"
              className="home-family-food"
              ariaLabel="Tiền ăn gia đình tháng này"
              onOpen={() => onNavigate('Tiền ăn gia đình')}
              openLabel="Xem tiền ăn gia đình"
            >
              {data.familyFood.currentTotal === '0' && data.familyFood.previousTotal === '0' ? (
                <CompactEmpty icon="expense">Chưa có chi phí ăn uống tháng này</CompactEmpty>
              ) : (
                <>
                  <p>Tháng này: <strong>{formatVnd(data.familyFood.currentTotal)}</strong></p>
                  <p>{expenseComparisonText(data.familyFood)}</p>
                  <p className="home-meta">Chi phí chung bữa ăn và đi chợ, không gồm chi tiêu cá nhân.</p>
                </>
              )}
            </DashboardTile>
          )}

          {data.gamification && <HomeGamification gamification={data.gamification} parent={parent} />}
        </>
      )}

      {!parent && (
        <section aria-label="Góc riêng và tiện ích" className="home-future">
          <DashboardTile title="Cá nhân" icon="personal" onOpen={() => onNavigate('Cá nhân')} openLabel="Xem Cá nhân" />
        </section>
      )}
    </div>
  )
}
