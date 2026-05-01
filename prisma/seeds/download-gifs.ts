// IronSynk — Exercise Image Download Script v5
// Source: AscendAPI — requires EXERCISEDB_API_KEY
//
// Run with: npx tsx prisma/seeds/download-gifs.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { createClient } from '@supabase/supabase-js'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const RAPIDAPI_KEY = process.env.EXERCISEDB_API_KEY!
const RAPIDAPI_HOST = 'edb-with-videos-and-images-by-ascendapi.p.rapidapi.com'
const BASE_URL = `https://${RAPIDAPI_HOST}`
const BUCKET = 'exercises'
const PAGE_DELAY_MS = 150   // delay between pagination calls
const UPLOAD_DELAY_MS = 200 // delay between uploads
const MAX_PAGES = 200       // safety cap (~5000 exercises max)

const HEADERS = {
  'x-rapidapi-key': RAPIDAPI_KEY,
  'x-rapidapi-host': RAPIDAPI_HOST,
}

type AscendExercise = {
  exerciseId: string
  name: string
  imageUrl: string
  imageUrls?: { '360p'?: string; '480p'?: string; '720p'?: string; '1080p'?: string }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function similarity(sourceId: string, exerciseName: string): number {
  const queryWords = normalize(sourceId.replace(/-/g, ' ')).split(' ').filter(w => w.length > 2)
  const nameWords = normalize(exerciseName).split(' ')
  const common = queryWords.filter(w => nameWords.includes(w)).length
  return common / queryWords.length
}

// Fetch one page of exercises from AscendAPI
async function fetchPage(cursor: string | null): Promise<{ data: AscendExercise[]; nextCursor: string | null; hasMore: boolean }> {
  const url = `${BASE_URL}/api/v1/exercises?limit=200${cursor ? `&cursor=${cursor}` : ''}`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`AscendAPI ${res.status}: ${await res.text()}`)
  const json = await res.json() as { meta: { hasNextPage: boolean; nextCursor: string }; data: AscendExercise[] }
  return {
    data: json.data,
    nextCursor: json.meta.hasNextPage ? json.meta.nextCursor : null,
    hasMore: json.meta.hasNextPage,
  }
}

async function downloadAndUpload(imageUrl: string, sourceId: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    const ext = imageUrl.toLowerCase().includes('.gif') ? 'gif' : 'jpg'
    const path = `${sourceId}.${ext}`

    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType: ext === 'gif' ? 'image/gif' : 'image/jpeg',
      upsert: true,
      cacheControl: '31536000',
    })
    if (error) { console.error(`\n  ❌ Upload: ${error.message}`); return null }

    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  } catch {
    return null
  }
}

async function main() {
  console.log('🖼️  IronSynk — Exercise Image Script v5')
  console.log(`🔑 AscendAPI — stop-early strategy\n`)

  if (!RAPIDAPI_KEY) { console.error('❌ EXERCISEDB_API_KEY not set'); process.exit(1) }

  const dbExercises = await prisma.exercise.findMany({
    where: { gifUrl: null, isCustom: false },
    orderBy: { muscleGroup: 'asc' },
  })
  console.log(`📋 ${dbExercises.length} exercises in DB without image\n`)

  // Build sourceId → best match map as we paginate
  const matched = new Map<string, AscendExercise>()   // sourceId → best AscendExercise
  const matchScore = new Map<string, number>()         // sourceId → current best score
  const PERFECT = 1.0

  let cursor: string | null = null
  let page = 0
  let perfectCount = 0

  console.log('⬇️  Paginating AscendAPI — stopping when all exercises matched...\n')

  while (page < MAX_PAGES) {
    const { data, nextCursor, hasMore } = await fetchPage(cursor)
    page++

    for (const ex of data) {
      for (const dbEx of dbExercises) {
        const sid = dbEx.sourceId ?? dbEx.name
        const score = similarity(sid, ex.name)
        const current = matchScore.get(sid) ?? 0
        if (score > current) {
          matched.set(sid, ex)
          matchScore.set(sid, score)
          if (score >= PERFECT) perfectCount++
        }
      }
    }

    const totalFetched = page * data.length
    const matchedCount = [...matchScore.values()].filter(s => s >= 0.5).length
    process.stdout.write(`\r  📦 Page ${page} | ~${totalFetched} fetched | ${matchedCount}/${dbExercises.length} matched (${perfectCount} perfect)   `)

    // Stop early if all are well-matched (score ≥ 0.8)
    const wellMatched = [...matchScore.values()].filter(s => s >= 0.8).length
    if (wellMatched >= dbExercises.length * 0.95 || !hasMore) break

    cursor = nextCursor
    await sleep(PAGE_DELAY_MS)
  }

  console.log('\n')

  // Upload images
  let success = 0, notFound = 0, failed = 0
  const notFoundList: string[] = []

  for (const dbEx of dbExercises) {
    const sid = dbEx.sourceId ?? dbEx.name
    const score = matchScore.get(sid) ?? 0
    const match = matched.get(sid)

    process.stdout.write(`  [${dbEx.muscleGroup}] ${dbEx.name}...`)

    if (!match || score < 0.4) {
      process.stdout.write(` ⚠️  no match (best: ${(score * 100).toFixed(0)}%)\n`)
      notFound++
      notFoundList.push(`${dbEx.name} → ${sid}`)
      continue
    }

    const imageUrl = match.imageUrls?.['720p'] ?? match.imageUrl
    const storedUrl = await downloadAndUpload(imageUrl, sid)

    if (!storedUrl) {
      process.stdout.write(` ❌ upload failed\n`)
      failed++
      await sleep(UPLOAD_DELAY_MS)
      continue
    }

    await prisma.exercise.update({ where: { id: dbEx.id }, data: { gifUrl: storedUrl } })
    process.stdout.write(` ✅ "${match.name}" (${(score * 100).toFixed(0)}%)\n`)
    success++
    await sleep(UPLOAD_DELAY_MS)
  }

  console.log('\n─────────────────────────────────────────')
  console.log(`✅ ${success} images saved`)
  console.log(`⚠️  ${notFound} no match`)
  console.log(`❌ ${failed} failed`)
  if (notFoundList.length > 0) {
    console.log('\nNo match for:')
    notFoundList.forEach(e => console.log(`  - ${e}`))
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
