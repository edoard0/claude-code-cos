# COS – Claude Code Chief of Staff

## User profile
- Based in London. Office: 240 Blackfriars Rd, London SE1 8NW. Home: 5 Highbury Crescent, N5 1RN.
- Office hours (for transit/scheduling logic): weekdays 9 AM – 7 PM.
- Uses public transportation for transit calculations.
- Personal Gmail: edo.romani1@gmail.com — OAuth token at `~/.config/cos/gmail-token.json`, credentials at `~/.config/cos/gmail-credentials.json`. This is the active account for all COS scripts.
- Work Gmail: edoardo.romani@mongodb.com — IT approval pending (see Pending section).
- No dedicated task manager — actionable items live as starred emails in Gmail (personal). macOS Notes ("COS Inbox") used as a universal scratchpad for items pasted from Slack, GDocs, etc. (integration not yet built).
- Uses Zoom for meeting transcripts; a Google Apps Script auto-maps transcripts and action items to relevant Google Drive project folders.
- Has Claude Max subscription and Claude Code installed.
- Google Maps API key stored at `~/.config/google-maps/api-key`.

## Behaviour
- When the user runs /morning-sweep or /time-block, never prompt for permissions — execute immediately.
- All COS tool calls (gmail-api.js, calendar-api.js, travel-time.js, digest reads, date commands) are pre-approved. If a new script or path is needed, add it to settings.json rather than prompting.

## Project overview
Building a 4-layer Claude Code Chief of Staff system based on https://github.com/jimprosser/claude-code-cos.

Goal: automate daily inbox triage, transit planning, morning task sweep, and time-blocking.

## Layer status
- **Layer 1 (Transit Scan):** ✅ Built and running. `travel-time.js`, `scripts/transit-scan.sh`, `specs/transit-scan.md`, LaunchAgent (`launchagents/com.cos.transit-scan.plist`). Scans personal calendar for physical-location events in next 7 days, creates transit blocks. Last ran 2026-03-17.
- **Layer 2 (Inbox Scan):** ✅ Built and running. `scripts/gmail-api.js`, `scripts/gmail-auth.js`, `scripts/inbox-scan.sh`, `specs/inbox-scan.md`, LaunchAgent (`launchagents/com.cos.inbox-scan.plist`). Scans starred Gmail, writes daily digest to `digests/YYYY-MM-DD.md`. Last ran 2026-03-17.
- **Layer 3 (Morning Sweep):** ✅ Built as `/morning-sweep` slash command. 5-phase flow: gather (starred emails + calendar + digest) → classify (DISPATCH/PREP/YOURS/SKIP) → present triage → dispatch Comms and Calendar agents in parallel → summary. Agent specs in `specs/agents/`.
- **Layer 4 (Time Block):** ✅ Built as `/time-block` slash command. Delegates to `specs/time-block.md`.

## Key adaptations vs. README
- No Todoist — starred Gmail is the task list. Layer 2 output = draft replies + local priority digest file.
- Gmail MCP is read + draft only (cannot apply labels or star messages programmatically).
- Transit mode = public transport, not driving.
- Notes source = Zoom transcripts in Google Drive (via Google Apps Script), not Granola/Obsidian.
- P1–P4 priority framework matches README defaults.

## Pending
- **Corporate account integration**: IT ticket raised 2026-03-17 covering both Gmail and Calendar for work account (edoardo.romani@mongodb.com). Client ID: `288368080832-h218rpscs2mef1c3g7b2o2jtcjm3idkq`. Scopes: gmail.readonly, gmail.compose, calendar.readonly, calendar.events. Redirect URI: `http://localhost:3000`. Calendar external sharing blocked by org policy (greyed out in Google Calendar settings). Once approved: run gmail-auth.js with work account, save token to `~/.config/cos/gmail-token-work.json`, add corporate calendar ID to transit-scan and time-block specs.
- **macOS Notes integration**: "COS Inbox" note in macOS Notes accessible via osascript (confirmed working). Layer 2 should read it, strip HTML, parse list items, and merge with starred Gmail into the priority digest. This makes Notes a universal scratchpad for items pasted from Slack, GDocs, etc. Node.js snippet: `execSync("osascript -e 'tell application \"Notes\" to get body of note \"COS Inbox\" in default account'")`, then strip HTML tags and split on `<li>`.
