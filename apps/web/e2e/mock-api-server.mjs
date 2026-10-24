import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { handleCrm, crmResearchContact } from './crm-mock.mjs'
import { e2eFixtures } from './fixtures.mjs'

const PORT = Number(process.env.E2E_API_PORT || 3001)
const SESSION_COOKIE = 'lead-trace.session_token'
const WEB_ORIGIN = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${process.env.E2E_WEB_PORT || 3000}`

const corsHeaders = {
  'Access-Control-Allow-Origin': WEB_ORIGIN,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const state = { sessions: new Map(), runs: new Map(), pollCounts: new Map(), shares: new Map() }
const leadSearchFixture = {
  id: 'header-lead-search', title: 'London SaaS sales leaders', role: 'Head of sales', industry: 'B2B SaaS', location: 'London, United Kingdom', keywords: 'Growing sales teams',
  status: 'completed', errorMessage: null, createdAt: new Date().toISOString(), lockExpiresAt: null, attemptCount: 1, failedQueries: 0, rejectedCandidates: 0,
  sources: [], candidates: [], _count: { sources: 0, candidates: 0 },
}

function json(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders, ...headers })
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try { resolve(JSON.parse(raw)) } catch (error) { reject(error) }
    })
    req.on('error', reject)
  })
}

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || '').split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
      const index = part.indexOf('=')
      return index === -1 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))]
    }),
  )
}

function sessionFromRequest(req) {
  const token = parseCookies(req)[SESSION_COOKIE]
  return token ? state.sessions.get(token) || null : null
}

function setSessionCookie(token) {
  return [`${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`]
}

function userPayload() {
  return {
    id: 'e2e-user-id',
    name: e2eFixtures.user.name,
    email: e2eFixtures.user.email,
    emailVerified: true,
    image: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    twoFactorEnabled: false,
  }
}

function accountContext() {
  const workspace = { ...e2eFixtures.workspace, logo: null }
  return {
    user: { ...userPayload(), authenticatorAppEnabled: false, hasPassword: true },
    accountDeletion: { soleWorkspaceNames: [] },
    workspaces: [workspace],
    activeWorkspace: workspace,
    requirements: { requiresOnboarding: false, requiresWorkspaceSelection: false, requiresTwoFactorChallenge: false },
    destination: '/dashboard',
  }
}

function sourceForRun(runId) {
  return {
    id: `${runId}-source`,
    url: e2eFixtures.citation.url,
    title: e2eFixtures.citation.title,
    publisher: e2eFixtures.citation.publisher,
    sourceType: e2eFixtures.citation.sourceType,
    excerpt: e2eFixtures.citation.claim,
    publishedAt: null,
    retrievedAt: new Date().toISOString(),
  }
}

function evidenceForRun(runId) {
  const source = sourceForRun(runId)
  return [{
    id: `${runId}-evidence`,
    claim: e2eFixtures.citation.claim,
    signalType: e2eFixtures.citation.signalType,
    confidence: 0.91,
    observedAt: new Date().toISOString(),
    source,
  }, {
    id: `${runId}-uncited`, claim: 'An unrelated historical company fact.', signalType: 'other', confidence: 0.99, observedAt: '2020-01-01T00:00:00.000Z', source,
  }]
}

function briefSectionsForRun(run) {
  const evidence = evidenceForRun(run.id)[0]
  const refreshNote = run.refreshVersion ? ' The refreshed brief confirms this remains the strongest available signal.' : ''
  return {
    summary: `${evidence.claim} Use this verified signal to test the prospect's current priority before positioning the offer.${refreshNote}`,
    personalized_opener: `${run.prospect.name.split(' ')[0]}, I noticed the latest signal at ${run.prospect.companyName}. How is that shaping priorities right now?`,
    talking_points: ['Lead with the verified signal, then validate whether it maps to an active priority.'],
    questions_to_ask: ['What changed recently that made this conversation worth having?'],
    objection_handling: ['If timing is tight: agree on the event that would make this urgent.'],
    outreach_draft: 'Hello, could we compare your current priorities with our approach?',
    gaps: ['Current budget has not been established.'],
    next_steps: ['Confirm one priority and the right owner for a focused follow-up.'],
    urgency_score: 0.72,
    urgency_label: 'High urgency',
    conversation_angles: [{ evidence_id: evidence.id, why_it_matters: 'This may provide context for the offer, but the prospect’s priorities need confirmation.', question: 'Which current priority would make this approach worth evaluating?' }],
    key_signals: [{
      evidence_id: evidence.id,
      claim: evidence.claim,
      source_url: evidence.source.url,
      signal_type: evidence.signalType,
    }],
  }
}

function runDetail(run, phase) {
  const briefAvailable = phase === 'completed' || Boolean(run.refreshVersion)
  return {
    id: run.id,
    status: phase === 'completed' ? 'completed' : 'running',
    goal: run.goal,
    requestedAt: run.requestedAt,
    startedAt: run.requestedAt,
    completedAt: phase === 'completed' ? new Date().toISOString() : null,
    errorMessage: null,
    prospect: run.prospect,
    offer: run.offer,
    sources: phase === 'queued' ? [] : [sourceForRun(run.id)],
    evidence: phase === 'completed' ? evidenceForRun(run.id) : [],
    brief: briefAvailable ? {
      id: `${run.id}-brief`,
      title: `Deal brief · ${run.prospect.name}`,
      status: phase === 'completed' ? 'ready' : 'refreshing',
      updatedAt: new Date().toISOString(),
      sections: briefSectionsForRun(run),
    } : null,
  }
}

function createSession(activeOrganizationId = e2eFixtures.workspace.id) {
  const token = randomUUID()
  state.sessions.set(token, {
    activeOrganizationId,
    notifications: [
      { id: randomUUID(), type: 'brief_ready', title: 'Brief ready', body: 'Your brief is ready to review.', readAt: null, createdAt: new Date().toISOString(), researchRun: null },
      { id: randomUUID(), type: 'research_update', title: 'Research updated', body: 'New evidence was found.', readAt: new Date().toISOString(), createdAt: new Date().toISOString(), researchRun: null },
    ],
  })
  return token
}

function ensureAuthenticated(req, res) {
  const session = sessionFromRequest(req)
  if (!session) { json(res, 401, { message: 'Unauthorized' }); return null }
  return session
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`)
  const { pathname } = url

  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders)
      return res.end()
    }
    if (pathname.startsWith('/crm/')) {
      if (!ensureAuthenticated(req, res)) return
      return handleCrm({ req, res, pathname, url, json, readBody, runs: state.runs, webOrigin: WEB_ORIGIN })
    }
    if (req.method === 'GET' && ['/leads/capabilities', '/leads/searches', `/leads/searches/${leadSearchFixture.id}`, '/evidence'].includes(pathname)) {
      if (!ensureAuthenticated(req, res)) return
      if (pathname === '/leads/capabilities') return json(res, 200, { discoveryConfigured: true, extractionConfigured: true, maxCandidates: 30, queriesPerSearch: 6, publicRegistries: [] })
      if (pathname === '/leads/searches') return json(res, 200, { items: [leadSearchFixture], total: 1, page: 1, pageSize: 20 })
      if (pathname === '/evidence') return json(res, 200, { sources: [], evidence: [] })
      return json(res, 200, leadSearchFixture)
    }
    if (pathname === '/integrations') {
      if (!ensureAuthenticated(req, res)) return
      return json(res, 200, { webDiscovery: { provider: 'Tavily', status: 'configured', searchDepth: 'advanced', maxResults: 6 }, stages: [] })
    }
    if (req.method === 'GET' && pathname === '/health') return json(res, 200, { status: 'ok' })
    if (req.method === 'GET' && pathname === '/auth-config') return json(res, 200, { googleEnabled: false })
    if (req.method === 'GET' && pathname === '/notifications') {
      const session = ensureAuthenticated(req, res)
      if (!session) return
      return json(res, 200, session.notifications)
    }
    if (req.method === 'DELETE' && pathname === '/notifications') {
      const session = ensureAuthenticated(req, res)
      if (!session) return
      const cleared = session.notifications.length
      session.notifications = []
      return json(res, 200, { cleared })
    }
    if (req.method === 'GET' && pathname === '/account-context') {
      if (!ensureAuthenticated(req, res)) return
      return json(res, 200, accountContext())
    }
    if (req.method === 'GET' && pathname === '/workspace-settings') {
      if (!ensureAuthenticated(req, res)) return
      return json(res, 200, {
        currentUserId: 'e2e-user-id',
        workspace: { ...e2eFixtures.workspace, isAdmin: true },
        members: [{
          id: 'e2e-member-id',
          role: 'owner',
          joinedAt: new Date().toISOString(),
          user: { id: 'e2e-user-id', name: e2eFixtures.user.name, email: e2eFixtures.user.email, image: null },
        }],
        invitations: [],
      })
    }
    if (req.method === 'GET' && pathname === '/research-runs') {
      if (!ensureAuthenticated(req, res)) return
      return json(res, 200, [...state.runs.values()].map((run) => ({
        ...runDetail(run, run.status === 'completed' ? 'completed' : 'running'),
        _count: { sources: 1, evidence: run.status === 'completed' ? 1 : 0 },
      })))
    }

    if (pathname.startsWith('/api/auth/')) {
      const body = ['POST', 'PUT', 'PATCH'].includes(req.method || '') ? await readBody(req) : {}
      if (req.method === 'POST' && pathname === '/api/auth/sign-in/email') {
        if (body.email !== e2eFixtures.user.email || body.password !== e2eFixtures.user.password) {
          return json(res, 401, { message: 'Invalid email or password' })
        }
        const token = createSession()
        return json(res, 200, { token, user: userPayload(), redirect: false }, { 'Set-Cookie': setSessionCookie(token) })
      }
      if ((req.method === 'GET' || req.method === 'POST') && pathname === '/api/auth/get-session') {
        const session = sessionFromRequest(req)
        if (!session) return json(res, 200, null)
        return json(res, 200, {
          session: {
            id: 'e2e-session-id',
            token: 'e2e-session-token',
            userId: 'e2e-user-id',
            activeOrganizationId: session.activeOrganizationId,
            expiresAt: new Date(Date.now() + 14 * 86400000).toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          user: userPayload(),
        })
      }
      if (req.method === 'POST' && pathname === '/api/auth/sign-out') {
        return json(res, 200, { success: true }, { 'Set-Cookie': `${SESSION_COOKIE}=; Path=/; Max-Age=0` })
      }
      if (req.method === 'POST' && pathname === '/api/auth/send-verification-email') {
        return json(res, 200, { status: true })
      }
      return json(res, 404, { message: `Unhandled auth route ${pathname}` })
    }

    if (req.method === 'POST' && pathname === '/research-runs') {
      if (!ensureAuthenticated(req, res)) return
      const body = await readBody(req)
      const id = randomUUID()
      const run = {
        id,
        status: 'running',
        goal: body.goal || 'meeting',
        requestedAt: new Date().toISOString(),
        prospect: crmResearchContact(body),
        offer: {
          name: body.offerName,
          valueProposition: body.offerContext,
          targetPersona: body.targetPersona || null,
        },
        refreshVersion: 0,
        briefPolls: 0,
        previousSections: null,
      }
      state.runs.set(id, run)
      state.pollCounts.set(id, 0)
      return json(res, 201, runDetail(run, 'running'))
    }

    if (req.method === 'POST' && pathname.startsWith('/research-runs/') && pathname.endsWith('/refresh')) {
      if (!ensureAuthenticated(req, res)) return
      const id = pathname.split('/')[2]
      const run = state.runs.get(id)
      if (!run) return json(res, 404, { message: 'Research run not found' })
      if (run.status !== 'completed') return json(res, 409, { message: `Research run cannot be refreshed while ${run.status}` })
      run.previousSections = briefSectionsForRun(run)
      run.refreshVersion += 1
      run.briefPolls = 0
      run.status = 'running'
      return json(res, 200, runDetail(run, 'running'))
    }

    if (req.method === 'GET' && pathname.startsWith('/research-runs/')) {
      if (!ensureAuthenticated(req, res)) return
      const id = pathname.split('/')[2]
      const run = state.runs.get(id)
      if (!run) return json(res, 404, { message: 'Research run not found' })
      const polls = (state.pollCounts.get(id) || 0) + 1
      state.pollCounts.set(id, polls)
      const phase = polls >= (run.refreshVersion ? 2 : 1) ? 'completed' : 'running'
      run.status = phase
      return json(res, 200, runDetail(run, phase))
    }

    if (req.method === 'POST' && /^\/deal-briefs\/[^/]+\/share$/.test(pathname)) {
      if (!ensureAuthenticated(req, res)) return
      const briefId = pathname.split('/')[2]
      const run = [...state.runs.values()].find((item) => `${item.id}-brief` === briefId)
      if (!run) return json(res, 404, { message: 'Deal brief not found' })
      const existing = [...state.shares.entries()].find(([, value]) => value.briefId === briefId && !value.revoked)
      if (existing) return json(res, 200, { token: existing[0] })
      const token = randomUUID().replaceAll('-', '')
      state.shares.set(token, { briefId, sharedAt: new Date().toISOString(), revoked: false })
      return json(res, 201, { token })
    }

    if (req.method === 'DELETE' && /^\/deal-briefs\/[^/]+\/share$/.test(pathname)) {
      if (!ensureAuthenticated(req, res)) return
      const briefId = pathname.split('/')[2]
      const share = [...state.shares.values()].find((value) => value.briefId === briefId && !value.revoked)
      if (share) share.revoked = true
      return json(res, 200, { revoked: Boolean(share) })
    }

    if (req.method === 'GET' && pathname.startsWith('/shared/briefs/')) {
      const token = pathname.split('/')[3]
      const share = state.shares.get(token)
      if (!share) return json(res, 404, { message: 'Shared brief not found' })
      if (share.revoked) return json(res, 410, { message: 'Shared brief link revoked' })
      const run = [...state.runs.values()].find((item) => `${item.id}-brief` === share.briefId)
      if (!run) return json(res, 404, { message: 'Shared brief not found' })
      const detail = runDetail(run, 'completed')
      return json(res, 200, {
        id: share.briefId,
        title: `Deal brief · ${run.prospect.name}`,
        status: 'ready',
        generatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sharedAt: share.sharedAt,
        sections: briefSectionsForRun(run),
        previousSections: run.previousSections,
        researchRun: { id: detail.id, goal: detail.goal, prospect: detail.prospect, offer: detail.offer, evidence: evidenceForRun(run.id) },
      })
    }

    if (req.method === 'GET' && /^\/deal-briefs\/[^/]+$/.test(pathname)) {
      if (!ensureAuthenticated(req, res)) return
      const briefId = pathname.split('/')[2]
      const run = [...state.runs.values()].find((item) => `${item.id}-brief` === briefId)
      if (!run) return json(res, 404, { message: 'Deal brief not found' })
      if (run.status === 'running' && run.refreshVersion) {
        run.briefPolls += 1
        if (run.briefPolls >= 2) run.status = 'completed'
      }
      const briefStatus = run.status === 'running' ? 'refreshing' : 'ready'
      const detail = runDetail(run, briefStatus === 'ready' ? 'completed' : 'running')
      const activeShare = [...state.shares.entries()].find(([, value]) => value.briefId === briefId && !value.revoked)
      return json(res, 200, {
        id: briefId,
        title: `Deal brief · ${run.prospect.name}`,
        status: briefStatus,
        generatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sections: briefStatus === 'refreshing' ? run.previousSections : briefSectionsForRun(run),
        previousSections: run.previousSections,
        share: activeShare ? { token: activeShare[0], createdAt: activeShare[1].sharedAt, revokedAt: null } : null,
        researchRun: {
          id: detail.id,
          goal: detail.goal,
          prospect: detail.prospect,
          offer: detail.offer,
          evidence: evidenceForRun(run.id),
        },
      })
    }

    if (req.method === 'GET' && pathname === '/deal-briefs') {
      if (!ensureAuthenticated(req, res)) return
      return json(res, 200, [])
    }

    return json(res, 404, { message: `Unhandled route ${req.method} ${pathname}` })
  } catch (error) {
    json(res, 500, { message: error instanceof Error ? error.message : 'Mock API failure' })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`e2e mock API listening on http://127.0.0.1:${PORT}\n`)
})
