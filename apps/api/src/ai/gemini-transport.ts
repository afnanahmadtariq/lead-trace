import * as http from 'node:http'
import * as https from 'node:https'

// Use Node's HTTPS client for Gemini; keep normal TLS certificate validation.
// Bound response size as well as request duration before trying the fallback.
export function geminiRequest(url: string, options: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const transport = new URL(url).protocol === 'https:' ? https : http
    const body = String(options.body ?? '')
    const headers = Object.fromEntries(new Headers(options.headers).entries())
    headers['content-length'] = String(Buffer.byteLength(body))
    const request = transport.request(url, {
      method: 'POST', headers, signal: options.signal ?? undefined,
    }, (response) => {
      const chunks: Buffer[] = []
      let size = 0
      response.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > 1024 * 1024) { request.destroy(new Error('Model response exceeds the size limit')); return }
        chunks.push(chunk)
      })
      response.on('error', reject)
      response.on('aborted', () => reject(new Error('Model response was interrupted')))
      response.on('end', () => {
        const value = Buffer.concat(chunks)
        resolve(new Response(value.length ? value : null, { status: response.statusCode ?? 502 }))
      })
    })
    request.on('error', reject)
    request.end(body)
  })
}
