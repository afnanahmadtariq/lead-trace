'use client'

import * as Popover from '@radix-ui/react-popover'
import { Info } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

/** Guidance stays available to pointer, keyboard, and touch users. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  function show() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(true)
  }
  function hideSoon() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => {
      if (document.activeElement !== trigger.current) setOpen(false)
    }, 150)
  }
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current) }, [])

  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger asChild>
      <button ref={trigger} type="button" aria-label={label} aria-describedby={open ? id : undefined} onMouseEnter={show} onMouseLeave={hideSoon} onFocus={show} onBlur={() => setOpen(false)} onClick={(event) => { event.preventDefault(); show() }} className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-lt-500 transition-colors hover:bg-lt-100 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        <Info size={15} aria-hidden="true"/>
      </button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content role="tooltip" side="bottom" align="start" sideOffset={6} collisionPadding={16} onMouseEnter={show} onMouseLeave={hideSoon} onOpenAutoFocus={(event) => event.preventDefault()} onCloseAutoFocus={(event) => event.preventDefault()} className="z-100 max-w-[min(340px,calc(100vw_-_32px))] rounded-xl border border-lt-200 bg-white px-3.5 py-3 text-xs leading-relaxed text-lt-700 shadow-card">
        <div id={id}>{children}</div>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
}
