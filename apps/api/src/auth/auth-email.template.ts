export type AuthEmailKind = 'verification' | 'password-reset' | 'two-factor' | 'email-change' | 'account-deletion' | 'security-change' | 'workspace-invitation'

interface AuthEmailInput {
  kind: AuthEmailKind
  title: string
  message: string
  actionUrl?: string
  actionLabel?: string
  code?: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function renderAuthEmail(input: AuthEmailInput) {
  const action = input.actionUrl
    ? `<a href="${escapeHtml(input.actionUrl)}" style="background:#1768c7;border-radius:12px;color:#fff;display:inline-block;font-size:16px;font-weight:700;padding:14px 22px;text-decoration:none;">${escapeHtml(input.actionLabel ?? 'Continue')}</a>`
    : ''
  const code = input.code
    ? `<div style="background:#f1f7fd;border:1px solid #dceafa;border-radius:12px;color:#123d8e;font-size:30px;font-weight:800;letter-spacing:.22em;margin:8px 0 24px;padding:18px;text-align:center;">${escapeHtml(input.code)}</div>`
    : ''
  const plainAction = input.actionUrl ? `\n\n${input.actionLabel ?? 'Continue'}: ${input.actionUrl}` : ''
  const plainCode = input.code ? `\n\nYour code: ${input.code}` : ''

  return {
    subject: `[Lead Trace] ${input.title}`,
    text: `${input.title}\n\n${input.message}${plainCode}${plainAction}\n\nIf you did not request this, you can safely ignore this email.`,
    html: `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="background:#f8fbff;color:#10264f;font-family:Arial,Helvetica,sans-serif;margin:0;padding:32px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#fff;border:1px solid #dceafa;border-radius:18px;max-width:580px;overflow:hidden;">
        <tr><td style="background:#12346f;border-top:6px solid #49bcf7;color:#fff;font-size:23px;font-weight:800;letter-spacing:-.04em;padding:22px 30px;">Lead Trace</td></tr>
        <tr><td style="padding:34px 30px 10px;"><p style="color:#168ce5;font-size:12px;font-weight:800;letter-spacing:.12em;margin:0;text-transform:uppercase;">Secure workspace</p></td></tr>
        <tr><td style="padding:0 30px 12px;"><h1 style="font-size:28px;letter-spacing:-.035em;line-height:1.2;margin:0;">${escapeHtml(input.title)}</h1></td></tr>
        <tr><td style="color:#617798;font-size:16px;line-height:1.6;padding:0 30px 24px;"><p style="margin:0;">${escapeHtml(input.message)}</p></td></tr>
        ${input.code ? `<tr><td style="padding:0 30px;">${code}</td></tr>` : ''}
        ${input.actionUrl ? `<tr><td style="padding:0 30px 34px;">${action}</td></tr>` : ''}
        <tr><td style="background:#f1f7fd;border-top:1px solid #dceafa;color:#7185a5;font-size:13px;line-height:1.5;padding:20px 30px;">If you did not request this, you can safely ignore this email.</td></tr>
      </table>
    </td></tr></table>
  </body>
</html>`,
    tag: input.kind,
  }
}
