import type { CreateLeadSearchDto } from './leads.dto'
import type { LeadSourceInput } from './lead-discovery'

export type LeadCriteria = Pick<CreateLeadSearchDto, 'industry' | 'role' | 'location' | 'keywords' | 'roleMatch'>
export type RegistryRecord = { provider: string; id: string; name: string; url: string; status: string; city: string; country: string; scope: string }
export type CompanyTarget = { name: string; domain: string | null; sourceId: string; quote: string; registries: RegistryRecord[] }
export type ProviderActivity = { provider: string; operation: string; requests: number; records: number; credits: number | null; status: 'ok' | 'partial' | 'unavailable'; message?: string }
export type DiscoveryProgress = { phase: string; message: string; sources: number; companies: number; queries: number }
export type DiscoverySnapshot = { sources: LeadSourceInput[]; companies: CompanyTarget[]; activity: ProviderActivity[]; queries: { kind: string; query: string }[]; failedQueries: number }
export type ProgressCallback = (progress: DiscoveryProgress) => Promise<void>
