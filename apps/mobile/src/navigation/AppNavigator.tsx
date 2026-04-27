import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuthStore } from '../store/authStore'
import { AthleteTabNavigator } from './AthleteTabNavigator'
import { TrainerTabNavigator } from './TrainerTabNavigator'
import { EditAthleteProfileScreen } from '../screens/app/EditAthleteProfileScreen'
import { EditTrainerProfileScreen } from '../screens/app/EditTrainerProfileScreen'

export type AppStackParamList = {
  AthleteTabs: undefined
  TrainerTabs: undefined
  EditAthleteProfile: undefined
  EditTrainerProfile: undefined
}

const Stack = createNativeStackNavigator<AppStackParamList>()

export function AppNavigator() {
  const isTrainer = useAuthStore((s) => s.user?.role === 'TRAINER')

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isTrainer ? (
        <Stack.Screen name="TrainerTabs" component={TrainerTabNavigator} />
      ) : (
        <Stack.Screen name="AthleteTabs" component={AthleteTabNavigator} />
      )}
      <Stack.Screen name="EditAthleteProfile" component={EditAthleteProfileScreen} />
      <Stack.Screen name="EditTrainerProfile" component={EditTrainerProfileScreen} />
    </Stack.Navigator>
  )
}
