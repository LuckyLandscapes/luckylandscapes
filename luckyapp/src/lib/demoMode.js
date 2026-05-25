// ─── Demo mode (public showcase) ────────────────────────────
// Runtime, per-tab demo switch. We deliberately use sessionStorage (NOT a
// build-time env var) so:
//   1. only the visitor who clicks "See Demo" is affected — Riley's real app
//      on the same production deploy is untouched;
//   2. the demo auto-ends when the tab closes, so a stale flag can never trap
//      a real user in the localStorage sandbox.
//
// When the flag is on, isDemoMode() forces the existing dual-mode data layer
// (src/lib/data.js) and auth (src/lib/auth.js) onto their localStorage path,
// so every read/write hits the seeded sample world instead of Supabase.

const FLAG_KEY = 'lucky_demo_mode';
const TOUR_STATE_KEY = 'lucky_demo_tour';        // 'pending' | 'menu' | 'running' | 'mobile' | 'done'
const TOUR_STEP_KEY = 'lucky_demo_tour_step';    // integer index within the active chapter
const TOUR_CHAPTER_KEY = 'lucky_demo_tour_chapter'; // active chapter id (or 'full')
const TOUR_DONE_KEY = 'lucky_demo_tour_done';    // JSON array of completed chapter ids

// localStorage keys the seed writes — kept here so exit/reset can purge cleanly.
export const DEMO_DATA_KEYS = [
  'customers', 'quotes', 'jobs', 'calendar_events', 'team_members', 'activity',
  'time_entries', 'time_segments', 'job_media', 'quote_media', 'job_expenses',
  'materials', 'suppliers', 'services', 'invoices', 'company_expenses',
  'payments', 'contracts', 'mileage_entries', 'contractors',
].map(k => `lucky_${k}`);

// The synthetic owner profile the demo signs in as. Mirrors DEMO_USER in
// auth.js and the Riley team_member seeded with the same id, so "assigned to
// me" / clock-in references line up.
export const DEMO_PROFILE = {
  id: 'demo-user-1',
  email: 'riley@luckylandscapes.com',
  fullName: 'Riley Kopf',
  role: 'owner',
  orgId: 'org-lucky-1',
  orgName: 'Lucky Landscapes',
  orgSlug: 'lucky-landscapes',
  orgIndustry: 'landscaping',
};

export function isDemoMode() {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem(FLAG_KEY) === '1') return true;
    // The crew-mobile showcase loads the app in an iframe with ?embed=1. Treat
    // that as demo so the frame reads the seeded sandbox — the localStorage seed
    // + demo profile are shared across same-origin, but the sessionStorage flag
    // may not carry into the frame, so the param makes it deterministic.
    const p = new URLSearchParams(window.location.search);
    return p.get('embed') === '1';
  } catch {
    return false;
  }
}

// True when running inside the crew-mobile preview iframe — used to suppress the
// demo banner + tour chrome so they don't nest inside the phone frame.
export function isEmbedded() {
  if (typeof window === 'undefined') return false;
  try {
    const p = new URLSearchParams(window.location.search);
    if (p.get('embed') === '1') return true;
    return window.self !== window.top;
  } catch {
    return false;
  }
}

// Enter demo: seed the sandbox, sign in the demo owner, arm the tour.
// Async because the (sizable) seed module is dynamically imported so it never
// ships in the bundle real users download.
export async function enterDemoMode({ startTour = true } = {}) {
  if (typeof window === 'undefined') return;
  const { writeDemoSeed } = await import('./demoSeed');
  writeDemoSeed();
  sessionStorage.setItem(FLAG_KEY, '1');
  sessionStorage.setItem(TOUR_STATE_KEY, startTour ? 'pending' : 'done');
  sessionStorage.removeItem(TOUR_STEP_KEY);
  // Persist the demo profile so AuthProvider restores it instantly on the
  // next page load (it reads both keys).
  const json = JSON.stringify(DEMO_PROFILE);
  localStorage.setItem('lucky_app_profile', json);
  localStorage.setItem('lucky_app_user', json);
}

// Wipe everything demo-related and return to a clean slate.
export function exitDemoMode() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(FLAG_KEY);
    sessionStorage.removeItem(TOUR_STATE_KEY);
    sessionStorage.removeItem(TOUR_STEP_KEY);
    clearDemoData();
    localStorage.removeItem('lucky_app_profile');
    localStorage.removeItem('lucky_app_user');
    localStorage.removeItem('lucky_quote_draft_inprogress');
  } catch { /* ignore */ }
}

export function clearDemoData() {
  if (typeof window === 'undefined') return;
  for (const key of DEMO_DATA_KEYS) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
}

// Re-seed in place (used by the banner's "Reset demo" action).
export async function resetDemoData() {
  if (typeof window === 'undefined') return;
  clearDemoData();
  const { writeDemoSeed } = await import('./demoSeed');
  writeDemoSeed();
}

// ─── Demo toast (global, decoupled) ─────────────────────────
// The app has no global toast — toasts are per-page state. The demo needs to
// surface messages from anywhere (e.g. "this would charge the card in the live
// app"), so we fire a custom event that <DemoBanner> listens for and renders.
export function demoToast(message) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('lucky:demo-toast', { detail: { message } }));
}

// Guard an external/server-only action. Returns true (and shows a toast) when
// in demo so callers can bail before hitting Stripe/Resend/Google/etc.
//   if (demoGuard('Sending the invoice email is disabled in the demo.')) return;
export function demoGuard(message) {
  if (!isDemoMode()) return false;
  demoToast(message || 'This action is disabled in the demo.');
  return true;
}

// ─── Tour state (per-tab) ───────────────────────────────────
export function getTourState() {
  if (typeof window === 'undefined') return 'done';
  try { return sessionStorage.getItem(TOUR_STATE_KEY) || 'done'; } catch { return 'done'; }
}
export function setTourState(state) {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(TOUR_STATE_KEY, state); } catch { /* ignore */ }
}
export function getTourStep() {
  if (typeof window === 'undefined') return 0;
  try { return parseInt(sessionStorage.getItem(TOUR_STEP_KEY) || '0', 10) || 0; } catch { return 0; }
}
export function setTourStep(index) {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(TOUR_STEP_KEY, String(index)); } catch { /* ignore */ }
}
export function getTourChapter() {
  if (typeof window === 'undefined') return null;
  try { return sessionStorage.getItem(TOUR_CHAPTER_KEY); } catch { return null; }
}
export function setTourChapter(id) {
  if (typeof window === 'undefined') return;
  try {
    if (id) sessionStorage.setItem(TOUR_CHAPTER_KEY, id);
    else sessionStorage.removeItem(TOUR_CHAPTER_KEY);
  } catch { /* ignore */ }
}
export function getDoneChapters() {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(sessionStorage.getItem(TOUR_DONE_KEY) || '[]'); } catch { return []; }
}
export function markChapterDone(id) {
  if (typeof window === 'undefined' || !id) return;
  try {
    const done = getDoneChapters();
    if (!done.includes(id)) { done.push(id); sessionStorage.setItem(TOUR_DONE_KEY, JSON.stringify(done)); }
  } catch { /* ignore */ }
}
