import React from 'react'
import { useAuthStore } from '../store/authStore'
import { AuthNavigator } from './AuthNavigator'
import { AppNavigator } from './AppNavigator'

export function RootNavigator() {
  const { session, isOnboarded } = useAuthStore()

  if (!session || !isOnboarded) {
    return <AuthNavigator />
  }

  return <AppNavigator />
}
