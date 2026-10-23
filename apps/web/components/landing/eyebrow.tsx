import type { ReactNode } from 'react'

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mt-0 mb-5 text-sm font-semibold text-brand">{children}</p>
}
