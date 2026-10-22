'use client'
import { useSyncExternalStore } from 'react'
const subscribe = () => () => {}

export function LocalTime({ value, dateOnly = false }: { value: string; dateOnly?: boolean }) {
  const display = useSyncExternalStore(subscribe,
    () => dateOnly ? new Date(value).toLocaleDateString() : new Date(value).toLocaleString(),
    () => dateOnly ? value.slice(0, 10) : `${value.slice(0, 16).replace('T', ' ')} UTC`,
  )
  return <time dateTime={value}>{display}</time>
}
