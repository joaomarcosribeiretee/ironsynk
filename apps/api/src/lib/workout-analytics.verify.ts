import assert from 'node:assert/strict'
import { test } from 'node:test'
import { WorkoutAnalyticsQuerySchema, WorkoutAnalyticsSchema } from '@ironsynk/shared'
import { buildWorkoutAnalytics, setVolume, type AnalyticsLog } from './workout-analytics.js'

const now = new Date('2026-09-23T15:00:00Z')
const query = { period: '8', timeZone: 'America/Sao_Paulo' } as const
type Set = AnalyticsLog['executionExercises'][number]['setLogs'][number]
const set = (overrides: Partial<Set> = {}): Set => ({
  setType: 'WORKING', technique: 'NONE', isChecked: true,
  repsCompleted: 10, weightKg: 20, isPersonalRecord: false, ...overrides,
})
const log = (id: string, finishedAt: string, sets: Set[] = [set()], overrides: Partial<AnalyticsLog> = {}): AnalyticsLog => ({
  id, finishedAt: new Date(finishedAt), workoutName: 'Treino A', durationMin: 30,
  executionExercises: [{ exerciseId: 'exercise-1', exercise: { name: 'Supino', muscleGroup: 'CHEST' }, setLogs: sets }],
  ...overrides,
})

test('empty dashboard validates, preserves missing durations and zero weeks', () => {
  const result = buildWorkoutAnalytics([], query, now)
  assert.equal(WorkoutAnalyticsSchema.safeParse(result).success, true)
  assert.equal(result.summary.avgDurationMin, null)
  assert.equal(result.frequency.weeks.length, 8)
  assert.equal(result.frequency.observedWeeks, 0)
  assert.equal(result.frequency.streakWeeks, 0)
  assert.deepEqual(result.exercises, [])
})

test('only finished sessions and checked working sets count; zero weight still has reps', () => {
  const result = buildWorkoutAnalytics([
    log('active', '2026-09-23', [set()], { finishedAt: null }),
    log('future', '2026-09-24'),
    log('finished', '2026-09-22', [set(), set({ setType: 'WARMUP' }), set({ setType: 'FEEDER' }),
      set({ isChecked: false }), set({ repsCompleted: 0 }), set({ weightKg: 0 }), set({ weightKg: null })]),
  ], query, now)
  assert.equal(result.summary.totalWorkouts, 1)
  assert.equal(result.summary.totalSets, 3)
  assert.equal(result.summary.totalReps, 30)
  assert.equal(result.summary.totalVolume, 200)
  assert.equal(result.summary.missingVolumeSets, 1)
  assert.equal(result.muscleVolume[0]!.setCount, 3)
  assert.equal(result.frequency.consistencyPct, 100)
})

test('same exercise repeated in one session counts once and keeps its best set', () => {
  const entry = log('one', '2026-09-22')
  entry.executionExercises.push({ ...entry.executionExercises[0]!, setLogs: [set({ weightKg: 30 })] })
  const result = buildWorkoutAnalytics([entry], query, now)
  assert.equal(result.exercises[0]!.sessions, 1)
  assert.equal(result.exercises[0]!.points.length, 1)
  assert.equal(result.exercises[0]!.points[0]!.bestSet!.weightKg, 30)
  assert.equal(result.exercises[0]!.totalVolume, 500)
  assert.equal(result.exercises[0]!.change1RM, null)
})

test('calendar boundaries use the requested timezone, including Sunday near UTC Monday', () => {
  const entries = [log('sunday', '2026-09-21T01:30:00Z'), log('monday', '2026-09-21T03:00:00Z')]
  const result = buildWorkoutAnalytics(entries, query, now)
  assert.equal(result.frequency.weeks.at(-2)!.count, 1)
  assert.equal(result.frequency.weeks.at(-1)!.count, 1)
  assert.equal(result.frequency.weeks.at(-1)!.label, '2026-09-21')
  assert.equal(result.summary.activeDays, 2)
  assert.equal(result.frequency.streakWeeks, 2)
})

test('new athletes are not penalized for weeks before first log, gaps count and current week may be open', () => {
  const entries = [log('first', '2026-09-08T15:00:00Z'), log('second', '2026-09-16T15:00:00Z')]
  const result = buildWorkoutAnalytics(entries, query, now)
  assert.equal(result.frequency.observedWeeks, 3)
  assert.equal(result.frequency.consistencyPct, 67)
  assert.equal(result.frequency.streakWeeks, 2)
  assert.equal(result.frequency.workoutsPerWeek, 0.7)
  const stale = buildWorkoutAnalytics(entries.slice(0, 1), query, now)
  assert.equal(stale.frequency.streakWeeks, 0)
})

test('period filters apply to all aggregates, PR events, muscle groups and exercise points', () => {
  const entries = [log('old', '2026-01-01', [set({ isPersonalRecord: true, weightKg: 100 })]), log('recent', '2026-09-22')]
  const result = buildWorkoutAnalytics(entries, { ...query, period: '4' }, now)
  assert.equal(result.summary.totalVolume, 200)
  assert.equal(result.personalRecords.length, 0)
  assert.equal(result.exercises[0]!.points.length, 1)
  assert.equal(result.frequency.observedWeeks, 4)
  assert.equal(result.frequency.consistencyPct, 25)
  const all = buildWorkoutAnalytics(entries, { ...query, period: 'all' }, now)
  assert.equal(all.summary.totalVolume, 1200)
  assert.equal(all.frequency.weeks.length, 12)
  assert.equal(all.history.length, 2)
})

test('unknown duration is excluded from the average, while recorded zero is valid', () => {
  const result = buildWorkoutAnalytics([
    log('unknown', '2026-09-22', [], { durationMin: null }),
    log('zero', '2026-09-22', [], { durationMin: 0 }), log('known', '2026-09-22'),
  ], query, now)
  assert.equal(result.summary.timedWorkouts, 2)
  assert.equal(result.summary.avgDurationMin, 15)
  assert.equal(result.summary.activeDays, 1)
})

test('1RM excludes techniques and high reps, uses actual singles, and retains zero/non-estimable sessions', () => {
  const result = buildWorkoutAnalytics([
    log('first', '2026-09-01', [set({ repsCompleted: 1, weightKg: 50 })]),
    log('second', '2026-09-08', [set({ repsCompleted: 1, weightKg: 60 }), set({ repsCompleted: 30, weightKg: 100 }), set({ technique: 'REST_PAUSE', weightKg: 200 })]),
    log('third', '2026-09-15', [set({ weightKg: 0 })]),
  ], query, now)
  const exercise = result.exercises[0]!
  assert.equal(exercise.points[0]!.best1RM, 50)
  assert.equal(exercise.best!.estimated1RM, 60)
  assert.equal(exercise.change1RM, 10)
  assert.equal(exercise.points[2]!.best1RM, null)
  assert.equal(exercise.points[2]!.maxWeightKg, 0)
})

test('PRs are recorded set events, not the number of cached exercises', () => {
  const result = buildWorkoutAnalytics([log('one', '2026-09-22', [set({ isPersonalRecord: true }), set({ isPersonalRecord: true }), set()])], query, now)
  assert.equal(result.personalRecords.length, 2)
  assert.equal(result.history[0]!.personalRecords, 2)
})

test('drop and muscle-round volumes use actual block weights; incomplete blocks never inflate totals', () => {
  assert.equal(setVolume(set({ technique: 'DROP_SET', repsCompleted: 20, weightKg: 100,
    techniqueConfig: { execDrops: [{ reps: 10, weightKg: 100 }, { reps: 10, weightKg: 50 }] } })), 1500)
  assert.equal(setVolume(set({ technique: 'MUSCLE_ROUND', repsCompleted: 12,
    techniqueConfig: { execBlocks: [{ reps: 4 }, { reps: 4 }, { reps: 4 }], mainWeightKg: 100, dropWeightKg: 50, failedAtBlock: 1 } })), 1000)
  assert.equal(setVolume(set({ technique: 'DROP_SET' })), null)
  assert.equal(setVolume(set({ technique: 'DROP_SET', techniqueConfig: { execDrops: [{ reps: 1, weightKg: 100 }] } })), null)
})

test('validates period and IANA timezone rather than trusting arbitrary query input', () => {
  assert.equal(WorkoutAnalyticsQuerySchema.safeParse({ period: '0' }).success, false)
  assert.equal(WorkoutAnalyticsQuerySchema.safeParse({ timeZone: 'Mars/Olympus' }).success, false)
  assert.equal(WorkoutAnalyticsQuerySchema.parse({}).period, '8')
})
