import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { FamilyProfile } from '../auth/auth-api'
import { categoryLabels, type FinalDish } from './final-meal-api'
import {
  DishRatingApiError,
  fetchMealFeedback,
  saveDishRating,
  type DishRating,
  type MealFeedback,
} from './dish-rating-api'
import './dish-rating.css'
import { FoodIllustration } from '../../ui/Illustration'

export function MealDishRatings({
  mealId,
  profile,
  initialDishes,
}: {
  mealId: string
  profile: FamilyProfile
  initialDishes: FinalDish[]
}) {
  const [feedback, setFeedback] = useState<MealFeedback | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    void fetchMealFeedback(mealId)
      .then((data) => {
        if (active) {
          setFeedback(data)
          setState('ready')
        }
      })
      .catch(() => {
        if (active) setState('error')
      })
    return () => {
      active = false
    }
  }, [mealId, reload])
  const isParent = profile.role === 'PARENT'
  return (
    <div className="dish-feedback">
      {state === 'loading' && <p role="status">Đang tải đánh giá…</p>}
      {state === 'error' && (
        <div>
          <p role="alert">Chưa tải được đánh giá của bữa này.</p>
          <button
            className="secondary-button"
            onClick={() => {
              setState('loading')
              setReload((value) => value + 1)
            }}
          >
            Thử tải lại đánh giá
          </button>
        </div>
      )}
      {feedback && !feedback.ready && <p>Bữa này chưa sẵn sàng để đánh giá.</p>}
      <ul className="final-dishes">
        {(feedback?.dishes ?? initialDishes).map((dish, index) => {
          const loaded =
            state === 'ready' && feedback?.ready
              ? feedback.dishes[index]
              : undefined
          return (
            <li key={index}>
              <div
                role="group"
                aria-label={dish.name}
                className="dish-feedback-card"
              >
                <FoodIllustration variant="final" />
                <span className="dish-category">
                  {categoryLabels[dish.category]}
                </span>
                <strong>{dish.name}</strong>
                {loaded &&
                  (isParent ? (
                    <ParentFeedback ratings={loaded.ratings} />
                  ) : (
                    <MemberRating
                      key={`${profile.id}:${loaded.id}`}
                      dishId={loaded.id}
                      saved={loaded.ratings.find(
                        (rating) => rating.memberId === profile.id,
                      )}
                      onSaved={(rating) =>
                        setFeedback(
                          (current) =>
                            current && {
                              ...current,
                              dishes: current.dishes.map((item) =>
                                item.id === loaded.id
                                  ? { ...item, ratings: [rating] }
                                  : item,
                              ),
                            },
                        )
                      }
                    />
                  ))}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
function Stars({ rating }: { rating: number }) {
  return (
    <span
      className="rating-stars"
      role="img"
      aria-label={`${rating} trên 5 sao`}
    >
      {'★'.repeat(rating)}
      {'☆'.repeat(5 - rating)}
    </span>
  )
}
function ParentFeedback({ ratings }: { ratings: DishRating[] }) {
  if (!ratings.length)
    return (
      <p className="field-help">
        Chưa có đánh giá. Cả nhà có thể góp ý sau bữa ăn nhé.
      </p>
    )
  const average = new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 1,
  }).format(
    ratings.reduce((sum, item) => sum + item.rating, 0) / ratings.length,
  )
  return (
    <div className="parent-dish-feedback">
      <p>
        <span aria-hidden="true">★ </span>
        {average} · {ratings.length} đánh giá
      </p>
      {ratings.map((item) => (
        <div key={item.memberId} className="dish-feedback-entry">
          <strong>{item.displayName}</strong>
          <Stars rating={item.rating} />
          {item.comment && <p>{item.comment}</p>}
        </div>
      ))}
    </div>
  )
}
function MemberRating({
  dishId,
  saved,
  onSaved,
}: {
  dishId: string
  saved?: DishRating
  onSaved: (rating: DishRating) => void
}) {
  const [editing, setEditing] = useState(false)
  const [rating, setRating] = useState(saved?.rating ?? 0)
  const [comment, setComment] = useState(saved?.comment ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const guard = useRef(false)
  const name = useId()
  function edit() {
    setRating(saved?.rating ?? 0)
    setComment(saved?.comment ?? '')
    setError(null)
    setEditing(true)
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (guard.current || rating < 1) return
    guard.current = true
    setPending(true)
    setError(null)
    try {
      onSaved(await saveDishRating(dishId, rating, comment.trim() || null))
      setEditing(false)
    } catch (cause) {
      setError(
        cause instanceof DishRatingApiError && cause.code === 'MEAL_NOT_READY'
          ? 'Bữa ăn chưa sẵn sàng. Hãy tải lại bữa ăn trước khi đánh giá nhé.'
          : cause instanceof DishRatingApiError &&
              cause.code === 'RATING_NOT_FOUND'
            ? 'Món ăn đã thay đổi. Bạn tải lại bữa ăn để xem món mới nhé.'
            : 'Chưa lưu được đánh giá. Bạn thử lại nhé.',
      )
    } finally {
      guard.current = false
      setPending(false)
    }
  }
  if (!editing)
    return (
      <div className="member-dish-summary">
        {saved && (
          <>
            <Stars rating={saved.rating} />
            {saved.comment && <p>{saved.comment}</p>}
          </>
        )}
        <button className="secondary-button" onClick={edit}>
          {saved ? 'Chỉnh sửa đánh giá' : 'Đánh giá món'}
        </button>
      </div>
    )
  return (
    <form className="dish-rating-form" onSubmit={submit}>
      <fieldset disabled={pending}>
        <legend>Món này thế nào?</legend>
        <div className="star-picker">
          {[1, 2, 3, 4, 5].map((value) => (
            <label
              key={value}
              className={value <= rating ? 'star-selected' : ''}
            >
              <input
                type="radio"
                name={name}
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                aria-label={`${value} sao`}
                required
              />
              <span aria-hidden="true">★</span>
            </label>
          ))}
        </div>
        <label>
          Nhận xét món này (không bắt buộc)
          <textarea
            maxLength={300}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Bạn thích gì ở món này, có muốn mẹ đổi chút gì không?"
          />
        </label>
      </fieldset>
      {error && (
        <p className="meal-error" role="alert">
          {error}
        </p>
      )}
      <div className="meal-actions">
        <button className="primary-button" disabled={pending || !rating}>
          {pending ? 'Đang lưu đánh giá…' : 'Lưu đánh giá'}
        </button>
        <button
          type="button"
          className="text-button"
          disabled={pending}
          onClick={() => setEditing(false)}
        >
          Để sau
        </button>
      </div>
    </form>
  )
}
