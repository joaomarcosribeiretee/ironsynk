import type { WorkoutAnalytics, WorkoutAnalyticsQuery } from '@ironsynk/shared'
import { estimate1RM } from './personal-records.js'

export interface AnalyticsLog {
  id: string; workoutName: string | null; finishedAt: Date | null; durationMin: number | null
  executionExercises: {
    exerciseId: string; exercise: { name: string; muscleGroup: string }
    setLogs: {
      setType: string; technique: string; isChecked: boolean; repsCompleted: number | null
      weightKg: number | null; isPersonalRecord: boolean; techniqueConfig?: unknown
    }[]
  }[]
}
const DAY = 86400000
const round = (value: number) => Math.round(value * 10) / 10
const week = (day: number) => Math.floor((day + 3) / 7)
const weekLabel = (index: number) => new Date((index * 7 - 3) * DAY).toISOString().slice(0, 10)

type AnalyticsSet = AnalyticsLog['executionExercises'][number]['setLogs'][number]
function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}
const validWeight = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

/** Variable-load techniques cannot use max load × total reps. An incomplete
 * block log is explicitly excluded from volume, while its recorded reps remain. */
export function setVolume(set: AnalyticsSet): number | null {
  if (set.technique !== 'DROP_SET' && set.technique !== 'MUSCLE_ROUND') {
    return validWeight(set.weightKg) ? set.weightKg * (set.repsCompleted ?? 0) : null
  }
  const config = record(set.techniqueConfig)
  if (!config) return null
  const blocks = set.technique === 'DROP_SET' ? config['execDrops'] : config['execBlocks']
  if (!Array.isArray(blocks) || blocks.length === 0) return null
  let volume = 0
  let repsTotal = 0
  for (const [index, raw] of blocks.entries()) {
    const block = record(raw)
    if (!block) return null
    const reps = block['reps']
    const failedAt = config['failedAtBlock']
    const weight = set.technique === 'DROP_SET' ? block['weightKg']
      : typeof failedAt === 'number' && failedAt >= 0 && index > failedAt ? config['dropWeightKg'] : config['mainWeightKg']
    if (typeof reps !== 'number' || !Number.isInteger(reps) || reps <= 0 || !validWeight(weight)) return null
    volume += reps * weight
    repsTotal += reps
  }
  return repsTotal === set.repsCompleted ? volume : null
}

/** Monday calendar weeks in the requested IANA timezone. Checked working sets
 * contribute sets/reps even without external load. Estimates use straight sets
 * of 1–12 reps only; a single rep uses its actual load. */
export function buildWorkoutAnalytics(input: AnalyticsLog[], query: WorkoutAnalyticsQuery, now = new Date()): WorkoutAnalytics {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: query.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const dayOf = (date: Date) => {
    const parts = formatter.formatToParts(date)
    const part = (type: string) => Number(parts.find((p) => p.type === type)!.value)
    return Date.UTC(part('year'), part('month') - 1, part('day')) / DAY
  }
  const logs = input.filter((log) => log.finishedAt !== null && log.finishedAt <= now)
    .sort((a, b) => a.finishedAt!.getTime() - b.finishedAt!.getTime() || a.id.localeCompare(b.id))
  const currentWeek = week(dayOf(now))
  const firstWeek = logs.length ? week(dayOf(logs[0]!.finishedAt!)) : currentWeek
  const startWeek = query.period === 'all' ? firstWeek : currentWeek - Number(query.period) + 1
  const observedStart = Math.max(startWeek, firstWeek)
  const observedWeeks = logs.length ? currentWeek - observedStart + 1 : 0
  const selected = logs.filter((log) => week(dayOf(log.finishedAt!)) >= startWeek)
  const activeWeeks = new Set<number>()
  const allWeeks = new Set(logs.map((log) => week(dayOf(log.finishedAt!))))
  let cursor = allWeeks.has(currentWeek) ? currentWeek : currentWeek - 1
  let streakWeeks = 0
  while (allWeeks.has(cursor--)) streakWeeks++
  const weekly = new Map<number, { label: string; count: number; volume: number; sets: number }>()
  // Full-history totals remain complete; the chart shows at most 12 weeks.
  for (let index = Math.max(startWeek, currentWeek - 11); index <= currentWeek; index++) {
    weekly.set(index, { label: weekLabel(index), count: 0, volume: 0, sets: 0 })
  }
  const result: WorkoutAnalytics = {
    period: { start: logs.length || query.period !== 'all' ? weekLabel(startWeek) : null, end: now.toISOString(), timeZone: query.timeZone },
    summary: { totalWorkouts: selected.length, totalMinutes: null, avgDurationMin: null, timedWorkouts: 0, totalVolume: 0, totalSets: 0, totalReps: 0, activeDays: 0, missingVolumeSets: 0 },
    frequency: { workoutsPerWeek: 0, consistencyPct: 0, activeWeeks: 0, observedWeeks, streakWeeks, weeks: [] },
    muscleVolume: [], exercises: [], personalRecords: [], history: [],
    records: { largestVolume: null, mostSets: null, longestWorkout: null },
  }
  const muscles = new Map<string, { muscleGroup: string; volume: number; setCount: number; pct: number }>()
  const exercises = new Map<string, WorkoutAnalytics['exercises'][number]>()
  const activeDays = new Set<number>()
  let minutes = 0
  for (const log of selected) {
    const date = log.finishedAt!.toISOString()
    const day = dayOf(log.finishedAt!)
    const weekIndex = week(day)
    activeWeeks.add(weekIndex)
    activeDays.add(day)
    const history: WorkoutAnalytics['history'][number] = {
      sessionId: log.id, workoutName: log.workoutName ?? 'Treino livre', date,
      durationMin: log.durationMin, volume: 0, sets: 0, reps: 0, personalRecords: 0,
    }
    if (log.durationMin !== null) { minutes += log.durationMin; result.summary.timedWorkouts++ }
    for (const execution of log.executionExercises) {
      for (const set of execution.setLogs) {
        const reps = set.repsCompleted
        const weight = set.weightKg
        if (!set.isChecked || set.setType !== 'WORKING' || reps === null || reps <= 0) continue
        const measuredVolume = setVolume(set)
        const volume = measuredVolume ?? 0
        if (measuredVolume === null) result.summary.missingVolumeSets++
        let exercise = exercises.get(execution.exerciseId)
        if (!exercise) {
          exercise = { exerciseId: execution.exerciseId, name: execution.exercise.name, sessions: 0, totalSets: 0, totalReps: 0, totalVolume: 0, points: [], change1RM: null, best: null }
          exercises.set(execution.exerciseId, exercise)
        }
        let point = exercise.points.at(-1)
        if (!point || point.sessionId !== log.id) {
          point = { sessionId: log.id, date, volume: 0, sets: 0, reps: 0, maxWeightKg: null, best1RM: null, bestSet: null }
          exercise.points.push(point)
          exercise.sessions++
        }
        point.sets++; point.reps += reps; point.volume += volume
        if (weight !== null && weight >= 0) point.maxWeightKg = Math.max(point.maxWeightKg ?? 0, weight)
        exercise.totalSets++; exercise.totalReps += reps; exercise.totalVolume += volume
        history.sets++; history.reps += reps; history.volume += volume
        const muscle = muscles.get(execution.exercise.muscleGroup) ?? { muscleGroup: execution.exercise.muscleGroup, volume: 0, setCount: 0, pct: 0 }
        muscle.volume += volume; muscle.setCount++
        muscles.set(muscle.muscleGroup, muscle)
        if (set.technique === 'NONE' && weight !== null && weight > 0 && reps <= 12) {
          const estimated1RM = reps === 1 ? weight : round(estimate1RM(weight, reps))
          if (point.best1RM === null || estimated1RM > point.best1RM) {
            point.best1RM = estimated1RM; point.bestSet = { weightKg: weight, reps }
          }
          if (!exercise.best || estimated1RM > exercise.best.estimated1RM) exercise.best = { weightKg: weight, reps, estimated1RM, date }
        }
        if (set.isPersonalRecord && set.technique === 'NONE' && weight !== null && weight > 0) {
          result.personalRecords.push({ exerciseId: execution.exerciseId, exerciseName: execution.exercise.name, date, weightKg: weight, reps })
          history.personalRecords++
        }
      }
    }
    result.summary.totalVolume += history.volume
    result.summary.totalSets += history.sets
    result.summary.totalReps += history.reps
    const bucket = weekly.get(weekIndex)
    if (bucket) { bucket.count++; bucket.volume += history.volume; bucket.sets += history.sets }
    history.volume = round(history.volume)
    result.history.push(history)
    for (const [key, value] of [
      ['largestVolume', history.volume], ['mostSets', history.sets], ['longestWorkout', history.durationMin],
    ] as const) {
      if (value !== null && value > 0 && value > (result.records[key]?.value ?? 0)) {
        result.records[key] = { sessionId: log.id, workoutName: history.workoutName, date, value }
      }
    }
  }
  result.summary.totalVolume = round(result.summary.totalVolume)
  result.summary.activeDays = activeDays.size
  if (result.summary.timedWorkouts) {
    result.summary.totalMinutes = round(minutes)
    result.summary.avgDurationMin = round(minutes / result.summary.timedWorkouts)
  }
  result.frequency = {
    workoutsPerWeek: observedWeeks ? round(selected.length / observedWeeks) : 0,
    consistencyPct: observedWeeks ? Math.round(activeWeeks.size / observedWeeks * 100) : 0,
    activeWeeks: activeWeeks.size, observedWeeks, streakWeeks,
    weeks: [...weekly.values()].map((bucket) => ({ ...bucket, volume: round(bucket.volume) })),
  }
  result.muscleVolume = [...muscles.values()].map((muscle) => ({ ...muscle, volume: round(muscle.volume), pct: Math.round(muscle.setCount / result.summary.totalSets * 100) })).sort((a, b) => b.setCount - a.setCount)
  result.exercises = [...exercises.values()].map((exercise) => {
    const estimates = exercise.points.filter((point) => point.best1RM !== null)
    return { ...exercise, totalVolume: round(exercise.totalVolume),
      points: exercise.points.map((point) => ({ ...point, volume: round(point.volume) })),
      change1RM: estimates.length >= 2 ? round(estimates.at(-1)!.best1RM! - estimates[0]!.best1RM!) : null,
    }
  }).sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name))
  result.history.reverse()
  result.personalRecords.reverse()
  return result
}
