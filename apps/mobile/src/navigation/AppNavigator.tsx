import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { NavigatorScreenParams } from '@react-navigation/native'
import { useAuthStore } from '../store/authStore'
import { AthleteTabNavigator } from './AthleteTabNavigator'
import type { AthleteTabParamList } from './AthleteTabNavigator'
import { TrainerTabNavigator } from './TrainerTabNavigator'
import { EditAthleteProfileScreen } from '../screens/app/EditAthleteProfileScreen'
import { EditTrainerProfileScreen } from '../screens/app/EditTrainerProfileScreen'
import { SettingsScreen } from '../screens/app/SettingsScreen'
import { ExerciseDebugScreen } from '../screens/debug/ExerciseDebugScreen' // DEBUG — remove before launch
import { ExerciseCurationScreen } from '../screens/debug/ExerciseCurationScreen' // DEBUG — remove before launch
import { ExerciseAdminScreen } from '../screens/debug/ExerciseAdminScreen' // DEBUG — remove before launch
import { WorkoutDetailScreen } from '../screens/workout/WorkoutDetailScreen'
import { WorkoutViewScreen } from '../screens/workout/WorkoutViewScreen'
import { ProgramDetailScreen } from '../screens/workout/ProgramDetailScreen'
import { WorkoutExecutionScreen } from '../screens/workout/WorkoutExecutionScreen'
import { WorkoutPostScreen } from '../screens/workout/WorkoutPostScreen'
import { WorkoutSessionScreen } from '../screens/workout/WorkoutSessionScreen'
import { PostDetailScreen } from '../screens/social/PostDetailScreen'
import { UserProfileScreen } from '../screens/social/UserProfileScreen'
import { UserSearchScreen } from '../screens/social/UserSearchScreen'
import { FollowListScreen } from '../screens/social/FollowListScreen'
import { NotificationsScreen } from '../screens/social/NotificationsScreen'
import { NutritionTodayScreen } from '../screens/nutrition/NutritionTodayScreen'
import { MealDetailScreen } from '../screens/nutrition/MealDetailScreen'
import { NutritionPlanViewScreen } from '../screens/nutrition/NutritionPlanViewScreen'
import { NutritionLogScreen } from '../screens/nutrition/NutritionLogScreen'
import type { ExecutionExerciseRecord, TrainingGoal } from '../lib/api'

export type AppStackParamList = {
  AthleteTabs: NavigatorScreenParams<AthleteTabParamList>
  TrainerTabs: undefined
  EditAthleteProfile: undefined
  EditTrainerProfile: undefined
  Settings: undefined
  WorkoutDetail: { workoutId: string }
  WorkoutView: { workoutId: string }
  ProgramDetail: {
    programId: string
    programName: string
    goals: TrainingGoal[]
    workoutsCount: number
    updatedAt: string
  }
  WorkoutExecution: { workoutId?: string; resumeSessionId?: string }
  WorkoutPost: {
    sessionId: string
    workoutName: string
    durationMin: number
    totalSets: number
    totalValidSets: number
    totalVolume: number
    exercises: ExecutionExerciseRecord[]
  }
  WorkoutSession: { sessionId: string }
  // Social — reachable from the feed, a post card or a notification.
  PostDetail: { postId: string; focusComment?: boolean }
  UserProfile: { userId: string }
  UserSearch: undefined
  FollowList: { userId: string; kind: 'followers' | 'following'; name?: string }
  Notifications: undefined
  // Two ways to track a day, each with its own destination: NutritionToday
  // follows the active plan, NutritionLog records what was actually eaten.
  NutritionToday: undefined
  NutritionLog: { date?: string } | undefined
  NutritionPlanView: { planId: string; planName?: string }
  MealDetail: { mealId: string; planId: string; mealName: string }
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
      <Stack.Screen name="WorkoutView" component={WorkoutViewScreen} />
      <Stack.Screen name="ProgramDetail" component={ProgramDetailScreen} />
      <Stack.Screen name="WorkoutExecution" component={WorkoutExecutionScreen} />
      <Stack.Screen name="WorkoutPost" component={WorkoutPostScreen} />
      <Stack.Screen name="WorkoutSession" component={WorkoutSessionScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="UserSearch" component={UserSearchScreen} />
      <Stack.Screen name="FollowList" component={FollowListScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="NutritionToday" component={NutritionTodayScreen} />
      <Stack.Screen name="NutritionLog" component={NutritionLogScreen} />
      <Stack.Screen name="NutritionPlanView" component={NutritionPlanViewScreen} />
      <Stack.Screen name="MealDetail" component={MealDetailScreen} />
      <Stack.Screen name="ExerciseDebug" component={ExerciseDebugScreen} />{/* DEBUG — remove before launch */}
      <Stack.Screen name="ExerciseCuration" component={ExerciseCurationScreen} />{/* DEBUG — remove before launch */}
      <Stack.Screen name="ExerciseAdmin" component={ExerciseAdminScreen} />{/* DEBUG — remove before launch */}
    </Stack.Navigator>
  )
}
