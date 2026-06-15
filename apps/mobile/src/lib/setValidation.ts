// Shared completion validation for Workout Execution.
// One source of truth for every set type (normal, warmup, feeder, back-off and
// all advanced techniques). Each validator returns either { ok: true } or
// { ok: false, message } — the caller shows the message via toast and blocks
// completion. Never throws, never returns silently: every invalid state maps to
// a clear Portuguese message consistent with the IronSynk feedback voice.

import type { PlannedSetTechnique } from './api'

export type ValidationResult = { ok: true } | { ok: false; message: string }

const VALID: ValidationResult = { ok: true }

function fail(message: string): ValidationResult {
  return { ok: false, message }
}

function isMissingReps(reps: string): boolean {
  return !reps || parseInt(reps, 10) <= 0
}

function isMissingWeight(weight: string): boolean {
  return !weight || parseFloat(weight) <= 0
}

// ─── Simple sets: NONE, BACK_OFF, WARMUP, FEEDER ────────────────────────────────
// Every simple set — including warmup and feeder — needs reps and load to be
// considered complete.

export function validateSimpleSet(reps: string, weight: string): ValidationResult {
  const missingReps = isMissingReps(reps)
  const missingWeight = isMissingWeight(weight)
  if (missingReps && missingWeight) return fail('Preencha reps e carga para concluir a série.')
  if (missingReps) return fail('Informe as repetições para concluir a série.')
  if (missingWeight) return fail('Informe a carga (kg) para concluir a série.')
  return VALID
}

// ─── Block-based techniques: REST_PAUSE, CLUSTER_SET, MUSCLE_ROUND, DROP_SET, MYOREP ─

export type BlockInput = { reps: string; weight: string; failed?: boolean }

type TechniqueValidationInput = {
  technique: PlannedSetTechnique
  blocks: BlockInput[]
  mainWeight: string
  dropWeight: string
  // human label for each block, used to point the user at the missing field
  blockLabel: (i: number) => string
}

export function validateTechniqueSet(input: TechniqueValidationInput): ValidationResult {
  const { technique, blocks, mainWeight, dropWeight, blockLabel } = input

  // 1. Shared main weight requirement.
  if (technique === 'REST_PAUSE' || technique === 'CLUSTER_SET' || technique === 'MYOREP') {
    if (isMissingWeight(mainWeight)) return fail('Informe a carga (kg) para concluir a série.')
  }
  if (technique === 'MUSCLE_ROUND') {
    if (isMissingWeight(mainWeight)) return fail('Informe a carga principal para concluir a série.')
    const hasFailed = blocks.some(b => !!b.failed)
    if (hasFailed && isMissingWeight(dropWeight)) {
      return fail('Informe o peso de queda para concluir a série.')
    }
  }

  // 2. DROP_SET per-block weights are entered during execution.
  if (technique === 'DROP_SET' && blocks.some(b => isMissingWeight(b.weight))) {
    return fail('Informe o peso de cada drop para concluir a série.')
  }

  // 3. Every block must have reps.
  const missingBlocks = blocks
    .map((b, i) => (isMissingReps(b.reps) ? blockLabel(i) : null))
    .filter((l): l is string => l != null)
  if (missingBlocks.length > 0) {
    return fail(`Preencha as reps de: ${missingBlocks.join(', ')}.`)
  }

  return VALID
}
