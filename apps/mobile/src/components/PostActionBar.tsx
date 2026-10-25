import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import type { WorkoutPostRecord } from '../lib/api'
import { useToggleLike } from '../lib/socialQueries'

const LIKED = '#FF5252'

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0)}k`
  return String(n)
}

/** Like + comment row at the foot of a post. Counters hide at zero. */
export function PostActionBar({
  post,
  onPressComments,
}: {
  post: WorkoutPostRecord
  onPressComments: (postId: string) => void
}) {
  const toggleLike = useToggleLike()

  function onLike() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    toggleLike.mutate({ postId: post.id, isLiked: post.isLiked })
  }

  return (
    <View style={s.bar}>
      <TouchableOpacity style={s.action} onPress={onLike} activeOpacity={0.7} hitSlop={8}>
        <Ionicons
          name={post.isLiked ? 'heart' : 'heart-outline'}
          size={21}
          color={post.isLiked ? LIKED : '#8A8A9A'}
        />
        {post.likeCount > 0 && (
          <Text style={[s.count, post.isLiked && s.countLiked]}>{formatCount(post.likeCount)}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={s.action}
        onPress={() => onPressComments(post.id)}
        activeOpacity={0.7}
        hitSlop={8}
      >
        <Ionicons name="chatbubble-outline" size={19} color="#8A8A9A" />
        {post.commentCount > 0 && <Text style={s.count}>{formatCount(post.commentCount)}</Text>}
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#23232C',
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  count: { color: '#8A8A9A', fontSize: 13, fontWeight: '600' },
  countLiked: { color: LIKED },
})
