import type { WorkoutAnalyticsQuery, WorkoutAnalytics } from '@ironsynk/shared'
import { prisma } from './prisma.js'
import { buildWorkoutAnalytics } from './workout-analytics.js'

export async function computeWorkoutAnalytics(userId: string, query: WorkoutAnalyticsQuery): Promise<WorkoutAnalytics> {
  const logs = await prisma.trainingLog.findMany({
    where: { userId, finishedAt: { not: null, lte: new Date() } },
    orderBy: [{ finishedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true, workoutName: true, finishedAt: true, durationMin: true,
      sets: { select: {
          exerciseId: true,
          setType: true, technique: true, isChecked: true, repsCompleted: true,
          weightKg: true, isPersonalRecord: true, techniqueConfig: true,
      } },
    },
  })
  // Read TrainingLog.sets directly so legacy sets without ExecutionExercise
  // links are not silently lost. Resolve metadata without exposing other users.
  const ids = [...new Set(logs.flatMap((log) => log.sets.map((set) => set.exerciseId)))]
  const exercises = ids.length ? await prisma.exercise.findMany({
    where: { id: { in: ids } }, select: { id: true, name: true, muscleGroup: true },
  }) : []
  const metadata = new Map(exercises.map((exercise) => [exercise.id, exercise]))
  return buildWorkoutAnalytics(logs.map((log) => ({
    ...log,
    executionExercises: log.sets.map((set) => ({
      exerciseId: set.exerciseId,
      exercise: metadata.get(set.exerciseId) ?? { name: 'Exercício removido', muscleGroup: 'OTHER' },
      setLogs: [set],
    })),
  })), query)
}
