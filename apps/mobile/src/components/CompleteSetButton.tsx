import React from 'react'
import { View, TouchableOpacity } from 'react-native'
import Reanimated, { useSharedValue, useAnimatedStyle, withSequence, withSpring, withTiming } from 'react-native-reanimated'
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
  const scale = useSharedValue(1)

  function handlePress() {
    if (!checked) {
      // Validate BEFORE animating — if handler returns false, play error feedback only
      const result = onPress()
      if (result === false) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        scale.value = withSequence(
          withTiming(0.92, { duration: 50 }),
          withSpring(1, { duration: 220, dampingRatio: 0.6 }),
        )
        return
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      // Confirm completion: dip to 0.97 then spring back to 1.0 (~220ms perceived)
      scale.value = withSequence(
        withTiming(0.97, { duration: 60 }),
        withSpring(1, { duration: 220, dampingRatio: 0.6 }),
      )
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      scale.value = withSequence(
        withTiming(0.97, { duration: 60 }),
        withSpring(1, { duration: 220, dampingRatio: 0.7 }),
      )
      onPress()
    }
  }

  const boxStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}>
      <View style={{ width: size, height: size }}>
        <Reanimated.View style={[
          {
            width: size, height: size, borderRadius: 9, borderWidth: 1,
            justifyContent: 'center', alignItems: 'center',
          },
          checked ? {
            backgroundColor: 'rgba(0,230,118,0.14)',
            borderColor: 'rgba(0,230,118,0.45)',
          } : {
            backgroundColor: '#2A2A35',
            borderColor: '#3A3A45',
          },
          boxStyle,
        ]}>
          <Ionicons
            name="checkmark"
            size={Math.round(size * 0.52)}
            color={checked ? '#00E676' : '#8A8A9A'}
          />
        </Reanimated.View>
      </View>
    </TouchableOpacity>
  )
}
