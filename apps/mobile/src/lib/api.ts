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
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
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

export type ExerciseDetail = {
  id: string
  name: string
  muscleGroup: string
  equipment: string | null
  gifUrl: string | null
  videoUrl: string | null
}

export type SetType = 'WORKING' | 'WARMUP' | 'FEEDER'

export type SetTechnique =
  | 'NONE'
  | 'WARMUP'
  | 'FEEDER'
  | 'DROP_SET'
  | 'BACK_OFF'
  | 'REST_PAUSE'
  | 'CLUSTER_SET'
  | 'MUSCLE_ROUND'
  | 'MYOREP'
  | 'BISET'
  | 'SUPERSET'

export type PlannedSetTechnique = 'NONE' | 'REST_PAUSE' | 'MUSCLE_ROUND' | 'CLUSTER_SET' | 'BACK_OFF' | 'DROP_SET' | 'MYOREP'

export type RestPauseConfig = { failurePoints: number; restBetweenSeconds: number; blockReps?: string[] }
export type MuscleRoundConfig = { blocks: number; repsPerBlock?: number; restBetweenSeconds: number; blockReps?: string[]; blockWeights?: string[]; failedAtBlock?: number }
export type ClusterSetConfig = { blocks: number; restBetweenSeconds: number; blockReps?: string[] }
export type DropSetConfig = { drops: number; blockReps?: string[]; blockWeights?: string[] }
export type MyoRepConfig = {
  activationReps: number
  activationRestSeconds: number
  repsPerBlock: number
  restBetweenSeconds: number
  weightKg?: number | null
}
export type TechniqueConfig = RestPauseConfig | MuscleRoundConfig | ClusterSetConfig | DropSetConfig | MyoRepConfig | Record<string, unknown>

export type SetTechniqueEntry = { technique: SetTechnique; config: TechniqueConfig | null }

export type PlannedSetRecord = {
  id: string
  trainingExId: string
  order: number
  setType: SetType
  technique: PlannedSetTechnique
  techniqueConfig: TechniqueConfig | null
  targetReps: string | null
  targetWeight: number | null
  restSeconds: number | null
}

export type TrainingExerciseRecord = {
  id: string
  workoutId: string
  order: number
  targetSets: number
  targetReps: string
  restSeconds: number | null
  notes: string | null
  technique: SetTechnique
  techniqueConfig: TechniqueConfig | null
  supersetGroupId: string | null
  exercise: ExerciseDetail
  sets: PlannedSetRecord[]
}

export type WorkoutDetailRecord = {
  id: string
  programId: string | null
  name: string
  notes: string | null
  exercises: TrainingExerciseRecord[]
}

export type AddExerciseInput = {
  exerciseId: string
  targetSets?: number
  targetReps?: string
  restSeconds?: number | null
}

export type UpdateTrainingExerciseInput = {
  targetSets?: number
  targetReps?: string
  restSeconds?: number | null
  order?: number
  notes?: string | null
  technique?: SetTechnique
  techniqueConfig?: TechniqueConfig | null
  supersetGroupId?: string | null
}

export type CreateSupersetInput = {
  workoutId: string
  exerciseIds: string[]
  type: 'BISET' | 'SUPERSET'
}

export type AddSetInput = {
  setType?: SetType
  technique?: PlannedSetTechnique
  techniqueConfig?: TechniqueConfig | null
  targetReps?: string | null
  targetWeight?: number | null
  restSeconds?: number | null
}

export type UpdateSetInput = AddSetInput

// ─── Execution / Session types ────────────────────────────────────────────────

export type ExecutionSetLogRecord = {
  id: string
  trainingLogId: string
  executionExerciseId: string | null
  exerciseId: string
  setNumber: number
  order: number
  setType: SetType
  technique: PlannedSetTechnique
  techniqueConfig: TechniqueConfig | null
  repsCompleted: number | null
  weightKg: number | null
  isChecked: boolean
  checkedAt: string | null
  isPersonalRecord: boolean
  notes: string | null
  plannedSetId: string | null
}

export type ExecutionExerciseRecord = {
  id: string
  trainingLogId: string
  exerciseId: string
  trainingExId: string | null
  order: number
  exerciseNotes: string | null
  exercise: ExerciseDetail
  sets: ExecutionSetLogRecord[]
}

export type SessionRecord = {
  id: string
  userId: string
  workoutId: string | null
  isFreeWorkout: boolean
  workoutName: string | null
  programName: string | null
  startedAt: string
  finishedAt: string | null
  durationMin: number | null
  notes: string | null
  isPosted: boolean
  totalVolume: number | null
  totalSets: number | null
  totalValidSets: number | null
  hasChanges: boolean
  exercises: ExecutionExerciseRecord[]
}

export type UpdateExecSetInput = {
  repsCompleted?: number | null
  weightKg?: number | null
  isChecked?: boolean
  notes?: string | null
  techniqueConfig?: TechniqueConfig | null
  setType?: SetType
  technique?: PlannedSetTechnique
}

export type ExerciseListParams = {
  muscleGroup?: string
  equipment?: string
  search?: string
  limit?: number
  offset?: number
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

export type CreateProgramInput = { name: string; goals?: TrainingGoal[]; description?: string }
export type UpdateProgramInput = { name?: string; description?: string | null }
export type CreateWorkoutInput = { programId: string; name: string; description?: string }
export type UpdateWorkoutInput = { name?: string; description?: string | null; order?: number }

export type WorkoutPostRecord = {
  id: string
  content: string | null
  imageUrls: string[]
  videoUrl: string | null
  createdAt: string
  user: { id: string; name: string | null; avatar: string | null }
  session: SessionRecord | null
}

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
    get: (id: string) =>
      request<{ data: { workout: WorkoutDetailRecord } }>(`/api/v1/workouts/${id}`),
    addExercise: (id: string, body: AddExerciseInput) =>
      request<{ data: { trainingExercise: TrainingExerciseRecord } }>(`/api/v1/workouts/${id}/exercises`, { method: 'POST', body }),
  },
  // DEBUG — remove before launch
  exercises: {
    list: (params?: ExerciseListParams) => {
      const qs = new URLSearchParams()
      if (params?.muscleGroup) qs.set('muscleGroup', params.muscleGroup)
      if (params?.equipment) qs.set('equipment', params.equipment)
      if (params?.search) qs.set('search', params.search)
      if (params?.limit !== undefined) qs.set('limit', String(params.limit))
      if (params?.offset !== undefined) qs.set('offset', String(params.offset))
      const query = qs.toString()
      return request<{ data: { exercises: ExerciseRecord[]; total: number } }>(
        `/api/v1/exercises${query ? `?${query}` : ''}`
      )
    },
    update: (id: string, body: UpdateExerciseInput) =>
      request<{ data: { exercise: ExerciseRecord } }>(`/api/v1/exercises/${id}`, { method: 'PATCH', body }),
    delete: (id: string) =>
      request<{ data: { success: boolean } }>(`/api/v1/exercises/${id}`, { method: 'DELETE' }),
  },
  trainingExercises: {
    update: (id: string, body: UpdateTrainingExerciseInput) =>
      request<{ data: { trainingExercise: TrainingExerciseRecord } }>(`/api/v1/training-exercises/${id}`, { method: 'PUT', body }),
    delete: (id: string) =>
      request<{ data: { success: boolean } }>(`/api/v1/training-exercises/${id}`, { method: 'DELETE' }),
    replace: (id: string, body: { newExerciseId: string }) =>
      request<{ data: { trainingExercise: TrainingExerciseRecord } }>(`/api/v1/training-exercises/${id}/replace`, { method: 'PUT', body }),
    createSuperset: (body: CreateSupersetInput) =>
      request<{ data: { exercises: TrainingExerciseRecord[]; groupId: string } }>('/api/v1/training-exercises/superset', { method: 'POST', body }),
    dissolveSuperset: (groupId: string) =>
      request<{ data: { success: boolean } }>(`/api/v1/training-exercises/superset/${groupId}`, { method: 'DELETE' }),
    addSet: (id: string, body: AddSetInput) =>
      request<{ data: { plannedSet: PlannedSetRecord } }>(`/api/v1/training-exercises/${id}/sets`, { method: 'POST', body }),
  },
  plannedSets: {
    update: (id: string, body: UpdateSetInput) =>
      request<{ data: { plannedSet: PlannedSetRecord } }>(`/api/v1/planned-sets/${id}`, { method: 'PUT', body }),
    delete: (id: string) =>
      request<{ data: { success: boolean } }>(`/api/v1/planned-sets/${id}`, { method: 'DELETE' }),
  },
  sessions: {
    start: (body: { workoutId?: string }) =>
      request<{ data: { session: SessionRecord } }>('/api/v1/sessions/start', { method: 'POST', body }),
    get: (id: string) =>
      request<{ data: { session: SessionRecord } }>(`/api/v1/sessions/${id}`),
    updateSet: (sessionId: string, setId: string, body: UpdateExecSetInput) =>
      request<{ data: { set: ExecutionSetLogRecord; isPR: boolean; previousBest?: { weightKg: number; reps: number } } }>(
        `/api/v1/sessions/${sessionId}/sets/${setId}`, { method: 'PUT', body }),
    addExercise: (sessionId: string, body: { exerciseId: string; setCount?: number }) =>
      request<{ data: { exercise: ExecutionExerciseRecord } }>(`/api/v1/sessions/${sessionId}/exercises`, { method: 'POST', body }),
    removeExercise: (sessionId: string, execExId: string) =>
      request<{ data: { success: boolean } }>(`/api/v1/sessions/${sessionId}/exercises/${execExId}`, { method: 'DELETE' }),
    addSet: (sessionId: string, execExId: string) =>
      request<{ data: { set: ExecutionSetLogRecord } }>(`/api/v1/sessions/${sessionId}/exercises/${execExId}/sets`, { method: 'POST', body: {} }),
    removeSet: (sessionId: string, setId: string) =>
      request<{ data: { success: boolean } }>(`/api/v1/sessions/${sessionId}/sets/${setId}`, { method: 'DELETE' }),
    updateExerciseNotes: (sessionId: string, execExId: string, notes: string) =>
      request<{ data: { success: boolean } }>(`/api/v1/sessions/${sessionId}/exercises/${execExId}/notes`, { method: 'PUT', body: { notes } }),
    finish: (sessionId: string, applyChanges: boolean) =>
      request<{ data: { session: SessionRecord; hasChanges: boolean } }>(`/api/v1/sessions/${sessionId}/finish`, { method: 'POST', body: { applyChanges } }),
    cancel: (sessionId: string) =>
      request<{ data: { success: boolean } }>(`/api/v1/sessions/${sessionId}`, { method: 'DELETE' }),
  },
  posts: {
    create: (body: { trainingLogId: string; content?: string }) =>
      request<{ data: { post: { id: string } } }>('/api/v1/posts', { method: 'POST', body }),
    listMine: (params?: { limit?: number; offset?: number }) => {
      const qs = new URLSearchParams()
      if (params?.limit !== undefined) qs.set('limit', String(params.limit))
      if (params?.offset !== undefined) qs.set('offset', String(params.offset))
      const query = qs.toString()
      return request<{ data: { posts: WorkoutPostRecord[]; total: number } }>(
        `/api/v1/posts/me${query ? `?${query}` : ''}`
      )
    },
  },
}
