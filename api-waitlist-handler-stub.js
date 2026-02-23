/*
  Simple waitlist form handler STUB.

  Purpose:
  - Provide a concrete “next step” for wiring the static form to storage.

  This file is NOT deployed automatically. Pick one hosting target and adapt:

  Option A) Netlify Function
    - Move to: netlify/functions/waitlist.js
    - Export: handler

  Option B) Vercel Serverless Function
    - Move to: api/waitlist.js (project root)
    - Export: default function handler(req, res)

  Option C) Cloudflare Worker
    - Use fetch(request) and write to KV / D1 / email.

  Storage options:
  - Airtable, Google Sheets, Notion, ConvertKit, Beehiiv, Mailchimp, HubSpot…

  Minimal contract expected by app.js:
    POST /api/waitlist
      body: JSON
      returns: { ok: true }

  SECURITY NOTE:
  - If you accept arbitrary POSTs publicly, add:
    - basic spam protection (honeypot field, rate limit, captcha)
    - allowlist origin
    - validation (email format)
*/

export async function handleWaitlist(payload) {
  // TODO: replace with a real destination
  // Example: write to a spreadsheet, or send an email via Brevo/Resend.

  const email = String(payload?.email || '').trim();
  if (!email) {
    return { ok: false, error: 'missing_email' };
  }

  // eslint-disable-next-line no-console
  console.log('[waitlist] signup', {
    email,
    name: payload?.name,
    website: payload?.website,
    locations: payload?.locations,
    reviews_per_month: payload?.reviews_per_month,
    mode: payload?.mode,
    gbp_links: payload?.gbp_links,
    client_ts: payload?.client_ts
  });

  return { ok: true };
}
