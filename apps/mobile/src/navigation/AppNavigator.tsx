import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { View, Text, TouchableOpacity } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ProfileScreen } from '../screens/app/ProfileScreen'

export type AppStackParamList = {
  Home: undefined
  Profile: undefined
}

const Stack = createNativeStackNavigator<AppStackParamList>()

function HomeScreen({ navigation }: NativeStackScreenProps<AppStackParamList, 'Home'>) {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-text-primary text-2xl font-bold">IronSynk</Text>
      <Text className="text-text-secondary mt-2">App coming soon — Phase 2+</Text>
      <TouchableOpacity
        onPress={() => navigation.navigate('Profile')}
        className="mt-6 px-5 py-3 rounded-2xl border border-border bg-surface"
      >
        <Text className="text-cyan font-semibold">Meu Perfil</Text>
      </TouchableOpacity>
    </View>
  )
}

export function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  )
}
