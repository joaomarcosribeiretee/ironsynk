import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { authMiddleware } from '../../middleware/auth.js'

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

const UpdateBody = z.object({
  setType: z.enum(['WORKING', 'WARMUP', 'FEEDER']).optional(),
  technique: z.enum(['NONE', 'REST_PAUSE', 'MUSCLE_ROUND', 'CLUSTER_SET', 'BACK_OFF', 'DROP_SET', 'MYOREP']).optional(),
  techniqueConfig: z.record(z.string(), z.unknown()).nullable().optional(),
  targetReps: z.string().max(10).nullable().optional(),
  targetWeight: z.number().min(0).max(1000).nullable().optional(),
  restSeconds: z.number().int().min(0).max(600).nullable().optional(),
})

async function ownerCheck(setId: string, userId: string) {
  const ps = await prisma.plannedSet.findUnique({
    where: { id: setId },
    include: { trainingExercise: { include: { workout: { include: { program: true } } } } },
  })
  if (!ps) return { ps: null, error: 'NOT_FOUND' as const }
  if (!ps.trainingExercise.workout.program || ps.trainingExercise.workout.program.createdById !== userId) {
    return { ps: null, error: 'FORBIDDEN' as const }
  }
  return { ps, error: null }
}

export async function plannedSetRoutes(fastify: FastifyInstance): Promise<void> {
  // PUT /api/v1/planned-sets/:id
  fastify.put('/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = UpdateBody.parse(request.body)

    const { ps, error } = await ownerCheck(id, request.authUser.id)
    if (error === 'NOT_FOUND') return reply.status(404).send({ error: { code: 'NOT_FOUND' } })
    if (error === 'FORBIDDEN') return reply.status(403).send({ error: { code: 'FORBIDDEN' } })

    const data: Record<string, unknown> = {}
    if (body.setType !== undefined) data['setType'] = body.setType
    if (body.technique !== undefined) data['technique'] = body.technique
    if ('techniqueConfig' in body) data['techniqueConfig'] = body.techniqueConfig ?? null
    if ('targetReps' in body) data['targetReps'] = body.targetReps
    if ('targetWeight' in body) data['targetWeight'] = body.targetWeight != null ? clamp(body.targetWeight, 0, 1000) : null
    if ('restSeconds' in body) data['restSeconds'] = body.restSeconds != null ? clamp(body.restSeconds, 0, 600) : null

    const updated = await prisma.plannedSet.update({ where: { id: ps!.id }, data })
    return reply.send({ data: { plannedSet: updated } })
  })

  // DELETE /api/v1/planned-sets/:id
  fastify.delete('/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const { ps, error } = await ownerCheck(id, request.authUser.id)
    if (error === 'NOT_FOUND') return reply.status(404).send({ error: { code: 'NOT_FOUND' } })
    if (error === 'FORBIDDEN') return reply.status(403).send({ error: { code: 'FORBIDDEN' } })

    const trainingExId = ps!.trainingExId
    const removedOrder = ps!.order

    await prisma.$transaction(async (tx) => {
      await tx.plannedSet.delete({ where: { id } })
      const remaining = await tx.plannedSet.findMany({
        where: { trainingExId, order: { gt: removedOrder } },
        select: { id: true, order: true },
        orderBy: { order: 'asc' },
      })
      for (const r of remaining) {
        await tx.plannedSet.update({ where: { id: r.id }, data: { order: r.order - 1 } })
      }
    })

    return reply.send({ data: { success: true } })
  })
}
