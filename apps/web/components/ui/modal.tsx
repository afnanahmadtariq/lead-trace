'use client'

import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useId, useRef, type ReactNode } from 'react'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

const sizes: Record<ModalSize, string> = {
  sm: 'max-w-[480px]',
  md: 'max-w-[640px]',
  lg: 'max-w-[800px]',
  xl: 'max-w-[1040px]',
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: ModalSize
  dismissible?: boolean
  closeLabel?: string
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
  closeLabel = 'Close dialog',
}: ModalProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const animationFrame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current
      const preferredTarget = dialog?.querySelector<HTMLElement>('[data-autofocus]')
      const firstTarget = dialog?.querySelector<HTMLElement>(focusableSelector)
      const target = preferredTarget || firstTarget || dialog
      if (!dialog?.contains(document.activeElement)) target?.focus()
    })

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && dismissible) {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const dialog = dialogRef.current
      const focusable = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)) : []
      if (!focusable.length) {
        event.preventDefault()
        dialog?.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(animationFrame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [dismissible, open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-100 grid min-h-dvh place-items-center overflow-y-auto bg-lt-950/40 px-4 py-6"
      role="presentation"
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`my-auto flex max-h-[calc(100dvh-3rem)] w-full flex-col overflow-hidden rounded-[20px] border border-lt-200 bg-white shadow-[0_28px_70px_rgba(16,38,79,.24)] outline-none ${sizes[size]}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start gap-4 border-b border-lt-100 px-6 py-5 max-[520px]:px-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="m-0 text-[1.12rem] tracking-[-.02em] text-lt-900">{title}</h2>
            {description && <p id={descriptionId} className="mt-1.5 mb-0 text-[.8rem] leading-[1.5] text-lt-600">{description}</p>}
          </div>
          {dismissible && <button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-xl text-lt-500 transition-colors hover:bg-lt-50 hover:text-lt-900" aria-label={closeLabel}><X size={19}/></button>}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 max-[520px]:px-5">{children}</div>
        {footer && <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-lt-100 px-6 py-4 max-[520px]:px-5">{footer}</footer>}
      </section>
    </div>,
    document.body,
  )
}
