#!/usr/bin/env node
// Google Calendar API wrapper for COS transit scanner.
// No npm dependencies — Node.js built-ins only.
//
// Usage:
//   node calendar-api.js list-calendars
//   node calendar-api.js list-events <calendarId> <dateISO>        # e.g. 2026-03-18
//   node calendar-api.js create-event <calendarId> <eventJSON>

const https = require('https');
const { getAccessToken } = require('./google-auth');

// ── HTTP helpers ─────────────────────────────────────────────────────────────

function request(method, hostname, reqPath, headers, body) {
  return new Promise((resolve, reject) => {
    const options = { method, hostname, path: reqPath, headers };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function get(reqPath, accessToken) {
  return request('GET', 'www.googleapis.com', reqPath, {
    Authorization: `Bearer ${accessToken}`,
  });
}

function apiPost(reqPath, body, accessToken) {
  const buf = Buffer.from(JSON.stringify(body));
  return request('POST', 'www.googleapis.com', reqPath, {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Content-Length': buf.length,
  }, buf);
}

// ── Calendar operations ───────────────────────────────────────────────────────

async function listCalendars() {
  const accessToken = await getAccessToken();
  const res = await get('/calendar/v3/users/me/calendarList?minAccessRole=reader', accessToken);

  if (res.error) {
    console.error(JSON.stringify({ error: res.error }));
    process.exit(1);
  }

  const calendars = (res.items || []).map(c => ({
    id: c.id,
    summary: c.summary,
    accessRole: c.accessRole,
    primary: c.primary || false,
  }));

  console.log(JSON.stringify(calendars, null, 2));
}

async function listEvents(calendarId, dateISO) {
  const accessToken = await getAccessToken();

  // Full day in Europe/London — use UTC offsets for the API
  const timeMin = new Date(dateISO + 'T00:00:00').toISOString();
  const timeMax = new Date(dateISO + 'T23:59:59').toISOString();

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  const encodedId = encodeURIComponent(calendarId);
  const res = await get(
    `/calendar/v3/calendars/${encodedId}/events?${params}`,
    accessToken
  );

  if (res.error) {
    console.error(JSON.stringify({ error: res.error }));
    process.exit(1);
  }

  const events = (res.items || []).map(e => ({
    id: e.id,
    summary: e.summary || '(No title)',
    location: e.location || null,
    start: e.start,
    end: e.end,
    status: e.status,
    hangoutLink: e.hangoutLink || null,
    description: e.description || null,
  }));

  console.log(JSON.stringify(events, null, 2));
}

async function deleteEvent(calendarId, eventId) {
  const accessToken = await getAccessToken();
  const encodedCalId = encodeURIComponent(calendarId);
  await new Promise((resolve, reject) => {
    const options = {
      method: 'DELETE',
      hostname: 'www.googleapis.com',
      path: `/calendar/v3/calendars/${encodedCalId}/events/${eventId}`,
      headers: { Authorization: `Bearer ${accessToken}` },
    };
    const req = https.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', resolve);
    });
    req.on('error', reject);
    req.end();
  });
  console.log(JSON.stringify({ deleted: eventId }));
}

async function createEvent(calendarId, eventData) {
  const accessToken = await getAccessToken();
  const encodedId = encodeURIComponent(calendarId);
  const res = await apiPost(
    `/calendar/v3/calendars/${encodedId}/events`,
    eventData,
    accessToken
  );

  if (res.error) {
    console.error(JSON.stringify({ error: res.error }));
    process.exit(1);
  }

  console.log(JSON.stringify({ id: res.id, summary: res.summary, start: res.start, end: res.end }, null, 2));
}

// ── Entry point ───────────────────────────────────────────────────────────────

const [,, command, ...args] = process.argv;

(async () => {
  try {
    switch (command) {
      case 'list-calendars':
        await listCalendars();
        break;
      case 'list-events':
        await listEvents(args[0], args[1]);
        break;
      case 'create-event':
        await createEvent(args[0], JSON.parse(args[1]));
        break;
      case 'delete-event':
        await deleteEvent(args[0], args[1]);
        break;
      default:
        console.error('Usage: calendar-api.js <list-calendars|list-events|create-event> [args...]');
        process.exit(1);
    }
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
})();
