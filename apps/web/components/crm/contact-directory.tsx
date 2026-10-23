'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Download, Plus, Upload, UsersRound } from 'lucide-react'
import { apiRequest } from '../../lib/api-client'
import { cardClass, controlClass, label, type ContactPage, type Person } from '../../lib/crm'
import { Button, ButtonLink } from '../ui/button'
import { Field } from '../ui/form-field'
import { Modal } from '../ui/modal'
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
  return <>
    <div className="flex flex-wrap items-center gap-2"><Button onClick={() => setDialog('contact')}><Plus size={17}/>Add contact</Button><Button variant="secondary" onClick={() => setDialog('import')}><Upload size={16}/>Import CSV</Button><Button variant="secondary" onClick={exportCsv}><Download size={16}/>Export CSV</Button><span className="ml-auto text-sm text-lt-500">{data.total} contacts</span></div>
    {error && <p role="alert" className="text-danger">{error}</p>}{result && <p role="status" className="text-brand">{result}</p>}
    <form className="flex flex-wrap items-end gap-3" action="/dashboard/contacts"><div className="min-w-0 flex-1"><Field name="q" label="Find a contact" placeholder="Name, email, or company" defaultValue={search}/></div><Button variant="secondary" type="submit">Search</Button>{search && <ButtonLink href="/dashboard/contacts" variant="ghost">Clear search</ButtonLink>}</form>
    {data.items.length ? <div className="overflow-x-auto rounded-2xl border border-lt-200 bg-white"><table className="w-full border-collapse text-left text-sm"><thead className="bg-lt-100 text-xs text-lt-600"><tr>{['Contact', 'Company', 'Lifecycle', 'Owner', 'Research'].map((heading) => <th className="px-5 py-3" key={heading}>{heading}</th>)}</tr></thead><tbody>{data.items.map((contact) => <tr key={contact.id} className="border-t border-lt-100 hover:bg-lt-50"><td className="px-5 py-4"><Link className="font-semibold text-brand" href={`/dashboard/contacts/${contact.id}`}>{contact.name}</Link><small className="mt-1 block text-lt-500">{contact.email || 'No email'}</small></td><td className="px-5 py-4">{contact.companyName || '—'}<small className="block text-lt-500">{contact.jobTitle}</small></td><td className="px-5 py-4"><span className="rounded-full bg-lt-100 px-3 py-1 text-xs">{label(contact.lifecycle)}</span></td><td className="px-5 py-4">{contact.owner?.name || 'Unassigned'}</td><td className="px-5 py-4">{contact._count.researchRuns} runs</td></tr>)}</tbody></table></div> : <div className={`${cardClass} grid min-h-52 content-center justify-items-center gap-3 text-center text-lt-500`}><UsersRound size={32}/><h2 className="m-0 text-lg text-lt-900">{search ? 'No matching contacts' : 'Start your contact book'}</h2><p className="m-0 text-sm">Add a contact or import a CSV to start tracking conversations.</p></div>}
    <div className="flex items-center justify-between"><span className="text-xs text-lt-500">Page {data.page} · 50 contacts per page</span><div className="flex gap-2">{data.page > 1 && <ButtonLink variant="secondary" href={`/dashboard/contacts?q=${encodeURIComponent(search)}&page=${data.page - 1}`}>Previous</ButtonLink>}{data.page * data.pageSize < data.total && <ButtonLink variant="secondary" href={`/dashboard/contacts?q=${encodeURIComponent(search)}&page=${data.page + 1}`}>Next</ButtonLink>}</div></div>
    {!data.total && !search && <div className="grid grid-cols-3 gap-3 max-[620px]:grid-cols-1" aria-label="How your CRM works">{[['1', 'Add a person', 'Start with a name. Add company details for better research.'], ['2', 'Prepare the conversation', 'Create a cited brief from the contact’s saved details.'], ['3', 'Keep things moving', 'Record a deal, add a note, and give yourself a next step.']].map(([step, title, description]) => <article key={step} className="rounded-2xl border border-lt-200 bg-white p-5"><span className="mb-3 grid size-7 place-items-center rounded-full bg-lt-100 text-xs font-bold text-brand">{step}</span><h2 className="m-0 text-sm text-lt-900">{title}</h2><p className="mt-2 mb-0 text-sm leading-relaxed text-lt-600">{description}</p></article>)}</div>}
    <Modal open={dialog === 'contact'} onClose={() => setDialog(null)} title="Add contact" description="Only a name is required. You can fill in the rest as you learn more."><ContactForm members={members} onSaved={() => setDialog(null)}/></Modal>
    <Modal open={dialog === 'import'} onClose={() => setDialog(null)} title="Import contacts" description="Up to 500 rows. Existing email matches are skipped; existing records are preserved.">
      <MutationForm action="Import contacts" save={async (form) => {
        const file = form.get('file'); const csv = file instanceof File && file.size ? await file.text() : text(form, 'csv')
        const result = await apiRequest<{ created: number; skipped: number }>('/crm/contacts/import', { method: 'POST', body: JSON.stringify({ csv }) })
        setResult(`${result.created} contacts imported; ${result.skipped} email matches skipped.`); setDialog(null); router.refresh()
      }}><p className="m-0 text-sm text-lt-600">Headers: <code>name,email,company,domain,title,phone</code>. Only name is required.</p><Field name="file" type="file" label="CSV file" accept=".csv,text/csv"/><label className="grid gap-2 text-sm text-lt-700">Or paste CSV<textarea className={`${controlClass} min-h-40 font-mono text-xs`} name="csv" placeholder={'name,email,company\nMaya Chen,maya@example.com,Northstar'}/></label></MutationForm>
    </Modal>
  </>
}
