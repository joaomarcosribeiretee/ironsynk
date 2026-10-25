import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { SocialUser, SocialUserWithFollow } from '../lib/api'
import { Avatar } from './Avatar'
import { FollowButton } from './FollowButton'

const ROLE_LABEL: Record<string, string> = {
  TRAINER: 'Personal trainer',
  ATHLETE: 'Atleta',
  ADMIN: 'Atleta',
}

/** One row of any people list: search results, followers, following, likes. */
export function SocialUserRow({
  user,
  onPress,
  showFollow = true,
  isMe = false,
}: {
  user: SocialUser | SocialUserWithFollow
  onPress: (userId: string) => void
  showFollow?: boolean
  isMe?: boolean
}) {
  const follow = 'isFollowing' in user ? user : null

  return (
    <TouchableOpacity style={s.row} onPress={() => onPress(user.id)} activeOpacity={0.8}>
      <Avatar uri={user.avatar} name={user.name} size={44} />
      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>{user.name ?? 'Atleta'}</Text>
        <Text style={s.role} numberOfLines={1}>
          {follow?.followsMe && !isMe ? 'Segue você' : (ROLE_LABEL[user.role] ?? 'Atleta')}
        </Text>
      </View>
      {showFollow && follow && !isMe && (
        <FollowButton
          userId={user.id}
          isFollowing={follow.isFollowing}
          followsMe={follow.followsMe}
          size="sm"
        />
      )}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  info: { flex: 1, minWidth: 0, gap: 2 },
  name: { color: '#F0F0F5', fontSize: 14.5, fontWeight: '600' },
  role: { color: '#8A8A9A', fontSize: 12 },
})
