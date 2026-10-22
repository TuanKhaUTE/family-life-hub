import { useEffect, useRef, useState, type FormEvent } from 'react'
import { familyDate } from '../meals/family-time'
import {
  EXPENSE_CATEGORIES,
  savePersonalExpense,
  expenseError,
  type ExpenseCategory,
  type PersonalExpense,
} from './expense-api'
import { EXPENSE_LABELS } from './expense-display'
export function ExpenseForm({
  record,
  onClose,
  onSaved,
}: {
  record: PersonalExpense | null
  onClose: () => void
  onSaved: (month: string) => void
}) {
  const [amount, setAmount] = useState(record?.amount ?? ''),
    [date, setDate] = useState(record?.spentOn ?? familyDate()),
    [category, setCategory] = useState<ExpenseCategory>(
      record?.category ?? 'OTHER',
    ),
    [note, setNote] = useState(record?.note ?? ''),
    [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    try {
      await savePersonalExpense(record?.id ?? null, {
        amount: amount.trim().replace(/^0+(?=\d)/, ''),
        spentOn: date,
        category,
        note: note.trim() || null,
      })
      onSaved(date.slice(0, 7))
    } catch (error) {
      setError(expenseError(error))
      setPending(false)
    }
  }
  return (
    <section className="expense-card expense-form">
      <h3 ref={heading} tabIndex={-1}>
        {record ? 'Chỉnh sửa khoản chi' : 'Thêm chi tiêu'}
      </h3>
      <button disabled={pending} onClick={onClose}>
        Đóng biểu mẫu chi tiêu
      </button>
      <form aria-label="Khoản chi cá nhân" onSubmit={submit}>
        <fieldset disabled={pending}>
          <label>
            Số tiền (đ)
            <input
              required
              type="text"
              inputMode="numeric"
              pattern="[0-9]+"
              maxLength={10}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <p className="expense-muted">
            Nhập nguyên đồng, không dùng dấu phân cách. Tối đa 1.000.000.000 đ
            mỗi khoản.
          </p>
          <label>
            Ngày chi
            <input
              required
              type="date"
              min="2000-01-01"
              max={familyDate()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Danh mục
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {EXPENSE_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ghi chú khoản chi (không bắt buộc)
            <textarea
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button className="expense-primary" type="submit">
            {pending ? 'Đang lưu…' : 'Lưu khoản chi'}
          </button>
        </fieldset>
      </form>
    </section>
  )
}
