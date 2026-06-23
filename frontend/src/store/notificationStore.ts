import { create } from 'zustand'

interface NotificationState {
  unreadCount: number
  setUnreadCount: (count: number) => void
  decrementUnread: (by?: number) => void
}

export const useNotificationStore = create<NotificationState>(set => ({
  unreadCount: 0,
  setUnreadCount: (count) => set({ unreadCount: count }),
  decrementUnread: (by = 1) => set(s => ({ unreadCount: Math.max(0, s.unreadCount - by) })),
}))
