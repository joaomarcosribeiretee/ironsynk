import { useAuthStore } from '../store/authStore'

export const BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3333'

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown }
type ApiErrorBody = { error?: { code?: string; message?: string; details?: string[] } }

export class ApiError extends Error {
  code?: string
  status: number
  details?: string[]

  constructor(message: string, status: number, code?: string, details?: string[]) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

async function request<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const token = useAuthStore.getState().session?.access_token
  const { body, ...rest } = options
  const isAuthPublic =
    path === '/api/v1/auth/login' ||
    path === '/api/v1/auth/register' ||
    path === '/api/v1/auth/refresh'

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && !isAuthPublic && token && !retried) {
    const refreshed = await useAuthStore.getState().refreshSession()
    if (refreshed) {
      return request<T>(path, options, true)
    }
    useAuthStore.getState().logout()
    throw new ApiError('Sessao expirada', 401, 'UNAUTHORIZED')
  }

  const data = (await res.json().catch(() => ({}))) as ApiErrorBody & T

  if (!res.ok) {
    throw new ApiError(
      data.error?.message ?? 'Falha na requisicao',
      res.status,
      data.error?.code,
      data.error?.details,
    )
  }

  return data
}

export type Session = {
  access_token: string
  refresh_token: string
  expires_at?: number
}

export type TrainerProfileRecord = {
  id: string
  userId: string
  cref: string | null
  specialties: string[]
  acceptingClients: boolean
  bio: string | null
}

export type UserRecord = {
  id: string
  email: string
  role: 'ATHLETE' | 'TRAINER' | 'ADMIN'
  isActive: boolean
  createdAt: string
  updatedAt: string
  profile: ProfileRecord | null
  trainerProfile?: TrainerProfileRecord | null
}

export type ProfileRecord = {
  id: string
  userId: string
  name: string
  avatar: string | null
  bio: string | null
  birthDate: string | null
  sex: 'male' | 'female' | 'other' | null
  weightKg: number | null
  heightCm: number | null
  goal: string | null
  experience: string | null
  daysPerWeek: number | null
  isPrivate: boolean
  gymName: string | null
}

export type RegisterInput = { username?: string; email: string; password: string; role: 'ATHLETE' | 'TRAINER' }
export type LoginInput = { email: string; password: string }

export type UpdateProfileInput = {
  isOnboarding?: boolean
  name?: string
  birthDate?: string
  sex?: 'male' | 'female' | 'other'
  weightKg?: number
  heightCm?: number
  goal?: string
  experience?: string
  daysPerWeek?: number
  isPrivate?: boolean
  gymName?: string
  bio?: string
  cref?: string
  specialties?: string[]
  acceptingClients?: boolean
  trainerBio?: string
}

export const api = {
  auth: {
    register: (body: RegisterInput) =>
      request<{ data: { user: UserRecord; session: Session; isOnboarded: boolean } }>('/api/v1/auth/register', { method: 'POST', body }),
    login: (body: LoginInput) =>
      request<{ data: { user: UserRecord; session: Session; isOnboarded: boolean } }>('/api/v1/auth/login', { method: 'POST', body }),
    logout: () =>
      request<{ data: { success: boolean } }>('/api/v1/auth/logout', { method: 'POST' }),
    me: () =>
      request<{ data: { user: UserRecord; isOnboarded: boolean } }>('/api/v1/auth/me'),
  },
  profile: {
    update: (body: UpdateProfileInput) =>
      request<{ data: { profile: ProfileRecord } }>('/api/v1/profile', { method: 'PUT', body }),
    uploadAvatar: async (formData: FormData): Promise<{ data: { avatarUrl: string } }> => {
      const token = useAuthStore.getState().session?.access_token
      const res = await fetch(`${BASE_URL}/api/v1/profile/avatar`, {
        method: 'PUT',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      const json = (await res.json().catch(() => ({}))) as ApiErrorBody & { data: { avatarUrl: string } }
      if (!res.ok) {
        throw new ApiError(json.error?.message ?? 'Falha no upload', res.status, json.error?.code)
      }
      return json
    },
    get: (userId: string) =>
      request<{ data: { id: string; role: string; profile: ProfileRecord } }>(`/api/v1/profile/${userId}`),
  },
}
