import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { FamilyProfile } from '../auth/auth-api'
import type { MealRequest } from './meal-request-api'
import { familyDate, FAMILY_TIME_ZONE } from './family-time'
import {
  fetchFinalMeal,
  FinalMealApiError,
  markMealReady,
  saveFinalMeal,
  type FinalMeal,
} from './final-meal-api'
import { DinnerFinalizer } from './DinnerFinalizer'
import { MealDishRatings } from './MealDishRatings'
import { MealFeedbackSheet } from './MealFeedbackSheet'
import './final-meal.css'
import { MealFoodCost } from '../expenses/MealFoodCost'
import { FoodIllustration } from '../../ui/Illustration'

export function FinalMealSection({
  profile,
  requests,
}: {
  profile: FamilyProfile
  requests: MealRequest[]
}) {
  const date = familyDate()
  return (
    <section
      className="final-meal-section"
      aria-labelledby="final-meal-heading"
    >
      <header className="final-meal-heading">
        <div>
          <p className="eyebrow">Món ngon hôm nay</p>
          <h2 id="final-meal-heading">Bữa tối đã chốt</h2>
        </div>
        <FoodIllustration variant="final" />
      </header>
      <SlotMeal
        key={`${date}:${profile.id}`}
        date={date}
        profile={profile}
        request={requests.find(
          (request) =>
            request.mealDate === date &&
            request.mealType === 'DINNER' &&
            request.status !== 'CANCELLED',
        )}
      />
      <MealFoodCost date={date} mealType="DINNER" />
    </section>
  )
}
function SlotMeal({
  date,
  profile,
  request,
}: {
  date: string
  profile: FamilyProfile
  request?: MealRequest
}) {
  const [meal, setMeal] = useState<FinalMeal | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [reload, setReload] = useState(0)
  const [editing, setEditing] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    void fetchFinalMeal(date, 'DINNER')
      .then((loaded) => {
        if (active) {
          setMeal(loaded)
          setState('ready')
        }
      })
      .catch(() => {
        if (active) setState('error')
      })
    return () => {
      active = false
    }
  }, [date, reload])
  if (state === 'loading') return <p role="status">Đang tải món bữa tối…</p>
  if (state === 'error')
    return (
      <div>
        <p role="alert">Chưa thể tải món ăn của bữa này.</p>
        <button
          className="secondary-button"
          onClick={() => {
            setState('loading')
            setReload((value) => value + 1)
          }}
        >
          Thử tải lại món
        </button>
      </div>
    )
  const isParent = profile.role === 'PARENT'
  const feedbackTitle = isParent ? 'Xem góp ý bữa ăn' : 'Đánh giá bữa tối'
  return (
    <div className="final-meal-content">
      {meal && !editing && (
        <ul className="final-dishes">
          {meal.dishes.map((dish) => (
            <li key={dish.id}>
              <FoodIllustration variant="final" />
              <strong>{dish.name}</strong>
            </li>
          ))}
        </ul>
      )}
      {meal?.readyAt ? (
        <>
          <div className="final-ready" role="status">
            <div className="meal-workflow-heading"><span className="meal-workflow-number">4</span><strong>Đã sẵn sàng</strong><span className="meal-workflow-chip">Báo cả nhà</span></div>
            <strong>Bữa tối đã sẵn sàng ✓</strong>
            <time dateTime={meal.readyAt}>
              {new Intl.DateTimeFormat('vi-VN', {
                timeZone: FAMILY_TIME_ZONE,
                timeStyle: 'short',
              }).format(new Date(meal.readyAt))}
            </time>
            {meal.readyMessage && <p>{meal.readyMessage}</p>}
          </div>
          <button
            className="secondary-button"
            onClick={() => setFeedbackOpen(true)}
          >
            {feedbackTitle}
          </button>
          {feedbackOpen && (
            <MealFeedbackSheet
              title={feedbackTitle}
              onClose={() => setFeedbackOpen(false)}
            >
              <MealDishRatings
                mealId={meal.id}
                profile={profile}
                initialDishes={meal.dishes}
              />
            </MealFeedbackSheet>
          )}
        </>
      ) : meal ? (
        <p className="meal-empty">
          {isParent
            ? 'Đã chốt món. Nấu xong, mẹ báo cả nhà nhé.'
            : 'Mẹ đang chuẩn bị bữa này'}
        </p>
      ) : (
        <p>Chưa có món cho bữa tối hôm nay.</p>
      )}
      {isParent &&
        !meal?.readyAt &&
        (request?.status === 'SELF_SERVICE' ? (
          <p className="parent-note">
            Bữa này đang tự túc. Mẹ chọn “Chỉnh sửa” kế hoạch trước khi chốt món
            nhé.
          </p>
        ) : !meal || editing ? (
          <section className="meal-workflow-step meal-workflow-step--final" aria-label="Chốt món">
            <div className="meal-workflow-heading"><span className="meal-workflow-number">3</span><strong>Chốt món</strong><span className="meal-workflow-chip">Đang chuẩn bị</span></div>
            <DinnerFinalizer
              key={request?.updatedAt ?? 'direct'}
              initial={meal?.dishes}
              candidates={request?.candidates ?? []}
              onCancel={meal ? () => setEditing(false) : undefined}
              onSave={async (dishes) => {
                try {
                  const saved = await saveFinalMeal(
                    date,
                    'DINNER',
                    dishes,
                    meal?.mealRequestId ?? request?.id ?? null,
                  )
                  setMeal(saved)
                  setEditing(false)
                  setError(null)
                } catch (cause) {
                  setError(
                    cause instanceof FinalMealApiError &&
                      cause.code === 'FINAL_MEAL_LOCKED'
                      ? 'Bữa tối đã sẵn sàng nên không thể đổi món nữa. Mẹ tải lại Bếp nhé.'
                      : 'Chưa thể lưu bữa tối. Mẹ thử lại nhé.',
                  )
                  throw cause
                }
              }}
            />
          </section>
        ) : (
          <section className="meal-workflow-step meal-workflow-step--final" aria-label="Chốt món">
            <div className="meal-workflow-heading"><span className="meal-workflow-number">3</span><strong>Chốt món</strong><span className="meal-workflow-chip">Đã lưu</span></div>
            <button
              className="secondary-button"
              onClick={() => {
                setError(null)
                setEditing(true)
              }}
            >
              Chỉnh sửa món
            </button>
          </section>
        ))}
      {isParent && meal && !editing && (
        <ReadyControl
          key={meal.id}
          meal={meal}
          date={date}
          onSaved={(saved) => {
            setMeal(saved)
            window.dispatchEvent(new Event('family-notifications-changed'))
          }}
        />
      )}
      {error && (
        <p className="meal-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
function ReadyControl({
  meal,
  date,
  onSaved,
}: {
  meal: FinalMeal
  date: string
  onSaved: (meal: FinalMeal) => void
}) {
  const [message, setMessage] = useState(meal.readyMessage ?? '')
  const [editing, setEditing] = useState(!meal.readyAt)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const guard = useRef(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (guard.current) return
    guard.current = true
    setPending(true)
    setError(null)
    try {
      const saved = await markMealReady(date, 'DINNER', message.trim() || null)
      onSaved(saved)
      setMessage(saved.readyMessage ?? '')
      setEditing(false)
    } catch {
      setError('Chưa thể báo bữa ăn sẵn sàng. Mẹ thử lại nhé.')
    } finally {
      guard.current = false
      setPending(false)
    }
  }
  if (!editing)
    return (
      <button className="secondary-button" onClick={() => setEditing(true)}>
        Sửa lời nhắn bữa ăn
      </button>
    )
  return (
    <form className="ready-form" onSubmit={submit}>
      <label>
        Lời nhắn khi bữa ăn sẵn sàng
        <textarea
          maxLength={300}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </label>
      <p className="field-help">Mẹ có thể để trống lời nhắn.</p>
      {error && (
        <p role="alert" className="meal-error">
          {error}
        </p>
      )}
      <button
        className={meal.readyAt ? 'secondary-button' : 'primary-button'}
        disabled={pending}
      >
        {pending
          ? 'Đang báo cả nhà…'
          : meal.readyAt
            ? 'Lưu lời nhắn bữa ăn'
            : 'Bữa ăn đã sẵn sàng'}
      </button>
    </form>
  )
}
