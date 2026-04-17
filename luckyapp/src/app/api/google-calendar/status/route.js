import { NextResponse } from 'next/server';
import { isGoogleCalendarConfigured } from '@/lib/googleCalendar';

/**
 * GET /api/google-calendar/status
 * Returns whether Google Calendar integration is configured and active.
 */
export async function GET() {
  return NextResponse.json({
    configured: isGoogleCalendarConfigured(),
  });
}
