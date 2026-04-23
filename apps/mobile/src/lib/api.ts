import { useAuthStore } from '../store/authStore'

const BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3333'

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown }

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = useAuthStore.getState().session?.access_token
  const { body, ...rest } = options

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    useAuthStore.getState().logout()
    throw new Error('Session expired')
  }

  const data = (await res.json()) as { error?: { code: string; message: string } } & T

  if (!res.ok) {
    throw new Error(data.error?.message ?? 'Request failed')
  }

  return data
}

export type Session = {
  access_token: string
  refresh_token: string
  expires_at?: number
}

export type UserRecord = {
  id: string
  email: string
  role: 'ATHLETE' | 'TRAINER' | 'ADMIN'
  isActive: boolean
  createdAt: string
  updatedAt: string
  profile: ProfileRecord | null
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
}

export type RegisterInput = { email: string; password: string; role: 'ATHLETE' | 'TRAINER' }
export type LoginInput = { email: string; password: string }

export type UpdateProfileInput = {
  name?: string
  birthDate?: string
  sex?: 'male' | 'female' | 'other'
  weightKg?: number
  heightCm?: number
  goal?: string
  experience?: string
  daysPerWeek?: number
  bio?: string
  cref?: string
  specialties?: string[]
  acceptingClients?: boolean
  trainerBio?: string
}

export const api = {
  auth: {
    register: (body: RegisterInput) =>
      request<{ user: UserRecord; session: Session }>('/api/v1/auth/register', { method: 'POST', body }),
    login: (body: LoginInput) =>
      request<{ user: UserRecord; session: Session }>('/api/v1/auth/login', { method: 'POST', body }),
    google: () =>
      request<{ url: string }>('/api/v1/auth/google', { method: 'POST' }),
    logout: () =>
      request<{ success: boolean }>('/api/v1/auth/logout', { method: 'POST' }),
    me: () =>
      request<{ user: UserRecord; isOnboarded: boolean }>('/api/v1/auth/me'),
  },
  profile: {
    update: (body: UpdateProfileInput) =>
      request<{ profile: ProfileRecord }>('/api/v1/profile', { method: 'PUT', body }),
    get: (userId: string) =>
      request<{ profile: ProfileRecord }>(`/api/v1/profile/${userId}`),
  },
}
