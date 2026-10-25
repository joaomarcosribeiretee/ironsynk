import React, { useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { api, type WorkoutPostRecord } from '../../lib/api'
import { socialKeys } from '../../lib/socialQueries'
import { getFriendlyErrorMessage } from '../../lib/errorMessages'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { Avatar } from '../../components/Avatar'
import { FollowButton } from '../../components/FollowButton'
import { WorkoutPostCard } from '../../components/WorkoutPostCard'
import { ListEmpty, ListError, ListLoading } from '../../components/ListStates'

type NavProp = NativeStackNavigationProp<AppStackParamList>
type ProfileRoute = RouteProp<AppStackParamList, 'UserProfile'>

function Stat({
  value,
  label,
  onPress,
}: {
  value: number
  label: string
  onPress?: () => void
}) {
  const content = (
    <>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </>
  )
  if (!onPress) return <View style={s.stat}>{content}</View>
  return (
    <TouchableOpacity style={s.stat} onPress={onPress} activeOpacity={0.75}>
      {content}
    </TouchableOpacity>
  )
}

export function UserProfileScreen() {
  const navigation = useNavigation<NavProp>()
  const { params } = useRoute<ProfileRoute>()
  const { userId } = params

  const profileQuery = useQuery({
    queryKey: socialKeys.profile(userId),
    queryFn: () => api.social.getProfile(userId),
  })
  const profile = profileQuery.data?.data.profile

  const postsQuery = useInfiniteQuery({
    queryKey: socialKeys.userPosts(userId),
    queryFn: ({ pageParam }) =>
      api.posts.listByUser(userId, { cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.data.nextCursor ?? undefined,
    // Private profiles answer 403 until the viewer follows them.
    enabled: !!profile?.canViewPosts,
  })

  const posts = postsQuery.data?.pages.flatMap((p) => p.data.posts) ?? []

  const openUser = useCallback(
    (id: string) => navigation.push('UserProfile', { userId: id }),
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

  function renderHeader() {
    if (!profile) return null
    return (
      <View style={s.headerCard}>
        <Avatar uri={profile.avatar} name={profile.name} size={78} />
        <Text style={s.name}>{profile.name ?? 'Atleta'}</Text>
        {profile.role === 'TRAINER' && <Text style={s.roleTag}>Personal trainer</Text>}
        {!!profile.bio && <Text style={s.bio}>{profile.bio}</Text>}
        {!!profile.gymName && (
          <View style={s.gymRow}>
            <Ionicons name="location-outline" size={13} color="#8A8A9A" />
            <Text style={s.gym}>{profile.gymName}</Text>
          </View>
        )}

        <View style={s.statsRow}>
          <Stat value={profile.counts.posts} label="Treinos" />
          <View style={s.statDivider} />
          <Stat
            value={profile.counts.followers}
            label="Seguidores"
            onPress={() =>
              navigation.navigate('FollowList', {
                userId,
                kind: 'followers',
                name: profile.name ?? 'Atleta',
              })
            }
          />
          <View style={s.statDivider} />
          <Stat
            value={profile.counts.following}
            label="Seguindo"
            onPress={() =>
              navigation.navigate('FollowList', {
                userId,
                kind: 'following',
                name: profile.name ?? 'Atleta',
              })
            }
          />
        </View>

        {!profile.isMe && (
          <FollowButton
            userId={userId}
            isFollowing={profile.isFollowing}
            followsMe={profile.followsMe}
          />
        )}
      </View>
    )
  }

  function renderBody() {
    if (!profile) return null
    if (!profile.canViewPosts) {
      return (
        <ListEmpty
          icon="lock-closed-outline"
          title="Perfil privado"
          sub="Siga este atleta para ver os treinos publicados."
        />
      )
    }
    if (postsQuery.isLoading) return <ListLoading />
    if (postsQuery.isError) {
      return (
        <ListError
          message={getFriendlyErrorMessage(postsQuery.error)}
          onRetry={() => postsQuery.refetch()}
        />
      )
    }
    return (
      <ListEmpty
        icon="barbell-outline"
        title={profile.isMe ? 'Você ainda não publicou treinos' : 'Nenhum treino publicado'}
        sub={
          profile.isMe
            ? 'Finalize um treino e compartilhe com a comunidade.'
            : 'Quando este atleta publicar um treino, ele aparece aqui.'
        }
      />
    )
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={s.topBtn}>
          <Ionicons name="chevron-back" size={24} color="#F0F0F5" />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>{profile?.name ?? 'Perfil'}</Text>
        <View style={s.topBtn} />
      </View>

      {profileQuery.isLoading ? (
        <ListLoading />
      ) : profileQuery.isError || !profile ? (
        <ListError
          message={getFriendlyErrorMessage(profileQuery.error)}
          onRetry={() => profileQuery.refetch()}
        />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader()}
          ListEmptyComponent={renderBody()}
          refreshControl={
            <RefreshControl
              refreshing={profileQuery.isRefetching}
              onRefresh={() => {
                profileQuery.refetch()
                if (profile.canViewPosts) postsQuery.refetch()
              }}
              tintColor="#4FC3F7"
            />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (postsQuery.hasNextPage && !postsQuery.isFetchingNextPage) postsQuery.fetchNextPage()
          }}
          ListFooterComponent={
            postsQuery.isFetchingNextPage ? (
              <View style={s.footer}>
                <ActivityIndicator color="#4FC3F7" />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  topBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: '#F0F0F5', fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },

  list: { paddingHorizontal: 16, paddingBottom: 32 },

  headerCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  name: { color: '#F0F0F5', fontSize: 20, fontWeight: '800', marginTop: 6, letterSpacing: -0.3 },
  roleTag: {
    color: '#4FC3F7',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  bio: { color: '#C4C4CE', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 2 },
  gymRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  gym: { color: '#8A8A9A', fontSize: 12.5 },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#1E1E24',
    borderWidth: 1,
    borderColor: '#2A2A35',
    borderRadius: 14,
    paddingVertical: 14,
    marginVertical: 10,
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { color: '#F0F0F5', fontSize: 18, fontWeight: '700' },
  statLabel: {
    color: '#555560',
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  statDivider: { width: 1, height: 30, backgroundColor: '#23232C' },

  footer: { paddingVertical: 20 },
})
