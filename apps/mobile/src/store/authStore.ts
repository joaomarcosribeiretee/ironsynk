import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import type { UserRecord, Session } from '../lib/api'

const TOKEN_KEY = 'ironsynk_access_token'
const REFRESH_KEY = 'ironsynk_refresh_token'

type AuthState = {
  user: UserRecord | null
  session: Session | null
  isLoading: boolean
  isOnboarded: boolean
}

type AuthActions = {
  setUser: (user: UserRecord | null) => void
  setSession: (session: Session | null) => void
  setIsOnboarded: (value: boolean) => void
  setIsLoading: (value: boolean) => void
  login: (user: UserRecord, session: Session) => void
  logout: () => void
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  isOnboarded: false,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setIsOnboarded: (isOnboarded) => set({ isOnboarded }),
  setIsLoading: (isLoading) => set({ isLoading }),

  login: (user, session) => {
    SecureStore.setItemAsync(TOKEN_KEY, session.access_token).catch(() => null)
    SecureStore.setItemAsync(REFRESH_KEY, session.refresh_token).catch(() => null)
    set({ user, session, isOnboarded: (user.profile?.name?.length ?? 0) > 0 })
  },

  logout: () => {
    SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => null)
    SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => null)
    set({ user: null, session: null, isOnboarded: false })
  },

  initialize: async () => {
    set({ isLoading: true })
    try {
      const accessToken = await SecureStore.getItemAsync(TOKEN_KEY)
      const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY)
      if (accessToken && refreshToken) {
        set({ session: { access_token: accessToken, refresh_token: refreshToken } })
      }
    } catch {
      // SecureStore unavailable (e.g. simulator without keychain) — stay logged out
    } finally {
      set({ isLoading: false })
    }
  },
}))
