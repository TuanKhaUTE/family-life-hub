import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '../config/supabase.js'
import { ApiError } from '../errors/api-error.js'
import {
  EXPENSE_CATEGORIES,
  normalizePersonalExpense,
  expenseId,
  money,
  type PersonalExpenseRepository,
  type PersonalExpenseInput,
  type ExpenseData,
  type ExpenseCategory,
} from '../services/personal-expense.service.js'

export class SupabasePersonalExpenseRepository
  implements PersonalExpenseRepository
{
  private client?: SupabaseClient
  constructor(
    private readonly factory: () => SupabaseClient = createSupabaseServerClient,
  ) {}
  private async rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await (this.client ??= this.factory()).rpc(
      name,
      args,
    )
    if (error) {
      if (error.code === '42501')
        throw new ApiError(
          403,
          'EXPENSE_FORBIDDEN',
          'Personal expense access is not permitted',
        )
      if (error.code === 'P0002')
        throw new ApiError(
          404,
          'EXPENSE_NOT_FOUND',
          'Personal expense not found',
        )
      if (
        [
          '22023',
          '23514',
          '23502',
          '22P02',
          '22003',
          '22007',
          '22008',
        ].includes(error.code)
      )
        throw new ApiError(
          400,
          'EXPENSE_INVALID',
          'Invalid personal expense input',
        )
      throw new Error('Personal expense storage unavailable')
    }
    return data as unknown
  }
  async read(
    actorId: string,
    month: string,
    page: number,
  ): Promise<ExpenseData> {
    const v = await this.rpc('personal_expense_read', {
      p_actor_member_id: actorId,
      p_month: month + '-01',
      p_page: page,
    })
    try {
      if (
        !object(v) ||
        !Array.isArray(v.expenses) ||
        v.expenses.length > 20 ||
        !Array.isArray(v.categories) ||
        v.categories.length > 8 ||
        !money(v.currentTotal) ||
        !money(v.previousTotal) ||
        !Number.isSafeInteger(v.totalCount) ||
        (v.totalCount as number) < v.expenses.length
      )
        throw new Error()
      const expenses = v.expenses.map((row) => {
        if (!object(row)) throw new Error()
        expenseId(row.id)
        const input = normalizePersonalExpense(
          {
            amount: row.amount,
            spentOn: row.spentOn,
            category: row.category,
            note: row.note,
          },
          '2199-12-31',
        )
        if (input.spentOn.slice(0, 7) !== month) throw new Error()
        return { id: row.id, ...input }
      })
      const categories = v.categories.map((row) => {
        if (
          !object(row) ||
          !EXPENSE_CATEGORIES.includes(row.category as ExpenseCategory) ||
          !money(row.amount) ||
          row.amount === '0'
        )
          throw new Error()
        return { category: row.category as ExpenseCategory, amount: row.amount }
      })
      if (
        new Set(categories.map((c) => c.category)).size !== categories.length ||
        categories.reduce((sum, c) => sum + BigInt(c.amount), 0n) !==
          BigInt(v.currentTotal)
      )
        throw new Error()
      return {
        expenses,
        totalCount: v.totalCount as number,
        currentTotal: v.currentTotal,
        previousTotal: v.previousTotal,
        categories,
      }
    } catch {
      throw new Error('Invalid personal expense storage response')
    }
  }
  async mutate(
    actorId: string,
    id: string | null,
    input: PersonalExpenseInput | null,
    remove: boolean,
  ) {
    await this.rpc('personal_expense_mutate', {
      p_actor_member_id: actorId,
      p_id: id,
      p_input: input,
      p_remove: remove,
    })
  }
}
function object(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}
