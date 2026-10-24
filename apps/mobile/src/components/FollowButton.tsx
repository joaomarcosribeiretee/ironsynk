import React from 'react'
import { Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useToggleFollow } from '../lib/socialQueries'

/**
 * Filled while not following (the action to take), outlined once following
 * (a state, not a call to action).
 */
export function FollowButton({
  userId,
  isFollowing,
  followsMe = false,
  size = 'md',
}: {
  userId: string
  isFollowing: boolean
  followsMe?: boolean
  size?: 'sm' | 'md'
}) {
  const toggle = useToggleFollow()
  const busy = toggle.isPending

  const label = isFollowing ? 'Seguindo' : followsMe ? 'Seguir de volta' : 'Seguir'
  const small = size === 'sm'

  return (
    <TouchableOpacity
      disabled={busy}
      onPress={() => toggle.mutate({ userId, isFollowing })}
      activeOpacity={0.85}
      style={[
        s.btn,
        small && s.btnSm,
        isFollowing ? s.btnFollowing : s.btnFollow,
        busy && s.busy,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={isFollowing ? '#8A8A9A' : '#0B0B0F'} />
      ) : (
        <>
          {isFollowing && <Ionicons name="checkmark" size={small ? 13 : 15} color="#8A8A9A" />}
          <Text
            style={[
              s.text,
              small && s.textSm,
              isFollowing ? s.textFollowing : s.textFollow,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 104,
  },
  btnSm: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, minWidth: 88 },
  btnFollow: { backgroundColor: '#4FC3F7' },
  btnFollowing: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#2A2A35' },
  busy: { opacity: 0.7 },
  text: { fontSize: 13.5, fontWeight: '700' },
  textSm: { fontSize: 12.5 },
  textFollow: { color: '#0B0B0F' },
  textFollowing: { color: '#8A8A9A' },
})
