import { create } from 'zustand'
import type { UserRecord, Session } from '../lib/api'

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
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  user: null,
  session: null,
  isLoading: false,
  isOnboarded: false,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setIsOnboarded: (isOnboarded) => set({ isOnboarded }),
  setIsLoading: (isLoading) => set({ isLoading }),

  login: (user, session) => set({ user, session, isOnboarded: user.profile != null }),

  logout: () => set({ user: null, session: null, isOnboarded: false }),
}))
