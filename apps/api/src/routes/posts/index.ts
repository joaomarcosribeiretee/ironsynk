import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
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

const SESSION_INCLUDE = {
  executionExercises: {
    orderBy: { order: 'asc' as const },
    include: {
      exercise: { select: EXERCISE_SELECT },
      setLogs: { select: SET_SELECT, orderBy: { order: 'asc' as const } },
    },
  },
} as const

function mapSession(s: any) {
  const { executionExercises, ...rest } = s
  return {
    ...rest,
    exercises: (executionExercises ?? []).map((ee: any) => {
      const { setLogs, ...exRest } = ee
      return { ...exRest, sets: setLogs }
    }),
  }
}

function mapPost(p: any) {
  return {
    id: p.id,
    content: p.content,
    imageUrls: p.imageUrls,
    videoUrl: p.videoUrl,
    createdAt: p.createdAt,
    user: {
      id: p.user.id,
      name: p.user.profile?.name ?? null,
      avatar: p.user.profile?.avatar ?? null,
    },
    session: p.trainingLog ? mapSession(p.trainingLog) : null,
  }
}

export async function postRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/v1/posts — publish a finished workout (idempotent per trainingLog)
  fastify.post('/', { preHandler: authMiddleware }, async (request, reply) => {
    const body = z.object({
      trainingLogId: z.string(),
      content: z.string().optional(),
    }).parse(request.body)

    const userId = request.authUser.id

    const log = await prisma.trainingLog.findUnique({
      where: { id: body.trainingLogId },
      select: { userId: true, finishedAt: true },
    })
    if (!log) return reply.status(404).send({ error: { code: 'NOT_FOUND' } })
    if (log.userId !== userId) return reply.status(403).send({ error: { code: 'FORBIDDEN' } })
    if (!log.finishedAt) {
      return reply.status(422).send({ error: { code: 'SESSION_NOT_FINISHED', message: 'Finish the workout before publishing' } })
    }

    const existing = await prisma.post.findUnique({
      where: { trainingLogId: body.trainingLogId },
      select: { id: true },
    })
    if (existing) return reply.status(200).send({ data: { post: existing } })

    const post = await prisma.$transaction(async (tx) => {
      await tx.trainingLog.update({
        where: { id: body.trainingLogId },
        data: { isPosted: true },
      })
      // upsert guards against a concurrent publish racing past the check above
      return tx.post.upsert({
        where: { trainingLogId: body.trainingLogId },
        create: { userId, trainingLogId: body.trainingLogId, content: body.content ?? null },
        update: {},
        select: { id: true },
      })
    })

    return reply.status(201).send({ data: { post } })
  })

  // GET /api/v1/posts/me — current user's published workouts (newest first)
  fastify.get('/me', { preHandler: authMiddleware }, async (request, reply) => {
    const query = z.object({
      limit: z.coerce.number().int().min(1).max(50).default(20),
      offset: z.coerce.number().int().min(0).default(0),
    }).parse(request.query)

    const userId = request.authUser.id

    const [posts, total] = await prisma.$transaction([
      prisma.post.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
        include: {
          user: { select: { id: true, profile: { select: { name: true, avatar: true } } } },
          trainingLog: { include: SESSION_INCLUDE },
        },
      }),
      prisma.post.count({ where: { userId } }),
    ])

    return reply.send({ data: { posts: posts.map(mapPost), total } })
  })
}
