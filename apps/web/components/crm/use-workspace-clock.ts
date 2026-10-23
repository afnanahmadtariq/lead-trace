'use client'

import { useSyncExternalStore } from 'react'

const subscribe = (onChange: () => void) => {
  const timer = window.setInterval(onChange, 60_000)
  return () => window.clearInterval(timer)
}
const snapshot = () => Math.floor(Date.now() / 60_000) * 60_000
const serverSnapshot = () => 0

export function useWorkspaceClock() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot)
}

export function taskTiming(dueAt: string, now: number) {
  const due = new Date(dueAt)
  const today = new Date(now)
  if (due.getTime() < now) return 'overdue'
  if (due.toDateString() === today.toDateString()) return 'today'
  return 'upcoming'
}
