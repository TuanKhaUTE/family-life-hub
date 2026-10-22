import { ASSESSMENT_TYPES, type AssessmentInput } from '../study/grades-api'
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
export interface SharedAssessment {
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
export interface ReceivedSharesView {
  records: SharedAssessment[]
  page: number
  totalCount: number
  hasMore: boolean
}
async function request(path: string, init: RequestInit = {}) {
  const r = await fetch('/api/shares' + path, {
    ...init,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (!r.ok) throw new Error('Sharing request unavailable')
  return r.status === 204 ? null : ((await r.json()) as unknown)
}
export async function fetchOwnerShares(
  resourceId: string,
  signal: AbortSignal,
): Promise<OwnerShares> {
  const b = await request(
    '?' + new URLSearchParams({ resourceType: 'STUDY_ASSESSMENT', resourceId }),
    { signal },
  )
  if (
    !object(b) ||
    !object(b.sharing) ||
    !Array.isArray(b.sharing.recipients) ||
    b.sharing.recipients.length > 100 ||
    !Array.isArray(b.sharing.shares) ||
    b.sharing.shares.length > 100
  )
    invalid()
  return {
    recipients: b.sharing.recipients.map(person),
    shares: b.sharing.shares.map((s) => {
      if (!object(s) || !uuid(s.id) || !timestamp(s.sharedAt)) invalid()
      return { id: s.id, recipient: person(s.recipient), sharedAt: s.sharedAt }
    }),
  }
}
export async function createShare(
  resourceId: string,
  recipientMemberId: string,
) {
  await request('', {
    method: 'POST',
    body: JSON.stringify({
      resourceType: 'STUDY_ASSESSMENT',
      resourceId,
      recipientMemberId,
    }),
  })
}
export async function revokeShare(id: string) {
  await request('/' + encodeURIComponent(id), { method: 'DELETE' })
}
export async function fetchReceivedShares(
  page: number,
  signal: AbortSignal,
): Promise<ReceivedSharesView> {
  const b = await request('/received?page=' + page, { signal })
  if (!object(b) || !object(b.received)) invalid()
  const v = b.received
  if (
    !Array.isArray(v.records) ||
    v.records.length > 20 ||
    v.page !== page ||
    !Number.isSafeInteger(v.totalCount) ||
    (v.totalCount as number) < v.records.length ||
    v.hasMore !== page * 20 < (v.totalCount as number)
  )
    invalid()
  return {
    records: v.records.map(sharedAssessment),
    page,
    totalCount: v.totalCount as number,
    hasMore: v.hasMore as boolean,
  }
}
function sharedAssessment(v: unknown): SharedAssessment {
  if (
    !object(v) ||
    !uuid(v.id) ||
    v.resourceType !== 'STUDY_ASSESSMENT' ||
    !timestamp(v.sharedAt) ||
    !object(v.owner) ||
    !object(v.assessment)
  )
    invalid()
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
    !(a.assessedAt === null || date(a.assessedAt))
  )
    invalid()
  const score = a.score as number | null,
    maxScore = a.maxScore as number | null,
    percentage =
      score === null || maxScore === null
        ? null
        : Math.round(((score / maxScore) * 100 + Number.EPSILON) * 100) / 100
  if (a.percentage !== percentage) invalid()
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
      assessmentType: a.assessmentType as AssessmentInput['assessmentType'],
      score,
      maxScore,
      percentage,
      letterGrade: a.letterGrade as string | null,
      assessedAt: a.assessedAt as string | null,
    },
  }
}
function person(v: unknown): SharePerson {
  if (
    !object(v) ||
    !uuid(v.id) ||
    !text(v.displayName, 100) ||
    !nullableText(v.avatarType) ||
    !nullableText(v.avatarValue)
  )
    invalid()
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
function uuid(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v,
    )
  )
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
function date(v: unknown) {
  if (typeof v !== 'string' || !/^(20|21)\d\d-\d{2}-\d{2}$/.test(v))
    return false
  const d = new Date(v + 'T12:00:00Z')
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v
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
function invalid(): never {
  throw new Error('Invalid sharing response')
}
