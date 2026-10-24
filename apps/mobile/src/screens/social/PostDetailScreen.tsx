import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { api, type PostComment } from '../../lib/api'
import {
  socialKeys,
  useAddComment,
  useDeleteComment,
  useDeletePost,
} from '../../lib/socialQueries'
import { getFriendlyErrorMessage } from '../../lib/errorMessages'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { WorkoutPostCard } from '../../components/WorkoutPostCard'
import { Avatar } from '../../components/Avatar'
import { ConfirmModal } from '../../components/ConfirmModal'
import { ListEmpty, ListError, ListLoading } from '../../components/ListStates'

type NavProp = NativeStackNavigationProp<AppStackParamList>
type DetailRoute = RouteProp<AppStackParamList, 'PostDetail'>

const COMMENT_MAX_CHARS = 500

function formatRelative(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin}min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}d`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// ─── Comment row ─────────────────────────────────────────────────────────────

function CommentRow({
  comment,
  canDelete,
  onPressUser,
  onDelete,
}: {
  comment: PostComment
  canDelete: boolean
  onPressUser: (userId: string) => void
  onDelete: (commentId: string) => void
}) {
  return (
    <View style={s.comment}>
      <TouchableOpacity onPress={() => onPressUser(comment.user.id)} activeOpacity={0.8}>
        <Avatar uri={comment.user.avatar} name={comment.user.name} size={34} />
      </TouchableOpacity>
      <View style={s.commentBody}>
        <View style={s.commentHead}>
          <Text style={s.commentName} numberOfLines={1}>{comment.user.name ?? 'Atleta'}</Text>
          <Text style={s.commentTime}>{formatRelative(comment.createdAt)}</Text>
        </View>
        <Text style={s.commentText}>{comment.content}</Text>
      </View>
      {canDelete && (
        <TouchableOpacity onPress={() => onDelete(comment.id)} hitSlop={10} style={s.commentDelete}>
          <Ionicons name="trash-outline" size={15} color="#4A4A5A" />
        </TouchableOpacity>
      )}
    </View>
  )
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function PostDetailScreen() {
  const navigation = useNavigation<NavProp>()
  const { params } = useRoute<DetailRoute>()
  const { postId } = params

  const [draft, setDraft] = useState('')
  const [pendingCommentId, setPendingCommentId] = useState<string | null>(null)
  const [confirmDeletePost, setConfirmDeletePost] = useState(false)

  const postQuery = useQuery({
    queryKey: socialKeys.post(postId),
    queryFn: () => api.posts.get(postId),
  })

  const commentsQuery = useInfiniteQuery({
    queryKey: socialKeys.comments(postId),
    queryFn: ({ pageParam }) =>
      api.posts.listComments(postId, { cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.data.nextCursor ?? undefined,
    // A private post answers 403 on the post itself; don't hammer the thread too.
    enabled: postQuery.isSuccess,
  })

  const addComment = useAddComment(postId)
  const deleteComment = useDeleteComment(postId)
  const deletePost = useDeletePost()

  const post = postQuery.data?.data.post
  const comments = commentsQuery.data?.pages.flatMap((p) => p.data.comments) ?? []

  const openUser = useCallback(
    (userId: string) => navigation.navigate('UserProfile', { userId }),
    [navigation],
  )

  function submitComment() {
    const content = draft.trim()
    if (!content || addComment.isPending) return
    addComment.mutate(content, { onSuccess: () => setDraft('') })
  }

  function confirmDeleteComment() {
    if (!pendingCommentId) return
    deleteComment.mutate(pendingCommentId)
    setPendingCommentId(null)
  }

  function onDeletePost() {
    setConfirmDeletePost(false)
    deletePost.mutate(postId, { onSuccess: () => navigation.goBack() })
  }

  const canDeleteComment = (comment: PostComment) => comment.isMine || !!post?.isMine

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={s.headerBtn}>
          <Ionicons name="chevron-back" size={24} color="#F0F0F5" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Publicação</Text>
        {post?.isMine ? (
          <TouchableOpacity onPress={() => setConfirmDeletePost(true)} hitSlop={10} style={s.headerBtn}>
            <Ionicons name="trash-outline" size={20} color="#FF5252" />
          </TouchableOpacity>
        ) : (
          <View style={s.headerBtn} />
        )}
      </View>

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {postQuery.isLoading ? (
          <ListLoading />
        ) : postQuery.isError || !post ? (
          <ListError
            message={getFriendlyErrorMessage(postQuery.error)}
            onRetry={() => postQuery.refetch()}
          />
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View style={s.postWrap}>
                <WorkoutPostCard
                  post={post}
                  variant="feed"
                  onPressUser={openUser}
                  // Already on the post — the card body opens the workout itself.
                  onPressPost={() => {
                    if (post.session) {
                      navigation.navigate('WorkoutSession', { sessionId: post.session.id })
                    }
                  }}
                  onPressComments={() => {}}
                />
                <Text style={s.sectionTitle}>
                  {post.commentCount === 0
                    ? 'Comentários'
                    : `Comentários · ${post.commentCount}`}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <CommentRow
                comment={item}
                canDelete={canDeleteComment(item)}
                onPressUser={openUser}
                onDelete={setPendingCommentId}
              />
            )}
            ListEmptyComponent={
              commentsQuery.isLoading ? (
                <ListLoading />
              ) : commentsQuery.isError ? (
                <ListError
                  message={getFriendlyErrorMessage(commentsQuery.error)}
                  onRetry={() => commentsQuery.refetch()}
                />
              ) : (
                <ListEmpty
                  icon="chatbubble-outline"
                  title="Nenhum comentário ainda"
                  sub="Seja o primeiro a comentar este treino."
                />
              )
            }
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (commentsQuery.hasNextPage && !commentsQuery.isFetchingNextPage) {
                commentsQuery.fetchNextPage()
              }
            }}
            ListFooterComponent={
              commentsQuery.isFetchingNextPage ? (
                <View style={s.footer}>
                  <ActivityIndicator color="#4FC3F7" />
                </View>
              ) : null
            }
          />
        )}

        {!!post && (
          <View style={s.composer}>
            <TextInput
              style={s.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Escreva um comentário..."
              placeholderTextColor="#4A4A5A"
              maxLength={COMMENT_MAX_CHARS}
              multiline
              autoFocus={!!params.focusComment}
            />
            <TouchableOpacity
              style={[s.sendBtn, (!draft.trim() || addComment.isPending) && s.sendBtnDisabled]}
              onPress={submitComment}
              disabled={!draft.trim() || addComment.isPending}
              activeOpacity={0.85}
            >
              {addComment.isPending ? (
                <ActivityIndicator size="small" color="#0B0B0F" />
              ) : (
                <Ionicons name="arrow-up" size={18} color="#0B0B0F" />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={confirmDeletePost}
        title="Excluir publicação"
        message="O treino continua no seu histórico, mas sai do feed. Não dá para desfazer."
        confirmText="Excluir"
        destructive
        onConfirm={onDeletePost}
        onCancel={() => setConfirmDeletePost(false)}
      />

      <ConfirmModal
        visible={pendingCommentId !== null}
        title="Excluir comentário"
        message="Este comentário será removido para todos."
        confirmText="Excluir"
        destructive
        onConfirm={confirmDeleteComment}
        onCancel={() => setPendingCommentId(null)}
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#F0F0F5', fontSize: 16, fontWeight: '700' },

  list: { paddingBottom: 16 },
  postWrap: { paddingHorizontal: 16, paddingTop: 4 },
  sectionTitle: {
    color: '#8A8A9A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
    marginBottom: 6,
  },
  footer: { paddingVertical: 16 },

  comment: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 9 },
  commentBody: { flex: 1, minWidth: 0, gap: 3 },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentName: { color: '#F0F0F5', fontSize: 13.5, fontWeight: '600', flexShrink: 1 },
  commentTime: { color: '#555560', fontSize: 11 },
  commentText: { color: '#C4C4CE', fontSize: 14, lineHeight: 20 },
  commentDelete: { paddingTop: 4, paddingLeft: 4 },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A2A35',
    backgroundColor: '#141418',
  },
  input: {
    flex: 1,
    maxHeight: 110,
    color: '#F0F0F5',
    fontSize: 14.5,
    lineHeight: 20,
    backgroundColor: '#1E1E24',
    borderWidth: 1,
    borderColor: '#2A2A35',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4FC3F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#2A2A35' },
})
