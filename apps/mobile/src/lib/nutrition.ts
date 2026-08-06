import type { FoodRecord, MacrosRecord, ServingUnit } from './api'

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

// A portion as the user entered it, alongside the food it belongs to.
export type Portion = {
  quantityG: number
  servingUnit?: ServingUnit | null
  servingQuantity?: number | null
  food: Pick<FoodRecord, 'baseUnit' | 'servingSizeG' | 'servingLabel'>
}

// The weight/volume unit a food's values are stated in. Sources publish either
// one; we never convert between them, so this is only ever read, never derived.
export function baseUnitOf(food: { baseUnit?: 'g' | 'ml' | null }): 'g' | 'ml' {
  return food.baseUnit === 'ml' ? 'ml' : 'g'
}

// Can this food be logged in servings? Only when its source published one.
export function hasServing(food: { servingSizeG?: number | null }): boolean {
  return typeof food.servingSizeG === 'number' && food.servingSizeG > 0
}

// One serving spelled out, e.g. "porção (30 g)". Uses the source's own wording
// when it published a label.
export function servingOptionLabel(food: Pick<FoodRecord, 'baseUnit' | 'servingSizeG' | 'servingLabel'>): string {
  return `porção (${fmt(food.servingSizeG)} ${baseUnitOf(food)})`
}

// How a portion reads in a list: the unit the user picked leads, and its
// weight equivalent follows only when it adds information (servings).
// Rows logged before serving units existed read as plain grams.
export function servingLabel(p: Portion): string {
  const base = baseUnitOf(p.food)
  const qty = p.servingQuantity
  if (p.servingUnit !== 'serving' || qty === null || qty === undefined) {
    return `${fmt(p.quantityG)} ${base}`
  }
  const noun = qty === 1 ? 'porção' : 'porções'
  return `${fmt(qty)} ${noun} · ${fmt(p.quantityG)} ${base}`
}

// Same wording without the weight equivalent, for rows too tight to carry it.
export function servingLabelShort(p: Portion): string {
  const qty = p.servingQuantity
  if (p.servingUnit !== 'serving' || qty === null || qty === undefined) {
    return `${fmt(p.quantityG)} ${baseUnitOf(p.food)}`
  }
  return `${fmt(qty)} ${qty === 1 ? 'porção' : 'porções'}`
}

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

// Meals always read in clock order. Untimed meals have no place on the clock,
// so they settle at the end keeping their stored order between themselves.
export function sortMealsByTime<T extends { targetTimeHour: number | null; order: number }>(meals: T[]): T[] {
  return [...meals].sort((a, b) => {
    const ta = a.targetTimeHour ?? Infinity
    const tb = b.targetTimeHour ?? Infinity
    return ta === tb ? a.order - b.order : ta - tb
  })
}

export function clampPct(consumed: number, target: number | null): number {
  if (!target || target <= 0) return 0
  return Math.min(100, Math.round((consumed / target) * 100))
}
