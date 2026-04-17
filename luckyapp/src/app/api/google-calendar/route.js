import { NextResponse } from 'next/server';
import {
  createGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
  isGoogleCalendarConfigured,
} from '@/lib/googleCalendar';

/**
 * Google Calendar Sync API
 *
 * POST   — Create event in shared Google Calendar
 * PUT    — Update existing event
 * DELETE — Remove event from calendar
 *
 * If Google Calendar is not configured, falls back to generating
 * a public Google Calendar link that the user can use manually.
 */

function formatGCalDate(dateStr, timeStr) {
  if (!dateStr) return '';
  const d = dateStr.replace(/-/g, '');
  if (timeStr) {
    const t = timeStr.replace(/:/g, '') + '00';
    return `${d}T${t}`;
  }
  return d;
}

// POST — Create or generate link
export async function POST(request) {
  try {
    const body = await request.json();
    const { title, date, startTime, endTime, description, location, allDay } = body;

    if (!title || !date) {
      return NextResponse.json({ error: 'Title and date are required' }, { status: 400 });
    }

    // If Google Calendar is configured, create a real event
    if (isGoogleCalendarConfigured()) {
      const googleEventId = await createGoogleEvent({
        title, date, startTime, endTime, description, location, allDay,
      });

      if (googleEventId) {
        return NextResponse.json({
          synced: true,
          googleEventId,
          message: 'Event synced to Google Calendar',
        });
      }

      // API call failed — fall through to link fallback
      console.warn('Google Calendar API failed, falling back to link');
    }

    // Fallback: generate a manual "Add to Calendar" link
    const params = new URLSearchParams();
    params.set('action', 'TEMPLATE');
    params.set('text', title);

    if (allDay) {
      params.set('dates', `${date.replace(/-/g, '')}/${date.replace(/-/g, '')}`);
    } else {
      const start = formatGCalDate(date, startTime || '09:00');
      let endDt;
      if (endTime) {
        endDt = formatGCalDate(date, endTime);
      } else {
        const [h, m] = (startTime || '09:00').split(':').map(Number);
        const endH = String(h + 1).padStart(2, '0');
        endDt = formatGCalDate(date, `${endH}:${String(m).padStart(2, '0')}`);
      }
      params.set('dates', `${start}/${endDt}`);
    }

    if (description) params.set('details', description);
    if (location) params.set('location', location);

    const googleCalUrl = `https://calendar.google.com/calendar/render?${params.toString()}`;

    return NextResponse.json({
      synced: false,
      url: googleCalUrl,
      message: 'Google Calendar link generated (API not configured)',
    });
  } catch (err) {
    console.error('Google Calendar sync error:', err);
    return NextResponse.json({ error: 'Failed to sync with Google Calendar' }, { status: 500 });
  }
}

// PUT — Update an existing event
export async function PUT(request) {
  try {
    const body = await request.json();
    const { googleEventId, title, date, startTime, endTime, description, location, allDay } = body;

    if (!googleEventId) {
      return NextResponse.json({ error: 'googleEventId is required' }, { status: 400 });
    }

    if (!isGoogleCalendarConfigured()) {
      return NextResponse.json({ error: 'Google Calendar not configured' }, { status: 503 });
    }

    const success = await updateGoogleEvent(googleEventId, {
      title, date, startTime, endTime, description, location, allDay,
    });

    return NextResponse.json({ success, message: success ? 'Event updated' : 'Update failed' });
  } catch (err) {
    console.error('Google Calendar update error:', err);
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

// DELETE — Remove an event
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const googleEventId = searchParams.get('eventId');

    if (!googleEventId) {
      return NextResponse.json({ error: 'eventId query param is required' }, { status: 400 });
    }

    if (!isGoogleCalendarConfigured()) {
      return NextResponse.json({ error: 'Google Calendar not configured' }, { status: 503 });
    }

    const success = await deleteGoogleEvent(googleEventId);

    return NextResponse.json({ success, message: success ? 'Event deleted' : 'Delete failed' });
  } catch (err) {
    console.error('Google Calendar delete error:', err);
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
