'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { apiRequest } from '../../lib/api-client'
import { Button } from '../ui/button'
import { FormMessage } from '../ui/form-message'
import { Modal } from '../ui/modal'

export function DeleteButton({ noun, path, description, name, href, onDeleted }: { noun: string; path: string; description: string; name?: string; href?: string; onDeleted?: () => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState('')
  const close = () => { if (!pending) { setOpen(false); setError('') } }
  async function remove() {
    setPending(true); setError('')
    try { await apiRequest(path, { method: 'DELETE' }); setOpen(false); if (href) router.push(href); else router.refresh(); onDeleted?.() }
    catch (error) { setError(error instanceof Error ? error.message : `Could not delete ${noun}`) }
    finally { setPending(false) }
  }
  return <>
    <Button type="button" size="xs" variant="danger" aria-label={name ?? `Delete ${noun}`} onClick={() => setOpen(true)}>Delete</Button>
    <Modal open={open} onClose={close} size="sm" title={`Delete ${noun}?`} description={description} footer={<><Button type="button" variant="secondary" size="xs" disabled={pending} onClick={close}>Cancel</Button><Button type="button" size="xs" variant="danger" data-autofocus disabled={pending} onClick={remove}>{pending ? 'Deleting…' : 'Delete'}</Button></>}>
      {error ? <FormMessage tone="error" role="alert">{error}</FormMessage> : <p className="m-0 text-sm text-lt-600">This cannot be undone.</p>}
    </Modal>
  </>
}
