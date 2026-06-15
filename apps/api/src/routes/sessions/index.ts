import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { authMiddleware } from '../../middleware/auth.js'

const EXERCISE_SELECT = {
  id: true, name: true, muscleGroup: true, equipment: true, gifUrl: true, videoUrl: true,
} as const

const SET_SELECT = {
  id: true, trainingLogId: true, executionExerciseId: true, exerciseId: true,
  setNumber: true, order: true, setType: true, technique: true, techniqueConfig: true,
  repsCompleted: true, weightKg: true, isChecked: true, checkedAt: true,
  isPersonalRecord: true, notes: true, plannedSetId: true,
} as const

const EXEC_EX_INCLUDE = {
  exercise: { select: EXERCISE_SELECT },
  setLogs: { select: SET_SELECT, orderBy: { order: 'asc' as const } },
} as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initExecTechConfig(technique: string, cfg: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!cfg) return null
  switch (technique) {
    case 'REST_PAUSE': {
      const count = (cfg['failurePoints'] as number) ?? 3
      return {
        failurePoints: count,
        restBetweenSeconds: (cfg['restBetweenSeconds'] as number) ?? 15,
        // index 0 = main set, indices 1..count = failure blocks
        execPoints: Array.from({ length: count + 1 }, () => ({ reps: null, weightKg: null, checked: false })),
      }
    }
    case 'CLUSTER_SET': {
      const blocks = (cfg['blocks'] as number) ?? 4
      const repsPerBlock = (cfg['repsPerBlock'] as number) ?? 5
      return {
        blocks,
        repsPerBlock,
        restBetweenSeconds: (cfg['restBetweenSeconds'] as number) ?? 15,
        // weight is shared (setLog.weightKg); blocks only track reps
        execBlocks: Array.from({ length: blocks }, () => ({ reps: null, weightKg: null, checked: false })),
      }
    }
    case 'MUSCLE_ROUND': {
      const blocks = (cfg['blocks'] as number) ?? 6
      const repsPerBlock = (cfg['repsPerBlock'] as number) ?? 6
      return {
        blocks,
        repsPerBlock,
        restBetweenSeconds: (cfg['restBetweenSeconds'] as number) ?? 35,
        // drop weight seeded from planning config; main weight comes from setLog.weightKg
        dropWeightKg: (cfg['dropWeightKg'] as number | null) ?? null,
        failedAtBlock: null,
        execBlocks: Array.from({ length: blocks }, () => ({ reps: null, failed: false })),
      }
    }
    case 'MYOREP': {
      return {
        activationReps: (cfg['activationReps'] as number) ?? 6,
        activationRestSeconds: (cfg['activationRestSeconds'] as number) ?? 40,
        repsPerBlock: (cfg['repsPerBlock'] as number) ?? 2,
        restBetweenSeconds: (cfg['restBetweenSeconds'] as number) ?? 20,
        weightKg: (cfg['weightKg'] as number | null) ?? null,
        execActivationReps: null,
        execMiniBlocks: [],
      }
    }
    case 'DROP_SET': {
      // drops = additional drops; total blocks = main + drops. Weights are filled
      // during execution, so they start null (no planned weight values).
      const drops = (cfg['drops'] as number) ?? 2
      const totalBlocks = drops + 1
      return {
        drops,
        execDrops: Array.from({ length: totalBlocks }, () => ({
          weightKg: null,
          reps: null,
          checked: false,
        })),
      }
    }
    default:
      return null
  }
}

function calc1RM(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30)
}

async function ownerCheck(sessionId: string, userId: string) {
  const log = await prisma.trainingLog.findUnique({ where: { id: sessionId }, select: { userId: true } })
  if (!log) return { ok: false as const, status: 404 }
  if (log.userId !== userId) return { ok: false as const, status: 403 }
  return { ok: true as const }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function sessionRoutes(fastify: FastifyInstance): Promise<void> {

  // POST /api/v1/sessions/start
  fastify.post('/start', { preHandler: authMiddleware }, async (request, reply) => {
    const body = z.object({ workoutId: z.string().optional() }).parse(request.body)
    const userId = request.authUser.id

    const session = await prisma.$transaction(async (tx) => {
      if (body.workoutId) {
        const workout = await tx.workout.findUnique({
          where: { id: body.workoutId },
          include: {
            program: { select: { name: true } },
            exercises: {
              orderBy: { order: 'asc' },
              include: { plannedSets: { orderBy: { order: 'asc' } } },
            },
          },
        })
        if (!workout) throw new Error('WORKOUT_NOT_FOUND')

        const log = await tx.trainingLog.create({
          data: {
            userId,
            workoutId: body.workoutId,
            isFreeWorkout: false,
            workoutName: workout.name,
            programName: workout.program?.name ?? null,
            startedAt: new Date(),
          },
        })

        let exOrder = 0
        for (const te of workout.exercises) {
          const execEx = await tx.executionExercise.create({
            data: {
              trainingLogId: log.id,
              exerciseId: te.exerciseId,
              trainingExId: te.id,
              order: exOrder++,
              exerciseNotes: te.notes ?? null,
            },
          })

          if (te.plannedSets.length > 0) {
            const setsData = te.plannedSets.map((ps, idx) => {
              const techCfg = initExecTechConfig(
                ps.technique,
                ps.techniqueConfig as Record<string, unknown> | null,
              )
              return {
                trainingLogId: log.id,
                executionExerciseId: execEx.id,
                trainingExerciseId: te.id,
                exerciseId: te.exerciseId,
                setNumber: idx + 1,
                order: idx,
                setType: ps.setType,
                technique: ps.technique,
                techniqueConfig: (techCfg ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
                plannedSetId: ps.id,
                repsCompleted: 0,
                weightKg: ps.targetWeight ?? 0,
              }
            })
            await tx.setLog.createMany({ data: setsData })
          } else {
            await tx.setLog.create({
              data: {
                trainingLogId: log.id,
                executionExerciseId: execEx.id,
                trainingExerciseId: te.id,
                exerciseId: te.exerciseId,
                setNumber: 1,
                order: 0,
                repsCompleted: 0,
                weightKg: 0,
              },
            })
          }
        }

        return log
      }

      return tx.trainingLog.create({
        data: {
          userId,
          workoutId: null,
          isFreeWorkout: true,
          workoutName: null,
          programName: null,
          startedAt: new Date(),
        },
      })
    }, { timeout: 15000 })

    const full = await prisma.trainingLog.findUnique({
      where: { id: session.id },
      include: {
        executionExercises: {
          orderBy: { order: 'asc' },
          include: EXEC_EX_INCLUDE,
        },
      },
    })
    return reply.status(201).send({ data: { sessionId: full!.id, session: mapSession(full!) } })
  })

  // GET /api/v1/sessions/:id
  fastify.get('/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const check = await ownerCheck(id, request.authUser.id)
    if (!check.ok) return reply.status(check.status).send({ error: { code: check.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN' } })

    const session = await prisma.trainingLog.findUnique({
      where: { id },
      include: {
        executionExercises: {
          orderBy: { order: 'asc' },
          include: EXEC_EX_INCLUDE,
        },
      },
    })
    return reply.send({ data: { session: mapSession(session!) } })
  })

  // PUT /api/v1/sessions/:id/sets/:setId
  fastify.put('/:id/sets/:setId', { preHandler: authMiddleware }, async (request, reply) => {
    const { id, setId } = request.params as { id: string; setId: string }
    const body = z.object({
      repsCompleted: z.number().int().nullable().optional(),
      weightKg: z.number().nullable().optional(),
      isChecked: z.boolean().optional(),
      notes: z.string().nullable().optional(),
      techniqueConfig: z.record(z.string(), z.unknown()).nullable().optional(),
      setType: z.enum(['WORKING', 'WARMUP', 'FEEDER']).optional(),
      technique: z.enum(['NONE', 'DROP_SET', 'BACK_OFF', 'REST_PAUSE', 'CLUSTER_SET', 'MUSCLE_ROUND', 'MYOREP']).optional(),
    }).parse(request.body)

    const check = await ownerCheck(id, request.authUser.id)
    if (!check.ok) return reply.status(check.status).send({ error: { code: check.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN' } })

    const updated = await prisma.setLog.update({
      where: { id: setId },
      select: SET_SELECT,
      data: {
        ...(body.repsCompleted !== undefined && { repsCompleted: body.repsCompleted }),
        ...(body.weightKg !== undefined && { weightKg: body.weightKg }),
        ...(body.isChecked !== undefined && {
          isChecked: body.isChecked,
          checkedAt: body.isChecked ? new Date() : null,
        }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.techniqueConfig !== undefined && { techniqueConfig: body.techniqueConfig as unknown as Prisma.InputJsonValue | undefined }),
        ...(body.setType !== undefined && { setType: body.setType }),
        ...(body.technique !== undefined && { technique: body.technique }),
      },
    })

    // PR check on check action — use final DB values after update
    let isPR = false
    let previousBest: { weightKg: number; reps: number } | undefined
    const reps = updated.repsCompleted
    const weight = updated.weightKg

    if (body.isChecked && reps != null && weight != null && reps > 0 && weight > 0) {
      const new1RM = calc1RM(weight, reps)
      const existing = await prisma.personalRecord.findUnique({
        where: { userId_exerciseId: { userId: request.authUser.id, exerciseId: updated.exerciseId } },
      })

      if (!existing || new1RM > calc1RM(existing.weightKg, existing.reps)) {
        if (existing) previousBest = { weightKg: existing.weightKg, reps: existing.reps }
        await prisma.personalRecord.upsert({
          where: { userId_exerciseId: { userId: request.authUser.id, exerciseId: updated.exerciseId } },
          create: { userId: request.authUser.id, exerciseId: updated.exerciseId, weightKg: weight, reps, estimated1RM: new1RM },
          update: { weightKg: weight, reps, estimated1RM: new1RM, achievedAt: new Date() },
        })
        await prisma.setLog.update({ where: { id: setId }, data: { isPersonalRecord: true } })
        isPR = true
      }
    }

    return reply.send({ data: { set: updated, isPR, ...(previousBest ? { previousBest } : {}) } })
  })

  // POST /api/v1/sessions/:id/exercises
  fastify.post('/:id/exercises', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = z.object({ exerciseId: z.string(), setCount: z.number().int().min(0).default(0) }).parse(request.body)

    const check = await ownerCheck(id, request.authUser.id)
    if (!check.ok) return reply.status(check.status).send({ error: { code: check.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN' } })

    const exercise = await prisma.exercise.findUnique({ where: { id: body.exerciseId } })
    if (!exercise) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Exercise not found' } })

    const agg = await prisma.executionExercise.aggregate({ where: { trainingLogId: id }, _max: { order: true } })
    const order = (agg._max.order ?? -1) + 1

    const execEx = await prisma.$transaction(async (tx) => {
      const ee = await tx.executionExercise.create({
        data: { trainingLogId: id, exerciseId: body.exerciseId, order },
        include: EXEC_EX_INCLUDE,
      })
      for (let i = 0; i < body.setCount; i++) {
        await tx.setLog.create({
          data: {
            trainingLogId: id,
            executionExerciseId: ee.id,
            exerciseId: body.exerciseId,
            setNumber: i + 1,
            order: i,
            repsCompleted: 0,
            weightKg: 0,
          },
        })
      }
      await tx.trainingLog.update({ where: { id }, data: { hasChanges: true } })
      return ee
    })

    // reload with sets
    const full = await prisma.executionExercise.findUnique({
      where: { id: execEx.id },
      include: EXEC_EX_INCLUDE,
    })
    return reply.status(201).send({ data: { exercise: mapExecEx(full!) } })
  })

  // DELETE /api/v1/sessions/:id/exercises/:execExId
  fastify.delete('/:id/exercises/:execExId', { preHandler: authMiddleware }, async (request, reply) => {
    const { id, execExId } = request.params as { id: string; execExId: string }

    const check = await ownerCheck(id, request.authUser.id)
    if (!check.ok) return reply.status(check.status).send({ error: { code: check.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN' } })

    await prisma.$transaction([
      prisma.setLog.deleteMany({ where: { executionExerciseId: execExId } }),
      prisma.executionExercise.delete({ where: { id: execExId } }),
      prisma.trainingLog.update({ where: { id }, data: { hasChanges: true } }),
    ])
    return reply.send({ data: { success: true } })
  })

  // POST /api/v1/sessions/:id/exercises/:execExId/sets
  fastify.post('/:id/exercises/:execExId/sets', { preHandler: authMiddleware }, async (request, reply) => {
    const { id, execExId } = request.params as { id: string; execExId: string }

    const check = await ownerCheck(id, request.authUser.id)
    if (!check.ok) return reply.status(check.status).send({ error: { code: check.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN' } })

    const execEx = await prisma.executionExercise.findUnique({ where: { id: execExId } })
    if (!execEx) return reply.status(404).send({ error: { code: 'NOT_FOUND' } })

    const agg = await prisma.setLog.aggregate({ where: { executionExerciseId: execExId }, _max: { order: true }, _count: true })
    const newOrder = (agg._max.order ?? -1) + 1

    const set = await prisma.setLog.create({
      select: SET_SELECT,
      data: {
        trainingLogId: id,
        executionExerciseId: execExId,
        exerciseId: execEx.exerciseId,
        setNumber: agg._count + 1,
        order: newOrder,
        repsCompleted: 0,
        weightKg: 0,
      },
    })
    return reply.status(201).send({ data: { set } })
  })

  // DELETE /api/v1/sessions/:id/sets/:setId
  fastify.delete('/:id/sets/:setId', { preHandler: authMiddleware }, async (request, reply) => {
    const { id, setId } = request.params as { id: string; setId: string }

    const check = await ownerCheck(id, request.authUser.id)
    if (!check.ok) return reply.status(check.status).send({ error: { code: check.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN' } })

    await prisma.setLog.delete({ where: { id: setId } })
    return reply.send({ data: { success: true } })
  })

  // PUT /api/v1/sessions/:id/exercises/:execExId/notes
  fastify.put('/:id/exercises/:execExId/notes', { preHandler: authMiddleware }, async (request, reply) => {
    const { id, execExId } = request.params as { id: string; execExId: string }
    const { notes } = z.object({ notes: z.string() }).parse(request.body)

    const check = await ownerCheck(id, request.authUser.id)
    if (!check.ok) return reply.status(check.status).send({ error: { code: check.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN' } })

    await prisma.executionExercise.update({ where: { id: execExId }, data: { exerciseNotes: notes || null } })
    return reply.send({ data: { success: true } })
  })

  // POST /api/v1/sessions/:id/finish
  fastify.post('/:id/finish', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { applyChanges } = z.object({ applyChanges: z.boolean().default(false) }).parse(request.body)

    const check = await ownerCheck(id, request.authUser.id)
    if (!check.ok) return reply.status(check.status).send({ error: { code: check.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN' } })

    const session = await prisma.trainingLog.findUnique({
      where: { id },
      include: {
        executionExercises: {
          include: { setLogs: { select: SET_SELECT } },
        },
      },
    })
    if (!session) return reply.status(404).send({ error: { code: 'NOT_FOUND' } })

    const now = new Date()
    const durationMin = Math.round((now.getTime() - session.startedAt.getTime()) / 60000)
    let totalVolume = 0
    let totalSets = 0
    let totalValidSets = 0

    for (const ee of session.executionExercises) {
      for (const s of ee.setLogs) {
        totalSets++
        if (s.setType === 'WORKING') totalValidSets++
        if (s.isChecked && s.repsCompleted && s.weightKg) {
          totalVolume += s.repsCompleted * s.weightKg
        }
      }
    }

    const updated = await prisma.trainingLog.update({
      where: { id },
      data: { finishedAt: now, durationMin, totalVolume, totalSets, totalValidSets },
      include: {
        executionExercises: {
          orderBy: { order: 'asc' },
          include: EXEC_EX_INCLUDE,
        },
      },
    })

    if (applyChanges && session.workoutId) {
      await syncWorkoutFromSession(session.workoutId, id)
    }

    return reply.send({ data: { session: mapSession(updated), hasChanges: session.hasChanges } })
  })

  // DELETE /api/v1/sessions/:id (cancel)
  fastify.delete('/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const check = await ownerCheck(id, request.authUser.id)
    if (!check.ok) return reply.status(check.status).send({ error: { code: check.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN' } })

    await prisma.$transaction([
      prisma.setLog.deleteMany({ where: { trainingLogId: id } }),
      prisma.executionExercise.deleteMany({ where: { trainingLogId: id } }),
      prisma.trainingLog.delete({ where: { id } }),
    ])
    return reply.send({ data: { success: true } })
  })
}

// ─── Sync workout from session ────────────────────────────────────────────────

async function syncWorkoutFromSession(workoutId: string, sessionId: string): Promise<void> {
  const session = await prisma.trainingLog.findUnique({
    where: { id: sessionId },
    include: {
      executionExercises: {
        orderBy: { order: 'asc' },
        include: { setLogs: { orderBy: { order: 'asc' } } },
      },
    },
  })
  if (!session) return

  await prisma.$transaction(async (tx) => {
    const existing = await tx.trainingExercise.findMany({ where: { workoutId }, select: { id: true } })
    for (const te of existing) {
      await tx.plannedSet.deleteMany({ where: { trainingExId: te.id } })
    }
    await tx.trainingExercise.deleteMany({ where: { workoutId } })

    let order = 0
    for (const ee of session.executionExercises) {
      const te = await tx.trainingExercise.create({
        data: {
          workoutId,
          exerciseId: ee.exerciseId,
          order: order++,
          targetSets: ee.setLogs.filter(s => s.setType === 'WORKING').length || ee.setLogs.length,
          targetReps: '',
        },
      })
      let psOrder = 0
      for (const s of ee.setLogs) {
        await tx.plannedSet.create({
          data: {
            trainingExId: te.id,
            order: psOrder++,
            setType: s.setType,
            technique: s.technique,
            techniqueConfig: s.techniqueConfig ?? undefined,
          },
        })
      }
    }
  })
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapExecEx(ee: any) {
  const { setLogs, ...rest } = ee
  return { ...rest, sets: setLogs }
}

function mapSession(s: any) {
  const { executionExercises, ...rest } = s
  return { ...rest, exercises: (executionExercises ?? []).map(mapExecEx) }
}
