import React, { useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { api, type SocialNotificationRecord } from '../../lib/api'
import { socialKeys } from '../../lib/socialQueries'
import { getFriendlyErrorMessage } from '../../lib/errorMessages'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { Avatar } from '../../components/Avatar'
import { ListEmpty, ListError, ListLoading } from '../../components/ListStates'

type NavProp = NativeStackNavigationProp<AppStackParamList>

const ICONS: Record<SocialNotificationRecord['type'], { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  like: { name: 'heart', color: '#FF5252' },
  comment: { name: 'chatbubble', color: '#4FC3F7' },
  follow: { name: 'person-add', color: '#00E676' },
}

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

function describe(n: SocialNotificationRecord): string {
  const who = n.actor?.name ?? 'Alguém'
  if (n.type === 'like') return `${who} curtiu seu treino`
  if (n.type === 'comment') return `${who} comentou no seu treino`
  return `${who} começou a seguir você`
}

export function NotificationsScreen() {
  const navigation = useNavigation<NavProp>()
  const queryClient = useQueryClient()

  const query = useInfiniteQuery({
    queryKey: socialKeys.notifications,
    queryFn: ({ pageParam }) =>
      api.social.listNotifications({ cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.data.nextCursor ?? undefined,
  })

  // Opening the screen is the read receipt; the badge clears on the way out.
  useEffect(() => {
    if (!query.isSuccess) return
    api.social
      .markNotificationsRead()
      .then(() => queryClient.invalidateQueries({ queryKey: socialKeys.unreadCount }))
      .catch(() => null)
  }, [query.isSuccess, queryClient])

  const notifications = query.data?.pages.flatMap((p) => p.data.notifications) ?? []

  function open(n: SocialNotificationRecord) {
    if (n.postId) {
      navigation.navigate('PostDetail', { postId: n.postId, focusComment: n.type === 'comment' })
    } else if (n.actor) {
      navigation.navigate('UserProfile', { userId: n.actor.id })
    }
  }

  function renderEmpty() {
    if (query.isLoading) return <ListLoading />
    if (query.isError) {
      return <ListError message={getFriendlyErrorMessage(query.error)} onRetry={() => query.refetch()} />
    }
    return (
      <ListEmpty
        icon="notifications-outline"
        title="Sem novidades"
        sub="Curtidas, comentários e novos seguidores aparecem aqui."
      />
    )
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={s.topBtn}>
          <Ionicons name="chevron-back" size={24} color="#F0F0F5" />
        </TouchableOpacity>
        <Text style={s.title}>Notificações</Text>
        <View style={s.topBtn} />
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[s.list, notifications.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty()}
        renderItem={({ item }) => {
          const icon = ICONS[item.type]
          return (
            <TouchableOpacity style={s.row} onPress={() => open(item)} activeOpacity={0.8}>
              <View>
                <Avatar uri={item.actor?.avatar} name={item.actor?.name} size={44} />
                <View style={[s.iconBubble, { backgroundColor: icon.color }]}>
                  <Ionicons name={icon.name} size={10} color="#0B0B0F" />
                </View>
              </View>
              <View style={s.body}>
                <Text style={s.text} numberOfLines={2}>{describe(item)}</Text>
                {!!item.preview && (
                  <Text style={s.preview} numberOfLines={1}>{item.preview}</Text>
                )}
                <Text style={s.time}>{formatRelative(item.createdAt)}</Text>
              </View>
              {!item.isRead && <View style={s.unreadDot} />}
            </TouchableOpacity>
          )
        }}
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
  title: { color: '#F0F0F5', fontSize: 16, fontWeight: '700' },

  list: { paddingBottom: 24 },
  listEmpty: { flexGrow: 1 },
  footer: { paddingVertical: 20 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11 },
  iconBubble: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#141418',
  },
  body: { flex: 1, minWidth: 0, gap: 2 },
  text: { color: '#F0F0F5', fontSize: 14, lineHeight: 19 },
  preview: { color: '#8A8A9A', fontSize: 12.5 },
  time: { color: '#555560', fontSize: 11, marginTop: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4FC3F7', flexShrink: 0 },
})
