'use client'

import { House, Search, Sparkles, UsersRound, Kanban, ListChecks, Plug, Radar } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navigation = [
  { href: '/dashboard', label: 'Home', icon: House, exact: true },
  { href: '/dashboard/leads', label: 'Find leads', icon: Radar },
  { href: '/dashboard/contacts', label: 'Contacts', icon: UsersRound },
  { href: '/dashboard/pipeline', label: 'Pipeline', icon: Kanban },
  { href: '/dashboard/tasks', label: 'Follow-ups', icon: ListChecks },
  { href: '/dashboard/research', label: 'Research', icon: Search },
  { href: '/dashboard/briefs', label: 'Briefs', icon: Sparkles },
  { href: '/dashboard/integrations', label: 'Integrations', icon: Plug },
]

export function DashboardNav({ collapsed = false, vertical = false }: { collapsed?: boolean; vertical?: boolean }) {
  const pathname = usePathname()
  return <nav className={`grid gap-1 ${vertical ? '' : 'max-[900px]:mt-4 max-[900px]:flex max-[900px]:overflow-x-auto'} ${collapsed ? 'w-full justify-items-center max-[900px]:w-auto' : ''}`} aria-label="Workspace navigation">
    {navigation.map(({ href, label, icon: Icon, exact }) => {
      const active = exact ? pathname === href : pathname.startsWith(href)
      const collapsedClass = collapsed ? 'w-11 justify-center px-0 max-[900px]:w-auto max-[900px]:justify-start max-[900px]:px-3' : ''
      const activeClass = active ? 'bg-[#e7f3ff] font-semibold text-brand' : 'text-lt-600 hover:bg-lt-100 hover:text-lt-900'
      return <Link key={href} href={href} className={`flex min-h-[43px] items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition-colors duration-200 max-[900px]:min-h-[39px] max-[900px]:shrink-0 ${collapsedClass} ${activeClass}`} aria-current={active ? 'page' : undefined} aria-label={label} title={collapsed ? label : undefined}>
        <Icon className="shrink-0" size={18}/><span className={collapsed ? 'hidden max-[900px]:inline' : ''}>{label}</span>
      </Link>
    })}
  </nav>
}
