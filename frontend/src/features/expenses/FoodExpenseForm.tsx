import { useRef, useState, type FormEvent } from 'react'
import { familyDate } from '../meals/family-time'
import {
  prefillFood,
  saveFood,
  FoodApiError,
  type FoodExpense,
  type FoodMealType,
} from './family-food-api'
import { formatVnd } from './expense-display'
export function FoodExpenseForm({
  existing,
  onSaved,
  onCancel,
}: {
  existing: FoodExpense | null
  onSaved: (date: string) => void
  onCancel: () => void
}) {
  const [date, setDate] = useState(existing?.mealDate ?? familyDate()),
    [type, setType] = useState<FoodMealType>(
      existing?.mealType ?? 'BREAKFAST',
    ),
    [note, setNote] = useState(existing?.note ?? '')
  const [items, setItems] = useState(
      existing?.items.map((i) => ({ ...i })) ?? [{ name: '', amount: '' }],
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [hint, setHint] = useState('')
  const version = useRef(0)
  const total = items
    .reduce(
      (s, i) => s + (/^[1-9]\d{0,9}$/.test(i.amount) ? BigInt(i.amount) : 0n),
      0n,
    )
    .toString()
  async function suggest() {
    const revision = version.current
    setBusy(true)
    setError('')
    try {
      const names = await prefillFood(date, type)
      if (revision !== version.current) return
      if (names.length) {
        setItems(names.map((name) => ({ name, amount: '' })))
        setHint('Đã gợi ý tên món. Bạn nhập giá thực tế nhé.')
      } else setHint('Chưa có tên món cho bữa này. Bạn có thể tự nhập.')
    } catch {
      setError('Chưa lấy được tên món. Bạn vẫn có thể tự nhập và lưu.')
    } finally {
      setBusy(false)
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    if (
      !items.length ||
      items.some(
        (i) =>
          !i.name.trim() ||
          !/^[1-9]\d{0,9}$/.test(i.amount) ||
          BigInt(i.amount) > 1000000000n,
      )
    ) {
      setError(
        'Bạn nhập tên món và giá nguyên đồng từ 1 đến 1.000.000.000 đ nhé.',
      )
      return
    }
    setBusy(true)
    try {
      await saveFood(existing?.id ?? null, {
        mealDate: date,
        mealType: type,
        note: note.trim() || null,
        items: items.map((i) => ({ name: i.name.trim(), amount: i.amount })),
      })
      onSaved(date)
    } catch (e) {
      setError(
        e instanceof FoodApiError && e.code === 'FOOD_SLOT_EXISTS'
          ? 'Bữa này đã có chi phí. Bạn đóng biểu mẫu và chọn “Sửa chi phí” ở bữa đã ghi nhé.'
          : 'Chưa lưu được chi phí. Kiểm tra ngày, các món và thử lại nhé.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <form
      className="expense-card expense-form"
      aria-label="Chi phí bữa ăn"
      onSubmit={(e) => void submit(e)}
    >
      <h3>{existing ? 'Sửa chi phí bữa ăn' : 'Thêm chi phí ăn uống'}</h3>
      <fieldset disabled={busy}>
        <label>
          Bữa
          <select
            value={type}
            onChange={(e) => {
              version.current++
              setType(e.target.value as FoodMealType)
              setHint('')
            }}
          >
            <option value="BREAKFAST">Bữa sáng</option>
            <option value="DINNER">Bữa tối</option>
          </select>
        </label>
        <label>
          Ngày
          <input
            type="date"
            min="2000-01-01"
            max={familyDate()}
            required
            value={date}
            onChange={(e) => {
              version.current++
              setDate(e.target.value)
              setHint('')
            }}
          />
        </label>
        {items.every((i) => !i.name && !i.amount) && (
          <button type="button" onClick={() => void suggest()}>
            Gợi ý món từ Bếp
          </button>
        )}
        {hint && <p role="status">{hint}</p>}
        {items.map((item, index) => (
          <div className="food-form-item" key={index}>
            <label>
              Món / khoản chi {index + 1}
              <input
                required
                maxLength={120}
                value={item.name}
                onChange={(e) => {
                  version.current++
                  setItems((v) =>
                    v.map((i, n) =>
                      n === index ? { ...i, name: e.target.value } : i,
                    ),
                  )
                }}
              />
            </label>
            <label>
              Giá {index + 1}
              <input
                required
                inputMode="numeric"
                pattern="[1-9][0-9]{0,9}"
                maxLength={10}
                placeholder="Nhập giá thực tế (đ)"
                value={item.amount}
                onChange={(e) =>
                  setItems((v) =>
                    v.map((i, n) =>
                      n === index ? { ...i, amount: e.target.value } : i,
                    ),
                  )
                }
              />
            </label>
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => setItems((v) => v.filter((_, n) => n !== index))}
              >
                Bỏ khoản {index + 1}
              </button>
            )}
          </div>
        ))}
        {items.length < 30 && (
          <button
            type="button"
            onClick={() => setItems((v) => [...v, { name: '', amount: '' }])}
          >
            + Thêm món / khoản
          </button>
        )}
        <label>
          Ghi chú (không bắt buộc)
          <textarea
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <p className="expense-row">
          <span>Tổng bữa ăn</span>
          <strong>{formatVnd(total)}</strong>
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="expense-actions">
          <button className="expense-primary" type="submit">
            {busy ? 'Đang lưu…' : 'Lưu chi phí'}
          </button>
          <button type="button" onClick={onCancel}>
            Đóng biểu mẫu
          </button>
        </div>
      </fieldset>
    </form>
  )
}
