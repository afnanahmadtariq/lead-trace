from __future__ import annotations

import logging
import os
from typing import Optional

import httpx

log = logging.getLogger('lead-trace.worker.email')


def _escape_html(value: str) -> str:
    return (
        value.replace('&', '&amp;')
        .replace('<', '&lt;')
        .replace('>', '&gt;')
        .replace('"', '&quot;')
        .replace("'", '&#039;')
    )


def render_brief_ready_email(*, prospect_name: str, action_url: str, recipient_name: Optional[str] = None) -> dict[str, str]:
    greeting = f'Hi {recipient_name.strip()},' if recipient_name and recipient_name.strip() else 'Hi there,'
    subject = f'Your brief for {prospect_name} is ready'
    text = f"""{greeting}

Your conversation brief for {prospect_name} is ready to review.

Open brief: {action_url}

— The Lead Trace team
"""
    html = f"""<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="background:#f8fbff;color:#10264f;font-family:Arial,Helvetica,sans-serif;margin:0;padding:32px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#fff;border:1px solid #dceafa;border-radius:18px;max-width:580px;overflow:hidden;">
        <tr><td style="background:#12346f;border-top:6px solid #49bcf7;color:#fff;font-size:23px;font-weight:800;letter-spacing:-.04em;padding:22px 30px;">Lead Trace</td></tr>
        <tr><td style="padding:34px 30px 12px;"><h1 style="font-size:28px;letter-spacing:-.035em;line-height:1.2;margin:0;">Your brief is ready.</h1></td></tr>
        <tr><td style="color:#617798;font-size:16px;line-height:1.65;padding:0 30px 24px;">
          <p style="margin:0 0 16px;">{_escape_html(greeting)}</p>
          <p style="margin:0;">Your conversation brief for <strong>{_escape_html(prospect_name)}</strong> is ready to review.</p>
        </td></tr>
        <tr><td style="padding:0 30px 34px;"><a href="{_escape_html(action_url)}" style="background:#1768c7;border-radius:12px;color:#fff;display:inline-block;font-size:16px;font-weight:700;padding:14px 22px;text-decoration:none;">Open brief</a></td></tr>
      </table>
    </td></tr></table>
  </body>
</html>"""
    return {'subject': subject, 'text': text, 'html': html}


def send_brief_ready_email(
    *,
    to: str,
    prospect_name: str,
    brief_id: str,
    recipient_name: Optional[str] = None,
) -> None:
    api_key = os.environ.get('RESEND_API_KEY', '').strip()
    if not api_key:
        log.info('brief-ready email skipped recipient=%s reason=no_resend_key', to)
        return

    web_origin = os.environ.get('WEB_ORIGIN', 'http://localhost:3000').rstrip('/')
    action_url = f'{web_origin}/dashboard/briefs/{brief_id}'
    template = render_brief_ready_email(
        prospect_name=prospect_name,
        action_url=action_url,
        recipient_name=recipient_name,
    )
    from_email = os.environ.get('RESEND_FROM_EMAIL', 'Lead Trace <onboarding@resend.dev>').strip()
    payload: dict = {
        'from': from_email,
        'to': [to],
        'subject': template['subject'],
        'html': template['html'],
        'text': template['text'],
        'tags': [{'name': 'category', 'value': 'brief-ready'}],
    }
    reply_to = os.environ.get('RESEND_REPLY_TO_EMAIL', '').strip()
    if reply_to:
        payload['reply_to'] = reply_to

    response = httpx.post(
        'https://api.resend.com/emails',
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        json=payload,
        timeout=15.0,
    )
    if response.status_code >= 400:
        log.warning('brief-ready email rejected recipient=%s status=%s', to, response.status_code)
        return
    log.info('brief-ready email sent recipient=%s brief_id=%s', to, brief_id)
