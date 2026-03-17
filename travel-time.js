#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const [,, origin, destination] = process.argv;

if (!origin || !destination) {
  console.error('Usage: node travel-time.js <origin> <destination>');
  process.exit(1);
}

const keyPath = path.join(os.homedir(), '.config', 'google-maps', 'api-key');
const apiKey = fs.readFileSync(keyPath, 'utf8').trim();

const params = new URLSearchParams({
  origin,
  destination,
  mode: 'transit',
  key: apiKey,
});

const url = `https://maps.googleapis.com/maps/api/directions/json?${params}`;

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const json = JSON.parse(data);

    if (json.status !== 'OK') {
      console.error(JSON.stringify({ error: json.status, message: json.error_message || '' }));
      process.exit(1);
    }

    const leg = json.routes[0].legs[0];
    const result = {
      minutes: Math.round(leg.duration.value / 60),
      display: leg.duration.text,
      distance: leg.distance.text,
    };

    console.log(JSON.stringify(result, null, 2));
  });
}).on('error', (err) => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
