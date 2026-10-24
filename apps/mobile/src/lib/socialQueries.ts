import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { api, type WorkoutPostRecord, type FeedScope } from './api'
import { showToast } from '../components/Toast'
import { getFriendlyErrorMessage } from './errorMessages'

// ─────────────────────────────────────────────
// Query keys
// ─────────────────────────────────────────────

export const socialKeys = {
  all: ['social'] as const,
  feed: (scope: FeedScope) => ['social', 'feed', scope] as const,
  post: (postId: string) => ['social', 'post', postId] as const,
  comments: (postId: string) => ['social', 'comments', postId] as const,
  profile: (userId: string) => ['social', 'profile', userId] as const,
  userPosts: (userId: string) => ['social', 'user-posts', userId] as const,
  followers: (userId: string) => ['social', 'followers', userId] as const,
  following: (userId: string) => ['social', 'following', userId] as const,
  search: (q: string) => ['social', 'search', q] as const,
  suggested: ['social', 'suggested'] as const,
  notifications: ['social', 'notifications'] as const,
  unreadCount: ['social', 'notifications', 'unread'] as const,
}

type PostPage = { data: { posts: WorkoutPostRecord[]; nextCursor: string | null } }
type PostFeedData = InfiniteData<PostPage>

// ─────────────────────────────────────────────
// Cache patching
// ─────────────────────────────────────────────

/**
 * Apply a change to one post everywhere it is currently cached — both feeds,
 * every profile's post list and the post detail — so a like tapped in the feed
 * is already correct when the detail screen opens.
 */
function patchPostEverywhere(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string,
  patch: (post: WorkoutPostRecord) => WorkoutPostRecord,
) {
  queryClient.setQueriesData<PostFeedData>({ queryKey: ['social', 'feed'] }, (old) =>
    old ? patchPages(old, postId, patch) : old,
  )
  queryClient.setQueriesData<PostFeedData>({ queryKey: ['social', 'user-posts'] }, (old) =>
    old ? patchPages(old, postId, patch) : old,
  )
  queryClient.setQueryData<{ data: { post: WorkoutPostRecord } }>(
    socialKeys.post(postId),
    (old) => (old ? { data: { post: patch(old.data.post) } } : old),
  )
}

function patchPages(
  data: PostFeedData,
  postId: string,
  patch: (post: WorkoutPostRecord) => WorkoutPostRecord,
): PostFeedData {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      data: {
        ...page.data,
        posts: page.data.posts.map((p) => (p.id === postId ? patch(p) : p)),
      },
    })),
  }
}

function removePostEverywhere(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string,
) {
  const drop = (old: PostFeedData | undefined) =>
    old
      ? {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: { ...page.data, posts: page.data.posts.filter((p) => p.id !== postId) },
          })),
        }
      : old

  queryClient.setQueriesData<PostFeedData>({ queryKey: ['social', 'feed'] }, drop)
  queryClient.setQueriesData<PostFeedData>({ queryKey: ['social', 'user-posts'] }, drop)
  queryClient.removeQueries({ queryKey: socialKeys.post(postId) })
}

// ─────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────

/**
 * Like/unlike with an optimistic flip. The counter moves on tap; if the request
 * fails the previous value is restored and the user is told why.
 */
export function useToggleLike() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ postId, isLiked }: { postId: string; isLiked: boolean }) =>
      isLiked ? api.posts.unlike(postId) : api.posts.like(postId),

    onMutate: async ({ postId, isLiked }) => {
      await queryClient.cancelQueries({ queryKey: socialKeys.post(postId) })
      patchPostEverywhere(queryClient, postId, (p) => ({
        ...p,
        isLiked: !isLiked,
        likeCount: Math.max(0, p.likeCount + (isLiked ? -1 : 1)),
      }))
      return { postId, isLiked }
    },

    onError: (error, _vars, context) => {
      if (context) {
        // Roll back to exactly what was shown before the tap.
        patchPostEverywhere(queryClient, context.postId, (p) => ({
          ...p,
          isLiked: context.isLiked,
          likeCount: Math.max(0, p.likeCount + (context.isLiked ? 1 : -1)),
        }))
      }
      showToast(getFriendlyErrorMessage(error), 'error')
    },

    onSuccess: (res, { postId }) => {
      // Trust the server's count — concurrent likes make the local guess drift.
      patchPostEverywhere(queryClient, postId, (p) => ({
        ...p,
        isLiked: res.data.isLiked,
        likeCount: res.data.likeCount,
      }))
    },
  })
}

/** Follow/unfollow, refreshing the profile header, both feeds and the lists. */
export function useToggleFollow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, isFollowing }: { userId: string; isFollowing: boolean }) =>
      isFollowing ? api.social.unfollow(userId) : api.social.follow(userId),

    onSuccess: (_res, { userId }) => {
      queryClient.invalidateQueries({ queryKey: socialKeys.profile(userId) })
      queryClient.invalidateQueries({ queryKey: ['social', 'feed'] })
      queryClient.invalidateQueries({ queryKey: ['social', 'followers'] })
      queryClient.invalidateQueries({ queryKey: ['social', 'following'] })
      queryClient.invalidateQueries({ queryKey: ['social', 'search'] })
      queryClient.invalidateQueries({ queryKey: socialKeys.suggested })
    },

    onError: (error) => showToast(getFriendlyErrorMessage(error), 'error'),
  })
}

/** Delete one of the viewer's own posts and drop it from every cached list. */
export function useDeletePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (postId: string) => api.posts.remove(postId),
    onSuccess: (_res, postId) => {
      removePostEverywhere(queryClient, postId)
      queryClient.invalidateQueries({ queryKey: ['my-workout-posts'] })
      showToast('Publicação removida', 'success')
    },
    onError: (error) => showToast(getFriendlyErrorMessage(error), 'error'),
  })
}

/** Post a comment, then refresh the thread and every cached comment counter. */
export function useAddComment(postId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (content: string) => api.posts.addComment(postId, content),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: socialKeys.comments(postId) })
      patchPostEverywhere(queryClient, postId, (p) => ({ ...p, commentCount: res.data.commentCount }))
    },
    onError: (error) => showToast(getFriendlyErrorMessage(error), 'error'),
  })
}

export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (commentId: string) => api.posts.removeComment(postId, commentId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: socialKeys.comments(postId) })
      patchPostEverywhere(queryClient, postId, (p) => ({ ...p, commentCount: res.data.commentCount }))
    },
    onError: (error) => showToast(getFriendlyErrorMessage(error), 'error'),
  })
}
