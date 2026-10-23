// Browsers treat "/\host" and "/<tab>/host" like "//host", so a bare startsWith('/') check is an open redirect.
export function safeAuthPath(path: unknown): string {
  if (typeof path !== 'string' || !path.startsWith('/') || path[1] === '/' || path[1] === '\\' || /[\s\\\x00-\x1f]/.test(path)) return '/auth/continue'
  try {
    return new URL(path, 'http://x').origin === 'http://x' ? path : '/auth/continue'
  } catch {
    return '/auth/continue'
  }
}
