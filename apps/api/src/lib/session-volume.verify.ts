/**
 * Lightweight verification for session volume rules.
 * Run: npx tsx apps/api/src/lib/session-volume.verify.ts
 */
import assert from 'node:assert/strict'
import { computeSessionTotals } from './session-volume.js'

let passed = 0
function check(name: string, fn: () => void): void {
  fn()
  passed++
  console.log(`  ok  ${name}`)
}

const set = (
  setType: string,
  opts: { isChecked?: boolean; reps?: number; weight?: number } = {},
) => ({
  setType,
  isChecked: opts.isChecked ?? true,
  repsCompleted: opts.reps ?? 10,
  weightKg: opts.weight ?? 100,
})

console.log('computeSessionTotals')
check('WORKING checked counts toward volume and valid sets', () => {
  const t = computeSessionTotals([set('WORKING')])
  assert.equal(t.totalSets, 1)
  assert.equal(t.totalValidSets, 1)
  assert.equal(t.totalVolume, 1000)
})
check('WARMUP excluded from volume and valid sets', () => {
  const t = computeSessionTotals([set('WARMUP'), set('WORKING', { reps: 8, weight: 50 })])
  assert.equal(t.totalSets, 2)
  assert.equal(t.totalValidSets, 1)
  assert.equal(t.totalVolume, 400)
})
check('FEEDER excluded from volume and valid sets', () => {
  const t = computeSessionTotals([set('FEEDER', { reps: 12, weight: 40 }), set('WORKING')])
  assert.equal(t.totalValidSets, 1)
  assert.equal(t.totalVolume, 1000)
})
check('unchecked WORKING excluded from volume and valid sets', () => {
  const t = computeSessionTotals([set('WORKING', { isChecked: false })])
  assert.equal(t.totalValidSets, 0)
  assert.equal(t.totalVolume, 0)
  assert.equal(t.totalSets, 1)
})
check('zero reps or weight do not add volume but count as valid if checked WORKING', () => {
  const t = computeSessionTotals([
    set('WORKING', { reps: 0, weight: 100 }),
    set('WORKING', { reps: 5, weight: 0 }),
  ])
  assert.equal(t.totalValidSets, 2)
  assert.equal(t.totalVolume, 0)
})

console.log(`\n${passed} checks passed`)
