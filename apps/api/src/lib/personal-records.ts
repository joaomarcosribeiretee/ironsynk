import type { Prisma, PrismaClient } from '@prisma/client'

// ─────────────────────────────────────────────────────────────────────────────
// Personal Records — MVP
//
// Hard rule: a PR is only valid against HISTORICAL data, i.e. working sets from
// TrainingLogs that finished BEFORE the current session started. We never compare
// a set against other sets in the same active session, and the first-ever entry
// for an exercise is never a PR.
//
// Only WORKING sets with technique NONE, reps > 0 and weight > 0 are eligible.
// Advanced techniques, warmup and feeder sets are ignored in this MVP.
// ─────────────────────────────────────────────────────────────────────────────

export type DbClient = PrismaClient | Prisma.TransactionClient

export const PR_TYPES = ['MAX_WEIGHT', 'MAX_VOLUME', 'BEST_1RM', 'BEST_WEIGHT_FOR_REPS'] as const
export type PRType = (typeof PR_TYPES)[number]

/**
 * Estimated 1RM — single source of truth. Epley formula: w * (1 + reps/30).
 * Conservative, well-established, safe for the whole rep range we care about.
 * Returns 0 for invalid input. Rounded to 2 decimals to avoid float noise.
 */
export function estimate1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0
  return Math.round(weightKg * (1 + reps / 30) * 100) / 100
}

/** Round volume / weights to 2 decimals for stable comparisons and output. */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export interface CompletedSetRef {
  weightKg: number
  reps: number
  estimated1RM: number
  performedAt: Date
}

export interface ExerciseHistory {
  /** False when the user has no prior completed working set for this exercise. */
  hasHistory: boolean
  maxWeightKg: number
  maxVolume: number
  best1RM: number
  /** Best weight ever achieved at each exact rep count. */
  bestWeightByReps: Record<number, number>
  /** Most recent completed working set. */
  lastSet: CompletedSetRef | null
  /** Highest estimated-1RM completed working set. */
  bestSet: CompletedSetRef | null
}

const EMPTY_HISTORY: ExerciseHistory = {
  hasHistory: false,
  maxWeightKg: 0,
  maxVolume: 0,
  best1RM: 0,
  bestWeightByReps: {},
  lastSet: null,
  bestSet: null,
}

/**
 * Fetch the historical baseline for an exercise: only WORKING / NONE / checked
 * sets with reps>0 & weight>0, drawn from this user's TrainingLogs that finished
 * strictly before `beforeStartedAt`. The current log is excluded explicitly as a
 * second guard so an in-progress (or just-finished) session can never leak in.
 */
export async function getExerciseHistory(
  db: DbClient,
  userId: string,
  exerciseId: string,
  beforeStartedAt: Date,
  excludeLogId: string,
): Promise<ExerciseHistory> {
  const rows = await db.setLog.findMany({
    where: {
      exerciseId,
      setType: 'WORKING',
      technique: 'NONE',
      isChecked: true,
      repsCompleted: { gt: 0 },
      weightKg: { gt: 0 },
      trainingLogId: { not: excludeLogId },
      trainingLog: {
        userId,
        finishedAt: { not: null, lt: beforeStartedAt },
      },
    },
    select: {
      weightKg: true,
      repsCompleted: true,
      checkedAt: true,
      trainingLog: { select: { finishedAt: true } },
    },
  })

  if (rows.length === 0) return { ...EMPTY_HISTORY, bestWeightByReps: {} }

  const acc: ExerciseHistory = {
    hasHistory: true,
    maxWeightKg: 0,
    maxVolume: 0,
    best1RM: 0,
    bestWeightByReps: {},
    lastSet: null,
    bestSet: null,
  }

  for (const r of rows) {
    const weightKg = r.weightKg ?? 0
    const reps = r.repsCompleted ?? 0
    if (weightKg <= 0 || reps <= 0) continue
    const volume = weightKg * reps
    const e1rm = estimate1RM(weightKg, reps)
    const performedAt = r.checkedAt ?? r.trainingLog.finishedAt ?? new Date(0)

    if (weightKg > acc.maxWeightKg) acc.maxWeightKg = weightKg
    if (volume > acc.maxVolume) acc.maxVolume = volume
    if (e1rm > acc.best1RM) acc.best1RM = e1rm

    const prevForReps = acc.bestWeightByReps[reps]
    if (prevForReps === undefined || weightKg > prevForReps) {
      acc.bestWeightByReps[reps] = weightKg
    }

    const ref: CompletedSetRef = { weightKg, reps, estimated1RM: e1rm, performedAt }
    if (!acc.bestSet || e1rm > acc.bestSet.estimated1RM) acc.bestSet = ref
    if (!acc.lastSet || performedAt > acc.lastSet.performedAt) acc.lastSet = ref
  }

  acc.maxWeightKg = round2(acc.maxWeightKg)
  acc.maxVolume = round2(acc.maxVolume)
  return acc
}

export interface SetInput {
  weightKg: number
  repsCompleted: number
  setType: string
  technique: string
}

/** A set can only ever be a PR if it is a clean working set. */
export function isEligibleForPR(set: SetInput): boolean {
  return (
    set.setType === 'WORKING' &&
    set.technique === 'NONE' &&
    set.weightKg > 0 &&
    set.repsCompleted > 0
  )
}

export interface SetPRResult {
  isPR: boolean
  prTypes: PRType[]
  current: { weightKg: number; reps: number; volume: number; estimated1RM: number }
  /** Historical values the set was compared against (null when no history). */
  previous: {
    maxWeightKg: number | null
    maxVolume: number | null
    best1RM: number | null
    bestWeightForReps: number | null
  }
  /** Backward-compatible best historical set, when one exists. */
  previousBest: { weightKg: number; reps: number } | null
}

/**
 * Detect which PR types a set beats versus the frozen historical baseline.
 * Returns isPR=false (no types) when the set is ineligible or the user has no
 * history — the first-ever entry is never a PR.
 */
export function detectSetPRs(set: SetInput, history: ExerciseHistory): SetPRResult {
  const volume = round2(set.weightKg * set.repsCompleted)
  const estimated1RM = estimate1RM(set.weightKg, set.repsCompleted)
  const prevWeightForReps = history.bestWeightByReps[set.repsCompleted] ?? null

  const prTypes: PRType[] = []
  if (isEligibleForPR(set) && history.hasHistory) {
    if (set.weightKg > history.maxWeightKg) prTypes.push('MAX_WEIGHT')
    if (volume > history.maxVolume) prTypes.push('MAX_VOLUME')
    if (estimated1RM > history.best1RM) prTypes.push('BEST_1RM')
    if (prevWeightForReps !== null && set.weightKg > prevWeightForReps) {
      prTypes.push('BEST_WEIGHT_FOR_REPS')
    }
  }

  return {
    isPR: prTypes.length > 0,
    prTypes,
    current: { weightKg: set.weightKg, reps: set.repsCompleted, volume, estimated1RM },
    previous: {
      maxWeightKg: history.hasHistory ? history.maxWeightKg : null,
      maxVolume: history.hasHistory ? history.maxVolume : null,
      best1RM: history.hasHistory ? history.best1RM : null,
      bestWeightForReps: prevWeightForReps,
    },
    previousBest: history.bestSet
      ? { weightKg: history.bestSet.weightKg, reps: history.bestSet.reps }
      : null,
  }
}

export interface ExerciseReference {
  exerciseId: string
  hasHistory: boolean
  lastSet: { weightKg: number; reps: number; estimated1RM: number } | null
  bestSet: { weightKg: number; reps: number; estimated1RM: number } | null
  best1RM: number | null
  maxWeightKg: number | null
  /** Previous best weight per rep count — frontend targets to beat. */
  bestWeightByReps: Record<number, number>
}

/** Shape the historical baseline into progressive-overload references for the UI. */
export function buildExerciseReference(exerciseId: string, history: ExerciseHistory): ExerciseReference {
  const toRef = (s: CompletedSetRef | null) =>
    s ? { weightKg: s.weightKg, reps: s.reps, estimated1RM: s.estimated1RM } : null
  return {
    exerciseId,
    hasHistory: history.hasHistory,
    lastSet: toRef(history.lastSet),
    bestSet: toRef(history.bestSet),
    best1RM: history.hasHistory ? history.best1RM : null,
    maxWeightKg: history.hasHistory ? history.maxWeightKg : null,
    bestWeightByReps: history.bestWeightByReps,
  }
}
