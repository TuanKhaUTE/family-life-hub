import { describe, expect, it, vi } from 'vitest'
import { ActivityPlanService, type ActivityPlanRepository } from '../src/services/activity-plan.service.js'
import type { SafeFamilyProfile } from '../src/services/family-auth.service.js'
const actor: SafeFamilyProfile = { id: '11111111-1111-4111-8111-111111111111', role: 'MEMBER', displayName: 'Synthetic activity owner', avatarType: null, avatarValue: null }
const input = { requestId: actor.id, title: 'Nội dung tự chọn', startsAt: '2026-03-02T12:00:00Z', endsAt: '2026-03-02T14:00:00Z', courseId: null, note: null }
function setup() {
  const repository: ActivityPlanRepository = { read: vi.fn(async () => ({ plans: [], facts: [], schedule: [] })), save: vi.fn(async () => actor.id), complete: vi.fn(async () => {}), cancel: vi.fn(async () => {}) }
  return { repository, service: new ActivityPlanService(repository, () => new Date('2026-03-02T15:00Z')) }
}
describe('private Study/Fitness planned session service', () => {
  it.each(['STUDY', 'FITNESS'] as const)('%s planning creates no completed progress', async kind => {
    const { service, repository } = setup()
    expect(await service.save(actor, kind, null, input)).toBe(actor.id)
    const result = await service.read(actor, kind)
    expect(result.progress.today.minutes).toBe(0)
    expect(result.progress.week.sessions).toBe(0)
    expect(repository.save).toHaveBeenCalledWith(actor.id, kind, null, input)
  })
  it.each(['read', 'save', 'complete', 'cancel'] as const)('parent cannot %s private activity data', async action => {
    const { service } = setup(), parent = { ...actor, role: 'PARENT' as const }
    const promise = action === 'read' ? service.read(parent, 'STUDY') : action === 'save' ? service.save(parent, 'STUDY', null, input) : action === 'complete' ? service.complete(parent, actor.id, { durationMinutes: 90, note: null }, false) : service.cancel(parent, actor.id)
    await expect(promise).rejects.toMatchObject({ status: 403 })
  })
  it.each([0, -1, 1441, 1.5, '90'])('rejects unsafe actual duration %s', async durationMinutes => {
    await expect(setup().service.complete(actor, actor.id, { durationMinutes, note: null }, false)).rejects.toMatchObject({ status: 400 })
  })
  it('distinguishes idempotent completion from an explicit actual-duration correction', async () => {
    const { service, repository } = setup()
    await service.complete(actor, actor.id, { durationMinutes: 90, note: 'Đã học xong' }, false)
    await service.complete(actor, actor.id, { durationMinutes: 100, note: null }, true)
    expect(repository.complete).toHaveBeenNthCalledWith(1, actor.id, actor.id, { durationMinutes: 90, note: 'Đã học xong' }, false)
    expect(repository.complete).toHaveBeenNthCalledWith(2, actor.id, actor.id, { durationMinutes: 100, note: null }, true)
  })
  it.each([{ ...input, ownerMemberId: actor.id }, { ...input, calendarType: 'FAMILY' }, { ...input, endsAt: input.startsAt }, { ...input, title: ' ' }, { ...input, courseId: 'foreign' }])('rejects invalid plan/ownership input', async value => {
    await expect(setup().service.save(actor, 'STUDY', null, value)).rejects.toMatchObject({ status: 400 })
  })
})
