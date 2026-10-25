/**
 * Session volume rules (CLAUDE product decision):
 * - Warmup / feeder sets are logged but excluded from volume.
 * - Only checked WORKING sets with positive reps and weight count.
 */

export interface VolumeSetInput {
  setType: string
  isChecked: boolean
  repsCompleted: number | null
  weightKg: number | null
}

export interface SessionTotals {
  totalSets: number
  totalValidSets: number
  totalVolume: number
}

export function computeSessionTotals(sets: VolumeSetInput[]): SessionTotals {
  let totalSets = 0
  let totalValidSets = 0
  let totalVolume = 0

  for (const s of sets) {
    totalSets++
    if (!s.isChecked || s.setType !== 'WORKING') continue
    totalValidSets++
    const reps = s.repsCompleted ?? 0
    const weight = s.weightKg ?? 0
    if (reps > 0 && weight > 0) {
      totalVolume += reps * weight
    }
  }

  return { totalSets, totalValidSets, totalVolume }
}
