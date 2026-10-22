import { ApiError } from '../errors/api-error.js'
import type { SafeFamilyProfile } from './family-auth.service.js'
import { studyId } from './study.service.js'
import type { AssessmentInput } from './study-assessment.js'
export interface SharePerson {
  id: string
  displayName: string
  avatarType: string | null
  avatarValue: string | null
}
export interface OwnerShares {
  recipients: SharePerson[]
  shares: { id: string; recipient: SharePerson; sharedAt: string }[]
}
export interface ReceivedShare {
  id: string
  resourceType: 'STUDY_ASSESSMENT'
  sharedAt: string
  owner: Omit<SharePerson, 'id'>
  assessment: {
    courseName: string
    title: string
    assessmentType: AssessmentInput['assessmentType']
    score: number | null
    maxScore: number | null
    percentage: number | null
    letterGrade: string | null
    assessedAt: string | null
  }
}
export interface ShareRepository {
  owner(actor: string, type: string, resource: string): Promise<OwnerShares>
  received(
    actor: string,
    page: number,
  ): Promise<{ records: ReceivedShare[]; totalCount: number }>
  create(
    actor: string,
    type: string,
    resource: string,
    recipient: string,
  ): Promise<string>
  revoke(actor: string, id: string): Promise<void>
}
export class ShareService {
  constructor(private readonly repository: ShareRepository) {}
  async owner(actor: SafeFamilyProfile, type: unknown, resource: unknown) {
    ownerRole(actor)
    resourceInput(type, resource)
    return this.run(() =>
      this.repository.owner(actor.id, type as string, resource as string),
    )
  }
  async received(actor: SafeFamilyProfile, page: unknown = undefined) {
    if (
      page !== undefined &&
      (typeof page !== 'string' ||
        !/^[1-9]\d{0,5}$/.test(page) ||
        Number(page) > 100000)
    )
      invalid()
    const p = page === undefined ? 1 : Number(page)
    const result = await this.run(() => this.repository.received(actor.id, p))
    return { ...result, page: p, hasMore: p * 20 < result.totalCount }
  }
  async create(actor: SafeFamilyProfile, v: unknown) {
    ownerRole(actor)
    if (v === null || typeof v !== 'object' || Array.isArray(v)) invalid()
    const input = v as Record<string, unknown>
    if (
      Object.keys(input).some(
        (k) => !['resourceType', 'resourceId', 'recipientMemberId'].includes(k),
      )
    )
      invalid()
    resourceInput(input.resourceType, input.resourceId)
    shareId(input.recipientMemberId)
    if (input.recipientMemberId === actor.id) invalid()
    return this.run(() =>
      this.repository.create(
        actor.id,
        input.resourceType as string,
        input.resourceId as string,
        input.recipientMemberId as string,
      ),
    )
  }
  async revoke(actor: SafeFamilyProfile, id: unknown) {
    ownerRole(actor)
    shareId(id)
    await this.run(() => this.repository.revoke(actor.id, id))
  }
  private async run<T>(op: () => Promise<T>) {
    try {
      return await op()
    } catch (e) {
      if (e instanceof ApiError) throw e
      throw new ApiError(
        503,
        'SHARE_UNAVAILABLE',
        'Sharing is temporarily unavailable',
      )
    }
  }
}
function ownerRole(actor: SafeFamilyProfile) {
  if (!['ADMIN', 'MEMBER'].includes(actor.role))
    throw new ApiError(
      403,
      'SHARE_FORBIDDEN',
      'Sharing management is not permitted',
    )
}
function resourceInput(type: unknown, id: unknown) {
  if (type !== 'STUDY_ASSESSMENT') invalid()
  shareId(id)
}
function shareId(id: unknown): asserts id is string {
  try {
    studyId(id)
  } catch {
    invalid()
  }
}
function invalid(): never {
  throw new ApiError(400, 'SHARE_INVALID', 'Invalid sharing request')
}
