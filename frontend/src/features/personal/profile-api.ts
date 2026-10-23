import { readProfile, type FamilyProfile } from '../auth/auth-api'
export interface AvatarChoice {
  avatarType: string
  avatarValue: string
  label: string
}
export interface ProfileSettings {
  profile: FamilyProfile
  avatarChoices: AvatarChoice[]
}
export interface ProfileInput {
  displayName: string
  avatarType: string | null
  avatarValue: string | null
}
export interface PinInput {
  currentPin: string
  newPin: string
  confirmation: string
}
export class ProfileApiError extends Error {
  readonly status: number
  constructor(status: number) {
    super('Profile request failed')
    this.status = status
  }
}
async function request(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
) {
  const r = await fetch('/api/profile' + path, {
    method,
    signal,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!r.ok) throw new ProfileApiError(r.status)
  if (r.status === 204) return null
  return (await r.json()) as unknown
}
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v))
    throw new ProfileApiError(0)
  return v as Record<string, unknown>
}
export async function fetchSettings(
  signal?: AbortSignal,
): Promise<ProfileSettings> {
  const d = object(
    object(await request('/me', 'GET', undefined, signal)).settings,
  )
  if (!Array.isArray(d.avatarChoices)) throw new ProfileApiError(0)
  return {
    profile: readProfile(d.profile),
    avatarChoices: d.avatarChoices.map((a) => {
      const v = object(a)
      if (
        v.avatarType !== 'EMOJI' ||
        typeof v.avatarValue !== 'string' ||
        typeof v.label !== 'string'
      )
        throw new ProfileApiError(0)
      return {
        avatarType: v.avatarType,
        avatarValue: v.avatarValue,
        label: v.label,
      }
    }),
  }
}
export async function saveProfile(input: ProfileInput) {
  return readProfile(object(await request('/me', 'PUT', input)).profile)
}
export async function uploadAvatar(blob: Blob) {
  const response = await fetch('/api/profile/me/avatar', {
    method: 'PUT',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'image/webp',
    },
    body: blob,
  })
  if (!response.ok) throw new ProfileApiError(response.status)
  return readProfile(object(await response.json()).profile)
}
export async function changePin(input: PinInput) {
  await request('/me/pin', 'POST', input)
}
export async function resetMembers(signal?: AbortSignal) {
  const d = object(await request('/members', 'GET', undefined, signal))
  if (!Array.isArray(d.members)) throw new ProfileApiError(0)
  return d.members.map(readProfile)
}
export async function resetPin(
  id: string,
  input: PinInput & { confirmReset: true },
) {
  await request(
    '/members/' + encodeURIComponent(id) + '/pin-reset',
    'POST',
    input,
  )
}
export function profileError(e: unknown) {
  return e instanceof ProfileApiError && e.status === 401
    ? 'Chưa thể xác minh mã PIN hiện tại hoặc phiên đã hết hạn. Nếu vừa thử sai nhiều lần, hãy chờ 15 phút rồi thử lại.'
    : 'Hiện chưa thể lưu thay đổi. Vui lòng thử lại; nếu vừa đổi PIN, hãy đăng nhập lại bằng mã mới.'
}
export function avatarError(e: unknown) {
  if (e instanceof ProfileApiError && e.status === 413)
    return 'Ảnh đại diện cần nhỏ hơn 5 MB. Vui lòng chọn ảnh khác.'
  if (e instanceof ProfileApiError && e.status === 400)
    return 'Ảnh đại diện không hợp lệ. Vui lòng chọn ảnh JPEG, PNG hoặc WebP.'
  return 'Chưa thể lưu ảnh đại diện. Vui lòng thử lại.'
}
