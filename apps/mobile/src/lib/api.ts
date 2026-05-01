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

// DEBUG — remove before launch
export type ExerciseRecord = {
  id: string
  name: string
  muscleGroup: string
  equipment: string | null
  sourceId: string | null
  gifUrl: string | null
  videoUrl: string | null
}

export type UpdateExerciseInput = {
  name?: string
  muscleGroup?: string
  equipment?: string | null
  gifUrl?: string | null
  videoUrl?: string | null
}

export type TrainingGoal = 'HYPERTROPHY' | 'STRENGTH' | 'FAT_LOSS' | 'ENDURANCE' | 'HEALTH' | 'PERFORMANCE'

export type ProgramRecord = {
  id: string
  name: string
  description: string | null
  goal: TrainingGoal | null
  goals: TrainingGoal[]
  workoutsCount: number
  createdById: string
  createdAt: string
  updatedAt: string
}

export type WorkoutRecord = {
  id: string
  programId: string | null
  name: string
  notes: string | null
  order: number | null
  exercisesCount: number
  createdAt: string
}

export type CreateProgramInput = { name: string; goals: TrainingGoal[]; description?: string }
export type UpdateProgramInput = { name?: string; goals?: TrainingGoal[]; description?: string | null }
export type CreateWorkoutInput = { programId: string; name: string; description?: string }
export type UpdateWorkoutInput = { name?: string; description?: string | null; order?: number }

export type TrainerDashboardData = {
  totalStudents: number
  trainedToday: number
  needsAttention: {
    athleteId: string
    name: string
    avatar: string | null
    reason: string
    daysSinceLastWorkout?: number
  }[]
  recentActivity: {
    studentName: string
    workoutName: string
    loggedAt: string
  }[]
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
  trainer: {
    dashboard: () =>
      request<{ data: TrainerDashboardData }>('/api/v1/trainer/dashboard'),
  },
  programs: {
    list: () =>
      request<{ data: { programs: ProgramRecord[] } }>('/api/v1/programs'),
    create: (body: CreateProgramInput) =>
      request<{ data: { program: ProgramRecord } }>('/api/v1/programs', { method: 'POST', body }),
    update: (id: string, body: UpdateProgramInput) =>
      request<{ data: { program: ProgramRecord } }>(`/api/v1/programs/${id}`, { method: 'PUT', body }),
    delete: (id: string) =>
      request<{ data: { success: boolean } }>(`/api/v1/programs/${id}`, { method: 'DELETE' }),
    duplicate: (id: string) =>
      request<{ data: { program: ProgramRecord } }>(`/api/v1/programs/${id}/duplicate`, { method: 'POST' }),
    workouts: (id: string) =>
      request<{ data: { workouts: WorkoutRecord[] } }>(`/api/v1/programs/${id}/workouts`),
  },
  workouts: {
    create: (body: CreateWorkoutInput) =>
      request<{ data: { workout: WorkoutRecord } }>('/api/v1/workouts', { method: 'POST', body }),
    update: (id: string, body: UpdateWorkoutInput) =>
      request<{ data: { workout: WorkoutRecord } }>(`/api/v1/workouts/${id}`, { method: 'PUT', body }),
    delete: (id: string) =>
      request<{ data: { success: boolean } }>(`/api/v1/workouts/${id}`, { method: 'DELETE' }),
    duplicate: (id: string) =>
      request<{ data: { workout: WorkoutRecord } }>(`/api/v1/workouts/${id}/duplicate`, { method: 'POST' }),
  },
  // DEBUG — remove before launch
  exercises: {
    list: (muscleGroup?: string) =>
      request<{ data: { exercises: ExerciseRecord[] } }>(
        `/api/v1/exercises${muscleGroup ? `?muscleGroup=${muscleGroup}` : ''}`
      ),
    update: (id: string, body: UpdateExerciseInput) =>
      request<{ data: { exercise: ExerciseRecord } }>(`/api/v1/exercises/${id}`, { method: 'PATCH', body }),
    delete: (id: string) =>
      request<{ data: { success: boolean } }>(`/api/v1/exercises/${id}`, { method: 'DELETE' }),
  },
}
