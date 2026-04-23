import React, { useEffect } from 'react'
import { View, Text } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../navigation/AuthNavigator'
import { useAuthStore } from '../../store/authStore'

type Props = NativeStackScreenProps<AuthStackParamList, 'Splash'>

export function SplashScreen({ navigation }: Props) {
  const { session, isOnboarded } = useAuthStore()

  useEffect(() => {
    const timer = setTimeout(() => {
      if (session && isOnboarded) {
        // RootNavigator handles the switch — nothing to do
      } else {
        navigation.replace('Login')
      }
    }, 1500)

    return () => clearTimeout(timer)
  }, [session, isOnboarded, navigation])

  return (
    <LinearGradient
      colors={['#1A237E', '#2979FF', '#4FC3F7']}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      className="flex-1 items-center justify-center"
    >
      <View className="items-center">
        <Text
          className="text-white font-bold tracking-widest"
          style={{ fontSize: 42, letterSpacing: 4 }}
        >
          IRON
        </Text>
        <Text
          className="text-white font-bold tracking-widest"
          style={{ fontSize: 42, letterSpacing: 4, marginTop: -8 }}
        >
          SYNK
        </Text>
        <View className="mt-3 h-0.5 w-16 bg-white opacity-60" />
      </View>
    </LinearGradient>
  )
}
