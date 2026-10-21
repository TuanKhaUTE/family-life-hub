import type { SupabaseClient } from '@supabase/supabase-js'

import { createSupabaseServerClient } from '../config/supabase.js'
import {
  MealRequestConflictError,
  MealResponseResetRequiredError,
  type MealMember,
  type MealRequestRecord,
  type MealRequestRepository,
  type MealResponseRecord,
} from '../services/meal-request.service.js'
import type { FamilyMemberRole } from '../services/family-auth.service.js'
import { isFamilyDate } from '../time/family-calendar.js'

type ClientFactory = () => SupabaseClient
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const roles = new Set(['ADMIN', 'PARENT', 'MEMBER'])
const requestColumns =
  'id, meal_date, meal_type, mode, status, deadline_at, parent_message, created_at, updated_at, family_members!inner(id, display_name), meal_request_options(id, label, sort_order)'
const responseColumns =
  'id, meal_request_id, member_id, response_type, option_id, custom_text, created_at, updated_at, meal_request_options(id, label, meal_request_id)'

export class MealRequestDataError extends Error {}

export class SupabaseMealRequestRepository implements MealRequestRepository {
  async configureRequest(
    input: Parameters<MealRequestRepository['configureRequest']>[0],
  ): Promise<string> {
    const { data, error } = await this.getClient().rpc(
      'configure_meal_request',
      {
        p_actor_member_id: input.actorMemberId,
        p_request_id: input.requestId,
        p_status: input.status,
        p_mode: input.mode,
        p_deadline_at: input.deadlineAt,
        p_parent_message: input.parentMessage,
        p_options: input.options,
        p_confirm_response_reset: input.confirmResponseReset,
      },
    )
    if (error?.code === 'P2002')
      throw new MealResponseResetRequiredError(
        'Confirm removal of incompatible responses',
      )
    if (error?.code === 'P2001')
      throw new MealRequestConflictError(
        'A cooked meal already exists for this slot',
      )
    return rpcUuid(data, error)
  }
  private client?: SupabaseClient
  constructor(
    private readonly factory: ClientFactory = createSupabaseServerClient,
  ) {}

  async listCurrentRequests(fromDate: string): Promise<MealRequestRecord[]> {
    const { data, error } = await this.getClient()
      .from('meal_requests')
      .select(requestColumns)
      .gte('meal_date', fromDate)
      .order('meal_date')
      .order('meal_type')
    const rows: unknown = data
    if (error || !Array.isArray(rows) || !rows.every(isRequestRow))
      throw new MealRequestDataError()
    return rows.map(toRequest)
  }

  async listActiveMembers(): Promise<MealMember[]> {
    const { data, error } = await this.getClient()
      .from('family_members')
      .select('id, display_name, role, avatar_type, avatar_value, is_active')
      .eq('is_active', true)
      .order('display_name')
    if (error || !Array.isArray(data) || !data.every(isMemberRow))
      throw new MealRequestDataError()
    return data.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      role: row.role,
      avatarType: row.avatar_type,
      avatarValue: row.avatar_value,
    }))
  }

  async listResponses(
    requestIds: string[],
    memberIds: string[],
  ): Promise<MealResponseRecord[]> {
    if (!requestIds.length || !memberIds.length) return []
    const { data, error } = await this.getClient()
      .from('meal_responses')
      .select(responseColumns)
      .in('meal_request_id', requestIds)
      .in('member_id', memberIds)
      .order('member_id')
    const rows: unknown = data
    if (error || !Array.isArray(rows) || !rows.every(isResponseRow))
      throw new MealRequestDataError()
    return rows.map(toResponse)
  }

  async findRequest(id: string): Promise<MealRequestRecord | null> {
    const { data, error } = await this.getClient()
      .from('meal_requests')
      .select(requestColumns)
      .eq('id', id)
      .maybeSingle()
    if (error) throw new MealRequestDataError()
    if (data === null) return null
    if (!isRequestRow(data)) throw new MealRequestDataError()
    return toRequest(data)
  }

  async findResponse(id: string): Promise<MealResponseRecord | null> {
    const { data, error } = await this.getClient()
      .from('meal_responses')
      .select(responseColumns)
      .eq('id', id)
      .maybeSingle()
    if (error) throw new MealRequestDataError()
    if (data === null) return null
    if (!isResponseRow(data)) throw new MealRequestDataError()
    return toResponse(data)
  }

  async createRequest(
    input: Parameters<MealRequestRepository['createRequest']>[0],
  ): Promise<string> {
    const { data, error } = await this.getClient().rpc('create_meal_request', {
      p_actor_member_id: input.actorMemberId,
      p_meal_date: input.mealDate,
      p_meal_type: input.mealType,
      p_mode: input.mode,
      p_deadline_at: input.deadlineAt,
      p_parent_message: input.parentMessage,
      p_options: input.options,
    })
    if (error?.code === '23505')
      throw new MealRequestConflictError(
        'This meal already has a different request',
      )
    return rpcUuid(data, error)
  }

  async updateRequest(
    input: Parameters<MealRequestRepository['updateRequest']>[0],
  ): Promise<string> {
    const { data, error } = await this.getClient().rpc('update_meal_request', {
      p_actor_member_id: input.actorMemberId,
      p_request_id: input.requestId,
      p_status: input.status,
      p_deadline_at: input.deadlineAt,
      p_parent_message: input.parentMessage,
    })
    return rpcUuid(data, error)
  }

  async changeSelfServiceRequest(
    input: Parameters<MealRequestRepository['changeSelfServiceRequest']>[0],
  ): Promise<string> {
    const { data, error } = await this.getClient().rpc(
      'change_self_service_meal_request',
      {
        p_actor_member_id: input.actorMemberId,
        p_request_id: input.requestId,
        p_mode: input.mode,
        p_deadline_at: input.deadlineAt,
        p_parent_message: input.parentMessage,
        p_options: input.options,
      },
    )
    return rpcUuid(data, error)
  }

  async saveResponse(
    input: Parameters<MealRequestRepository['saveResponse']>[0],
  ): Promise<string> {
    const { data, error } = await this.getClient().rpc('save_meal_response', {
      p_actor_member_id: input.actorMemberId,
      p_request_id: input.requestId,
      p_response_type: input.responseType,
      p_option_id: input.optionId,
      p_custom_text: input.customText,
    })
    return rpcUuid(data, error)
  }

  private getClient() {
    this.client ??= this.factory()
    return this.client
  }
}

function rpcUuid(data: unknown, error: { code?: string } | null): string {
  if (error?.code === 'P2002')
    throw new MealResponseResetRequiredError(
      'Confirm removal of incompatible responses',
    )
  if (error?.code === 'P2001')
    throw new MealRequestConflictError(
      'A cooked meal already exists for this slot',
    )
  if (error || typeof data !== 'string' || !UUID.test(data))
    throw new MealRequestDataError()
  return data
}

function isRequestRow(value: unknown): value is RequestRow {
  if (
    !isObject(value) ||
    !isObject(value.family_members) ||
    !Array.isArray(value.meal_request_options)
  )
    return false
  return (
    typeof value.id === 'string' &&
    UUID.test(value.id) &&
    isFamilyDate(value.meal_date) &&
    (value.meal_type === 'LUNCH' || value.meal_type === 'DINNER') &&
    (value.mode === null ||
      value.mode === 'OPEN_CHOICE' ||
      value.mode === 'OPTION_POLL') &&
    (value.status === 'OPEN' ||
      value.status === 'CLOSED' ||
      value.status === 'SELF_SERVICE' ||
      value.status === 'CANCELLED') &&
    (value.deadline_at === null || isTimestamp(value.deadline_at)) &&
    (value.parent_message === null ||
      typeof value.parent_message === 'string') &&
    isTimestamp(value.created_at) &&
    isTimestamp(value.updated_at) &&
    typeof value.family_members.id === 'string' &&
    UUID.test(value.family_members.id) &&
    typeof value.family_members.display_name === 'string' &&
    value.meal_request_options.every(isOptionRow)
  )
}

function isResponseRow(value: unknown): value is ResponseRow {
  if (!isObject(value)) return false
  const common =
    typeof value.id === 'string' &&
    UUID.test(value.id) &&
    typeof value.meal_request_id === 'string' &&
    UUID.test(value.meal_request_id) &&
    typeof value.member_id === 'string' &&
    UUID.test(value.member_id) &&
    isTimestamp(value.created_at) &&
    isTimestamp(value.updated_at)
  if (!common) return false
  if (value.response_type === 'SELECTED_OPTION')
    return (
      typeof value.option_id === 'string' &&
      isObject(value.meal_request_options) &&
      value.meal_request_options.id === value.option_id &&
      value.meal_request_options.meal_request_id === value.meal_request_id &&
      typeof value.meal_request_options.label === 'string' &&
      value.custom_text === null
    )
  if (value.response_type === 'CUSTOM')
    return (
      value.option_id === null &&
      value.meal_request_options === null &&
      typeof value.custom_text === 'string'
    )
  return (
    value.response_type === 'NOT_EATING' &&
    value.option_id === null &&
    value.custom_text === null &&
    value.meal_request_options === null
  )
}

function isMemberRow(value: unknown): value is MemberRow {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    UUID.test(value.id) &&
    typeof value.display_name === 'string' &&
    typeof value.role === 'string' &&
    roles.has(value.role) &&
    ((value.avatar_type === null && value.avatar_value === null) ||
      (typeof value.avatar_type === 'string' &&
        typeof value.avatar_value === 'string')) &&
    value.is_active === true
  )
}
function isOptionRow(value: unknown): value is OptionRow {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    UUID.test(value.id) &&
    typeof value.label === 'string' &&
    Number.isInteger(value.sort_order)
  )
}
function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface OptionRow {
  id: string
  label: string
  sort_order: number
}
interface RequestRow {
  id: string
  meal_date: string
  meal_type: 'LUNCH' | 'DINNER'
  mode: 'OPEN_CHOICE' | 'OPTION_POLL' | null
  status: 'OPEN' | 'CLOSED' | 'SELF_SERVICE' | 'CANCELLED'
  deadline_at: string | null
  parent_message: string | null
  created_at: string
  updated_at: string
  family_members: { id: string; display_name: string }
  meal_request_options: OptionRow[]
}
interface ResponseRow {
  id: string
  meal_request_id: string
  member_id: string
  response_type: 'SELECTED_OPTION' | 'CUSTOM' | 'NOT_EATING'
  option_id: string | null
  custom_text: string | null
  created_at: string
  updated_at: string
  meal_request_options: {
    id: string
    label: string
    meal_request_id: string
  } | null
}
interface MemberRow {
  id: string
  display_name: string
  role: FamilyMemberRole
  avatar_type: string | null
  avatar_value: string | null
  is_active: true
}

function toRequest(row: RequestRow): MealRequestRecord {
  return {
    id: row.id,
    mealDate: row.meal_date,
    mealType: row.meal_type,
    mode: row.mode,
    status: row.status,
    deadlineAt: row.deadline_at,
    parentMessage: row.parent_message,
    createdBy: {
      id: row.family_members.id,
      displayName: row.family_members.display_name,
    },
    options: [...row.meal_request_options]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((option) => ({
        id: option.id,
        label: option.label,
        sortOrder: option.sort_order,
      })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
function toResponse(row: ResponseRow): MealResponseRecord {
  return {
    id: row.id,
    requestId: row.meal_request_id,
    memberId: row.member_id,
    responseType: row.response_type,
    option: row.meal_request_options
      ? {
          id: row.meal_request_options.id,
          label: row.meal_request_options.label,
        }
      : null,
    customText: row.custom_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
