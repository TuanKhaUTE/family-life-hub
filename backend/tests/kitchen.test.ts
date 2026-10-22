import { describe, expect, it, vi } from 'vitest'
import {
  deriveMealCandidates,
  MealRequestService,
  type MealRequestRepository,
  type MealRequestRecord,
} from '../src/services/meal-request.service.js'
import {
  FinalMealService,
  type FinalMealRepository,
} from '../src/services/final-meal.service.js'
const profile = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Synthetic Parent',
  role: 'PARENT' as const,
  avatarType: null,
  avatarValue: null,
}
const base: MealRequestRecord = {
  id: profile.id,
  mealDate: '2099-05-01',
  mealType: 'DINNER',
  status: 'OPEN',
  mode: 'OPEN_CHOICE',
  deadlineAt: '2099-05-01T12:00:00Z',
  parentMessage: null,
  createdBy: { id: profile.id, displayName: profile.displayName },
  options: [],
  createdAt: '2099-05-01T00:00:00Z',
  updatedAt: '2099-05-01T00:00:00Z',
}
const member = {
  id: '22222222-2222-4222-8222-222222222222',
  displayName: 'Synthetic Child',
  role: 'MEMBER' as const,
  avatarType: null,
  avatarValue: null,
}
const response = {
  member,
  state: 'CUSTOM' as const,
  customText: ' Cơm  gà rô ti ',
  option: null,
  updatedAt: null,
}
describe('daily kitchen', () => {
  it('excludes explicit free-text no-dinner replies, without guessing arbitrary food preferences', () => {
    expect(
      deriveMealCandidates([
        { ...response, customText: 'Hôm nay con không ăn tối' },
        { ...response, customText: 'Không ăn bữa tối hôm nay' },
        { ...response, customText: 'Con không ăn bún bò' },
      ]),
    ).toEqual([{ name: 'Con không ăn bún bò', chosenBy: [member.displayName] }])
  })
  it('hydrates candidates only for the parent, keeping member views own-response only', async () => {
    const repository = {
      listCurrentRequests: vi.fn().mockResolvedValue([base]),
      listActiveMembers: vi.fn().mockResolvedValue([member]),
      listResponses: vi.fn().mockResolvedValue([
        {
          id: profile.id,
          requestId: base.id,
          memberId: member.id,
          responseType: 'CUSTOM',
          option: null,
          customText: 'Cơm gà rô ti',
          createdAt: base.createdAt,
          updatedAt: base.updatedAt,
        },
      ]),
    } as unknown as MealRequestRepository
    const service = new MealRequestService(
      repository,
      () => new Date('2099-05-01T01:00:00Z'),
    )
    expect((await service.listCurrent(profile))[0]?.candidates).toEqual([
      { name: 'Cơm gà rô ti', chosenBy: ['Synthetic Child'] },
    ])
    const own = (await service.listCurrent(member))[0]!
    expect(own.candidates).toBeUndefined()
    expect(own.responses.map((item) => item.member.id)).toEqual([member.id])
  })
  it('finalizes selected response-derived dishes with an optional extra through the existing save boundary', async () => {
    const repository = {
      get: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async (input) => input),
      ready: vi.fn(),
    } as unknown as FinalMealRepository
    const candidates = deriveMealCandidates([response])
    const service = new FinalMealService(repository)
    const result = await service.save(profile, base.mealDate, 'DINNER', {
      mealRequestId: base.id,
      dishes: [
        { name: candidates[0]!.name, category: 'MAIN', sortOrder: 0 },
        { name: 'Canh cải', category: 'SOUP', sortOrder: 1 },
      ],
    })
    expect(result).toMatchObject({
      actorMemberId: profile.id,
      mealDate: '2099-05-01',
      mealType: 'DINNER',
      mealRequestId: base.id,
      dishes: [
        { name: 'Cơm gà rô ti', category: 'MAIN', sortOrder: 0 },
        { name: 'Canh cải', category: 'SOUP', sortOrder: 1 },
      ],
    })
  })
  it('exposes only today dinner, hiding lunch, future, and cancelled history', async () => {
    const repository = {
      listCurrentRequests: vi
        .fn()
        .mockResolvedValue([
          base,
          { ...base, id: 'lunch', mealType: 'LUNCH' },
          { ...base, id: 'future', mealDate: '2099-05-02' },
          { ...base, id: 'cancelled', status: 'CANCELLED' },
        ]),
      listActiveMembers: vi.fn().mockResolvedValue([member]),
      listResponses: vi.fn().mockResolvedValue([]),
    } as unknown as MealRequestRepository
    const result = await new MealRequestService(
      repository,
      () => new Date('2099-05-01T01:00:00Z'),
    ).listCurrent(profile)
    expect(result.map((item) => item.id)).toEqual([profile.id])
  })
  it('deduplicates Unicode/case/spacing variants and excludes not-eating/no-response', () => {
    const result = deriveMealCandidates([
      response,
      {
        ...response,
        member: { ...member, id: profile.id, displayName: 'Synthetic Other' },
        state: 'SELECTED_OPTION',
        customText: null,
        option: { id: profile.id, label: 'cơm gà rô ti'.normalize('NFD') },
      },
      { ...response, state: 'NOT_EATING' },
      { ...response, state: 'NO_RESPONSE' },
    ])
    expect(result).toEqual([
      {
        name: 'Cơm gà rô ti',
        chosenBy: ['Synthetic Child', 'Synthetic Other'],
      },
    ])
  })
})
