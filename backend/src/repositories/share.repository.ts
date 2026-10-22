import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '../config/supabase.js'
import { ApiError } from '../errors/api-error.js'
import { studyId } from '../services/study.service.js'
import { validDate } from '../services/calendar.service.js'
import {
  ASSESSMENT_TYPES,
  assessmentPercentage,
} from '../services/study-assessment.js'
import type {
  ShareRepository,
  SharePerson,
  OwnerShares,
  ReceivedShare,
} from '../services/share.service.js'
export class SupabaseShareRepository implements ShareRepository {
  private client?: SupabaseClient
  constructor(private readonly factory = createSupabaseServerClient) {}
  private async rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await (this.client ??= this.factory()).rpc(
      name,
      args,
    )
    if (error) {
      const status =
        error.code === '42501'
          ? 403
          : error.code === 'P0002'
            ? 404
            : ['22023', '23514', '23502', '22P02', '23503'].includes(error.code)
              ? 400
              : 503
      throw new ApiError(
        status,
        status === 404
          ? 'SHARE_NOT_FOUND'
          : status === 400
            ? 'SHARE_INVALID'
            : 'SHARE_UNAVAILABLE',
        status === 404
          ? 'Record not found'
          : 'Sharing request could not be completed',
      )
    }
    return data as unknown
  }
  async owner(
    actor: string,
    type: string,
    resource: string,
  ): Promise<OwnerShares> {
    const v = await this.rpc('private_share_owner', {
      p_actor_member_id: actor,
      p_resource_type: type,
      p_resource_id: resource,
    })
    if (
      !object(v) ||
      !Array.isArray(v.recipients) ||
      v.recipients.length > 100 ||
      !Array.isArray(v.shares) ||
      v.shares.length > 100
    )
      bad()
    return {
      recipients: v.recipients.map(person),
      shares: v.shares.map((s) => {
        if (!object(s) || !timestamp(s.sharedAt)) bad()
        studyId(s.id)
        return {
          id: s.id,
          recipient: person(s.recipient),
          sharedAt: s.sharedAt,
        }
      }),
    }
  }
  async received(actor: string, page: number) {
    const v = await this.rpc('private_share_received', {
      p_actor_member_id: actor,
      p_page: page,
    })
    if (
      !object(v) ||
      !Array.isArray(v.records) ||
      v.records.length > 20 ||
      !Number.isSafeInteger(v.totalCount) ||
      (v.totalCount as number) < v.records.length
    )
      bad()
    return {
      records: v.records.map(received),
      totalCount: v.totalCount as number,
    }
  }
  async create(
    actor: string,
    type: string,
    resource: string,
    recipient: string,
  ) {
    const id = await this.rpc('private_share_create', {
      p_actor_member_id: actor,
      p_resource_type: type,
      p_resource_id: resource,
      p_recipient_member_id: recipient,
    })
    studyId(id)
    return id
  }
  async revoke(actor: string, id: string) {
    await this.rpc('private_share_revoke', {
      p_actor_member_id: actor,
      p_share_id: id,
    })
  }
}
function received(v: unknown): ReceivedShare {
  if (
    !object(v) ||
    v.resourceType !== 'STUDY_ASSESSMENT' ||
    !timestamp(v.sharedAt) ||
    !object(v.owner) ||
    !object(v.assessment)
  )
    bad()
  studyId(v.id)
  const a = v.assessment,
    o = v.owner
  if (
    !text(o.displayName, 100) ||
    !nullableText(o.avatarType) ||
    !nullableText(o.avatarValue) ||
    !text(a.courseName, 120) ||
    !text(a.title, 160) ||
    !ASSESSMENT_TYPES.includes(a.assessmentType as never) ||
    !decimal(a.score, 0) ||
    !decimal(a.maxScore, 0.0001) ||
    (a.score !== null &&
      (a.maxScore === null || (a.score as number) > (a.maxScore as number))) ||
    !(a.letterGrade === null || text(a.letterGrade, 20)) ||
    !(a.assessedAt === null || validDate(a.assessedAt))
  )
    bad()
  const score = a.score as number | null,
    maxScore = a.maxScore as number | null
  return {
    id: v.id,
    resourceType: 'STUDY_ASSESSMENT',
    sharedAt: v.sharedAt,
    owner: {
      displayName: o.displayName as string,
      avatarType: o.avatarType as string | null,
      avatarValue: o.avatarValue as string | null,
    },
    assessment: {
      courseName: a.courseName as string,
      title: a.title as string,
      assessmentType:
        a.assessmentType as ReceivedShare['assessment']['assessmentType'],
      score,
      maxScore,
      percentage: assessmentPercentage({ score, maxScore }),
      letterGrade: a.letterGrade as string | null,
      assessedAt: a.assessedAt as string | null,
    },
  }
}
function person(v: unknown): SharePerson {
  if (
    !object(v) ||
    !text(v.displayName, 100) ||
    !nullableText(v.avatarType) ||
    !nullableText(v.avatarValue)
  )
    bad()
  studyId(v.id)
  return {
    id: v.id,
    displayName: v.displayName as string,
    avatarType: v.avatarType as string | null,
    avatarValue: v.avatarValue as string | null,
  }
}
function object(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}
function text(v: unknown, max: number) {
  return (
    typeof v === 'string' && v.trim().length > 0 && Array.from(v).length <= max
  )
}
function nullableText(v: unknown) {
  return v === null || typeof v === 'string'
}
function timestamp(v: unknown): v is string {
  return typeof v === 'string' && Number.isFinite(Date.parse(v))
}
function decimal(v: unknown, min: number) {
  return (
    v === null ||
    (typeof v === 'number' &&
      Number.isFinite(v) &&
      v >= min &&
      v <= 1000000 &&
      Number(v.toFixed(4)) === v)
  )
}
function bad(): never {
  throw new Error('Invalid sharing storage response')
}
