// ============================================================
// LUX AUTO — Calendar Sync  |  Auction Events & Deal Milestones
// Google Apps Script
//
// Script Properties required:
//   AUCTION_CALENDAR_ID — dedicated auction calendar (set on first run)
//
// Entry points:
//   setupAuctionCalendar()
//   syncAuctionEvent(params)
//   syncTransportETA(vin, make, model, year, etaDate)
//   syncReconComplete(vin, make, model, year, completionDate)
//   getUpcomingAuctionEvents(daysAhead)
//   deleteEvent(eventId)
//   getCalendarId()
// ============================================================

const AUCTION_CALENDAR_NAME  = '🏎️ Lux Auto Auctions';
const AUCTION_CAL_PROP_KEY   = 'AUCTION_CALENDAR_ID';

// Default color for auction events (Google Calendar color IDs: 1–11)
// 10 = Basil (green), 6 = Tangerine (orange), 11 = Tomato (red)
const AUCTION_EVENT_COLOR    = CalendarApp.EventColor.TEAL;
const TRANSPORT_EVENT_COLOR  = CalendarApp.EventColor.BANANA;
const RECON_EVENT_COLOR      = CalendarApp.EventColor.SAGE;

// ── Calendar Setup ────────────────────────────────────────────────────────────

/**
 * Finds or creates the dedicated "Lux Auto Auctions" calendar.
 * Saves its ID to Script Properties under AUCTION_CALENDAR_ID.
 * Safe to call repeatedly — idempotent.
 *
 * @returns {string} The calendar ID.
 */
function setupAuctionCalendar() {
  const props    = PropertiesService.getScriptProperties();
  const existing = props.getProperty(AUCTION_CAL_PROP_KEY);

  // Validate stored calendar ID
  if (existing) {
    try {
      const cal = CalendarApp.getCalendarById(existing);
      if (cal) {
        Logger.log('CalendarSync: calendar already configured — ' + cal.getName());
        return existing;
      }
    } catch (e) {
      Logger.log('CalendarSync: stored calendar ID invalid, searching...');
    }
  }

  // Search through user's calendars for one with our name
  const allCals = CalendarApp.getAllOwnedCalendars();
  for (let i = 0; i < allCals.length; i++) {
    if (allCals[i].getName() === AUCTION_CALENDAR_NAME) {
      const id = allCals[i].getId();
      props.setProperty(AUCTION_CAL_PROP_KEY, id);
      Logger.log('CalendarSync: found existing calendar — ' + id);
      return id;
    }
  }

  // Create a fresh calendar
  const newCal = CalendarApp.createCalendar(AUCTION_CALENDAR_NAME, {
    summary : 'Lux Auto auction events, transport ETAs, and deal milestones',
    color   : CalendarApp.Color.TEAL,
  });
  const id = newCal.getId();
  props.setProperty(AUCTION_CAL_PROP_KEY, id);
  Logger.log('CalendarSync: created calendar — ' + id);
  return id;
}

/**
 * Returns the auction calendar, running setup if the ID is not yet stored.
 *
 * @returns {Calendar}
 */
function _getAuctionCalendar() {
  const id = getCalendarId();
  return CalendarApp.getCalendarById(id);
}

// ── Calendar ID Accessor ──────────────────────────────────────────────────────

/**
 * Returns the stored AUCTION_CALENDAR_ID.
 * Calls setupAuctionCalendar() if the property is not yet set.
 *
 * @returns {string}
 */
function getCalendarId() {
  const stored = PropertiesService.getScriptProperties().getProperty(AUCTION_CAL_PROP_KEY);
  if (stored) return stored;
  return setupAuctionCalendar();
}

// ── Auction Event Sync ────────────────────────────────────────────────────────

/**
 * Creates a Google Calendar event for an upcoming auction run.
 *
 * @param {{
 *   title          : string,
 *   location       : string,
 *   startDateTime  : Date|string,
 *   endDateTime    : Date|string,
 *   description    : string,
 *   vin            : string,
 *   auctionLane    : string,
 *   estimatedBid   : number,
 *   mmr            : number,
 *   dealScore      : number
 * }} params
 * @returns {{ eventId: string, eventUrl: string }}
 */
function syncAuctionEvent(params) {
  if (!params || !params.startDateTime) {
    throw new Error('CalendarSync.syncAuctionEvent: startDateTime is required');
  }

  const cal   = _getAuctionCalendar();
  const start = params.startDateTime instanceof Date
    ? params.startDateTime
    : new Date(params.startDateTime);
  const end   = params.endDateTime instanceof Date
    ? params.endDateTime
    : params.endDateTime
      ? new Date(params.endDateTime)
      : new Date(start.getTime() + 60 * 60 * 1000); // default 1-hour duration

  // Build rich description
  const bidFormatted = params.estimatedBid
    ? '$' + Number(params.estimatedBid).toLocaleString()
    : 'N/A';
  const mmrFormatted = params.mmr
    ? '$' + Number(params.mmr).toLocaleString()
    : 'N/A';
  const descLines = [
    params.description || '',
    '',
    '─────────────────────────────',
    '🔑 VIN:            ' + (params.vin          || 'N/A'),
    '💰 Estimated Bid:  ' + bidFormatted,
    '📊 MMR Value:      ' + mmrFormatted,
    '🏎️  Lane / Run #:   ' + (params.auctionLane  || 'N/A'),
    '⭐ Deal Score:     ' + (params.dealScore     != null ? params.dealScore : 'N/A'),
    '─────────────────────────────',
    'Created by Lux Auto Buyer System',
  ].join('\n').trim();

  const title = params.title || ('🏁 Auction: VIN ' + (params.vin || 'Unknown'));

  const event = cal.createEvent(title, start, end, {
    location    : params.location    || '',
    description : descLines,
  });
  event.setColor(AUCTION_EVENT_COLOR);

  Logger.log('CalendarSync: auction event created — ' + event.getId());
  return {
    eventId  : event.getId(),
    eventUrl : 'https://www.google.com/calendar/event?eid=' +
               Utilities.base64Encode(event.getId()),
  };
}

// ── Transport ETA Event ───────────────────────────────────────────────────────

/**
 * Creates an all-day calendar event on the transport ETA date.
 * Title: "🚚 Transport ETA: [YEAR MAKE MODEL] - [VIN]"
 *
 * @param {string}      vin
 * @param {string}      make
 * @param {string}      model
 * @param {string|number} year
 * @param {Date|string} etaDate
 * @returns {{ eventId: string }}
 */
function syncTransportETA(vin, make, model, year, etaDate) {
  if (!etaDate) throw new Error('CalendarSync.syncTransportETA: etaDate is required');

  const cal  = _getAuctionCalendar();
  const date = etaDate instanceof Date ? etaDate : new Date(etaDate);
  const title = '🚚 Transport ETA: ' + year + ' ' + make + ' ' + model + ' - ' + vin;

  const event = cal.createAllDayEvent(title, date, {
    description : 'Expected transport arrival for VIN ' + vin +
                  '\nCreated by Lux Auto Buyer System',
  });
  event.setColor(TRANSPORT_EVENT_COLOR);

  Logger.log('CalendarSync: transport ETA event created for VIN ' + vin);
  return { eventId: event.getId() };
}

// ── Recon Complete Event ──────────────────────────────────────────────────────

/**
 * Creates an all-day calendar event when reconditioning is complete.
 * Title: "🔧 Recon Complete: [YEAR MAKE MODEL]"
 *
 * @param {string}      vin
 * @param {string}      make
 * @param {string}      model
 * @param {string|number} year
 * @param {Date|string} completionDate
 * @returns {{ eventId: string }}
 */
function syncReconComplete(vin, make, model, year, completionDate) {
  if (!completionDate) throw new Error('CalendarSync.syncReconComplete: completionDate is required');

  const cal   = _getAuctionCalendar();
  const date  = completionDate instanceof Date ? completionDate : new Date(completionDate);
  const title = '🔧 Recon Complete: ' + year + ' ' + make + ' ' + model;

  const event = cal.createAllDayEvent(title, date, {
    description : 'Reconditioning completed for VIN ' + vin +
                  '\n' + year + ' ' + make + ' ' + model +
                  '\nCreated by Lux Auto Buyer System',
  });
  event.setColor(RECON_EVENT_COLOR);

  Logger.log('CalendarSync: recon complete event created for VIN ' + vin);
  return { eventId: event.getId() };
}

// ── Upcoming Events Query ─────────────────────────────────────────────────────

/**
 * Returns auction calendar events in the next N days.
 *
 * @param {number} [daysAhead=14]  Look-ahead window in days.
 * @returns {Array<{ title: string, start: string, end: string, location: string, description: string }>}
 */
function getUpcomingAuctionEvents(daysAhead) {
  const days  = (typeof daysAhead === 'number' && daysAhead > 0) ? daysAhead : 14;
  const cal   = _getAuctionCalendar();
  const now   = new Date();
  const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const rawEvents = cal.getEvents(now, until);

  return rawEvents.map(function(ev) {
    return {
      title       : ev.getTitle(),
      start       : ev.getStartTime().toISOString(),
      end         : ev.getEndTime().toISOString(),
      location    : ev.getLocation() || '',
      description : ev.getDescription() || '',
    };
  });
}

// ── Event Deletion ────────────────────────────────────────────────────────────

/**
 * Deletes an event from the auction calendar by its event ID.
 *
 * @param {string} eventId
 * @returns {{ success: boolean, error?: string }}
 */
function deleteEvent(eventId) {
  if (!eventId) return { success: false, error: 'eventId is required' };

  try {
    const cal   = _getAuctionCalendar();
    const event = cal.getEventById(eventId);

    if (!event) {
      Logger.log('CalendarSync.deleteEvent: event not found — ' + eventId);
      return { success: false, error: 'Event not found: ' + eventId };
    }

    event.deleteEvent();
    Logger.log('CalendarSync: deleted event ' + eventId);
    return { success: true };
  } catch (err) {
    Logger.log('CalendarSync.deleteEvent error: ' + err.message);
    return { success: false, error: err.message };
  }
}
