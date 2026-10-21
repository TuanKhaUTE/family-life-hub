import type { SupabaseClient } from '@supabase/supabase-js'

import { createSupabaseServerClient } from '../config/supabase.js'
import type {
  BreakfastCatalogItem,
  BreakfastMember,
  BreakfastPurchaseRecord,
  BreakfastRepository,
  BreakfastSelectionRecord,
  PersistedBreakfastState,
  UpsertBreakfastSelection,
  ConfirmBreakfastPurchase,
} from '../services/breakfast.service.js'
import type { FamilyMemberRole } from '../services/family-auth.service.js'
import { isBreakfastDate } from '../time/family-calendar.js'

interface CatalogRow {
  dish_id: string
  display_order: number
  is_active: true
  dishes: {
    id: string
    name: string
    is_active: true
  }
}

interface MemberRow {
  id: string
  display_name: string
  role: FamilyMemberRole
  avatar_type: string | null
  avatar_value: string | null
  is_active: true
}

interface SelectionRow {
  member_id: string
  breakfast_date: string
  selection_type: PersistedBreakfastState
  dish_id: string | null
  custom_dish_name: string | null
  created_at: string
  updated_at: string
  dishes: { id: string; name: string } | null
}

interface PurchaseRow {
  id: string
  breakfast_date: string
  confirmed_by_member_id: string
  message: string | null
  purchased_at: string
  created_at: string
  updated_at: string
  family_members: { id: string; display_name: string }
}

interface PurchaseRpcRow {
  id: string
  breakfast_date: string
  confirmed_by_member_id: string
  confirmed_by_display_name: string
  message: string | null
  purchased_at: string
  created_at: string
  updated_at: string
}

type SupabaseClientFactory = () => SupabaseClient

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MEMBER_ROLES = new Set<string>(['ADMIN', 'PARENT', 'MEMBER'])
const CATALOG_COLUMNS =
  'dish_id, display_order, is_active, dishes!inner(id, name, is_active)'
const MEMBER_COLUMNS =
  'id, display_name, role, avatar_type, avatar_value, is_active'
const SELECTION_COLUMNS =
  'member_id, breakfast_date, selection_type, dish_id, custom_dish_name, created_at, updated_at, dishes(id, name)'
const PURCHASE_COLUMNS =
  'id, breakfast_date, confirmed_by_member_id, message, purchased_at, created_at, updated_at, family_members!inner(id, display_name)'

export class BreakfastDataError extends Error {
  constructor() {
    super('Unable to access breakfast information')
    this.name = 'BreakfastDataError'
  }
}

export class SupabaseBreakfastRepository implements BreakfastRepository {
  private client?: SupabaseClient
  private readonly clientFactory: SupabaseClientFactory

  constructor(
    clientFactory: SupabaseClientFactory = createSupabaseServerClient,
  ) {
    this.clientFactory = clientFactory
  }

  async listActiveCatalog(): Promise<BreakfastCatalogItem[]> {
    const { data, error } = await this.getClient()
      .from('breakfast_catalog')
      .select(CATALOG_COLUMNS)
      .eq('is_active', true)
      .eq('dishes.is_active', true)
      .order('display_order', { ascending: true })

    const rows: unknown = data
    if (error || !Array.isArray(rows) || !rows.every(isCatalogRow)) {
      throw new BreakfastDataError()
    }

    return rows.map(toCatalogItem)
  }

  async listActiveMembers(): Promise<BreakfastMember[]> {
    const { data, error } = await this.getClient()
      .from('family_members')
      .select(MEMBER_COLUMNS)
      .eq('is_active', true)
      .order('display_name', { ascending: true })

    if (error || !Array.isArray(data) || !data.every(isMemberRow)) {
      throw new BreakfastDataError()
    }

    return data.map(toBreakfastMember)
  }

  async listSelections(
    date: string,
    memberIds: string[],
  ): Promise<BreakfastSelectionRecord[]> {
    if (memberIds.length === 0) {
      return []
    }

    const { data, error } = await this.getClient()
      .from('breakfast_selections')
      .select(SELECTION_COLUMNS)
      .eq('breakfast_date', date)
      .in('member_id', memberIds)
      .order('member_id', { ascending: true })

    const rows: unknown = data
    if (error || !Array.isArray(rows) || !rows.every(isSelectionRow)) {
      throw new BreakfastDataError()
    }

    return rows.map(toSelectionRecord)
  }

  async findActiveCatalogItem(
    id: string,
  ): Promise<BreakfastCatalogItem | null> {
    const { data, error } = await this.getClient()
      .from('breakfast_catalog')
      .select(CATALOG_COLUMNS)
      .eq('dish_id', id)
      .eq('is_active', true)
      .eq('dishes.is_active', true)
      .maybeSingle()

    if (error) {
      throw new BreakfastDataError()
    }

    if (data === null) {
      return null
    }

    if (!isCatalogRow(data)) {
      throw new BreakfastDataError()
    }

    return toCatalogItem(data)
  }

  async findPurchase(date: string): Promise<BreakfastPurchaseRecord | null> {
    const { data, error } = await this.getClient()
      .from('breakfast_purchases')
      .select(PURCHASE_COLUMNS)
      .eq('breakfast_date', date)
      .maybeSingle()

    if (error) throw new BreakfastDataError()
    if (data === null) return null
    if (!isPurchaseRow(data)) throw new BreakfastDataError()

    return toPurchaseRecord(data, data.family_members.display_name)
  }

  async confirmPurchase(
    input: ConfirmBreakfastPurchase,
  ): Promise<BreakfastPurchaseRecord> {
    const { data, error } = await this.getClient().rpc(
      'confirm_breakfast_purchase',
      {
        p_actor_member_id: input.actorMemberId,
        p_breakfast_date: input.breakfastDate,
        p_message: input.message,
      },
    )
    const rows: unknown = data

    if (
      error ||
      !Array.isArray(rows) ||
      rows.length !== 1 ||
      !isPurchaseRpcRow(rows[0])
    ) {
      throw new BreakfastDataError()
    }

    const row = rows[0]
    return toPurchaseRecord(row, row.confirmed_by_display_name)
  }

  async upsertSelection(
    input: UpsertBreakfastSelection,
  ): Promise<BreakfastSelectionRecord> {
    const { data, error } = await this.getClient()
      .from('breakfast_selections')
      .upsert(
        {
          member_id: input.memberId,
          breakfast_date: input.breakfastDate,
          selection_type: input.state,
          dish_id: input.dishId,
          custom_dish_name: input.customText,
        },
        { onConflict: 'member_id,breakfast_date' },
      )
      .select(SELECTION_COLUMNS)
      .single()

    if (error || !isSelectionRow(data)) {
      throw new BreakfastDataError()
    }

    return toSelectionRecord(data)
  }

  private getClient(): SupabaseClient {
    this.client ??= this.clientFactory()
    return this.client
  }
}

function isCatalogRow(value: unknown): value is CatalogRow {
  if (!isObject(value) || !isObject(value.dishes)) return false

  return (
    typeof value.dish_id === 'string' &&
    UUID_PATTERN.test(value.dish_id) &&
    Number.isInteger(value.display_order) &&
    Number(value.display_order) > 0 &&
    value.is_active === true &&
    value.dishes.id === value.dish_id &&
    typeof value.dishes.name === 'string' &&
    value.dishes.name.trim().length > 0 &&
    value.dishes.is_active === true
  )
}

function isMemberRow(value: unknown): value is MemberRow {
  if (!isObject(value)) return false

  const validAvatar =
    (value.avatar_type === null && value.avatar_value === null) ||
    (typeof value.avatar_type === 'string' &&
      typeof value.avatar_value === 'string')

  return (
    typeof value.id === 'string' &&
    UUID_PATTERN.test(value.id) &&
    typeof value.display_name === 'string' &&
    typeof value.role === 'string' &&
    MEMBER_ROLES.has(value.role) &&
    validAvatar &&
    value.is_active === true
  )
}

function isSelectionRow(value: unknown): value is SelectionRow {
  if (!isObject(value)) return false

  const commonFieldsAreValid =
    typeof value.member_id === 'string' &&
    UUID_PATTERN.test(value.member_id) &&
    isBreakfastDate(value.breakfast_date) &&
    isIsoTimestamp(value.created_at) &&
    isIsoTimestamp(value.updated_at)

  if (!commonFieldsAreValid) return false

  if (value.selection_type === 'SELECTED') {
    return (
      typeof value.dish_id === 'string' &&
      UUID_PATTERN.test(value.dish_id) &&
      value.custom_dish_name === null &&
      isObject(value.dishes) &&
      value.dishes.id === value.dish_id &&
      typeof value.dishes.name === 'string' &&
      value.dishes.name.trim().length > 0
    )
  }

  if (value.selection_type === 'CUSTOM') {
    return (
      value.dish_id === null &&
      value.dishes === null &&
      typeof value.custom_dish_name === 'string' &&
      value.custom_dish_name === value.custom_dish_name.trim() &&
      value.custom_dish_name.length >= 1 &&
      value.custom_dish_name.length <= 120
    )
  }

  return (
    value.selection_type === 'NOT_EATING' &&
    value.dish_id === null &&
    value.custom_dish_name === null &&
    value.dishes === null
  )
}

function hasPurchaseFields(value: Record<string, unknown>): boolean {
  return (
    typeof value.id === 'string' &&
    UUID_PATTERN.test(value.id) &&
    isBreakfastDate(value.breakfast_date) &&
    typeof value.confirmed_by_member_id === 'string' &&
    UUID_PATTERN.test(value.confirmed_by_member_id) &&
    (value.message === null ||
      (typeof value.message === 'string' &&
        value.message === value.message.trim() &&
        value.message.length >= 1 &&
        value.message.length <= 300)) &&
    isIsoTimestamp(value.purchased_at) &&
    isIsoTimestamp(value.created_at) &&
    isIsoTimestamp(value.updated_at)
  )
}

function isPurchaseRow(value: unknown): value is PurchaseRow {
  if (!isObject(value) || !hasPurchaseFields(value) || !isObject(value.family_members)) {
    return false
  }
  return (
    value.family_members.id === value.confirmed_by_member_id &&
    typeof value.family_members.display_name === 'string' &&
    value.family_members.display_name.trim().length > 0
  )
}

function isPurchaseRpcRow(value: unknown): value is PurchaseRpcRow {
  return (
    isObject(value) &&
    hasPurchaseFields(value) &&
    typeof value.confirmed_by_display_name === 'string' &&
    value.confirmed_by_display_name.trim().length > 0
  )
}

function toCatalogItem(row: CatalogRow): BreakfastCatalogItem {
  return {
    id: row.dish_id,
    name: row.dishes.name,
    displayOrder: row.display_order,
  }
}

function toBreakfastMember(row: MemberRow): BreakfastMember {
  return {
    id: row.id,
    displayName: row.display_name,
    role: row.role,
    avatarType: row.avatar_type,
    avatarValue: row.avatar_value,
  }
}

function toSelectionRecord(row: SelectionRow): BreakfastSelectionRecord {
  return {
    memberId: row.member_id,
    breakfastDate: row.breakfast_date,
    state: row.selection_type,
    catalogItem:
      row.dishes === null
        ? null
        : { id: row.dishes.id, name: row.dishes.name },
    customText: row.custom_dish_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toPurchaseRecord(
  row: PurchaseRow | PurchaseRpcRow,
  confirmerDisplayName: string,
): BreakfastPurchaseRecord {
  return {
    id: row.id,
    breakfastDate: row.breakfast_date,
    confirmedBy: {
      id: row.confirmed_by_member_id,
      displayName: confirmerDisplayName,
    },
    message: row.message,
    purchasedAt: row.purchased_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}
