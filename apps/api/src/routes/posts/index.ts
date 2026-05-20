import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { authMiddleware } from '../../middleware/auth.js'

export async function postRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/', { preHandler: authMiddleware }, async (request, reply) => {
    const body = z.object({
      trainingLogId: z.string(),
      content: z.string().optional(),
    }).parse(request.body)

    const userId = request.authUser.id

    const log = await prisma.trainingLog.findUnique({
      where: { id: body.trainingLogId },
      select: { userId: true },
    })
    if (!log) return reply.status(404).send({ error: { code: 'NOT_FOUND' } })
    if (log.userId !== userId) return reply.status(403).send({ error: { code: 'FORBIDDEN' } })

    const post = await prisma.$transaction(async (tx) => {
      await tx.trainingLog.update({
        where: { id: body.trainingLogId },
        data: { isPosted: true },
      })
      return tx.post.create({
        data: { userId, trainingLogId: body.trainingLogId, content: body.content ?? null },
        select: { id: true },
      })
    })

    return reply.status(201).send({ data: { post } })
  })
}
