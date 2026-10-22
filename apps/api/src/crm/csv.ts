import { BadRequestException } from '@nestjs/common'

// RFC 4180 fields: quoted delimiters/newlines, doubled quotes, and UTF-8 BOM.
export function parseContactsCsv(input: string) {
  const rows: string[][] = []
  let row: string[] = [], field = '', quoted = false, closed = false
  const source = input.replace(/^\uFEFF/, '')
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') { field += '"'; i++ } else { quoted = false; closed = true }
      } else field += char
    } else if (char === '"' && !field && !closed) quoted = true
    else if (char === ',' || char === '\n' || char === '\r') {
      row.push(field.trim()); field = ''; closed = false
      if (char !== ',') {
        if (char === '\r' && source[i + 1] === '\n') i++
        if (row.some(Boolean)) rows.push(row)
        row = []
      }
    } else {
      if (closed || char === '"') throw new BadRequestException('Malformed CSV quoting')
      field += char
    }
  }
  if (quoted) throw new BadRequestException('Unclosed CSV quote')
  row.push(field.trim()); if (row.some(Boolean)) rows.push(row)
  const headers = rows.shift()?.map((item) => item.toLowerCase()) ?? []
  const allowed = ['name', 'email', 'company', 'domain', 'title', 'phone']
  if (!headers.includes('name') || new Set(headers).size !== headers.length || headers.some((key) => !allowed.includes(key))) {
    throw new BadRequestException('CSV requires name; optional columns: email, company, domain, title, phone')
  }
  if (!rows.length || rows.length > 500) throw new BadRequestException('Import between 1 and 500 contacts at a time')
  return rows.map((values, index) => {
    if (values.length !== headers.length) throw new BadRequestException(`CSV row ${index + 2} has the wrong number of columns`)
    return Object.fromEntries(headers.map((key, i) => [key, values[i]!]))
  })
}

export function contactsCsv(rows: Record<string, unknown>[]) {
  const fields = ['name', 'email', 'companyName', 'companyDomain', 'jobTitle', 'phone']
  const escape = (value: unknown) => {
    const text = String(value ?? '')
    // Neutralize spreadsheet formulas, including whitespace-prefixed payloads.
    const safe = /^[\s]*[=+@\-\t\r]/.test(text) ? `'${text}` : text
    return `"${safe.replace(/"/g, '""')}"`
  }
  return ['name,email,company,domain,title,phone', ...rows.map((row) => fields.map((key) => escape(row[key])).join(','))].join('\r\n')
}
