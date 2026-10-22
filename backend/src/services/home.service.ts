import { ApiError } from '../errors/api-error.js'
import { FAMILY_TIME_ZONE, getFamilyDate } from '../time/family-calendar.js'
import type { SafeFamilyProfile } from './family-auth.service.js'
import type { BreakfastService } from './breakfast.service.js'
import type { MealRequestService } from './meal-request.service.js'
import type { FinalMealService } from './final-meal.service.js'
import type { DishRatingService } from './dish-rating.service.js'
import type { CalendarService } from './calendar.service.js'
import type { ActivityPlanService } from './activity-plan.service.js'
import type { HouseholdDutyService } from './household-duty.service.js'
import type { StudyService } from './study.service.js'
import type { FitnessService } from './fitness.service.js'
import type { PersonalExpenseService } from './personal-expense.service.js'
import type { FamilyFoodService } from './family-food.service.js'

export interface RecentHomeDish {
  id: string
  name: string
  mealDate: string
  averageRating: number | null
  ratingCount: number
  ownRating: number | null
}
export interface HomeRepository {
  listRecent(
    memberId: string,
    parent: boolean,
    throughDate: string,
  ): Promise<RecentHomeDish[]>
}
interface HomeDependencies {
  activities: Pick<ActivityPlanService, 'progress'>
  breakfast: Pick<BreakfastService, 'getDay'>
  requests: Pick<MealRequestService, 'listCurrent'>
  meals: Pick<FinalMealService, 'get'>
  ratings: Pick<DishRatingService, 'get'>
  recent: HomeRepository
  calendar: Pick<CalendarService, 'list'>
  household: Pick<HouseholdDutyService, 'list'>
  study: Pick<StudyService, 'summary'>
  fitness: Pick<FitnessService, 'summary'>
  expenses: Pick<PersonalExpenseService, 'summary'>
  familyFood: Pick<FamilyFoodService, 'summary'>
}

export class HomeService {
  constructor(
    private readonly dependencies: HomeDependencies,
    private readonly clock = () => new Date(),
  ) {}

  async get(profile: SafeFamilyProfile) {
    try {
      const now = this.clock()
      const date = getFamilyDate(now)
      const parent = profile.role === 'PARENT'
      const {
        breakfast: breakfastService,
        requests,
        meals,
        ratings,
        recent,
        calendar,
        household,
        study,
        fitness,
        expenses,
        familyFood,
      } = this.dependencies
      const [
        breakfast,
        plans,
        meal,
        recentDishes,
        calendarView,
        choreView,
        studySummary,
        fitnessSummary,
        expenseSummary,
        foodSummary,
        personalView,
        studyActivity,
        fitnessActivity,
      ] = await Promise.all([
        breakfastService.getDay(profile, 'next'),
        requests.listCurrent(profile),
        meals.get(date, 'DINNER'),
        recent.listRecent(profile.id, parent, date),
        calendar.list(profile, date, date, undefined, 'FAMILY'),
        household.list(profile, date, date),
        parent ? Promise.resolve(null) : study.summary(profile),
        parent ? Promise.resolve(null) : fitness.summary(profile),
        expenses.summary(profile),
        familyFood.summary(profile),
        parent
          ? Promise.resolve(null)
          : calendar.list(profile, date, date, profile.id, 'PERSONAL'),
        parent ? Promise.resolve(null) : this.dependencies.activities.progress(profile, 'STUDY'),
        parent ? Promise.resolve(null) : this.dependencies.activities.progress(profile, 'FITNESS'),
      ])
      const plan = plans.find(
        (p) =>
          p.mealDate === date &&
          p.mealType === 'DINNER' &&
          p.status !== 'CANCELLED',
      )
      // Project explicitly: Home never serializes repository records or session state.
      const breakfastResponses = breakfast.responses
        .filter((r) => parent || r.member.id === profile.id)
        .map((r) => ({
          memberId: r.member.id,
          displayName: r.member.displayName,
          state: r.state,
          choice: r.catalogItem?.name ?? r.customText,
        }))
      const dinnerResponses = (plan?.responses ?? [])
        .filter((r) => parent || r.member.id === profile.id)
        .map((r) => ({
          memberId: r.member.id,
          displayName: r.member.displayName,
          state: r.state,
          choice: r.option?.label ?? r.customText,
        }))
      let ownUnratedCount = 0
      if (!parent && meal?.readyAt) {
        const feedback = await ratings.get(profile, meal.id)
        ownUnratedCount = feedback.dishes.filter(
          (d) => !d.ratings.some((r) => r.memberId === profile.id),
        ).length
      }
      const actions: { id: string; label: string }[] = []
      const duty =
        choreView.duties.find(
          (d) =>
            d.date === date &&
            !d.cancelled &&
            (parent || d.assignee.id === profile.id),
        ) ?? null
      if (breakfast.isOpen && !breakfast.purchase) {
        for (const response of breakfastResponses.filter(
          (r) => r.state === 'NO_RESPONSE',
        )) {
          actions.push({
            id: parent ? `breakfast-${response.memberId}` : 'breakfast',
            label: parent
              ? `${response.displayName} chưa chọn bữa sáng`
              : 'Chọn bữa sáng trước 01:00',
          })
        }
      }
      if ((parent ? !meal : !meal?.readyAt) && plan?.isOpen) {
        for (const response of dinnerResponses.filter(
          (r) => r.state === 'NO_RESPONSE',
        )) {
          actions.push({
            id: parent ? `dinner-${response.memberId}` : 'dinner-response',
            label: parent
              ? `${response.displayName} chưa trả lời bữa tối`
              : `Trả lời bữa tối trước ${new Intl.DateTimeFormat('vi-VN', { timeZone: FAMILY_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(plan.deadlineAt!))}`,
          })
        }
      }
      if (parent && plan && plan.status !== 'SELF_SERVICE' && !meal)
        actions.push({ id: 'dinner-finalize', label: 'Bữa tối chưa chốt' })
      if (parent && meal && !meal.readyAt)
        actions.push({
          id: 'dinner-ready',
          label: 'Bữa tối đã chốt nhưng chưa báo sẵn sàng',
        })
      if (!parent && ownUnratedCount > 0)
        actions.push({
          id: 'dinner-rating',
          label: 'Bạn còn món chưa đánh giá',
        })
      return {
        date,
        timeZone: FAMILY_TIME_ZONE,
        actions,
        breakfast: {
          date: breakfast.date,
          opensAt: breakfast.opensAt,
          deadlineAt: breakfast.deadlineAt,
          purchaseMessage: breakfast.purchase?.message ?? null,
          isOpen: breakfast.isOpen,
          purchased: breakfast.purchase !== null,
          responses: breakfastResponses,
        },
        dinner: {
          request: plan
            ? {
                status: plan.status,
                isOpen: plan.isOpen,
                responses: dinnerResponses,
              }
            : null,
          meal: meal
            ? {
                ready: meal.readyAt !== null,
                readyMessage: meal.readyMessage,
                dishes: meal.dishes.map((d) => ({ id: d.id, name: d.name })),
                ownUnratedCount,
              }
            : null,
        },
        recentDishes,
        personalExpenses: {
          month: expenseSummary.month,
          currency: expenseSummary.currency,
          currentTotal: expenseSummary.currentTotal,
          previousMonth: expenseSummary.previousMonth,
          previousTotal: expenseSummary.previousTotal,
          differenceAmount: expenseSummary.differenceAmount,
          percentageChange: expenseSummary.percentageChange,
        },
        familyFood: {
          month: foodSummary.month,
          currency: foodSummary.currency,
          currentTotal: foodSummary.currentTotal,
          previousMonth: foodSummary.previousMonth,
          previousTotal: foodSummary.previousTotal,
          differenceAmount: foodSummary.differenceAmount,
          percentageChange: foodSummary.percentageChange,
        },
        ...(!parent && fitnessSummary
          ? {
              fitness: {
                activityProgress: fitnessActivity,
                weekStart: fitnessSummary.weekStart,
                weekEnd: fitnessSummary.weekEnd,
                sessionsThisWeek: fitnessSummary.sessionsThisWeek,
                weeklyTarget: fitnessSummary.weeklyTarget,
                completionPercent: fitnessSummary.completionPercent,
                totalMinutes: fitnessSummary.totalMinutes,
                unrecordedDurationCount: fitnessSummary.unrecordedDurationCount,
              },
            }
          : {}),
        ...(!parent && studySummary
          ? {
              study: {
                activityProgress: studyActivity,
                weekStart: studySummary.weekStart,
                weekEnd: studySummary.weekEnd,
                totalMinutes: studySummary.totalMinutes,
                sessionCount: studySummary.sessionCount,
                ...(studySummary.latestAssessment
                  ? {
                      latestAssessment: {
                        courseName: studySummary.latestAssessment.courseName,
                        title: studySummary.latestAssessment.assessment.title,
                        score: studySummary.latestAssessment.assessment.score,
                        maxScore:
                          studySummary.latestAssessment.assessment.maxScore,
                        letterGrade:
                          studySummary.latestAssessment.assessment.letterGrade,
                      },
                    }
                  : {}),
                goals: studySummary.goals.map((g) => ({
                  id: g.id,
                  title: g.title,
                  targetMinutes: g.targetMinutes,
                  minutes: g.minutes,
                  targetDate: g.targetDate,
                })),
              },
            }
          : {}),
        chores: [],
        householdDuty: duty
          ? {
              id: duty.id,
              date: duty.date,
              assignee: {
                id: duty.assignee.id,
                displayName: duty.assignee.displayName,
                avatarType: duty.assignee.avatarType,
                avatarValue: duty.assignee.avatarValue,
              },
              cancelled: duty.cancelled,
              completedAt: duty.completedAt,
              completedByMemberId: duty.completedByMemberId,
            }
          : null,
        ...(!parent && personalView
          ? {
              personalCalendar: {
                events: personalView.occurrences
                  .filter(
                    (item) =>
                      !item.cancelled &&
                      item.owner.id === profile.id &&
                      Date.parse(item.endsAt) > now.getTime(),
                  )
                  .slice(0, 3)
                  .map((item) => ({
                    id: item.event.id + ':' + item.date,
                    title: item.title,
                    startsAt: item.startsAt,
                    endsAt: item.endsAt,
                    owner: {
                      id: item.owner.id,
                      displayName: item.owner.displayName,
                      avatarType: item.owner.avatarType,
                      avatarValue: item.owner.avatarValue,
                    },
                  })),
              },
            }
          : {}),
        calendar: {
          events: calendarView.occurrences
            .filter(
              (item) =>
                !item.cancelled &&
                item.event.calendarType !== 'PERSONAL' &&
                Date.parse(item.endsAt) > now.getTime(),
            )
            .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
            .slice(0, 3)
            .map((item) => ({
              id: `${item.event.id}:${item.date}`,
              title: item.title,
              startsAt: item.startsAt,
              endsAt: item.endsAt,
              owner: {
                id: item.owner.id,
                displayName: item.owner.displayName,
                avatarType: item.owner.avatarType,
                avatarValue: item.owner.avatarValue,
              },
            })),
        },
      }
    } catch {
      throw new ApiError(
        503,
        'HOME_UNAVAILABLE',
        'Home information is temporarily unavailable',
      )
    }
  }
}
