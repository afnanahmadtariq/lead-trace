import type { ReactNode } from 'react'
import { badgeClass, initials, label, lifecycleTone, stageTone, type Tone } from '../../lib/crm'

export function Badge({ tone = 'neutral', dot = false, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return <span className={badgeClass(tone)}>{dot && <i className="size-1.5 rounded-full bg-current" aria-hidden="true"/>}{children}</span>
}
export const StageBadge = ({ stage }: { stage: string }) => <Badge tone={stageTone(stage)} dot>{label(stage)}</Badge>
export const LifecycleBadge = ({ lifecycle }: { lifecycle: string }) => <Badge tone={lifecycleTone(lifecycle)}>{label(lifecycle)}</Badge>
export function Avatar({ name, className = '' }: { name: string; className?: string }) {
  return <span aria-hidden="true" className={`grid size-8 shrink-0 place-items-center rounded-lg bg-lt-100 text-xs font-semibold text-brand ${className}`}>{initials(name)}</span>
}
