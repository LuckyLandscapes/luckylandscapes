// ─── Guided demo tour — chapters ────────────────────────────
// The demo opens to a menu (see DemoTour.js) where the visitor picks a chapter.
// Each chapter is a sequence of steps; the 'crew' chapter is special (kind:
// 'mobile') and opens the phone-frame showcase instead of running steps.
//
// Step: { route, target (CSS selector | null=centered), title, body,
// placement ('right' biases the tooltip beside a sidebar item) }.
// Targets degrade gracefully: a missing/off-screen target (e.g. the sidebar on
// mobile) falls back to a centered tooltip with the same copy.

const moneySteps = [
  {
    route: '/dashboard', target: '[data-tour="dash-headline"]',
    title: 'Your money at a glance',
    body: 'Cash collected, what you’ve earned, and what’s still outstanding — the first thing you see every morning.',
  },
  {
    route: '/dashboard', target: '[data-tour="dash-aging"]',
    title: 'Who owes you, and how late',
    body: 'A/R aging buckets every unpaid invoice by how overdue it is, with one-click reminders. No more tracking who owes you in your head.',
  },
  {
    route: '/customers', target: '[data-tour="nav:/customers"]', placement: 'right',
    title: 'Every customer & lead',
    body: 'Website leads land here automatically. Tag them active, VIP, or lead — and keep each customer’s full history in one place.',
  },
  {
    route: '/quotes', target: '[data-tour="nav:/quotes"]', placement: 'right',
    title: 'Quotes that win work',
    body: 'Build a quote with the satellite Measure tool, pull materials from your catalog, and send it for e-signature. Draft → sent → accepted, all tracked.',
  },
  {
    route: '/jobs', target: '[data-tour="nav:/jobs"]', placement: 'right',
    title: 'Accepted quotes become jobs',
    body: 'Every job tracks materials, crew hours, and equipment automatically. Let’s open the Henderson patio.',
  },
  {
    route: '/jobs/job-1', target: '[data-tour="job-profit"]',
    title: 'Live profit on every job',
    body: 'Revenue − materials − labor − equipment = profit, color-coded by margin. Drop below 30% and the app warns you before you mark the job complete.',
  },
  {
    route: '/invoices', target: '[data-tour="nav:/invoices"]', placement: 'right',
    title: 'Bill in one click',
    body: 'Completed jobs turn into invoices instantly. Customers pay by card, ACH, or cash — and overdue invoices get chased automatically.',
  },
  {
    route: '/finance', target: '[data-tour="cashflow"]',
    title: 'When does the money land?',
    body: 'Stripe payouts on the left, money expected from unpaid invoices on the right. One screen answers “when do I actually get paid?”',
  },
];

const toolsSteps = [
  {
    route: '/measure', target: '[data-tour="nav:/measure"]', placement: 'right',
    title: 'Measure from the sky',
    body: 'Draw on satellite imagery, pull the parcel straight from county GIS, auto-detect buildings to subtract, or walk the yard in AR. No measuring wheel, no guessing square footage.',
  },
  {
    route: '/catalog', target: '[data-tour="nav:/catalog"]', placement: 'right',
    title: 'Your materials catalog',
    body: 'Suppliers and materials with tax-aware costs. Customers see photos, colors, and coverage — never your cost or margin.',
  },
  {
    route: '/calculator', target: '[data-tour="nav:/calculator"]', placement: 'right',
    title: 'Material calculator',
    body: 'Square footage + depth → cubic yards, tons, and bag counts, with a delivery-sizing hint. Stop over-ordering mulch.',
  },
  {
    route: '/routing', target: '[data-tour="nav:/routing"]', placement: 'right',
    title: 'Route planner',
    body: 'Drops the day’s job sites into the shortest drive order and hands off to Google Maps. Free — no per-call routing bill.',
  },
];

const manageSteps = [
  {
    route: '/finance', target: '[data-tour="cashflow"]',
    title: 'Cash flow, forecasted',
    body: 'Stripe payouts arriving in your bank plus expected income from unpaid invoices — so you can see slow weeks coming.',
  },
  {
    route: '/reports', target: '[data-tour="nav:/reports"]', placement: 'right',
    title: 'A real P&L',
    body: 'Revenue, COGS, labor, overhead, and net — on a cash or accrual basis. Know whether you actually made money this month.',
  },
  {
    route: '/tax', target: '[data-tour="nav:/tax"]', placement: 'right',
    title: 'Tax season, sorted',
    body: 'Schedule C export, 1099 contractor totals, and a quarterly estimate — split correctly across the sole-prop and LLC dates.',
  },
  {
    route: '/insurance', target: '[data-tour="nav:/insurance"]', placement: 'right',
    title: 'Insurance class-code split',
    body: 'Splits payroll + revenue by class code so your carrier can’t rate all your labor at the high masonry rate at audit. That gap is real money.',
  },
];

export const TOUR_CHAPTERS = [
  { id: 'money', label: 'The Money Flow', icon: 'DollarSign', accent: 'var(--status-success)', blurb: 'Quote → job → invoice → cash. The core loop the business runs on.', steps: moneySteps },
  { id: 'tools', label: 'Field Tools', icon: 'Ruler', accent: 'var(--status-info)', blurb: 'Satellite measuring, material catalog, calculators, route planning.', steps: toolsSteps },
  { id: 'manage', label: 'Money & Compliance', icon: 'BarChart3', accent: 'var(--lucky-gold)', blurb: 'P&L, cash flow forecasting, taxes, and insurance class codes.', steps: manageSteps },
  { id: 'crew', label: 'Crew Mobile', icon: 'Smartphone', accent: 'var(--clover)', blurb: 'What your team uses in the field — clock-in, today’s jobs, receipts. Shown on a real phone.', kind: 'mobile' },
];

// Concatenation of every tour chapter's steps, in order — used by "Take the full tour".
export const FULL_TOUR_STEPS = TOUR_CHAPTERS
  .filter(c => Array.isArray(c.steps))
  .flatMap(c => c.steps);

export function getChapter(id) {
  return TOUR_CHAPTERS.find(c => c.id === id) || null;
}

// Resolve the active step list for a chapter id ('full' = everything).
export function stepsForChapter(id) {
  if (id === 'full') return FULL_TOUR_STEPS;
  const c = getChapter(id);
  return (c && c.steps) || [];
}
