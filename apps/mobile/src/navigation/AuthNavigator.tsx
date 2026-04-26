import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SplashScreen } from '../screens/auth/SplashScreen'
import { LoginScreen } from '../screens/auth/LoginScreen'
import { RegisterScreen } from '../screens/auth/RegisterScreen'
import { OnboardingScreen } from '../screens/auth/OnboardingScreen'

export type AuthStackParamList = {
  Splash: undefined
  Login: undefined
  Register: undefined
  Onboarding: { name?: string } | undefined
}

const Stack = createNativeStackNavigator<AuthStackParamList>()

type Props = {
  initialRoute?: keyof AuthStackParamList
}

export function AuthNavigator({ initialRoute = 'Splash' }: Props) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
    </Stack.Navigator>
  )
}
