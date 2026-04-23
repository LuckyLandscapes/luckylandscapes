'use client';

import { use } from 'react';
import { redirect } from 'next/navigation';

export default function CalendarJobRedirect({ params }) {
  const resolvedParams = use(params);
  redirect(`/jobs/${resolvedParams.id}`);
}
