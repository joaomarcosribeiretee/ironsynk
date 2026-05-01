import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { authMiddleware } from '../../middleware/auth.js'

const VALID_GOALS = ['HYPERTROPHY', 'STRENGTH', 'FAT_LOSS', 'ENDURANCE', 'HEALTH', 'PERFORMANCE'] as const

const CreateProgramBody = z.object({
  name: z.string().min(1).max(100),
  goals: z.array(z.enum(VALID_GOALS)).min(1),
  description: z.string().max(500).optional(),
})

const UpdateProgramBody = z.object({
  name: z.string().min(1).max(100).optional(),
  goals: z.array(z.enum(VALID_GOALS)).min(1).optional(),
  description: z.string().max(500).nullable().optional(),
})

function formatProgram(p: any) {
  const { _count, ...rest } = p
  return { ...rest, goals: p.goals ?? [], workoutsCount: _count?.workouts ?? p.workoutsCount ?? 0 }
}

export async function programRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/v1/programs
  fastify.get('/', { preHandler: authMiddleware }, async (request, reply) => {
    const programs = await prisma.program.findMany({
      where: { createdById: request.authUser.id },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { workouts: true } } },
    })
    return reply.send({ data: { programs: programs.map(formatProgram) } })
  })

  // POST /api/v1/programs
  fastify.post('/', { preHandler: authMiddleware }, async (request, reply) => {
    const body = CreateProgramBody.parse(request.body)
    const program = await prisma.program.create({
      data: {
        name: body.name,
        description: body.description,
        goals: body.goals,
        createdById: request.authUser.id,
      },
    })
    return reply.status(201).send({ data: { program: { ...program, goals: program.goals, workoutsCount: 0 } } })
  })

  // PUT /api/v1/programs/:id
  fastify.put('/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = UpdateProgramBody.parse(request.body)

    const existing = await prisma.program.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Program not found' } })
    if (existing.createdById !== request.authUser.id) return reply.status(403).send({ error: { code: 'FORBIDDEN' } })

    const updated = await prisma.program.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...('description' in body && { description: body.description }),
        ...(body.goals && { goals: body.goals }),
        updatedAt: new Date(),
      },
      include: { _count: { select: { workouts: true } } },
    })
    return reply.send({ data: { program: formatProgram(updated) } })
  })

  // DELETE /api/v1/programs/:id
  fastify.delete('/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.program.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: { code: 'NOT_FOUND' } })
    if (existing.createdById !== request.authUser.id) return reply.status(403).send({ error: { code: 'FORBIDDEN' } })

    await prisma.$transaction(async (tx) => {
      const workoutIds = (await tx.workout.findMany({ where: { programId: id }, select: { id: true } })).map(w => w.id)
      await tx.setLog.deleteMany({ where: { trainingExercise: { workoutId: { in: workoutIds } } } })
      await tx.trainingExercise.deleteMany({ where: { workoutId: { in: workoutIds } } })
      await tx.prescribedProgram.deleteMany({ where: { programId: id } })
      await tx.workout.deleteMany({ where: { programId: id } })
      await tx.program.delete({ where: { id } })
    })
    return reply.send({ data: { success: true } })
  })

  // POST /api/v1/programs/:id/duplicate
  fastify.post('/:id/duplicate', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const original = await prisma.program.findUnique({
      where: { id },
      include: { workouts: { include: { exercises: true } } },
    })
    if (!original) return reply.status(404).send({ error: { code: 'NOT_FOUND' } })
    if (original.createdById !== request.authUser.id) return reply.status(403).send({ error: { code: 'FORBIDDEN' } })

    const newProg = await prisma.$transaction(async (tx) => {
      const prog = await tx.program.create({
        data: { name: `${original.name} (cópia)`, description: original.description, goals: original.goals, createdById: request.authUser.id },
      })
      for (const w of original.workouts) {
        const nw = await tx.workout.create({
          data: { programId: prog.id, name: w.name, order: w.order, notes: w.notes },
        })
        for (const ex of w.exercises) {
          await tx.trainingExercise.create({
            data: { workoutId: nw.id, exerciseId: ex.exerciseId, order: ex.order, targetSets: ex.targetSets, targetReps: ex.targetReps, targetRIR: ex.targetRIR, targetRPE: ex.targetRPE, restSeconds: ex.restSeconds, notes: ex.notes },
          })
        }
      }
      return prog
    })

    return reply.status(201).send({ data: { program: { ...newProg, goals: newProg.goals, workoutsCount: original.workouts.length } } })
  })

  // GET /api/v1/programs/:id/workouts
  fastify.get('/:id/workouts', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const program = await prisma.program.findUnique({ where: { id } })
    if (!program) return reply.status(404).send({ error: { code: 'NOT_FOUND' } })
    if (program.createdById !== request.authUser.id) return reply.status(403).send({ error: { code: 'FORBIDDEN' } })

    const workouts = await prisma.workout.findMany({
      where: { programId: id },
      orderBy: { order: 'asc' },
      include: { _count: { select: { exercises: true } } },
    })
    return reply.send({ data: { workouts: workouts.map(w => ({ ...w, exercisesCount: w._count.exercises, _count: undefined })) } })
  })
}
