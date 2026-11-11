import { useEffect, useRef, useState } from 'react'
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
import { AppIcon } from '../../ui/AppIcon'
import './expense-delete.css'
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
    [message, setMessage] = useState<string | null>(null),
    [visibleCount, setVisibleCount] = useState(3)
  const removeTrigger = useRef<HTMLButtonElement | null>(null)
  const removeDialog = useRef<HTMLElement | null>(null)
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
  function refresh(resetHistory = true) {
    if (resetHistory) setVisibleCount(3)
    setState('loading')
    setVersion((v) => v + 1)
  }
  useEffect(() => {
    if (!remove) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    removeDialog.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRemove(null)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
      removeTrigger.current?.focus()
    }
  }, [remove])
  function saved(savedMonth: string, editedId: string | null) {
    const preservingContext = editedId !== null && savedMonth === month
    setForm(null)
    setMonth(savedMonth)
    if (!preservingContext) {
      setPage(1)
      setVisibleCount(3)
    }
    setMessage('Đã lưu khoản chi của bạn.')
    refresh(!preservingContext)
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
        <h2><span className="icon-well"><AppIcon name="expense" size={19} /></span>Chi tiêu cá nhân</h2>
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
            setVisibleCount(3)
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
          <button onClick={() => refresh()}>Thử lại chi tiêu</button>
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
          {error && !remove && <p role="alert">{error}</p>}
          {form?.record === null && (
            <ExpenseForm
              key="new"
              record={null}
              onClose={() => setForm(null)}
              onSaved={(savedMonth) => saved(savedMonth, null)}
            />
          )}
          {remove && (
            <div
              className="expense-delete-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setRemove(null)
              }}
            >
              <section
                ref={removeDialog}
                className="expense-delete-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="personal-expense-delete-title"
                tabIndex={-1}
              >
                <h3 id="personal-expense-delete-title">Xóa khoản chi này?</h3>
                <p>
                  Bạn có chắc muốn xóa khoản chi {formatVnd(remove.amount)} ngày{' '}
                  {expenseDate(remove.spentOn)}? Thao tác này không thể hoàn tác.
                </p>
                {error && <p role="alert">{error}</p>}
                <div className="expense-actions expense-delete-actions">
                  <button type="button" disabled={pending} onClick={() => setRemove(null)}>
                    Giữ lại
                  </button>
                  <button
                    type="button"
                    className="expense-danger"
                    disabled={pending}
                    onClick={() => void confirmDelete()}
                  >
                    Xóa khoản chi
                  </button>
                </div>
              </section>
            </div>
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
                {[...data.expenses]
                  .sort(
                    (a, b) =>
                      b.spentOn.localeCompare(a.spentOn) || b.id.localeCompare(a.id),
                  )
                  .slice(0, visibleCount)
                  .map((expense, i) => (
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
                        onClick={(event) => {
                          removeTrigger.current = event.currentTarget
                          setRemove(expense)
                          setError(null)
                        }}
                      >
                        Xóa
                      </button>
                    </div>
                    {form?.record?.id === expense.id && (
                      <ExpenseForm
                        key={expense.id}
                        record={form.record}
                        onClose={() => setForm(null)}
                        onSaved={(savedMonth) =>
                          saved(savedMonth, form.record?.id ?? null)
                        }
                      />
                    )}
                  </li>
                  ))}
              </ol>
            ) : (
              <p className="expense-muted">
                Chưa có khoản chi nào trong tháng này.
              </p>
            )}
            {data.expenses.length > 3 && (
              <div className="expense-actions">
                {visibleCount < data.expenses.length && (
                  <button type="button" onClick={() => setVisibleCount((count) => Math.min(count + 3, data.expenses.length))}>
                    Xem thêm khoản chi
                  </button>
                )}
                {visibleCount > 3 && !form?.record && (
                  <button type="button" onClick={() => setVisibleCount(3)}>
                    Thu gọn
                  </button>
                )}
              </div>
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
                    setVisibleCount(3)
                    setPage((p) => p - 1)
                    setState('loading')
                  }}
                >
                  Trang trước
                </button>
                <button
                  disabled={!data.hasMore || !!form || pending}
                  onClick={() => {
                    setVisibleCount(3)
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
