'use client'

import { ArrowLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { apiRequest } from '../../lib/api-client'
import { controlClass, labelClass, type Contact, type ContactPage, type Person } from '../../lib/crm'
import { Button, ButtonLink } from '../ui/button'
import { FormMessage } from '../ui/form-message'
import { Modal } from '../ui/modal'
import { Avatar } from './badges'
import { DealForm, TaskForm } from './forms'

function ContactPicker({ onSelect }: { onSelect: (contact: Contact) => void }) {
  const [search, setSearch] = useState('')
  const [result, setResult] = useState<{ query: string; data?: ContactPage; error?: string } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void apiRequest<ContactPage>(`/crm/contacts?q=${encodeURIComponent(search)}`, { signal: controller.signal })
        .then((data) => setResult({ query: search, data }))
        .catch((error) => {
          if (!controller.signal.aborted) setResult({ query: search, error: error instanceof Error ? error.message : 'Could not load contacts' })
        })
    }, 200)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [search])

  const loading = result?.query !== search
  return <div className="grid gap-4">
    <label className={labelClass}>Choose a contact
      <span className="relative"><Search className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-lt-500" size={17}/><input data-autofocus className={`${controlClass} pl-10!`} placeholder="Search name, email, or company" value={search} onChange={(event) => setSearch(event.target.value)}/></span>
    </label>
    <div className="grid max-h-64 gap-1 overflow-y-auto" aria-live="polite" aria-busy={loading}>
      {loading ? <p className="m-0 text-sm text-lt-500">Loading contacts…</p> : result?.error ? <FormMessage tone="error" role="alert">{result.error}</FormMessage> : result?.data?.items.length ? <>
        {result.data.items.map((contact) => <button type="button" key={contact.id} onClick={() => onSelect(contact)} className="flex items-center gap-3 rounded-xl border border-lt-200 p-3 text-left transition-colors hover:border-lt-300 hover:bg-lt-50 motion-reduce:transition-none">
          <Avatar name={contact.name}/><span className="grid min-w-0 flex-1 gap-1"><strong className="truncate text-sm text-lt-900">{contact.name}</strong><span className="truncate text-xs text-lt-600">{contact.companyName || contact.email || 'Contact'}</span></span><ChevronRight size={16} className="text-lt-500"/>
        </button>)}
        {result.data.total > result.data.items.length && <p className="m-0 text-xs text-lt-500">Showing the first {result.data.items.length} matches. Search to narrow the list.</p>}
      </> : <p className="m-0 text-sm text-lt-600">{search ? 'No contacts match that search.' : 'Add your first contact to get started.'}</p>}
    </div>
    <div className="border-t border-lt-100 pt-4"><ButtonLink href="/dashboard/contacts?add=1" variant="secondary" size="xs"><Plus size={15}/>Add a new contact</ButtonLink></div>
  </div>
}

export function CreateRecordButton({ kind, members }: { kind: 'deal' | 'task'; members: Person[] }) {
  const [open, setOpen] = useState(false)
  const [contact, setContact] = useState<Contact | null>(null)
  const title = kind === 'deal' ? 'Add deal' : 'Add follow-up'
  function close() { setOpen(false); setContact(null) }
  return <>
    <Button onClick={() => setOpen(true)}><Plus size={17}/>{title}</Button>
    <Modal open={open} onClose={close} title={title} description={contact ? `For ${contact.name}${contact.companyName ? ` at ${contact.companyName}` : ''}` : 'Start by choosing the contact this belongs to.'}>
      {contact ? <div className="grid gap-5"><Button variant="ghost" size="xs" className="w-fit" onClick={() => setContact(null)}><ArrowLeft size={14}/>Choose another contact</Button>{kind === 'deal' ? <DealForm prospectId={contact.id} members={members} onSaved={close}/> : <TaskForm id={contact.id} members={members} onSaved={close}/>}</div> : <ContactPicker onSelect={setContact}/>}
    </Modal>
  </>
}
