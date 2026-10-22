import { describe, expect, it, vi } from 'vitest'
import {
  HouseholdDutyService,
  type HouseholdDutyRepository,
} from '../src/services/household-duty.service.js'
import type { SafeFamilyProfile } from '../src/services/family-auth.service.js'

const member: SafeFamilyProfile = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'MEMBER',
  displayName: 'Synthetic assignee',
  avatarType: null,
  avatarValue: null,
}
const parent = { ...member, role: 'PARENT' as const }
function setup() {
  const repository: HouseholdDutyRepository = {
    list: vi.fn(async () => ({ members: [], duties: [] })),
    saveWeek: vi.fn(async () => {}),
    duplicateWeek: vi.fn(async () => 3),
    cancel: vi.fn(async () => {}),
    complete: vi.fn(async () => {}),
  }
  return {
    repository,
    service: new HouseholdDutyService(
      repository,
      () => new Date('2099-05-04T12:00:00Z'),
    ),
  }
}
describe('combined daily household duties', () => {
  it.each(['MEMBER', 'ADMIN'] as const)(
    'denies %s schedule management',
    async (role) => {
      const { service, repository } = setup()
      const actor = { ...member, role }
      await expect(
        service.saveWeek(actor, {
          assignments: [{ date: '2099-05-04', memberId: member.id }],
        }),
      ).rejects.toMatchObject({ status: 403 })
      await expect(
        service.duplicateWeek(actor, { sourceWeek: '2099-05-04' }),
      ).rejects.toMatchObject({ status: 403 })
      await expect(service.cancel(actor, '2099-05-04')).rejects.toMatchObject({
        status: 403,
      })
      expect(repository.saveWeek).not.toHaveBeenCalled()
    },
  )
  it('saves an explicit week for parent with one assignee per day', async () => {
    const { service, repository } = setup()
    const assignments = [{ date: '2099-05-04', memberId: member.id }]
    await service.saveWeek(parent, { assignments })
    expect(repository.saveWeek).toHaveBeenCalledWith(parent.id, assignments)
  })
  it.each([
    { assignments: [] },
    { assignments: [{ date: '2099-02-30', memberId: member.id }] },
    { assignments: [{ date: '2099-05-04', memberId: 'other' }] },
    {
      assignments: [
        { date: '2099-05-04', memberId: member.id },
        { date: '2099-05-04', memberId: member.id },
      ],
    },
    {
      assignments: [
        { date: '2099-05-04', memberId: member.id },
        { date: '2099-05-11', memberId: member.id },
      ],
    },
    {
      assignments: [
        { date: '2099-05-04', memberId: member.id, completed: true },
      ],
    },
  ])('rejects unsafe/duplicate assignments', async (value) => {
    const { service, repository } = setup()
    await expect(service.saveWeek(parent, value)).rejects.toMatchObject({
      status: 400,
    })
    expect(repository.saveWeek).not.toHaveBeenCalled()
  })
  it('delegates today completion using authenticated identity only', async () => {
    const { service, repository } = setup()
    await service.complete(member, '2099-05-04')
    expect(repository.complete).toHaveBeenCalledWith(member.id, '2099-05-04')
  })
  it('reads a bounded recent duty window for derived consistency metrics', async () => {
    const { service, repository } = setup()
    await expect(service.recentCompletions(member, '2099-05-04', 7)).resolves.toEqual({ members: [], duties: [] })
    expect(repository.list).toHaveBeenCalledWith(member.id, '2099-04-28', '2099-05-04')
  })
  it.each(['2099-05-03', '2099-05-05'])(
    'rejects non-today completion %s',
    async (date) => {
      const { service, repository } = setup()
      await expect(service.complete(member, date)).rejects.toMatchObject({
        status: 409,
      })
      expect(repository.complete).not.toHaveBeenCalled()
    },
  )
  it('copies only the requested week for parent', async () => {
    const { service, repository } = setup()
    expect(
      await service.duplicateWeek(parent, { sourceWeek: '2099-05-04' }),
    ).toBe(3)
    expect(repository.duplicateWeek).toHaveBeenCalledWith(
      parent.id,
      '2099-05-04',
    )
  })
  it('hides storage internals', async () => {
    const { service, repository } = setup()
    vi.mocked(repository.complete).mockRejectedValue(
      new Error('private credential'),
    )
    await expect(service.complete(member, '2099-05-04')).rejects.toMatchObject({
      status: 503,
      code: 'DUTY_UNAVAILABLE',
    })
  })
})
