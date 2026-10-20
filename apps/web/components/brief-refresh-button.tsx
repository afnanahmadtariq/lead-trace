'use client'

import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { apiRequest } from '../lib/api-client'
import { extractBriefDiff } from './conversation-pack'
import { Button } from './ui/button'
import { FormMessage } from './ui/form-message'

export function BriefRefreshButton({
  runId,
  previousSections,
  currentSections,
}: {
  runId: string
  previousSections?: unknown | null
  currentSections: unknown
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const diff = extractBriefDiff(previousSections, currentSections)

  async function refresh() {
    setPending(true)
    setError('')
    try {
      await apiRequest(`/research-runs/${runId}/refresh`, { method: 'POST' })
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not refresh brief')
    } finally {
      setPending(false)
    }
  }

  return <div className="grid gap-3">
    <Button variant="secondary" type="button" onClick={refresh} disabled={pending}>
      {pending ? <RefreshCw className="animate-spin" size={17}/> : <RefreshCw size={17}/>}
      {pending ? 'Refreshing brief…' : 'Refresh brief'}
    </Button>
    {error && <FormMessage tone="error">{error}</FormMessage>}
    {diff.length > 0 && <section className="rounded-[15px] border border-lt-200 bg-lt-50/60 p-4">
      <strong className="text-sm text-lt-900">Changes since last refresh</strong>
      <div className="mt-3 grid gap-3">{diff.map((item) => <article className="rounded-xl border border-lt-200 bg-white p-3" key={item.field}>
        <h3 className="m-0 text-xs font-bold tracking-[.06em] text-brand uppercase">{item.field}</h3>
        {item.before && <p className="mt-2 mb-1 text-xs text-lt-500"><span className="font-semibold">Before:</span> {item.before}</p>}
        {item.after && <p className="m-0 text-xs text-lt-700"><span className="font-semibold">After:</span> {item.after}</p>}
      </article>)}</div>
    </section>}
  </div>
}
