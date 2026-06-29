import React, { useEffect, useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import Reanimated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'

// IronSynk floating navigation. Replaces the default React Navigation tab bar
// with a floating, glassy pill. The active tab expands into a gradient capsule
// that reveals its label — inactive tabs stay icon-only. Routes, focus state
// and navigation events are untouched; this is purely the visual shell.

const ACTIVE = '#FFFFFF'
const INACTIVE = '#8A8A9A'
const SURFACE = 'rgba(30,30,36,0.96)'
const BORDER = '#2A2A35'

const SPRING = { damping: 16, stiffness: 180, mass: 0.7 }

type TabItemProps = {
  focused: boolean
  label: string
  onPress: () => void
  onLongPress: () => void
  renderIcon: (color: string) => React.ReactNode
}

function TabItem({ focused, label, onPress, onLongPress, renderIcon }: TabItemProps) {
  const progress = useSharedValue(focused ? 1 : 0)
  const pressScale = useSharedValue(1)
  const [labelWidth, setLabelWidth] = useState(0)

  useEffect(() => {
    // Only the activating tab gets the springy pop. The deactivating tab uses a
    // non-overshooting timing so its icon/capsule settles immediately instead of
    // bouncing (the underdamped spring let the old active tab keep shaking).
    progress.value = focused
      ? withSpring(1, SPRING)
      : withTiming(0, { duration: 160 })
  }, [focused, progress])

  // Gradient capsule fades + scales in behind the active tab.
  const capsuleStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.85, 1]) }],
  }))

  // Label slides open horizontally only when active.
  const labelStyle = useAnimatedStyle(() => ({
    width: progress.value * labelWidth,
    opacity: progress.value,
    marginLeft: progress.value * 8,
  }))

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }))

  function handlePressIn() {
    pressScale.value = withTiming(0.94, { duration: 90 })
  }
  function handlePressOut() {
    pressScale.value = withSpring(1, { damping: 12, stiffness: 220 })
  }
  function handlePress() {
    if (!focused) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress()
  }

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      hitSlop={8}
    >
      <Reanimated.View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 22,
            overflow: 'hidden',
          },
          containerStyle,
        ]}
      >
        <Reanimated.View
          style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 22 }, capsuleStyle]}
        >
          <LinearGradient
            colors={['#4FC3F7', '#2979FF', '#1A237E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1, borderRadius: 22 }}
          />
        </Reanimated.View>

        {renderIcon(focused ? ACTIVE : INACTIVE)}

        <Reanimated.View style={[{ overflow: 'hidden' }, labelStyle]}>
          <Text
            numberOfLines={1}
            style={{ color: ACTIVE, fontSize: 13, fontWeight: '700' }}
          >
            {label}
          </Text>
        </Reanimated.View>
      </Reanimated.View>

      {/* Hidden measurer: captures the label's natural width for the reveal animation. */}
      <Text
        onLayout={(e) => setLabelWidth(e.nativeEvent.layout.width)}
        numberOfLines={1}
        style={{
          position: 'absolute',
          opacity: 0,
          fontSize: 13,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: insets.bottom + (Platform.OS === 'ios' ? 6 : 12),
        alignItems: 'center',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          // Float inset from the screen edges instead of spanning full width.
          alignSelf: 'stretch',
          marginHorizontal: 20,
          backgroundColor: SURFACE,
          borderRadius: 28,
          borderWidth: 1,
          borderColor: BORDER,
          paddingHorizontal: 8,
          paddingVertical: 8,
          // Neutral depth shadow only — a colored glow bled a blue halo behind
          // and below the bar instead of letting the screen background show.
          shadowColor: '#000000',
          shadowOpacity: 0.35,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 12,
        }}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]
          const focused = state.index === index

          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title ?? route.name

          function onPress() {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name)
            }
          }

          function onLongPress() {
            navigation.emit({ type: 'tabLongPress', target: route.key })
          }

          return (
            <TabItem
              key={route.key}
              focused={focused}
              label={label}
              onPress={onPress}
              onLongPress={onLongPress}
              renderIcon={(color) =>
                options.tabBarIcon
                  ? options.tabBarIcon({ focused, color, size: 22 })
                  : null
              }
            />
          )
        })}
      </View>
    </View>
  )
}
