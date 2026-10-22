import { useEffect, useState } from 'react'
import { familyDate } from '../meals/family-time'
import {
  fetchPersonalExpenses,
  deletePersonalExpense,
  expenseError,
  type PersonalExpense,
  type PersonalExpenseWorkspace,
} from './expense-api'
import { formatVnd, EXPENSE_LABELS, expenseDate } from './expense-display'
import { ExpenseSummary } from './ExpenseSummary'
import { ExpenseForm } from './ExpenseForm'
export function PersonalExpenses() {
  const currentMonth = familyDate().slice(0, 7)
  const [month, setMonth] = useState(currentMonth),
    [page, setPage] = useState(1),
    [version, setVersion] = useState(0),
    [data, setData] = useState<PersonalExpenseWorkspace | null>(null),
    [state, setState] = useState<'loading' | 'ready' | 'error'>('loading'),
    [form, setForm] = useState<{ record: PersonalExpense | null } | null>(null),
    [remove, setRemove] = useState<PersonalExpense | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null),
    [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void fetchPersonalExpenses(month, page, controller.signal)
      .then((view) => {
        if (!controller.signal.aborted) {
          setData(view)
          setState('ready')
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('error')
      })
    return () => controller.abort()
  }, [month, page, version])
  function refresh() {
    setState('loading')
    setVersion((v) => v + 1)
  }
  function saved(savedMonth: string) {
    setForm(null)
    setMonth(savedMonth)
    setPage(1)
    setMessage('Đã lưu khoản chi của bạn.')
    refresh()
  }
  async function confirmDelete() {
    if (!remove || pending) return
    setPending(true)
    setError(null)
    try {
      await deletePersonalExpense(remove.id)
      setRemove(null)
      setMessage('Đã xóa khoản chi bạn chọn.')
      if (data?.expenses.length === 1 && page > 1) setPage((p) => p - 1)
      refresh()
    } catch (error) {
      setError(expenseError(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <section className="personal-expenses" aria-label="Chi tiêu cá nhân">
      <div className="expense-intro">
        <h2>Chi tiêu cá nhân</h2>
        <p>Góc riêng của bạn. Chỉ bạn xem và quản lý những khoản chi này.</p>
      </div>
      <label className="expense-month">
        Tháng xem chi tiêu
        <input
          type="month"
          min="2000-01"
          max={currentMonth}
          value={month}
          disabled={!!form || pending}
          onChange={(e) => {
            if (!e.target.value) return
            setMonth(e.target.value)
            setPage(1)
            setMessage(null)
            setError(null)
            setState('loading')
          }}
        />
      </label>
      {state === 'loading' && (
        <p role="status" aria-label="Tải chi tiêu cá nhân">
          Đang mở sổ chi tiêu của bạn…
        </p>
      )}
      {state === 'error' && (
        <div>
          <p role="alert">Chưa tải được chi tiêu. Bạn thử lại nhé.</p>
          <button onClick={refresh}>Thử lại chi tiêu</button>
        </div>
      )}
      {state === 'ready' && data && (
        <>
          <button
            className="expense-primary"
            onClick={() => {
              setForm({ record: null })
              setMessage(null)
              setError(null)
            }}
          >
            Thêm chi tiêu
          </button>
          {message && (
            <p role="status" className="expense-message">
              {message}
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          {form && (
            <ExpenseForm
              key={form.record?.id ?? 'new'}
              record={form.record}
              onClose={() => setForm(null)}
              onSaved={saved}
            />
          )}
          {remove && (
            <section
              className="expense-card"
              role="dialog"
              aria-label="Xác nhận xóa khoản chi"
            >
              <p>
                Xóa khoản chi {formatVnd(remove.amount)} ngày{' '}
                {expenseDate(remove.spentOn)}? Không thể hoàn tác thao tác này.
              </p>
              <div className="expense-actions">
                <button disabled={pending} onClick={() => setRemove(null)}>
                  Giữ lại
                </button>
                <button disabled={pending} onClick={() => void confirmDelete()}>
                  Đồng ý xóa khoản chi
                </button>
              </div>
            </section>
          )}
          <ExpenseSummary
            summary={data.summary}
            month={data.month}
            currentMonth={currentMonth}
          />
          <section className="expense-card" aria-label="Khoản chi gần đây">
            <h3>Gần đây</h3>
            {data.expenses.length ? (
              <ol className="expense-records">
                {data.expenses.map((expense, i) => (
                  <li key={expense.id}>
                    <div className="expense-row">
                      <strong>{formatVnd(expense.amount)}</strong>
                      <span>{EXPENSE_LABELS[expense.category]}</span>
                    </div>
                    <time dateTime={expense.spentOn}>
                      {expenseDate(expense.spentOn)}
                    </time>
                    {expense.note && (
                      <p className="expense-note">{expense.note}</p>
                    )}
                    <div className="expense-actions">
                      <button
                        aria-label={`Sửa khoản chi ${(page - 1) * 20 + i + 1}`}
                        onClick={() => {
                          setForm({ record: expense })
                          setMessage(null)
                          setError(null)
                        }}
                      >
                        Sửa
                      </button>
                      <button
                        aria-label={`Xóa khoản chi ${(page - 1) * 20 + i + 1}`}
                        onClick={() => {
                          setRemove(expense)
                          setError(null)
                        }}
                      >
                        Xóa
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="expense-muted">
                Chưa có khoản chi nào trong tháng này.
              </p>
            )}
            <p className="expense-muted">
              Trang {data.page} · {data.totalCount} khoản chi trong tháng. Tổng
              tháng tính tất cả khoản chi.
            </p>
            {(page > 1 || data.hasMore) && (
              <div className="expense-actions">
                <button
                  disabled={page === 1 || !!form || pending}
                  onClick={() => {
                    setPage((p) => p - 1)
                    setState('loading')
                  }}
                >
                  Trang trước
                </button>
                <button
                  disabled={!data.hasMore || !!form || pending}
                  onClick={() => {
                    setPage((p) => p + 1)
                    setState('loading')
                  }}
                >
                  Trang sau
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  )
}
