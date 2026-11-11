import { useEffect, useRef, useState } from 'react'
import { familyDate } from '../meals/family-time'
import {
  fetchFood,
  removeFood,
  type FoodExpense,
  type FoodWorkspace,
} from './family-food-api'
import {
  formatVnd,
  expenseComparisonText,
  expenseDate,
  expenseMonthLabel,
} from './expense-display'
import { FoodExpenseForm } from './FoodExpenseForm'
import { GroceryExpenseForm } from './GroceryExpenseForm'
import { FoodIllustration } from '../../ui/Illustration'
import './family-food.css'
import './expense-delete.css'
export function FamilyFoodExpenses({ parent }: { parent: boolean }) {
  const [month, setMonth] = useState(() => familyDate().slice(0, 7)),
    [page, setPage] = useState(1),
    [reload, setReload] = useState(0)
  const [data, setData] = useState<FoodWorkspace | null>(null),
    [state, setState] = useState('loading'),
    [editing, setEditing] = useState<FoodExpense | null | undefined>(undefined),
    [editingKind, setEditingKind] = useState<'MEAL' | 'GROCERIES'>('MEAL'),
    [deleting, setDeleting] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [visibleCount, setVisibleCount] = useState(3)
  const deleteTrigger = useRef<HTMLButtonElement | null>(null)
  const deleteDialog = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const c = new AbortController()
    void fetchFood(month, page, c.signal)
      .then((d) => {
        if (!c.signal.aborted) {
          setData(d)
          setState('ready')
        }
      })
      .catch(() => {
        if (!c.signal.aborted) setState('error')
      })
    return () => c.abort()
  }, [month, page, reload])
  useEffect(() => {
    if (!deleting) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    deleteDialog.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDeleting(null)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
      deleteTrigger.current?.focus()
    }
  }, [deleting])
  async function remove(id: string) {
    setBusy(true)
    setError('')
    try {
      await removeFood(id)
      setDeleting(null)
      setVisibleCount(3)
      setMessage('Đã xóa chi phí bữa ăn.')
      setState('loading')
      setReload((v) => v + 1)
    } catch {
      setError('Chưa xóa được chi phí. Bạn thử lại nhé.')
    } finally {
      setBusy(false)
    }
  }
  function cancelEditing() {
    setEditing(undefined)
    setEditingKind('MEAL')
  }
  function savedEditing(
    date: string,
    existingId: string | null,
    kind: 'MEAL' | 'GROCERIES',
  ) {
    const preservingContext =
      existingId !== null && date.slice(0, 7) === month
    setEditing(undefined)
    setEditingKind('MEAL')
    setState('loading')
    setMonth(date.slice(0, 7))
    if (!preservingContext) {
      setPage(1)
      setVisibleCount(3)
    }
    setReload((v) => v + 1)
    setMessage(
      kind === 'GROCERIES'
        ? 'Đã lưu chi phí đi chợ.'
        : 'Đã lưu chi phí bữa ăn.',
    )
  }
  function renderEditor(record: FoodExpense | null, existingId: string | null) {
    if (editingKind === 'GROCERIES') {
      return (
        <GroceryExpenseForm
          key={record?.id ?? 'new-grocery'}
          existing={record}
          onCancel={cancelEditing}
          onSaved={(date) => savedEditing(date, existingId, 'GROCERIES')}
        />
      )
    }
    return (
      <FoodExpenseForm
        key={record?.id ?? 'new-meal'}
        existing={record}
        onCancel={cancelEditing}
        onSaved={(date) => savedEditing(date, existingId, 'MEAL')}
      />
    )
  }
  return (
    <div className="family-food">
      <header>
        <div className="family-food-heading">
          <div>
            <h2>Tiền ăn gia đình</h2>
            <p>
              Chi phí bữa ăn và đi chợ của cả nhà — tách riêng khỏi chi tiêu cá
              nhân.
            </p>
          </div>
          <FoodIllustration variant="groceries" />
        </div>
        {!parent && <p>Góc chung để xem; mẹ sẽ ghi và cập nhật chi phí.</p>}
      </header>
      <label className="expense-month">
        Tháng xem tiền ăn
        <input
          type="month"
          min="2000-01"
          max="2199-12"
          value={month}
          onChange={(e) => {
            if (e.target.value) {
              setMonth(e.target.value)
              setState('loading')
              setPage(1)
              setVisibleCount(3)
              setEditing(undefined)
              setDeleting(null)
            }
          }}
        />
      </label>
      {parent && editing === undefined && (
        <div className="expense-actions">
          <button
            className="expense-primary"
            onClick={() => {
              setEditing(null)
              setEditingKind('MEAL')
              setMessage('')
            }}
          >
            Thêm chi phí ăn uống
          </button>
          <button
            onClick={() => {
              setEditing(null)
              setMessage('')
              setEditingKind('GROCERIES')
            }}
          >
            Thêm chi phí đi chợ
          </button>
        </div>
      )}
      {parent && editing === null && renderEditor(null, null)}
      {message && (
        <p role="status" className="expense-message">
          {message}
        </p>
      )}
      {error && !deleting && <p role="alert">{error}</p>}
      {state === 'loading' && (
        <p role="status">Đang xem tiền ăn của nhà mình…</p>
      )}
      {state === 'error' && (
        <section className="expense-card">
          <p role="alert">Chưa xem được tiền ăn gia đình. Bạn thử lại nhé.</p>
          <button
            onClick={() => {
              setState('loading')
              setReload((v) => v + 1)
            }}
          >
            Thử lại
          </button>
        </section>
      )}
      {state === 'ready' && data && (
        <>
          <section
            className="expense-card food-total"
            aria-label="Tổng tiền ăn"
          >
            <h3>
              {month === familyDate().slice(0, 7)
                ? 'Tháng này'
                : expenseMonthLabel(month)}
            </h3>
            <p className="expense-total">
              {formatVnd(data.summary.currentTotal)}
            </p>
            {data.summary.previousTotal !== '0' ? (
              <>
                <h3>So với tháng trước</h3>
                <p>
                  {expenseMonthLabel(data.summary.previousMonth)}:{' '}
                  {formatVnd(data.summary.previousTotal)}
                </p>
                <p>{expenseComparisonText(data.summary)}</p>
              </>
            ) : (
              <p className="expense-muted">{expenseComparisonText(data.summary)}</p>
            )}
            {data.summary.currentTotal !== '0' && <div className="food-breakdown">
              {(data.summary.categories ?? [
                { category: 'BREAKFAST' as const, amount: data.summary.breakfastTotal },
                { category: 'DINNER' as const, amount: data.summary.dinnerTotal },
                { category: 'GROCERIES' as const, amount: data.summary.groceriesTotal ?? '0' },
              ]).map((category) => {
                const share = proportion(category.amount, data.summary.currentTotal)
                return (
                  <div className={`food-category food-${category.category.toLowerCase()}`} key={category.category}>
                    <FoodIllustration variant={category.category === 'GROCERIES' ? 'groceries' : category.category === 'DINNER' ? 'dinner' : 'breakfast'} />
                    <p>
                      <span>{foodCategoryLabel(category.category)}</span>
                      <strong>{formatVnd(category.amount)}</strong>
                    </p>
                    <div className="food-bar" aria-label={`${foodCategoryLabel(category.category)} chiếm ${share}%`}>
                      <span style={{ width: `${share}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>}
            {data.summary.currentTotal !== '0' && data.summary.dailyTrend && data.summary.monthlyTrend && (
              <div className="food-trends">
                <div>
                  <h4>Chi theo ngày</h4>
                  <ul>
                    {data.summary.dailyTrend
                      .filter((point) => point.amount !== '0')
                      .slice(-7)
                      .map((point) => (
                        <li key={point.date}>
                          <span>{expenseDate(point.date)}</span>
                          <strong>{formatVnd(point.amount)}</strong>
                        </li>
                      ))}
                  </ul>
                </div>
                <div>
                  <h4>Chi theo tháng</h4>
                  <ul>
                    {data.summary.monthlyTrend.map((point) => (
                      <li key={point.month}>
                        <span>{expenseMonthLabel(point.month)}</span>
                        <strong>{formatVnd(point.amount)}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>
          <section className="expense-card">
            <h3>Các bữa ăn đã ghi</h3>
            {data.totalCount === 0 ? (
              <>
                <p>Chưa có chi phí ăn uống trong tháng này</p>
                <p>
                  {parent
                    ? 'Thêm chi phí sau khi mua hoặc chuẩn bị bữa ăn.'
                    : 'Khi mẹ thêm chi phí bữa ăn, thông tin sẽ xuất hiện ở đây.'}
                </p>
              </>
            ) : (
              <ul className="food-records">
                {[...data.expenses]
                  .sort(
                    (a, b) =>
                      b.mealDate.localeCompare(a.mealDate) || b.id.localeCompare(a.id),
                  )
                  .slice(0, visibleCount)
                  .map((e) => (
                  <li
                    className={
                      e.mealType === 'BREAKFAST'
                        ? 'food-breakfast'
                        : 'food-dinner'
                    }
                    key={e.id}
                  >
                    <h4>
                      {expenseDate(e.mealDate)} · {foodCategoryLabel(e.category ?? e.mealType)}
                    </h4>
                    <FoodItems expense={e} />
                    {e.note && <p className="expense-note">{e.note}</p>}
                    {parent && (
                      <div className="expense-actions">
                        <button
                          onClick={() => {
                            setEditing(e)
              setEditingKind(e.category === 'GROCERIES' ? 'GROCERIES' : 'MEAL')
                            setMessage('')
                          }}
                        >
                          Sửa chi phí
                        </button>
                        <button
                          onClick={(event) => {
                            deleteTrigger.current = event.currentTarget
                            setDeleting(e.id)
                            setError('')
                          }}
                        >
                          Xóa chi phí
                        </button>
                      </div>
                    )}
                    {parent && editing?.id === e.id &&
                      renderEditor(editing, e.id)}
                  </li>
                  ))}
              </ul>
            )}
            {data.totalCount > 3 && (
              <div className="expense-actions">
                {visibleCount < data.expenses.length && (
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleCount((count) =>
                        Math.min(count + 3, data.expenses.length),
                      )
                    }
                  >
                    Xem thêm chi phí
                  </button>
                )}
                {visibleCount > 3 && !editing && (
                  <button type="button" onClick={() => setVisibleCount(3)}>
                    Thu gọn
                  </button>
                )}
              </div>
            )}
            <div className="expense-actions">
              {page > 1 && (
                <button
                  onClick={() => {
                    setVisibleCount(3)
                    setState('loading')
                    setPage((p) => p - 1)
                  }}
                >
                  Trang trước
                </button>
              )}
              {data.hasMore && (
                <button
                  onClick={() => {
                    setVisibleCount(3)
                    setState('loading')
                    setPage((p) => p + 1)
                  }}
                >
                  Trang sau
                </button>
              )}
            </div>
          </section>
          {parent && deleting && data && (() => {
            const expense = data.expenses.find((item) => item.id === deleting)
            if (!expense) return null
            return (
              <div
                className="expense-delete-backdrop"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) setDeleting(null)
                }}
              >
                <section
                  ref={deleteDialog}
                  className="expense-delete-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="family-food-delete-title"
                  tabIndex={-1}
                >
                  <h3 id="family-food-delete-title">Xóa chi phí này?</h3>
                  <p>
                    Bạn có chắc muốn xóa chi phí ngày {expenseDate(expense.mealDate)}?{' '}
                    Thao tác này không thể hoàn tác.
                  </p>
                  {error && <p role="alert">{error}</p>}
                  <div className="expense-actions expense-delete-actions">
                    <button type="button" disabled={busy} onClick={() => setDeleting(null)}>
                      Giữ lại
                    </button>
                    <button
                      type="button"
                      className="expense-danger"
                      disabled={busy}
                      onClick={() => void remove(expense.id)}
                    >
                      Xóa chi phí
                    </button>
                  </div>
                </section>
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}
export function FoodItems({ expense }: { expense: FoodExpense }) {
  return (
    <>
      <ul className="food-items">
        {expense.items.map((i, n) => (
          <li key={n}>
            <span>{i.name}</span>
            <strong>{formatVnd(i.amount)}</strong>
          </li>
        ))}
      </ul>
      <p className="expense-row">
        <span>Tổng chi phí</span>
        <strong>{formatVnd(expense.total)}</strong>
      </p>
    </>
  )
}

function foodCategoryLabel(category: FoodExpense['category'] | null) {
  return category === 'BREAKFAST'
    ? 'Bữa sáng'
    : category === 'DINNER'
      ? 'Bữa tối'
      : 'Đi chợ / nguyên liệu'
}

function proportion(amount: string, total: string) {
  if (total === '0') return 0
  const value = (BigInt(amount) * 10000n) / BigInt(total)
  return Math.min(100, Number(value) / 100)
}
