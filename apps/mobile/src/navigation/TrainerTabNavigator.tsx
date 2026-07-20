import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { TrainerDashboardScreen } from '../screens/trainer/TrainerDashboardScreen'
import { StudentsScreen } from '../screens/trainer/StudentsScreen'
import { ConsultationsScreen } from '../screens/trainer/ConsultationsScreen'
import { ProfileScreen } from '../screens/app/ProfileScreen'
import { FloatingTabBar } from './FloatingTabBar'

export type TrainerTabParamList = {
  Dashboard: undefined
  Students: undefined
  Consultations: undefined
  Profile: undefined
}

const Tab = createBottomTabNavigator<TrainerTabParamList>()

export function TrainerTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#4FC3F7',
        tabBarInactiveTintColor: '#8A8A9A',
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
