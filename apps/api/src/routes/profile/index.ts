import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { authMiddleware } from '../../middleware/auth.js'

const UpdateProfileBody = z.object({
  name: z.string().min(1).optional(),
  avatar: z.string().url().optional(),
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

export async function profileRoutes(fastify: FastifyInstance): Promise<void> {
  // PUT /api/v1/profile — upsert profile (requires auth)
  fastify.put('/', { preHandler: authMiddleware }, async (request, reply) => {
    const parsed = UpdateProfileBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } })
    }

    const { cref, specialties, acceptingClients, trainerBio, ...profileFields } = parsed.data
    const userId = request.authUser.id

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

    return reply.send({ profile })
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
        id: user.id,
        role: user.role,
        profile: { name: user.profile.name, avatar: user.profile.avatar },
      })
    }

    return reply.send({
      id: user.id,
      role: user.role,
      profile: user.profile,
      trainerProfile: user.role === 'TRAINER' ? user.trainerProfile : undefined,
    })
  })
}
