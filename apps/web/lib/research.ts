export interface ResearchRunSummary {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  goal: 'outreach' | 'meeting'
  requestedAt: string
  startedAt?: string | null
  completedAt?: string | null
  errorMessage?: string | null
  prospect: {
    id?: string
    name: string
    companyName?: string | null
    companyDomain?: string | null
    email?: string | null
    linkedinUrl?: string | null
    xHandle?: string | null
  }
  offer: { name: string; valueProposition: string; targetPersona?: string | null }
  brief?: {
    id: string
    title: string
    status: string
    updatedAt: string
    sections?: unknown
  } | null
  _count?: { evidence: number; sources: number }
}

export interface ResearchRunDetail extends ResearchRunSummary {
  sources: EvidenceSource[]
  evidence: ResearchEvidenceItem[]
  brief?: DealBriefSummary | null
}

export interface EvidenceSource {
  id: string
  title: string
  url: string
  publisher?: string | null
  sourceType: string
  excerpt?: string | null
  publishedAt?: string | null
  retrievedAt: string
}

export interface ResearchEvidenceItem {
  id: string
  claim: string
  signalType: string
  confidence: number
  observedAt?: string | null
  source: { title: string; url: string; publisher?: string | null }
}

export interface EvidenceLibraryResponse {
  sources: Array<EvidenceSource & {
    _count: { evidence: number }
    researchRun: {
      id: string
      goal: string
      prospect: { name: string; companyName?: string | null }
      offer: { name: string }
    }
  }>
  evidence: Array<{
    id: string
    claim: string
    signalType: string
    confidence: number
    observedAt?: string | null
    createdAt: string
    source: { title: string; url: string; publisher?: string | null }
    researchRun: {
      id: string
      prospect: { name: string; companyName?: string | null }
      offer: { name: string }
    }
  }>
}

export interface DealBriefSummary {
  id: string
  title: string
  status: string
  generatedAt?: string
  updatedAt: string
  sections?: unknown
  researchRun?: {
    id: string
    goal: string
    prospect: { name: string; companyName?: string | null }
    offer: { name: string }
    _count: { evidence: number; sources: number }
  }
}

export interface DealBriefDetail extends Omit<DealBriefSummary, 'researchRun'> {
  sections: unknown
  previousSections?: unknown | null
  share?: { token: string; createdAt: string; revokedAt?: string | null } | null
  researchRun: {
    id: string
    goal: 'outreach' | 'meeting'
    prospect: ResearchRunSummary['prospect']
    offer: ResearchRunSummary['offer']
    evidence: ResearchEvidenceItem[]
  }
}

export interface InsightNotification {
  id: string
  type: string
  title: string
  body: string
  readAt?: string | null
  createdAt: string
  researchRun?: { id: string; prospect: { name: string } } | null
}

export interface IntegrationCapabilities {
  webDiscovery: {
    provider: string
    status: 'configured' | 'keyless'
    searchDepth: string
    maxResults: number
  }
  stages: Array<{ id: string; label: string; status: 'ready' | 'next' | 'planned' }>
}
