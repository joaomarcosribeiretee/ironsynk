import { prisma } from './prisma.js'
import { estimate1RM } from './personal-records.js'

// ─────────────────────────────────────────────────────────────────────────────
// Workout analytics — the training dashboard behind Profile > Performance.
// All metrics are derived from existing data: finished TrainingLogs, their
// SetLogs and the PersonalRecord cache. No new tables. Volume / progression use
// only completed WORKING sets with positive reps & weight; progression and 1RM
// further restrict to technique NONE for clean, comparable estimates.
// ─────────────────────────────────────────────────────────────────────────────

const WEEKS_WINDOW = 8
const TOP_EXERCISES = 5
const PROGRESSION_EXERCISES = 3
const PROGRESSION_MIN_SESSIONS = 3
const PROGRESSION_MAX_POINTS = 12

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// Monday-based week index (whole weeks since the Unix epoch Monday).
function weekIndex(d: Date): number {
  const ms = d.getTime()
  // epoch (Thu 1970-01-01) → shift so Monday is the week boundary
  return Math.floor((ms / 86400000 + 3) / 7)
}

interface BestSet {
  weightKg: number
  reps: number
  e1rm: number
}

export interface WorkoutAnalytics {
  summary: {
    totalWorkouts: number
    totalMinutes: number
    totalVolume: number
    avgDurationMin: number
  }
  frequency: {
    workoutsPerWeek: number
    currentMonthCount: number
    weeks: { label: string; count: number }[]
    consistencyPct: number
    streakWeeks: number
  }
  personalRecords: {
    total: number
    latest: { exerciseName: string; weightKg: number; reps: number; estimated1RM: number; achievedAt: string } | null
    strongest: { exerciseName: string; weightKg: number; reps: number; estimated1RM: number } | null
  }
  muscleVolume: { muscleGroup: string; volume: number; setCount: number; pct: number }[]
  progression: { exerciseId: string; name: string; points: { date: string; best1RM: number }[] }[]
  exercises: {
    uniqueCount: number
    mostTrained: { name: string; sessions: number; totalSets: number } | null
    top: { name: string; sessions: number; totalSets: number }[]
  }
  records: {
    largestVolume: { value: number; workoutName: string; date: string } | null
    longestWorkout: { value: number; workoutName: string; date: string } | null
    mostSets: { value: number; workoutName: string; date: string } | null
  }
}

function emptyAnalytics(prTotal: number): WorkoutAnalytics {
  return {
    summary: { totalWorkouts: 0, totalMinutes: 0, totalVolume: 0, avgDurationMin: 0 },
    frequency: { workoutsPerWeek: 0, currentMonthCount: 0, weeks: [], consistencyPct: 0, streakWeeks: 0 },
    personalRecords: { total: prTotal, latest: null, strongest: null },
    muscleVolume: [],
    progression: [],
    exercises: { uniqueCount: 0, mostTrained: null, top: [] },
    records: { largestVolume: null, longestWorkout: null, mostSets: null },
  }
}

export async function computeWorkoutAnalytics(userId: string): Promise<WorkoutAnalytics> {
  const logs = await prisma.trainingLog.findMany({
    where: { userId, finishedAt: { not: null } },
    orderBy: { finishedAt: 'asc' },
    select: {
      id: true,
      workoutName: true,
      finishedAt: true,
      durationMin: true,
      totalVolume: true,
      totalSets: true,
      totalValidSets: true,
      executionExercises: {
        select: {
          exerciseId: true,
          exercise: { select: { name: true, muscleGroup: true } },
          setLogs: {
            select: { setType: true, technique: true, isChecked: true, repsCompleted: true, weightKg: true },
          },
        },
      },
    },
  })

  const prRecords = await prisma.personalRecord.findMany({
    where: { userId },
    orderBy: { achievedAt: 'desc' },
  })

  // Resolve PR exercise names (PersonalRecord has no relation to Exercise).
  const prExerciseIds = [...new Set(prRecords.map((p) => p.exerciseId))]
  const prExercises = prExerciseIds.length
    ? await prisma.exercise.findMany({ where: { id: { in: prExerciseIds } }, select: { id: true, name: true } })
    : []
  const exNameById = new Map(prExercises.map((e) => [e.id, e.name]))

  const personalRecords: WorkoutAnalytics['personalRecords'] = {
    total: prRecords.length,
    latest: null,
    strongest: null,
  }
  if (prRecords.length > 0) {
    const latest = prRecords[0]!
    personalRecords.latest = {
      exerciseName: exNameById.get(latest.exerciseId) ?? 'Exercício',
      weightKg: latest.weightKg,
      reps: latest.reps,
      estimated1RM: round1(latest.estimated1RM ?? estimate1RM(latest.weightKg, latest.reps)),
      achievedAt: latest.achievedAt.toISOString(),
    }
    const strongest = [...prRecords].sort(
      (a, b) =>
        (b.estimated1RM ?? estimate1RM(b.weightKg, b.reps)) - (a.estimated1RM ?? estimate1RM(a.weightKg, a.reps)),
    )[0]!
    personalRecords.strongest = {
      exerciseName: exNameById.get(strongest.exerciseId) ?? 'Exercício',
      weightKg: strongest.weightKg,
      reps: strongest.reps,
      estimated1RM: round1(strongest.estimated1RM ?? estimate1RM(strongest.weightKg, strongest.reps)),
    }
  }

  if (logs.length === 0) return { ...emptyAnalytics(prRecords.length), personalRecords }

  // ── Summary ──────────────────────────────────────────────────────────────
  const totalWorkouts = logs.length
  let totalMinutes = 0
  let totalVolume = 0
  for (const l of logs) {
    totalMinutes += l.durationMin ?? 0
    totalVolume += l.totalVolume ?? 0
  }
  const avgDurationMin = Math.round(totalMinutes / totalWorkouts)

  // ── Frequency ────────────────────────────────────────────────────────────
  const now = new Date()
  const currentWeek = weekIndex(now)
  const firstWeek = weekIndex(logs[0]!.finishedAt!)
  const spanWeeks = Math.max(1, currentWeek - firstWeek + 1)
  const workoutsPerWeek = round1(totalWorkouts / spanWeeks)

  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const currentMonthCount = logs.filter((l) => {
    const d = l.finishedAt!
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  }).length

  // last WEEKS_WINDOW weeks (oldest → newest), count per week
  const countByWeek = new Map<number, number>()
  for (const l of logs) {
    const w = weekIndex(l.finishedAt!)
    countByWeek.set(w, (countByWeek.get(w) ?? 0) + 1)
  }
  const weeks: { label: string; count: number }[] = []
  for (let i = WEEKS_WINDOW - 1; i >= 0; i--) {
    const w = currentWeek - i
    weeks.push({ label: `S${WEEKS_WINDOW - i}`, count: countByWeek.get(w) ?? 0 })
  }
  const activeWeeksInWindow = weeks.filter((w) => w.count > 0).length
  const consistencyPct = Math.round((activeWeeksInWindow / WEEKS_WINDOW) * 100)

  // consecutive-week streak ending at (or just before) the current week
  let streakWeeks = 0
  let cursor = countByWeek.get(currentWeek) ? currentWeek : countByWeek.get(currentWeek - 1) ? currentWeek - 1 : null
  if (cursor !== null) {
    while (countByWeek.get(cursor)) {
      streakWeeks++
      cursor--
    }
  }

  // ── Per-exercise aggregation (single pass over all logs) ──────────────────
  const muscleVol = new Map<string, { volume: number; setCount: number }>()
  type ExAgg = { name: string; sessions: number; totalSets: number; sessionBest: Map<string, BestSet> }
  const exAgg = new Map<string, ExAgg>()

  for (const l of logs) {
    const dateKey = l.id
    for (const ee of l.executionExercises) {
      const exId = ee.exerciseId
      const name = ee.exercise.name
      const muscle = ee.exercise.muscleGroup

      let agg = exAgg.get(exId)
      if (!agg) {
        agg = { name, sessions: 0, totalSets: 0, sessionBest: new Map() }
        exAgg.set(exId, agg)
      }

      let sessionHadWorkingSet = false
      let bestThisSession: BestSet | null = null

      for (const set of ee.setLogs) {
        const reps = set.repsCompleted ?? 0
        const weight = set.weightKg ?? 0
        const isWorking = set.isChecked && set.setType === 'WORKING' && reps > 0 && weight > 0
        if (!isWorking) continue
        sessionHadWorkingSet = true
        agg.totalSets++

        const mv = muscleVol.get(muscle) ?? { volume: 0, setCount: 0 }
        mv.volume += reps * weight
        mv.setCount++
        muscleVol.set(muscle, mv)

        // progression / 1RM: clean technique only
        if (set.technique === 'NONE') {
          const e1rm = estimate1RM(weight, reps)
          if (!bestThisSession || e1rm > bestThisSession.e1rm) bestThisSession = { weightKg: weight, reps, e1rm }
        }
      }

      if (sessionHadWorkingSet) agg.sessions++
      if (bestThisSession) agg.sessionBest.set(dateKey, bestThisSession)
    }
  }

  // ── Muscle volume distribution ────────────────────────────────────────────
  const totalMuscleVolume = [...muscleVol.values()].reduce((s, m) => s + m.volume, 0)
  const muscleVolume = [...muscleVol.entries()]
    .map(([muscleGroup, m]) => ({
      muscleGroup,
      volume: Math.round(m.volume),
      setCount: m.setCount,
      pct: totalMuscleVolume > 0 ? Math.round((m.volume / totalMuscleVolume) * 100) : 0,
    }))
    .sort((a, b) => b.volume - a.volume)

  // ── Exercise statistics ────────────────────────────────────────────────────
  const exList = [...exAgg.entries()]
    .map(([, a]) => ({ name: a.name, sessions: a.sessions, totalSets: a.totalSets }))
    .filter((e) => e.sessions > 0)
    .sort((a, b) => b.sessions - a.sessions || b.totalSets - a.totalSets)

  const exercises: WorkoutAnalytics['exercises'] = {
    uniqueCount: exList.length,
    mostTrained: exList[0] ?? null,
    top: exList.slice(0, TOP_EXERCISES),
  }

  // ── Strength progression — date-ordered best 1RM per top trained exercise ──
  const logDate = new Map(logs.map((l) => [l.id, l.finishedAt!.toISOString()]))
  const progression = [...exAgg.entries()]
    .map(([exerciseId, a]) => ({ exerciseId, name: a.name, sessionBest: a.sessionBest }))
    .filter((e) => e.sessionBest.size >= PROGRESSION_MIN_SESSIONS)
    .sort((a, b) => b.sessionBest.size - a.sessionBest.size)
    .slice(0, PROGRESSION_EXERCISES)
    .map((e) => {
      const points = [...e.sessionBest.entries()]
        .map(([logId, best]) => ({ date: logDate.get(logId)!, best1RM: round1(best.e1rm) }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-PROGRESSION_MAX_POINTS)
      return { exerciseId: e.exerciseId, name: e.name, points }
    })

  // ── General records ────────────────────────────────────────────────────────
  const pickMax = <T,>(value: (l: (typeof logs)[number]) => number) => {
    let best: (typeof logs)[number] | null = null
    let bestVal = 0
    for (const l of logs) {
      const v = value(l)
      if (v > bestVal) { bestVal = v; best = l }
    }
    return best ? { log: best, value: bestVal } : null
  }
  const toRecord = (r: { log: (typeof logs)[number]; value: number } | null, round = false) =>
    r ? { value: round ? Math.round(r.value) : r.value, workoutName: r.log.workoutName ?? 'Treino livre', date: r.log.finishedAt!.toISOString() } : null

  const records: WorkoutAnalytics['records'] = {
    largestVolume: toRecord(pickMax((l) => l.totalVolume ?? 0), true),
    longestWorkout: toRecord(pickMax((l) => l.durationMin ?? 0)),
    mostSets: toRecord(pickMax((l) => l.totalValidSets ?? 0)),
  }

  return {
    summary: { totalWorkouts, totalMinutes, totalVolume: Math.round(totalVolume), avgDurationMin },
    frequency: { workoutsPerWeek, currentMonthCount, weeks, consistencyPct, streakWeeks },
    personalRecords,
    muscleVolume,
    progression,
    exercises,
    records,
  }
}
