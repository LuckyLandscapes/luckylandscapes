// Server-only notification dispatcher.
// Sends an event to: (1) notifications table (in-app feed + realtime),
//                    (2) email via Resend, (3) Web Push to subscribed devices.
//
// Recipients are the team members of the org filtered by `roles`
// (default: ['owner','admin']). Workers are not notified.

import webpush from 'web-push';
import { Resend } from 'resend';
import { getServiceSupabase } from './stripeServer';

let _vapidConfigured = false;
function ensureVapidConfigured() {
  if (_vapidConfigured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:rileykopf@luckylandscapes.com';
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  _vapidConfigured = true;
  return true;
}

function getAppOrigin() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://app.luckylandscapes.com').replace(/\/$/, '');
}

/**
 * Dispatch a notification to an org.
 *
 * @param {object} args
 * @param {string} args.orgId
 * @param {string} args.type        - machine-readable, e.g. 'quote_accepted'
 * @param {string} args.title       - short headline (used for in-app feed + push;
 *                                    also default email subject)
 * @param {string} args.body        - short body (1–2 lines)
 * @param {string} [args.link]      - in-app path, e.g. '/quotes/<id>'
 * @param {object} [args.data]      - extra json payload stored with the notification
 * @param {string[]} [args.roles]   - team_members roles to notify; default ['owner','admin']
 * @param {Array<{filename:string, content:Uint8Array|Buffer}>} [args.attachments]
 *        - Optional email attachments. Each `content` is base64-encoded
 *          before handing to Resend.
 * @param {object} [args.email]     - Per-email overrides. Lets the email be a
 *                                    richer template than the in-app/push surface.
 * @param {string} [args.email.subject] - override the email subject (defaults to `title`)
 * @param {string} [args.email.html]    - override the email HTML body (defaults to a
 *                                        plain `<p>${body}</p>` + open-in-app link)
 * @param {string} [args.email.text]    - override the plain-text fallback
 * @param {string} [args.email.replyTo] - reply-to header (e.g. the lead's email)
 */
export async function notifyOrg({ orgId, type, title, body, link, data = {}, roles = ['owner', 'admin'], attachments, email = {} }) {
  if (!orgId || !type || !title) {
    console.warn('[notify] missing required fields', { orgId, type, title });
    return;
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    console.warn('[notify] service supabase not configured — skipping');
    return;
  }

  // 1. Insert org-wide notification row (drives in-app feed + realtime)
  try {
    await supabase.from('notifications').insert({
      org_id: orgId,
      user_id: null,
      type,
      title,
      body: body || null,
      link: link || null,
      data,
    });
  } catch (err) {
    console.error('[notify] insert notification failed', err);
  }

  // 2. Look up active team members in the targeted roles
  const { data: members, error: memErr } = await supabase
    .from('team_members')
    .select('user_id, email, full_name, role')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .in('role', roles);
  if (memErr) {
    console.error('[notify] team_members fetch failed', memErr);
    return;
  }
  if (!members || members.length === 0) return;

  const userIds = members.map(m => m.user_id).filter(Boolean);
  const emails = members.map(m => m.email).filter(Boolean);

  // 3. Email via Resend (best-effort; one email to all recipients)
  await sendEmail({ emails, title, body, link, attachments, ...email });

  // 4. Web Push (best-effort; per subscription)
  await sendWebPush({ supabase, userIds, title, body, link, data, type });
}

async function sendEmail({ emails, title, body, link, attachments, subject, html, text, replyTo }) {
  if (!process.env.RESEND_API_KEY) return;
  if (!emails || emails.length === 0) return;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'Lucky Landscapes <onboarding@resend.dev>';
    const fullLink = link ? `${getAppOrigin()}${link.startsWith('/') ? '' : '/'}${link}` : null;
    const computedText = [
      body || '',
      '',
      fullLink ? `Open in luckyapp: ${fullLink}` : null,
    ].filter(Boolean).join('\n');
    const computedHtml = [
      body ? `<p>${escapeHtml(body)}</p>` : '',
      fullLink ? `<p><a href="${fullLink}" style="color:#41a100;font-weight:600;">Open in luckyapp →</a></p>` : '',
    ].filter(Boolean).join('');
    const sendArgs = {
      from: fromAddress,
      to: emails,
      subject: subject || title,
      text: text || computedText,
      html: html || computedHtml,
    };
    if (replyTo) sendArgs.reply_to = replyTo;
    if (Array.isArray(attachments) && attachments.length) {
      sendArgs.attachments = attachments.map(a => ({
        filename: a.filename,
        content: Buffer.isBuffer(a.content)
          ? a.content.toString('base64')
          : Buffer.from(a.content).toString('base64'),
      }));
    }
    await resend.emails.send(sendArgs);
  } catch (err) {
    console.error('[notify] email send failed', err);
  }
}

async function sendWebPush({ supabase, userIds, title, body, link, data, type }) {
  if (!ensureVapidConfigured()) {
    console.warn('[notify] VAPID keys not set — skipping web push');
    return;
  }
  if (!userIds || userIds.length === 0) return;

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds);
  if (error) {
    console.error('[notify] push_subscriptions fetch failed', error);
    return;
  }
  if (!subs || subs.length === 0) return;

  const payload = JSON.stringify({
    title,
    body: body || '',
    link: link || '/',
    data: { ...data, type },
    tag: type,
  });

  const staleIds = [];
  await Promise.all(subs.map(async (s) => {
    const subscription = {
      endpoint: s.endpoint,
      keys: { p256dh: s.p256dh, auth: s.auth },
    };
    try {
      await webpush.sendNotification(subscription, payload);
    } catch (err) {
      const code = err?.statusCode;
      if (code === 404 || code === 410) {
        // Subscription expired/unsubscribed — remove it.
        staleIds.push(s.id);
      } else {
        console.error('[notify] web push send failed', { code, message: err?.message });
      }
    }
  }));

  if (staleIds.length) {
    await supabase.from('push_subscriptions').delete().in('id', staleIds);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
