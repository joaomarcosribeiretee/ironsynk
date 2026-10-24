import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  CreatePostFromTrainingLogSchema,
  CreateCommentSchema,
  FeedQuerySchema,
  PaginationQuerySchema,
  type PostMediaItem,
} from '@ironsynk/shared'
import { prisma } from '../../lib/prisma.js'
import { authMiddleware } from '../../middleware/auth.js'
import {
  SOCIAL_USER_SELECT,
  postInclude,
  mapPost,
  mapComment,
  mapSocialUser,
  canViewUserPosts,
  notify,
} from '../../lib/social.js'

// Derive legacy imageUrls/videoUrl from ordered media for backward-compatible reads.
function deriveLegacyMedia(media: PostMediaItem[]): { imageUrls: string[]; videoUrl: string | null } {
  const ordered = [...media].sort((a, b) => a.order - b.order)
  const imageUrls = ordered.filter((m) => m.type === 'IMAGE').map((m) => m.url)
  const firstVideo = ordered.find((m) => m.type === 'VIDEO')
  return { imageUrls, videoUrl: firstVideo?.url ?? null }
}

function validationError(message: string) {
  return { error: { code: 'VALIDATION_ERROR', message } }
}

export async function postRoutes(fastify: FastifyInstance): Promise<void> {
  // ───────────────────────────────────────────────────────────────────────────
  // Publishing
  // ───────────────────────────────────────────────────────────────────────────

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

  // POST /api/v1/posts/from-training-log — publish a finished workout with carousel media
  // (idempotent per trainingLog; one post per trainingLogId)
  fastify.post('/from-training-log', { preHandler: authMiddleware }, async (request, reply) => {
    const parsed = CreatePostFromTrainingLogSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(validationError(parsed.error.issues[0]?.message ?? 'Invalid request body'))
    }
    const body = parsed.data
    const userId = request.authUser.id

    const log = await prisma.trainingLog.findUnique({
      where: { id: body.trainingLogId },
      select: { userId: true, finishedAt: true },
    })
    if (!log) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Training log not found' } })
    if (log.userId !== userId) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Training log does not belong to you' } })
    }
    if (!log.finishedAt) {
      return reply.status(422).send({ error: { code: 'SESSION_NOT_FINISHED', message: 'Finish the workout before publishing' } })
    }

    const existing = await prisma.post.findUnique({
      where: { trainingLogId: body.trainingLogId },
      select: { id: true },
    })
    if (existing) {
      return reply.status(409).send({ error: { code: 'ALREADY_POSTED', message: 'This workout has already been posted' } })
    }

    const media = body.media ?? []
    const { imageUrls, videoUrl } = deriveLegacyMedia(media)

    const created = await prisma.$transaction(async (tx) => {
      await tx.trainingLog.update({
        where: { id: body.trainingLogId },
        data: { isPosted: true },
      })
      // upsert guards against a concurrent publish racing past the check above
      const post = await tx.post.upsert({
        where: { trainingLogId: body.trainingLogId },
        create: {
          userId,
          trainingLogId: body.trainingLogId,
          content: body.content ?? null,
          media: media.length > 0 ? media : undefined,
          imageUrls,
          videoUrl,
        },
        update: {},
        select: { id: true },
      })
      return tx.post.findUniqueOrThrow({
        where: { id: post.id },
        include: postInclude(userId),
      })
    })

    return reply.status(201).send({ data: { post: mapPost(created, userId) } })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Reading
  // ───────────────────────────────────────────────────────────────────────────

  // GET /api/v1/posts/feed — the social timeline.
  //   scope=following → people the viewer follows, plus their own posts
  //   scope=discover  → public profiles the viewer does not follow yet
  // Keyset pagination: `cursor` is the last post id of the previous page, so a
  // post published mid-scroll cannot shift the window and duplicate a row.
  fastify.get('/feed', { preHandler: authMiddleware }, async (request, reply) => {
    const parsed = FeedQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(validationError(parsed.error.issues[0]?.message ?? 'Invalid query'))
    }
    const { scope, limit, cursor } = parsed.data
    const viewerId = request.authUser.id

    const following = await prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    })
    const followingIds = following.map((f) => f.followingId)

    const where =
      scope === 'following'
        ? { userId: { in: [...followingIds, viewerId] } }
        : {
            // Discover surfaces public profiles only, and never what the
            // following feed already shows — that is what makes it useful
            // while the athlete follows nobody yet.
            userId: { notIn: [...followingIds, viewerId] },
            user: { profile: { isPrivate: false } },
          }

    const posts = await prisma.post.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: postInclude(viewerId),
    })

    const hasMore = posts.length > limit
    const page = hasMore ? posts.slice(0, limit) : posts

    return reply.send({
      data: {
        posts: page.map((p) => mapPost(p, viewerId)),
        nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      },
    })
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
        include: postInclude(userId),
      }),
      prisma.post.count({ where: { userId } }),
    ])

    return reply.send({ data: { posts: posts.map((p) => mapPost(p, userId)), total } })
  })

  // GET /api/v1/posts/user/:userId — another athlete's published workouts
  fastify.get('/user/:userId', { preHandler: authMiddleware }, async (request, reply) => {
    const { userId } = request.params as { userId: string }
    const parsed = PaginationQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(validationError(parsed.error.issues[0]?.message ?? 'Invalid query'))
    }
    const { limit, cursor } = parsed.data
    const viewerId = request.authUser.id

    if (!(await canViewUserPosts(viewerId, userId))) {
      return reply.status(403).send({ error: { code: 'PROFILE_PRIVATE', message: 'This profile is private' } })
    }

    const posts = await prisma.post.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: postInclude(viewerId),
    })

    const hasMore = posts.length > limit
    const page = hasMore ? posts.slice(0, limit) : posts

    return reply.send({
      data: {
        posts: page.map((p) => mapPost(p, viewerId)),
        nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      },
    })
  })

  // GET /api/v1/posts/:id — single post (the feed card's tap target)
  fastify.get('/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const viewerId = request.authUser.id

    const post = await prisma.post.findUnique({
      where: { id },
      include: postInclude(viewerId),
    })
    if (!post) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Post not found' } })

    if (!(await canViewUserPosts(viewerId, post.userId))) {
      return reply.status(403).send({ error: { code: 'PROFILE_PRIVATE', message: 'This profile is private' } })
    }

    return reply.send({ data: { post: mapPost(post, viewerId) } })
  })

  // DELETE /api/v1/posts/:id — unpublish own post (the training log itself stays)
  fastify.delete('/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const viewerId = request.authUser.id

    const post = await prisma.post.findUnique({
      where: { id },
      select: { userId: true, trainingLogId: true },
    })
    if (!post) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Post not found' } })
    if (post.userId !== viewerId) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Post does not belong to you' } })
    }

    await prisma.$transaction(async (tx) => {
      // Likes and comments have no FK cascade, so they go first.
      await tx.like.deleteMany({ where: { postId: id } })
      await tx.comment.deleteMany({ where: { postId: id } })
      await tx.post.delete({ where: { id } })
      if (post.trainingLogId) {
        await tx.trainingLog.update({ where: { id: post.trainingLogId }, data: { isPosted: false } })
      }
    })

    return reply.send({ data: { success: true } })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Likes
  // ───────────────────────────────────────────────────────────────────────────

  // POST /api/v1/posts/:id/like — idempotent: a repeated tap is still one like
  fastify.post('/:id/like', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const viewerId = request.authUser.id

    const post = await prisma.post.findUnique({ where: { id }, select: { userId: true } })
    if (!post) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Post not found' } })
    if (!(await canViewUserPosts(viewerId, post.userId))) {
      return reply.status(403).send({ error: { code: 'PROFILE_PRIVATE', message: 'This profile is private' } })
    }

    const existing = await prisma.like.findUnique({
      where: { userId_postId: { userId: viewerId, postId: id } },
      select: { userId: true },
    })
    if (!existing) {
      await prisma.like.create({ data: { userId: viewerId, postId: id } })
      // Only a genuinely new like is worth a notification.
      await notify(post.userId, viewerId, 'like', { postId: id })
    }

    const likeCount = await prisma.like.count({ where: { postId: id } })
    return reply.send({ data: { isLiked: true, likeCount } })
  })

  // DELETE /api/v1/posts/:id/like — idempotent unlike
  fastify.delete('/:id/like', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const viewerId = request.authUser.id

    const post = await prisma.post.findUnique({ where: { id }, select: { id: true } })
    if (!post) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Post not found' } })

    await prisma.like.deleteMany({ where: { userId: viewerId, postId: id } })
    const likeCount = await prisma.like.count({ where: { postId: id } })

    return reply.send({ data: { isLiked: false, likeCount } })
  })

  // GET /api/v1/posts/:id/likes — who liked this post
  fastify.get('/:id/likes', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = PaginationQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(validationError(parsed.error.issues[0]?.message ?? 'Invalid query'))
    }
    const viewerId = request.authUser.id

    const post = await prisma.post.findUnique({ where: { id }, select: { userId: true } })
    if (!post) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Post not found' } })
    if (!(await canViewUserPosts(viewerId, post.userId))) {
      return reply.status(403).send({ error: { code: 'PROFILE_PRIVATE', message: 'This profile is private' } })
    }

    const likes = await prisma.like.findMany({
      where: { postId: id },
      orderBy: { createdAt: 'desc' },
      take: parsed.data.limit,
      include: { user: { select: SOCIAL_USER_SELECT } },
    })

    return reply.send({ data: { users: likes.map((l) => mapSocialUser(l.user)) } })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Comments
  // ───────────────────────────────────────────────────────────────────────────

  // GET /api/v1/posts/:id/comments — oldest first, so a thread reads top-down
  fastify.get('/:id/comments', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = PaginationQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(validationError(parsed.error.issues[0]?.message ?? 'Invalid query'))
    }
    const { limit, cursor } = parsed.data
    const viewerId = request.authUser.id

    const post = await prisma.post.findUnique({ where: { id }, select: { userId: true } })
    if (!post) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Post not found' } })
    if (!(await canViewUserPosts(viewerId, post.userId))) {
      return reply.status(403).send({ error: { code: 'PROFILE_PRIVATE', message: 'This profile is private' } })
    }

    const comments = await prisma.comment.findMany({
      where: { postId: id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { user: { select: SOCIAL_USER_SELECT } },
    })

    const hasMore = comments.length > limit
    const page = hasMore ? comments.slice(0, limit) : comments

    return reply.send({
      data: {
        comments: page.map((c) => mapComment(c, viewerId)),
        nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      },
    })
  })

  // POST /api/v1/posts/:id/comments
  fastify.post('/:id/comments', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = CreateCommentSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(validationError(parsed.error.issues[0]?.message ?? 'Invalid comment'))
    }
    const viewerId = request.authUser.id

    const post = await prisma.post.findUnique({ where: { id }, select: { userId: true } })
    if (!post) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Post not found' } })
    if (!(await canViewUserPosts(viewerId, post.userId))) {
      return reply.status(403).send({ error: { code: 'PROFILE_PRIVATE', message: 'This profile is private' } })
    }

    const comment = await prisma.comment.create({
      data: { postId: id, userId: viewerId, content: parsed.data.content },
      include: { user: { select: SOCIAL_USER_SELECT } },
    })
    const commentCount = await prisma.comment.count({ where: { postId: id } })

    await notify(post.userId, viewerId, 'comment', {
      postId: id,
      preview: parsed.data.content.slice(0, 80),
    })

    return reply.status(201).send({
      data: { comment: mapComment(comment, viewerId), commentCount },
    })
  })

  // DELETE /api/v1/posts/:id/comments/:commentId — the comment's author, or the
  // post's author moderating their own thread.
  fastify.delete('/:id/comments/:commentId', { preHandler: authMiddleware }, async (request, reply) => {
    const { id, commentId } = request.params as { id: string; commentId: string }
    const viewerId = request.authUser.id

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true, postId: true, post: { select: { userId: true } } },
    })
    if (!comment || comment.postId !== id) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Comment not found' } })
    }
    if (comment.userId !== viewerId && comment.post.userId !== viewerId) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'You cannot delete this comment' } })
    }

    await prisma.comment.delete({ where: { id: commentId } })
    const commentCount = await prisma.comment.count({ where: { postId: id } })

    return reply.send({ data: { success: true, commentCount } })
  })
}
