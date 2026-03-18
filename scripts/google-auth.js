#!/usr/bin/env node
// Shared Google OAuth2 token management for COS scripts.
// Used by gmail-api.js and calendar-api.js.

const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CREDENTIALS_PATH = path.join(os.homedir(), '.config', 'cos', 'gmail-credentials.json');
const TOKEN_PATH = path.join(os.homedir(), '.config', 'cos', 'gmail-token.json');

function loadToken() {
  return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
}

function saveToken(token) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
  fs.chmodSync(TOKEN_PATH, 0o600);
}

function isExpired(token) {
  const expiresAt = (token.obtained_at || 0) + (token.expires_in || 3600) * 1000;
  return Date.now() > expiresAt - 5 * 60 * 1000;
}

function post(hostname, reqPath, body, extraHeaders = {}) {
  const buf = Buffer.from(body);
  return new Promise((resolve, reject) => {
    const req = https.request(
      { method: 'POST', hostname, path: reqPath, headers: { 'Content-Length': buf.length, ...extraHeaders } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
      }
    );
    req.on('error', reject);
    req.write(buf);
    req.end();
  });
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

module.exports = { getAccessToken };
