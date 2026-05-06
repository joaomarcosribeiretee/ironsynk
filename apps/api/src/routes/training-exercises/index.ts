import { randomUUID } from 'crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { authMiddleware } from '../../middleware/auth.js'

const EXERCISE_SELECT = {
  id: true,
  name: true,
  muscleGroup: true,
  equipment: true,
  gifUrl: true,
  videoUrl: true,
} as const

const TechniqueEnum = z.enum([
  'NONE', 'WARMUP', 'FEEDER', 'BACK_OFF', 'REST_PAUSE',
  'CLUSTER_SET', 'MUSCLE_ROUND', 'BISET', 'SUPERSET',
  'DROP_SET', 'MYOREP',
])

async function ownerCheck(teId: string, userId: string) {
  const te = await prisma.trainingExercise.findUnique({
    where: { id: teId },
    include: { workout: { include: { program: true } } },
  })
  if (!te) return { te: null, error: 'NOT_FOUND' as const }
  if (!te.workout.program || te.workout.program.createdById !== userId) {
    return { te: null, error: 'FORBIDDEN' as const }
  }
  return { te, error: null }
}

const UpdateBody = z.object({
  targetSets: z.number().int().min(1).optional(),
  targetReps: z.string().optional(),
  restSeconds: z.number().int().nullable().optional(),
  order: z.number().int().nonnegative().optional(),
  notes: z.string().max(500).nullable().optional(),
  technique: TechniqueEnum.optional(),
  techniqueConfig: z.record(z.string(), z.unknown()).nullable().optional(),
  supersetGroupId: z.string().nullable().optional(),
})

const SupersetBody = z.object({
  workoutId: z.string(),
  exerciseIds: z.array(z.string()).length(2),
  type: z.enum(['BISET', 'SUPERSET']),
})

const AddSetBody = z.object({
  setType: z.enum(['WORKING', 'WARMUP', 'FEEDER']).optional(),
  technique: z.enum(['NONE', 'REST_PAUSE', 'MUSCLE_ROUND', 'CLUSTER_SET', 'BACK_OFF']).optional(),
  techniqueConfig: z.record(z.string(), z.unknown()).nullable().optional(),
  targetReps: z.string().max(10).nullable().optional(),
  targetWeight: z.number().min(0).max(1000).nullable().optional(),
  restSeconds: z.number().int().min(0).max(600).nullable().optional(),
})

const ReplaceBody = z.object({
  newExerciseId: z.string(),
})

export async function trainingExerciseRoutes(fastify: FastifyInstance): Promise<void> {
  // PUT /api/v1/training-exercises/:id
  fastify.put('/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = UpdateBody.parse(request.body)

    const { te, error } = await ownerCheck(id, request.authUser.id)
    if (error === 'NOT_FOUND') return reply.status(404).send({ error: { code: 'NOT_FOUND' } })
    if (error === 'FORBIDDEN') return reply.status(403).send({ error: { code: 'FORBIDDEN' } })

    const data: Record<string, unknown> = {}
    if (body.targetSets !== undefined) data['targetSets'] = body.targetSets
    if (body.targetReps !== undefined) data['targetReps'] = body.targetReps
    if ('restSeconds' in body) data['restSeconds'] = body.restSeconds
    if (body.order !== undefined) data['order'] = body.order
    if ('notes' in body) data['notes'] = body.notes
    if (body.technique !== undefined) data['technique'] = body.technique
    if ('techniqueConfig' in body) data['techniqueConfig'] = body.techniqueConfig ?? null
    if ('supersetGroupId' in body) data['supersetGroupId'] = body.supersetGroupId

    const updated = await prisma.trainingExercise.update({
      where: { id: te!.id },
      data,
      include: { exercise: { select: EXERCISE_SELECT } },
    })

    return reply.send({ data: { trainingExercise: updated } })
  })

  // DELETE /api/v1/training-exercises/:id
  fastify.delete('/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const { te, error } = await ownerCheck(id, request.authUser.id)
    if (error === 'NOT_FOUND') return reply.status(404).send({ error: { code: 'NOT_FOUND' } })
    if (error === 'FORBIDDEN') return reply.status(403).send({ error: { code: 'FORBIDDEN' } })

    const workoutId = te!.workout.id
    const removedOrder = te!.order

    await prisma.$transaction(async (tx) => {
      await tx.setLog.deleteMany({ where: { trainingExerciseId: id } })
      await tx.trainingExercise.delete({ where: { id } })

      const remaining = await tx.trainingExercise.findMany({
        where: { workoutId, order: { gt: removedOrder } },
        select: { id: true, order: true },
        orderBy: { order: 'asc' },
      })
      for (const r of remaining) {
        await tx.trainingExercise.update({ where: { id: r.id }, data: { order: r.order - 1 } })
      }
    })

    return reply.send({ data: { success: true } })
  })

  // PUT /api/v1/training-exercises/:id/replace
  fastify.put('/:id/replace', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = ReplaceBody.parse(request.body)

    const { te, error } = await ownerCheck(id, request.authUser.id)
    if (error === 'NOT_FOUND') return reply.status(404).send({ error: { code: 'NOT_FOUND' } })
    if (error === 'FORBIDDEN') return reply.status(403).send({ error: { code: 'FORBIDDEN' } })

    const newExercise = await prisma.exercise.findUnique({ where: { id: body.newExerciseId } })
    if (!newExercise) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Exercise not found' } })

    const updated = await prisma.trainingExercise.update({
      where: { id: te!.id },
      data: { exerciseId: body.newExerciseId },
      include: { exercise: { select: EXERCISE_SELECT } },
    })

    return reply.send({ data: { trainingExercise: updated } })
  })

  // POST /api/v1/training-exercises/superset
  fastify.post('/superset', { preHandler: authMiddleware }, async (request, reply) => {
    const body = SupersetBody.parse(request.body)

    const exercises = await prisma.trainingExercise.findMany({
      where: { id: { in: body.exerciseIds }, workoutId: body.workoutId },
      include: { workout: { include: { program: true } } },
    })

    if (exercises.length !== 2) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Exercises not found in workout' } })
    }

    for (const ex of exercises) {
      if (!ex.workout.program || ex.workout.program.createdById !== request.authUser.id) {
        return reply.status(403).send({ error: { code: 'FORBIDDEN' } })
      }
    }

    const groupId = randomUUID()

    await prisma.trainingExercise.updateMany({
      where: { id: { in: body.exerciseIds } },
      data: { supersetGroupId: groupId, technique: body.type },
    })

    const updated = await prisma.trainingExercise.findMany({
      where: { id: { in: body.exerciseIds } },
      include: { exercise: { select: EXERCISE_SELECT } },
      orderBy: { order: 'asc' },
    })

    return reply.status(201).send({ data: { exercises: updated, groupId } })
  })

  // DELETE /api/v1/training-exercises/superset/:groupId
  fastify.delete('/superset/:groupId', { preHandler: authMiddleware }, async (request, reply) => {
    const { groupId } = request.params as { groupId: string }

    const exercises = await prisma.trainingExercise.findMany({
      where: { supersetGroupId: groupId },
      include: { workout: { include: { program: true } } },
    })


    if (!exercises.length) return reply.status(404).send({ error: { code: 'NOT_FOUND' } })

    for (const ex of exercises) {
      if (!ex.workout.program || ex.workout.program.createdById !== request.authUser.id) {
        return reply.status(403).send({ error: { code: 'FORBIDDEN' } })
      }
    }

    await prisma.trainingExercise.updateMany({
      where: { supersetGroupId: groupId },
      data: { supersetGroupId: null, technique: 'NONE' },
    })

    return reply.send({ data: { success: true } })
  })

  // GET /api/v1/training-exercises/:id/sets
  fastify.get('/:id/sets', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const { te, error } = await ownerCheck(id, request.authUser.id)
    if (error === 'NOT_FOUND') return reply.status(404).send({ error: { code: 'NOT_FOUND' } })
    if (error === 'FORBIDDEN') return reply.status(403).send({ error: { code: 'FORBIDDEN' } })

    const sets = await prisma.plannedSet.findMany({
      where: { trainingExId: te!.id },
      orderBy: { order: 'asc' },
    })
    return reply.send({ data: { sets } })
  })

  // POST /api/v1/training-exercises/:id/sets
  fastify.post('/:id/sets', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = AddSetBody.parse(request.body)

    const { te, error } = await ownerCheck(id, request.authUser.id)
    if (error === 'NOT_FOUND') return reply.status(404).send({ error: { code: 'NOT_FOUND' } })
    if (error === 'FORBIDDEN') return reply.status(403).send({ error: { code: 'FORBIDDEN' } })

    const agg = await prisma.plannedSet.aggregate({ where: { trainingExId: id }, _max: { order: true } })
    const order = (agg._max.order ?? -1) + 1

    const ps = await prisma.plannedSet.create({
      data: {
        trainingExId: te!.id,
        order,
        setType: body.setType ?? 'WORKING',
        technique: body.technique ?? 'NONE',
        techniqueConfig: body.techniqueConfig !== undefined ? (body.techniqueConfig as object) : undefined,
        targetReps: body.targetReps ?? null,
        targetWeight: body.targetWeight ?? null,
        restSeconds: body.restSeconds ?? null,
      },
    })
    return reply.status(201).send({ data: { plannedSet: ps } })
  })
}
