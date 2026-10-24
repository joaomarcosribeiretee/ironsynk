import { z } from 'zod'

export const WorkoutAnalyticsQuerySchema = z.object({
  period: z.enum(['4', '8', '12', 'all']).default('8'),
  timeZone: z.string().max(100).default('UTC').refine((value) => {
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true } catch { return false }
  }, 'Invalid time zone'),
})
export type WorkoutAnalyticsQuery = z.infer<typeof WorkoutAnalyticsQuerySchema>

const count = z.number().int().nonnegative()
const amount = z.number().nonnegative()
const SessionRecordSchema = z.object({ sessionId: z.string(), workoutName: z.string(), date: z.string(), value: amount }).nullable()
const PointSchema = z.object({
  sessionId: z.string(), date: z.string(), volume: amount, sets: count, reps: count,
  maxWeightKg: amount.nullable(), best1RM: amount.nullable(),
  bestSet: z.object({ weightKg: amount, reps: count }).nullable(),
})
const ExerciseSchema = z.object({
  exerciseId: z.string(), name: z.string(), sessions: count, totalSets: count,
  totalReps: count, totalVolume: amount, points: z.array(PointSchema),
  change1RM: z.number().nullable(),
  best: z.object({ weightKg: amount, reps: count, estimated1RM: amount, date: z.string() }).nullable(),
})
export const WorkoutAnalyticsSchema = z.object({
  period: z.object({ start: z.string().nullable(), end: z.string(), timeZone: z.string() }),
  summary: z.object({
    totalWorkouts: count, totalMinutes: amount.nullable(), avgDurationMin: amount.nullable(),
    timedWorkouts: count, totalVolume: amount, totalSets: count, totalReps: count, activeDays: count,
    missingVolumeSets: count,
  }),
  frequency: z.object({
    workoutsPerWeek: amount, consistencyPct: amount, activeWeeks: count, observedWeeks: count,
    streakWeeks: count,
    weeks: z.array(z.object({ label: z.string(), count, volume: amount, sets: count })),
  }),
  muscleVolume: z.array(z.object({ muscleGroup: z.string(), volume: amount, setCount: count, pct: amount })),
  exercises: z.array(ExerciseSchema),
  personalRecords: z.array(z.object({
    exerciseId: z.string(), exerciseName: z.string(), date: z.string(), weightKg: amount, reps: count,
  })),
  records: z.object({ largestVolume: SessionRecordSchema, mostSets: SessionRecordSchema, longestWorkout: SessionRecordSchema }),
  history: z.array(z.object({
    sessionId: z.string(), workoutName: z.string(), date: z.string(), durationMin: amount.nullable(),
    volume: amount, sets: count, reps: count, personalRecords: count,
  })),
})
export type WorkoutAnalytics = z.infer<typeof WorkoutAnalyticsSchema>
