import { google } from 'googleapis';

/**
 * Google Calendar Service — Shared Company Calendar
 *
 * Uses a Google Service Account to manage events on a shared calendar.
 * No per-user OAuth needed — the service account is granted access to
 * the shared Google Calendar.
 *
 * Setup:
 * 1. Create a service account in Google Cloud Console
 * 2. Download the JSON key file
 * 3. Create a Google Calendar and share it with the service account email
 * 4. Set environment variables (see .env.local)
 */

let cachedAuth = null;

function getAuth() {
  if (cachedAuth) return cachedAuth;

  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) return null;

  try {
    const key = JSON.parse(serviceAccountKey);
    cachedAuth = new google.auth.GoogleAuth({
      credentials: key,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    return cachedAuth;
  } catch (err) {
    console.error('Failed to parse Google service account key:', err.message);
    return null;
  }
}

function getCalendar() {
  const auth = getAuth();
  if (!auth) return null;
  return google.calendar({ version: 'v3', auth });
}

/**
 * Get the shared calendar ID from env, or default to 'primary'
 */
function getCalendarId() {
  return process.env.GOOGLE_CALENDAR_ID || 'primary';
}

/**
 * Check if Google Calendar is configured
 */
export function isGoogleCalendarConfigured() {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.GOOGLE_CALENDAR_ID);
}

/**
 * Create a Google Calendar event
 * @returns {string|null} Google event ID, or null on failure
 */
export async function createGoogleEvent({ title, date, startTime, endTime, description, location, allDay }) {
  const calendar = getCalendar();
  if (!calendar) return null;

  const calendarId = getCalendarId();
  const timeZone = process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Chicago';

  const event = {
    summary: title,
    description: description || '',
    location: location || '',
  };

  if (allDay) {
    event.start = { date, timeZone };
    event.end = { date, timeZone };
  } else {
    const startDateTime = `${date}T${startTime || '09:00'}:00`;
    let endDateTime;
    if (endTime) {
      endDateTime = `${date}T${endTime}:00`;
    } else {
      // Default 1 hour duration
      const [h, m] = (startTime || '09:00').split(':').map(Number);
      const endH = String(h + 1).padStart(2, '0');
      endDateTime = `${date}T${endH}:${String(m).padStart(2, '0')}:00`;
    }
    event.start = { dateTime: startDateTime, timeZone };
    event.end = { dateTime: endDateTime, timeZone };
  }

  try {
    const res = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });
    console.log('Google Calendar event created:', res.data.id);
    return res.data.id;
  } catch (err) {
    console.error('Error creating Google Calendar event:', err.message);
    return null;
  }
}

/**
 * Update an existing Google Calendar event
 */
export async function updateGoogleEvent(googleEventId, { title, date, startTime, endTime, description, location, allDay }) {
  const calendar = getCalendar();
  if (!calendar || !googleEventId) return false;

  const calendarId = getCalendarId();
  const timeZone = process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Chicago';

  const event = {
    summary: title,
    description: description || '',
    location: location || '',
  };

  if (allDay) {
    event.start = { date, timeZone };
    event.end = { date, timeZone };
  } else {
    const startDateTime = `${date}T${startTime || '09:00'}:00`;
    let endDateTime;
    if (endTime) {
      endDateTime = `${date}T${endTime}:00`;
    } else {
      const [h, m] = (startTime || '09:00').split(':').map(Number);
      const endH = String(h + 1).padStart(2, '0');
      endDateTime = `${date}T${endH}:${String(m).padStart(2, '0')}:00`;
    }
    event.start = { dateTime: startDateTime, timeZone };
    event.end = { dateTime: endDateTime, timeZone };
  }

  try {
    await calendar.events.update({
      calendarId,
      eventId: googleEventId,
      requestBody: event,
    });
    console.log('Google Calendar event updated:', googleEventId);
    return true;
  } catch (err) {
    console.error('Error updating Google Calendar event:', err.message);
    return false;
  }
}

/**
 * Delete a Google Calendar event
 */
export async function deleteGoogleEvent(googleEventId) {
  const calendar = getCalendar();
  if (!calendar || !googleEventId) return false;

  try {
    await calendar.events.delete({
      calendarId: getCalendarId(),
      eventId: googleEventId,
    });
    console.log('Google Calendar event deleted:', googleEventId);
    return true;
  } catch (err) {
    console.error('Error deleting Google Calendar event:', err.message);
    return false;
  }
}
