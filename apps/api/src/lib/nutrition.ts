import type { Macros } from '@ironsynk/shared'

// Food macros are stored per 100g (project convention). Scale to a logged
// quantity in grams. Fiber is optional at the source; it stays null when the
// food has no fiber value so we never fabricate data.
export interface FoodMacroSource {
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number | null
}

function round(value: number): number {
  // One decimal is plenty for a diet-adherence UI and avoids float noise.
  return Math.round(value * 10) / 10
}

export function macrosForQuantity(food: FoodMacroSource, quantityG: number): Macros {
  const factor = quantityG / 100
  return {
    calories: round(food.calories * factor),
    proteinG: round(food.proteinG * factor),
    carbsG: round(food.carbsG * factor),
    fatG: round(food.fatG * factor),
    fiberG: food.fiberG === null ? null : round(food.fiberG * factor),
  }
}

// Sum a list of macro payloads into a single total. Fiber sums only the
// present values and reports null when every food lacked fiber data.
export function sumMacros(list: Macros[]): Macros {
  const total: Macros = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: null }
  for (const m of list) {
    total.calories += m.calories
    total.proteinG += m.proteinG
    total.carbsG += m.carbsG
    total.fatG += m.fatG
    if (m.fiberG !== null) {
      total.fiberG = (total.fiberG ?? 0) + m.fiberG
    }
  }
  return {
    calories: round(total.calories),
    proteinG: round(total.proteinG),
    carbsG: round(total.carbsG),
    fatG: round(total.fatG),
    fiberG: total.fiberG === null ? null : round(total.fiberG),
  }
}
