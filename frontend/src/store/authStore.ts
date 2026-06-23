import { create } from 'zustand'
import type { CurrentUser } from '@/types'

interface AuthState {
  user: CurrentUser | null
  setUser: (user: CurrentUser) => void
}

const getInitialUser = (): CurrentUser | null => {
  if (typeof window !== 'undefined' && window.bdsConfig?.user) {
    return window.bdsConfig.user
  }
  return null
}

export const useAuthStore = create<AuthState>(set => ({
  user: getInitialUser(),
  setUser: (user) => set({ user }),
}))
