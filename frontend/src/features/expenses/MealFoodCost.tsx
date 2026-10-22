import { useEffect, useState } from 'react'
import {
  fetchFoodSlot,
  type FoodExpense,
  type FoodInput,
} from './family-food-api'
import { FoodItems } from './FamilyFoodExpenses'
import { expenseDate } from './expense-display'
import './family-food.css'
export function MealFoodCost({
  date,
  mealType,
}: {
  date: string
  mealType: FoodInput['mealType']
}) {
  return (
    <SlotFoodCost key={`${date}:${mealType}`} date={date} mealType={mealType} />
  )
}
function SlotFoodCost({
  date,
  mealType,
}: {
  date: string
  mealType: FoodInput['mealType']
}) {
  const [expense, setExpense] = useState<FoodExpense | null>(null),
    [state, setState] = useState('loading'),
    [retry, setRetry] = useState(0)
  useEffect(() => {
    const c = new AbortController()
    void fetchFoodSlot(date, mealType, c.signal)
      .then((e) => {
        if (!c.signal.aborted) {
          setExpense(e)
          setState('ready')
        }
      })
      .catch(() => {
        if (!c.signal.aborted) setState('error')
      })
    return () => c.abort()
  }, [date, mealType, retry])
  if (state === 'ready' && !expense) return null
  return (
    <section
      className={
        'food-cost ' +
        (mealType === 'BREAKFAST' ? 'food-breakfast' : 'food-dinner')
      }
      aria-label={
        mealType === 'BREAKFAST' ? 'Chi phí bữa sáng' : 'Chi phí bữa tối'
      }
    >
      <h3>
        Chi phí {mealType === 'BREAKFAST' ? 'bữa sáng' : 'bữa tối'} ·{' '}
        {expenseDate(date)}
      </h3>
      {state === 'loading' && <p role="status">Đang xem chi phí bữa ăn…</p>}
      {state === 'error' && (
        <>
          <p>Chưa xem được chi phí bữa ăn.</p>
          <button
            onClick={() => {
              setState('loading')
              setRetry((v) => v + 1)
            }}
          >
            Thử lại chi phí
          </button>
        </>
      )}
      {state === 'ready' && expense && <FoodItems expense={expense} />}
    </section>
  )
}
