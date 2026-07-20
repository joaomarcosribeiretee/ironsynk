import React, { useState } from 'react'
import {
  View, Image, StyleSheet, ScrollView,
  NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { PostMediaItem } from '../lib/api'

const CONTAINER_HEIGHT = 280

function MediaSlide({ item, width }: { item: PostMediaItem; width: number }) {
  const source = item.thumbnailUrl ?? (item.type === 'IMAGE' ? item.url : null)
  return (
    <View style={[ps.slide, { width }]}>
      {source ? (
        <Image source={{ uri: source }} style={ps.media} resizeMode="cover" />
      ) : (
        <View style={[ps.media, ps.videoFallback]} />
      )}
      {item.type === 'VIDEO' && (
        <View style={ps.playOverlay} pointerEvents="none">
          <Ionicons name="play-circle" size={48} color="#F0F0F5" />
        </View>
      )}
    </View>
  )
}

export function PostMediaCarousel({ media }: { media: PostMediaItem[] }) {
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState(0)

  const ordered = [...media].sort((a, b) => a.order - b.order)
  if (ordered.length === 0) return null

  function onLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width)
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (width === 0) return
    const idx = Math.round(e.nativeEvent.contentOffset.x / width)
    if (idx !== active) setActive(idx)
  }

  // Single item: full-width static media, no carousel/dots.
  if (ordered.length === 1) {
    return (
      <View style={ps.container} onLayout={onLayout}>
        {width > 0 && <MediaSlide item={ordered[0]!} width={width} />}
      </View>
    )
  }

  return (
    <View>
      <View style={ps.container} onLayout={onLayout}>
        {width > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            {ordered.map((item, i) => (
              <MediaSlide key={`${item.url}-${i}`} item={item} width={width} />
            ))}
          </ScrollView>
        )}
      </View>
      <View style={ps.dots}>
        {ordered.map((item, i) => (
          <View
            key={`${item.url}-dot-${i}`}
            style={[ps.dot, i === active ? ps.dotActive : ps.dotInactive]}
          />
        ))}
      </View>
    </View>
  )
}

const ps = StyleSheet.create({
  container: {
    width: '100%',
    height: CONTAINER_HEIGHT,
    borderRadius: 16,
    backgroundColor: '#1E1E24',
    overflow: 'hidden',
  },
  slide: { height: CONTAINER_HEIGHT },
  media: { width: '100%', height: '100%', backgroundColor: '#1E1E24' },
  videoFallback: { backgroundColor: '#141418' },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { backgroundColor: '#2979FF' },
  dotInactive: { backgroundColor: '#4A4A5A' },
})
