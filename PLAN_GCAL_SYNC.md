# Google Calendar Two-Way Synchronization - Implementation Plan

## Overview

This plan outlines the implementation of a robust two-way synchronization between your Full Calendar (FC) extension and Google Calendar (GC). The implementation is divided into phases to ensure each component works correctly before building on it.

---

## Phase 1: Authentication & Persistent Token Management

### Current Issues
- Token is requested on every session
- `googleCalToken` is stored but not properly reused
- Token refresh mechanism is missing

### Implementation Steps

#### 1.1 Create Google Calendar Service Module
**New file:** `src/services/googleCalendarService.js`

This module will centralize all Google Calendar API interactions:

```
- Token storage and retrieval from extensionStorage
- Token refresh logic (refresh tokens expire, access tokens need periodic refresh)
- Automatic re-authentication when tokens expire
- API request wrapper with error handling
```

Key functions:
- `initGoogleAuth()` - Initialize GAPI client and restore saved tokens
- `authenticate()` - Trigger OAuth flow if needed
- `refreshTokenIfNeeded()` - Check token expiry and refresh
- `isAuthenticated()` - Check current auth status
- `signOut()` - Revoke tokens and clear storage
- `getAccessToken()` - Get valid access token (refresh if needed)

#### 1.2 Token Storage Schema
Store in `extensionStorage`:
```javascript
{
  "gcal-access-token": string,
  "gcal-refresh-token": string,  // Note: OAuth implicit flow doesn't provide refresh tokens
  "gcal-token-expiry": number,   // Timestamp
  "gcal-connected-calendars": [  // Array of connected calendars
    {
      id: string,                // GCal calendar ID
      name: string,              // Display name
      color: string,             // Calendar color
      tagName: string,           // Associated FC tag name
      syncEnabled: boolean,      // Whether to sync events
      syncDirection: "import" | "export" | "both",
      lastSyncTime: number       // Timestamp of last sync
    }
  ]
}
```

**Important Note:** The current OAuth implicit flow (`@react-oauth/google`) doesn't provide refresh tokens. For persistent sessions, you'll need to:
1. Use the authorization code flow (requires backend), OR
2. Silently re-authenticate using `prompt: 'none'` when the page loads, OR
3. Store the token and re-authenticate when it expires (less seamless)

**Recommended approach:** Use silent re-authentication with `prompt: 'none'` on extension load.

---

## Phase 2: Calendar Configuration UI

### 2.1 Google Calendar Tag Enhancement

Modify the "Google calendar" tag in `mapOfTags` to support multiple connected calendars. Currently it's a single tag - we'll extend it to be a "parent" tag with sub-tags for each connected calendar.

#### 2.2 Create GCalConfigDialog Component
**New file:** `src/components/GCalConfigDialog.jsx`

A dialog accessible from the TagPopover when clicking on "Google Calendar" tag:

```
+----------------------------------------+
|  Google Calendar Configuration    [X]  |
+----------------------------------------+
| Connection Status: [Connected/Not]     |
| [Connect to Google] or [Disconnect]    |
+----------------------------------------+
| Connected Calendars:                   |
|                                        |
| [+] Add Calendar                       |
|                                        |
| +----------------------------------+   |
| | My Calendar          [Primary]  |   |
| | Color: [picker] Tag: [Work]     |   |
| | Sync: [Import only v]           |   |
| | [Remove]                        |   |
| +----------------------------------+   |
|                                        |
| +----------------------------------+   |
| | Birthdays                        |   |
| | Color: [picker] Tag: [Personal] |   |
| | Sync: [Import only v]           |   |
| | [Remove]                        |   |
| +----------------------------------+   |
+----------------------------------------+
| Sync Settings:                         |
| [ ] Auto-sync new FC events to GCal    |
| Sync interval: [Manual / 5min / 15min] |
+----------------------------------------+
|           [Save]    [Cancel]           |
+----------------------------------------+
```

Features:
- List user's Google calendars (from `calendarList.list()`)
- Select which calendars to connect
- Assign FC tag to each calendar (creates EventTag if needed)
- Set sync direction per calendar
- Configure auto-sync behavior

#### 2.3 Modify TagPopover for Google Calendar
Enhance `TagPopover.jsx` to detect when the tag is "Google calendar" and show:
- Connection status
- "Configure" button that opens `GCalConfigDialog`
- Quick "Refresh" button to force sync

---

## Phase 3: Data Model Extensions

### 3.1 Extend Event Object for Sync Tracking
Add new `extendedProps` for synchronized events:

```javascript
extendedProps: {
  // Existing props...
  gCalId: string,          // Google Calendar event ID
  gCalCalendarId: string,  // Which GCal calendar it belongs to
  gCalEtag: string,        // For conflict detection
  gCalUpdated: string,     // ISO timestamp of last GCal update
  roamUpdated: number,     // Timestamp of last Roam update
  syncStatus: "synced" | "pending" | "conflict" | "local-only" | "gcal-only",
  needsSync: boolean,      // Flag for pending sync
}
```

### 3.2 Create Sync Metadata Block in Roam
For each synced event, store sync metadata in a child block:
```
Event Title #tag
  - fc-sync:: {"gCalId": "abc123", "gCalCalendarId": "primary", "etag": "xyz", "lastSync": 1234567890}
```

This allows persistence even when the extension is unloaded.

### 3.3 Extend EventTag for Calendar Association
Add to `EventTag` class:
```javascript
{
  // Existing...
  gCalCalendarId: string | null,  // Associated GCal calendar ID
  isGCalTag: boolean,             // Whether this tag represents a GCal calendar
}
```

---

## Phase 4: Import GCal Events to FC (Read)

### 4.1 Event Fetching Enhancement
Modify `getGcalEvents()` in `CalendarApp.jsx` or new service:

```javascript
async function fetchGCalEvents(calendarId, timeMin, timeMax) {
  // Returns full event objects with all metadata
  // Handles pagination for large result sets
  // Includes deleted events for sync purposes (showDeleted: true, updatedMin)
}
```

### 4.2 Event Mapping: GCal -> FC
Create mapping function in `src/util/gcalMapping.js`:

```javascript
function gcalEventToFCEvent(gcalEvent, calendarConfig) {
  return {
    id: `gcal-${gcalEvent.id}`,  // Prefix to distinguish from Roam UIDs
    title: gcalEvent.summary,
    start: gcalEvent.start.dateTime || gcalEvent.start.date,
    end: gcalEvent.end.dateTime || gcalEvent.end.date,
    allDay: !gcalEvent.start.dateTime,
    classNames: ["fc-event-gcal"],
    extendedProps: {
      eventTags: [getTagForCalendar(calendarConfig.tagName)],
      isRef: false,
      gCalId: gcalEvent.id,
      gCalCalendarId: calendarConfig.id,
      gCalEtag: gcalEvent.etag,
      gCalUpdated: gcalEvent.updated,
      description: gcalEvent.description,
      location: gcalEvent.location,
      syncStatus: "gcal-only",
    },
    color: calendarConfig.color,
    editable: calendarConfig.syncDirection !== "import", // Read-only if import-only
    url: gcalEvent.htmlLink,
  };
}
```

### 4.3 Display GCal Events in FC
Events from GCal are displayed but marked as "external" until imported to Roam:
- Show with GCal icon overlay
- Click shows event details in popover
- "Import to Roam" button creates Roam block

### 4.4 Import Event to Roam
**New function:** `importGCalEventToRoam(fcEvent)`

```javascript
async function importGCalEventToRoam(event) {
  // 1. Create block under calendar tag on appropriate DNP
  // 2. Add sync metadata as child block
  // 3. Update event's syncStatus to "synced"
  // 4. Link Roam block UID to GCal event
}
```

---

## Phase 5: Export FC Events to GCal (Write)

### 5.1 Sync Trigger Options

1. **Manual sync via button** - User clicks sync icon on event
2. **Tag-based sync** - Event has `#gcal` or similar trigger tag
3. **Auto-sync** - All events created in FC UI auto-sync (configurable)

### 5.2 Event Mapping: FC -> GCal
Create mapping function:

```javascript
function fcEventToGCalEvent(fcEvent, calendarId) {
  return {
    summary: cleanTitle(fcEvent.title),  // Remove Roam syntax
    description: fcEvent.extendedProps.description,
    start: fcEvent.allDay
      ? { date: fcEvent.start }
      : { dateTime: fcEvent.start, timeZone: userTimezone },
    end: fcEvent.allDay
      ? { date: fcEvent.end || addDay(fcEvent.start) }
      : { dateTime: fcEvent.end, timeZone: userTimezone },
    // Don't include id - let GCal generate it for new events
  };
}
```

### 5.3 Create/Update GCal Event

```javascript
async function syncEventToGCal(fcEvent, calendarId) {
  const gcalEvent = fcEventToGCalEvent(fcEvent, calendarId);

  if (fcEvent.extendedProps.gCalId) {
    // Update existing
    return await gapi.client.calendar.events.update({
      calendarId,
      eventId: fcEvent.extendedProps.gCalId,
      resource: gcalEvent,
    });
  } else {
    // Create new
    const result = await gapi.client.calendar.events.insert({
      calendarId,
      resource: gcalEvent,
    });
    // Store gCalId in Roam block metadata
    await updateSyncMetadata(fcEvent.id, result.result);
    return result;
  }
}
```

### 5.4 UI for Sync Trigger
Modify `Event.jsx` popover to show:
- Sync status indicator (icon: synced/pending/conflict)
- "Sync to Google Calendar" button (if not synced)
- Calendar selector dropdown (which GCal to sync to)

Modify `NewEventDialog.jsx`:
- Already has "Confirm & sync to GCal" - enhance to select target calendar

---

## Phase 6: Two-Way Sync & Conflict Resolution

### 6.1 Change Detection

#### On FC/Roam Side:
- Track `roamUpdated` timestamp when block is edited
- Use Roam's `onchange` listeners or poll for changes
- Compare with `gCalUpdated` to detect which is newer

#### On GCal Side:
- Use `updatedMin` parameter in events.list() for incremental sync
- Store `lastSyncTime` per calendar
- Compare `etag` values for conflict detection

### 6.2 Sync Algorithm

```
For each connected calendar:
  1. Fetch GCal events updated since lastSyncTime
  2. For each updated GCal event:
     a. Find matching Roam event (by gCalId in metadata)
     b. If no match: Display as gcal-only (import prompt)
     c. If match exists:
        - Compare timestamps (gCalUpdated vs roamUpdated)
        - If gCalUpdated > roamUpdated: Update Roam block
        - If roamUpdated > gCalUpdated: Update GCal event
        - If both changed: Mark as conflict

  3. For each Roam event with needsSync=true:
     a. If has gCalId: Update GCal
     b. If no gCalId and should sync: Create in GCal

  4. Update lastSyncTime
```

### 6.3 Conflict Resolution UI
When conflict detected, show dialog:

```
+----------------------------------------+
|  Sync Conflict Detected           [X]  |
+----------------------------------------+
| Event: "Team Meeting"                  |
|                                        |
| Roam version (modified 2 hours ago):   |
| - Title: Team Meeting                  |
| - Time: 10:00 - 11:00                  |
|                                        |
| Google version (modified 1 hour ago):  |
| - Title: Team Meeting (Updated)        |
| - Time: 10:30 - 11:30                  |
|                                        |
| [Keep Roam] [Keep Google] [Keep Both]  |
+----------------------------------------+
```

### 6.4 Deleted Event Handling
- When Roam event deleted: Delete from GCal (if synced)
- When GCal event deleted: Remove from FC display, optionally archive Roam block
- Use `showDeleted: true` in GCal API to detect deletions

---

## Phase 7: File Structure & Module Organization

### New Files to Create:

```
src/
├── services/
│   ├── googleCalendarService.js    # Auth & API wrapper
│   └── syncService.js              # Sync logic
├── components/
│   ├── GCalConfigDialog.jsx        # Configuration dialog
│   ├── GCalEventDetails.jsx        # Event details popover for GCal events
│   ├── SyncStatusIndicator.jsx     # Visual sync status
│   └── ConflictDialog.jsx          # Conflict resolution UI
├── util/
│   └── gcalMapping.js              # Event transformation utilities
└── models/
    └── SyncMetadata.js             # Sync metadata handling
```

### Files to Modify:

```
src/
├── index.js                        # Add GCal initialization
├── components/
│   ├── Calendar.jsx                # Integrate sync triggers
│   ├── Event.jsx                   # Add sync button & status
│   ├── NewEventDialog.jsx          # Calendar selector for sync
│   ├── TagPopover.jsx              # GCal config button
│   └── MultiSelectFilter.jsx       # GCal tag special handling
└── models/
    └── EventTag.js                 # Add GCal calendar association
```

---

## Phase 8: Implementation Order

### Step 1: Foundation (Phase 1 + 3)
1. Create `googleCalendarService.js` with persistent auth
2. Extend `EventTag` model for GCal association
3. Test: Can authenticate once and stay connected

### Step 2: Configuration UI (Phase 2)
1. Create `GCalConfigDialog.jsx`
2. Modify `TagPopover.jsx` for Google Calendar tag
3. Test: Can connect calendars and assign tags

### Step 3: Import Flow (Phase 4)
1. Implement enhanced event fetching
2. Create mapping utilities
3. Display GCal events in FC
4. Implement "Import to Roam" function
5. Test: GCal events appear in FC, can import to Roam

### Step 4: Export Flow (Phase 5)
1. Implement FC->GCal mapping
2. Add sync button to Event popover
3. Enhance NewEventDialog with calendar selector
4. Test: Can create events in FC and sync to GCal

### Step 5: Two-Way Sync (Phase 6)
1. Implement change detection
2. Build sync algorithm
3. Create conflict resolution UI
4. Handle deletions
5. Test: Changes propagate both directions, conflicts detected

### Step 6: Polish
1. Add sync status indicators throughout UI
2. Implement auto-sync options
3. Add error handling and retry logic
4. Performance optimization (batch operations)

---

## Technical Considerations

### OAuth Token Persistence Challenge

The current `@react-oauth/google` with implicit flow has a limitation: tokens expire after ~1 hour and there's no refresh token. Options:

1. **Silent re-authentication (Recommended for client-only)**
   - On extension load, try `google.accounts.oauth2.initTokenClient` with `prompt: 'none'`
   - If user has previously authorized, get new token silently
   - If fails, show "Reconnect" button

2. **Backend service (Better for production)**
   - Set up small backend for authorization code flow
   - Backend exchanges code for tokens, stores refresh token
   - Frontend requests tokens from backend
   - More complex but more robust

### Rate Limiting
- Google Calendar API has quotas (1,000,000 queries/day, but 100 queries/100 seconds/user)
- Implement request batching for multiple events
- Add exponential backoff for retries

### Offline Support
- Cache GCal events in extensionStorage for offline viewing
- Queue sync operations when offline, execute when online

### Performance
- Use incremental sync (`updatedMin` parameter) instead of full fetches
- Batch Roam block updates
- Lazy load GCal events outside visible date range

---

## Design Decisions (Confirmed)

1. **Tag-to-Calendar Mapping**: Each connected GCal calendar has one or more **trigger tags** (aliases). Using any of these tags on an event triggers sync to that specific calendar.
   - Example: Primary Calendar → tags: `gcal`, `work`
   - Example: Personal Calendar → tags: `personal`, `family`
   - A "default" calendar receives events with the generic `#gcal` tag

2. **Default Sync Behavior**: User choice in settings, **default is "never"** - user must explicitly:
   - Add a trigger tag to the event, OR
   - Click the sync button on the event

3. **Conflict Resolution**: **Always ask user** via conflict dialog showing both versions

4. **Multi-Calendar Support**: Build for **multiple calendars from the start**

5. **Architecture**: **Client-only** solution using silent re-authentication (`prompt: 'none'`)

---

## Updated Storage Schema

```javascript
{
  "gcal-access-token": string,
  "gcal-token-expiry": number,
  "gcal-connected-calendars": [
    {
      id: string,                    // GCal calendar ID (e.g., "primary", "abc123@group.calendar.google.com")
      name: string,                  // Display name from GCal
      color: string,                 // Color for FC display
      triggerTags: string[],         // Tags that trigger sync (e.g., ["gcal", "work"])
      isDefault: boolean,            // Is this the default calendar for #gcal?
      syncEnabled: boolean,          // Whether sync is active
      syncDirection: "import" | "export" | "both",
      lastSyncTime: number           // Timestamp of last sync
    }
  ],
  "gcal-auto-sync": "never" | "always" | "ask",  // Default: "never"
  "gcal-sync-interval": number | null            // Minutes between auto-checks, null = manual only
}
```

---

## Summary

This plan provides a comprehensive roadmap for implementing two-way Google Calendar synchronization. The phased approach allows for incremental development and testing. Key features:

- **Persistent authentication** via silent re-auth
- **Multi-calendar support** with per-calendar sync settings
- **Flexible sync triggers** (manual, tag-based, auto)
- **Conflict detection and resolution**
- **Clean separation of concerns** in code organization

Estimated complexity: This is a significant feature that will require careful implementation. Recommend starting with Phase 1 (auth) and Phase 4 (import) to establish the foundation before adding export and two-way sync.
