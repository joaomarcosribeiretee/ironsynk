// DEBUG / ADMIN — remove before launch
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { authMiddleware } from '../../middleware/auth.js'
import { supabaseAdmin } from '../../lib/supabase.js'

const STORAGE_BUCKET = 'exercises'

const VALID_MUSCLE_GROUPS = [
  'CHEST', 'BACK', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'FOREARMS',
  'QUADS', 'HAMSTRINGS', 'GLUTES', 'CALVES', 'ABS', 'FULL_BODY', 'OTHER',
] as const

export async function exerciseRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/v1/exercises?muscleGroup=CHEST
  fastify.get('/', async (request, reply) => {
    const { muscleGroup } = request.query as { muscleGroup?: string }

    const where = muscleGroup && VALID_MUSCLE_GROUPS.includes(muscleGroup as typeof VALID_MUSCLE_GROUPS[number])
      ? { muscleGroup: muscleGroup as typeof VALID_MUSCLE_GROUPS[number] }
      : {}

    const exercises = await prisma.exercise.findMany({
      where,
      orderBy: [{ muscleGroup: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        muscleGroup: true,
        equipment: true,
        sourceId: true,
        gifUrl: true,
        videoUrl: true,
      },
    })

    return reply.send({ data: { exercises } })
  })

  // PATCH /api/v1/exercises/:id — ADMIN only
  fastify.patch('/:id', { preHandler: authMiddleware }, async (request, reply) => {
    if (request.authUser.role !== 'ADMIN') {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Admin only' } })
    }

    const { id } = request.params as { id: string }
    const body = request.body as {
      name?: string
      muscleGroup?: string
      equipment?: string | null
      gifUrl?: string | null
      videoUrl?: string | null
    }

    const exercise = await prisma.exercise.findUnique({ where: { id } })
    if (!exercise) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Exercise not found' } })
    }

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.muscleGroup !== undefined && VALID_MUSCLE_GROUPS.includes(body.muscleGroup as typeof VALID_MUSCLE_GROUPS[number])) {
      data.muscleGroup = body.muscleGroup
    }
    if ('equipment' in body) data.equipment = body.equipment
    if ('gifUrl' in body) data.gifUrl = body.gifUrl
    if ('videoUrl' in body) data.videoUrl = body.videoUrl

    const updated = await prisma.exercise.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        muscleGroup: true,
        equipment: true,
        sourceId: true,
        gifUrl: true,
        videoUrl: true,
      },
    })

    return reply.send({ data: { exercise: updated } })
  })

  // DELETE /api/v1/exercises/:id — ADMIN only
  fastify.delete('/:id', { preHandler: authMiddleware }, async (request, reply) => {
    if (request.authUser.role !== 'ADMIN') {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Admin only' } })
    }

    const { id } = request.params as { id: string }

    const exercise = await prisma.exercise.findUnique({ where: { id }, select: { id: true, gifUrl: true } })
    if (!exercise) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Exercise not found' } })
    }

    if (exercise.gifUrl) {
      const url = new URL(exercise.gifUrl)
      const pathParts = url.pathname.split(`/public/${STORAGE_BUCKET}/`)
      const filePath = pathParts[1]?.split('?')[0]
      if (filePath) {
        await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([filePath])
      }
    }

    // Cascade: remove dependent records first
    await prisma.$transaction(async (tx) => {
      await tx.setLog.deleteMany({
        where: { trainingExercise: { exerciseId: id } },
      })
      await tx.trainingExercise.deleteMany({ where: { exerciseId: id } })
      await tx.exercise.delete({ where: { id } })
    })

    return reply.send({ data: { success: true } })
  })
}
