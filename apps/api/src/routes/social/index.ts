import type { FastifyInstance } from 'fastify'
import { PaginationQuerySchema, UserSearchQuerySchema } from '@ironsynk/shared'
import { prisma } from '../../lib/prisma.js'
import { authMiddleware } from '../../middleware/auth.js'
import { SOCIAL_USER_SELECT, mapSocialUser, notify } from '../../lib/social.js'

function validationError(message: string) {
  return { error: { code: 'VALIDATION_ERROR', message } }
}

/**
 * Follow state between the viewer and a list of users, in one query each way —
 * so a 20-row list costs two queries instead of forty.
 */
async function followStateFor(viewerId: string, userIds: string[]) {
  if (userIds.length === 0) return { following: new Set<string>(), followers: new Set<string>() }

  const [following, followers] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: viewerId, followingId: { in: userIds } },
      select: { followingId: true },
    }),
    prisma.follow.findMany({
      where: { followingId: viewerId, followerId: { in: userIds } },
      select: { followerId: true },
    }),
  ])

  return {
    following: new Set(following.map((f) => f.followingId)),
    followers: new Set(followers.map((f) => f.followerId)),
  }
}

export async function socialRoutes(fastify: FastifyInstance): Promise<void> {
  // ───────────────────────────────────────────────────────────────────────────
  // Discovery
  // ───────────────────────────────────────────────────────────────────────────

  // GET /api/v1/social/users/search?q= — find athletes and trainers by name.
  // Private profiles stay searchable (so people can find and request them) but
  // their posts remain gated by canViewUserPosts.
  fastify.get('/users/search', { preHandler: authMiddleware }, async (request, reply) => {
    const parsed = UserSearchQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(validationError(parsed.error.issues[0]?.message ?? 'Invalid query'))
    }
    const { q, limit } = parsed.data
    const viewerId = request.authUser.id

    const users = await prisma.user.findMany({
      where: {
        id: { not: viewerId },
        isActive: true,
        profile: { is: { name: { contains: q, mode: 'insensitive' } } },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: SOCIAL_USER_SELECT,
    })

    const state = await followStateFor(viewerId, users.map((u) => u.id))

    return reply.send({
      data: {
        users: users.map((u) => ({
          ...mapSocialUser(u),
          isFollowing: state.following.has(u.id),
          followsMe: state.followers.has(u.id),
        })),
      },
    })
  })

  // GET /api/v1/social/users/suggested — people to follow when the feed is empty
  fastify.get('/users/suggested', { preHandler: authMiddleware }, async (request, reply) => {
    const viewerId = request.authUser.id

    const following = await prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    })

    const users = await prisma.user.findMany({
      where: {
        id: { notIn: [...following.map((f) => f.followingId), viewerId] },
        isActive: true,
        profile: { is: { isPrivate: false } },
        // Only suggest athletes who actually post — an empty profile is a dead end.
        posts: { some: {} },
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: SOCIAL_USER_SELECT,
    })

    return reply.send({
      data: {
        users: users.map((u) => ({ ...mapSocialUser(u), isFollowing: false, followsMe: false })),
      },
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Social profile
  // ───────────────────────────────────────────────────────────────────────────

  // GET /api/v1/social/users/:userId — the profile a feed avatar opens
  fastify.get('/users/:userId', { preHandler: authMiddleware }, async (request, reply) => {
    const { userId } = request.params as { userId: string }
    const viewerId = request.authUser.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        isActive: true,
        profile: { select: { name: true, avatar: true, bio: true, gymName: true, isPrivate: true } },
        trainerProfile: { select: { bio: true, specialties: true, acceptingClients: true } },
        _count: { select: { posts: true, followers: true, following: true } },
      },
    })
    if (!user || !user.isActive) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Profile not found' } })
    }

    const isMe = user.id === viewerId
    const [isFollowing, followsMe] = isMe
      ? [false, false]
      : await Promise.all([
          prisma.follow
            .findUnique({
              where: { followerId_followingId: { followerId: viewerId, followingId: userId } },
              select: { followerId: true },
            })
            .then((f) => f !== null),
          prisma.follow
            .findUnique({
              where: { followerId_followingId: { followerId: userId, followingId: viewerId } },
              select: { followerId: true },
            })
            .then((f) => f !== null),
        ])

    const isPrivate = user.profile?.isPrivate ?? false

    return reply.send({
      data: {
        profile: {
          id: user.id,
          role: user.role,
          name: user.profile?.name ?? null,
          avatar: user.profile?.avatar ?? null,
          bio: user.profile?.bio ?? user.trainerProfile?.bio ?? null,
          gymName: user.profile?.gymName ?? null,
          isPrivate,
          isMe,
          isFollowing,
          followsMe,
          canViewPosts: isMe || !isPrivate || isFollowing,
          counts: {
            // `followers` is the Follow rows pointing AT this user — the
            // "Following" relation name in the schema reads the other way round.
            posts: user._count.posts,
            followers: user._count.followers,
            following: user._count.following,
          },
        },
      },
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Follows
  // ───────────────────────────────────────────────────────────────────────────

  // POST /api/v1/social/users/:userId/follow — idempotent
  fastify.post('/users/:userId/follow', { preHandler: authMiddleware }, async (request, reply) => {
    const { userId } = request.params as { userId: string }
    const viewerId = request.authUser.id

    if (userId === viewerId) {
      return reply.status(422).send({ error: { code: 'CANNOT_FOLLOW_SELF', message: 'You cannot follow yourself' } })
    }

    const target = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } })
    if (!target || !target.isActive) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'User not found' } })
    }

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: userId } },
      select: { followerId: true },
    })
    if (!existing) {
      await prisma.follow.create({ data: { followerId: viewerId, followingId: userId } })
      await notify(userId, viewerId, 'follow')
    }

    const followerCount = await prisma.follow.count({ where: { followingId: userId } })
    return reply.send({ data: { isFollowing: true, followerCount } })
  })

  // DELETE /api/v1/social/users/:userId/follow — idempotent
  fastify.delete('/users/:userId/follow', { preHandler: authMiddleware }, async (request, reply) => {
    const { userId } = request.params as { userId: string }
    const viewerId = request.authUser.id

    await prisma.follow.deleteMany({ where: { followerId: viewerId, followingId: userId } })
    const followerCount = await prisma.follow.count({ where: { followingId: userId } })

    return reply.send({ data: { isFollowing: false, followerCount } })
  })

  // GET /api/v1/social/users/:userId/followers
  fastify.get('/users/:userId/followers', { preHandler: authMiddleware }, async (request, reply) => {
    return listFollows(request, reply, 'followers')
  })

  // GET /api/v1/social/users/:userId/following
  fastify.get('/users/:userId/following', { preHandler: authMiddleware }, async (request, reply) => {
    return listFollows(request, reply, 'following')
  })

  async function listFollows(request: any, reply: any, kind: 'followers' | 'following') {
    const { userId } = request.params as { userId: string }
    const parsed = PaginationQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(validationError(parsed.error.issues[0]?.message ?? 'Invalid query'))
    }
    const { limit, cursor } = parsed.data
    const viewerId = request.authUser.id

    // Keyset pagination needs a single unique column; Follow's key is composite,
    // so the cursor is the id of the user on the far side of the edge.
    const rows = await prisma.follow.findMany({
      where: kind === 'followers' ? { followingId: userId } : { followerId: userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor
        ? {
            cursor:
              kind === 'followers'
                ? { followerId_followingId: { followerId: cursor, followingId: userId } }
                : { followerId_followingId: { followerId: userId, followingId: cursor } },
            skip: 1,
          }
        : {}),
      include:
        kind === 'followers'
          ? { follower: { select: SOCIAL_USER_SELECT } }
          : { following: { select: SOCIAL_USER_SELECT } },
    })

    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    const users = page.map((r: any) => (kind === 'followers' ? r.follower : r.following))
    const state = await followStateFor(viewerId, users.map((u: any) => u.id))

    return reply.send({
      data: {
        users: users.map((u: any) => ({
          ...mapSocialUser(u),
          isFollowing: state.following.has(u.id),
          followsMe: state.followers.has(u.id),
        })),
        nextCursor: hasMore ? (users[users.length - 1]?.id ?? null) : null,
      },
    })
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Notifications
  // ───────────────────────────────────────────────────────────────────────────

  // GET /api/v1/social/notifications — newest first, actors hydrated in one pass
  fastify.get('/notifications', { preHandler: authMiddleware }, async (request, reply) => {
    const parsed = PaginationQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(validationError(parsed.error.issues[0]?.message ?? 'Invalid query'))
    }
    const { limit, cursor } = parsed.data
    const viewerId = request.authUser.id

    const rows = await prisma.notification.findMany({
      where: { userId: viewerId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows

    const actorIds = [
      ...new Set(
        page
          .map((n) => (n.payload as { actorId?: string } | null)?.actorId)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ]
    const actors = actorIds.length
      ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: SOCIAL_USER_SELECT })
      : []
    const actorById = new Map(actors.map((a) => [a.id, mapSocialUser(a)]))

    const unreadCount = await prisma.notification.count({ where: { userId: viewerId, isRead: false } })

    return reply.send({
      data: {
        notifications: page.map((n) => {
          const payload = (n.payload ?? {}) as { actorId?: string; postId?: string; preview?: string }
          return {
            id: n.id,
            type: n.type,
            isRead: n.isRead,
            createdAt: n.createdAt,
            actor: payload.actorId ? (actorById.get(payload.actorId) ?? null) : null,
            postId: payload.postId ?? null,
            preview: payload.preview ?? null,
          }
        }),
        nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
        unreadCount,
      },
    })
  })

  // GET /api/v1/social/notifications/unread-count — the tab-bar badge
  fastify.get('/notifications/unread-count', { preHandler: authMiddleware }, async (request, reply) => {
    const unreadCount = await prisma.notification.count({
      where: { userId: request.authUser.id, isRead: false },
    })
    return reply.send({ data: { unreadCount } })
  })

  // POST /api/v1/social/notifications/read — mark all as read
  fastify.post('/notifications/read', { preHandler: authMiddleware }, async (request, reply) => {
    await prisma.notification.updateMany({
      where: { userId: request.authUser.id, isRead: false },
      data: { isRead: true },
    })
    return reply.send({ data: { success: true } })
  })
}
