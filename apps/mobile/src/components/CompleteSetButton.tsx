import React, { useRef } from 'react'
import { View, TouchableOpacity, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'

// Shared completion action for every set type (normal, warmup, feeder and all
// advanced techniques). The handler must validate first and return `false` to
// block completion — the button then plays error feedback only.
type CompleteSetButtonProps = {
  checked: boolean
  onPress: () => false | void
  size?: number
}

export function CompleteSetButton({ checked, onPress, size = 38 }: CompleteSetButtonProps) {
  const scale = useRef(new Animated.Value(1)).current
  // Start at 1 (opacity=0, scale max) so the ring is invisible until first check press
  const ring = useRef(new Animated.Value(1)).current

  function handlePress() {
    if (!checked) {
      // Validate BEFORE animating — if handler returns false, play error feedback only
      const result = onPress()
      if (result === false) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Animated.sequence([
          Animated.timing(scale, { toValue: 0.92, duration: 50, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, friction: 4, tension: 300, useNativeDriver: true }),
        ]).start()
        return
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.75, duration: 55, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1.0, friction: 3, tension: 280, useNativeDriver: true }),
      ]).start()
      ring.setValue(0)
      Animated.timing(ring, { toValue: 1, duration: 450, useNativeDriver: true }).start()
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.88, duration: 70, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 6, tension: 200, useNativeDriver: true }),
      ]).start()
      onPress()
    }
  }

  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.9] })
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.35, 0.15, 0] })

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}>
      <View style={{ width: size, height: size }}>
        <Animated.View
          style={{
            position: 'absolute',
            width: size, height: size, borderRadius: 9,
            backgroundColor: '#00E676',
            transform: [{ scale: ringScale }],
            opacity: ringOpacity,
          }}
        />
        <Animated.View style={[
          {
            width: size, height: size, borderRadius: 9, borderWidth: 1,
            justifyContent: 'center', alignItems: 'center',
            transform: [{ scale }],
          },
          checked ? {
            backgroundColor: 'rgba(0,230,118,0.14)',
            borderColor: 'rgba(0,230,118,0.45)',
          } : {
            backgroundColor: '#2A2A35',
            borderColor: '#3A3A45',
          },
        ]}>
          <Ionicons
            name="checkmark"
            size={Math.round(size * 0.52)}
            color={checked ? '#00E676' : '#8A8A9A'}
          />
        </Animated.View>
      </View>
    </TouchableOpacity>
  )
}
