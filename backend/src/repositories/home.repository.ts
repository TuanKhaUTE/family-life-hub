import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '../config/supabase.js'
import type {
  HomeRepository,
  RecentHomeDish,
} from '../services/home.service.js'
import { isFamilyDate } from '../time/family-calendar.js'

export class SupabaseHomeRepository implements HomeRepository {
  private client?: SupabaseClient
  constructor(
    private readonly factory: () => SupabaseClient = createSupabaseServerClient,
  ) {}

  async listRecent(
    memberId: string,
    parent: boolean,
    throughDate: string,
  ): Promise<RecentHomeDish[]> {
    const { data, error } = await (this.client ??= this.factory())
      .from('final_meal_dishes')
      .select(
        `id,name,sort_order,final_meals!inner(meal_date),final_meal_dish_ratings${parent ? '!inner' : ''}(member_id,rating)`,
      )
      .eq('final_meals.meal_type', 'DINNER')
      .not('final_meals.ready_at', 'is', null)
      .lte('final_meals.meal_date', throughDate)
      .order('final_meals(meal_date)', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true })
      .limit(3)
    if (error || !Array.isArray(data))
      throw new Error('Recent dishes are unavailable')
    return data.map((value: unknown) => {
      if (
        !object(value) ||
        typeof value.id !== 'string' ||
        typeof value.name !== 'string' ||
        !object(value.final_meals) ||
        !isFamilyDate(value.final_meals.meal_date) ||
        !Array.isArray(value.final_meal_dish_ratings)
      )
        throw new Error('Invalid recent dish')
      const scores = value.final_meal_dish_ratings.map((score: unknown) => {
        if (
          !object(score) ||
          typeof score.member_id !== 'string' ||
          !Number.isInteger(score.rating) ||
          (score.rating as number) < 1 ||
          (score.rating as number) > 5
        )
          throw new Error('Invalid recent rating')
        return { memberId: score.member_id, rating: score.rating as number }
      })
      return {
        id: value.id,
        name: value.name,
        mealDate: value.final_meals.meal_date,
        averageRating: scores.length
          ? scores.reduce((sum, score) => sum + score.rating, 0) / scores.length
          : null,
        ratingCount: scores.length,
        ownRating: parent
          ? null
          : (scores.find((s) => s.memberId === memberId)?.rating ?? null),
      }
    })
  }
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
