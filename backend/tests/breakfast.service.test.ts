import { describe, expect, it } from 'vitest'

import type { SafeFamilyProfile } from '../src/services/family-auth.service.js'
import {
  BreakfastClosedError,
  BreakfastForbiddenError,
  BreakfastService,
  BreakfastUnavailableError,
  BreakfastValidationError,
  type BreakfastCatalogItem,
  type BreakfastMember,
  type BreakfastRepository,
  type BreakfastSelectionRecord,
  type UpsertBreakfastSelection,
} from '../src/services/breakfast.service.js'

const memberId = '11111111-1111-4111-8111-111111111111'
const otherMemberId = '22222222-2222-4222-8222-222222222222'
const parentId = '33333333-3333-4333-8333-333333333333'
const dishId = '44444444-4444-4444-8444-444444444444'
const breakfastDate = '2026-10-22'
const now = new Date('2026-10-21T12:00:00.000Z')

const memberProfile: SafeFamilyProfile = {
  id: memberId,
  displayName: 'Synthetic Member',
  role: 'MEMBER',
  avatarType: null,
  avatarValue: null,
}

const adminProfile: SafeFamilyProfile = {
  ...memberProfile,
  role: 'ADMIN',
}

const parentProfile: SafeFamilyProfile = {
  id: parentId,
  displayName: 'Synthetic Parent',
  role: 'PARENT',
  avatarType: null,
  avatarValue: null,
}

const catalogItem: BreakfastCatalogItem = {
  id: dishId,
  name: 'Synthetic Dish',
  displayOrder: 1,
}

const members: BreakfastMember[] = [
  { ...memberProfile },
  {
    id: otherMemberId,
    displayName: 'Synthetic Admin',
    role: 'ADMIN',
    avatarType: 'EMOJI',
    avatarValue: '🌿',
  },
  { ...parentProfile },
]

class FakeBreakfastRepository implements BreakfastRepository {
  catalog: BreakfastCatalogItem[] = [catalogItem]
  members: BreakfastMember[] = [...members]
  selections: BreakfastSelectionRecord[] = []
  upsertCalls: UpsertBreakfastSelection[] = []
  selectionReadCalls: Array<{ date: string; memberIds: string[] }> = []
  error?: Error

  async listActiveCatalog(): Promise<BreakfastCatalogItem[]> {
    if (this.error) throw this.error
    return this.catalog
  }

  async listActiveMembers(): Promise<BreakfastMember[]> {
    if (this.error) throw this.error
    return this.members
  }

  async listSelections(
    date: string,
    memberIds: string[],
  ): Promise<BreakfastSelectionRecord[]> {
    if (this.error) throw this.error
    this.selectionReadCalls.push({ date, memberIds })
    return this.selections.filter(
      (selection) =>
        selection.breakfastDate === date &&
        memberIds.includes(selection.memberId),
    )
  }

  async findActiveCatalogItem(id: string): Promise<BreakfastCatalogItem | null> {
    if (this.error) throw this.error
    return this.catalog.find((item) => item.id === id) ?? null
  }

  async upsertSelection(
    input: UpsertBreakfastSelection,
  ): Promise<BreakfastSelectionRecord> {
    if (this.error) throw this.error
    this.upsertCalls.push(input)
    const record: BreakfastSelectionRecord = {
      memberId: input.memberId,
      breakfastDate: input.breakfastDate,
      state: input.state,
      catalogItem:
        input.dishId === null
          ? null
          : (() => {
              const item = this.catalog.find((entry) => entry.id === input.dishId)
              return item ? { id: item.id, name: item.name } : null
            })(),
      customText: input.customText,
      createdAt: '2026-10-21T12:00:00.000Z',
      updatedAt: '2026-10-21T12:00:00.000Z',
    }
    this.selections = this.selections.filter(
      (selection) =>
        selection.memberId !== input.memberId ||
        selection.breakfastDate !== input.breakfastDate,
    )
    this.selections.push(record)
    return record
  }
}

function createHarness(repository = new FakeBreakfastRepository()) {
  return {
    repository,
    service: new BreakfastService(repository, () => now),
  }
}

describe('BreakfastService catalog and day views', () => {
  it('returns the active ordered catalog', async () => {
    const { service } = createHarness()

    await expect(service.getCatalog()).resolves.toEqual([catalogItem])
  })

  it('synthesizes NO_RESPONSE and reads only the member’s own response', async () => {
    const { repository, service } = createHarness()

    await expect(service.getDay(memberProfile, 'next')).resolves.toEqual({
      date: breakfastDate,
      deadlineAt: '2026-10-21T17:00:00.000Z',
      timeZone: 'Asia/Ho_Chi_Minh',
      isOpen: true,
      responses: [
        {
          member: {
            id: memberId,
            displayName: 'Synthetic Member',
            avatarType: null,
            avatarValue: null,
          },
          state: 'NO_RESPONSE',
          catalogItem: null,
          customText: null,
          updatedAt: null,
        },
      ],
    })
    expect(repository.selectionReadCalls).toEqual([
      { date: breakfastDate, memberIds: [memberId] },
    ])
  })

  it('lets a parent read active non-parent statuses without a response for herself', async () => {
    const repository = new FakeBreakfastRepository()
    repository.selections = [
      {
        memberId,
        breakfastDate,
        state: 'SELECTED',
        catalogItem: { id: catalogItem.id, name: catalogItem.name },
        customText: null,
        createdAt: '2026-10-21T10:00:00.000Z',
        updatedAt: '2026-10-21T10:00:00.000Z',
      },
      {
        memberId: otherMemberId,
        breakfastDate,
        state: 'NOT_EATING',
        catalogItem: null,
        customText: null,
        createdAt: '2026-10-21T10:00:00.000Z',
        updatedAt: '2026-10-21T10:00:00.000Z',
      },
    ]
    const { service } = createHarness(repository)

    const day = await service.getDay(parentProfile, breakfastDate)

    expect(day.responses.map((response) => response.member.id)).toEqual([
      memberId,
      otherMemberId,
    ])
    expect(day.responses.map((response) => response.state)).toEqual([
      'SELECTED',
      'NOT_EATING',
    ])
  })

  it('returns a closed historical requested date without changing its value', async () => {
    const { service } = createHarness()

    const day = await service.getDay(adminProfile, '2026-10-21')

    expect(day.date).toBe('2026-10-21')
    expect(day.isOpen).toBe(false)
    expect(day.deadlineAt).toBe('2026-10-20T17:00:00.000Z')
  })

  it('redacts repository failures', async () => {
    const repository = new FakeBreakfastRepository()
    repository.error = new Error('secret database detail')
    const { service } = createHarness(repository)

    const result = service.getDay(memberProfile, 'next')

    await expect(result).rejects.toBeInstanceOf(BreakfastUnavailableError)
    await expect(result).rejects.not.toThrow('secret database detail')
  })
})

describe('BreakfastService response writes', () => {
  it('saves a valid catalog choice for the authenticated member', async () => {
    const { repository, service } = createHarness()

    const response = await service.saveResponse(memberProfile, breakfastDate, {
      state: 'SELECTED',
      catalogItemId: dishId,
    })

    expect(response.state).toBe('SELECTED')
    expect(response.catalogItem).toEqual({
      id: catalogItem.id,
      name: catalogItem.name,
    })
    expect(repository.upsertCalls).toEqual([
      {
        memberId,
        breakfastDate,
        state: 'SELECTED',
        dishId,
        customText: null,
      },
    ])
  })

  it('trims and saves a custom choice', async () => {
    const { repository, service } = createHarness()

    const response = await service.saveResponse(memberProfile, breakfastDate, {
      state: 'CUSTOM',
      customText: '  Synthetic noodles  ',
    })

    expect(response).toMatchObject({
      state: 'CUSTOM',
      catalogItem: null,
      customText: 'Synthetic noodles',
    })
    expect(repository.upsertCalls[0]).toMatchObject({
      memberId,
      state: 'CUSTOM',
      dishId: null,
      customText: 'Synthetic noodles',
    })
  })

  it('saves NOT_EATING distinctly from missing data', async () => {
    const { repository, service } = createHarness()

    const response = await service.saveResponse(memberProfile, breakfastDate, {
      state: 'NOT_EATING',
    })

    expect(response.state).toBe('NOT_EATING')
    expect(repository.upsertCalls[0]).toMatchObject({
      dishId: null,
      customText: null,
    })
  })

  it('updates the same authenticated member/date before the deadline', async () => {
    const { repository, service } = createHarness()

    await service.saveResponse(memberProfile, breakfastDate, {
      state: 'SELECTED',
      catalogItemId: dishId,
    })
    await service.saveResponse(memberProfile, breakfastDate, {
      state: 'NOT_EATING',
    })

    expect(repository.upsertCalls).toHaveLength(2)
    expect(repository.selections).toHaveLength(1)
    expect(repository.selections[0]?.state).toBe('NOT_EATING')
  })

  it.each([
    { input: { state: 'NO_RESPONSE' }, label: 'NO_RESPONSE' },
    {
      input: { state: 'SELECTED', catalogItemId: dishId, customText: 'extra' },
      label: 'selected with custom text',
    },
    { input: { state: 'SELECTED' }, label: 'selected without a catalog ID' },
    { input: { state: 'CUSTOM', customText: '   ' }, label: 'blank custom text' },
    {
      input: { state: 'CUSTOM', customText: 'dish', catalogItemId: dishId },
      label: 'custom with a catalog ID',
    },
    {
      input: { state: 'NOT_EATING', customText: 'extra' },
      label: 'not eating with custom text',
    },
    {
      input: { state: 'NOT_EATING', memberId: otherMemberId },
      label: 'an attempted ownership override',
    },
  ])('rejects invalid combination: $label', async ({ input }) => {
    const { repository, service } = createHarness()

    await expect(
      service.saveResponse(memberProfile, breakfastDate, input),
    ).rejects.toBeInstanceOf(BreakfastValidationError)
    expect(repository.upsertCalls).toEqual([])
  })

  it('rejects an unknown or inactive catalog item', async () => {
    const { repository, service } = createHarness()

    await expect(
      service.saveResponse(memberProfile, breakfastDate, {
        state: 'SELECTED',
        catalogItemId: otherMemberId,
      }),
    ).rejects.toBeInstanceOf(BreakfastValidationError)
    expect(repository.upsertCalls).toEqual([])
  })

  it('does not let a parent submit a breakfast response', async () => {
    const { repository, service } = createHarness()

    await expect(
      service.saveResponse(parentProfile, breakfastDate, {
        state: 'NOT_EATING',
      }),
    ).rejects.toBeInstanceOf(BreakfastForbiddenError)
    expect(repository.upsertCalls).toEqual([])
  })

  it('rejects writes at the deadline', async () => {
    const repository = new FakeBreakfastRepository()
    const service = new BreakfastService(
      repository,
      () => new Date('2026-10-21T17:00:00.000Z'),
    )

    await expect(
      service.saveResponse(memberProfile, breakfastDate, {
        state: 'NOT_EATING',
      }),
    ).rejects.toBeInstanceOf(BreakfastClosedError)
    expect(repository.upsertCalls).toEqual([])
  })

  it('rejects malformed dates before persistence', async () => {
    const { repository, service } = createHarness()

    await expect(
      service.saveResponse(memberProfile, '2026-02-29', {
        state: 'NOT_EATING',
      }),
    ).rejects.toBeInstanceOf(BreakfastValidationError)
    expect(repository.upsertCalls).toEqual([])
  })
})
