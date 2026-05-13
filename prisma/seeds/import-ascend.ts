// IronSynk — Import exercises from AscendAPI
// Imports all exercises filtered by relevant equipment
// Downloads 480p GIF and uploads to Supabase Storage
// Names stay in English — you'll curate and translate via admin screen
//
// Run: npx tsx prisma/seeds/import-ascend.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { createClient } from '@supabase/supabase-js'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const RAPIDAPI_KEY = process.env.EXERCISEDB_API_KEY!
const RAPIDAPI_HOST = 'edb-with-videos-and-images-by-ascendapi.p.rapidapi.com'
const BUCKET = 'exercises'
const DELAY_MS = 300

// Only import exercises with these equipment types
// This filters out obscure/irrelevant equipment
const ALLOWED_EQUIPMENT = new Set([
  'barbell', 'dumbbell', 'cable', 'machine', 'body weight',
  'kettlebell', 'smith machine', 'band', 'ez barbell',
  'leverage machine', 'assisted', 'weighted',
])

// Map AscendAPI bodyPart → our MuscleGroup enum
const BODY_PART_MAP: Record<string, string> = {
  'chest':           'CHEST',
  'back':            'BACK',
  'shoulders':       'SHOULDERS',
  'upper arms':      'BICEPS',    // will split by target muscle below
  'lower arms':      'FOREARMS',
  'upper legs':      'QUADS',     // will split by target muscle below
  'lower legs':      'CALVES',
  'waist':           'ABS',
  'glutes':          'GLUTES',
  'cardio':          'FULL_BODY',
}

// Refine muscle group based on target muscle
function resolveMuscleGroup(bodyPart: string, targetMuscles: string[]): string {
  const bp = bodyPart.toLowerCase()
  const targets = targetMuscles.map(t => t.toLowerCase())

  if (bp === 'upper arms') {
    const hasTriceps = targets.some(t => t.includes('tricep'))
    return hasTriceps ? 'TRICEPS' : 'BICEPS'
  }

  if (bp === 'upper legs') {
    const hasHamstrings = targets.some(t =>
      t.includes('hamstring') || t.includes('biceps femoris') || t.includes('gluteus')
    )
    const hasGlutes = targets.some(t => t.includes('glute'))
    if (hasGlutes && !hasHamstrings) return 'GLUTES'
    if (hasHamstrings) return 'HAMSTRINGS'
    return 'QUADS'
  }

  return BODY_PART_MAP[bp] ?? 'OTHER'
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function toSourceId(exerciseId: string, name: string): string {
  // Use AscendAPI exerciseId as sourceId for guaranteed uniqueness
  return exerciseId
}

async function fetchPage(cursor: string | null): Promise<{
  data: any[]
  nextCursor: string | null
  hasMore: boolean
}> {
  const url = `https://${RAPIDAPI_HOST}/api/v1/exercises?limit=100${cursor ? `&cursor=${cursor}` : ''}`
  const res = await fetch(url, {
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST,
    }
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
  const json = await res.json() as any
  return {
    data: json.data ?? [],
    nextCursor: json.meta?.nextCursor ?? null,
    hasMore: json.meta?.hasNextPage ?? false,
  }
}

async function downloadAndUpload(
  gifUrl: string,
  sourceId: string
): Promise<string | null> {
  try {
    const res = await fetch(gifUrl)
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    const ext = gifUrl.includes('.gif') ? 'gif' : 'jpg'
    const path = `${sourceId}.${ext}`

    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType: ext === 'gif' ? 'image/gif' : 'image/jpeg',
      upsert: true,
      cacheControl: '31536000',
    })
    if (error) return null

    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  } catch {
    return null
  }
}

async function main() {
  console.log('🌱 IronSynk — Importing exercises from AscendAPI\n')

  if (!RAPIDAPI_KEY) {
    console.error('❌ EXERCISEDB_API_KEY not set in .env')
    process.exit(1)
  }

  let cursor: string | null = null
  let page = 0
  let imported = 0
  let skipped = 0
  let noGif = 0
  const muscleGroupCounts: Record<string, number> = {}

  console.log('⬇️  Fetching and importing exercises...\n')

  while (true) {
    const { data, nextCursor, hasMore } = await fetchPage(cursor)
    page++

    for (const ex of data) {
      // Filter by equipment
      const equipments: string[] = (ex.equipments ?? []).map((e: string) => e.toLowerCase())
      const hasAllowedEquipment = equipments.some(e => ALLOWED_EQUIPMENT.has(e))
      if (!hasAllowedEquipment) {
        skipped++
        continue
      }

      const bodyPart = (ex.bodyParts?.[0] ?? '').toLowerCase()
      if (!BODY_PART_MAP[bodyPart] && bodyPart !== 'upper arms' && bodyPart !== 'upper legs') {
        skipped++
        continue
      }

      const muscleGroup = resolveMuscleGroup(bodyPart, ex.targetMuscles ?? [])
      const sourceId = toSourceId(ex.exerciseId, ex.name)

      // Check if already exists
      const existing = await prisma.exercise.findFirst({ where: { sourceId } })
      if (existing) { skipped++; continue }

      // Get best available GIF/image URL
      const gifUrl =
        ex.gifUrls?.['480p'] ??
        ex.gifUrls?.['360p'] ??
        ex.imageUrls?.['480p'] ??
        ex.imageUrls?.['360p'] ??
        ex.imageUrl ??
        null

      // Upload GIF to Supabase Storage
      let storedUrl: string | null = null
      if (gifUrl) {
        storedUrl = await downloadAndUpload(gifUrl, sourceId)
        if (!storedUrl) noGif++
      } else {
        noGif++
      }

      // Save to database
      await prisma.exercise.create({
        data: {
          id:          crypto.randomUUID(),
          name:        ex.name,           // English name — translate later via admin
          muscleGroup: muscleGroup as any,
          equipment:   equipments[0] ?? 'other',
          description: ex.overview ?? null,
          gifUrl:      storedUrl,
          videoUrl:    ex.videoUrl ?? null,
          isCustom:    false,
          createdById: null,
          sourceId:    sourceId,          // AscendAPI exerciseId
        }
      })

      muscleGroupCounts[muscleGroup] = (muscleGroupCounts[muscleGroup] ?? 0) + 1
      imported++
      process.stdout.write(`\r  Page ${page} | ✅ ${imported} imported | ⏭ ${skipped} skipped | 🖼 ${noGif} no gif   `)
      await sleep(DELAY_MS)
    }

    if (!hasMore) break
    cursor = nextCursor
    await sleep(500)
  }

  console.log('\n\n─────────────────────────────────────')
  console.log(`✅ ${imported} exercises imported`)
  console.log(`⏭  ${skipped} skipped (wrong equipment or already exists)`)
  console.log(`⚠️  ${noGif} without GIF`)
  console.log('\n📊 By muscle group:')
  for (const [group, count] of Object.entries(muscleGroupCounts).sort()) {
    console.log(`   ${group.padEnd(16)} ${count}`)
  }
  console.log('\n📌 Next step: open the admin screen in the app to curate exercises')
  console.log('   Remove unwanted ones, then translate names to Portuguese\n')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
