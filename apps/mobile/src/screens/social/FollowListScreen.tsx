import React from 'react'
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { socialKeys } from '../../lib/socialQueries'
import { getFriendlyErrorMessage } from '../../lib/errorMessages'
import { useAuthStore } from '../../store/authStore'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { SocialUserRow } from '../../components/SocialUserRow'
import { ListEmpty, ListError, ListLoading } from '../../components/ListStates'

type NavProp = NativeStackNavigationProp<AppStackParamList>
type FollowRoute = RouteProp<AppStackParamList, 'FollowList'>

export function FollowListScreen() {
  const navigation = useNavigation<NavProp>()
  const { params } = useRoute<FollowRoute>()
  const { userId, kind, name } = params
  const meId = useAuthStore((state) => state.user?.id)

  const query = useInfiniteQuery({
    queryKey: kind === 'followers' ? socialKeys.followers(userId) : socialKeys.following(userId),
    queryFn: ({ pageParam }) => {
      const opts = { cursor: pageParam as string | undefined }
      return kind === 'followers'
        ? api.social.listFollowers(userId, opts)
        : api.social.listFollowing(userId, opts)
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.data.nextCursor ?? undefined,
  })

  const users = query.data?.pages.flatMap((p) => p.data.users) ?? []
  const isMine = meId === userId
  const title = kind === 'followers' ? 'Seguidores' : 'Seguindo'

  function renderEmpty() {
    if (query.isLoading) return <ListLoading />
    if (query.isError) {
      return <ListError message={getFriendlyErrorMessage(query.error)} onRetry={() => query.refetch()} />
    }
    if (kind === 'followers') {
      return (
        <ListEmpty
          icon="people-outline"
          title="Nenhum seguidor ainda"
          sub={isMine ? 'Publique treinos para atrair a comunidade.' : `${name ?? 'Este atleta'} ainda não tem seguidores.`}
        />
      )
    }
    return (
      <ListEmpty
        icon="person-add-outline"
        title="Não segue ninguém ainda"
        sub={isMine ? 'Busque atletas para montar seu feed.' : `${name ?? 'Este atleta'} ainda não segue ninguém.`}
        actionLabel={isMine ? 'Buscar atletas' : undefined}
        onAction={isMine ? () => navigation.navigate('UserSearch') : undefined}
      />
    )
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={s.topBtn}>
          <Ionicons name="chevron-back" size={24} color="#F0F0F5" />
        </TouchableOpacity>
        <View style={s.titleWrap}>
          <Text style={s.title}>{title}</Text>
          {!!name && <Text style={s.subtitle} numberOfLines={1}>{name}</Text>}
        </View>
        <View style={s.topBtn} />
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SocialUserRow
            user={item}
            isMe={item.id === meId}
            onPress={(id) => navigation.push('UserProfile', { userId: id })}
          />
        )}
        contentContainerStyle={[s.list, users.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty()}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage()
        }}
        ListFooterComponent={
          query.isFetchingNextPage ? (
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  topBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1, alignItems: 'center' },
  title: { color: '#F0F0F5', fontSize: 16, fontWeight: '700' },
  subtitle: { color: '#8A8A9A', fontSize: 11.5, marginTop: 1 },
  list: { paddingBottom: 24 },
  listEmpty: { flexGrow: 1 },
  footer: { paddingVertical: 20 },
})
