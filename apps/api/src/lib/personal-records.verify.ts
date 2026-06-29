/**
 * Lightweight verification for the personal-records pure logic.
 * Run: npx tsx apps/api/src/lib/personal-records.verify.ts
 *
 * Covers the hard rules: no PR without history, never compare within the same
 * session (baseline is frozen historical input), eligibility filters, and each
 * of the 4 MVP PR types.
 */
import assert from 'node:assert/strict'
import {
  estimate1RM,
  detectSetPRs,
  isEligibleForPR,
  type ExerciseHistory,
} from './personal-records.js'

let passed = 0
function check(name: string, fn: () => void): void {
  fn()
  passed++
  console.log(`  ok  ${name}`)
}

const noHistory: ExerciseHistory = {
  hasHistory: false,
  maxWeightKg: 0,
  maxVolume: 0,
  best1RM: 0,
  bestWeightByReps: {},
  lastSet: null,
  bestSet: null,
}

// history: best ever was 100kg x 5 (volume 500, e1RM ~116.67), and 80kg x 10 (best @10 reps)
const history: ExerciseHistory = {
  hasHistory: true,
  maxWeightKg: 100,
  maxVolume: 500,
  best1RM: estimate1RM(100, 5),
  bestWeightByReps: { 5: 100, 10: 80 },
  lastSet: { weightKg: 100, reps: 5, estimated1RM: estimate1RM(100, 5), performedAt: new Date() },
  bestSet: { weightKg: 100, reps: 5, estimated1RM: estimate1RM(100, 5), performedAt: new Date() },
}

const working = (weightKg: number, repsCompleted: number) => ({
  weightKg,
  repsCompleted,
  setType: 'WORKING',
  technique: 'NONE',
})

console.log('estimate1RM')
check('Epley values', () => {
  assert.equal(estimate1RM(100, 1), 103.33)
  assert.equal(estimate1RM(100, 10), 133.33)
})
check('invalid input → 0', () => {
  assert.equal(estimate1RM(0, 5), 0)
  assert.equal(estimate1RM(100, 0), 0)
  assert.equal(estimate1RM(-10, 5), 0)
})

console.log('eligibility')
check('only WORKING + NONE + positive reps/weight', () => {
  assert.equal(isEligibleForPR(working(100, 5)), true)
  assert.equal(isEligibleForPR({ ...working(100, 5), setType: 'WARMUP' }), false)
  assert.equal(isEligibleForPR({ ...working(100, 5), setType: 'FEEDER' }), false)
  assert.equal(isEligibleForPR({ ...working(100, 5), technique: 'DROP_SET' }), false)
  assert.equal(isEligibleForPR(working(0, 5)), false)
  assert.equal(isEligibleForPR(working(100, 0)), false)
})

console.log('no history (first-ever entry)')
check('never a PR without history', () => {
  const r = detectSetPRs(working(999, 20), noHistory)
  assert.equal(r.isPR, false)
  assert.deepEqual(r.prTypes, [])
  assert.equal(r.previous.maxWeightKg, null)
  assert.equal(r.previousBest, null)
})

console.log('intra-session safety (frozen baseline)')
check('set equal to history is not a PR', () => {
  // simulates set 1 == history best; set 2 compared to same frozen history, not set 1
  const r = detectSetPRs(working(100, 5), history)
  assert.equal(r.isPR, false)
  assert.deepEqual(r.prTypes, [])
})
check('beating only history (not prior set) is the sole PR source', () => {
  // a heavier set beats history regardless of any same-session set
  const r = detectSetPRs(working(105, 5), history)
  assert.ok(r.prTypes.includes('MAX_WEIGHT'))
})

console.log('PR types')
check('MAX_WEIGHT', () => {
  const r = detectSetPRs(working(101, 3), history)
  assert.ok(r.prTypes.includes('MAX_WEIGHT'))
})
check('MAX_VOLUME', () => {
  // 60kg x 10 = 600 volume > 500, but 60 < maxWeight and below per-rep + e1RM
  const r = detectSetPRs(working(60, 10), history)
  assert.ok(r.prTypes.includes('MAX_VOLUME'))
  assert.ok(!r.prTypes.includes('MAX_WEIGHT'))
})
check('BEST_1RM', () => {
  // 95kg x 6 → e1RM 114 > 116.67? no. 100x6 → e1RM 120 > 116.67 yes
  const r = detectSetPRs(working(100, 6), history)
  assert.ok(r.prTypes.includes('BEST_1RM'))
})
check('BEST_WEIGHT_FOR_REPS only when prior at that rep count', () => {
  // 85kg @ 10 reps beats prior best @10 (80kg)
  const r = detectSetPRs(working(85, 10), history)
  assert.ok(r.prTypes.includes('BEST_WEIGHT_FOR_REPS'))
  // 50kg @ 7 reps: no prior @7 → no BEST_WEIGHT_FOR_REPS (and beats nothing)
  const r2 = detectSetPRs(working(50, 7), history)
  assert.ok(!r2.prTypes.includes('BEST_WEIGHT_FOR_REPS'))
})

console.log(`\nAll ${passed} checks passed.`)
