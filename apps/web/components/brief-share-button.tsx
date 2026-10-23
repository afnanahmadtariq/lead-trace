'use client'

import { Check, Link2Off, Share2 } from 'lucide-react'
import { useState } from 'react'
import { apiRequest } from '../lib/api-client'
import { Button } from './ui/button'

export function BriefShareButton({ briefId, initialToken }: { briefId: string; initialToken?: string }) {
  const [token, setToken] = useState(initialToken)
  const [pending, setPending] = useState<'share' | 'revoke' | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function copyPublicUrl(shareToken: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/shared/briefs/${shareToken}`)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  async function share() {
    setError('')
    setPending('share')
    try {
      const result = token
        ? { token }
        : await apiRequest<{ token: string }>(`/deal-briefs/${briefId}/share`, { method: 'POST' })
      setToken(result.token)
      await copyPublicUrl(result.token)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the public link')
    } finally {
      setPending(null)
    }
  }

  async function revoke() {
    setError('')
    setPending('revoke')
    try {
      await apiRequest(`/deal-briefs/${briefId}/share`, { method: 'DELETE' })
      setToken(undefined)
      setCopied(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not revoke the public link')
    } finally {
      setPending(null)
    }
  }

  return <div className="flex flex-wrap items-center gap-2">
    <Button type="button" variant="secondary" size="xs" onClick={() => void share()} disabled={pending !== null} aria-live="polite">
      {copied ? <Check size={14}/> : <Share2 size={14}/>}
      {pending === 'share' ? 'Creating link…' : copied ? 'Link copied' : token ? 'Copy public link' : 'Share brief'}
    </Button>
    {token && <Button type="button" variant="ghost" size="xs" className="text-lt-500" onClick={() => void revoke()} disabled={pending !== null}><Link2Off size={14}/>{pending === 'revoke' ? 'Revoking…' : 'Revoke'}</Button>}
    {error && <span className="basis-full text-[.72rem] text-danger" role="alert">{error}</span>}
  </div>
}
