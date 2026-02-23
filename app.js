/*
  ReplyPilot waitlist static handler

  - Tries to POST to /api/waitlist (you provide a handler)
  - If no handler exists, it falls back to a mailto: link as a “works anywhere” stub.

  NOTE: This is intentionally simple; production storage should be:
  - Netlify Forms, Formspree, Airtable, Google Sheets, ConvertKit, Beehiiv, etc.
*/

function setStatus(el, msg, kind) {
  el.textContent = msg;
  el.classList.remove('success', 'error');
  if (kind) el.classList.add(kind);
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (obj && obj[k] != null && String(obj[k]).trim() !== '') out[k] = String(obj[k]).trim();
  }
  return out;
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref'];
const UTM_STORAGE_KEY = 'replypilot:last_attribution_v1';

function getAttributionFromUrl() {
  const p = new URLSearchParams(window.location.search || '');
  const urlAttrs = {};
  for (const k of UTM_KEYS) {
    const v = p.get(k);
    if (v && v.trim() !== '') urlAttrs[k] = v.trim();
  }
  return urlAttrs;
}

function getStoredAttribution() {
  const raw = window.localStorage.getItem(UTM_STORAGE_KEY);
  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== 'object') return {};
  // don't keep stale forever; 30 days is enough for this microtest
  const ts = Number(parsed.ts || 0);
  const ageMs = Date.now() - ts;
  if (!Number.isFinite(ts) || ageMs > 30 * 24 * 60 * 60 * 1000) return {};
  return pick(parsed, UTM_KEYS);
}

function setStoredAttribution(attrs) {
  if (!attrs || Object.keys(attrs).length === 0) return;
  const payload = { ...attrs, ts: Date.now() };
  window.localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(payload));
}

function getAttribution() {
  const fromUrl = getAttributionFromUrl();
  if (Object.keys(fromUrl).length > 0) {
    setStoredAttribution(fromUrl);
    return fromUrl;
  }
  return getStoredAttribution();
}

function applyAttributionToForm(form, attrs) {
  if (!form) return;
  const landing = window.location.href;
  const merged = { ...attrs, landing };

  for (const [k, v] of Object.entries(merged)) {
    const el = form.querySelector(`[name="${k}"]`);
    if (el) el.value = v;
  }
}

async function countapiHit(key) {
  // CountAPI is a simple no-login counter. Good enough for a lightweight baseline.
  // https://countapi.xyz
  // We deliberately do not block the UX on this.
  const url = `https://api.countapi.xyz/hit/${encodeURIComponent(key)}`;
  try {
    const res = await fetch(url, { method: 'GET', mode: 'cors' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function toObject(form) {
  const fd = new FormData(form);
  const obj = {};
  for (const [k, v] of fd.entries()) {
    const value = typeof v === 'string' ? v.trim() : v;
    if (value !== '') obj[k] = value;
  }

  // Always attach attribution if we have it.
  const attrs = getAttribution();
  for (const [k, v] of Object.entries(attrs)) {
    if (v && String(v).trim() !== '') obj[k] = String(v).trim();
  }
  obj.landing = window.location.href;

  obj.client_ts = new Date().toISOString();
  return obj;
}

async function postJSON(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data)
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok) {
    const msg = payload?.error || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

function fallbackMailto(data) {
  const subject = encodeURIComponent('ReplyPilot waitlist signup');
  const bodyLines = [
    'New waitlist signup:',
    `Name: ${data.name || ''}`,
    `Email: ${data.email || ''}`,
    `Website: ${data.website || ''}`,
    `Locations: ${data.locations || ''}`,
    `Reviews/month: ${data.reviews_per_month || ''}`,
    `Preference: ${data.mode || ''}`,
    `GBP links: ${data.gbp_links || ''}`,
    '',
    'Attribution:',
    `utm_source: ${data.utm_source || ''}`,
    `utm_medium: ${data.utm_medium || ''}`,
    `utm_campaign: ${data.utm_campaign || ''}`,
    `utm_content: ${data.utm_content || ''}`,
    `utm_term: ${data.utm_term || ''}`,
    `ref: ${data.ref || ''}`,
    `landing: ${data.landing || ''}`,
    '',
    `Client time: ${data.client_ts || ''}`
  ];
  const body = encodeURIComponent(bodyLines.join('\n'));

  // NOTE: replace destination if desired
  const to = 'merceraline261@gmail.com';
  return `mailto:${to}?subject=${subject}&body=${body}`;
}

function init() {
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  // Pageview baseline counter (no-login).
  // Key name is intentionally stable; change only if you want to reset the counter.
  void countapiHit('afunls-replypilot-waitlist/pageview');

  const form = document.getElementById('waitlist');
  if (!form) return;

  // Populate hidden attribution fields.
  const attrs = getAttribution();
  applyAttributionToForm(form, attrs);

  const status = form.querySelector('.form__status');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus(status, 'Submitting…');

    const data = toObject(form);
    if (!data.email) {
      setStatus(status, 'Please enter an email.', 'error');
      return;
    }

    try {
      await postJSON('/api/waitlist', data);
      void countapiHit('afunls-replypilot-waitlist/waitlist_submit');
      setStatus(status, '✅ You’re on the list. We’ll be in touch soon.', 'success');
      form.reset();
    } catch (err) {
      // If no server handler exists (common on static-only hosting), fallback to email.
      const msg = String(err?.message || 'Submit failed');
      void countapiHit('afunls-replypilot-waitlist/waitlist_submit_fallback_mailto');
      setStatus(status, `Couldn’t submit automatically (${msg}). Opening email fallback…`);
      window.location.href = fallbackMailto(data);
    }
  });
}

init();
