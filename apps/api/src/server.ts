import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { authRoutes } from './routes/auth/index.js'
import { profileRoutes } from './routes/profile/index.js'
import { supabaseAdmin } from './lib/supabase.js'

const server = Fastify({ logger: true })

async function bootstrap(): Promise<void> {
  await server.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })

  await server.register(multipart)

  await supabaseAdmin.storage.createBucket('avatars', { public: true }).catch(() => null)

  server.get('/', async () => {
    return { service: 'ironsynk-api', status: 'ok' }
  })

  server.get('/api/v1/health', async () => {
    return { status: 'ok' }
  })

  await server.register(authRoutes, { prefix: '/api/v1/auth' })
  await server.register(profileRoutes, { prefix: '/api/v1/profile' })

  const port = Number(process.env['PORT'] ?? 3333)
  await server.listen({ port, host: '0.0.0.0' })
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
