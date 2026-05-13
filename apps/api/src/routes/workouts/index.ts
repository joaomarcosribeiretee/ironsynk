import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { authMiddleware } from '../../middleware/auth.js'

const AddExerciseBody = z.object({
  exerciseId: z.string(),
  targetSets: z.number().int().min(1).optional(),
  targetReps: z.string().optional(),
  restSeconds: z.number().int().nullable().optional(),
})

const EXERCISE_SELECT = {
  id: true,
  name: true,
  muscleGroup: true,
  equipment: true,
  gifUrl: true,
  videoUrl: true,
} as const

const CreateWorkoutBody = z.object({
  programId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

const UpdateWorkoutBody = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  order: z.number().int().nonnegative().optional(),
})

function formatWorkout(w: any) {
  const { _count, ...rest } = w
  return { ...rest, exercisesCount: _count?.exercises ?? w.exercisesCount ?? 0 }
}

export async function workoutRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/v1/workouts
  fastify.post('/', { preHandler: authMiddleware }, async (request, reply) => {
    const body = CreateWorkoutBody.parse(request.body)

    const program = await prisma.program.findUnique({ where: { id: body.programId } })
    if (!program) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Program not found' } })
    if (program.createdById !== request.authUser.id) return reply.status(403).send({ error: { code: 'FORBIDDEN' } })

    const agg = await prisma.workout.aggregate({ where: { programId: body.programId }, _max: { order: true } })
    const workout = await prisma.workout.create({
      data: { programId: body.programId, name: body.name, notes: body.description, order: (agg._max.order ?? 0) + 1 },
      include: { _count: { select: { exercises: true } } },
    })
    return reply.status(201).send({ data: { workout: formatWorkout(workout) } })
  })

  // PUT /api/v1/workouts/:id
  fastify.put('/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = UpdateWorkoutBody.parse(request.body)

    const existing = await prisma.workout.findUnique({ where: { id }, include: { program: true } })
    if (!existing) return reply.status(404).send({ error: { code: 'NOT_FOUND' } })
    if (!existing.program || existing.program.createdById !== request.authUser.id) return reply.status(403).send({ error: { code: 'FORBIDDEN' } })

    const updated = await prisma.workout.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...('description' in body && { notes: body.description }),
        ...(body.order !== undefined && { order: body.order }),
      },
      include: { _count: { select: { exercises: true } } },
    })
    return reply.send({ data: { workout: formatWorkout(updated) } })
  })

  // DELETE /api/v1/workouts/:id
  fastify.delete('/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.workout.findUnique({ where: { id }, include: { program: true } })
    if (!existing) return reply.status(404).send({ error: { code: 'NOT_FOUND' } })
    if (!existing.program || existing.program.createdById !== request.authUser.id) return reply.status(403).send({ error: { code: 'FORBIDDEN' } })

    await prisma.$transaction(async (tx) => {
      await tx.setLog.deleteMany({ where: { trainingExercise: { workoutId: id } } })
      await tx.trainingExercise.deleteMany({ where: { workoutId: id } })
      await tx.workout.delete({ where: { id } })
    })
    return reply.send({ data: { success: true } })
  })

  // POST /api/v1/workouts/:id/duplicate
  fastify.post('/:id/duplicate', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const original = await prisma.workout.findUnique({ where: { id }, include: { program: true, exercises: true } })
    if (!original) return reply.status(404).send({ error: { code: 'NOT_FOUND' } })
    if (!original.program || original.program.createdById !== request.authUser.id) return reply.status(403).send({ error: { code: 'FORBIDDEN' } })

    const agg = await prisma.workout.aggregate({ where: { programId: original.programId! }, _max: { order: true } })

    const newWorkout = await prisma.$transaction(async (tx) => {
      const w = await tx.workout.create({
        data: { programId: original.programId, name: `${original.name} (cópia)`, notes: original.notes, order: (agg._max.order ?? 0) + 1 },
      })
      for (const ex of original.exercises) {
        await tx.trainingExercise.create({
          data: { workoutId: w.id, exerciseId: ex.exerciseId, order: ex.order, targetSets: ex.targetSets, targetReps: ex.targetReps, targetRIR: ex.targetRIR, targetRPE: ex.targetRPE, restSeconds: ex.restSeconds, notes: ex.notes },
        })
      }
      return w
    })

    return reply.status(201).send({ data: { workout: { ...newWorkout, exercisesCount: original.exercises.length } } })
  })

  // GET /api/v1/workouts/:id
  fastify.get('/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const workout = await prisma.workout.findUnique({
      where: { id },
      include: {
        program: true,
        exercises: {
          orderBy: { order: 'asc' },
          include: {
            exercise: { select: EXERCISE_SELECT },
            plannedSets: { orderBy: { order: 'asc' } },
          },
        },
      },
    })

    if (!workout) return reply.status(404).send({ error: { code: 'NOT_FOUND' } })
    if (!workout.program || workout.program.createdById !== request.authUser.id) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN' } })
    }

    const { exercises, ...rest } = workout
    const mapped = exercises.map(({ plannedSets, ...te }) => ({ ...te, sets: plannedSets }))
    return reply.send({ data: { workout: { ...rest, exercises: mapped } } })
  })

  // POST /api/v1/workouts/:id/exercises
  fastify.post('/:id/exercises', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = AddExerciseBody.parse(request.body)

    const workout = await prisma.workout.findUnique({ where: { id }, include: { program: true } })
    if (!workout) return reply.status(404).send({ error: { code: 'NOT_FOUND' } })
    if (!workout.program || workout.program.createdById !== request.authUser.id) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN' } })
    }

    const exercise = await prisma.exercise.findUnique({ where: { id: body.exerciseId } })
    if (!exercise) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Exercise not found' } })

    const agg = await prisma.trainingExercise.aggregate({ where: { workoutId: id }, _max: { order: true } })
    const order = (agg._max.order ?? 0) + 1

    const te = await prisma.trainingExercise.create({
      data: {
        workoutId: id,
        exerciseId: body.exerciseId,
        order,
        targetSets: body.targetSets ?? 1,
        targetReps: body.targetReps ?? '',
        restSeconds: body.restSeconds ?? null,
      },
      include: { exercise: { select: EXERCISE_SELECT } },
    })

    return reply.status(201).send({ data: { trainingExercise: te } })
  })
}
