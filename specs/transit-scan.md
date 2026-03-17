# Calendar Transit Scanner

You are running as an automated agent. Do not ask for confirmation — complete all steps.

## What you do

Scan tomorrow's Google Calendar for events at physical locations, calculate public transit times, and create buffer events so the calendar shows when to leave.

## Step 0: Determine the 7-day scan window

Run the following to get the dates for the next 7 days (tomorrow through 7 days out):
```
for i in 1 2 3 4 5 6 7; do date -v+${i}d +%Y-%m-%d; done
```

Process each date independently, in order.

## Step 1: Fetch events for each day

For each date in the 7-day window:
```
node /Users/edoardo.romani/claudeCOS/scripts/calendar-api.js list-events "edo.romani1@gmail.com" "<DATE>"
```

Sort events by start time. Process Steps 2–7 fully for each day before moving to the next.

## Step 2: Filter events that need transit blocks

For each event, skip it if ANY of the following are true:
- Location contains a URL (zoom.us, meet.google.com, teams.microsoft.com, whereby.com, etc.) — it's a virtual meeting
- Location matches the office address: "240 Blackfriars Rd, London SE1 8NW" (or close variation)
- The event title starts with "Transit →" — it's already a transit block
- The event status is "cancelled"
- It is an all-day event (no specific start/end time)

**If the location field is empty or null**, do not immediately skip — attempt to infer a physical location from the event title and description:

### Location inference rules

**Airport codes** — if the title or description contains an IATA airport code, resolve it to a full address:
- LGW → London Gatwick Airport, Gatwick, RH6 0NP
- LHR → London Heathrow Airport, Hounslow TW6 2GW
- LCY → London City Airport, Hartmann Rd, London E16 2PX
- STN → London Stansted Airport, Stansted CM24 1QW
- LTN → London Luton Airport, Luton LU2 9LY
- SEN → London Southend Airport, Eastwoodbury Crescent, Southend-on-Sea SS2 6YF
- For flights: use the departure airport code (the first code in the route, e.g. LGW in "LGW 12:25 - LPA 16:55")

**Address-like text** — if the description contains a street address, postcode, or named venue, use it as the location.

**Hotel or venue name** — if the title or description mentions a hotel, conference centre, or named venue with enough detail to geocode, use it.

**Flight events** — if the event looks like a flight (title contains "flight", "fly", an airline code like BA/EZY/FR/U2/TOM, or a flight number pattern like "BA 2712"), always create two blocks:

1. **Airport block** (always 2 hours, ends at departure):
   - Title: "Airport — Check-in & Security"
   - Start: departure time − 2 hours
   - End: departure time
   - Description: "Check-in and security for [event title]. Created by COS."

2. **Transit block** (ends at start of airport block, i.e. departure time − 2 hours):
   - Title: "Transit → [event title]"
   - **If the departure airport address is known** (resolved from IATA code above): call travel-time.js from the appropriate origin (home or office based on time of day) to the airport address. Use the actual result as the block duration.
   - **If the departure airport is unknown**: use 60 minutes as the fallback duration.
   - Start: (departure time − 2 hours) − transit duration
   - End: departure time − 2 hours
   - Description: "Transit to airport. [actual time from Maps API, or '60 min estimated — add departure airport code for exact time']. Created by COS."

Check for overlaps with existing events for both blocks before creating them. Post-event transit block is not applicable for departing flights.

If no location can be inferred and it is not a flight event, then skip the event.

Keep only events with confirmed or inferred real physical locations outside the office.

## Step 3: For each qualifying event, determine origin

Check the sorted event list for the most recent event before this one that had a physical location (excluding office). If found, use that location as the origin.

If no prior location event exists:
- If the event starts between 09:00 and 19:00 (office hours): origin = "240 Blackfriars Rd, London SE1 8NW"
- Otherwise: origin = "5 Highbury Crescent, N5 1RN, London"

## Step 4: Calculate transit time

```
node /Users/edoardo.romani/claudeCOS/travel-time.js "<origin>" "<destination>"
```

The script returns JSON: `{ minutes, display, distance }`.

If the result is less than 5 minutes, skip this event — it's walking distance.

Add a 5-minute buffer to the transit time for station exit / walking to venue.
Total block duration = transit minutes + 5.

## Step 5: Check for existing transit blocks

Before creating any block, re-check the events list:
- If a "Transit →" event already exists immediately before this event (ending within 5 min of event start), skip creating the pre-event block
- If a "Transit →" event already exists immediately after this event, skip the post-event block

## Step 6: Create pre-event transit block

Title: `Transit → [Event Name]`
End time: event start time
Start time: event start time minus total block duration (in minutes)
Calendar: `edo.romani1@gmail.com`

Check that this block does not overlap any existing event. If it would overlap, shorten it to fit (but never below the actual transit time — if it can't fit, skip and log a warning).

Create the event:
```
node /Users/edoardo.romani/claudeCOS/scripts/calendar-api.js create-event "edo.romani1@gmail.com" '<JSON>'
```

Event JSON format:
```json
{
  "summary": "Transit → [Event Name]",
  "start": { "dateTime": "2026-03-18T09:15:00+00:00", "timeZone": "Europe/London" },
  "end":   { "dateTime": "2026-03-18T09:45:00+00:00", "timeZone": "Europe/London" },
  "description": "Transit from [origin] to [destination]. Journey: [display time]. Created by COS.[If location was inferred: ' Location inferred from event description.']"
}
```

Use the correct UTC offset for London (GMT+0 in winter, BST/GMT+1 in summer).

## Step 7: Create post-event transit block

Determine the destination for the return leg:
- If another qualifying event follows later in the day: destination = that event's location
- If the post-event time is within office hours (before 19:00): destination = office
- Otherwise: destination = home

Calculate transit time from event location to that destination (same as Step 4).
If under 5 minutes, skip.

Title: `Transit → [Next Destination Label]`
(Use "Office", "Home", or the next event name as the destination label)
Start time: event end time
End time: event end time + total block duration

Check for overlaps with existing events. If overlap, skip and log a warning.

Create the event using the same format as Step 6.

## Step 8: Log summary

After processing all 7 days, print a summary:
```
Transit scan — [RUN DATE] (window: +1 to +7 days)
Days scanned: 7
Total events scanned: N
Qualifying events (physical location): N
Transit blocks created: N
Skipped (virtual/office/under 5 min): N
Skipped (overlap): N
Warnings: [list any]
```

## Safety rules

- NEVER delete or modify existing calendar events
- NEVER create transit blocks that overlap existing events
- ONLY use Bash (calendar-api.js, travel-time.js), no other tools
- If travel-time.js fails for an address, skip that event and log a warning — do not abort the whole run
