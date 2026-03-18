#!/usr/bin/env node
// Google Tasks API wrapper for COS.
// No npm dependencies — Node.js built-ins only.
//
// Usage:
//   node tasks-api.js list

const https = require('https');
const { getAccessToken } = require('./google-auth');

// ── HTTP helpers ─────────────────────────────────────────────────────────────

function get(hostname, path, accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { method: 'GET', hostname, path, headers: { Authorization: `Bearer ${accessToken}` } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// ── Tasks operations ─────────────────────────────────────────────────────────

async function listAllTasks() {
  const accessToken = await getAccessToken();

  const listsRes = await get(
    'tasks.googleapis.com',
    '/tasks/v1/users/@me/lists?maxResults=100',
    accessToken
  );

  if (!listsRes.items || listsRes.items.length === 0) {
    console.log(JSON.stringify([]));
    return;
  }

  const results = [];
  for (const list of listsRes.items) {
    const tasksRes = await get(
      'tasks.googleapis.com',
      `/tasks/v1/lists/${encodeURIComponent(list.id)}/tasks?showCompleted=false&showHidden=false&maxResults=100`,
      accessToken
    );

    if (!tasksRes.items) continue;

    for (const task of tasksRes.items) {
      if (task.status === 'completed') continue;
      results.push({
        id: task.id,
        title: task.title || '(untitled)',
        notes: task.notes || '',
        due: task.due || null,
        updated: task.updated || null,
        listId: list.id,
        listTitle: list.title,
      });
    }
  }

  console.log(JSON.stringify(results, null, 2));
}

// ── Entry point ──────────────────────────────────────────────────────────────

const [,, command] = process.argv;

(async () => {
  try {
    switch (command) {
      case 'list':
        await listAllTasks();
        break;
      default:
        console.error('Usage: tasks-api.js list');
        process.exit(1);
    }
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
})();
