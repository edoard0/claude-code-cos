#!/usr/bin/env node
// One-time OAuth2 authorisation for Gmail API.
// Run this once: node scripts/gmail-auth.js
// It will open a browser, ask you to approve Gmail access,
// then save a token to ~/.config/cos/gmail-token.json.

const https = require('https');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const CREDENTIALS_PATH = path.join(os.homedir(), '.config', 'cos', 'gmail-credentials.json');
const TOKEN_PATH = path.join(os.homedir(), '.config', 'cos', 'gmail-token.json');
const REDIRECT_PORT = 3000;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}`;

const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
const { client_id, client_secret } = credentials.installed || credentials.web;

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${encodeURIComponent(client_id)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&access_type=offline` +
  `&prompt=consent`;

console.log('Opening browser for Gmail authorisation...');
try {
  execSync(`open "${authUrl}"`);
} catch {
  console.log('Could not open browser automatically. Visit this URL:\n' + authUrl);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
  const code = url.searchParams.get('code');

  if (!code) {
    res.writeHead(400);
    res.end('No authorisation code found.');
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h2>Authorised. You can close this tab.</h2>');
  server.close();

  // Exchange code for tokens
  const body = new URLSearchParams({
    code,
    client_id,
    client_secret,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  }).toString();

  const options = {
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
  };

  const tokenReq = https.request(options, (tokenRes) => {
    let data = '';
    tokenRes.on('data', (chunk) => { data += chunk; });
    tokenRes.on('end', () => {
      const token = JSON.parse(data);
      if (token.error) {
        console.error('Token error:', token.error, token.error_description);
        process.exit(1);
      }
      token.obtained_at = Date.now();
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
      fs.chmodSync(TOKEN_PATH, 0o600);
      console.log('Token saved to', TOKEN_PATH);
      console.log('Gmail authorisation complete.');
    });
  });

  tokenReq.on('error', (err) => { console.error(err); process.exit(1); });
  tokenReq.write(body);
  tokenReq.end();
});

server.listen(REDIRECT_PORT, () => {
  console.log(`Waiting for authorisation callback on port ${REDIRECT_PORT}...`);
});
