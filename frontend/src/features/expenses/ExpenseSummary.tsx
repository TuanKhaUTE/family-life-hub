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
        <h4>So với tháng trước</h4>
        <p>
          {expenseMonthLabel(summary.previousMonth)} ·{' '}
          {formatVnd(summary.previousTotal)}
        </p>
        <p>{expenseComparisonText(summary)}</p>
      </section>
      <section className="expense-card" aria-label="Chi theo danh mục">
        <h3>Chi theo danh mục</h3>
        {summary.categories.length ? (
          <ul className="expense-breakdown">
            {summary.categories.map((c) => (
              <li key={c.category}>
                <div>
                  <span>{EXPENSE_LABELS[c.category]}</span>
                  <strong>{formatVnd(c.amount)}</strong>
                </div>
                <progress
                  max={100}
                  value={
                    Number(
                      (BigInt(c.amount) * 10000n) /
                        BigInt(summary.currentTotal),
                    ) / 100
                  }
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
