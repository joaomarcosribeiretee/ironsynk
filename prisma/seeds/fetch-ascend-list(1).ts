// IronSynk — Step 1: Fetch AscendAPI exercise list
// Saves all exercises to prisma/seeds/ascend-exercises.json
// Use this to find the correct exerciseId for each of our exercises
//
// Run: npx tsx prisma/seeds/fetch-ascend-list.ts

import 'dotenv/config'
import { writeFileSync } from 'fs'

const RAPIDAPI_KEY = process.env.EXERCISEDB_API_KEY!
const RAPIDAPI_HOST = 'edb-with-videos-and-images-by-ascendapi.p.rapidapi.com'
const BASE_URL = `https://${RAPIDAPI_HOST}`
const HEADERS = {
  'x-rapidapi-key': RAPIDAPI_KEY,
  'x-rapidapi-host': RAPIDAPI_HOST,
}

const MAX_EXERCISES = 1500

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  console.log('⬇️  Fetching all exercises from AscendAPI...\n')

  let cursor: string | null = null
  let page = 0
  const all: any[] = []

  while (true) {
    const url = `${BASE_URL}/api/v1/exercises?limit=200${cursor ? `&cursor=${cursor}` : ''}`
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) { console.error(`Error: ${res.status}`); break }
    const json = await res.json() as any

    all.push(...json.data)
    page++
    process.stdout.write(`\r  Page ${page} | ${all.length} exercises fetched`)

    if (!json.meta.hasNextPage || all.length >= MAX_EXERCISES) break
    cursor = json.meta.nextCursor
    await sleep(200)
  }

  console.log(`\n\n✅ Total: ${all.length} exercises\n`)

  // Save compact version for easy lookup
  const compact = all.map((ex: any) => ({
    id: ex.exerciseId,
    name: ex.name,
    bodyParts: ex.bodyParts,
    equipments: ex.equipments,
  }))

  writeFileSync(
    'prisma/seeds/ascend-exercises.json',
    JSON.stringify(compact, null, 2)
  )

  console.log('📄 Saved to prisma/seeds/ascend-exercises.json')
  console.log('📌 Next: search this file to find the correct exerciseId')
  console.log('   for each exercise and fill in prisma/seeds/gif-map.ts\n')
}

main().catch(console.error)
