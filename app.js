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

function toObject(form) {
  const fd = new FormData(form);
  const obj = {};
  for (const [k, v] of fd.entries()) {
    const value = typeof v === 'string' ? v.trim() : v;
    if (value !== '') obj[k] = value;
  }
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

  const form = document.getElementById('waitlist');
  if (!form) return;

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
      setStatus(status, '✅ You’re on the list. We’ll be in touch soon.', 'success');
      form.reset();
    } catch (err) {
      // If no server handler exists (common on static-only hosting), fallback to email.
      const msg = String(err?.message || 'Submit failed');
      setStatus(status, `Couldn’t submit automatically (${msg}). Opening email fallback…`);
      window.location.href = fallbackMailto(data);
    }
  });
}

init();
