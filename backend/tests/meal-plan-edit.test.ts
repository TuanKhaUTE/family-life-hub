import { describe, expect, it, vi } from 'vitest'
import {
  MealRequestService,
  type MealRequestRepository,
} from '../src/services/meal-request.service.js'
const id = '11111111-1111-4111-8111-111111111111'
const parent = {
  id,
  role: 'PARENT' as const,
  displayName: 'Synthetic Parent',
  avatarType: null,
  avatarValue: null,
}
function setup(status = 'OPEN') {
  const repository = {
    findRequest: vi
      .fn()
      .mockResolvedValue({
        id,
        mealDate: '2099-06-01',
        mealType: 'DINNER',
        mode: 'OPEN_CHOICE',
        status,
        deadlineAt: '2099-06-01T12:00:00Z',
        parentMessage: null,
        options: [],
        createdBy: { id, displayName: 'Synthetic Parent' },
      }),
    configureRequest: vi.fn().mockResolvedValue(id),
    listActiveMembers: vi.fn().mockResolvedValue([]),
    listResponses: vi.fn().mockResolvedValue([]),
  }
  return {
    repository,
    service: new MealRequestService(
      repository as unknown as MealRequestRepository,
    ),
  }
}
describe('whole meal plan editing', () => {
  it.each(['OPEN_CHOICE', 'OPTION_POLL', 'SELF_SERVICE'])(
    'reconfigures the same row to %s',
    async (mode) => {
      const { service, repository } = setup()
      await service.update(parent, id, {
        status: mode === 'SELF_SERVICE' ? 'SELF_SERVICE' : 'OPEN',
        mode,
        deadlineAt: mode === 'SELF_SERVICE' ? null : '2099-06-01T12:00:00Z',
        options: mode === 'OPTION_POLL' ? ['Cơm', 'Bún'] : [],
        confirmResponseReset: true,
      })
      expect(repository.configureRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: id,
          mode,
          confirmResponseReset: true,
        }),
      )
    },
  )
  it.each(['ADMIN', 'MEMBER'])(
    'denies %s editing and cancellation',
    async (role) => {
      const { service, repository } = setup()
      await expect(
        service.update({ ...parent, role: role as 'ADMIN' | 'MEMBER' }, id, {
          status: 'CANCELLED',
        }),
      ).rejects.toThrow()
      expect(repository.configureRequest).not.toHaveBeenCalled()
    },
  )
  it('cancels without deleting the request and permits explicit cancelled-slot reconfiguration', async () => {
    const { service, repository } = setup('CANCELLED')
    await service.update(parent, id, { status: 'CANCELLED' })
    await service.update(parent, id, {
      status: 'OPEN',
      mode: 'OPEN_CHOICE',
      deadlineAt: '2099-06-01T12:00:00Z',
      options: [],
    })
    expect(repository.configureRequest).toHaveBeenCalledTimes(2)
  })
  it('rejects responses to a cancelled request', async () => {
    await expect(
      setup('CANCELLED').service.saveResponse(
        { ...parent, role: 'MEMBER' },
        id,
        { responseType: 'NOT_EATING' },
      ),
    ).rejects.toThrow('closed')
  })
  it('does not treat expiry as cancellation', async () => {
    const { service, repository } = setup()
    repository.findRequest.mockResolvedValueOnce({
      ...(await repository.findRequest()),
      deadlineAt: '2000-01-01T00:00:00Z',
    })
    await expect(
      service.saveResponse({ ...parent, role: 'MEMBER' }, id, {
        responseType: 'NOT_EATING',
      }),
    ).rejects.toThrow('closed')
    expect(repository.configureRequest).not.toHaveBeenCalled()
  })
})
