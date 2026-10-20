const DEFAULT_WEB_URL = 'http://localhost:3000'
const DEFAULT_API_URL = 'http://localhost:3001'
const DEVELOPMENT_AUTH_SECRET = 'lead-trace-development-secret-change-before-production'
const EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/
const TAVILY_SEARCH_DEPTHS = ['basic', 'advanced', 'fast', 'ultra-fast'] as const

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function httpUrl(value: unknown, fallback: string, key: string) {
  const normalized = optionalString(value) ?? fallback
  const url = new URL(normalized)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${key} must use http or https`)
  return normalized.replace(/\/+$/, '')
}

function commaSeparatedUrls(value: unknown, fallback: string, key: string) {
  return (optionalString(value) ?? fallback)
    .split(',')
    .map((item) => httpUrl(item.trim(), item.trim(), key))
    .join(',')
}

function authConfiguration(config: Record<string, unknown>) {
  const production = config.NODE_ENV === 'production'
  const primaryDomain = optionalString(config.PRIMARY_DOMAIN)
  const apiDomain = optionalString(config.API_DOMAIN)
  const webOrigin = production && primaryDomain ? `https://${primaryDomain}` : DEFAULT_WEB_URL
  const apiOrigin = production && apiDomain ? `https://${apiDomain}` : DEFAULT_API_URL
  const secret = optionalString(config.BETTER_AUTH_SECRET) ?? (production ? '' : DEVELOPMENT_AUTH_SECRET)
  const googleClientId = optionalString(config.GOOGLE_CLIENT_ID)
  const googleClientSecret = optionalString(config.GOOGLE_CLIENT_SECRET)

  if (secret.length < 32 || secret.startsWith('replace-')) {
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 non-placeholder characters')
  }
  if (Boolean(googleClientId) !== Boolean(googleClientSecret)) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together')
  }

  return {
    BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: httpUrl(config.BETTER_AUTH_URL, apiOrigin, 'BETTER_AUTH_URL'),
    BETTER_AUTH_TRUSTED_ORIGINS: commaSeparatedUrls(config.BETTER_AUTH_TRUSTED_ORIGINS, webOrigin, 'BETTER_AUTH_TRUSTED_ORIGINS'),
    BETTER_AUTH_COOKIE_DOMAIN: optionalString(config.BETTER_AUTH_COOKIE_DOMAIN) ?? '',
    WEB_ORIGIN: commaSeparatedUrls(config.WEB_ORIGIN, webOrigin, 'WEB_ORIGIN'),
    GOOGLE_CLIENT_ID: googleClientId ?? '',
    GOOGLE_CLIENT_SECRET: googleClientSecret ?? '',
  }
}

function emailConfiguration(config: Record<string, unknown>) {
  const apiKey = optionalString(config.RESEND_API_KEY)
  const from = optionalString(config.RESEND_FROM_EMAIL) ?? 'Lead Trace <onboarding@resend.dev>'
  const address = from.match(/<([^<>]+)>$/)?.[1] ?? from
  if (apiKey && !apiKey.startsWith('re_')) throw new Error('RESEND_API_KEY must begin with re_')
  if (!EMAIL_PATTERN.test(address)) throw new Error('RESEND_FROM_EMAIL must contain a valid email address')
  if (config.NODE_ENV === 'production' && !apiKey) throw new Error('RESEND_API_KEY is required in production')
  return { RESEND_API_KEY: apiKey ?? '', RESEND_FROM_EMAIL: from }
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number, key: string) {
  const normalized = optionalString(value)
  const parsed = normalized === undefined ? fallback : Number(normalized)
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${key} must be an integer between ${minimum} and ${maximum}`)
  }
  return parsed
}

function tavilyConfiguration(config: Record<string, unknown>) {
  const apiKey = optionalString(config.TAVILY_API_KEY)
  const searchDepth = optionalString(config.TAVILY_SEARCH_DEPTH) ?? 'advanced'
  if (!TAVILY_SEARCH_DEPTHS.includes(searchDepth as (typeof TAVILY_SEARCH_DEPTHS)[number])) {
    throw new Error(`TAVILY_SEARCH_DEPTH must be one of ${TAVILY_SEARCH_DEPTHS.join(', ')}`)
  }
  if (apiKey?.startsWith('replace-')) throw new Error('TAVILY_API_KEY must not be a placeholder')

  return {
    TAVILY_API_KEY: apiKey ?? '',
    TAVILY_PROJECT_ID: optionalString(config.TAVILY_PROJECT_ID) ?? '',
    TAVILY_SEARCH_DEPTH: searchDepth,
    TAVILY_MAX_RESULTS: boundedInteger(config.TAVILY_MAX_RESULTS, 6, 1, 20, 'TAVILY_MAX_RESULTS'),
  }
}

export function validateEnvironment(config: Record<string, unknown>) {
  return { ...config, ...authConfiguration(config), ...emailConfiguration(config), ...tavilyConfiguration(config) }
}
