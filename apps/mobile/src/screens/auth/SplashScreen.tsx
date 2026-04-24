import React, { useEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../navigation/AuthNavigator'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../lib/api'

type Props = NativeStackScreenProps<AuthStackParamList, 'Splash'>

const MIN_SPLASH_MS = 2200

export function SplashScreen({ navigation }: Props) {
  const { session, user, isOnboarded, setUser, setIsOnboarded, logout } = useAuthStore()
  const opacity = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(0.94)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1.03,
        duration: 1850,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }),
    ]).start()

    let cancelled = false
    const start = Date.now()

    async function run() {
      let destination: 'app' | 'onboarding' | 'login' = 'login'

      if (session && !user) {
        // Token restored from SecureStore — verify with server to get user state
        try {
          const { user: me, isOnboarded: onboarded } = await api.auth.me()
          if (!cancelled) {
            setUser(me)
            setIsOnboarded(onboarded)
            destination = onboarded ? 'app' : 'onboarding'
          }
        } catch {
          if (!cancelled) {
            logout()
            destination = 'login'
          }
        }
      } else if (session && isOnboarded) {
        destination = 'app'
      } else if (session && !isOnboarded) {
        destination = 'onboarding'
      }

      const elapsed = Date.now() - start
      const remaining = Math.max(0, MIN_SPLASH_MS - elapsed)
      await new Promise<void>((resolve) => setTimeout(resolve, remaining))

      if (cancelled) return

      if (destination === 'onboarding') {
        navigation.replace('Onboarding')
      } else if (destination === 'login') {
        navigation.replace('Login')
      }
      // 'app': RootNavigator already switched to AppNavigator reactively
    }

    run()

    return () => {
      cancelled = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#141418',
      }}
    >
      <Animated.Image
        source={require('../../../assets/upscalemedia-transformed.png')}
        resizeMode="contain"
        style={{
          width: 170,
          height: 170,
          opacity,
          transform: [{ scale }],
        }}
      />
    </Animated.View>
  )
}
