'use client'

import { Building2, FileSearch, House, Kanban, ListChecks, Plug, Radar, Search, Settings, ShieldCheck, Sparkles, UserRound, UsersRound } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { InfoTip } from '../ui/info-tip'

// undefined also allows the compact header to work outside DashboardShell.
export const DashboardHeaderTarget = createContext<HTMLElement | null | undefined>(undefined)

// Index pages use concise destination names; records retain their own titles.
const pages = {
  '/dashboard': { title: 'Overview', icon: House },
  '/dashboard/leads': { title: 'Find leads', icon: Radar },
  '/dashboard/contacts': { title: 'Contacts', icon: UsersRound },
  '/dashboard/pipeline': { title: 'Pipeline', icon: Kanban },
  '/dashboard/tasks': { title: 'Follow-ups', icon: ListChecks },
  '/dashboard/research': { title: 'Research', icon: Search },
  '/dashboard/research/new': { title: 'New conversation brief', icon: Search },
  '/dashboard/briefs': { title: 'Conversation briefs', icon: Sparkles },
  '/dashboard/evidence': { title: 'Evidence library', icon: FileSearch },
  '/dashboard/integrations': { title: 'Integrations', icon: Plug },
  '/dashboard/workspace': { title: 'Workspace settings', icon: Building2 },
  '/dashboard/profile': { title: 'Profile', icon: UserRound },
  '/dashboard/settings': { title: 'Settings & security', icon: ShieldCheck },
}

export type DashboardPageHeaderProps = { eyebrow: string; title: ReactNode; lead: ReactNode; action?: ReactNode }

export function DashboardPageHeader({ eyebrow, title, lead, action }: DashboardPageHeaderProps) {
  const target = useContext(DashboardHeaderTarget)
  const pathname = usePathname()
  const page = pages[pathname as keyof typeof pages]
  const section = pages[`/dashboard/${pathname.split('/')[2]}` as keyof typeof pages]
  const Icon = page?.icon ?? section?.icon ?? Settings
  const heading = page?.title ?? title
  const content = <>
    <div data-page-heading className="flex min-w-0 flex-1 items-center gap-2.5 min-[901px]:basis-56">
      <Icon size={20} className="shrink-0 text-brand max-[700px]:hidden!" aria-hidden="true"/>
      <div className="min-w-0">
        <h1 className="m-0 truncate text-lg leading-snug font-semibold tracking-tight text-lt-900">{heading}</h1>
        {!page && <div className="mt-0.5 line-clamp-1 text-xs text-lt-600"><span className="font-medium">{eyebrow}</span>{lead && <> · {lead}</>}</div>}
      </div>
      {lead && <InfoTip key={pathname} label="About this page"><strong className="mb-1 block">{heading}</strong>{lead}</InfoTip>}
    </div>
    {action && <div data-page-actions className="order-1 flex shrink-0 flex-wrap items-center gap-2 max-[700px]:order-3 max-[700px]:basis-full [&_a]:min-h-9! [&_a]:px-3! [&_a]:text-sm! [&_button]:min-h-9! [&_button]:px-3! [&_button]:text-sm!">{action}</div>}
  </>

  if (target) return createPortal(content, target)
  // Keep one semantic heading in server HTML; hydration moves it into the bar.
  return <header className={target === null ? 'sr-only' : 'flex flex-wrap items-center gap-3'}>{content}</header>
}
