import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { authRoutes } from './routes/auth/index.js'
import { profileRoutes } from './routes/profile/index.js'
import { trainerRoutes } from './routes/trainer/index.js'
import { exerciseRoutes } from './routes/exercises/index.js' // DEBUG — remove before launch
import { programRoutes } from './routes/programs/index.js'
import { workoutRoutes } from './routes/workouts/index.js'
import { trainingExerciseRoutes } from './routes/training-exercises/index.js'
import { plannedSetRoutes } from './routes/planned-sets/index.js'
import { supabaseAdmin } from './lib/supabase.js'

const server = Fastify({ logger: true })

async function bootstrap(): Promise<void> {
  await server.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })

  await server.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  })

  await supabaseAdmin.storage.createBucket('avatars', { public: true }).catch(() => null)

  server.get('/', async () => {
    return { service: 'ironsynk-api', status: 'ok' }
  })

  server.get('/api/v1/health', async () => {
    return { status: 'ok' }
  })

  await server.register(authRoutes, { prefix: '/api/v1/auth' })
  await server.register(profileRoutes, { prefix: '/api/v1/profile' })
  await server.register(trainerRoutes, { prefix: '/api/v1/trainer' })
  await server.register(exerciseRoutes, { prefix: '/api/v1/exercises' }) // DEBUG — remove before launch
  await server.register(programRoutes, { prefix: '/api/v1/programs' })
  await server.register(workoutRoutes, { prefix: '/api/v1/workouts' })
  await server.register(trainingExerciseRoutes, { prefix: '/api/v1/training-exercises' })
  await server.register(plannedSetRoutes, { prefix: '/api/v1/planned-sets' })

  const port = Number(process.env['PORT'] ?? 3333)
  await server.listen({ port, host: '0.0.0.0' })
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
