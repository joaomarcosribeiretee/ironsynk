import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { supabaseAdmin } from '../../lib/supabase.js'
import { authMiddleware } from '../../middleware/auth.js'

const UpdateProfileBody = z.object({
  isOnboarding: z.boolean().optional(),
  name: z.string().min(1).optional(),
  avatar: z.url().optional(),
  bio: z.string().optional(),
  birthDate: z.coerce.date().optional(),
  sex: z.enum(['male', 'female', 'other']).optional(),
  weightKg: z.number().positive().optional(),
  heightCm: z.number().positive().optional(),
  goal: z.enum(['HYPERTROPHY', 'STRENGTH', 'FAT_LOSS', 'ENDURANCE', 'HEALTH', 'PERFORMANCE']).optional(),
  experience: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  daysPerWeek: z.number().int().min(1).max(7).optional(),
  isPrivate: z.boolean().optional(),
  gymName: z.string().optional(),
  // Trainer-specific fields
  cref: z.string().optional(),
  specialties: z.array(z.string()).optional(),
  acceptingClients: z.boolean().optional(),
  trainerBio: z.string().optional(),
})

type FieldErrors = Record<string, string>

function validateOnboarding(data: z.infer<typeof UpdateProfileBody>, role: string): FieldErrors | null {
  const fields: FieldErrors = {}

  // Step 1: required for all roles
  if (!data.name || data.name.trim().length < 2) fields.name = 'required'
  if (!data.birthDate) fields.birthDate = 'required'
  if (!data.sex) fields.sex = 'required'
  if (!data.weightKg || data.weightKg <= 0) fields.weightKg = 'required'
  if (!data.heightCm || data.heightCm <= 0) fields.heightCm = 'required'

  // Step 2: role-specific
  if (role === 'ATHLETE') {
    if (!data.goal) fields.goal = 'required'
    if (!data.daysPerWeek) fields.daysPerWeek = 'required'
  } else if (role === 'TRAINER') {
    if (!data.trainerBio || data.trainerBio.trim().length < 10) fields.trainerBio = 'required'
    if (data.acceptingClients === undefined) fields.acceptingClients = 'required'
  }

  return Object.keys(fields).length > 0 ? fields : null
}

export async function profileRoutes(fastify: FastifyInstance): Promise<void> {
  // PUT /api/v1/profile — upsert profile (requires auth)
  fastify.put('/', { preHandler: authMiddleware }, async (request, reply) => {
    const parsed = UpdateProfileBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: parsed.error.issues.map((issue) => issue.message),
        },
      })
    }

    const { isOnboarding, cref, specialties, acceptingClients, trainerBio, ...profileFields } = parsed.data
    const userId = request.authUser.id

    if (isOnboarding) {
      const fieldErrors = validateOnboarding(parsed.data, request.authUser.role)
      if (fieldErrors) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', fields: fieldErrors } })
      }
    }

    const profile = await prisma.profile.upsert({
      where: { userId },
      create: { userId, name: profileFields.name ?? '', ...profileFields },
      update: profileFields,
    })

    if (request.authUser.role === 'TRAINER') {
      const trainerData = { cref, specialties, acceptingClients, bio: trainerBio }
      const hasTrainerData = Object.values(trainerData).some((v) => v !== undefined)
      if (hasTrainerData) {
        await prisma.trainerProfile.upsert({
          where: { userId },
          create: { userId, specialties: specialties ?? [], cref, acceptingClients, bio: trainerBio },
          update: { cref, specialties, acceptingClients, bio: trainerBio },
        })
      }
    }

    return reply.send({ data: { profile } })
  })

  // PUT /api/v1/profile/avatar — upload avatar image
  fastify.put('/avatar', { preHandler: authMiddleware }, async (request, reply) => {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
    const MAX_BYTES = 5 * 1024 * 1024

    const data = await request.file()
    if (!data) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'No file uploaded' } })
    }

    if (!ALLOWED_TYPES.includes(data.mimetype)) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Only jpg, png, and webp are allowed' } })
    }

    const chunks: Buffer[] = []
    let totalSize = 0
    for await (const chunk of data.file) {
      totalSize += chunk.length
      if (totalSize > MAX_BYTES) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'File exceeds 5MB limit' } })
      }
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)

    const ext = data.mimetype === 'image/png' ? 'png' : data.mimetype === 'image/webp' ? 'webp' : 'jpg'
    const userId = request.authUser.id
    const path = `${userId}/avatar.${ext}`

    const { error: storageError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(path, buffer, { contentType: data.mimetype, upsert: true })

    if (storageError) {
      return reply.status(500).send({ error: { code: 'STORAGE_ERROR', message: 'Failed to upload avatar' } })
    }

    const { data: publicUrl } = supabaseAdmin.storage.from('avatars').getPublicUrl(path)
    const avatarUrl = publicUrl.publicUrl

    await prisma.profile.update({ where: { userId }, data: { avatar: avatarUrl } })

    return reply.send({ data: { avatarUrl } })
  })

  // GET /api/v1/profile/:userId — public profile
  fastify.get('/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, trainerProfile: true },
    })

    if (!user || !user.profile) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Profile not found' } })
    }

    if (user.profile.isPrivate) {
      return reply.send({
        data: {
          id: user.id,
          role: user.role,
          profile: { name: user.profile.name, avatar: user.profile.avatar },
        },
      })
    }

    return reply.send({
      data: {
        id: user.id,
        role: user.role,
        profile: user.profile,
        trainerProfile: user.role === 'TRAINER' ? user.trainerProfile : undefined,
      },
    })
  })
}
