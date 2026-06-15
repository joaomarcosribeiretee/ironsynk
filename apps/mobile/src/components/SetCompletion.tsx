import { useEffect, useRef } from 'react'
import { Animated, StyleSheet } from 'react-native'

// Shared completion visuals for every set type in Workout Execution (normal,
// warmup, feeder, back-off and all advanced techniques). Keeps the completed
// state premium and subtle: a thin success border, a soft glow and a faint tint
// — never a strong green fill or a large success area. All animations use the
// native driver (opacity / scale only) so they stay smooth on every screen size.

export const SUCCESS = '#00E676'

// Animated 0 → 1 value driven by `active`. Native-driver safe.
export function useCompletionPulse(active: boolean) {
  const v = useRef(new Animated.Value(active ? 1 : 0)).current
  useEffect(() => {
    Animated.timing(v, { toValue: active ? 1 : 0, duration: 260, useNativeDriver: true }).start()
  }, [active])
  return v
}

// Settled opacity for a completed row — recedes slightly while staying readable.
export function useCompletedFade(active: boolean) {
  const v = useRef(new Animated.Value(active ? 0.88 : 1)).current
  useEffect(() => {
    Animated.timing(v, { toValue: active ? 0.88 : 1, duration: 250, useNativeDriver: true }).start()
  }, [active])
  return v
}

// Subtle completion accent overlay — a thin border emphasis and a soft shadow,
// no success fill or tint. Sits above the row background but below content
// (pointerEvents none) and fades in when the set is completed. A completed set
// stays nearly identical to a pending one; the filled completion check is the
// primary signal. Reused by every set type (simple and technique alike).
export function CompletedAccentOverlay({ active, radius = 10 }: { active: boolean; radius?: number }) {
  const opacity = useCompletionPulse(active)
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, ca.overlay, { borderRadius: radius, opacity }]}
    />
  )
}

const ca = StyleSheet.create({
  overlay: {
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.16)',
    shadowColor: SUCCESS,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.10,
    shadowRadius: 5,
  },
})
