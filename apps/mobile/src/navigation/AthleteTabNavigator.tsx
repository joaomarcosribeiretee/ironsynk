import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { FeedScreen } from '../screens/app/FeedScreen'
import { WorkoutScreen } from '../screens/app/WorkoutScreen'
import { NutritionScreen } from '../screens/app/NutritionScreen'
import { ProfileScreen } from '../screens/app/ProfileScreen'

export type AthleteTabParamList = {
  Feed: undefined
  Workout: undefined
  Nutrition: undefined
  Profile: undefined
}

const Tab = createBottomTabNavigator<AthleteTabParamList>()

const TAB_BAR_STYLE = {
  backgroundColor: '#141418',
  borderTopColor: '#2A2A35',
  borderTopWidth: 0.5,
  borderRadius: 16,
  height: 60,
  paddingBottom: 4,
  paddingTop: 6,
  marginBottom: 28,
  marginHorizontal: 20,
} as const

export function AthleteTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: TAB_BAR_STYLE,
        tabBarActiveTintColor: '#4FC3F7',
        tabBarInactiveTintColor: '#8A8A9A',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500', marginTop: 2 },
      }}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarLabel: 'Feed',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Workout"
        component={WorkoutScreen}
        options={{
          tabBarLabel: 'Treino',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'barbell' : 'barbell-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Nutrition"
        component={NutritionScreen}
        options={{
          tabBarLabel: 'Dieta',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'nutrition' : 'nutrition-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  )
}
