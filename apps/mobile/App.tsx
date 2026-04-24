import './global.css'

import React, { useState, useEffect } from 'react'
import { View } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { RootNavigator } from './src/navigation/RootNavigator'
import { useAuthStore } from './src/store/authStore'

const queryClient = new QueryClient()

export default function App() {
  const [storeReady, setStoreReady] = useState(false)

  useEffect(() => {
    useAuthStore.getState().initialize().finally(() => setStoreReady(true))
  }, [])

  if (!storeReady) {
    return <View style={{ flex: 1, backgroundColor: '#141418' }} />
  }

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <StatusBar style="light" />
        <RootNavigator />
      </NavigationContainer>
    </QueryClientProvider>
  )
}
