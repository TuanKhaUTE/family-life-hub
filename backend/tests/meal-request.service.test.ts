import { beforeEach, describe, expect, it } from 'vitest'
import {
  MealRequestClosedError,
  MealRequestConflictError,
  MealRequestForbiddenError,
  MealRequestService,
  MealRequestValidationError,
  type MealMember,
  type MealRequestRecord,
  type MealRequestRepository,
  type MealResponseRecord,
} from '../src/services/meal-request.service.js'

const parent = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Synthetic Parent',
  role: 'PARENT' as const,
  avatarType: null,
  avatarValue: null,
}
const member = {
  id: '22222222-2222-4222-8222-222222222222',
  displayName: 'Synthetic Member',
  role: 'MEMBER' as const,
  avatarType: null,
  avatarValue: null,
}
const admin = { ...member, role: 'ADMIN' as const }
const optionId = '33333333-3333-4333-8333-333333333333'
const requestId = '44444444-4444-4444-8444-444444444444'
const responseId = '55555555-5555-4555-8555-555555555555'
const now = new Date('2026-10-21T08:00:00.000Z')
const record: MealRequestRecord = {
  id: requestId,
  mealDate: '2026-10-21',
  mealType: 'DINNER',
  mode: 'OPTION_POLL',
  status: 'OPEN',
  deadlineAt: '2026-10-21T12:00:00.000Z',
  parentMessage: 'Choose dinner',
  createdBy: { id: parent.id, displayName: parent.displayName },
  options: [
    { id: optionId, label: 'Rice', sortOrder: 1 },
    {
      id: '66666666-6666-4666-8666-666666666666',
      label: 'Noodles',
      sortOrder: 2,
    },
  ],
  createdAt: '2026-10-21T07:00:00.000Z',
  updatedAt: '2026-10-21T07:00:00.000Z',
}
const saved: MealResponseRecord = {
  id: responseId,
  requestId,
  memberId: member.id,
  responseType: 'SELECTED_OPTION',
  option: { id: optionId, label: 'Rice' },
  customText: null,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
}

class FakeRepository implements MealRequestRepository {
  async configureRequest(
    input: Parameters<MealRequestRepository['configureRequest']>[0],
  ) {
    if (input.status === 'CANCELLED') {
      this.requests = this.requests.map((request) => ({
        ...request,
        status: 'CANCELLED',
      }))
      return requestId
    }
    if (input.mode === 'SELF_SERVICE')
      return this.updateRequest({
        actorMemberId: input.actorMemberId,
        requestId: input.requestId,
        status: 'SELF_SERVICE',
        deadlineAt: null,
        parentMessage: input.parentMessage,
      })
    return this.changeSelfServiceRequest({
      actorMemberId: input.actorMemberId,
      requestId: input.requestId,
      mode: input.mode,
      deadlineAt: input.deadlineAt!,
      parentMessage: input.parentMessage,
      options: input.options,
    })
  }
  requests = [record]
  members: MealMember[] = [parent, member]
  responses: MealResponseRecord[] = []
  conflict = false
  createdInputs: Parameters<MealRequestRepository['createRequest']>[0][] = []
  updatedInputs: Parameters<MealRequestRepository['updateRequest']>[0][] = []
  changedSelfServiceInputs: Parameters<
    MealRequestRepository['changeSelfServiceRequest']
  >[0][] = []
  savedInputs: Parameters<MealRequestRepository['saveResponse']>[0][] = []
  async listCurrentRequests() {
    return this.requests
  }
  async listActiveMembers() {
    return this.members
  }
  async listResponses() {
    return this.responses
  }
  async findRequest(id: string) {
    return this.requests.find((item) => item.id === id) ?? null
  }
  async findResponse(id: string) {
    return id === responseId ? saved : null
  }
  async createRequest(
    input: Parameters<MealRequestRepository['createRequest']>[0],
  ) {
    if (this.conflict) throw new MealRequestConflictError()
    this.createdInputs.push(input)
    return requestId
  }
  async updateRequest(
    input: Parameters<MealRequestRepository['updateRequest']>[0],
  ) {
    this.updatedInputs.push(input)
    return requestId
  }
  async changeSelfServiceRequest(
    input: Parameters<MealRequestRepository['changeSelfServiceRequest']>[0],
  ) {
    this.changedSelfServiceInputs.push(input)
    this.requests = this.requests.map((request) =>
      request.id === input.requestId
        ? {
            ...request,
            status: 'OPEN',
            mode: input.mode,
            deadlineAt: input.deadlineAt,
            parentMessage: input.parentMessage,
            options: input.options.map((label, index) => ({
              id: `${index + 7}7777777-7777-4777-8777-777777777777`,
              label,
              sortOrder: index + 1,
            })),
          }
        : request,
    )
    return requestId
  }
  async saveResponse(
    input: Parameters<MealRequestRepository['saveResponse']>[0],
  ) {
    this.savedInputs.push(input)
    return responseId
  }
}

describe('MealRequestService', () => {
  let repository: FakeRepository
  let service: MealRequestService
  beforeEach(() => {
    repository = new FakeRepository()
    service = new MealRequestService(repository, () => now)
  })
  it('defaults new dinner to free-text and 14:00 family time', async () => {
    const morning = new MealRequestService(
      repository,
      () => new Date('2026-10-21T01:00:00Z'),
    )
    await morning.create(parent, {
      mealDate: '2026-10-21',
      mealType: 'DINNER',
      parentMessage: 'Mẹ có cơm gà',
    })
    expect(repository.createdInputs[0]).toMatchObject({
      mode: 'OPEN_CHOICE',
      options: [],
      deadlineAt: '2026-10-21T07:00:00.000Z',
    })
  })
  it('rejects new structured dinner polls without touching history', async () => {
    await expect(
      service.create(parent, {
        mealDate: '2026-10-21',
        mealType: 'DINNER',
        mode: 'OPTION_POLL',
        deadlineAt: '2026-10-21T12:00:00Z',
        options: ['A', 'B'],
      }),
    ).rejects.toBeInstanceOf(MealRequestValidationError)
    expect(repository.requests[0]).toEqual(record)
  })
  it('accepts free text for a legacy dinner poll and maps explicit no-dinner text to NOT_EATING', async () => {
    await service.saveResponse(member, requestId, {
      responseType: 'CUSTOM',
      customText: 'Con ăn cơm gà',
    })
    expect(repository.savedInputs[0]).toMatchObject({
      responseType: 'CUSTOM',
      customText: 'Con ăn cơm gà',
    })
    await service.saveResponse(member, requestId, {
      responseType: 'CUSTOM',
      customText: 'Hôm nay con không ăn tối',
    })
    expect(repository.savedInputs[1]).toMatchObject({
      responseType: 'NOT_EATING',
      customText: null,
    })
  })
  it('forwards explicit confirmation when recreating a cancelled slot', async () => {
    await service.create(parent, {
      mealDate: '2026-10-21',
      mealType: 'DINNER',
      mode: 'OPEN_CHOICE',
      deadlineAt: '2026-10-21T12:00:00Z',
      confirmResponseReset: true,
    })
    expect(repository.createdInputs[0]?.confirmResponseReset).toBe(true)
  })

  it('lists current requests and represents absent responses as NO_RESPONSE for a parent', async () => {
    const result = await service.listCurrent(parent)
    expect(result[0]).toMatchObject({
      id: requestId,
      isOpen: true,
      timeZone: 'Asia/Ho_Chi_Minh',
      responses: [{ member: { id: member.id }, state: 'NO_RESPONSE' }],
    })
  })

  it('returns only the authenticated member response to a member', async () => {
    repository.responses = [saved]
    const result = await service.listCurrent(member)
    expect(result[0]!.responses).toEqual([
      {
        member: {
          id: member.id,
          displayName: member.displayName,
          avatarType: null,
          avatarValue: null,
        },
        state: 'SELECTED_OPTION',
        option: { id: optionId, label: 'Rice' },
        customText: null,
        updatedAt: saved.updatedAt,
      },
    ])
  })

  it('treats an elapsed open request as closed', async () => {
    repository.requests = [
      { ...record, deadlineAt: '2026-10-21T07:00:00.000Z' },
    ]
    expect((await service.listCurrent(member))[0]).toMatchObject({
      status: 'CLOSED',
      isOpen: false,
    })
  })

  it('retains the legacy lunch poll API', async () => {
    await service.create(parent, {
      mealDate: '2026-10-21',
      mealType: 'LUNCH',
      mode: 'OPTION_POLL',
      deadlineAt: '2026-10-21T12:00:00Z',
      parentMessage: ' Choose ',
      options: [' Rice ', 'Noodles'],
    })
    expect(repository.createdInputs).toEqual([
      {
        actorMemberId: parent.id,
        mealDate: '2026-10-21',
        mealType: 'LUNCH',
        mode: 'OPTION_POLL',
        deadlineAt: '2026-10-21T12:00:00.000Z',
        parentMessage: 'Choose',
        options: ['Rice', 'Noodles'],
      },
    ])
  })

  it('allows a parent to create an open-choice request', async () => {
    repository.requests = [{ ...record, mode: 'OPEN_CHOICE', options: [] }]
    await service.create(parent, {
      mealDate: '2026-10-21',
      mealType: 'LUNCH',
      mode: 'OPEN_CHOICE',
      deadlineAt: '2026-10-21T12:00:00Z',
    })
    expect(repository.createdInputs[0]).toMatchObject({
      mode: 'OPEN_CHOICE',
      options: [],
    })
  })

  it('creates self-service without a deadline or options', async () => {
    repository.requests = [
      {
        ...record,
        mode: null,
        status: 'SELF_SERVICE',
        deadlineAt: null,
        options: [],
      },
    ]
    await service.create(parent, {
      mealDate: '2026-10-21',
      mealType: 'LUNCH',
      mode: 'SELF_SERVICE',
    })
    expect(repository.createdInputs[0]).toMatchObject({
      mode: 'SELF_SERVICE',
      deadlineAt: null,
      options: [],
    })
  })

  it.each([
    [
      {
        mealDate: '2026-10-20',
        mealType: 'LUNCH',
        mode: 'OPEN_CHOICE',
        deadlineAt: '2026-10-21T12:00:00Z',
      },
      'past date',
    ],
    [
      {
        mealDate: '2026-10-21',
        mealType: 'LUNCH',
        mode: 'OPTION_POLL',
        deadlineAt: '2026-10-21T12:00:00Z',
        options: ['Only one'],
      },
      'too few poll options',
    ],
    [
      {
        mealDate: '2026-10-21',
        mealType: 'LUNCH',
        mode: 'OPTION_POLL',
        deadlineAt: '2026-10-21T12:00:00Z',
        options: ['Rice', ' rice '],
      },
      'duplicate options',
    ],
    [
      {
        mealDate: '2026-10-21',
        mealType: 'LUNCH',
        mode: 'OPEN_CHOICE',
        deadlineAt: '2026-10-21T07:00:00Z',
      },
      'past deadline',
    ],
    [
      {
        mealDate: '2026-10-21',
        mealType: 'BREAKFAST',
        mode: 'OPEN_CHOICE',
        deadlineAt: '2026-10-21T12:00:00Z',
      },
      'invalid meal type',
    ],
  ])('rejects invalid creation: %s (%s)', async (input) => {
    await expect(service.create(parent, input)).rejects.toBeInstanceOf(
      MealRequestValidationError,
    )
  })

  it.each([member, admin])(
    'does not let the $role role create a parent request',
    async (profile) => {
      await expect(service.create(profile, {})).rejects.toBeInstanceOf(
        MealRequestForbiddenError,
      )
    },
  )

  it('surfaces idempotency conflicts safely', async () => {
    repository.conflict = true
    await expect(
      service.create(parent, {
        mealDate: '2026-10-21',
        mealType: 'DINNER',
        mode: 'OPEN_CHOICE',
        deadlineAt: '2026-10-21T12:00:00Z',
      }),
    ).rejects.toBeInstanceOf(MealRequestConflictError)
  })

  it('saves an owned poll option selection', async () => {
    await service.saveResponse(member, requestId, {
      responseType: 'SELECTED_OPTION',
      optionId,
    })
    expect(repository.savedInputs).toEqual([
      {
        actorMemberId: member.id,
        requestId,
        responseType: 'SELECTED_OPTION',
        optionId,
        customText: null,
      },
    ])
  })

  it('updates the same member response before the deadline', async () => {
    await service.saveResponse(member, requestId, {
      responseType: 'SELECTED_OPTION',
      optionId,
    })
    await service.saveResponse(member, requestId, {
      responseType: 'NOT_EATING',
    })
    expect(repository.savedInputs).toHaveLength(2)
    expect(repository.savedInputs[1]).toMatchObject({
      actorMemberId: member.id,
      requestId,
      responseType: 'NOT_EATING',
    })
  })

  it('rejects a target member id instead of allowing another member write', async () => {
    await expect(
      service.saveResponse(member, requestId, {
        responseType: 'NOT_EATING',
        memberId: parent.id,
      }),
    ).rejects.toBeInstanceOf(MealRequestValidationError)
    expect(repository.savedInputs).toHaveLength(0)
  })

  it('saves custom text only for open choice', async () => {
    repository.requests = [{ ...record, mode: 'OPEN_CHOICE', options: [] }]
    await service.saveResponse(member, requestId, {
      responseType: 'CUSTOM',
      customText: ' Soup ',
    })
    expect(repository.savedInputs[0]).toMatchObject({
      actorMemberId: member.id,
      responseType: 'CUSTOM',
      customText: 'Soup',
    })
  })

  it('saves not eating distinctly from no response', async () => {
    await service.saveResponse(member, requestId, {
      responseType: 'NOT_EATING',
    })
    expect(repository.savedInputs[0]).toMatchObject({
      responseType: 'NOT_EATING',
      optionId: null,
      customText: null,
    })
  })

  it.each([
    { responseType: 'CUSTOM', customText: 'Soup', optionId },
    {
      responseType: 'SELECTED_OPTION',
      optionId: '77777777-7777-4777-8777-777777777777',
    },
    { responseType: 'NOT_EATING', customText: 'extra' },
  ])('rejects invalid response combinations', async (input) => {
    await expect(
      service.saveResponse(member, requestId, input),
    ).rejects.toBeInstanceOf(MealRequestValidationError)
  })

  it('rejects parent responses and responses after the deadline', async () => {
    await expect(
      service.saveResponse(parent, requestId, { responseType: 'NOT_EATING' }),
    ).rejects.toBeInstanceOf(MealRequestForbiddenError)
    repository.requests = [{ ...record, deadlineAt: '2026-10-21T07:00:00Z' }]
    await expect(
      service.saveResponse(member, requestId, { responseType: 'NOT_EATING' }),
    ).rejects.toBeInstanceOf(MealRequestClosedError)
  })

  it('lets a parent close an open request', async () => {
    await service.update(parent, requestId, {
      status: 'CLOSED',
      parentMessage: 'Closed',
    })
    expect(repository.updatedInputs).toEqual([
      {
        actorMemberId: parent.id,
        requestId,
        status: 'CLOSED',
        deadlineAt: record.deadlineAt,
        parentMessage: 'Closed',
      },
    ])
  })

  it('changes an existing self-service slot to open choice without creating another request', async () => {
    repository.requests = [
      {
        ...record,
        status: 'SELF_SERVICE',
        mode: null,
        deadlineAt: null,
        options: [],
      },
    ]

    const result = await service.update(parent, requestId, {
      status: 'OPEN',
      mode: 'OPEN_CHOICE',
      deadlineAt: '2026-10-21T12:00:00Z',
      parentMessage: ' New plan ',
      options: [],
    })

    expect(repository.createdInputs).toHaveLength(0)
    expect(repository.changedSelfServiceInputs).toEqual([
      {
        actorMemberId: parent.id,
        requestId,
        mode: 'OPEN_CHOICE',
        deadlineAt: '2026-10-21T12:00:00.000Z',
        parentMessage: 'New plan',
        options: [],
      },
    ])
    expect(result).toMatchObject({
      id: requestId,
      status: 'OPEN',
      mode: 'OPEN_CHOICE',
    })
  })

  it('changes an existing self-service slot to an option poll', async () => {
    repository.requests = [
      {
        ...record,
        status: 'SELF_SERVICE',
        mode: null,
        deadlineAt: null,
        options: [],
      },
    ]

    const result = await service.update(parent, requestId, {
      status: 'OPEN',
      mode: 'OPTION_POLL',
      deadlineAt: '2026-10-21T12:00:00Z',
      options: [' Rice ', 'Noodles'],
    })

    expect(repository.changedSelfServiceInputs[0]).toMatchObject({
      requestId,
      mode: 'OPTION_POLL',
      options: ['Rice', 'Noodles'],
    })
    expect(result).toMatchObject({
      id: requestId,
      status: 'OPEN',
      mode: 'OPTION_POLL',
    })
  })

  it('safely retries the same self-service plan change', async () => {
    repository.requests = [
      {
        ...record,
        status: 'SELF_SERVICE',
        mode: null,
        deadlineAt: null,
        options: [],
      },
    ]
    const input = {
      status: 'OPEN' as const,
      mode: 'OPEN_CHOICE' as const,
      deadlineAt: '2026-10-21T12:00:00Z',
      options: [],
    }

    await service.update(parent, requestId, input)
    await service.update(parent, requestId, input)

    expect(repository.changedSelfServiceInputs).toHaveLength(2)
    expect(repository.createdInputs).toHaveLength(0)
  })

  it.each([member, admin])(
    'does not let the $role role reverse self service',
    async (profile) => {
      repository.requests = [
        {
          ...record,
          status: 'SELF_SERVICE',
          mode: null,
          deadlineAt: null,
          options: [],
        },
      ]
      await expect(
        service.update(profile, requestId, {
          status: 'OPEN',
          mode: 'OPEN_CHOICE',
          deadlineAt: '2026-10-21T12:00:00Z',
          options: [],
        }),
      ).rejects.toBeInstanceOf(MealRequestForbiddenError)
      expect(repository.changedSelfServiceInputs).toHaveLength(0)
    },
  )
})
