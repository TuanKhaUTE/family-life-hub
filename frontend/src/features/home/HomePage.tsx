import { useEffect, useState } from 'react'
import type { FamilyProfile } from '../auth/auth-api'
import { ProfileAvatar } from '../auth/ProfileSelector'
import { FAMILY_TIME_ZONE } from '../meals/family-time'
import { fetchHome, type HomeSummary } from './home-api'
import { greeting } from './home-time'
import { HomeCalendarSummary } from './HomeCalendarSummary'
import { HomeChoresSummary } from './HomeChoresSummary'
import { StudyProgress } from '../study/StudyProgress'
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
  const now = useFamilyClock(),
    breakfastCycle = relevantBreakfastDate(now),
    phase = breakfastLifecycle(breakfastCycle, now).phase,
    todayKey = familyDate(now)
  useEffect(() => {
    const refresh = () => setRetry((v) => v + 1)
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
  const future = parent
    ? []
    : [{ title: 'Cá nhân', icon: '☀', destination: 'Cá nhân' as const }]
  return (
    <div className="family-home">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-greeting">
          <ProfileAvatar profile={profile} />
          <p>
            {greeting(now)}, <strong>{profile.displayName}</strong>!
          </p>
        </div>
        <p className="home-date">{data ? displayDate(data.date) : today}</p>
        <h1 id="home-title">Hôm nay nhà mình có gì?</h1>
        <p>Một chút quan tâm, để mỗi ngày ở nhà thêm ấm áp.</p>
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
          <HomeCalendarSummary
            calendar={data.calendar}
            parent={parent}
            onOpen={() => onNavigate('Lịch')}
          />
          <section
            className="home-card home-attention"
            aria-labelledby="home-actions-title"
          >
            <h2 id="home-actions-title">
              {parent ? 'Việc cần chú ý hôm nay' : 'Việc của bạn hôm nay'}
            </h2>
            {data.actions.length ? (
              <ul className="home-actions">
                {data.actions.map((action) => (
                  <li key={action.id}>
                    <button onClick={() => onNavigate('Bếp')}>
                      <span>{action.label}</span>
                      <span aria-hidden="true">↗</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              !data.chores.some((c) => c.status === 'PENDING') && (
                <p className="home-calm">Hôm nay mọi việc đang ổn 💚</p>
              )
            )}
          </section>
          <HomeChoresSummary
            chores={data.chores}
            parent={parent}
            onOpen={() => onNavigate('Lịch')}
          />
          {!parent && data.study && (
            <section
              className="home-card home-study"
              aria-label="Học tập tuần này"
            >
              <h2>📚 Học tập tuần này</h2>
              <StudyProgress summary={data.study} compact />
              {data.study.latestAssessment && (
                <p className="home-meta">
                  {data.study.latestAssessment.courseName} ·{' '}
                  {data.study.latestAssessment.title}:{' '}
                  {gradeScore(data.study.latestAssessment)}
                </p>
              )}
              <button
                className="home-link"
                onClick={() => onNavigate('Học & Luyện')}
              >
                Xem Học &amp; Luyện
              </button>
            </section>
          )}
          {!parent && data.fitness && (
            <section
              className="home-card home-fitness"
              aria-label="Rèn luyện tuần này"
            >
              <h2>🌿 Rèn luyện tuần này</h2>
              <FitnessSummary summary={data.fitness} compact />
              <button
                className="home-link"
                onClick={() => onNavigate('Học & Luyện')}
              >
                Xem Học &amp; Luyện
              </button>
            </section>
          )}
          {data.personalExpenses && (
            <section
              className="home-card home-personal-expenses"
              aria-label="Chi tiêu cá nhân tháng này"
            >
              <h2>Chi tiêu cá nhân tháng này</h2>
              <p className="fitness-total">
                {formatVnd(data.personalExpenses.currentTotal)}
              </p>
              <p>{expenseComparisonText(data.personalExpenses)}</p>
              <p className="home-meta">
                Chỉ những khoản chi của bạn, không phải tiền ăn gia đình.
              </p>
              <button
                className="home-link"
                onClick={() =>
                  onNavigate(parent ? 'Chi tiêu' : 'Chi tiêu cá nhân')
                }
              >
                Xem chi tiêu cá nhân
              </button>
            </section>
          )}
          {data.familyFood && (
            <section
              className="home-card home-family-food"
              aria-label="Tiền ăn gia đình tháng này"
            >
              <h2>Tiền ăn gia đình</h2>
              <p>
                Tháng này:{' '}
                <strong>{formatVnd(data.familyFood.currentTotal)}</strong>
              </p>
              <p>{expenseComparisonText(data.familyFood)}</p>
              <p className="home-meta">
                Chi phí chung bữa sáng và bữa tối, không gồm chi tiêu cá nhân.
              </p>
              <button
                className="home-link"
                onClick={() => onNavigate('Tiền ăn gia đình')}
              >
                Xem tiền ăn gia đình
              </button>
            </section>
          )}
          <section aria-labelledby="home-meals-title">
            <div className="home-section-title">
              <h2 id="home-meals-title">Bữa ăn hôm nay</h2>
              <button className="home-link" onClick={() => onNavigate('Bếp')}>
                Đi tới Bếp <span aria-hidden="true">↗</span>
              </button>
            </div>
            <div className="home-meals-grid">
              <article className="home-card home-breakfast">
                <span className="home-card-icon" aria-hidden="true">
                  ☀
                </span>
                <h3>Bữa sáng kế tiếp</h3>
                <p className="home-date">{displayDate(data.breakfast.date)}</p>
                <ul className="home-responses">
                  {data.breakfast.responses.map((r) => (
                    <li key={r.memberId}>
                      {parent && <span>{r.displayName}</span>}
                      <strong>{responseText(r)}</strong>
                    </li>
                  ))}
                </ul>
                {parent && data.breakfast.responses.length === 0 && (
                  <p>Chưa có thành viên cần chọn món.</p>
                )}
                <p className="home-meta">
                  {data.breakfast.purchased
                    ? 'Mẹ đã mua bữa sáng'
                    : data.breakfast.isOpen
                      ? 'Chọn bữa sáng trước 01:00'
                      : data.breakfast.opensAt &&
                          Date.parse(data.breakfast.opensAt) > now.getTime()
                        ? 'Bữa sáng ngày mai chưa mở · mở lúc 18:00'
                        : 'Đã hết thời gian chọn bữa sáng · bữa tiếp theo mở lúc 18:00'}
                </p>
                {data.breakfast.purchased && data.breakfast.purchaseMessage && (
                  <p className="home-meta">{data.breakfast.purchaseMessage}</p>
                )}
                <button className="home-link" onClick={() => onNavigate('Bếp')}>
                  {!parent && data.actions.some((a) => a.id === 'breakfast')
                    ? 'Chọn bữa sáng'
                    : 'Xem bữa sáng'}
                </button>
              </article>
              <article className="home-card home-dinner">
                <span className="home-card-icon" aria-hidden="true">
                  🍲
                </span>
                <h3>Bữa tối hôm nay</h3>
                <p className="home-meal-state">
                  {data.dinner.meal
                    ? data.dinner.meal.ready
                      ? 'Bữa tối đã sẵn sàng'
                      : 'Đã chốt · Đang chuẩn bị'
                    : data.dinner.request?.status === 'SELF_SERVICE'
                      ? 'Tối nay cả nhà tự túc'
                      : data.dinner.request
                        ? data.dinner.request.isOpen
                          ? 'Đang chờ cả nhà chọn món'
                          : 'Đã đóng phản hồi'
                        : 'Chưa có kế hoạch bữa tối'}
                </p>
                {data.dinner.meal && (
                  <>
                    <ul className="home-dishes">
                      {data.dinner.meal.dishes.map((d) => (
                        <li key={d.id}>{d.name}</li>
                      ))}
                    </ul>
                    {data.dinner.meal.readyMessage && (
                      <p className="home-note">
                        {data.dinner.meal.readyMessage}
                      </p>
                    )}
                  </>
                )}
                {data.dinner.request?.status !== 'SELF_SERVICE' && (
                  <ul className="home-responses">
                    {data.dinner.request?.responses.map((r) => (
                      <li key={r.memberId}>
                        {parent && <span>{r.displayName}</span>}
                        <strong>{responseText(r)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
                <button className="home-link" onClick={() => onNavigate('Bếp')}>
                  {!parent && data.dinner.meal?.ownUnratedCount
                    ? 'Đánh giá bữa tối'
                    : !parent &&
                        data.actions.some((a) => a.id === 'dinner-response')
                      ? 'Trả lời bữa tối'
                      : 'Xem bữa tối'}
                </button>
              </article>
            </div>
          </section>
          <section className="home-card" aria-labelledby="home-recent-title">
            <h2 id="home-recent-title">
              {parent ? 'Món được yêu thích gần đây' : 'Món gần đây'}
            </h2>
            {data.recentDishes.length ? (
              <ul className="home-recent">
                {data.recentDishes.map((dish) => (
                  <li key={dish.id}>
                    <span aria-hidden="true">🍽</span>
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
              <p className="home-meta">Chưa có món nào được đánh giá gần đây</p>
            )}
          </section>
        </>
      )}
      <section aria-label="Góc riêng và tiện ích" className="home-future">
        {future.map((card) => (
          <article className="home-card" key={card.title}>
            <span aria-hidden="true">{card.icon}</span>
            <h2>{card.title}</h2>
            <button
              className="home-link"
              onClick={() => onNavigate(card.destination)}
            >
              Xem {card.title}
            </button>
          </article>
        ))}
      </section>
    </div>
  )
}
