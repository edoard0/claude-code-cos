#!/usr/bin/env node
// Gmail API wrapper for COS inbox scan.
// No npm dependencies — Node.js built-ins only.
//
// Usage:
//   node gmail-api.js search "<query>"
//   node gmail-api.js read <messageId>
//   node gmail-api.js draft <threadId> <to> <subject> <body>

const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CREDENTIALS_PATH = path.join(os.homedir(), '.config', 'cos', 'gmail-credentials.json');
const TOKEN_PATH = path.join(os.homedir(), '.config', 'cos', 'gmail-token.json');

// ── Token management ────────────────────────────────────────────────────────

function loadToken() {
  return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
}

function saveToken(token) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
  fs.chmodSync(TOKEN_PATH, 0o600);
}

function isExpired(token) {
  // Refresh if less than 5 minutes remaining
  const expiresAt = (token.obtained_at || 0) + (token.expires_in || 3600) * 1000;
  return Date.now() > expiresAt - 5 * 60 * 1000;
}

async function refreshAccessToken(token) {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const { client_id, client_secret } = credentials.installed || credentials.web;

  const body = new URLSearchParams({
    client_id,
    client_secret,
    refresh_token: token.refresh_token,
    grant_type: 'refresh_token',
  }).toString();

  const data = await post('oauth2.googleapis.com', '/token', body, {
    'Content-Type': 'application/x-www-form-urlencoded',
  });

  const newToken = { ...token, ...data, obtained_at: Date.now() };
  saveToken(newToken);
  return newToken;
}

async function getAccessToken() {
  let token = loadToken();
  if (isExpired(token)) {
    token = await refreshAccessToken(token);
  }
  return token.access_token;
}

// ── HTTP helpers ────────────────────────────────────────────────────────────

function request(method, hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const options = { method, hostname, path, headers };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function get(hostname, path, accessToken) {
  return request('GET', hostname, path, {
    Authorization: `Bearer ${accessToken}`,
  });
}

function post(hostname, path, body, extraHeaders = {}) {
  const bodyBuf = Buffer.from(body);
  return request('POST', hostname, path, {
    'Content-Type': 'application/json',
    'Content-Length': bodyBuf.length,
    ...extraHeaders,
  }, bodyBuf);
}

function apiPost(path, body, accessToken) {
  const bodyStr = JSON.stringify(body);
  const bodyBuf = Buffer.from(bodyStr);
  return request('POST', 'gmail.googleapis.com', path, {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Content-Length': bodyBuf.length,
  }, bodyBuf);
}

// ── Gmail operations ────────────────────────────────────────────────────────

async function search(query) {
  const accessToken = await getAccessToken();
  const q = encodeURIComponent(query);
  const listRes = await get(
    'gmail.googleapis.com',
    `/gmail/v1/users/me/messages?q=${q}&maxResults=50`,
    accessToken
  );

  if (!listRes.messages || listRes.messages.length === 0) {
    console.log(JSON.stringify([]));
    return;
  }

  const results = [];
  for (const { id, threadId } of listRes.messages) {
    const msg = await get(
      'gmail.googleapis.com',
      `/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
      accessToken
    );
    const headers = (msg.payload && msg.payload.headers) || [];
    const get_header = (name) => (headers.find(h => h.name.toLowerCase() === name.toLowerCase()) || {}).value || '';
    results.push({
      id,
      threadId,
      subject: get_header('Subject'),
      from: get_header('From'),
      date: get_header('Date'),
      snippet: msg.snippet || '',
      labelIds: msg.labelIds || [],
    });
  }

  console.log(JSON.stringify(results, null, 2));
}

function decodeBody(part) {
  if (!part) return '';
  if (part.body && part.body.data) {
    return Buffer.from(part.body.data, 'base64').toString('utf8');
  }
  if (part.parts) {
    // Prefer text/plain, fall back to text/html
    const plain = part.parts.find(p => p.mimeType === 'text/plain');
    const html = part.parts.find(p => p.mimeType === 'text/html');
    const target = plain || html;
    if (target && target.body && target.body.data) {
      return Buffer.from(target.body.data, 'base64').toString('utf8');
    }
    // Recurse into nested parts
    for (const p of part.parts) {
      const result = decodeBody(p);
      if (result) return result;
    }
  }
  return '';
}

async function read(messageId) {
  const accessToken = await getAccessToken();
  const msg = await get(
    'gmail.googleapis.com',
    `/gmail/v1/users/me/messages/${messageId}?format=full`,
    accessToken
  );

  const headers = (msg.payload && msg.payload.headers) || [];
  const get_header = (name) => (headers.find(h => h.name.toLowerCase() === name.toLowerCase()) || {}).value || '';

  const result = {
    id: msg.id,
    threadId: msg.threadId,
    subject: get_header('Subject'),
    from: get_header('From'),
    to: get_header('To'),
    date: get_header('Date'),
    snippet: msg.snippet || '',
    body: decodeBody(msg.payload),
    labelIds: msg.labelIds || [],
  };

  console.log(JSON.stringify(result, null, 2));
}

async function createDraft(threadId, to, subject, body) {
  const accessToken = await getAccessToken();

  // Build RFC 2822 message
  const raw = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ].join('\r\n');

  const encoded = Buffer.from(raw).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const payload = {
    message: {
      raw: encoded,
      threadId,
    },
  };

  const result = await apiPost('/gmail/v1/users/me/drafts', payload, accessToken);

  if (result.error) {
    console.error(JSON.stringify({ error: result.error }));
    process.exit(1);
  }

  console.log(JSON.stringify({ draftId: result.id, threadId }, null, 2));
}

// ── Entry point ─────────────────────────────────────────────────────────────

const [,, command, ...args] = process.argv;

(async () => {
  try {
    switch (command) {
      case 'search':
        await search(args[0]);
        break;
      case 'read':
        await read(args[0]);
        break;
      case 'draft':
        await createDraft(args[0], args[1], args[2], args[3]);
        break;
      default:
        console.error('Usage: gmail-api.js <search|read|draft> [args...]');
        process.exit(1);
    }
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
})();
