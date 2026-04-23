import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { View, Text } from 'react-native'

export type AppStackParamList = {
  Home: undefined
}

const Stack = createNativeStackNavigator<AppStackParamList>()

function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-text-primary text-2xl font-bold">IronSynk</Text>
      <Text className="text-text-secondary mt-2">App coming soon — Phase 2+</Text>
    </View>
  )
}

export function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
    </Stack.Navigator>
  )
}
