import type { ExpenseSummary as Summary } from './expense-api'
import {
  EXPENSE_LABELS,
  formatVnd,
  expenseMonthLabel,
  expenseComparisonText,
} from './expense-display'
export function ExpenseSummary({
  summary,
  month,
  currentMonth,
}: {
  summary: Summary
  month: string
  currentMonth: string
}) {
  return (
    <>
      <section
        className="expense-card expense-overview"
        aria-label="Tổng quan chi tiêu cá nhân"
      >
        <h3>
          {month === currentMonth ? 'Tháng này' : expenseMonthLabel(month)}
        </h3>
        <p className="expense-total">{formatVnd(summary.currentTotal)}</p>
        {summary.previousTotal !== '0' ? (
          <>
            <h4>So với tháng trước</h4>
            <p>
              {expenseMonthLabel(summary.previousMonth)} ·{' '}
              {formatVnd(summary.previousTotal)}
            </p>
            <p>{expenseComparisonText(summary)}</p>
          </>
        ) : (
          <p className="expense-muted">{expenseComparisonText(summary)}</p>
        )}
      </section>
      <section className="expense-card" aria-label="Chi theo danh mục">
        <h3>Chi theo danh mục</h3>
        {summary.categories.length ? (
          <ul className="expense-breakdown">
            {summary.categories.map((c) => (
              <li key={c.category}>
                <div>
                  <span><span className="expense-category-icon" aria-hidden="true">{categoryIcon(c.category)}</span>{EXPENSE_LABELS[c.category]}</span>
                  <strong>{formatVnd(c.amount)}</strong>
                </div>
                <small>{percentage(c.amount, summary.currentTotal)}%</small>
                <progress
                  max={100}
                  value={percentage(c.amount, summary.currentTotal)}
                  aria-label={`Tỷ trọng ${EXPENSE_LABELS[c.category]}`}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="expense-muted">
            Các danh mục sẽ hiện khi bạn ghi khoản chi.
          </p>
        )}
      </section>
    </>
  )
}

function categoryIcon(category: keyof typeof EXPENSE_LABELS) {
  return category === 'FOOD' ? '◒' : category === 'TRANSPORT' ? '↗' : category === 'SHOPPING' ? '□' : category === 'STUDY' ? '⌂' : category === 'FITNESS' ? '✦' : '•'
}

function percentage(amount: string, total: string) {
  if (total === '0') return 0
  return Number((BigInt(amount) * 10000n) / BigInt(total)) / 100
}
