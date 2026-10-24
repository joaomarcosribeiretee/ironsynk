import type { Prisma } from '@prisma/client'
import type { PostMediaItem } from '@ironsynk/shared'
import { prisma } from './prisma.js'

// ─────────────────────────────────────────────
// Selects / includes
// ─────────────────────────────────────────────

const EXERCISE_SELECT = {
  id: true, name: true, muscleGroup: true, equipment: true, gifUrl: true, videoUrl: true,
} as const

const SET_SELECT = {
  id: true, trainingLogId: true, executionExerciseId: true, exerciseId: true,
  setNumber: true, order: true, setType: true, technique: true, techniqueConfig: true,
  repsCompleted: true, weightKg: true, isChecked: true, checkedAt: true,
  isPersonalRecord: true, notes: true, plannedSetId: true,
} as const

export const SESSION_INCLUDE = {
  executionExercises: {
    orderBy: { order: 'asc' as const },
    include: {
      exercise: { select: EXERCISE_SELECT },
      setLogs: { select: SET_SELECT, orderBy: { order: 'asc' as const } },
    },
  },
} as const

export const SOCIAL_USER_SELECT = {
  id: true,
  role: true,
  profile: { select: { name: true, avatar: true } },
} as const

/**
 * Everything a feed card needs in one round trip: author, session, counters and
 * the viewer's own like (fetched as a 0-or-1 row instead of a second query).
 */
export function postInclude(viewerId: string) {
  return {
    user: { select: SOCIAL_USER_SELECT },
    trainingLog: { include: SESSION_INCLUDE },
    _count: { select: { likes: true, comments: true } },
    likes: { where: { userId: viewerId }, select: { userId: true } },
  } satisfies Prisma.PostInclude
}

// ─────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────

export function mapSocialUser(u: any) {
  return {
    id: u.id,
    name: u.profile?.name ?? null,
    avatar: u.profile?.avatar ?? null,
    role: u.role,
  }
}

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

/**
 * Feed/detail post shape. `imageUrls`/`videoUrl` stay in the payload for
 * backward compatibility with clients that predate the `media` carousel.
 */
export function mapPost(p: any, viewerId: string) {
  return {
    id: p.id,
    content: p.content,
    imageUrls: p.imageUrls,
    videoUrl: p.videoUrl,
    media: (p.media ?? null) as PostMediaItem[] | null,
    createdAt: p.createdAt,
    user: p.user ? mapSocialUser(p.user) : null,
    session: p.trainingLog ? mapSession(p.trainingLog) : null,
    likeCount: p._count?.likes ?? 0,
    commentCount: p._count?.comments ?? 0,
    isLiked: Array.isArray(p.likes) ? p.likes.length > 0 : false,
    isMine: p.userId === viewerId,
  }
}

export function mapComment(c: any, viewerId: string) {
  return {
    id: c.id,
    postId: c.postId,
    content: c.content,
    createdAt: c.createdAt,
    user: mapSocialUser(c.user),
    isMine: c.userId === viewerId,
  }
}

// ─────────────────────────────────────────────
// Visibility
// ─────────────────────────────────────────────

/**
 * A private profile's posts are visible only to the owner and to accepted
 * followers. Public profiles are visible to any signed-in user.
 */
export async function canViewUserPosts(viewerId: string, targetUserId: string): Promise<boolean> {
  if (viewerId === targetUserId) return true

  const profile = await prisma.profile.findUnique({
    where: { userId: targetUserId },
    select: { isPrivate: true },
  })
  if (!profile?.isPrivate) return true

  const follow = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: viewerId, followingId: targetUserId } },
    select: { followerId: true },
  })
  return follow !== null
}

// ─────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────

export type NotificationPayload = {
  actorId: string
  postId?: string
  preview?: string
}

/**
 * Fire-and-forget social notification. Never notifies a user about their own
 * action, and never fails the request that triggered it — a dropped
 * notification must not roll back a like, comment or follow.
 */
export async function notify(
  recipientId: string,
  actorId: string,
  type: 'like' | 'comment' | 'follow',
  payload: Omit<NotificationPayload, 'actorId'> = {},
): Promise<void> {
  if (recipientId === actorId) return
  try {
    await prisma.notification.create({
      data: { userId: recipientId, type, payload: { actorId, ...payload } },
    })
  } catch {
    // swallowed on purpose — see doc comment
  }
}
