'use client'

import { Building2, MailPlus, Pencil, ShieldCheck, Trash2, UserRound, UsersRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { apiRequest, errorMessage } from '../lib/api-client'
import { authClient } from '../lib/auth-client'
import type { WorkspaceSettingsContext } from '../lib/workspace-settings'
import { Button } from './ui/button'
import { Field } from './ui/form-field'
import { FormMessage } from './ui/form-message'

function roleLabel(role: string) {
  return role === 'owner' ? 'Creator admin' : role === 'admin' ? 'Admin' : 'Member'
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

export function WorkspaceSettings({ initial }: { initial: WorkspaceSettingsContext }) {
  const router = useRouter()
  const [nameEditing, setNameEditing] = useState(false)
  const [workspaceName, setWorkspaceName] = useState(initial.workspace.name)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member')
  const [briefConfirmation, setBriefConfirmation] = useState('')
  const [wipeConfirmation, setWipeConfirmation] = useState('')
  const [workspaceConfirmation, setWorkspaceConfirmation] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function begin(action: string) {
    setPending(action)
    setError('')
    setSuccess('')
  }

  async function renameWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    begin('rename')
    try {
      await apiRequest('/workspace-settings', { method: 'PATCH', body: JSON.stringify({ name: workspaceName }) })
      setNameEditing(false)
      setSuccess('Workspace name updated.')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The workspace name could not be updated.')
    } finally {
      setPending(null)
    }
  }

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    begin('invite')
    const email = inviteEmail.trim().toLowerCase()
    const result = await authClient.organization.inviteMember({
      email,
      role: inviteRole,
      organizationId: initial.workspace.id,
    })
    if (result.error) {
      setError(errorMessage(result.error, 'The invitation could not be sent.'))
    } else {
      setInviteEmail('')
      setInviteRole('member')
      setSuccess(`Invitation sent to ${email}.`)
      router.refresh()
    }
    setPending(null)
  }

  async function cancelInvitation(invitationId: string) {
    begin(`cancel-${invitationId}`)
    const result = await authClient.organization.cancelInvitation({ invitationId })
    if (result.error) setError(errorMessage(result.error, 'The invitation could not be cancelled.'))
    else { setSuccess('Invitation cancelled.'); router.refresh() }
    setPending(null)
  }

  async function updateMemberRole(memberId: string, role: 'member' | 'admin') {
    begin(`role-${memberId}`)
    const result = await authClient.organization.updateMemberRole({
      memberId,
      role,
      organizationId: initial.workspace.id,
    })
    if (result.error) setError(errorMessage(result.error, 'That member’s access could not be updated.'))
    else { setSuccess('Member access updated.'); router.refresh() }
    setPending(null)
  }

  async function deleteBriefs(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    begin('delete-briefs')
    try {
      const result = await apiRequest<{ deletedBriefs: number }>('/workspace-settings/briefs', { method: 'DELETE', body: JSON.stringify({ confirmation: briefConfirmation }) })
      setBriefConfirmation('')
      setSuccess(`${result.deletedBriefs} Deal Brief(s) deleted. Research runs and evidence were kept.`)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Deal Briefs could not be deleted.')
    } finally {
      setPending(null)
    }
  }

  async function wipeResearchData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    begin('wipe-data')
    try {
      await apiRequest('/workspace-settings/research-data', { method: 'DELETE', body: JSON.stringify({ confirmation: wipeConfirmation }) })
      setWipeConfirmation('')
      setSuccess('Workspace research data was deleted. This cannot be undone.')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Workspace research data could not be deleted.')
    } finally {
      setPending(null)
    }
  }

  async function deleteWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    begin('delete-workspace')
    try {
      await apiRequest('/workspace-settings', { method: 'DELETE', body: JSON.stringify({ confirmation: workspaceConfirmation }) })
      router.push('/onboarding')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The workspace could not be deleted.')
      setPending(null)
    }
  }

  return <div className="grid gap-[18px]">
    {(error || success) && <div>{error ? <FormMessage tone="error">{error}</FormMessage> : <FormMessage tone="success">{success}</FormMessage>}</div>}

    <section className="rounded-[17px] border border-lt-200 bg-white p-[23px]">
      <header className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lt-100 text-brand"><Building2 size={20}/></span><div><h2 className="m-0 text-[1.08rem] text-lt-900">Workspace identity</h2><p className="mt-1 mb-0 text-[.8rem] leading-[1.5] text-lt-500">The name shown to everyone collaborating here.</p></div></div>{initial.workspace.isAdmin && !nameEditing && <Button type="button" variant="secondary" size="xs" onClick={() => setNameEditing(true)}><Pencil size={15}/>Change name</Button>}</header>
      {!nameEditing ? <dl className="mt-5 mb-0 grid grid-cols-2 gap-3 border-t border-lt-100 pt-5 max-[600px]:grid-cols-1"><div className="rounded-xl bg-lt-50 p-3.5"><dt className="text-[.67rem] tracking-[.08em] text-lt-500 uppercase">Workspace name</dt><dd className="mt-1 mb-0 text-sm font-semibold text-lt-900">{initial.workspace.name}</dd></div><div className="rounded-xl bg-lt-50 p-3.5"><dt className="text-[.67rem] tracking-[.08em] text-lt-500 uppercase">Your access</dt><dd className="mt-1 mb-0 text-sm font-semibold text-lt-900">{roleLabel(initial.workspace.role)}</dd></div></dl> : <form className="mt-5 grid max-w-[620px] gap-4 border-t border-lt-100 pt-5" onSubmit={renameWorkspace}><Field id="workspace-settings-name" name="name" label="Workspace name" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} minLength={2} maxLength={80} required/><div className="flex gap-2"><Button type="submit" size="sm" disabled={pending !== null}>{pending === 'rename' ? 'Saving…' : 'Save name'}</Button><Button type="button" variant="ghost" size="sm" onClick={() => { setWorkspaceName(initial.workspace.name); setNameEditing(false) }} disabled={pending !== null}>Cancel</Button></div></form>}
    </section>

    <section className="rounded-[17px] border border-lt-200 bg-white p-[23px]">
      <header className="flex items-start gap-3 border-b border-lt-100 pb-5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lt-100 text-brand"><UsersRound size={20}/></span><div><h2 className="m-0 text-[1.08rem] text-lt-900">Workspace members</h2><p className="mt-1 mb-0 text-[.8rem] leading-[1.5] text-lt-500">Everyone can manage shared contacts, deals, follow-ups, research, and briefs.</p></div></header>
      {initial.workspace.isAdmin && <form className="mt-5 grid grid-cols-[minmax(220px,1fr)_180px_auto] items-end gap-3 rounded-[14px] border border-lt-200 bg-lt-50/60 p-4 max-[720px]:grid-cols-1" onSubmit={inviteMember}><Field id="workspace-invite-email" name="email" type="email" label="Invite by email" placeholder="teammate@company.com" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} required/><label className="grid gap-2 text-[.78rem] font-medium text-lt-800">Access<select className="h-12 rounded-control border border-lt-200 bg-white px-3 text-[.88rem] text-lt-900 outline-none focus:border-brand" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as 'member' | 'admin')}><option value="member">Member</option><option value="admin">Admin</option></select></label><Button type="submit" disabled={pending !== null || !inviteEmail.trim()}><MailPlus size={17}/>{pending === 'invite' ? 'Sending…' : 'Send invite'}</Button></form>}
      {!initial.workspace.isAdmin && <div className="mt-5"><FormMessage>Ask a workspace admin to invite another teammate.</FormMessage></div>}
      <div className="mt-5 divide-y divide-lt-100 rounded-[14px] border border-lt-200">
        {initial.members.map((member) => <div key={member.id} className="flex items-center gap-3 px-4 py-3.5"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-lt-100 text-[.72rem] font-bold text-lt-900">{initials(member.user.name) || <UserRound size={16}/>}</span><div className="min-w-0 flex-1"><strong className="block truncate text-[.84rem] text-lt-900">{member.user.name}</strong><span className="block truncate text-[.74rem] text-lt-500">{member.user.email}</span></div>{initial.workspace.isAdmin && member.role !== 'owner' && member.user.id !== initial.currentUserId ? <select className="h-9 rounded-control border border-lt-200 bg-white px-2.5 text-[.74rem] font-semibold text-lt-800 outline-none focus:border-brand" value={member.role === 'admin' ? 'admin' : 'member'} onChange={(event) => updateMemberRole(member.id, event.target.value as 'member' | 'admin')} disabled={pending !== null} aria-label={`Change access for ${member.user.name}`}><option value="member">Member</option><option value="admin">Admin</option></select> : <span className={member.role === 'owner' || member.role === 'admin' ? 'inline-flex items-center gap-1.5 rounded-full bg-lt-100 px-2.5 py-1 text-[.69rem] font-semibold text-brand' : 'rounded-full bg-lt-50 px-2.5 py-1 text-[.69rem] font-semibold text-lt-600'}>{(member.role === 'owner' || member.role === 'admin') && <ShieldCheck size={12}/>} {roleLabel(member.role)}</span>}</div>)}
      </div>
      {initial.workspace.isAdmin && initial.invitations.length > 0 && <div className="mt-5"><h3 className="m-0 text-[.78rem] font-semibold tracking-[.06em] text-lt-500 uppercase">Pending invitations</h3><div className="mt-2 divide-y divide-lt-100 rounded-[14px] border border-lt-200">{initial.invitations.map((invitation) => <div key={invitation.id} className="flex items-center gap-3 px-4 py-3"><MailPlus size={16} className="shrink-0 text-brand"/><span className="min-w-0 flex-1 truncate text-[.8rem] text-lt-800">{invitation.email}</span><span className="text-[.72rem] font-semibold text-lt-500">{roleLabel(invitation.role || 'member')}</span><Button type="button" variant="ghost" size="xs" onClick={() => cancelInvitation(invitation.id)} disabled={pending !== null}>{pending === `cancel-${invitation.id}` ? 'Cancelling…' : 'Cancel'}</Button></div>)}</div></div>}
    </section>

    {initial.workspace.isAdmin && <section className="rounded-[17px] border border-danger/25 bg-white p-[23px]"><header className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff3f4] text-danger"><Trash2 size={19}/></span><div><h2 className="m-0 text-[1.08rem] text-lt-900">Workspace danger zone</h2><p className="mt-1 mb-0 text-[.8rem] leading-[1.5] text-lt-500">Only workspace admins can perform these permanent actions.</p></div></header><div className="mt-5 grid gap-4 border-t border-lt-100 pt-5">
      <form className="grid gap-3 rounded-[14px] border border-lt-200 p-4" onSubmit={deleteBriefs}><div><h3 className="m-0 text-[.9rem] text-lt-900">Delete all Deal Briefs</h3><p className="mt-1 mb-0 text-[.76rem] leading-[1.5] text-lt-500">Removes generated briefs while keeping runs, sources, and evidence.</p></div><Field id="workspace-delete-briefs" name="confirmation" label="Type DELETE BRIEFS to confirm" value={briefConfirmation} onChange={(event) => setBriefConfirmation(event.target.value)} required/><div><Button type="submit" variant="danger" size="xs" disabled={pending !== null || briefConfirmation !== 'DELETE BRIEFS'}>Delete Deal Briefs</Button></div></form>
      <form className="grid gap-3 rounded-[14px] border border-danger/25 p-4" onSubmit={wipeResearchData}><div><h3 className="m-0 text-[.9rem] text-lt-900">Wipe workspace research data</h3><p className="mt-1 mb-0 text-[.76rem] leading-[1.5] text-lt-500">Deletes offers, runs, sources, evidence, briefs, and research notifications. Contacts, deals, notes, follow-ups, meetings, and members remain.</p></div><Field id="workspace-wipe-data" name="confirmation" label={`Type ${initial.workspace.name} to confirm`} value={wipeConfirmation} onChange={(event) => setWipeConfirmation(event.target.value)} required/><div><Button type="submit" variant="danger" size="xs" disabled={pending !== null || wipeConfirmation !== initial.workspace.name}>Wipe research data</Button></div></form>
      {initial.workspace.role === 'owner' && <form className="grid gap-3 rounded-[14px] border border-danger/25 p-4" onSubmit={deleteWorkspace}><div><h3 className="m-0 text-[.9rem] text-lt-900">Delete workspace</h3><p className="mt-1 mb-0 text-[.76rem] leading-[1.5] text-lt-500">Deletes this workspace, every membership, invitation, and all shared research data. This cannot be undone.</p></div><Field id="workspace-delete" name="confirmation" label={`Type ${initial.workspace.name} to confirm`} value={workspaceConfirmation} onChange={(event) => setWorkspaceConfirmation(event.target.value)} required/><div><Button type="submit" variant="danger" size="xs" disabled={pending !== null || workspaceConfirmation !== initial.workspace.name}>{pending === 'delete-workspace' ? 'Deleting…' : 'Delete workspace'}</Button></div></form>}
    </div></section>}
  </div>
}
