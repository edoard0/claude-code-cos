# Morning Sweep

Run the daily triage. Gather context, classify every starred email, present for approval, then dispatch agents.

---

## Phase 1: Gather

Run all of these:

```bash
# Starred emails (manually flagged tasks)
node /Users/edoardo.romani/claudeCOS/scripts/gmail-api.js search "is:starred"

# Google Tasks (incomplete tasks)
node /Users/edoardo.romani/claudeCOS/scripts/tasks-api.js list

# Today's calendar
node /Users/edoardo.romani/claudeCOS/scripts/calendar-api.js list-events "edo.romani1@gmail.com" "$(date +%Y-%m-%d)"

# Tomorrow's calendar
node /Users/edoardo.romani/claudeCOS/scripts/calendar-api.js list-events "edo.romani1@gmail.com" "$(date -v+1d +%Y-%m-%d)"

# Today's inbox digest (actionable items found by overnight scan)
cat /Users/edoardo.romani/claudeCOS/digests/$(date +%Y-%m-%d).md 2>/dev/null || echo "No digest for today yet."
```

**Build the task list from all sources:**
- All starred emails
- All incomplete Google Tasks (treat tasks with due date ≤ today as at least P2)
- All P1 and P2 items from today's digest that are not already starred (check by matching sender + subject)
- P3 and P4 digest items: include only if not already starred — list them separately at the bottom of the triage as lower-priority suggestions

Deduplicate: if an email appears in both starred and the digest, count it once (use the digest priority if available). Google Tasks are separate items and do not deduplicate against emails.

For each task, read the full thread if the subject alone isn't enough to classify it:
```bash
node /Users/edoardo.romani/claudeCOS/scripts/gmail-api.js read <messageId>
```

---

## Phase 2: Classify

Assign each starred email one of four labels:

- 🟢 **DISPATCH** — AI can handle this fully (straightforward replies, confirmations, scheduling a meeting with a clear proposed time)
- 🟡 **PREP** — AI drafts it, you review and send (anything requiring your voice, judgment, or involving professional relationships)
- 🔴 **YOURS** — Needs your brain or presence (strategy, negotiation, sensitive conversations, live meetings)
- ⚪ **SKIP** — Not actionable today (waiting on someone else, needs more context, intentionally deferred)

**Default to PREP over DISPATCH when uncertain.**

Classification rules:
- Scheduling request with a clear proposed time → DISPATCH (Calendar Agent)
- Straightforward factual question → DISPATCH (Comms Agent)
- Anything involving money, contracts, equity, or sensitive relationships → PREP minimum, often YOURS
- Anything requiring personal judgment or strategic input → YOURS
- Email you've already replied to but left starred → SKIP

---

## Phase 3: Present triage

Show the full list in this format:

```
MORNING SWEEP — [DATE]
[N] starred emails • [N] tasks • [N] events today

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟢 DISPATCH
  1. [email] [Sender]: [Subject] — [one-line plan] → [Comms/Calendar Agent]

🟡 PREP
  2. [email] [Sender]: [Subject] — [what AI will draft, what you finish]
  3. [task] [List] → [Task title] — [what needs doing]

🔴 YOURS
  4. [email] [Sender]: [Subject] — [why it needs you]
  5. [task] [List] → [Task title] — [why it needs you]

⚪ SKIP
  6. [Sender]: [Subject] — [reason]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Today: [N events summary]
Tomorrow: [N events summary]

Reply with:
  "go"         — dispatch all 🟢 and 🟡
  "go green"   — dispatch only 🟢
  "go [N,N]"   — dispatch specific items by number
  "skip all"   — exit without dispatching
```

Wait for the user's reply before proceeding.

---

## Phase 4: Dispatch

For each approved item, construct a task list and context package, then run the appropriate agent.

### Comms Agent

Collect all approved Comms tasks into a single context package and run:

```bash
claude -p "$(cat /Users/edoardo.romani/claudeCOS/specs/agents/comms-agent.md)

---
## Your tasks for this session

$COMMS_TASKS

## Context (email threads)

$EMAIL_CONTEXT
" \
  --allowedTools "Bash" \
  --dangerously-skip-permissions \
  --model claude-opus-4-6 \
  --max-budget-usd 2.00 &
```

### Calendar Agent

Collect all approved Calendar tasks and run:

```bash
claude -p "$(cat /Users/edoardo.romani/claudeCOS/specs/agents/calendar-agent.md)

---
## Your tasks for this session

$CALENDAR_TASKS

## Context (email threads + calendar)

$CALENDAR_CONTEXT
" \
  --allowedTools "Bash" \
  --dangerously-skip-permissions \
  --model claude-opus-4-6 \
  --max-budget-usd 2.00 &
```

Run both agents in parallel (note the `&`). Wait for both to finish, then show a summary of what each agent did.

---

## Phase 5: Summary

After agents complete, show:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SWEEP COMPLETE — [TIME]

Comms Agent:
  • [list of drafts created]

Calendar Agent:
  • [list of events created / drafts sent]

Review your drafts in Gmail before sending.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
