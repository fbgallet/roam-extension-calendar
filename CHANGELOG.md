## v.7 (30th January, 2026) Google OAuth fixe

### Updates

- If no custom tag defined for a Google calendar, `#[[Google calendar]]` tag will be used by default
- Subtler calendar lines, especially in dark mode & smaller calendar buttons
- Hide tags from events title & tooltip
- Only enabled Google calendars are now visible in Google calendar tag popover

### Fixes

- IMPORTANT: Google Authentification now works in Roam Desktop app (and a warning is displayed if your browser don't allow popup)
- better Gcal automatic re-authentification
- adding timestamps to an existing synced event now update it properly in Gcal
- User clicking on 'Confirm' button to create a 2-sync way event while editing the corresponding Roam block was preventing the auto-insertion of Google calendar tag
- Updating aliases for Google calendars in tag popover now works better

## v.6 (5th January, 2026) Google Calendar integration

### New feature

- complete support of Google Calendar import/export/2-way sync

### Fixes

- Events spanning multiple months were only visible in the starting month
- more stable multidays events and timestamps
- redundant timestamps and tags are not more displayed in the event or tooltip
- it was impossible to display events after 23:00 on timegrid
- block references in events are now resolved
- external drag & drop to timegrid was broken
- drag & drop with 12h format time was broken

## v.5 (October 22nd, 2024) Drag&drop tag

### Updates

- Drag&Drop an event tag from the filter bar to create a new event
- 12-hour format full support

### Fixes

- more consistent loading of data from DNP (better support of large amount of data, but loading time is now a bit slower)
- "not tagged" tag state was not persistent
- cancel button in dialog to remove user tag was not working
- modifier keys when dragging a block into the calender are now consistant with native Roam behavior

## v.4 (August 6th, 2024) Multi-day events

### Updates

- **multi-day events**, fully supported
- better support of direct children informations (tags + dates)
- user tags can now have aliases (directly in the tag popup) and be deleted
- temporary tags can be added to permanent user tags
- a timestamp is automatically inserted when creating an event in a timegrid view
- option to display subtasks as distinct events
- option to set monday or sunday as first day of week
- option to sort events in alphanumeric order or according to blocks order

### Fixes

- **important**: changing `#calendar` tag in the settings was not properly taken into account
- resizing an event in week or day view was not properly updating the timestamp in the block (since v.3)
- the filter bar no longer worked after clicking on "not tagged"
- events consisting of a single block ref or embed are displayed as block ref or embed in the event popover

## v.3 (July 18th, 2024) IMPORTANT fixes

### Fixes

- MAJOR FIX: creating a new event (or dragging one) on a DNP not yet existing was not creating DNP properly (see Roam Slack #general channel for infos)
- support CJK text in user defined tags in settings
- pinned calendar background was transparent in vanilla Roam theme
- queries (mistakenly taken for events) are now being ignored
- other small fixes

### Updates

- support multiple days events (not fully documented yet)
- informations (tags, dates) in the direct children of an event are taken into account
- handle events consisting of a single block reference or an embed

## v.2 (June 15th, 2024) small fixes

- fixed an issue with checkboxes in events

