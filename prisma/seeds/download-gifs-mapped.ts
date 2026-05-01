// IronSynk — Step 2: Download images using manual ID mapping
// Fill in the gifMap below with: sourceId → AscendAPI exerciseId
// Get the exerciseIds from prisma/seeds/ascend-exercises.json
//
// Run: npx tsx prisma/seeds/download-gifs-mapped.ts

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

// ─────────────────────────────────────────────────────────────
// FILL THIS MAP: sourceId → AscendAPI exerciseId
// Find exerciseIds in prisma/seeds/ascend-exercises.json
// Leave empty string "" to skip that exercise
// ─────────────────────────────────────────────────────────────
const gifMap: Record<string, string> = {
  // PEITO
  'barbell-bench-press':                '',
  'dumbbell-bench-press':               '',
  'machine-chest-press':                '',
  'smith-machine-bench-press':          '',
  'neutral-grip-dumbbell-bench-press':  '',
  'incline-barbell-bench-press':        '',
  'incline-dumbbell-bench-press':       '',
  'incline-smith-machine-press':        '',
  'incline-machine-press':              '',
  'incline-neutral-dumbbell-press':     '',
  'decline-barbell-bench-press':        '',
  'decline-dumbbell-bench-press':       '',
  'decline-machine-press':              '',
  'cable-bench-press':                  '',
  'chest-dips':                         '',
  'dumbbell-fly':                       '',
  'incline-dumbbell-fly':               '',
  'decline-dumbbell-fly':               '',
  'cable-crossover-high':               '',
  'cable-crossover-low':                '',
  'cable-crossover-mid':                '',
  'seated-cable-fly-high':              '',
  'seated-cable-fly-low':               '',
  'cable-fly':                          '',
  'pec-deck-fly':                       '',
  'dumbbell-pullover':                  '',
  'push-up':                            '',
  'incline-push-up':                    '',
  'decline-push-up':                    '',
  'diamond-push-up':                    '',
  'archer-push-up':                     '',
  'clap-push-up':                       '',
  'neutral-grip-machine-chest-press':   '',

  // COSTAS
  'pull-up':                            '',
  'chin-up':                            '',
  'neutral-grip-pull-up':               '',
  'wide-grip-pull-up':                  '',
  'weighted-pull-up':                   '',
  'assisted-pull-up':                   '',
  'lat-pulldown':                       '',
  'supinated-lat-pulldown':             '',
  'close-grip-lat-pulldown':            '',
  'wide-neutral-pulldown':              '',
  'wide-grip-lat-pulldown':             '',
  'machine-lat-pulldown':               '',
  'single-arm-lat-pulldown':            '',
  'straight-arm-pulldown':              '',
  'single-arm-straight-pulldown':       '',
  'rope-pulldown':                      '',
  'isolateral-pull-down':               '',
  'unilateral-isolateral-pull':         '',
  'machine-high-row':                   '',
  'barbell-bent-over-row':              '',
  'supinated-barbell-row':              '',
  'smith-machine-row':                  '',
  'chest-supported-row':                '',
  'incline-bench-dumbbell-row':         '',
  'dumbbell-one-arm-row':               '',
  'seated-cable-row':                   '',
  'cable-row-triangle':                 '',
  'cable-row-pronated':                 '',
  'single-arm-cable-row':               '',
  'cable-row-rope':                     '',
  'machine-neutral-row':                '',
  'machine-pronated-row':               '',
  'cable-machine-row':                  '',
  'isolateral-machine-row':             '',
  'single-arm-machine-row':             '',
  'landmine-row':                       '',
  'single-arm-landmine-row':            '',
  't-bar-row':                          '',
  'machine-low-row':                    '',
  'cable-pullover':                     '',
  'machine-pullover':                   '',
  'kelso-shrug':                        '',
  'back-extension':                     '',
  'weighted-back-extension':            '',
  'superman':                           '',
  'bird-dog':                           '',

  // OMBROS
  'overhead-press':                     '',
  'military-press':                     '',
  'behind-neck-press':                  '',
  'seated-dumbbell-shoulder-press':     '',
  'standing-dumbbell-shoulder-press':   '',
  'arnold-press':                       '',
  'smith-machine-overhead-press':       '',
  'machine-shoulder-press':             '',
  'cable-machine-shoulder-press':       '',
  'lateral-raise':                      '',
  'seated-lateral-raise':               '',
  'incline-lateral-raise':              '',
  'cable-lateral-raise':                '',
  'single-arm-cable-lateral-raise':     '',
  'band-lateral-raise':                 '',
  'machine-lateral-raise-seated':       '',
  'machine-lateral-raise-standing':     '',
  'dumbbell-front-raise':               '',
  'seated-front-raise':                 '',
  'barbell-front-raise':                '',
  'ez-bar-front-raise':                 '',
  'cable-front-raise-rope':             '',
  'band-front-raise':                   '',
  'reverse-fly':                        '',
  'bent-over-reverse-fly':              '',
  'cable-rear-delt-fly':                '',
  'single-arm-cable-rear-delt':         '',
  'machine-rear-delt-fly':              '',
  'face-pull':                          '',
  'cable-y-raise':                      '',
  'dumbbell-y-raise':                   '',
  'cable-high-pull':                    '',
  'barbell-upright-row':                '',
  'dumbbell-upright-row':               '',
  'cable-upright-row-rope':             '',
  'barbell-shrug':                      '',
  'dumbbell-shrug':                     '',
  'cable-shrug':                        '',
  'machine-shrug':                      '',
  'kelso-shrug-traps':                  '',

  // BÍCEPS
  'barbell-curl':                       '',
  'ez-bar-curl':                        '',
  'dumbbell-curl':                      '',
  'alternating-dumbbell-curl':          '',
  'hammer-curl':                        '',
  'alternating-hammer-curl':            '',
  'cable-hammer-curl-rope':             '',
  'concentration-curl':                 '',
  'preacher-curl':                      '',
  'ez-bar-preacher-curl':               '',
  'dumbbell-preacher-curl':             '',
  'single-arm-preacher-curl':           '',
  'machine-preacher-curl':              '',
  'machine-bicep-curl':                 '',
  'cable-curl-bar':                     '',
  'cable-curl-reverse':                 '',
  'cable-curl-high':                    '',
  'single-arm-cable-curl':              '',
  'bayesian-curl':                      '',
  '21s-curl':                           '',
  'incline-dumbbell-curl':              '',
  'spider-curl':                        '',
  'spider-curl-dumbbell':               '',
  'reverse-curl':                       '',
  'ez-bar-reverse-curl':                '',
  'cable-reverse-curl':                 '',
  'dumbbell-reverse-curl':              '',
  'zottman-curl':                       '',
  'band-curl':                          '',

  // TRÍCEPS
  'dips':                               '',
  'assisted-dips':                      '',
  'bench-dips':                         '',
  'jm-press':                           '',
  'skull-crusher':                      '',
  'ez-bar-skull-crusher':               '',
  'dumbbell-skull-crusher':             '',
  'overhead-triceps-extension-bar':     '',
  'ez-bar-overhead-extension':          '',
  'overhead-triceps-extension':         '',
  'single-arm-overhead-extension':      '',
  'cable-overhead-triceps-rope':        '',
  'single-arm-cable-overhead-triceps':  '',
  'triceps-pushdown-rope':              '',
  'triceps-pushdown-bar':               '',
  'triceps-pushdown-ez-bar':            '',
  'reverse-grip-pushdown':              '',
  'cable-crossover-triceps':            '',
  'triceps-kickback':                   '',
  'cable-triceps-kickback':             '',
  'machine-triceps-extension':          '',
  'machine-triceps-press':              '',
  'triceps-carter':                     '',
  'single-arm-cable-triceps-extension': '',
  'close-grip-bench-press':             '',

  // ANTEBRAÇOS
  'wrist-curl-barbell':                 '',
  'wrist-curl-dumbbell':                '',
  'wrist-curl-cable':                   '',
  'reverse-wrist-curl':                 '',
  'reverse-wrist-curl-dumbbell':        '',
  'cable-wrist-extension':              '',
  'wrist-curl':                         '',
  'wrist-roller':                       '',
  'farmer-walk':                        '',
  'barbell-farmer-walk':                '',
  'zottman-curl-forearm':               '',
  'finger-plank':                       '',

  // QUADRÍCEPS
  'barbell-squat':                      '',
  'deep-squat':                         '',
  'jump-squat':                         '',
  'smith-machine-squat':                '',
  'machine-squat':                      '',
  'front-squat':                        '',
  'bulgarian-split-squat':              '',
  'barbell-bulgarian-split-squat':      '',
  'goblet-squat':                       '',
  'zercher-squat':                      '',
  'pistol-squat':                       '',
  'box-squat':                          '',
  'pendulum-squat':                     '',
  'sissy-squat':                        '',
  'hack-squat':                         '',
  'barbell-hack-squat':                 '',
  'belt-squat':                         '',
  'leg-press':                          '',
  'single-leg-press':                   '',
  'horizontal-leg-press':               '',
  'leg-press-horizontal':               '',
  'single-leg-horizontal-press':        '',
  'leg-extension':                      '',
  'single-leg-extension':               '',
  'barbell-lunge':                      '',
  'dumbbell-lunge':                     '',
  'reverse-lunge':                      '',
  'barbell-reverse-lunge':              '',
  'lateral-lunge':                      '',
  'walking-lunge':                      '',
  'barbell-walking-lunge':              '',
  'curtsy-lunge':                       '',
  'step-up':                            '',
  'barbell-step-up':                    '',
  'box-jump':                           '',
  'wall-sit':                           '',

  // POSTERIORES
  'conventional-deadlift':              '',
  'sumo-deadlift':                      '',
  'romanian-deadlift':                  '',
  'dumbbell-rdl':                       '',
  'single-leg-rdl':                     '',
  'single-leg-rdl-cable':               '',
  'stiff-leg-deadlift':                 '',
  'dumbbell-stiff-leg-deadlift':        '',
  'dumbbell-deadlift':                  '',
  'dumbbell-sumo-deadlift':             '',
  'trap-bar-deadlift':                  '',
  'deficit-deadlift':                   '',
  'pause-deadlift':                     '',
  'lying-leg-curl':                     '',
  'seated-leg-curl':                    '',
  'single-leg-curl':                    '',
  'nordic-hamstring-curl-plate':        '',
  'cable-leg-curl-standing':            '',
  'cable-leg-curl':                     '',
  'nordic-curl':                        '',
  'glute-ham-raise':                    '',
  'good-morning':                       '',
  'machine-good-morning':               '',

  // GLÚTEOS
  'barbell-hip-thrust':                 '',
  'machine-hip-thrust':                 '',
  'dumbbell-hip-thrust':                '',
  'single-leg-hip-thrust':              '',
  'glute-bridge':                       '',
  'barbell-glute-bridge':               '',
  'single-leg-glute-bridge':            '',
  'cable-kickback':                     '',
  'donkey-kickback':                    '',
  'machine-glute-kickback':             '',
  'sumo-squat-dumbbell':                '',
  'sumo-squat-barbell':                 '',
  'frog-pump':                          '',
  'machine-hip-extension':              '',
  'hip-abduction-machine':              '',
  'hip-adduction-machine':              '',
  'cable-hip-abduction':                '',
  'cable-hip-adduction':                '',
  'band-monster-walk':                  '',
  'clamshell':                          '',
  'lying-hip-abduction-band':           '',
  'fire-hydrant':                       '',
  'band-kickback':                      '',

  // PANTURRILHAS
  'standing-calf-raise':                '',
  'seated-calf-raise':                  '',
  'leg-press-calf-raise':               '',
  'barbell-calf-raise':                 '',
  'dumbbell-calf-raise':                '',
  'single-leg-calf-raise':              '',
  'calf-raise-step':                    '',
  'single-leg-calf-raise-step':         '',
  'smith-machine-calf-raise':           '',
  'donkey-calf-raise':                  '',
  'tibialis-raise':                     '',
  'calf-jump':                          '',

  // ABDÔMEN
  'crunch':                             '',
  'reverse-crunch':                     '',
  'scissor-kick':                       '',
  'ab-wheel-rollout':                   '',
  'machine-crunch':                     '',
  'cable-crunch-rope':                  '',
  'cable-crunch':                       '',
  'plank':                              '',
  'side-plank':                         '',
  'plank-shoulder-tap':                 '',
  'plank-leg-raise':                    '',
  'hanging-leg-raise':                  '',
  'lying-leg-raise':                    '',
  'hanging-knee-raise':                 '',
  'russian-twist':                      '',
  'weighted-russian-twist':             '',
  'bicycle-crunch':                     '',
  'dragon-flag':                        '',
  'dead-bug':                           '',
  'hollow-body-hold':                   '',
  'cable-oblique-crunch':               '',
  'oblique-crunch':                     '',
  'mountain-climber':                   '',
  'sit-up':                             '',
  'toes-to-bar':                        '',
  'l-sit':                              '',
  'pallof-press':                       '',
  'pallof-press-rotation':              '',
  'cable-woodchop-high':                '',
  'cable-woodchop-low':                 '',
  'swiss-ball-crunch':                  '',
  'swiss-ball-pike':                    '',
  'v-up':                               '',
  'windshield-wiper':                   '',

  // CORPO INTEIRO
  'clean-and-press':                    '',
  'power-clean':                        '',
  'hang-clean':                         '',
  'barbell-snatch':                     '',
  'dumbbell-snatch':                    '',
  'dumbbell-thruster':                  '',
  'barbell-thruster':                   '',
  'kettlebell-swing':                   '',
  'turkish-get-up':                     '',
  'burpee':                             '',
  'man-maker':                          '',
  'bear-complex':                       '',
  'devil-press':                        '',
  'dumbbell-clean':                     '',
}
// ─────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchExerciseImage(exerciseId: string): Promise<string | null> {
  try {
    const url = `https://${RAPIDAPI_HOST}/api/v1/exercises/${exerciseId}`
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST,
      }
    })
    if (!res.ok) return null
    const ex = await res.json() as any
    // Prefer 720p GIF, fallback to 480p, then imageUrl
    return ex.gifUrls?.['720p'] ?? ex.gifUrls?.['480p'] ?? ex.imageUrls?.['720p'] ?? ex.imageUrl ?? null
  } catch { return null }
}

async function uploadToStorage(buffer: Buffer, sourceId: string, ext: string): Promise<string | null> {
  const path = `${sourceId}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: ext === 'gif' ? 'image/gif' : 'image/jpeg',
    upsert: true,
    cacheControl: '31536000',
  })
  if (error) { console.error(`  ❌ Upload: ${error.message}`); return null }
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

async function main() {
  console.log('🖼️  IronSynk — Download GIFs (mapped)\n')

  const mapped = Object.entries(gifMap).filter(([, id]) => id !== '')
  const skipped = Object.entries(gifMap).filter(([, id]) => id === '').length
  console.log(`📋 ${mapped.length} mapped | ${skipped} skipped (empty)\n`)

  if (mapped.length === 0) {
    console.log('⚠️  gifMap is empty. Fill in the exerciseIds from ascend-exercises.json first.')
    return
  }

  let success = 0, failed = 0

  for (const [sourceId, exerciseId] of mapped) {
    const dbEx = await prisma.exercise.findFirst({ where: { sourceId } })
    if (!dbEx) { console.log(`  ⚠️  ${sourceId} not found in DB`); continue }

    process.stdout.write(`  ${dbEx.name}...`)

    const imageUrl = await fetchExerciseImage(exerciseId)
    if (!imageUrl) {
      process.stdout.write(` ❌ no image\n`)
      failed++
      await sleep(200)
      continue
    }

    const res = await fetch(imageUrl)
    if (!res.ok) { process.stdout.write(` ❌ download failed\n`); failed++; continue }
    const buffer = Buffer.from(await res.arrayBuffer())
    const ext = imageUrl.includes('.gif') ? 'gif' : 'jpg'

    const storedUrl = await uploadToStorage(buffer, sourceId, ext)
    if (!storedUrl) { failed++; await sleep(200); continue }

    await prisma.exercise.update({ where: { id: dbEx.id }, data: { gifUrl: storedUrl } })
    process.stdout.write(` ✅\n`)
    success++
    await sleep(200)
  }

  console.log(`\n────────────────────────────`)
  console.log(`✅ ${success} saved | ❌ ${failed} failed`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
