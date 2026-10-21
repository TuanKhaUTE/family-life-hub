import { useEffect, useState } from 'react'
import type { FamilyProfile } from '../auth/auth-api'
import { ProfileAvatar } from '../auth/ProfileSelector'
import { FAMILY_TIME_ZONE } from '../meals/family-time'
import { fetchHome, type HomeSummary } from './home-api'
import { greeting } from './home-time'
import './home.css'

export type HomeDestination =
  | 'Trang chủ'
  | 'Bếp'
  | 'Lịch'
  | 'Chi tiêu'
  | 'Học & Luyện'
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
  const [now] = useState(() => new Date())
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
  }, [retry])
  const today = new Intl.DateTimeFormat('vi-VN', {
    timeZone: FAMILY_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now)
  const future = parent
    ? [
        { title: 'Lịch gia đình', icon: '📅', destination: 'Lịch' as const },
        {
          title: 'Chi tiêu gia đình',
          icon: '🌱',
          destination: 'Chi tiêu' as const,
        },
      ]
    : [
        { title: 'Lịch của bạn', icon: '📅', destination: 'Lịch' as const },
        {
          title: 'Học & Luyện',
          icon: '🌿',
          destination: 'Học & Luyện' as const,
        },
        { title: 'Cá nhân', icon: '☀', destination: 'Cá nhân' as const },
      ]
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
              <p className="home-calm">Hôm nay mọi việc đang ổn 💚</p>
            )}
          </section>
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
                    ? 'Đã mua bữa sáng'
                    : data.breakfast.isOpen
                      ? 'Cả nhà vẫn có thể đổi lựa chọn'
                      : 'Đã hết giờ chọn món'}
                </p>
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
      <section aria-label="Những góc nhỏ sắp có" className="home-future">
        {future.map((card) => (
          <article className="home-card" key={card.title}>
            <span aria-hidden="true">{card.icon}</span>
            <h2>{card.title}</h2>
            <span className="coming-soon">Sắp có</span>
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
