/*
  ReplyPilot waitlist handler — Formspree edition
  Form endpoint: https://formspree.io/f/maqdalbr
  Submissions delivered to merceraline261@gmail.com via Formspree.

  Changelog:
    2026-02-24  replaced GitHub-Issues capture → Formspree JSON POST (task-ee475e790233)
*/

/* ─── helpers ─────────────────────────────────────────────────────────────── */

function setStatus(el, msg, kind) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('success', 'error');
  if (kind) el.classList.add(kind);
}

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (obj && obj[k] != null && String(obj[k]).trim() !== '') out[k] = String(obj[k]).trim();
  }
  return out;
}

/* ─── UTM / attribution ────────────────────────────────────────────────────── */

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref'];
const UTM_STORAGE_KEY = 'replypilot:last_attribution_v1';

function getAttributionFromUrl() {
  const p = new URLSearchParams(window.location.search || '');
  const attrs = {};
  for (const k of UTM_KEYS) {
    const v = p.get(k);
    if (v && v.trim() !== '') attrs[k] = v.trim();
  }
  return attrs;
}

function getStoredAttribution() {
  const raw = window.localStorage && window.localStorage.getItem(UTM_STORAGE_KEY);
  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== 'object') return {};
  const ageMs = Date.now() - Number(parsed.ts || 0);
  if (ageMs > 30 * 24 * 60 * 60 * 1000) return {};
  return pick(parsed, UTM_KEYS);
}

function setStoredAttribution(attrs) {
  if (!window.localStorage || !attrs || Object.keys(attrs).length === 0) return;
  window.localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify({ ...attrs, ts: Date.now() }));
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
  const merged = { ...attrs, landing: window.location.href };
  for (const [k, v] of Object.entries(merged)) {
    const el = form.querySelector(`[name="${k}"]`);
    if (el) el.value = v;
  }
}

/* ─── countapi pageview (best-effort, no-login) ────────────────────────────── */

async function countapiHit(key) {
  try {
    const res = await fetch(`https://api.countapi.xyz/hit/${encodeURIComponent(key)}`,
      { method: 'GET', mode: 'cors' });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

/* ─── build FormData object with attribution injected ─────────────────────── */

function toObject(form) {
  const fd = new FormData(form);
  const obj = {};
  for (const [k, v] of fd.entries()) {
    const value = typeof v === 'string' ? v.trim() : v;
    if (value !== '') obj[k] = value;
  }
  // always attach attribution
  const attrs = getAttribution();
  for (const [k, v] of Object.entries(attrs)) {
    if (v && String(v).trim() !== '') obj[k] = String(v).trim();
  }
  obj.landing = window.location.href;
  obj.client_ts = new Date().toISOString();
  return obj;
}

/* ─── Formspree JSON POST (default path) ─────────────────────────────────── */

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/maqdalbr';

async function postFormspree(data) {
  const res = await fetch(FORMSPREE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(data)
  });
  let payload = null;
  try { payload = await res.json(); } catch { /* ignore */ }
  if (!res.ok) {
    const msg = (payload && (payload.error || payload.message)) || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

/* ─── Direct relay submit (optional) ─────────────────────────────────────── */

// If enabled, the waitlist will use a native HTML form POST to a relay endpoint
// (POST → GitHub Issue → 302 redirect). This avoids Formspree premium webhooks.
//
// Safety: Default is OFF until we have a durable public relay. To enable:
//   1) Set window.__RP_CONFIG__.relay = 'https://<your-relay>/'
//   2) Add ?direct=1 to the waitlist URL
const RELAY_ENDPOINT_DEFAULT = '';

function getRelayEndpoint() {
  return (window.__RP_CONFIG__ && window.__RP_CONFIG__.relay) || RELAY_ENDPOINT_DEFAULT;
}

function isDirectRelayEnabled() {
  const p = new URLSearchParams(window.location.search || '');
  return p.get('direct') === '1' && !!getRelayEndpoint();
}

/* ─── A/B hero variant ─────────────────────────────────────────────────────── */

function applyHeroVariant() {
  const p = new URLSearchParams(window.location.search || '');
  const ab = (p.get('ab') || '').toLowerCase();
  if (ab !== 'b') return; // Variant A is default

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  // Variant B (pain-focused)
  setText('hero_eyebrow', 'Stop losing leads to unanswered reviews.');
  setText('hero_h1', 'Never leave a Google review unanswered again');

  const b1 = document.getElementById('hero_b1');
  const b2 = document.getElementById('hero_b2');
  const b3 = document.getElementById('hero_b3');
  if (b1) b1.innerHTML = '<strong>Daily inbox, cleared:</strong> generate replies in bulk for every new review';
  if (b2) b2.innerHTML = '<strong>Bad reviews handled right:</strong> empathy-first drafts + escalation workflow';
  if (b3) b3.innerHTML = '<strong>Team-safe:</strong> draft-only by default; auto-post is opt-in';

  const cta1 = document.getElementById('hero_cta_primary');
  const cta2 = document.getElementById('hero_cta_secondary');
  if (cta1) cta1.textContent = 'Join waitlist (founder pricing)';
  if (cta2) {
    cta2.textContent = 'Book a 10-min walkthrough';
    cta2.setAttribute('href', '#demo');
  }
}

/* ─── init ─────────────────────────────────────────────────────────────────── */

function init() {
  applyHeroVariant();

  // year in footer
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  // pageview counter (best-effort)
  void countapiHit('afunls-replypilot-waitlist/pageview');

  const form = document.getElementById('waitlist');
  if (!form) return;

  // populate hidden attribution fields
  applyAttributionToForm(form, getAttribution());

  const status = form.querySelector('.form__status');

  if (isDirectRelayEnabled()) {
    // Direct mode: native form POST (no AJAX) to avoid CORS issues on static hosting.
    try {
      form.setAttribute('action', getRelayEndpoint());
      form.setAttribute('method', 'POST');
    } catch { /* ignore */ }

    form.addEventListener('submit', () => {
      setStatus(status, 'Submitting…');
      void countapiHit('afunls-replypilot-waitlist/waitlist_submit');
      // Do NOT preventDefault: we want the browser to submit the form normally.
    });

    return;
  }

  // Default mode: submit to Formspree (free) and redirect to thank-you.
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus(status, 'Submitting…');

    const data = toObject(form);
    if (!data.email) {
      setStatus(status, 'Please enter your email.', 'error');
      return;
    }

    try {
      void countapiHit('afunls-replypilot-waitlist/waitlist_submit');
      await postFormspree(data);
      window.location.href = './thank-you.html';
    } catch (err) {
      console.warn('ReplyPilot: Formspree submit failed', err);
      void countapiHit('afunls-replypilot-waitlist/waitlist_submit_error');
      setStatus(status,
        'Submit failed — please try again or email us directly.',
        'error');
    }
  });
}

init();
