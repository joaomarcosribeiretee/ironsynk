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
// POST MEDIA (workout post carousel)
// ─────────────────────────────────────────────

export const POST_MEDIA_MAX_ITEMS = 5
export const POST_VIDEO_MAX_DURATION_SEC = 60
export const POST_CONTENT_MAX_CHARS = 500

export const PostMediaTypeSchema = z.enum(['IMAGE', 'VIDEO'])
export type PostMediaType = z.infer<typeof PostMediaTypeSchema>

export const PostMediaItemSchema = z
  .object({
    type: PostMediaTypeSchema,
    url: z.string().url(),
    thumbnailUrl: z.string().url().optional(),
    durationSec: z.number().positive().optional(),
    order: z.number().int().min(0),
  })
  .superRefine((item, ctx) => {
    if (item.type === 'VIDEO') {
      if (item.durationSec === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['durationSec'],
          message: 'durationSec is required for VIDEO',
        })
      } else if (item.durationSec > POST_VIDEO_MAX_DURATION_SEC) {
        ctx.addIssue({
          code: 'custom',
          path: ['durationSec'],
          message: `Video must be ${POST_VIDEO_MAX_DURATION_SEC}s or shorter`,
        })
      }
    }
  })
export type PostMediaItem = z.infer<typeof PostMediaItemSchema>

export const CreatePostFromTrainingLogSchema = z.object({
  trainingLogId: z.string().min(1),
  content: z.string().max(POST_CONTENT_MAX_CHARS).optional(),
  media: z.array(PostMediaItemSchema).max(POST_MEDIA_MAX_ITEMS).optional(),
})
export type CreatePostFromTrainingLogInput = z.infer<typeof CreatePostFromTrainingLogSchema>

// Signed upload URL request for post media
export const PostMediaUploadFileTypeSchema = z.enum([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
])
export type PostMediaUploadFileType = z.infer<typeof PostMediaUploadFileTypeSchema>

export const POST_MEDIA_MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10MB
export const POST_MEDIA_MAX_VIDEO_BYTES = 120 * 1024 * 1024 // 120MB

export const PostMediaSignedUrlSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: PostMediaUploadFileTypeSchema,
  postDraftId: z.string().min(1).max(64).optional(),
})
export type PostMediaSignedUrlInput = z.infer<typeof PostMediaSignedUrlSchema>

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
