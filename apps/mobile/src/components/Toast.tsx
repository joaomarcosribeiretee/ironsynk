import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, Text } from 'react-native'

let _show: ((message: string) => void) | null = null

export function showToast(message: string) {
  _show?.(message)
}

export function Toast() {
  const translateY = useRef(new Animated.Value(20)).current
  const opacity = useRef(new Animated.Value(0)).current
  const [message, setMessage] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((msg: string) => {
    setMessage(msg)
    if (timer.current) clearTimeout(timer.current)
    translateY.setValue(20)
    opacity.setValue(0)
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, damping: 20, stiffness: 200, mass: 0.8, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start()
    timer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 20, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start()
    }, 2500)
  }, [translateY, opacity])

  useEffect(() => {
    _show = show
    return () => { if (_show === show) _show = null }
  }, [show])

  return (
    <Animated.View pointerEvents="none" style={[s.toast, { opacity, transform: [{ translateY }] }]}>
      <Text style={s.text}>{message}</Text>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    zIndex: 999,
    backgroundColor: '#1E1E24',
    borderWidth: 1,
    borderColor: '#2A2A35',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  text: { color: '#F0F0F5', fontSize: 14 },
})
