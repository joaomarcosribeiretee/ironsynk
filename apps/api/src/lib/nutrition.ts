import type { Food, Macros, ServingUnit } from '@ironsynk/shared'

// A Food row as Prisma returns it: the unit columns are plain strings there.
export type FoodRow = Omit<Food, 'baseUnit'> & { baseUnit: string | null }

// Narrow the free-text unit columns back to the shared unions before a food
// leaves the API. Unknown values read as "no unit stated".
export function foodView(food: FoodRow): Food {
  return { ...food, baseUnit: food.baseUnit === 'ml' ? 'ml' : food.baseUnit === 'g' ? 'g' : null }
}

export function servingUnitView(unit: string | null): ServingUnit | null {
  return unit === 'g' || unit === 'ml' || unit === 'serving' ? unit : null
}

// Resolve what gets stored for a portion. The gram amount macros are computed
// from stays server-authoritative: when the user picks servings it is the
// food's own published serving size times the count — never a client value and
// never a conversion we invented. Returns null when the food publishes no
// serving to multiply.
export function resolvePortion(
  food: { servingSizeG: number | null },
  input: { quantityG: number; servingUnit?: ServingUnit; servingQuantity?: number },
): { quantityG: number; servingUnit: ServingUnit | null; servingQuantity: number | null } | null {
  const { servingUnit, servingQuantity } = input
  if (servingUnit === undefined || servingQuantity === undefined) {
    return { quantityG: input.quantityG, servingUnit: null, servingQuantity: null }
  }
  if (servingUnit === 'serving') {
    if (food.servingSizeG === null || food.servingSizeG <= 0) return null
    return {
      quantityG: Math.round(servingQuantity * food.servingSizeG * 100) / 100,
      servingUnit,
      servingQuantity,
    }
  }
  // 'g' / 'ml' — the count is the amount itself.
  return { quantityG: servingQuantity, servingUnit, servingQuantity }
}

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
