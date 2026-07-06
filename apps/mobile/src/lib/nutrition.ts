import type { MacrosRecord } from './api'

// Brand-aligned macro accent colors, reused across every nutrition screen so
// protein/carbs/fat read consistently.
export const MACRO_COLORS = {
  calories: '#4FC3F7',
  protein: '#2979FF',
  carbs: '#FFB300',
  fat: '#FF5252',
} as const

// Compact number: drop trailing ".0", keep one decimal otherwise.
export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10)
}

export function fmtGrams(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : `${fmt(n)}g`
}

export const EMPTY_MACROS: MacrosRecord = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: null }

// Sum a list of macro payloads (client-side preview while editing).
export function sumMacros(list: MacrosRecord[]): MacrosRecord {
  const t: MacrosRecord = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: null }
  for (const m of list) {
    t.calories += m.calories
    t.proteinG += m.proteinG
    t.carbsG += m.carbsG
    t.fatG += m.fatG
    if (m.fiberG !== null) t.fiberG = (t.fiberG ?? 0) + m.fiberG
  }
  const r = (v: number) => Math.round(v * 10) / 10
  return {
    calories: r(t.calories),
    proteinG: r(t.proteinG),
    carbsG: r(t.carbsG),
    fatG: r(t.fatG),
    fiberG: t.fiberG === null ? null : r(t.fiberG),
  }
}

// Scale a per-100g food to a gram quantity (live preview before saving).
export function macrosForQuantity(
  food: { calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number | null },
  quantityG: number,
): MacrosRecord {
  const f = quantityG / 100
  const r = (v: number) => Math.round(v * 10) / 10
  return {
    calories: r(food.calories * f),
    proteinG: r(food.proteinG * f),
    carbsG: r(food.carbsG * f),
    fatG: r(food.fatG * f),
    fiberG: food.fiberG === null ? null : r(food.fiberG * f),
  }
}

export function clampPct(consumed: number, target: number | null): number {
  if (!target || target <= 0) return 0
  return Math.min(100, Math.round((consumed / target) * 100))
}
