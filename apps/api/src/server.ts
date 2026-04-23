import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { authRoutes } from './routes/auth/index.js'
import { profileRoutes } from './routes/profile/index.js'

const server = Fastify({ logger: true })

async function bootstrap(): Promise<void> {
  await server.register(cors, { origin: true })

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
