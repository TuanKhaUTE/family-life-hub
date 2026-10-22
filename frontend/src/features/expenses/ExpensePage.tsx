import { useState, type KeyboardEvent } from 'react'
import { PersonalExpenses } from './PersonalExpenses'
import { FamilyFoodExpenses } from './FamilyFoodExpenses'
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
        <p className="eyebrow">
          Khoản riêng của bạn, bữa chung của nhà mình 🌿
        </p>
        <h1>{parent || tab === 'family' ? 'Chi tiêu' : 'Chi tiêu cá nhân'}</h1>
        {onBack && <button onClick={onBack}>Về Cá nhân</button>}
      </header>
      <div className="expense-tabs" role="tablist" aria-label="Góc chi tiêu">
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
          <FamilyFoodExpenses parent={parent} />
        )}
      </section>
    </div>
  )
}
