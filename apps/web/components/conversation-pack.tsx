'use client'

import { Download } from 'lucide-react'
import { formatConversationPack } from '../lib/conversation-pack'
import { CopyButton } from './ui/copy-button'
import { Button } from './ui/button'
export { extractBriefDiff, formatConversationPack } from '../lib/conversation-pack'

export function ConversationPackButton({ sections, goal }: { sections: unknown; goal: 'meeting' | 'outreach' }) {
  const value = formatConversationPack(sections, goal)
  if (!value) return null
  function download() {
    const url = URL.createObjectURL(new Blob([value], { type: 'text/plain;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `Lead-Trace-${goal}-brief.txt`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <><CopyButton value={value} label="Copy for CRM"/><Button type="button" variant="secondary" size="xs" onClick={download}><Download size={14}/>Download brief</Button></>
}
