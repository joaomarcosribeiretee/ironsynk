import { z } from 'zod'

// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

export const RoleSchema = z.enum(['ATHLETE', 'TRAINER', 'ADMIN'])
export type Role = z.infer<typeof RoleSchema>

export const TrainingGoalSchema = z.enum([
  'HYPERTROPHY',
  'STRENGTH',
  'FAT_LOSS',
  'ENDURANCE',
  'HEALTH',
  'PERFORMANCE',
])
export type TrainingGoal = z.infer<typeof TrainingGoalSchema>

export const DietGoalSchema = z.enum(['BULK', 'CUT', 'MAINTENANCE', 'RECOMP', 'HEALTH'])
export type DietGoal = z.infer<typeof DietGoalSchema>

// ─────────────────────────────────────────────
// USER
// ─────────────────────────────────────────────

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: RoleSchema,
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export type User = z.infer<typeof UserSchema>

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  role: RoleSchema.default('ATHLETE'),
})
export type CreateUserInput = z.infer<typeof CreateUserSchema>

// ─────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1),
  avatar: z.string().url().nullable(),
  bio: z.string().nullable(),
  birthDate: z.coerce.date().nullable(),
  sex: z.enum(['male', 'female', 'other']).nullable(),
  weightKg: z.number().positive().nullable(),
  heightCm: z.number().positive().nullable(),
  goal: TrainingGoalSchema.nullable(),
  experience: z.enum(['beginner', 'intermediate', 'advanced']).nullable(),
  daysPerWeek: z.number().int().min(1).max(7).nullable(),
  isPrivate: z.boolean(),
  gymName: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export type Profile = z.infer<typeof ProfileSchema>

export const CreateProfileSchema = z.object({
  name: z.string().min(1),
  birthDate: z.coerce.date().optional(),
  sex: z.enum(['male', 'female', 'other']).optional(),
  weightKg: z.number().positive().optional(),
  heightCm: z.number().positive().optional(),
  goal: TrainingGoalSchema.optional(),
  experience: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  daysPerWeek: z.number().int().min(1).max(7).optional(),
})
export type CreateProfileInput = z.infer<typeof CreateProfileSchema>

// ─────────────────────────────────────────────
// API RESPONSES
// ─────────────────────────────────────────────

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})
export type ApiError = z.infer<typeof ApiErrorSchema>
