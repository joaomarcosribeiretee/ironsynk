import React, { useLayoutEffect, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { AuthNavigator } from './AuthNavigator'
import { AppNavigator } from './AppNavigator'

export function RootNavigator() {
  const { session, isOnboarded } = useAuthStore()
  const isFirstMount = useRef(true)

  useLayoutEffect(() => {
    isFirstMount.current = false
  }, [])

  if (!session || !isOnboarded) {
    return <AuthNavigator initialRoute={isFirstMount.current ? 'Splash' : 'Login'} />
  }

  return <AppNavigator />
}
