import { useEffect, useRef } from 'react'
import { Animated as RNAnimated, StyleSheet, View } from 'react-native'
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated'

// Shared completion visuals for every set type in Workout Execution (normal,
// warmup, feeder, back-off and all advanced techniques). Keeps the completed
// state premium and subtle: a thin success border, a faint success tint and a
// left success indicator bar — never a strong green fill, glow or shadow. The
// completed set stays nearly identical to a pending one; the filled completion
// check plus the left bar are the primary signals.

export const SUCCESS = '#00E676'

// Settled opacity for a completed row — recedes slightly while staying readable.
// Native-driver safe (RN Animated, opacity only).
export function useCompletedFade(active: boolean) {
  const v = useRef(new RNAnimated.Value(active ? 0.88 : 1)).current
  useEffect(() => {
    RNAnimated.timing(v, { toValue: active ? 0.88 : 1, duration: 250, useNativeDriver: true }).start()
  }, [active])
  return v
}

// Subtle completion accent overlay — a thin success border, a faint success tint
// and a 4px left success indicator bar. No glow, no shadow, no full green fill.
// Sits above the row background but below content (pointerEvents none) and fades
// in (opacity 0 → 1, 220ms) when the set is completed. Reused by every set type.
export function CompletedAccentOverlay({ active, radius = 10 }: { active: boolean; radius?: number }) {
  const opacity = useSharedValue(active ? 1 : 0)
  useEffect(() => {
    opacity.value = withTiming(active ? 1 : 0, { duration: 220 })
  }, [active])
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Reanimated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, ca.overlay, { borderRadius: radius }, fade]}
    >
      <View style={ca.bar} />
    </Reanimated.View>
  )
}

const ca = StyleSheet.create({
  overlay: {
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.30)',
    backgroundColor: 'rgba(0,230,118,0.05)',
  },
  bar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderRadius: 4,
    backgroundColor: SUCCESS,
  },
})
