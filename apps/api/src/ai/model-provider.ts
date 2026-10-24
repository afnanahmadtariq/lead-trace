import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common'
import { geminiRequest } from './gemini-transport'
type Settings = { get<T = string>(key: string): T | undefined }
type Provider = { name: 'gemini' | 'dashscope'; apiKey: string; baseUrl: string; model: string }
type Message = { role: string; content: string }
type ModelTransport = (url: string, options: RequestInit, provider: Provider['name']) => Promise<Response>
const modelTransport: ModelTransport = (url, options, provider) => provider === 'gemini' ? geminiRequest(url, options) : fetch(url, options)

function providerMessages(provider: Provider['name'], messages: Message[]): Message[] {
  if (provider !== 'gemini') return messages
  // Gemini has one system instruction. Preserve the schema and every constraint
  // when an application request contains more than one OpenAI system message.
  const system = messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n\n')
  return [...(system ? [{ role: 'system', content: system }] : []), ...messages.filter((message) => message.role !== 'system')]
}

export function modelProviderOrder(config: Settings) {
  const order = (config.get<string>('LLM_PROVIDER_ORDER')?.trim() || (config.get<string>('NODE_ENV') === 'production' ? 'gemini,dashscope' : 'dashscope'))
    .split(',').map((name) => name.trim())
  if (!order.length || new Set(order).size !== order.length || order.some((name) => !['gemini', 'dashscope'].includes(name))) {
    throw new Error('LLM_PROVIDER_ORDER must contain gemini and/or dashscope once each, in priority order')
  }
  return order as Provider['name'][]
}

export function configuredModelProviders(config: Settings): Provider[] {
  return modelProviderOrder(config).flatMap((name) => {
    const prefix = name.toUpperCase()
    const apiKey = config.get<string>(`${prefix}_API_KEY`)?.trim()
    if (!apiKey) return []
    const baseUrl = (config.get<string>(`${prefix}_BASE_URL`)?.trim() || (name === 'gemini'
      ? 'https://generativelanguage.googleapis.com/v1beta/openai'
      : 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1')).replace(/\/+$/, '')
    const model = config.get<string>(`${prefix}_MODEL`)?.trim() || (name === 'gemini' ? 'gemini-3.5-flash-lite' : 'qwen3.7-plus')
    return [{ name, apiKey, baseUrl, model }]
  })
}

// Keep provider credentials and error payloads out of user-facing errors. A valid
// empty result is a success; only a failed request or malformed response fails over.
export async function requestModelJson<T>(config: Settings, input: { messages: Message[]; maxTokens: number; timeoutMs: number }, decode: (payload: unknown) => T, transport: ModelTransport = modelTransport): Promise<T> {
  const providers = configuredModelProviders(config)
  if (!providers.length) throw new ServiceUnavailableException('Configure an enabled model provider before generating leads')
  let quota = false, access = false
  for (const provider of providers) {
    try {
      const response = await transport(`${provider.baseUrl}/chat/completions`, {
        method: 'POST', signal: AbortSignal.timeout(input.timeoutMs),
        headers: { Authorization: `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: provider.model, temperature: 0, max_tokens: input.maxTokens,
          response_format: { type: 'json_object' }, messages: providerMessages(provider.name, input.messages),
          ...(provider.name === 'dashscope' ? { enable_thinking: false } : { reasoning_effort: 'low' }),
        }),
      }, provider.name)
      if (!response.ok) {
        const failure = await response.json().catch(() => null) as { error?: { code?: string; type?: string } } | null
        quota ||= [failure?.error?.code, failure?.error?.type].includes('insufficient_quota') || response.status === 429
        access ||= response.status === 401 || response.status === 403
        continue
      }
      const payload = await response.json() as { choices?: { message?: { content?: string } }[] }
      const value: unknown = JSON.parse(payload.choices?.[0]?.message?.content || '')
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue
      return decode(value)
    } catch { /* The next configured provider can serve this same request. */ }
  }
  if (quota) throw new ServiceUnavailableException('The model provider quota is exhausted. Restore its quota before retrying lead generation.')
  if (access) throw new ServiceUnavailableException('The model provider rejected access. Check its credentials and model access before retrying.')
  throw new BadGatewayException('Lead extraction is temporarily unavailable or returned invalid structured output. Check the model provider configuration and retry.')
}
