import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { TrainerDashboardScreen } from '../screens/trainer/TrainerDashboardScreen'
import { StudentsScreen } from '../screens/trainer/StudentsScreen'
import { ConsultationsScreen } from '../screens/trainer/ConsultationsScreen'
import { ProfileScreen } from '../screens/app/ProfileScreen'

export type TrainerTabParamList = {
  Dashboard: undefined
  Students: undefined
  Consultations: undefined
  Profile: undefined
}

const Tab = createBottomTabNavigator<TrainerTabParamList>()

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

export function TrainerTabNavigator() {
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
        name="Dashboard"
        component={TrainerDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Students"
        component={StudentsScreen}
        options={{
          tabBarLabel: 'Alunos',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Consultations"
        component={ConsultationsScreen}
        options={{
          tabBarLabel: 'Consultas',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={22} color={color} />
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
