interface LaunchEmailInput {
  name?: string | null
  actionUrl: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function renderLaunchEmail(input: LaunchEmailInput) {
  const name = input.name?.trim()
  const greeting = name ? `Hi ${name},` : 'Hi there,'

  return {
    subject: 'Lead Trace is live — your account is ready',
    text: `${greeting}

You joined Lead Trace early, and the product is now live.

Create your workspace to turn live public signals into evidence-backed prospect research, personalized outreach, and meeting briefs.

Create your account: ${input.actionUrl}

Thank you for being early.

— The Lead Trace team

You received this one-time launch email because you signed up for Lead Trace updates.`,
    html: `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="background:#f8fbff;color:#10264f;font-family:Arial,Helvetica,sans-serif;margin:0;padding:32px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#fff;border:1px solid #dceafa;border-radius:18px;max-width:580px;overflow:hidden;">
        <tr><td style="background:#12346f;border-top:6px solid #49bcf7;color:#fff;font-size:23px;font-weight:800;letter-spacing:-.04em;padding:22px 30px;">Lead Trace</td></tr>
        <tr><td style="padding:34px 30px 10px;"><p style="color:#168ce5;font-size:12px;font-weight:800;letter-spacing:.12em;margin:0;text-transform:uppercase;">Now live</p></td></tr>
        <tr><td style="padding:0 30px 12px;"><h1 style="font-size:28px;letter-spacing:-.035em;line-height:1.2;margin:0;">Your early access is ready.</h1></td></tr>
        <tr><td style="color:#617798;font-size:16px;line-height:1.65;padding:0 30px 24px;">
          <p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
          <p style="margin:0 0 16px;">You joined Lead Trace early, and the product is now live.</p>
          <p style="margin:0;">Create your workspace to turn live public signals into evidence-backed prospect research, personalized outreach, and meeting briefs.</p>
        </td></tr>
        <tr><td style="padding:0 30px 34px;"><a href="${escapeHtml(input.actionUrl)}" style="background:#1768c7;border-radius:12px;color:#fff;display:inline-block;font-size:16px;font-weight:700;padding:14px 22px;text-decoration:none;">Create your account</a></td></tr>
        <tr><td style="background:#f1f7fd;border-top:1px solid #dceafa;color:#7185a5;font-size:13px;line-height:1.5;padding:20px 30px;">You received this one-time launch email because you signed up for Lead Trace updates.</td></tr>
      </table>
    </td></tr></table>
  </body>
</html>`,
  }
}
