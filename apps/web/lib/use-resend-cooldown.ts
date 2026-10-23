'use client'

import { useCallback, useEffect, useState } from 'react'

const RESEND_COOLDOWN_MS = 60_000

type ResendCooldownOptions = {
  startLocked?: boolean
  storageKey?: string
}

function secondsUntilReady(lastSentAt: number) {
  return Math.max(0, Math.ceil((lastSentAt + RESEND_COOLDOWN_MS - Date.now()) / 1_000))
}

function readStoredTime(storageKey?: string) {
  if (!storageKey) return null
  let value = 0
  try { value = Number(window.localStorage.getItem(storageKey)) } catch { /* Cooldown still works for this visit without storage. */ }
  return Number.isFinite(value) && value > 0 ? value : null
}

export function useResendCooldown({ startLocked = false, storageKey }: ResendCooldownOptions = {}) {
  const [lastSentAt, setLastSentAt] = useState<number | null>(startLocked ? 0 : null)
  const [secondsRemaining, setSecondsRemaining] = useState(startLocked ? 60 : 0)
  const [ready, setReady] = useState(false)

  const remember = useCallback((sentAt: number | null) => {
    if (storageKey) {
      try {
        if (sentAt) window.localStorage.setItem(storageKey, String(sentAt))
        else window.localStorage.removeItem(storageKey)
      } catch { /* Keep the cooldown in memory when storage is unavailable. */ }
    }
    setLastSentAt(sentAt)
    setSecondsRemaining(sentAt ? secondsUntilReady(sentAt) : 0)
  }, [storageKey])

  const start = useCallback(() => remember(Date.now()), [remember])
  const reset = useCallback(() => remember(null), [remember])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedTime = readStoredTime(storageKey)
      const initialTime = storedTime ?? (startLocked ? Date.now() : null)
      remember(initialTime)
      setReady(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [remember, startLocked, storageKey])

  useEffect(() => {
    if (!storageKey) return
    function syncAcrossTabs(event: StorageEvent) {
      if (event.key !== storageKey) return
      const sentAt = event.newValue ? Number(event.newValue) : null
      const nextTime = sentAt && Number.isFinite(sentAt) ? sentAt : null
      setLastSentAt(nextTime)
      setSecondsRemaining(nextTime ? secondsUntilReady(nextTime) : 0)
    }
    window.addEventListener('storage', syncAcrossTabs)
    return () => window.removeEventListener('storage', syncAcrossTabs)
  }, [storageKey])

  useEffect(() => {
    if (!lastSentAt || lastSentAt <= 0) return
    const timer = window.setInterval(() => {
      const remaining = secondsUntilReady(lastSentAt!)
      setSecondsRemaining(remaining)
      if (remaining === 0) window.clearInterval(timer)
    }, 1_000)
    return () => window.clearInterval(timer)
  }, [lastSentAt])

  return {
    secondsRemaining,
    locked: !ready || secondsRemaining > 0,
    sent: lastSentAt !== null,
    ready,
    start,
    reset,
  }
}
