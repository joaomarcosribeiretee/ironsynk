// Resilient Open Food Facts (OFF) client.
//
// OFF is a free, community-maintained food database. Data quality varies wildly:
// missing macros, missing names, values in odd units. Every function here is
// defensive — it must NEVER throw into the request pipeline. On any failure
// (network, timeout, bad JSON, missing fields) it returns an empty result so
// the API keeps working with just the local Food table.

import type { FoodSearchResult } from '@ironsynk/shared'

const OFF_BASE = 'https://world.openfoodfacts.org'
const REQUEST_TIMEOUT_MS = 4000

// OFF asks clients to identify themselves via User-Agent. Reuse the app id from
// env when present so we play nice with their rate limits.
function userAgent(): string {
  const appId = process.env['OPEN_FOOD_FACTS_APP_ID']
  return appId ? `IronSynk/1.0 (${appId})` : 'IronSynk/1.0'
}

async function offFetch(url: string): Promise<unknown | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': userAgent(), Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    // Network error, timeout, aborted, invalid JSON — swallow and degrade.
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// OFF numeric fields arrive as number | string | undefined. Normalize to a
// finite non-negative number, or null when unusable.
function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(',', '.'))
    if (Number.isFinite(parsed) && parsed >= 0) return parsed
  }
  return null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

// Map a raw OFF product to our per-100g search-result shape. Returns null when
// the product lacks the minimum usable data (a name + at least calories).
export function normalizeOffProduct(raw: unknown): FoodSearchResult | null {
  if (typeof raw !== 'object' || raw === null) return null
  const product = raw as Record<string, unknown>

  const code = str(product['code']) ?? str(product['_id'])
  if (!code) return null

  const name =
    str(product['product_name']) ??
    str(product['product_name_en']) ??
    str(product['generic_name'])
  if (!name) return null

  const nutriments = (product['nutriments'] ?? {}) as Record<string, unknown>

  // OFF exposes *_100g fields for per-100g values, which is exactly our unit.
  const calories =
    num(nutriments['energy-kcal_100g']) ??
    // energy_100g is kJ; convert to kcal as a fallback.
    (num(nutriments['energy_100g']) !== null
      ? Math.round((num(nutriments['energy_100g']) as number) / 4.184)
      : null)
  if (calories === null) return null

  return {
    id: `off:${code}`,
    name,
    brand: str(product['brands']),
    calories,
    proteinG: num(nutriments['proteins_100g']) ?? 0,
    carbsG: num(nutriments['carbohydrates_100g']) ?? 0,
    fatG: num(nutriments['fat_100g']) ?? 0,
    fiberG: num(nutriments['fiber_100g']),
    isCustom: false,
    createdById: null,
    sourceId: code,
    source: 'off',
  }
}

// Search OFF by free text. Always returns an array (possibly empty).
export async function searchOpenFoodFacts(query: string, limit: number): Promise<FoodSearchResult[]> {
  const url =
    `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=${limit}` +
    `&fields=code,product_name,product_name_en,generic_name,brands,nutriments`

  const data = await offFetch(url)
  if (typeof data !== 'object' || data === null) return []
  const products = (data as Record<string, unknown>)['products']
  if (!Array.isArray(products)) return []

  const results: FoodSearchResult[] = []
  for (const p of products) {
    const normalized = normalizeOffProduct(p)
    if (normalized) results.push(normalized)
  }
  return results
}

// Fetch a single OFF product by barcode/id, normalized. Returns null on any
// failure or if the product is unusable.
export async function getOpenFoodFactsProduct(code: string): Promise<FoodSearchResult | null> {
  const url =
    `${OFF_BASE}/api/v2/product/${encodeURIComponent(code)}.json` +
    `?fields=code,product_name,product_name_en,generic_name,brands,nutriments`

  const data = await offFetch(url)
  if (typeof data !== 'object' || data === null) return null
  const record = data as Record<string, unknown>
  if (record['status'] === 0) return null // OFF "product not found" sentinel
  return normalizeOffProduct(record['product'])
}
