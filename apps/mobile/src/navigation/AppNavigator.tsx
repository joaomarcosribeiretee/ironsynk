import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuthStore } from '../store/authStore'
import { AthleteTabNavigator } from './AthleteTabNavigator'
import { TrainerTabNavigator } from './TrainerTabNavigator'
import { EditAthleteProfileScreen } from '../screens/app/EditAthleteProfileScreen'
import { EditTrainerProfileScreen } from '../screens/app/EditTrainerProfileScreen'
import { SettingsScreen } from '../screens/app/SettingsScreen'
import { ExerciseDebugScreen } from '../screens/debug/ExerciseDebugScreen' // DEBUG — remove before launch
import { ExerciseCurationScreen } from '../screens/debug/ExerciseCurationScreen' // DEBUG — remove before launch
import { ExerciseAdminScreen } from '../screens/debug/ExerciseAdminScreen' // DEBUG — remove before launch
import { WorkoutDetailScreen } from '../screens/workout/WorkoutDetailScreen'
import { FreeWorkoutScreen } from '../screens/workout/FreeWorkoutScreen'

export type AppStackParamList = {
  AthleteTabs: undefined
  TrainerTabs: undefined
  EditAthleteProfile: undefined
  EditTrainerProfile: undefined
  Settings: undefined
  WorkoutDetail: { workoutId: string }
  FreeWorkout: undefined
  ExerciseDebug: undefined // DEBUG — remove before launch
  ExerciseCuration: undefined // DEBUG — remove before launch
  ExerciseAdmin: undefined // DEBUG — remove before launch
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
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} />
      <Stack.Screen name="FreeWorkout" component={FreeWorkoutScreen} />
      <Stack.Screen name="ExerciseDebug" component={ExerciseDebugScreen} />{/* DEBUG — remove before launch */}
      <Stack.Screen name="ExerciseCuration" component={ExerciseCurationScreen} />{/* DEBUG — remove before launch */}
      <Stack.Screen name="ExerciseAdmin" component={ExerciseAdminScreen} />{/* DEBUG — remove before launch */}
    </Stack.Navigator>
  )
}
