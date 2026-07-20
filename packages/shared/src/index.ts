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
// PERSONAL RECORDS (workout execution)
// ─────────────────────────────────────────────

export const PRTypeSchema = z.enum([
  'MAX_WEIGHT',
  'MAX_VOLUME',
  'BEST_1RM',
  'BEST_WEIGHT_FOR_REPS',
])
export type PRType = z.infer<typeof PRTypeSchema>

// Result returned when a working set is checked during execution.
export const SetPRResultSchema = z.object({
  isPR: z.boolean(),
  prTypes: z.array(PRTypeSchema),
  previous: z
    .object({
      maxWeightKg: z.number().nullable(),
      maxVolume: z.number().nullable(),
      best1RM: z.number().nullable(),
      bestWeightForReps: z.number().nullable(),
    })
    .optional(),
  previousBest: z.object({ weightKg: z.number(), reps: z.number() }).optional(),
})
export type SetPRResult = z.infer<typeof SetPRResultSchema>

// Per-exercise progressive-overload reference for the execution screen.
const PrevSetRefSchema = z
  .object({
    weightKg: z.number(),
    reps: z.number(),
    estimated1RM: z.number(),
  })
  .nullable()

export const ExerciseReferenceSchema = z.object({
  exerciseId: z.string(),
  hasHistory: z.boolean(),
  lastSet: PrevSetRefSchema,
  bestSet: PrevSetRefSchema,
  best1RM: z.number().nullable(),
  maxWeightKg: z.number().nullable(),
  bestWeightByReps: z.record(z.string(), z.number()),
})
export type ExerciseReference = z.infer<typeof ExerciseReferenceSchema>

// ─────────────────────────────────────────────
// NUTRITION
// ─────────────────────────────────────────────

// Macro payload shared by foods, meal foods and daily totals. All values are
// non-negative numbers; fiber is optional/nullable because many sources omit it.
export const MacrosSchema = z.object({
  calories: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  fiberG: z.number().nonnegative().nullable(),
})
export type Macros = z.infer<typeof MacrosSchema>

// ── Food ──────────────────────────────────────
export const FoodSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string().nullable(),
  calories: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
  fiberG: z.number().nullable(),
  isCustom: z.boolean(),
  createdById: z.string().nullable(),
  sourceId: z.string().nullable(),
})
export type Food = z.infer<typeof FoodSchema>

// Manual custom food. Macros are always per 100g (project convention).
export const CreateFoodSchema = z.object({
  name: z.string().min(1).max(120),
  brand: z.string().max(120).optional(),
  calories: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  fiberG: z.number().nonnegative().optional(),
})
export type CreateFoodInput = z.infer<typeof CreateFoodSchema>

// A search result may come from the local DB (has an id) or from Open Food
// Facts (source = 'off', identified by sourceId, not yet persisted).
export const FoodSearchResultSchema = FoodSchema.extend({
  source: z.enum(['local', 'off']),
})
export type FoodSearchResult = z.infer<typeof FoodSearchResultSchema>

// Persist an Open Food Facts product into the local Food table.
export const CacheOffFoodSchema = z.object({
  sourceId: z.string().min(1),
})
export type CacheOffFoodInput = z.infer<typeof CacheOffFoodSchema>

// ── Nutrition plan ────────────────────────────
export const NutritionPlanSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  goal: DietGoalSchema.nullable(),
  targetCalories: z.number().nullable(),
  targetProteinG: z.number().nullable(),
  targetCarbsG: z.number().nullable(),
  targetFatG: z.number().nullable(),
  targetWaterMl: z.number().nullable(),
  notes: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export type NutritionPlan = z.infer<typeof NutritionPlanSchema>

export const CreateNutritionPlanSchema = z.object({
  name: z.string().min(1).max(120),
  goal: DietGoalSchema.optional(),
  targetCalories: z.number().nonnegative().optional(),
  targetProteinG: z.number().nonnegative().optional(),
  targetCarbsG: z.number().nonnegative().optional(),
  targetFatG: z.number().nonnegative().optional(),
  targetWaterMl: z.number().int().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
})
export type CreateNutritionPlanInput = z.infer<typeof CreateNutritionPlanSchema>

export const UpdateNutritionPlanSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  goal: DietGoalSchema.nullable().optional(),
  targetCalories: z.number().nonnegative().nullable().optional(),
  targetProteinG: z.number().nonnegative().nullable().optional(),
  targetCarbsG: z.number().nonnegative().nullable().optional(),
  targetFatG: z.number().nonnegative().nullable().optional(),
  targetWaterMl: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
})
export type UpdateNutritionPlanInput = z.infer<typeof UpdateNutritionPlanSchema>

// ── Meal ──────────────────────────────────────
export const MealSchema = z.object({
  id: z.string(),
  nutritionPlanId: z.string(),
  name: z.string(),
  order: z.number().int(),
  targetTimeHour: z.number().int().nullable(),
})
export type Meal = z.infer<typeof MealSchema>

export const CreateMealSchema = z.object({
  name: z.string().min(1).max(80),
  targetTimeHour: z.number().int().min(0).max(23).optional(),
})
export type CreateMealInput = z.infer<typeof CreateMealSchema>

export const UpdateMealSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  targetTimeHour: z.number().int().min(0).max(23).nullable().optional(),
})
export type UpdateMealInput = z.infer<typeof UpdateMealSchema>

// Full ordered list of meal ids in their new order.
export const ReorderMealsSchema = z.object({
  mealIds: z.array(z.string().min(1)).min(1),
})
export type ReorderMealsInput = z.infer<typeof ReorderMealsSchema>

// ── Meal food ─────────────────────────────────
export const AddMealFoodSchema = z.object({
  foodId: z.string().min(1),
  quantityG: z.number().positive(),
  isCooked: z.boolean().optional(),
})
export type AddMealFoodInput = z.infer<typeof AddMealFoodSchema>

export const UpdateMealFoodSchema = z.object({
  quantityG: z.number().positive().optional(),
  isCooked: z.boolean().optional(),
})
export type UpdateMealFoodInput = z.infer<typeof UpdateMealFoodSchema>

// A meal food resolved with the food record and macros for the logged quantity.
export const MealFoodSchema = z.object({
  id: z.string(),
  mealId: z.string(),
  foodId: z.string(),
  quantityG: z.number(),
  isCooked: z.boolean(),
  food: FoodSchema,
  macros: MacrosSchema,
})
export type MealFood = z.infer<typeof MealFoodSchema>

// ── Daily execution ───────────────────────────
export const DailyMealSchema = z.object({
  mealId: z.string(),
  name: z.string(),
  order: z.number().int(),
  targetTimeHour: z.number().int().nullable(),
  isCompleted: z.boolean(),
  completedAt: z.coerce.date().nullable(),
  foods: z.array(MealFoodSchema),
  plannedMacros: MacrosSchema,
})
export type DailyMeal = z.infer<typeof DailyMealSchema>

export const DailyTotalsSchema = z.object({
  targetCalories: z.number().nullable(),
  consumedCalories: z.number(),
  targetProteinG: z.number().nullable(),
  consumedProteinG: z.number(),
  targetCarbsG: z.number().nullable(),
  consumedCarbsG: z.number(),
  targetFatG: z.number().nullable(),
  consumedFatG: z.number(),
  completedMeals: z.number().int(),
  totalMeals: z.number().int(),
  adherencePercent: z.number(),
})
export type DailyTotals = z.infer<typeof DailyTotalsSchema>

export const DailyExecutionSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  plan: NutritionPlanSchema.nullable(),
  meals: z.array(DailyMealSchema),
  totals: DailyTotalsSchema,
})
export type DailyExecution = z.infer<typeof DailyExecutionSchema>

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
