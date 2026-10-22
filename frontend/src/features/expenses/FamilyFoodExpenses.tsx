import { useEffect, useState } from 'react'
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
import './family-food.css'
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
    [error, setError] = useState('')
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
  async function remove(id: string) {
    setBusy(true)
    setError('')
    try {
      await removeFood(id)
      setDeleting(null)
      setMessage('Đã xóa chi phí bữa ăn.')
      setState('loading')
      setReload((v) => v + 1)
    } catch {
      setError('Chưa xóa được chi phí. Bạn thử lại nhé.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="family-food">
      <header>
        <h2>Tiền ăn gia đình</h2>
        <p>
          Chi phí bữa ăn và đi chợ của cả nhà — tách riêng khỏi chi tiêu cá
          nhân.
        </p>
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
      {parent && editing !== undefined && (
        editingKind === 'GROCERIES' ? (
          <GroceryExpenseForm
            key={editing?.id ?? 'new-grocery'}
            existing={editing}
            onCancel={() => {
              setEditing(undefined)
              setEditingKind('MEAL')
            }}
            onSaved={(date) => {
              setEditing(undefined)
              setEditingKind('MEAL')
              setState('loading')
              setMonth(date.slice(0, 7))
              setPage(1)
              setReload((v) => v + 1)
              setMessage('Đã lưu chi phí đi chợ.')
            }}
          />
        ) : (
          <FoodExpenseForm
            key={editing?.id ?? 'new'}
            existing={editing}
            onCancel={() => setEditing(undefined)}
            onSaved={(date) => {
              setEditing(undefined)
              setState('loading')
              setMonth(date.slice(0, 7))
              setPage(1)
              setReload((v) => v + 1)
              setMessage('Đã lưu chi phí bữa ăn.')
            }}
          />
        )
      )}
      {message && (
        <p role="status" className="expense-message">
          {message}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
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
            <h3>So với tháng trước</h3>
            <p>
              {expenseMonthLabel(data.summary.previousMonth)}:{' '}
              {formatVnd(data.summary.previousTotal)}
            </p>
            <p>{expenseComparisonText(data.summary)}</p>
            <div className="food-breakdown">
              {(data.summary.categories ?? [
                { category: 'BREAKFAST' as const, amount: data.summary.breakfastTotal },
                { category: 'DINNER' as const, amount: data.summary.dinnerTotal },
                { category: 'GROCERIES' as const, amount: data.summary.groceriesTotal ?? '0' },
              ]).map((category) => {
                const share = proportion(category.amount, data.summary.currentTotal)
                return (
                  <div className={`food-category food-${category.category.toLowerCase()}`} key={category.category}>
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
            </div>
            {data.summary.dailyTrend && data.summary.monthlyTrend && (
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
                {data.expenses.map((e) => (
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
                        <button onClick={() => setDeleting(e.id)}>
                          Xóa chi phí
                        </button>
                      </div>
                    )}
                    {parent && deleting === e.id && (
                      <div role="group" aria-label="Xác nhận xóa chi phí">
                        <p>
                          Xóa chi phí bữa ăn này? Các khoản trong bữa cũng sẽ
                          được xóa.
                        </p>
                        <button
                          disabled={busy}
                          onClick={() => void remove(e.id)}
                        >
                          Xác nhận xóa
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => setDeleting(null)}
                        >
                          Giữ lại
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="expense-actions">
              {page > 1 && (
                <button
                  onClick={() => {
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
                    setState('loading')
                    setPage((p) => p + 1)
                  }}
                >
                  Trang sau
                </button>
              )}
            </div>
          </section>
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
