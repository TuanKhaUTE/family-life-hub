import { describe, expect, it, vi } from 'vitest'
import {
  FinalMealService,
  FinalMealError,
  type FinalMealRepository,
} from '../src/services/final-meal.service.js'

const parent = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Synthetic Parent',
  role: 'PARENT' as const,
  avatarType: null,
  avatarValue: null,
}
const slot = ['2099-05-01', 'DINNER'] as const
const dishes = [
  { name: ' Cơm gà rô ti ', category: 'MAIN', sortOrder: 0 },
  { name: 'Canh cải', category: 'SOUP', sortOrder: 1 },
]
function setup() {
  const repository = {
    get: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue({ id: parent.id }),
    ready: vi.fn().mockResolvedValue({ id: parent.id }),
  } satisfies FinalMealRepository
  return { repository, service: new FinalMealService(repository) }
}
describe('final meal service', () => {
  it('carries existing identities while allowing new dishes without IDs', async () => {
    const { repository, service } = setup()
    await service.save(parent, ...slot, {
      dishes: [{ ...dishes[0], id: parent.id }, dishes[1]],
    })
    expect(repository.save.mock.calls[0]?.[0].dishes).toEqual([
      { ...dishes[0], id: parent.id, name: 'Cơm gà rô ti' },
      dishes[1],
    ])
  })
  it.each(['invalid', null, 42])(
    'rejects invalid dish identity %s',
    async (id) => {
      await expect(
        setup().service.save(parent, ...slot, {
          dishes: [{ ...dishes[0], id }],
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    },
  )
  it('rejects duplicate dish identities before saving', async () => {
    const { service, repository } = setup()
    await expect(
      service.save(parent, ...slot, {
        dishes: dishes.map((dish) => ({ ...dish, id: parent.id })),
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(repository.save).not.toHaveBeenCalled()
  })
  it.each(['ADMIN', 'MEMBER'] as const)(
    'denies %s finalization and ready',
    async (role) => {
      const { repository, service } = setup()
      for (const action of [
        () => service.save({ ...parent, role }, ...slot, { dishes }),
        () => service.ready({ ...parent, role }, ...slot, {}),
      ])
        await expect(action()).rejects.toMatchObject({
          code: 'FINAL_MEAL_FORBIDDEN',
        })
      expect(repository.save).not.toHaveBeenCalled()
      expect(repository.ready).not.toHaveBeenCalled()
    },
  )
  it('saves a direct meal with ordered trimmed dishes and session actor', async () => {
    const { repository, service } = setup()
    await service.save(parent, ...slot, { dishes })
    expect(repository.save).toHaveBeenCalledWith({
      actorMemberId: parent.id,
      mealDate: slot[0],
      mealType: slot[1],
      mealRequestId: null,
      dishes: [{ ...dishes[0], name: 'Cơm gà rô ti' }, dishes[1]],
    })
  })
  it('passes a validated optional linked request', async () => {
    const { repository, service } = setup()
    await service.save(parent, ...slot, { dishes, mealRequestId: parent.id })
    expect(repository.save.mock.calls[0]?.[0]).toMatchObject({
      mealRequestId: parent.id,
    })
  })
  it.each([
    { dishes: [] },
    { dishes: [{ name: ' ', category: 'MAIN', sortOrder: 0 }] },
    { dishes: [{ name: 'Dish', category: 'INVALID', sortOrder: 0 }] },
    { dishes: [{ name: 'Dish', category: 'MAIN', sortOrder: 1 }] },
    { dishes, actorMemberId: parent.id },
    { dishes, mealRequestId: 'invalid' },
    { dishes: [{ name: 'x'.repeat(121), category: 'MAIN', sortOrder: 0 }] },
  ])('rejects invalid dish list/input %#', async (input) => {
    await expect(
      setup().service.save(parent, ...slot, input),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })
  it.each([
    ['2099-02-30', 'LUNCH'],
    ['2099-05-01', 'BREAKFAST'],
  ])('validates slot %s %s', async (date, type) => {
    await expect(setup().service.get(date, type)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })
  })
  it('reads an empty slot', async () => {
    await expect(setup().service.get(...slot)).resolves.toBeNull()
  })
  it('trims optional ready message', async () => {
    const { repository, service } = setup()
    await service.ready(parent, ...slot, {
      readyMessage: ' Cả nhà ăn cơm nhé ',
    })
    expect(repository.ready).toHaveBeenCalledWith({
      actorMemberId: parent.id,
      mealDate: slot[0],
      mealType: slot[1],
      readyMessage: 'Cả nhà ăn cơm nhé',
    })
  })
  it.each([
    { readyMessage: 'x'.repeat(301) },
    { readyMessage: 2 },
    { actorMemberId: parent.id },
  ])('rejects unsafe ready input %#', async (input) => {
    await expect(
      setup().service.ready(parent, ...slot, input),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })
  it('redacts database failures and preserves safe domain errors', async () => {
    const { repository, service } = setup()
    repository.get.mockRejectedValueOnce(new Error('private database detail'))
    await expect(service.get(...slot)).rejects.toMatchObject({
      code: 'FINAL_MEAL_UNAVAILABLE',
    })
    repository.save.mockRejectedValueOnce(
      new FinalMealError(409, 'FINAL_MEAL_SELF_SERVICE', 'Change plan first'),
    )
    await expect(
      service.save(parent, ...slot, { dishes }),
    ).rejects.toMatchObject({ code: 'FINAL_MEAL_SELF_SERVICE' })
  })
})
