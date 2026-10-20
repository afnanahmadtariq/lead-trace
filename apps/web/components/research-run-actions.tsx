'use client'

import { RefreshCw, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { apiRequest } from '../lib/api-client'
import type { ResearchRunSummary } from '../lib/research'
import { Button } from './ui/button'
import { FormMessage } from './ui/form-message'

type DiscoveryResult = {
  sourcesCollected: number
  queriesCompleted: number
  failedQueries: number
}

export function ResearchRunActions({ run }: { run: Pick<ResearchRunSummary, 'id' | 'status'> }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<DiscoveryResult | null>(null)

  async function discover() {
    setPending(true)
    setError('')
    setResult(null)
    try {
      if (run.status === 'failed') {
        await apiRequest(`/research-runs/${run.id}/retry`, { method: 'POST' })
      }
      const response = await apiRequest<DiscoveryResult>(`/research-runs/${run.id}/discover`, { method: 'POST' })
      setResult(response)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start source discovery')
    } finally {
      setPending(false)
    }
  }

  if (run.status === 'completed') return null
  if (run.status === 'running') {
    return <Button variant="secondary" type="button" onClick={() => router.refresh()}><RefreshCw size={17}/>Refresh status</Button>
  }

  return <div className="grid shrink-0 justify-items-end gap-2 max-[700px]:w-full max-[700px]:justify-items-start">
    <Button className="whitespace-nowrap" type="button" onClick={discover} disabled={pending}>
      {pending ? <RefreshCw className="animate-spin" size={17}/> : <Search size={17}/>}
      {pending ? 'Collecting public sources…' : run.status === 'failed' ? 'Retry source discovery' : 'Collect public sources'}
    </Button>
    {result && <p className="m-0 max-w-[300px] text-right text-xs text-lt-600 max-[700px]:text-left">{result.sourcesCollected} sources collected across {result.queriesCompleted} searches.</p>}
    {error && <FormMessage tone="error" className="text-[.8rem]">{error}</FormMessage>}
  </div>
}
