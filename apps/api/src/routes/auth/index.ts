import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase, supabaseAdmin } from '../../lib/supabase.js'
import { prisma } from '../../lib/prisma.js'
import { authMiddleware } from '../../middleware/auth.js'

const RegisterBody = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9._ -]+$/, 'Username can only contain letters, numbers, spaces, dot, underscore, and hyphen'),
  email: z.email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .refine((v) => /[a-z]/.test(v), 'Password must contain a lowercase letter')
    .refine((v) => /[A-Z]/.test(v), 'Password must contain an uppercase letter')
    .refine((v) => /[0-9]/.test(v), 'Password must contain a number')
    .refine((v) => /[^A-Za-z0-9]/.test(v), 'Password must contain a special character'),
  role: z.enum(['ATHLETE', 'TRAINER']),
})

const LoginBody = z.object({
  email: z.email(),
  password: z.string().min(1),
})

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/v1/auth/register
  fastify.post('/register', async (request, reply) => {
    const parsed = RegisterBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: parsed.error.issues.map((issue) => issue.message),
        },
      })
    }

    const { username, email, password, role } = parsed.data

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
    })

    if (authError || !authData.user) {
      const msg = authError?.message ?? 'Failed to create user'
      const status = msg.toLowerCase().includes('already') ? 409 : 400
      return reply.status(status).send({ error: { code: 'AUTH_ERROR', message: msg } })
    }

    const supabaseUserId = authData.user.id

    try {
      await prisma.$transaction(async (tx) => {
        await tx.user.create({ data: { id: supabaseUserId, email, role } })
        await tx.profile.create({ data: { userId: supabaseUserId, name: '' } })
        await tx.gameProfile.create({ data: { userId: supabaseUserId } })
        if (role === 'TRAINER') {
          await tx.trainerProfile.create({ data: { userId: supabaseUserId, specialties: [] } })
        }
      })
    } catch (err) {
      request.log.error(err, 'prisma.$transaction failed during register')
      await supabaseAdmin.auth.admin.deleteUser(supabaseUserId).catch(() => null)
      return reply.status(500).send({ error: { code: 'REGISTER_ERROR', message: 'Failed to create account' } })
    }

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError || !signInData.session) {
      return reply.status(500).send({ error: { code: 'AUTH_ERROR', message: 'User created but sign-in failed' } })
    }

    const dbUser = await prisma.user.findUniqueOrThrow({
      where: { id: supabaseUserId },
      include: { profile: true, trainerProfile: true },
    })

    return reply.status(201).send({ user: dbUser, session: signInData.session, isOnboarded: false })
  })

  // POST /api/v1/auth/login
  fastify.post('/login', async (request, reply) => {
    const parsed = LoginBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: parsed.error.issues.map((issue) => issue.message),
        },
      })
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

    const isOnboarded = dbUser.profile != null && dbUser.profile.name.length > 0

    return reply.send({ user: dbUser, session: data.session, isOnboarded })
  })

  // POST /api/v1/auth/google — see apps/api/src/routes/auth/google.ts for setup checklist
  fastify.post('/google', async (_request, reply) => {
    return reply.status(501).send({ error: { code: 'NOT_IMPLEMENTED', message: 'Google OAuth not yet configured. See google.ts for setup checklist.' } })
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
