import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase, supabaseAdmin } from '../../lib/supabase.js'
import { prisma } from '../../lib/prisma.js'
import { authMiddleware } from '../../middleware/auth.js'

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['ATHLETE', 'TRAINER']),
})

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/v1/auth/register
  fastify.post('/register', async (request, reply) => {
    const parsed = RegisterBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } })
    }

    const { email, password, role } = parsed.data

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      const msg = authError?.message ?? 'Failed to create user'
      const status = msg.toLowerCase().includes('already') ? 409 : 400
      return reply.status(status).send({ error: { code: 'AUTH_ERROR', message: msg } })
    }

    const dbUser = await prisma.user.create({
      data: { id: authData.user.id, email, role },
    })

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError || !signInData.session) {
      return reply.status(500).send({ error: { code: 'AUTH_ERROR', message: 'User created but sign-in failed' } })
    }

    return reply.status(201).send({ user: dbUser, session: signInData.session })
  })

  // POST /api/v1/auth/login
  fastify.post('/login', async (request, reply) => {
    const parsed = LoginBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } })
    }

    const { email, password } = parsed.data

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.session) {
      return reply.status(401).send({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: data.user.id },
      include: { profile: true },
    })

    if (!dbUser) {
      return reply.status(404).send({ error: { code: 'USER_NOT_FOUND', message: 'User not found in database' } })
    }

    return reply.send({ user: dbUser, session: data.session })
  })

  // POST /api/v1/auth/google
  fastify.post('/google', async (_request, reply) => {
    const redirectTo = process.env['OAUTH_REDIRECT_URL'] ?? 'exp://localhost:8081'

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    })

    if (error || !data.url) {
      return reply.status(500).send({ error: { code: 'OAUTH_ERROR', message: 'Failed to initiate Google OAuth' } })
    }

    return reply.send({ url: data.url })
  })

  // POST /api/v1/auth/logout
  fastify.post('/logout', { preHandler: authMiddleware }, async (request, reply) => {
    const token = request.headers['authorization']?.replace('Bearer ', '') ?? ''
    await supabaseAdmin.auth.admin.signOut(token).catch(() => null)
    return reply.send({ success: true })
  })

  // GET /api/v1/auth/me
  fastify.get('/me', { preHandler: authMiddleware }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.authUser.id },
      include: { profile: true, trainerProfile: true },
    })

    const isOnboarded = user?.profile != null && user.profile.name.length > 0

    return reply.send({ user, isOnboarded })
  })
}
