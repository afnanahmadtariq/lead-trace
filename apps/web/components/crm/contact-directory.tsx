'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Download, Plus, Search, Upload, UsersRound } from 'lucide-react'
import { apiRequest } from '../../lib/api-client'
import { compactControlClass, controlClass, labelClass, type ContactPage, type Person } from '../../lib/crm'
import { Button, ButtonLink } from '../ui/button'
import { Field } from '../ui/form-field'
import { FormMessage } from '../ui/form-message'
import { Modal } from '../ui/modal'
import { Avatar, LifecycleBadge } from './badges'
import { ContactForm, MutationForm, text } from './forms'

export function ContactDirectory({ data, members, search, initialCreate = false }: { data: ContactPage; members: Person[]; search: string; initialCreate?: boolean }) {
  const [dialog, setDialog] = useState<'contact' | 'import' | null>(initialCreate ? 'contact' : null), [error, setError] = useState(''), [result, setResult] = useState('')
  const router = useRouter()
  async function exportCsv() {
    setError('')
    try {
      const { csv } = await apiRequest<{ csv: string }>('/crm/contacts/export')
      const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'lead-trace-contacts.csv'; anchor.click(); URL.revokeObjectURL(url)
    } catch (error) { setError(error instanceof Error ? error.message : 'Export failed') }
  }
  const empty = !data.total && !search, pages = Math.max(1, Math.ceil(data.total / data.pageSize))
  const open = (id: string) => router.push(`/dashboard/contacts/${id}`)
  return <>
    {!empty && <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
      <form role="search" className="flex min-w-0 flex-1 basis-72 items-center gap-2" action="/dashboard/contacts">
        <div className="relative min-w-0 flex-1"><Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-lt-500" aria-hidden="true"/><input name="q" aria-label="Find a contact" placeholder="Search by name, email, or company" defaultValue={search} className={`${compactControlClass} w-full pl-10`}/></div>
        <Button variant="secondary" size="xs" type="submit" className="min-h-10!">Search</Button>{search && <ButtonLink href="/dashboard/contacts" variant="ghost" size="xs" className="min-h-10!">Clear search</ButtonLink>}
      </form>
      <span className="text-sm text-lt-500 tabular-nums max-[620px]:order-last max-[620px]:w-full">{data.total} {data.total === 1 ? 'contact' : 'contacts'}</span>
      <div className="flex flex-wrap items-center gap-2"><Button variant="secondary" size="xs" className="min-h-10!" onClick={exportCsv}><Download size={15}/>Export CSV</Button><Button variant="secondary" size="xs" className="min-h-10!" onClick={() => setDialog('import')}><Upload size={15}/>Import CSV</Button><Button size="xs" className="min-h-10!" onClick={() => setDialog('contact')}><Plus size={16}/>Add contact</Button></div>
    </div>}
    {error && <FormMessage tone="error" role="alert">{error}</FormMessage>}{result && <FormMessage tone="success" role="status">{result}</FormMessage>}
    {data.items.length ? <div className="overflow-x-auto rounded-2xl border border-lt-200 bg-white"><table className="w-full min-w-[760px] border-collapse text-left text-sm">
      <thead><tr className="border-b border-lt-200 bg-lt-50 text-xs font-semibold text-lt-600">{[['Contact', ''], ['Company', ''], ['Lifecycle', ''], ['Owner', ''], ['Deals', 'text-right'], ['Research', 'text-right']].map(([heading, align]) => <th scope="col" className={`px-5 py-3 font-semibold ${align}`} key={heading}>{heading}</th>)}</tr></thead>
      <tbody>{data.items.map((contact) => <tr key={contact.id} onClick={(event) => { if (!(event.target as HTMLElement).closest('a,button')) open(contact.id) }} className="cursor-pointer border-t border-lt-100 transition-colors first:border-t-0 hover:bg-lt-50">
        <td className="px-5 py-3.5"><div className="flex items-center gap-3"><Avatar name={contact.name}/><div className="min-w-0"><Link className="font-semibold text-lt-900 hover:text-brand" href={`/dashboard/contacts/${contact.id}`}>{contact.name}</Link><small className="mt-0.5 block text-xs text-lt-500">{contact.email || 'No email'}</small></div></div></td>
        <td className="px-5 py-3.5">{contact.companyName ? <span className="text-lt-900">{contact.companyName}</span> : <span className="text-lt-500">Not set</span>}{contact.jobTitle && <small className="mt-0.5 block text-xs text-lt-500">{contact.jobTitle}</small>}</td>
        <td className="px-5 py-3.5"><LifecycleBadge lifecycle={contact.lifecycle}/></td>
        <td className={`px-5 py-3.5 ${contact.owner ? 'text-lt-700' : 'text-lt-500'}`}>{contact.owner?.name || 'Unassigned'}</td>
        <td className="px-5 py-3.5 text-right text-lt-700 tabular-nums">{contact._count.deals}</td>
        <td className="px-5 py-3.5 text-right whitespace-nowrap text-lt-700 tabular-nums">{contact._count.researchRuns} {contact._count.researchRuns === 1 ? 'run' : 'runs'}</td>
      </tr>)}</tbody>
    </table></div> : empty ? <div className="grid justify-items-center gap-5 rounded-2xl border border-dashed border-lt-300 bg-white px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-xl bg-lt-100 text-brand"><UsersRound size={22}/></span>
      <div className="grid gap-1.5"><h2 className="m-0 text-lg text-lt-900">Start your contact book</h2><p className="m-0 max-w-[460px] text-sm leading-relaxed text-lt-600">Add the people you talk to, or import a list you already have. Only a name is required, and you can fill in the rest later.</p></div>
      <div className="flex flex-wrap justify-center gap-2"><Button onClick={() => setDialog('contact')}><Plus size={17}/>Add contact</Button><Button variant="secondary" onClick={() => setDialog('import')}><Upload size={16}/>Import CSV</Button></div>
      <p className="m-0 text-xs text-lt-500">CSV columns: name, email, company, domain, title, phone</p>
    </div> : <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-lt-300 bg-white px-6 py-12 text-center"><span className="mb-1 grid size-11 place-items-center rounded-xl bg-lt-100 text-brand"><Search size={20}/></span><h2 className="m-0 text-lg text-lt-900">No matching contacts</h2><p className="m-0 text-sm text-lt-600">Try a different name, email, or company.</p></div>}
    {pages > 1 && <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-lt-500 tabular-nums">Page {data.page} of {pages}</span><div className="flex gap-2">{data.page > 1 && <ButtonLink variant="secondary" size="xs" href={`/dashboard/contacts?q=${encodeURIComponent(search)}&page=${data.page - 1}`}>Previous</ButtonLink>}{data.page * data.pageSize < data.total && <ButtonLink variant="secondary" size="xs" href={`/dashboard/contacts?q=${encodeURIComponent(search)}&page=${data.page + 1}`}>Next</ButtonLink>}</div></div>}
    <Modal open={dialog === 'contact'} onClose={() => setDialog(null)} title="Add contact" description="Only a name is required. You can fill in the rest as you learn more."><ContactForm members={members} onSaved={() => setDialog(null)}/></Modal>
    <Modal open={dialog === 'import'} onClose={() => setDialog(null)} title="Import contacts" description="Up to 500 rows. Existing email matches are skipped; existing records are preserved.">
      <MutationForm action="Import contacts" save={async (form) => {
        const file = form.get('file'); const csv = file instanceof File && file.size ? await file.text() : text(form, 'csv')
        const result = await apiRequest<{ created: number; skipped: number }>('/crm/contacts/import', { method: 'POST', body: JSON.stringify({ csv }) })
        setResult(`${result.created} contacts imported; ${result.skipped} email matches skipped.`); setDialog(null); router.refresh()
      }}><p className="m-0 text-sm text-lt-600">Headers: <code className="rounded bg-lt-100 px-1.5 py-0.5 text-xs text-lt-700">name,email,company,domain,title,phone</code>. Only name is required.</p><Field name="file" type="file" label="CSV file" accept=".csv,text/csv"/><label className={labelClass}>Or paste CSV<textarea className={`${controlClass} min-h-40 font-mono text-xs`} name="csv" placeholder={'name,email,company\nMaya Chen,maya@example.com,Northstar'}/></label></MutationForm>
    </Modal>
  </>
}
