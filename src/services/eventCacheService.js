/**
 * Event Cache Service - Handles localStorage-based caching of ALL calendar events
 *
 * Caches events by month to enable:
 * - Fast display without API calls on every view change
 * - Offline support (cached data available when API fails)
 * - Reduced API quota usage
 *
 * Caches three types of events:
 * - Roam events (from DNP blocks)
 * - Google Calendar events
 * - Google Tasks
 */

const CACHE_PREFIX = "gcal-events-cache-";
const ALL_EVENTS_CACHE_PREFIX = "all-events-cache-";
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Generate cache key for a specific month
 * @param {number} year - Full year (e.g., 2024)
 * @param {number} month - Month (0-11)
 * @returns {string} Cache key
 */
const getCacheKey = (year, month) => {
  const monthStr = String(month + 1).padStart(2, "0");
  return `${CACHE_PREFIX}${year}-${monthStr}`;
};

/**
 * Get cached events for a specific month
 * @param {number} year - Full year
 * @param {number} month - Month (0-11)
 * @returns {object|null} Cached data or null if not found
 */
export const getCachedEvents = (year, month) => {
  try {
    const key = getCacheKey(year, month);
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.error("[EventCache] Error reading cache:", error);
    return null;
  }
};

/**
 * Store events in cache for a specific month
 * @param {number} year - Full year
 * @param {number} month - Month (0-11)
 * @param {array} events - Array of FullCalendar events
 * @param {array} calendarIds - IDs of calendars included in this cache
 */
export const setCachedEvents = (year, month, events, calendarIds = []) => {
  try {
    const key = getCacheKey(year, month);
    const cacheData = {
      events,
      calendarIds,
      fetchedAt: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(cacheData));
    console.log(`[EventCache] Cached ${events.length} events for ${year}-${month + 1}`);
  } catch (error) {
    console.error("[EventCache] Error writing cache:", error);
    // If localStorage is full, try to clean up old cache entries
    cleanupOldCacheEntries();
  }
};

/**
 * Check if cache is valid for a specific month
 * @param {number} year - Full year
 * @param {number} month - Month (0-11)
 * @param {boolean} isOffline - If true, ignore TTL and accept any cached data
 * @returns {boolean} True if cache is valid
 */
export const isCacheValid = (year, month, isOffline = false) => {
  const cached = getCachedEvents(year, month);
  if (!cached) return false;

  // In offline mode, any cached data is valid
  if (isOffline) return true;

  // Check TTL
  const age = Date.now() - cached.fetchedAt;
  return age < CACHE_TTL_MS;
};

/**
 * Get events from cache for a date range
 * Returns cached events if available and valid for all months in range
 * @param {Date} startDate - Start of range
 * @param {Date} endDate - End of range
 * @param {boolean} isOffline - If true, accept stale cache
 * @returns {object} { events: array, isComplete: boolean, missingMonths: array }
 */
export const getCachedEventsForRange = (startDate, endDate, isOffline = false) => {
  const events = [];
  const missingMonths = [];
  const seenEventIds = new Set();

  // Iterate through all months in the range
  let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while (current <= endMonth) {
    const year = current.getFullYear();
    const month = current.getMonth();

    if (isCacheValid(year, month, isOffline)) {
      const cached = getCachedEvents(year, month);
      if (cached && cached.events) {
        // Add events, avoiding duplicates
        for (const event of cached.events) {
          const eventId = event.id || event.extendedProps?.gCalId;
          if (eventId && !seenEventIds.has(eventId)) {
            seenEventIds.add(eventId);
            events.push(event);
          }
        }
      }
    } else {
      missingMonths.push({ year, month });
    }

    // Move to next month
    current.setMonth(current.getMonth() + 1);
  }

  return {
    events,
    isComplete: missingMonths.length === 0,
    missingMonths,
  };
};

/**
 * Invalidate cache for specific months or all cache
 * @param {number} year - Full year (optional, if omitted clears all)
 * @param {number} month - Month (optional)
 */
export const invalidateCache = (year, month) => {
  try {
    if (year !== undefined && month !== undefined) {
      // Invalidate specific month
      const key = getCacheKey(year, month);
      localStorage.removeItem(key);
      console.log(`[EventCache] Invalidated cache for ${year}-${month + 1}`);
    } else {
      // Invalidate all cache entries
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }
      console.log(`[EventCache] Invalidated all cache (${keysToRemove.length} entries)`);
    }
  } catch (error) {
    console.error("[EventCache] Error invalidating cache:", error);
  }
};

/**
 * Update a single event in the cache (after sync operation)
 * @param {object} event - Updated FullCalendar event
 */
export const updateEventInCache = (event) => {
  const eventId = event.id || event.extendedProps?.gCalId;
  if (!eventId) return;

  const startDate = new Date(event.start);
  const year = startDate.getFullYear();
  const month = startDate.getMonth();

  const cached = getCachedEvents(year, month);
  if (!cached || !cached.events) return;

  const eventIndex = cached.events.findIndex(
    (e) => (e.id || e.extendedProps?.gCalId) === eventId
  );

  if (eventIndex !== -1) {
    cached.events[eventIndex] = event;
    setCachedEvents(year, month, cached.events, cached.calendarIds);
    console.log(`[EventCache] Updated event ${eventId} in cache`);
  }
};

/**
 * Remove an event from the cache (after deletion)
 * @param {string} eventId - Event ID to remove
 * @param {Date} eventDate - Date of the event (to find correct cache)
 */
export const removeEventFromCache = (eventId, eventDate) => {
  if (!eventId || !eventDate) return;

  const year = eventDate.getFullYear();
  const month = eventDate.getMonth();

  const cached = getCachedEvents(year, month);
  if (!cached || !cached.events) return;

  const eventIndex = cached.events.findIndex(
    (e) => (e.id || e.extendedProps?.gCalId) === eventId
  );

  if (eventIndex !== -1) {
    cached.events.splice(eventIndex, 1);
    setCachedEvents(year, month, cached.events, cached.calendarIds);
    console.log(`[EventCache] Removed event ${eventId} from cache`);
  }
};

/**
 * Add a new event to the cache
 * @param {object} event - New FullCalendar event
 */
export const addEventToCache = (event) => {
  const startDate = new Date(event.start);
  const year = startDate.getFullYear();
  const month = startDate.getMonth();

  const cached = getCachedEvents(year, month);
  if (!cached || !cached.events) return;

  cached.events.push(event);
  setCachedEvents(year, month, cached.events, cached.calendarIds);
  console.log(`[EventCache] Added event to cache`);
};

/**
 * Cleanup old cache entries (older than 30 days)
 * Called when localStorage is getting full
 */
const cleanupOldCacheEntries = () => {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const keysToRemove = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_PREFIX)) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (data.fetchedAt < thirtyDaysAgo) {
          keysToRemove.push(key);
        }
      } catch {
        // Invalid JSON, remove it
        keysToRemove.push(key);
      }
    }
  }

  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }

  if (keysToRemove.length > 0) {
    console.log(`[EventCache] Cleaned up ${keysToRemove.length} old cache entries`);
  }
};

// ============================================================================
// ALL EVENTS CACHE (Roam + GCal + Tasks)
// ============================================================================

/**
 * Generate cache key for all events in a specific month
 */
const getAllEventsCacheKey = (year, month) => {
  const monthStr = String(month + 1).padStart(2, "0");
  return `${ALL_EVENTS_CACHE_PREFIX}${year}-${monthStr}`;
};

/**
 * Get cached all-events for a specific month
 * @param {number} year - Full year
 * @param {number} month - Month (0-11)
 * @returns {object|null} Cached data or null if not found
 */
export const getAllCachedEvents = (year, month) => {
  try {
    const key = getAllEventsCacheKey(year, month);
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.error("[AllEventsCache] Error reading cache:", error);
    return null;
  }
};

/**
 * Store all events in cache for a specific month
 * @param {number} year - Full year
 * @param {number} month - Month (0-11)
 * @param {array} events - Array of ALL FullCalendar events (Roam + GCal + Tasks)
 */
export const setAllCachedEvents = (year, month, events) => {
  try {
    const key = getAllEventsCacheKey(year, month);
    const cacheData = {
      events,
      fetchedAt: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(cacheData));
    console.log(`[AllEventsCache] Cached ${events.length} total events for ${year}-${month + 1}`);
  } catch (error) {
    console.error("[AllEventsCache] Error writing cache:", error);
    cleanupOldCacheEntries();
  }
};

/**
 * Check if all-events cache is valid for a specific month
 * @param {number} year - Full year
 * @param {number} month - Month (0-11)
 * @param {boolean} isOffline - If true, ignore TTL and accept any cached data
 * @returns {boolean} True if cache is valid
 */
export const isAllEventsCacheValid = (year, month, isOffline = false) => {
  const cached = getAllCachedEvents(year, month);
  if (!cached) return false;
  if (isOffline) return true;
  const age = Date.now() - cached.fetchedAt;
  return age < CACHE_TTL_MS;
};

/**
 * Get all events from cache for a date range
 * @param {Date} startDate - Start of range
 * @param {Date} endDate - End of range
 * @param {boolean} isOffline - If true, accept stale cache
 * @returns {object} { events: array, isComplete: boolean, missingMonths: array }
 */
export const getAllCachedEventsForRange = (startDate, endDate, isOffline = false) => {
  const events = [];
  const missingMonths = [];
  const seenEventIds = new Set();

  let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while (current <= endMonth) {
    const year = current.getFullYear();
    const month = current.getMonth();

    if (isAllEventsCacheValid(year, month, isOffline)) {
      const cached = getAllCachedEvents(year, month);
      if (cached && cached.events) {
        for (const event of cached.events) {
          // Use id or gCalId for deduplication
          const eventId = event.id || event.extendedProps?.gCalId;
          if (eventId && !seenEventIds.has(eventId)) {
            seenEventIds.add(eventId);
            events.push(event);
          }
        }
      }
    } else {
      missingMonths.push({ year, month });
    }

    current.setMonth(current.getMonth() + 1);
  }

  return {
    events,
    isComplete: missingMonths.length === 0,
    missingMonths,
  };
};

/**
 * Invalidate all-events cache for specific months or all
 * @param {number} year - Full year (optional)
 * @param {number} month - Month (optional)
 */
export const invalidateAllEventsCache = (year, month) => {
  try {
    if (year !== undefined && month !== undefined) {
      const key = getAllEventsCacheKey(year, month);
      localStorage.removeItem(key);
      console.log(`[AllEventsCache] Invalidated cache for ${year}-${month + 1}`);
    } else {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(ALL_EVENTS_CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }
      console.log(`[AllEventsCache] Invalidated all cache (${keysToRemove.length} entries)`);
    }
  } catch (error) {
    console.error("[AllEventsCache] Error invalidating cache:", error);
  }
};

/**
 * Update a single event in the all-events cache
 * @param {object} event - Updated FullCalendar event
 */
export const updateEventInAllCache = (event) => {
  const eventId = event.id || event.extendedProps?.gCalId;
  if (!eventId) return;

  const startDate = new Date(event.start);
  const year = startDate.getFullYear();
  const month = startDate.getMonth();

  const cached = getAllCachedEvents(year, month);
  if (!cached || !cached.events) return;

  const eventIndex = cached.events.findIndex(
    (e) => (e.id || e.extendedProps?.gCalId) === eventId
  );

  if (eventIndex !== -1) {
    cached.events[eventIndex] = event;
    setAllCachedEvents(year, month, cached.events);
    console.log(`[AllEventsCache] Updated event ${eventId}`);
  } else {
    // Event not in cache yet - add it
    cached.events.push(event);
    setAllCachedEvents(year, month, cached.events);
    console.log(`[AllEventsCache] Added new event ${eventId}`);
  }
};

/**
 * Remove an event from the all-events cache
 * @param {string} eventId - Event ID to remove
 * @param {Date} eventDate - Date of the event
 */
export const removeEventFromAllCache = (eventId, eventDate) => {
  if (!eventId || !eventDate) return;

  const year = eventDate.getFullYear();
  const month = eventDate.getMonth();

  const cached = getAllCachedEvents(year, month);
  if (!cached || !cached.events) return;

  const eventIndex = cached.events.findIndex(
    (e) => (e.id || e.extendedProps?.gCalId) === eventId
  );

  if (eventIndex !== -1) {
    cached.events.splice(eventIndex, 1);
    setAllCachedEvents(year, month, cached.events);
    console.log(`[AllEventsCache] Removed event ${eventId}`);
  }
};

/**
 * Add a new event to the all-events cache
 * @param {object} event - New FullCalendar event
 */
export const addEventToAllCache = (event) => {
  const startDate = new Date(event.start);
  const year = startDate.getFullYear();
  const month = startDate.getMonth();

  let cached = getAllCachedEvents(year, month);

  // If no cache exists yet, create one
  if (!cached) {
    cached = { events: [], fetchedAt: Date.now() };
  }

  cached.events.push(event);
  setAllCachedEvents(year, month, cached.events);
  console.log(`[AllEventsCache] Added event to cache`);
};

/**
 * Get cache statistics for debugging
 * @returns {object} Cache stats
 */
export const getCacheStats = () => {
  let totalEntries = 0;
  let totalEvents = 0;
  let totalBytes = 0;
  const months = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_PREFIX)) {
      totalEntries++;
      const data = localStorage.getItem(key);
      totalBytes += data.length * 2; // UTF-16 encoding

      try {
        const parsed = JSON.parse(data);
        totalEvents += parsed.events?.length || 0;
        months.push({
          key: key.replace(CACHE_PREFIX, ""),
          eventCount: parsed.events?.length || 0,
          age: Math.round((Date.now() - parsed.fetchedAt) / 1000 / 60) + " min",
        });
      } catch {
        // Skip invalid entries
      }
    }
  }

  return {
    totalEntries,
    totalEvents,
    totalBytes,
    months,
  };
};

export default {
  // GCal-only cache (legacy)
  getCachedEvents,
  setCachedEvents,
  isCacheValid,
  getCachedEventsForRange,
  invalidateCache,
  updateEventInCache,
  removeEventFromCache,
  addEventToCache,
  getCacheStats,
  // All events cache (Roam + GCal + Tasks)
  getAllCachedEvents,
  setAllCachedEvents,
  isAllEventsCacheValid,
  getAllCachedEventsForRange,
  invalidateAllEventsCache,
  updateEventInAllCache,
  removeEventFromAllCache,
  addEventToAllCache,
};
