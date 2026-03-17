# Time Block

You are building a time-blocked schedule for today. Do not ask for confirmation — build the schedule, present it, then wait for approval before creating any calendar events.

## Step 1: Gather

Run all of the following:

```bash
# Today's starred emails (task list)
node /Users/edoardo.romani/claudeCOS/scripts/gmail-api.js search "is:starred"

# Today's calendar (existing events + any [TB] or Transit → blocks already created)
node /Users/edoardo.romani/claudeCOS/scripts/calendar-api.js list-events "edo.romani1@gmail.com" "$(date +%Y-%m-%d)"

# Today's digest for priority context
cat /Users/edoardo.romani/claudeCOS/digests/$(date +%Y-%m-%d).md 2>/dev/null || echo "No digest today."
```

## Step 2: Build the task list

Cross-reference starred emails against the digest to assign priorities:
- If the email appears in the digest, use the priority from there (P1–P4)
- If the email is starred but not in today's digest, treat it as P3 by default

Estimate a duration for each task based on its nature:
- Quick reply or confirmation: 15 min
- Standard email response: 20–30 min
- Research or document task: 45–90 min
- Meeting prep: 30 min
- Unknown/complex: 30 min default

Tag each task with a location:
- OFFICE — requires physical presence
- ANYWHERE — remote, email, or digital work (default for most tasks)

Remove any tasks that have already been handled (no longer starred, or draft already created by Comms Agent this morning).

## Step 3: Determine scheduling start time

Run: `date +%H:%M`

Round up to the next 15-minute mark and use that as the earliest slot available for scheduling today. Never schedule a [TB] block that starts before this time — anything that would have fit earlier is already gone.

If the current time is after 19:00, all remaining work tasks go to the evening window or roll to tomorrow.

## Step 4: Map existing blocks

From the calendar, identify:
- **Fixed blocks**: confirmed events, meetings (do not touch these)
- **Transit blocks**: events starting with "Transit →" (do not touch these)
- **Existing time blocks**: events with "[TB]" prefix (these can be replaced if re-running)
- **Protected**: lunch gap 13:00–14:00 (always keep free — never schedule here)

Available scheduling windows today = all time from the current-time start point (Step 3) not covered by the above.

## Step 5: Build the schedule

Scheduling order:
1. Quick wins first (tasks ≤ 15 min) — momentum
2. P1 tasks
3. P2 tasks
4. P3 tasks
5. P4 tasks (only if space remains)

Rules:
- Primary work window: 09:00–19:00
- Lunch gap 13:00–14:00: never schedule here
- Evening (19:00–21:30): use only if P1/P2 tasks don't fit in the day window — flag these explicitly
- Minimum block size: 15 min
- Add a 5-min buffer between consecutive [TB] blocks
- OFFICE tasks: only schedule during 09:00–19:00
- ANYWHERE tasks: can go in evening window if needed

### Errand batching (if any ERRAND-tagged tasks exist)
Group all errands into one contiguous block. Route geographically to minimise backtracking. Use travel-time.js for legs between stops. Otherwise skip this step.

## Step 6: Rollover (tasks that don't fit today)

- **P1**: Flag loudly — never silently roll. Show as "⚠️ P1 DOESN'T FIT — needs manual review"
- **P2**: Roll to next business day
- **P3**: Roll to lightest day within 5 days (check calendar to find it)
- **P4**: Roll to lightest day within 7 days

## Step 7: Present the proposed schedule

Show the schedule as a table before creating anything:

```
TIME BLOCK — [DATE]

TIME          TASK                          DURATION   PRIORITY   LOCATION
─────────────────────────────────────────────────────────────────────────
09:00–09:15   [task name]                   15 min     P2         ANYWHERE
09:20–09:50   [task name]                   30 min     P1         ANYWHERE
...
13:00–14:00   ── Lunch (protected) ──
...
[EVENING]
19:00–19:30   [task name — evening flag]    30 min     P2         ANYWHERE

ROLLED OVER:
  → [task] (P2) → tomorrow
  → [task] (P3) → [lightest day]

Reply with:
  "go"            — create all [TB] events
  "go blocks only"  — create calendar blocks, skip rollovers
  "skip [N]"      — remove item N and re-schedule
  "adjust [N] to [time]" — move item N to a specific time
```

Wait for the user's reply.

## Step 8: Execute

For each approved task, create a calendar event:

```bash
node /Users/edoardo.romani/claudeCOS/scripts/calendar-api.js create-event "edo.romani1@gmail.com" '<JSON>'
```

Event format:
```json
{
  "summary": "[TB] Task name",
  "description": "Priority: P1 | Estimated: 30 min | Source: email subject",
  "start": { "dateTime": "2026-03-18T09:00:00Z", "timeZone": "Europe/London" },
  "end":   { "dateTime": "2026-03-18T09:30:00Z", "timeZone": "Europe/London" }
}
```

Use the `[TB]` prefix so these events can be identified and replaced on re-runs.

After all events are created, confirm:
```
[TB] blocks created: N
Rolled tasks updated: N
Done. Check your calendar.
```

## Safety rules

- NEVER delete or modify existing events (only [TB]-prefixed ones may be replaced)
- NEVER schedule over confirmed meetings, transit blocks, or the lunch gap
- NEVER create events without user approval (wait for "go" reply)
