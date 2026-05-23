'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useData } from '@/lib/data';
import { Star, Copy, Check, MessageSquare, Mail, ExternalLink } from 'lucide-react';

// One-tap Google review request. Riley sends it personally — Copy / Text / Email
// all open his own apps so the ask comes from his own number, not an automated
// blast (far higher response rate for a small local crew, and lets him pick the
// moment right after a happy job). The review URL is per-org and lives in
// organizations.settings.google_review_url; until it is set the card shows a
// one-time setup prompt instead of broken buttons.
export default function ReviewRequestCard({ customer, highlight = false }) {
  const { org } = useData();
  const [copied, setCopied] = useState(false);

  const reviewUrl = (org?.settings?.google_review_url || '').trim();
  const orgName = org?.name || 'Lucky Landscapes';
  const firstName = customer?.firstName || 'there';

  if (!reviewUrl) {
    return (
      <div className="card" style={{ borderStyle: 'dashed' }}>
        <h4 style={{ marginBottom: '6px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Star size={16} /> Ask for a Google review
        </h4>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginBottom: '10px' }}>
          Add your Google review link once, then text or email it to customers in one tap. Fresh reviews are the single biggest lever for ranking higher in local search.
        </p>
        <Link href="/settings" className="btn btn-ghost btn-sm">Set it up in Settings</Link>
      </div>
    );
  }

  const message = `Hi ${firstName}, thanks again for letting ${orgName} take care of your project! If you were happy with how everything turned out, would you mind leaving us a quick Google review? It means a ton to a small local crew like ours.\n\n${reviewUrl}`;

  const tel = (customer?.phone || '').replace(/[^\d+]/g, '');
  const enc = encodeURIComponent(message);
  // `?&body=` is the cross-platform form — iOS reads the `&`, Android reads the `?`.
  const smsHref = `sms:${tel}?&body=${enc}`;
  const mailHref = `mailto:${customer?.email || ''}?subject=${encodeURIComponent(`A quick favor from ${orgName}`)}&body=${enc}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / denied permission) — link is still visible via Open.
    }
  };

  return (
    <div className="card" style={highlight ? { border: '1px solid var(--lucky-green)', background: 'rgba(34,197,94,0.06)' } : undefined}>
      <h4 style={{ marginBottom: '6px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Star size={16} style={{ color: 'var(--lucky-green-light)' }} /> Ask for a Google review
      </h4>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginBottom: '10px' }}>
        {highlight
          ? `Job just wrapped. Now is the moment — send ${firstName} the one-tap link:`
          : `A fresh review is the #1 thing that lifts you in local search. Send ${firstName} the one-tap link:`}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <button className="btn btn-primary btn-sm" onClick={handleCopy}>
          {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy message</>}
        </button>
        {tel && (
          <a className="btn btn-ghost btn-sm" href={smsHref}><MessageSquare size={14} /> Text</a>
        )}
        {customer?.email && (
          <a className="btn btn-ghost btn-sm" href={mailHref}><Mail size={14} /> Email</a>
        )}
        <a className="btn btn-ghost btn-sm" href={reviewUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={14} /> Open
        </a>
      </div>
    </div>
  );
}
