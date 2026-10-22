import { useState, type KeyboardEvent } from 'react'
import { PersonalExpenses } from './PersonalExpenses'
import './expenses.css'
export function ExpensePage({
  parent,
  onBack,
  initialTab = 'personal',
}: {
  parent: boolean
  onBack?: () => void
  initialTab?: 'personal' | 'family'
}) {
  const [tab, setTab] = useState<'personal' | 'family'>(initialTab)
  function tabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next =
      event.key === 'Home'
        ? 'personal'
        : event.key === 'End'
          ? 'family'
          : tab === 'personal'
            ? 'family'
            : 'personal'
    setTab(next)
    document.getElementById(`expense-tab-${next}`)?.focus()
  }
  return (
    <div className="expense-page">
      <header className="expense-hero">
        <p className="eyebrow">Từng khoản nhỏ, góc riêng của bạn 🌿</p>
        <h1>{parent ? 'Chi tiêu' : 'Chi tiêu cá nhân'}</h1>
        {onBack && <button onClick={onBack}>Về Cá nhân</button>}
      </header>
      {parent ? (
        <>
          <div
            className="expense-tabs"
            role="tablist"
            aria-label="Góc chi tiêu"
          >
            {(['personal', 'family'] as const).map((t) => (
              <button
                key={t}
                id={`expense-tab-${t}`}
                role="tab"
                aria-selected={tab === t}
                aria-controls={`expense-panel-${t}`}
                tabIndex={tab === t ? 0 : -1}
                onKeyDown={tabKey}
                onClick={() => setTab(t)}
              >
                {t === 'personal' ? 'Cá nhân' : 'Tiền ăn gia đình'}
              </button>
            ))}
          </div>
          <section
            role="tabpanel"
            id={`expense-panel-${tab}`}
            aria-labelledby={`expense-tab-${tab}`}
          >
            {tab === 'personal' ? (
              <PersonalExpenses />
            ) : (
              <section className="expense-card expense-coming">
                <span aria-hidden="true">🍲</span>
                <h2>Tiền ăn gia đình</h2>
                <span className="coming-soon">Sắp có</span>
                <p>
                  Một góc riêng để ghi tiền bữa sáng, bữa tối của cả nhà. Chức
                  năng này sẽ có sau; chưa có khoản chi hay tổng tiền nào ở đây.
                </p>
              </section>
            )}
          </section>
        </>
      ) : (
        <PersonalExpenses />
      )}
    </div>
  )
}
