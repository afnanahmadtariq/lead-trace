export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null
    throw new ApiError(payload?.message || 'Lead Trace could not complete this request', response.status)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
