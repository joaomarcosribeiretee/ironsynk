import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export type ToastType = 'info' | 'success' | 'warning' | 'error'

const TOAST_VARIANTS: Record<ToastType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  info: { icon: 'information-circle', color: '#4FC3F7' },
  success: { icon: 'checkmark-circle', color: '#00E676' },
  warning: { icon: 'alert-circle', color: '#FFB300' },
  error: { icon: 'close-circle', color: '#FF5252' },
}

let _show: ((message: string, type: ToastType) => void) | null = null

export function showToast(message: string, type: ToastType = 'info') {
  _show?.(message, type)
}

export function Toast() {
  const translateY = useRef(new Animated.Value(20)).current
  const opacity = useRef(new Animated.Value(0)).current
  const [message, setMessage] = useState('')
  const [type, setType] = useState<ToastType>('info')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((msg: string, toastType: ToastType) => {
    setMessage(msg)
    setType(toastType)
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

  const variant = TOAST_VARIANTS[type]

  return (
    <Animated.View pointerEvents="none" style={[s.toast, { opacity, transform: [{ translateY }] }]}>
      <View style={[s.accent, { backgroundColor: variant.color }]} />
      <Ionicons name={variant.icon} size={18} color={variant.color} style={s.icon} />
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
    paddingRight: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  icon: { marginLeft: 14, marginRight: 10, flexShrink: 0 },
  text: { color: '#F0F0F5', fontSize: 14, flex: 1, lineHeight: 19 },
})
