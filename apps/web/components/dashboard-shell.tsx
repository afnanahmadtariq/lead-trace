'use client'

import * as Popover from '@radix-ui/react-popover'
import { Bell, Building2, Check, ChevronLeft, ChevronRight, Menu, Search, Settings, UserRound } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { AccountContext } from '../lib/account-context'
import { apiRequest } from '../lib/api-client'
import type { InsightNotification } from '../lib/research'
import { DashboardNav } from './dashboard-nav'
import { SignOutButton } from './sign-out-button'
import { Brand } from './ui/brand'
import { Button, ButtonLink } from './ui/button'
import { DashboardHeaderTarget } from './workspace/dashboard-page-header'

function NotificationEntry({ item, onSelect }: { item: InsightNotification; onSelect: () => void }) {
  const content = <>
    <span className="mt-px grid size-[30px] place-items-center rounded-[9px] bg-lt-100 text-brand">{item.readAt ? <Check size={15}/> : <Search size={15}/>}</span>
    <span className="grid min-w-0 gap-[3px]"><strong className="truncate text-[.79rem] text-lt-900">{item.title}</strong><small className="line-clamp-2 text-[.72rem] leading-[1.4] tracking-normal text-lt-600 normal-case">{item.body}</small></span>
  </>
  const className = 'grid grid-cols-[auto_1fr] gap-[11px] border-b border-lt-100 px-4 py-3.5 text-inherit no-underline transition-colors duration-300 ease-fluid last:border-b-0 hover:bg-lt-50 motion-reduce:transition-none'
  return item.researchRun
    ? <Link href={`/dashboard/research/${item.researchRun.id}`} className={className} onClick={onSelect}>{content}</Link>
    : <div className={className}>{content}</div>
}

export function DashboardShell({
  context,
  notifications,
  children,
}: {
  context: AccountContext & { activeWorkspace: NonNullable<AccountContext['activeWorkspace']> }
  notifications: InsightNotification[]
  children: ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [headerTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notificationItems, setNotificationItems] = useState(notifications)
  const [clearingNotifications, setClearingNotifications] = useState(false)
  const [notificationError, setNotificationError] = useState('')
  const accountCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initials = context.user.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  const unreadNotifications = notificationItems.filter((item) => !item.readAt).length

  useEffect(() => {
    queueMicrotask(() => {
      try { setCollapsed(window.localStorage.getItem('lead-trace-sidebar-collapsed') === 'true') } catch { /* Sidebar stays expanded without browser storage. */ }
    })
  }, [])

  useEffect(() => () => {
    if (accountCloseTimer.current) clearTimeout(accountCloseTimer.current)
  }, [])

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 901px)')
    function closeHiddenMenu() {
      if (desktop.matches) setMobileMenuOpen(false)
      else setAccountMenuOpen(false)
    }
    desktop.addEventListener('change', closeHiddenMenu)
    return () => desktop.removeEventListener('change', closeHiddenMenu)
  }, [])

  function toggleSidebar() {
    const next = !collapsed
    setCollapsed(next)
    try { window.localStorage.setItem('lead-trace-sidebar-collapsed', String(next)) } catch { /* Keep the choice for this visit. */ }
  }

  function selectNotification(item: InsightNotification) {
    setNotificationsOpen(false)
    if (item.readAt) return
    const readAt = new Date().toISOString()
    setNotificationItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt } : entry))
    void apiRequest(`/notifications/${item.id}/read`, { method: 'POST', keepalive: true }).catch(() => {
      setNotificationItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: null } : entry))
    })
  }

  async function clearNotifications() {
    if (!notificationItems.length || clearingNotifications) return
    const previousItems = notificationItems
    setClearingNotifications(true)
    setNotificationError('')
    setNotificationItems([])
    try {
      await apiRequest<{ cleared: number }>('/notifications', { method: 'DELETE' })
    } catch {
      setNotificationItems(previousItems)
      setNotificationError('Could not clear notifications. Please try again.')
    } finally {
      setClearingNotifications(false)
    }
  }

  function openAccountMenu() {
    if (accountCloseTimer.current) clearTimeout(accountCloseTimer.current)
    setAccountMenuOpen(true)
  }

  function closeAccountMenuSoon() {
    if (accountCloseTimer.current) clearTimeout(accountCloseTimer.current)
    accountCloseTimer.current = setTimeout(() => setAccountMenuOpen(false), 180)
  }

  return <div className={`grid min-h-dvh bg-lt-50 bg-[radial-gradient(circle_at_92%_0%,#e7f5ff_0,transparent_26%)] transition-[grid-template-columns] duration-300 ease-fluid motion-reduce:transition-none ${collapsed ? 'grid-cols-[84px_minmax(0,1fr)] max-[900px]:grid-cols-1' : 'grid-cols-[252px_minmax(0,1fr)] max-[900px]:grid-cols-1'}`}>
    <aside className={`sticky top-0 z-30 flex h-dvh self-start flex-col border-r border-lt-200 bg-white/88 py-5 pt-[25px] backdrop-blur-2xl transition-[padding] duration-300 ease-fluid motion-reduce:transition-none max-[900px]:hidden ${collapsed ? 'px-0' : 'px-[18px]'}`}>
      <div className={`relative flex min-h-9 shrink-0 items-center justify-between text-lt-900 max-[900px]:m-0 ${collapsed ? 'mb-6 w-full justify-center' : 'mx-2 mb-7'}`}>
        <Brand href="/dashboard" compact={collapsed}/>
        <Button type="button" variant="ghost" size="icon-sm" className={`max-[900px]:hidden ${collapsed ? 'absolute top-6 -right-3.5 z-10 size-7! bg-white' : ''}`} onClick={toggleSidebar} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronRight size={18}/> : <ChevronLeft size={18}/>}
        </Button>
      </div>

      {/* Keep sidebar overflow inside the viewport without clipping the collapse control. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [scrollbar-width:thin]">
      {!collapsed && <Link href="/dashboard/workspace" className="mb-[23px] flex items-center gap-[11px] rounded-[14px] border border-lt-200 bg-lt-50 p-3 text-inherit no-underline transition-[background-color,border-color,box-shadow] hover:border-lt-300 hover:bg-white hover:shadow-[0_8px_24px_rgba(18,52,111,.07)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand/20" aria-label={`Open ${context.activeWorkspace.name} workspace settings`}>
        <span className="grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-lt-100 text-brand"><Building2 size={17}/></span>
        <div className="grid min-w-0 gap-0.5"><small className="text-[.67rem] tracking-[.07em] text-lt-500 uppercase">Workspace</small><strong className="truncate text-[.83rem] text-lt-900">{context.activeWorkspace.name}</strong></div>
      </Link>}
      {collapsed && <Link href="/dashboard/workspace" className="mx-auto mb-[23px] grid size-10 place-items-center rounded-xl border border-lt-200 bg-lt-50 text-brand no-underline transition-colors hover:border-lt-300 hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand/20" aria-label={`Open ${context.activeWorkspace.name} workspace settings`} title="Workspace settings"><Building2 size={18}/></Link>}

      <DashboardNav collapsed={collapsed}/>

      <div className={`mt-auto flex shrink-0 flex-col gap-2.5 border-t border-lt-200 pt-[15px] max-[900px]:mt-5 max-[900px]:grid max-[900px]:grid-cols-[minmax(0,1fr)_auto] max-[900px]:items-center ${collapsed ? 'w-full items-center px-0' : 'px-2'}`}>
        <Popover.Root open={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
          <Popover.Trigger asChild>
            <button type="button" onMouseEnter={openAccountMenu} onMouseLeave={closeAccountMenuSoon} onClick={(event) => { event.preventDefault(); openAccountMenu() }} className={`flex min-w-0 items-center gap-2.5 rounded-[14px] border border-lt-200 bg-white px-2.5 py-2 text-left text-inherit transition-colors duration-200 hover:bg-lt-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand/20 motion-reduce:transition-none max-[900px]:w-full ${collapsed ? 'justify-center p-2' : ''}`} aria-label="Open account menu" aria-expanded={accountMenuOpen} title={collapsed ? 'Account menu' : undefined}>
              <span className="grid size-[35px] shrink-0 place-items-center rounded-[11px] bg-[linear-gradient(135deg,#dff3ff,#dce8ff)] text-[.72rem] font-[750] text-lt-900">{initials}</span>
              {!collapsed && <span className="grid min-w-0 gap-0.5"><strong className="truncate text-[.8rem] text-lt-900">{context.user.name}</strong><small className="truncate text-[.69rem] text-lt-500">{context.user.email}</small></span>}
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content onMouseEnter={openAccountMenu} onMouseLeave={closeAccountMenuSoon} className="z-100 grid w-[218px] gap-1 rounded-[15px] border border-lt-200 bg-white p-1.5 shadow-[0_16px_40px_rgba(18,52,111,.14)]" side={collapsed ? 'right' : 'top'} align={collapsed ? 'center' : 'start'} sideOffset={10} aria-label="Account menu">
              <Link href="/dashboard/profile" onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[.82rem] font-medium text-lt-800 no-underline transition-colors hover:bg-lt-50 hover:text-lt-950"><UserRound size={16} className="text-brand"/>Profile</Link>
              <Link href="/dashboard/settings" onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[.82rem] font-medium text-lt-800 no-underline transition-colors hover:bg-lt-50 hover:text-lt-950"><Settings size={16} className="text-brand"/>Settings & security</Link>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <SignOutButton compact={collapsed}/>
      </div>
      </div>
    </aside>

    <DashboardHeaderTarget value={headerTarget}><div className="min-w-0">
      <header data-dashboard-topbar className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 border-b border-lt-200 bg-lt-50/95 px-6 py-2.5 backdrop-blur-xl max-[900px]:px-5">
        <Popover.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <Popover.Trigger asChild><Button type="button" variant="secondary" size="icon-sm" className="hidden! max-[900px]:inline-flex!" aria-label="Open navigation"><Menu size={18}/></Button></Popover.Trigger>
          <Popover.Portal>
            <Popover.Content aria-label="Workspace menu" side="bottom" align="start" sideOffset={12} collisionPadding={16} onClick={(event) => { if ((event.target as HTMLElement).closest('a')) setMobileMenuOpen(false) }} className="z-100 grid max-h-[calc(100dvh_-_100px)] w-[min(300px,calc(100vw_-_32px))] gap-3 overflow-y-auto rounded-2xl border border-lt-200 bg-white p-3 shadow-panel">
              <div className="px-2 py-1"><Brand href="/dashboard"/></div>
              <Link href="/dashboard/workspace" className="flex min-w-0 items-center gap-2.5 rounded-xl bg-lt-50 px-3 py-2.5 text-sm font-semibold text-lt-900"><Building2 size={17} className="shrink-0 text-brand"/><span className="truncate">{context.activeWorkspace.name}</span></Link>
              <DashboardNav vertical/>
              <div className="grid gap-1 border-t border-lt-200 pt-2">
                <div className="grid gap-0.5 px-3 py-2"><strong className="truncate text-sm text-lt-900">{context.user.name}</strong><span className="truncate text-xs text-lt-500">{context.user.email}</span></div>
                <Link href="/dashboard/profile" className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-lt-700 hover:bg-lt-50"><UserRound size={17}/>Profile</Link>
                <Link href="/dashboard/settings" className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-lt-700 hover:bg-lt-50"><Settings size={17}/>Settings & security</Link>
                <SignOutButton/>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <div data-header-fallback className="min-w-0 flex-1 truncate text-sm font-semibold text-lt-900">{context.activeWorkspace.name}</div>
        <div ref={setHeaderTarget} className="contents"/>
        <div className="order-2 ml-auto flex shrink-0 items-center gap-2">
          <ButtonLink href="/dashboard/research/new" size="icon-sm" variant="secondary" className="dashboard-research-shortcut"><Search size={17} aria-hidden="true"/><span className="sr-only">Research prospect</span></ButtonLink>
          <Popover.Root open={notificationsOpen} onOpenChange={setNotificationsOpen}>
            <Popover.Trigger asChild>
              <Button type="button" variant="secondary" size="icon" className="relative text-lt-600 hover:text-brand data-[state=open]:border-lt-300 data-[state=open]:bg-lt-50 data-[state=open]:text-brand" aria-label={`${unreadNotifications} unread notifications`}>
                <Bell size={19}/>{unreadNotifications > 0 && <span className="absolute -top-[5px] -right-[5px] grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-white bg-brand px-1 text-[.62rem] font-bold text-white">{Math.min(unreadNotifications, 9)}</span>}
              </Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content className="z-100 w-[min(370px,calc(100vw_-_40px))] overflow-hidden rounded-[15px] border border-lt-200 bg-white data-[state=open]:animate-notification-in" side="bottom" align="end" sideOffset={12} collisionPadding={20} aria-label="Notifications">
                <header className="flex items-center justify-between gap-3 border-b border-lt-200 px-4 py-[15px]"><div className="grid gap-[3px]"><strong className="text-[.88rem]">Notifications</strong><small className="text-[.68rem] tracking-normal text-lt-500 normal-case">{unreadNotifications ? `${unreadNotifications} unread` : 'You’re all caught up'}</small></div><div className="flex items-center gap-1">{notificationItems.length > 0 && <Button type="button" variant="ghost" size="xs" className="min-h-7! px-2.5! text-[.72rem] text-danger" onClick={() => void clearNotifications()} disabled={clearingNotifications}>{clearingNotifications ? 'Clearing…' : 'Clear all'}</Button>}<Button type="button" variant="ghost" size="icon-sm" className="size-7! text-xl leading-none text-lt-500" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications">×</Button></div></header>
                {notificationError && <p className="m-0 border-b border-danger/15 bg-[#fff7f8] px-4 py-2 text-[.72rem] text-danger" role="alert">{notificationError}</p>}
                {notificationItems.length
                  ? <div className="grid max-h-[360px] overflow-auto">{notificationItems.slice(0, 5).map((item) => <NotificationEntry key={item.id} item={item} onSelect={() => selectNotification(item)}/>)}</div>
                  : <div className="grid justify-items-start gap-2.5 px-4 py-[22px] text-lt-500"><Bell className="text-brand" size={19}/><p className="m-0 max-w-[260px] text-[.78rem] leading-normal">No notifications yet. When research moves, you’ll see it here.</p></div>}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] px-6 pt-5 pb-12 max-[900px]:px-5 max-[900px]:pt-4 max-[900px]:pb-10">{children}</main>
    </div></DashboardHeaderTarget>
  </div>
}
