# Daily Inbox Scan

You are running as an automated agent. Do not ask for confirmation — complete all steps and write the output file.

## Step 0: Determine date range

Check whether a state file exists at `~/.config/cos/last-inbox-scan`:
- If it exists: scan emails received since that timestamp
- If it does not exist: scan emails received in the last 24 hours

Use `date -u +"%Y-%m-%dT%H:%M:%SZ"` to get the current timestamp. Use `cat ~/.config/cos/last-inbox-scan` to read the last-run time.

Today's digest date: use `date +"%Y-%m-%d"` for the filename.

## Step 1: Search Gmail

Use the gmail-api.js script to search for emails since the last scan:

```
node /Users/edoardo.romani/claudeCOS/scripts/gmail-api.js search "after:YYYY/MM/DD -category:promotions -category:social -category:updates -category:forums"
```

Replace YYYY/MM/DD with the date from the state file (or yesterday's date if no state file).

Scan each result by subject and snippet. Skip anything that is clearly:
- An automated notification or system alert (noreply, no-reply, notification@ senders)
- A newsletter or mailing list message
- A receipt, invoice confirmation, or shipping update with no action needed

For anything potentially actionable, read the full message:

```
node /Users/edoardo.romani/claudeCOS/scripts/gmail-api.js read <messageId>
```

## Step 1b: Read Google Tasks

Fetch all incomplete tasks:

```
node /Users/edoardo.romani/claudeCOS/scripts/tasks-api.js list
```

Each task has: `title`, `notes`, `due` (ISO date or null), `listTitle` (which task list it belongs to).

Include every incomplete task in the items to classify. A task with a `due` date today or earlier is treated as at least P2. Tasks with no due date are P3 by default unless the title/notes indicate urgency.

## Step 2: Classify

An email or task is **actionable** if it contains any of:
- A direct question requiring an answer
- An assigned task or deliverable
- A scheduling request or meeting invitation
- A commitment you made that needs follow-up
- A decision being waited on

Assign each actionable email a priority:

- **P1** — Hard consequence if missed. Revenue, legal, health, or relationship damage. "If I miss this, something bad happens I can't fix next week."
- **P2** — Time-sensitive with compounding delay cost. "Delay narrows my options or creates a crunch later."
- **P3** — Important, flexible timing. "I'd be annoyed if this slipped a few days, but a week is fine."
- **P4** — Do when there's space. "If this disappeared for two weeks, I wouldn't notice."

When uncertain, assign P3 rather than P4.

## Step 3: Create drafts

For **P1 and P2 emails that require a reply**, create a Gmail draft using:

```
node /Users/edoardo.romani/claudeCOS/scripts/gmail-api.js draft <threadId> "<to>" "<subject>" "<body>"
```

In the original thread:
- Match the tone and formality of the thread
- Acknowledge the request and indicate a response or next step
- Keep it concise — this is a starting point for review, not a final send
- Do NOT finalize anything involving pricing, contracts, legal matters, or sensitive relationship decisions — draft those too, but they need human review before sending

For P3 and P4: list in the digest only, no draft needed unless the action is simple and clearly defined.

## Step 4: Write the digest

Create the directory `/Users/edoardo.romani/claudeCOS/digests/` if it does not exist.

Write the digest to `/Users/edoardo.romani/claudeCOS/digests/YYYY-MM-DD.md` using today's date.

Use this format:

```
# Inbox Digest — YYYY-MM-DD

## P1 — Act today
- **[email]** [Sender name]: [Subject] — [One sentence: what's needed and why it matters]
  Draft created: yes / no
- **[task]** [List name] → [Task title] — [One sentence summary]

## P2 — Soon
- **[email]** [Sender name]: [Subject] — [One sentence summary]
  Draft created: yes / no
- **[task]** [List name] → [Task title] — due [date if present]

## P3 — This week
- **[email]** [Sender name]: [Subject] — [One sentence summary]
- **[task]** [List name] → [Task title]

## P4 — When there's space
- **[email]** [Sender name]: [Subject] — [One sentence summary]
- **[task]** [List name] → [Task title]

---
## Run stats
- Emails scanned: N
- Tasks found: N
- Actionable found: N
- Drafts created: N
- Last scan was: [timestamp from state file, or "first run"]
```

If no actionable items are found in a section, write "None."

## Step 5: Update state

Write the current UTC timestamp to `~/.config/cos/last-inbox-scan` using:
`date -u +"%Y-%m-%dT%H:%M:%SZ" > ~/.config/cos/last-inbox-scan`

## Safety rules

- NEVER send emails — create drafts only
- NEVER delete, archive, star, or modify emails
- NEVER access calendar, filesystem paths outside those listed above, or any MCP tools — use only Bash (gmail-api.js), Read, and Write
- If you hit an error on one email, skip it and continue — do not abort the whole run
