import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { FamilyProfile } from '../auth/auth-api'
import type { MealRequest, MealType } from './meal-request-api'
import { familyDate, FAMILY_TIME_ZONE } from './family-time'
import {
  categoryLabels,
  fetchFinalMeal,
  FinalMealApiError,
  markMealReady,
  saveFinalMeal,
  type FinalDish,
  type FinalMeal,
} from './final-meal-api'
import './final-meal.css'
import { MealDishRatings } from './MealDishRatings'

export function FinalMealSection({
  profile,
  requests,
}: {
  profile: FamilyProfile
  requests: MealRequest[]
}) {
  const [date, setDate] = useState(familyDate())
  const [type, setType] = useState<MealType>('DINNER')
  return (
    <section
      className="final-meal-section"
      aria-labelledby="final-meal-heading"
    >
      <h3 id="final-meal-heading">Món sẽ nấu</h3>
      <p className="meal-empty">Bữa cơm nhà hôm nay có gì?</p>
      <div className="meal-form-grid">
        <label>
          Ngày xem món
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label>
          Bữa xem món
          <select
            value={type}
            onChange={(event) => setType(event.target.value as MealType)}
          >
            <option value="LUNCH">Bữa trưa</option>
            <option value="DINNER">Bữa tối</option>
          </select>
        </label>
      </div>
      <SlotMeal
        key={`${date}:${type}`}
        profile={profile}
        date={date}
        type={type}
        request={requests.find(
          (request) => request.mealDate === date && request.mealType === type,
        )}
      />
    </section>
  )
}

function SlotMeal({
  profile,
  date,
  type,
  request,
}: {
  profile: FamilyProfile
  date: string
  type: MealType
  request?: MealRequest
}) {
  const [meal, setMeal] = useState<FinalMeal | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [reload, setReload] = useState(0)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    void fetchFinalMeal(date, type)
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
  }, [date, type, reload])
  if (state === 'loading') return <p role="status">Đang tải món sẽ nấu…</p>
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
  return (
    <div className="final-meal-content">
      {meal && (
        <>
          {!editing && !meal.readyAt && (
            <ul className="final-dishes">
              {meal.dishes.map((dish, index) => (
                <li key={index}>
                  <span className="dish-category">
                    {categoryLabels[dish.category]}
                  </span>
                  <strong>{dish.name}</strong>
                </li>
              ))}
            </ul>
          )}
          {!editing && meal.readyAt && (
            <MealDishRatings
              key={`${meal.id}:${meal.updatedAt}`}
              mealId={meal.id}
              profile={profile}
              initialDishes={meal.dishes}
            />
          )}
          {meal.readyAt ? (
            <div className="final-ready" role="status">
              <strong>
                {type === 'LUNCH' ? 'Bữa trưa' : 'Bữa tối'} đã sẵn sàng ✓
              </strong>
              <time dateTime={meal.readyAt}>
                {new Intl.DateTimeFormat('vi-VN', {
                  timeZone: FAMILY_TIME_ZONE,
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(meal.readyAt))}
              </time>
              {meal.readyMessage && <p>{meal.readyMessage}</p>}
            </div>
          ) : (
            <p className="meal-empty">
              {isParent
                ? 'Đã lưu món. Khi nấu xong, mẹ báo cả nhà nhé.'
                : 'Mẹ đang chuẩn bị bữa này'}
            </p>
          )}
        </>
      )}
      {!meal && !editing && <p>Chưa có món cho bữa này.</p>}
      {isParent && request?.status === 'SELF_SERVICE' ? (
        <p className="parent-note">
          Bữa này đang tự túc. Hãy chọn “Chỉnh sửa” ở yêu cầu bữa ăn trước khi
          lưu món.
        </p>
      ) : (
        isParent && (
          <>
            {editing ? (
              <DishEditor
                initial={meal?.dishes}
                onCancel={() => setEditing(false)}
                onSave={async (dishes) => {
                  try {
                    const saved = await saveFinalMeal(
                      date,
                      type,
                      dishes,
                      meal?.mealRequestId ?? request?.id ?? null,
                    )
                    setMeal(saved)
                    setEditing(false)
                    setError(null)
                  } catch (cause) {
                    setError(saveError(cause))
                    throw cause
                  }
                }}
              />
            ) : (
              <button
                className="secondary-button"
                onClick={() => {
                  setError(null)
                  setEditing(true)
                }}
              >
                {meal ? 'Chỉnh sửa món' : 'Thêm món sẽ nấu'}
              </button>
            )}
            {meal && !editing && (
              <ReadyControl
                key={meal.id}
                meal={meal}
                date={date}
                type={type}
                onSaved={(saved) => {
                  setMeal(saved)
                  window.dispatchEvent(
                    new Event('family-notifications-changed'),
                  )
                }}
              />
            )}
          </>
        )
      )}
      {error && (
        <p role="alert" className="meal-error">
          {error}
        </p>
      )}
    </div>
  )
}

function DishEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial?: FinalDish[]
  onCancel: () => void
  onSave: (dishes: FinalDish[]) => Promise<void>
}) {
  const [dishes, setDishes] = useState(
    initial?.map((dish) => ({ ...dish })) ?? [
      { name: '', category: 'MAIN' as const, sortOrder: 0 },
    ],
  )
  const [pending, setPending] = useState(false)
  const guard = useRef(false)
  function move(index: number, offset: number) {
    setDishes((current) => {
      const next = [...current]
      ;[next[index], next[index + offset]] = [
        next[index + offset]!,
        next[index]!,
      ]
      return next
    })
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (
      guard.current ||
      !dishes.length ||
      dishes.some((dish) => !dish.name.trim())
    )
      return
    guard.current = true
    setPending(true)
    try {
      await onSave(
        dishes.map((dish, index) => ({
          ...dish,
          name: dish.name.trim(),
          sortOrder: index,
        })),
      )
    } catch {
      /* Parent keeps the editable draft and safe error. */
    } finally {
      guard.current = false
      setPending(false)
    }
  }
  return (
    <form className="dish-editor" onSubmit={submit}>
      <fieldset disabled={pending}>
        <legend>Món cho bữa cơm nhà</legend>
        {dishes.map((dish, index) => (
          <div className="dish-editor-row" key={index}>
            <label>
              Tên món {index + 1}
              <input
                required
                maxLength={120}
                value={dish.name}
                onChange={(event) =>
                  setDishes((current) =>
                    current.map((item, i) =>
                      i === index
                        ? { ...item, name: event.target.value }
                        : item,
                    ),
                  )
                }
              />
            </label>
            <label>
              Nhóm món {index + 1}
              <select
                value={dish.category}
                onChange={(event) =>
                  setDishes((current) =>
                    current.map((item, i) =>
                      i === index
                        ? {
                            ...item,
                            category: event.target
                              .value as FinalDish['category'],
                          }
                        : item,
                    ),
                  )
                }
              >
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="meal-actions">
              <button
                type="button"
                className="text-button"
                aria-label={`Đưa món ${index + 1} lên`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑ Lên
              </button>
              <button
                type="button"
                className="text-button"
                aria-label={`Đưa món ${index + 1} xuống`}
                disabled={index === dishes.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓ Xuống
              </button>
              <button
                type="button"
                className="text-button"
                aria-label={`Xóa món ${index + 1}`}
                disabled={dishes.length === 1}
                onClick={() =>
                  setDishes((current) => current.filter((_, i) => i !== index))
                }
              >
                Xóa
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="secondary-button"
          disabled={dishes.length >= 30}
          onClick={() =>
            setDishes((current) => [
              ...current,
              { name: '', category: 'MAIN', sortOrder: current.length },
            ])
          }
        >
          Thêm món
        </button>
      </fieldset>
      <div className="meal-actions">
        <button
          className="primary-button"
          disabled={pending || dishes.some((dish) => !dish.name.trim())}
        >
          {pending ? 'Đang lưu món…' : 'Lưu món sẽ nấu'}
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={pending}
          onClick={onCancel}
        >
          Hủy sửa món
        </button>
      </div>
    </form>
  )
}

function ReadyControl({
  meal,
  date,
  type,
  onSaved,
}: {
  meal: FinalMeal
  date: string
  type: MealType
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
      const saved = await markMealReady(date, type, message.trim() || null)
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
          placeholder="Ví dụ: Canh ở trong nồi, cả nhà ăn khi còn nóng nhé"
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
function saveError(cause: unknown) {
  return cause instanceof FinalMealApiError &&
    cause.code === 'FINAL_MEAL_SELF_SERVICE'
    ? 'Bữa này đang tự túc. Hãy chọn “Chỉnh sửa” ở yêu cầu bữa ăn trước khi lưu món.'
    : 'Chưa thể lưu món ăn. Mẹ thử lại nhé.'
}
