import React, { useEffect } from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import Reanimated, {
  useSharedValue, useAnimatedStyle, withSpring, ZoomOut,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import type { LocalPostMedia } from '../lib/postMediaUpload'

export type SelectedMedia = LocalPostMedia & { id: string }

export const POST_MEDIA_MAX = 5

const TILE = 112

function MediaTile({ item, onRemove }: { item: SelectedMedia; onRemove: () => void }) {
  // Mount animation: scale 0.96 -> 1 with spring (per design spec).
  const scale = useSharedValue(0.96)
  useEffect(() => {
    scale.value = withSpring(1, { damping: 16, stiffness: 180 })
  }, [scale])
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <Reanimated.View exiting={ZoomOut.duration(150)} style={ps.tileWrap}>
      <Reanimated.View style={[ps.tile, animStyle]}>
        {item.type === 'IMAGE' ? (
          <Image source={{ uri: item.uri }} style={ps.tileMedia} resizeMode="cover" />
        ) : (
          <View style={[ps.tileMedia, ps.videoFallback]} />
        )}
        {item.type === 'VIDEO' && (
          <View style={ps.playOverlay} pointerEvents="none">
            <Ionicons name="play-circle" size={34} color="#F0F0F5" />
          </View>
        )}
        <TouchableOpacity
          style={ps.removeBtn}
          onPress={onRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={16} color="#F0F0F5" />
        </TouchableOpacity>
      </Reanimated.View>
    </Reanimated.View>
  )
}

type Props = {
  items: SelectedMedia[]
  onAddPress: () => void
  onRemove: (id: string) => void
}

export function PostMediaPicker({ items, onAddPress, onRemove }: Props) {
  if (items.length === 0) {
    return (
      <TouchableOpacity style={ps.empty} activeOpacity={0.7} onPress={onAddPress}>
        <Ionicons name="images-outline" size={22} color="#8A8A9A" />
        <Text style={ps.emptyText}>Adicionar fotos ou vídeos</Text>
        <Text style={ps.emptySub}>Até 5 mídias • vídeo até 60s</Text>
      </TouchableOpacity>
    )
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={ps.carousel}
    >
      {items.map((item) => (
        <MediaTile key={item.id} item={item} onRemove={() => onRemove(item.id)} />
      ))}
      {items.length < POST_MEDIA_MAX && (
        <TouchableOpacity style={ps.addMore} activeOpacity={0.7} onPress={onAddPress}>
          <Ionicons name="add" size={24} color="#4FC3F7" />
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}

const ps = StyleSheet.create({
  empty: {
    height: 96,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#2A2A35',
    backgroundColor: '#1E1E24',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  emptyText: { color: '#F0F0F5', fontSize: 14, fontWeight: '500' },
  emptySub: { color: '#8A8A9A', fontSize: 12 },

  carousel: { gap: 10, paddingVertical: 2 },
  tileWrap: { width: TILE, height: TILE },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: 14,
    backgroundColor: '#1E1E24',
    overflow: 'hidden',
  },
  tileMedia: { width: '100%', height: '100%' },
  videoFallback: { backgroundColor: '#141418' },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(20,20,24,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMore: {
    width: TILE,
    height: TILE,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#2A2A35',
    justifyContent: 'center',
    alignItems: 'center',
  },
})
