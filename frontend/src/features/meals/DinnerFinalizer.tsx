import { useRef, useState, type FormEvent } from 'react'
import { categoryLabels, type FinalDish } from './final-meal-api'
import type { MealRequest } from './meal-request-api'

export function DinnerFinalizer({
  initial = [],
  candidates,
  onSave,
  onCancel,
}: {
  initial?: FinalDish[]
  candidates: NonNullable<MealRequest['candidates']>
  onSave: (dishes: FinalDish[]) => Promise<void>
  onCancel?: () => void
}) {
  const key = (name: string) =>
    name.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi-VN')
  const [selected, setSelected] = useState(
    () => new Set(initial.map((dish) => key(dish.name))),
  )
  const [extras, setExtras] = useState<FinalDish[]>(() =>
    initial.filter(
      (dish) =>
        !candidates.some((candidate) => key(candidate.name) === key(dish.name)),
    ),
  )
  const [pending, setPending] = useState(false)
  const guard = useRef(false)
  const chosen = candidates
    .filter((candidate) => selected.has(key(candidate.name)))
    .map(
      (candidate) =>
        initial.find((dish) => key(dish.name) === key(candidate.name)) ?? {
          name: candidate.name,
          category: 'MAIN' as const,
          sortOrder: 0,
        },
    )
  const dishes = [...chosen, ...extras]
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
        dishes.map((dish, sortOrder) => ({
          ...dish,
          name: dish.name.trim(),
          sortOrder,
        })),
      )
    } catch {
      /* Keep the draft; the parent renders the safe error. */
    } finally {
      guard.current = false
      setPending(false)
    }
  }
  return (
    <form className="dish-editor" onSubmit={submit}>
      <fieldset disabled={pending}>
        <legend>Chốt bữa tối</legend>
        <p>Món hai đứa đã chọn</p>
        {candidates.length ? (
          candidates.map((candidate) => (
            <label
              className={`meal-choice${selected.has(key(candidate.name)) ? ' is-selected' : ''}`}
              key={key(candidate.name)}
            >
              <input
                type="checkbox"
                checked={selected.has(key(candidate.name))}
                onChange={() =>
                  setSelected((current) => {
                    const next = new Set(current)
                    if (next.has(key(candidate.name)))
                      next.delete(key(candidate.name))
                    else next.add(key(candidate.name))
                    return next
                  })
                }
              />
              <span>
                {candidate.name}
                <small>{candidate.chosenBy.join(', ')}</small>
              </span>
            </label>
          ))
        ) : (
          <p className="field-help">
            Chưa có món được đề xuất. Mẹ có thể chờ cả nhà trả lời hoặc thêm món
            khác khi cần.
          </p>
        )}
        {extras.map((dish, index) => (
          <div key={dish.id ?? `extra-${index}`} className="dish-editor-row">
            <label>
              Món khác {index + 1}
              <input
                required
                maxLength={120}
                value={dish.name}
                onChange={(event) =>
                  setExtras((current) =>
                    current.map((item, i) =>
                      i === index
                        ? { ...item, name: event.target.value }
                        : item,
                    ),
                  )
                }
              />
            </label>
            <details>
              <summary>Nhóm món (nếu cần)</summary>
              <select
                aria-label={`Nhóm món khác ${index + 1}`}
                value={dish.category}
                onChange={(event) =>
                  setExtras((current) =>
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
            </details>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                setExtras((current) => current.filter((_, i) => i !== index))
              }
            >
              Bỏ món khác {index + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-button"
          disabled={dishes.length >= 30}
          onClick={() =>
            setExtras((current) => [
              ...current,
              { name: '', category: 'OTHER', sortOrder: 0 },
            ])
          }
        >
          Thêm món khác
        </button>
      </fieldset>
      <div className="meal-actions">
        <button
          className="primary-button"
          disabled={
            pending ||
            !dishes.length ||
            dishes.length > 30 ||
            dishes.some((dish) => !dish.name.trim())
          }
        >
          {pending ? 'Đang lưu…' : 'Lưu bữa tối'}
        </button>
        {onCancel && (
          <button
            type="button"
            className="secondary-button"
            disabled={pending}
            onClick={onCancel}
          >
            Thôi chỉnh sửa
          </button>
        )}
      </div>
    </form>
  )
}
