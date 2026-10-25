import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { api, type FeedScope, type WorkoutPostRecord } from '../../lib/api'
import { socialKeys } from '../../lib/socialQueries'
import { getFriendlyErrorMessage } from '../../lib/errorMessages'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { useFloatingTabBarInset } from '../../navigation/FloatingTabBar'
import { WorkoutPostCard } from '../../components/WorkoutPostCard'
import { SocialUserRow } from '../../components/SocialUserRow'
import { ListEmpty, ListError, ListLoading } from '../../components/ListStates'

type NavProp = NativeStackNavigationProp<AppStackParamList>

const SCOPES: { key: FeedScope; label: string }[] = [
  { key: 'following', label: 'Seguindo' },
  { key: 'discover', label: 'Descobrir' },
]

// ─── Suggestions shown when the "Seguindo" feed has nothing yet ───────────────

function SuggestedAthletes({ onOpenUser }: { onOpenUser: (userId: string) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: socialKeys.suggested,
    queryFn: () => api.social.suggestedUsers(),
  })

  const users = data?.data.users ?? []
  if (isLoading || users.length === 0) return null

  return (
    <View style={s.suggestions}>
      <Text style={s.suggestionsTitle}>Atletas para seguir</Text>
      {users.map((u) => (
        <SocialUserRow key={u.id} user={u} onPress={onOpenUser} />
      ))}
    </View>
  )
}

// ─── Feed ────────────────────────────────────────────────────────────────────

export function FeedScreen() {
  const navigation = useNavigation<NavProp>()
  const tabBarInset = useFloatingTabBarInset()
  const [scope, setScope] = useState<FeedScope>('following')

  const feed = useInfiniteQuery({
    queryKey: socialKeys.feed(scope),
    queryFn: ({ pageParam }) =>
      api.posts.feed({ scope, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.data.nextCursor ?? undefined,
  })

  const unread = useQuery({
    queryKey: socialKeys.unreadCount,
    queryFn: () => api.social.unreadNotificationCount(),
    // The badge is ambient information; it should never block or spam the feed.
    staleTime: 60_000,
  })

  const posts = feed.data?.pages.flatMap((p) => p.data.posts) ?? []
  const unreadCount = unread.data?.data.unreadCount ?? 0

  const openUser = useCallback(
    (userId: string) => navigation.navigate('UserProfile', { userId }),
    [navigation],
  )
  const openPost = useCallback(
    (postId: string) => navigation.navigate('PostDetail', { postId }),
    [navigation],
  )
  const openComments = useCallback(
    (postId: string) => navigation.navigate('PostDetail', { postId, focusComment: true }),
    [navigation],
  )

  const renderItem = useCallback(
    ({ item }: { item: WorkoutPostRecord }) => (
      <WorkoutPostCard
        post={item}
        variant="feed"
        onPressUser={openUser}
        onPressPost={openPost}
        onPressComments={openComments}
      />
    ),
    [openUser, openPost, openComments],
  )

  function renderEmpty() {
    if (feed.isLoading) return <ListLoading />
    if (feed.isError) {
      return <ListError message={getFriendlyErrorMessage(feed.error)} onRetry={() => feed.refetch()} />
    }
    if (scope === 'discover') {
      return (
        <ListEmpty
          icon="compass-outline"
          title="Nada por aqui ainda"
          sub="Quando outros atletas publicarem treinos, eles aparecem nesta aba."
        />
      )
    }
    return (
      <>
        <ListEmpty
          icon="people-outline"
          title="Seu feed está vazio"
          sub="Siga outros atletas para acompanhar os treinos deles por aqui."
          actionLabel="Descobrir atletas"
          onAction={() => setScope('discover')}
        />
        <SuggestedAthletes onOpenUser={openUser} />
      </>
    )
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.brand}>IronSynk</Text>
        <View style={s.headerActions}>
          <TouchableOpacity
            style={s.iconBtn}
            onPress={() => navigation.navigate('UserSearch')}
            hitSlop={8}
          >
            <Ionicons name="search" size={21} color="#F0F0F5" />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.iconBtn}
            onPress={() => navigation.navigate('Notifications')}
            hitSlop={8}
          >
            <Ionicons name="notifications-outline" size={21} color="#F0F0F5" />
            {unreadCount > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.scopeRow}>
        {SCOPES.map((item) => {
          const active = item.key === scope
          return (
            <TouchableOpacity
              key={item.key}
              style={[s.scopeTab, active && s.scopeTabActive]}
              onPress={() => setScope(item.key)}
              activeOpacity={0.85}
            >
              <Text style={[s.scopeLabel, active && s.scopeLabelActive]}>{item.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          s.list,
          { paddingBottom: tabBarInset + 16 },
          posts.length === 0 && s.listEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty()}
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefetching && !feed.isFetchingNextPage}
            onRefresh={() => feed.refetch()}
            tintColor="#4FC3F7"
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage()
        }}
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <View style={s.footer}>
              <ActivityIndicator color="#4FC3F7" />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  brand: { color: '#F0F0F5', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { padding: 6 },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: '#FF5252',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },

  scopeRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  scopeTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#2A2A35',
  },
  scopeTabActive: { backgroundColor: '#1E1E24', borderColor: '#4FC3F7' },
  scopeLabel: { color: '#8A8A9A', fontSize: 13, fontWeight: '600' },
  scopeLabelActive: { color: '#4FC3F7' },

  list: { paddingHorizontal: 16 },
  listEmpty: { flexGrow: 1 },
  footer: { paddingVertical: 20 },

  suggestions: {
    marginTop: 8,
    backgroundColor: '#1E1E24',
    borderWidth: 1,
    borderColor: '#2A2A35',
    borderRadius: 16,
    paddingVertical: 8,
  },
  suggestionsTitle: {
    color: '#8A8A9A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
})
