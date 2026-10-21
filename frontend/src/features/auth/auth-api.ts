export type FamilyMemberRole = 'ADMIN' | 'PARENT' | 'MEMBER'

export interface FamilyProfile {
  id: string
  displayName: string
  role: FamilyMemberRole
  avatarType: string | null
  avatarValue: string | null
}

export class AuthApiError extends Error {
  readonly status: number

  constructor(status: number) {
    super('Auth request failed')
    this.name = 'AuthApiError'
    this.status = status
  }
}

const requestHeaders = { Accept: 'application/json' }

export async function getCurrentProfile(): Promise<FamilyProfile | null> {
  const response = await fetch('/api/auth/me', {
    credentials: 'same-origin',
    headers: requestHeaders,
  })

  if (response.status === 401) {
    return null
  }

  if (!response.ok) {
    throw new AuthApiError(response.status)
  }

  const payload = await readJson(response)
  return readProfileProperty(payload)
}

export async function getFamilyProfiles(): Promise<FamilyProfile[]> {
  const response = await fetch('/api/auth/profiles', {
    credentials: 'same-origin',
    headers: requestHeaders,
  })

  if (!response.ok) {
    throw new AuthApiError(response.status)
  }

  const payload = await readJson(response)

  if (!isObject(payload) || !Array.isArray(payload.profiles)) {
    throw new AuthApiError(0)
  }

  return payload.profiles.map(readProfile)
}

export async function loginWithPin(
  memberId: string,
  pin: string,
): Promise<FamilyProfile> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      ...requestHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ memberId, pin }),
  })

  if (!response.ok) {
    throw new AuthApiError(response.status)
  }

  return readProfileProperty(await readJson(response))
}

export async function logout(): Promise<void> {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: requestHeaders,
  })

  if (!response.ok) {
    throw new AuthApiError(response.status)
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new AuthApiError(0)
  }
}

function readProfileProperty(payload: unknown): FamilyProfile {
  if (!isObject(payload)) {
    throw new AuthApiError(0)
  }

  return readProfile(payload.profile)
}

function readProfile(value: unknown): FamilyProfile {
  if (
    !isObject(value) ||
    typeof value.id !== 'string' ||
    typeof value.displayName !== 'string' ||
    !isFamilyMemberRole(value.role) ||
    !isNullableString(value.avatarType) ||
    !isNullableString(value.avatarValue)
  ) {
    throw new AuthApiError(0)
  }

  return {
    id: value.id,
    displayName: value.displayName,
    role: value.role,
    avatarType: value.avatarType,
    avatarValue: value.avatarValue,
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFamilyMemberRole(value: unknown): value is FamilyMemberRole {
  return value === 'ADMIN' || value === 'PARENT' || value === 'MEMBER'
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null
}
