import { useState, type FormEvent } from 'react'
import { familyDate } from '../meals/family-time'
import { saveFood, FoodApiError, type FoodExpense } from './family-food-api'

export function GroceryExpenseForm({
  existing,
  onSaved,
  onCancel,
}: {
  existing: FoodExpense | null
  onSaved: (date: string) => void
  onCancel: () => void
}) {
  const [date, setDate] = useState(existing?.mealDate ?? familyDate())
  const [amount, setAmount] = useState(
    existing?.category === 'GROCERIES' ? existing.total : '',
  )
  const [note, setNote] = useState(existing?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    if (
      !/^([1-9]\d{0,9})$/.test(amount) ||
      BigInt(amount) > 1000000000n ||
      !date ||
      date > familyDate()
    ) {
      setError('Bạn nhập ngày hợp lệ và số tiền nguyên đồng từ 1 đến 1.000.000.000 đ nhé.')
      return
    }
    setBusy(true)
    try {
      await saveFood(existing?.id ?? null, {
        mealDate: date,
        category: 'GROCERIES',
        amount,
        note: note.trim() || null,
      })
      onSaved(date)
    } catch (e) {
      setError(
        e instanceof FoodApiError && e.code === 'FOOD_INVALID'
          ? 'Bạn kiểm tra ngày và số tiền đi chợ nhé.'
          : 'Chưa lưu được chi phí đi chợ. Bạn thử lại nhé.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <form
      className="expense-card expense-form"
      aria-label="Chi phí đi chợ"
      onSubmit={(event) => void submit(event)}
    >
      <h3>{existing ? 'Sửa chi phí đi chợ' : 'Thêm chi phí đi chợ'}</h3>
      <fieldset disabled={busy}>
        <label>
          Ngày
          <input
            type="date"
            min="2000-01-01"
            max={familyDate()}
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label>
          Số tiền
          <input
            required
            inputMode="numeric"
            pattern="[1-9][0-9]{0,9}"
            maxLength={10}
            placeholder="Nhập số tiền (đ)"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label>
          Ghi chú (không bắt buộc)
          <textarea
            maxLength={1000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ví dụ: Thịt, rau, trứng"
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <div className="expense-actions">
          <button className="expense-primary" type="submit">
            {busy ? 'Đang lưu…' : 'Lưu chi phí đi chợ'}
          </button>
          <button type="button" onClick={onCancel}>
            Đóng biểu mẫu
          </button>
        </div>
      </fieldset>
    </form>
  )
}
