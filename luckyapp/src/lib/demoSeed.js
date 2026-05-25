// ─── Demo seed data ─────────────────────────────────────────
// Writes a complete, internally-consistent Lucky Landscapes sample world into
// the same `lucky_*` localStorage keys the dual-mode data layer reads in demo
// mode (see src/lib/data.js). Dates are computed RELATIVE to "now" at seed
// time, so the demo always looks current no matter when a visitor opens it.
//
// Consistency rules baked in (per the data-shape audit):
//   • quote.status / job.status are never null (UI calls .charAt / .replace).
//   • completed jobs carry completedAt + revenue (accrual revenue).
//   • payments carry an in-period paidAt (dashboard/reports default to CASH).
//   • every completed job has job_expenses + time_entries so margins are
//     realistic (~40-50%) — with one deliberately negative job (job-10) to
//     show the margin reality-check.
//   • orgId is 'org-lucky-1' and Riley's team_member id is 'demo-user-1' to
//     match the demo auth profile.

const ORG = 'org-lucky-1';

export function writeDemoSeed() {
  if (typeof window === 'undefined') return;

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const daysAgo = (n) => new Date(now.getTime() - n * dayMs);
  const daysAhead = (n) => new Date(now.getTime() + n * dayMs);
  const isoDate = (d) => d.toISOString().split('T')[0];        // YYYY-MM-DD
  const iso = (d) => d.toISOString();                          // full timestamp
  const atHour = (d, h, m = 0) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x; };

  // ── Team ──────────────────────────────────────────────────
  const teamMembers = [
    { id: 'demo-user-1', orgId: ORG, fullName: 'Riley Kopf', email: 'riley@luckylandscapes.com', role: 'owner', isActive: true, hourlyRate: 0, payrollClassification: 'owner_excluded', createdAt: iso(daysAgo(85)) },
    { id: 'm-brodie', orgId: ORG, fullName: 'Brodie Chase', email: 'brodie@luckylandscapes.com', role: 'worker', isActive: true, hourlyRate: 24, payrollClassification: 'w2_employee', dateOfBirth: '2008-09-12', createdAt: iso(daysAgo(80)) },
    { id: 'm-sean', orgId: ORG, fullName: 'Sean Chase', email: 'sean@luckylandscapes.com', role: 'worker', isActive: true, hourlyRate: 20, payrollClassification: 'w2_employee', dateOfBirth: '2007-06-03', createdAt: iso(daysAgo(78)) },
    { id: 'm-nick', orgId: ORG, fullName: 'Nick Sullivan', email: 'nick@luckylandscapes.com', role: 'worker', isActive: true, hourlyRate: 19, payrollClassification: 'w2_employee', dateOfBirth: '2008-11-20', createdAt: iso(daysAgo(76)) },
    { id: 'm-kenton', orgId: ORG, fullName: 'Kenton Sowards', email: 'kenton@luckylandscapes.com', role: 'worker', isActive: true, hourlyRate: 20, payrollClassification: 'w2_employee', dateOfBirth: '2006-02-15', createdAt: iso(daysAgo(70)) },
    { id: 'm-cole', orgId: ORG, fullName: 'Cole Sparh', email: 'cole@luckylandscapes.com', role: 'worker', isActive: true, hourlyRate: 19, payrollClassification: 'w2_employee', dateOfBirth: '2006-08-01', createdAt: iso(daysAgo(68)) },
    { id: 'm-brenden', orgId: ORG, fullName: 'Brenden Krumme', email: 'brenden@luckylandscapes.com', role: 'worker', isActive: true, hourlyRate: 18, payrollClassification: 'w2_employee', dateOfBirth: '2009-01-10', createdAt: iso(daysAgo(60)) },
  ];

  // ── Suppliers ─────────────────────────────────────────────
  const suppliers = [
    { id: 'sup-os', orgId: ORG, name: 'Outdoor Solutions', defaultTaxRate: 0.0725, website: '', sortOrder: 1, contactPhone: '(402) 555-0142', address: 'Roca, NE', notes: 'Primary: mulch, rock, stone, plants (nursery).', createdAt: iso(daysAgo(80)) },
    { id: 'sup-menards', orgId: ORG, name: 'Menards', defaultTaxRate: 0.0725, website: '', sortOrder: 2, contactPhone: '(402) 555-0188', address: 'Lincoln, NE', notes: 'Brick / hardscape + bagged goods.', createdAt: iso(daysAgo(80)) },
    { id: 'sup-hd', orgId: ORG, name: 'Home Depot', defaultTaxRate: 0.0725, website: '', sortOrder: 3, contactPhone: '(402) 555-0167', address: 'Lincoln, NE', notes: 'Price-shopped backup + bagged retail.', createdAt: iso(daysAgo(80)) },
  ];

  // ── Materials ─────────────────────────────────────────────
  const materials = [
    { id: 'mat-mulch', orgId: ORG, supplierId: 'sup-os', name: 'Premium Hardwood Mulch', category: 'Mulch', unit: 'cu yd', unitCost: 32, taxRate: null, isCustomerVisible: true, isActive: true, color: 'Dark Brown', texture: 'Shredded', imageUrl: '', createdAt: iso(daysAgo(60)) },
    { id: 'mat-rock', orgId: ORG, supplierId: 'sup-os', name: '1.5" River Rock', category: 'Rock & Stone', unit: 'ton', unitCost: 48, taxRate: null, isCustomerVisible: true, isActive: true, color: 'Tan / Gray', texture: 'Rounded', imageUrl: '', createdAt: iso(daysAgo(60)) },
    { id: 'mat-paver', orgId: ORG, supplierId: 'sup-menards', name: 'Holland Stone Paver', category: 'Pavers', unit: 'sq ft', unitCost: 3.25, taxRate: null, isCustomerVisible: true, isActive: true, color: 'Charcoal', texture: 'Smooth', imageUrl: '', createdAt: iso(daysAgo(60)) },
    { id: 'mat-wall', orgId: ORG, supplierId: 'sup-menards', name: 'Retaining Wall Block', category: 'Wall Block', unit: 'each', unitCost: 4.10, taxRate: null, isCustomerVisible: true, isActive: true, color: 'Sandstone', texture: 'Split-face', imageUrl: '', createdAt: iso(daysAgo(60)) },
    { id: 'mat-screenings', orgId: ORG, supplierId: 'sup-os', name: 'Crushed Screenings', category: 'Aggregate', unit: 'ton', unitCost: 28, taxRate: null, isCustomerVisible: false, isActive: true, color: '', texture: '', imageUrl: '', createdAt: iso(daysAgo(60)) },
    { id: 'mat-edging', orgId: ORG, supplierId: 'sup-hd', name: 'Steel Landscape Edging', category: 'Edging', unit: 'linear ft', unitCost: 2.40, taxRate: null, isCustomerVisible: true, isActive: true, color: 'Black', texture: '', imageUrl: '', createdAt: iso(daysAgo(60)) },
    { id: 'mat-soil', orgId: ORG, supplierId: 'sup-os', name: 'Premium Topsoil', category: 'Soil', unit: 'cu yd', unitCost: 26, taxRate: null, isCustomerVisible: true, isActive: true, color: 'Dark', texture: 'Screened', imageUrl: '', createdAt: iso(daysAgo(60)) },
    { id: 'mat-fabric', orgId: ORG, supplierId: 'sup-hd', name: 'Weed Barrier Fabric', category: 'Accessories', unit: 'roll', unitCost: 38, taxRate: null, isCustomerVisible: true, isActive: true, color: 'Black', texture: '', imageUrl: '', createdAt: iso(daysAgo(60)) },
  ];

  // ── Customers ─────────────────────────────────────────────
  const customers = [
    { id: 'cust-1', orgId: ORG, firstName: 'Mark', lastName: 'Henderson', email: 'mark.henderson@example.com', phone: '(402) 555-0118', address: '8420 Eagle Ridge Rd', city: 'Lincoln', state: 'NE', zip: '68512', tags: ['active', 'vip'], customerType: 'homeowner', source: 'referral', notes: 'High-end backyard. Repeat customer — quality over price.', createdAt: iso(daysAgo(70)) },
    { id: 'cust-2', orgId: ORG, firstName: 'David', lastName: 'Thompson', email: 'dthompson@example.com', phone: '(402) 555-0173', address: '3215 Sheridan Blvd', city: 'Lincoln', state: 'NE', zip: '68502', tags: ['active'], customerType: 'homeowner', source: 'website', notes: '', createdAt: iso(daysAgo(55)) },
    { id: 'cust-3', orgId: ORG, firstName: 'Sarah', lastName: 'Mitchell', email: 'sarah.mitchell@example.com', phone: '(402) 555-0191', address: '6740 Old Cheney Rd', city: 'Lincoln', state: 'NE', zip: '68516', tags: ['active', 'vip'], customerType: 'homeowner', source: 'referral', notes: 'Big retaining-wall project in progress.', createdAt: iso(daysAgo(48)) },
    { id: 'cust-4', orgId: ORG, firstName: 'Greenfield Estates', lastName: 'HOA', email: 'board@greenfieldhoa.example.com', phone: '(402) 555-0200', address: '1100 Pine Lake Rd', city: 'Lincoln', state: 'NE', zip: '68512', tags: ['active', 'vip'], customerType: 'business', source: 'referral', notes: 'Seasonal contract — common areas + entrance beds.', createdAt: iso(daysAgo(60)) },
    { id: 'cust-5', orgId: ORG, firstName: 'Jennifer', lastName: 'Adams', email: 'jadams@example.com', phone: '(402) 555-0144', address: '5012 S 84th St', city: 'Lincoln', state: 'NE', zip: '68516', tags: ['active'], customerType: 'homeowner', source: 'website', notes: '', createdAt: iso(daysAgo(30)) },
    { id: 'cust-6', orgId: ORG, firstName: 'Robert', lastName: 'Wells', email: 'rwells@example.com', phone: '(402) 555-0155', address: '14250 N 14th St', city: 'Waverly', state: 'NE', zip: '68462', tags: ['active'], customerType: 'homeowner', source: 'referral', notes: 'Acreage. Will travel for this one.', createdAt: iso(daysAgo(50)) },
    { id: 'cust-7', orgId: ORG, firstName: 'Prairie Commons', lastName: 'Properties', email: 'facilities@prairiecommons.example.com', phone: '(402) 555-0211', address: '2000 Pinnacle Dr', city: 'Lincoln', state: 'NE', zip: '68512', tags: ['active'], customerType: 'business', source: 'referral', notes: 'Commercial — monthly mowing + bed maintenance.', createdAt: iso(daysAgo(40)) },
    { id: 'cust-8', orgId: ORG, firstName: 'Michael', lastName: 'Brennan', email: 'mbrennan@example.com', phone: '(402) 555-0122', address: '4400 Pioneers Blvd', city: 'Lincoln', state: 'NE', zip: '68506', tags: ['lead'], customerType: 'homeowner', source: 'website', notes: 'Requested a paver patio quote via the website.', createdAt: iso(daysAgo(3)) },
    { id: 'cust-9', orgId: ORG, firstName: 'Ashley', lastName: 'Cooper', email: 'acooper@example.com', phone: '(402) 555-0133', address: '7720 Yankee Hill Rd', city: 'Lincoln', state: 'NE', zip: '68516', tags: ['lead'], customerType: 'homeowner', source: 'website', notes: 'Website lead — bed cleanup + mulch.', createdAt: iso(daysAgo(1)) },
    { id: 'cust-10', orgId: ORG, firstName: 'Tom', lastName: 'Becker', email: 'tbecker@example.com', phone: '(402) 555-0166', address: '9015 Firethorn Ln', city: 'Lincoln', state: 'NE', zip: '68520', tags: ['active'], customerType: 'homeowner', source: 'referral', notes: '', createdAt: iso(daysAgo(25)) },
    { id: 'cust-11', orgId: ORG, firstName: 'Diane', lastName: 'Foster', email: 'dfoster@example.com', phone: '(402) 555-0177', address: '2810 Woods Blvd', city: 'Lincoln', state: 'NE', zip: '68502', tags: ['active'], customerType: 'homeowner', source: 'website', notes: '', createdAt: iso(daysAgo(20)) },
    { id: 'cust-12', orgId: ORG, firstName: 'BuildRight', lastName: 'Construction', email: 'jeremiah@buildright.example.com', phone: '(402) 555-0222', address: '600 W O St', city: 'Lincoln', state: 'NE', zip: '68528', tags: ['active'], customerType: 'general_contractor', source: 'referral', notes: 'GC — we sub hardscape labor on their builds.', createdAt: iso(daysAgo(35)) },
  ];

  // ── Quotes ────────────────────────────────────────────────
  const quotes = [
    { id: 'quote-1', orgId: ORG, quoteNumber: 1001, customerId: 'cust-1', category: 'Hardscaping', status: 'accepted', total: 8650, deliveryFee: 75, materialsCost: 2400, items: [{ name: 'Paver patio — 480 sq ft (Holland Stone)', quantity: 480, unitPrice: 16.5, total: 7920 }, { name: 'Compacted base prep', quantity: 1, unitPrice: 655, total: 655 }], notes: 'Charcoal Holland Stone, soldier-course border.', publicToken: 'demoq1', createdAt: iso(daysAgo(42)) },
    { id: 'quote-2', orgId: ORG, quoteNumber: 1002, customerId: 'cust-2', category: 'Garden & Beds', status: 'accepted', total: 3200, deliveryFee: 50, materialsCost: 850, items: [{ name: 'Bed refresh + edging — 320 sq ft', quantity: 1, unitPrice: 2100, total: 2100 }, { name: 'Premium hardwood mulch', quantity: 1, unitPrice: 1050, total: 1050 }], notes: '', publicToken: 'demoq2', createdAt: iso(daysAgo(22)) },
    { id: 'quote-3', orgId: ORG, quoteNumber: 1003, customerId: 'cust-4', category: 'Lawn Care', status: 'accepted', total: 6400, deliveryFee: 0, materialsCost: 1200, items: [{ name: 'Spring cleanup — common areas', quantity: 1, unitPrice: 3800, total: 3800 }, { name: 'Entrance bed mulch + plantings', quantity: 1, unitPrice: 2600, total: 2600 }], notes: 'HOA seasonal contract.', publicToken: 'demoq3', createdAt: iso(daysAgo(30)) },
    { id: 'quote-4', orgId: ORG, quoteNumber: 1004, customerId: 'cust-3', category: 'Hardscaping', status: 'sent', total: 12400, deliveryFee: 100, materialsCost: 3600, items: [{ name: 'Segmental retaining wall — 90 linear ft', quantity: 90, unitPrice: 118, total: 10620 }, { name: 'Demo + haul old timbers', quantity: 1, unitPrice: 1680, total: 1680 }], notes: 'Phase 1 of two.', publicToken: 'demoq4', createdAt: iso(daysAgo(6)) },
    { id: 'quote-5', orgId: ORG, quoteNumber: 1005, customerId: 'cust-5', category: 'Cleanup', status: 'viewed', total: 1450, deliveryFee: 0, materialsCost: 150, items: [{ name: 'Full property cleanup + haul', quantity: 1, unitPrice: 1450, total: 1450 }], notes: '', publicToken: 'demoq5', createdAt: iso(daysAgo(4)) },
    { id: 'quote-6', orgId: ORG, quoteNumber: 1006, customerId: 'cust-10', category: 'Landscape Design', status: 'draft', total: 2800, deliveryFee: 0, materialsCost: 0, items: [{ name: 'Full-yard design + rendered plan', quantity: 1, unitPrice: 2800, total: 2800 }], notes: 'Credit toward install if booked.', publicToken: 'demoq6', createdAt: iso(daysAgo(2)) },
    { id: 'quote-7', orgId: ORG, quoteNumber: 1007, customerId: 'cust-6', category: 'Hardscaping', status: 'accepted', total: 9800, deliveryFee: 90, materialsCost: 2900, items: [{ name: 'Paver patio + fire pit', quantity: 1, unitPrice: 8200, total: 8200 }, { name: 'Seat-wall (20 linear ft)', quantity: 20, unitPrice: 75.5, total: 1510 }], notes: 'Waverly acreage.', publicToken: 'demoq7', createdAt: iso(daysAgo(35)) },
    { id: 'quote-8', orgId: ORG, quoteNumber: 1008, customerId: 'cust-11', category: 'Lawn Care', status: 'declined', total: 980, deliveryFee: 0, materialsCost: 0, items: [{ name: 'Bi-weekly mow — season', quantity: 1, unitPrice: 980, total: 980 }], notes: 'Went with a cheaper neighbor kid.', publicToken: 'demoq8', createdAt: iso(daysAgo(18)) },
  ];

  // ── Jobs ──────────────────────────────────────────────────
  const today = isoDate(now);
  const jobs = [
    { id: 'job-1', orgId: ORG, customerId: 'cust-1', quoteId: 'quote-1', title: 'Backyard Paver Patio — 480 sq ft', description: 'Charcoal Holland Stone patio with soldier-course border.', address: '8420 Eagle Ridge Rd, Lincoln, NE', status: 'completed', completedAt: iso(daysAgo(12)), scheduledDate: isoDate(daysAgo(16)), revenue: 8650, total: 8650, assignedTo: ['m-brodie', 'm-nick', 'm-cole'], priority: 'normal', wcClass: 'masonry', workAuthorization: 'contract', createdAt: iso(daysAgo(40)) },
    { id: 'job-2', orgId: ORG, customerId: 'cust-2', quoteId: 'quote-2', title: 'Front Bed Refresh + Mulch', description: 'Re-edge, weed barrier, 7 yd hardwood mulch.', address: '3215 Sheridan Blvd, Lincoln, NE', status: 'completed', completedAt: iso(daysAgo(8)), scheduledDate: isoDate(daysAgo(9)), revenue: 3200, total: 3200, assignedTo: ['m-brodie', 'm-sean'], priority: 'normal', wcClass: 'landscape_gardening', workAuthorization: 'contract', createdAt: iso(daysAgo(22)) },
    { id: 'job-3', orgId: ORG, customerId: 'cust-4', quoteId: 'quote-3', title: 'Spring Cleanup + Mulch — Greenfield HOA', description: 'Common-area cleanup, entrance beds, plantings.', address: '1100 Pine Lake Rd, Lincoln, NE', status: 'completed', completedAt: iso(daysAgo(20)), scheduledDate: isoDate(daysAgo(22)), revenue: 6400, total: 6400, assignedTo: ['m-brodie', 'm-nick', 'm-kenton', 'm-cole'], priority: 'normal', wcClass: 'lawn_care', workAuthorization: 'contract', createdAt: iso(daysAgo(30)) },
    { id: 'job-4', orgId: ORG, customerId: 'cust-6', quoteId: 'quote-7', title: 'Fire Pit + Paver Patio — Waverly', description: 'Paver patio, fire pit, 20 ft seat-wall.', address: '14250 N 14th St, Waverly, NE', status: 'completed', completedAt: iso(daysAgo(30)), scheduledDate: isoDate(daysAgo(34)), revenue: 9800, total: 9800, assignedTo: ['m-brodie', 'm-sean', 'm-nick', 'm-cole'], priority: 'normal', wcClass: 'masonry', workAuthorization: 'contract', createdAt: iso(daysAgo(35)) },
    { id: 'job-5', orgId: ORG, customerId: 'cust-7', quoteId: null, title: 'Commercial Lawn — May (Prairie Commons)', description: 'Monthly mow + bed maintenance.', address: '2000 Pinnacle Dr, Lincoln, NE', status: 'completed', completedAt: iso(daysAgo(5)), scheduledDate: isoDate(daysAgo(5)), revenue: 2400, total: 2400, assignedTo: ['m-kenton', 'm-brenden'], priority: 'normal', wcClass: 'lawn_care', workAuthorization: 'contract', createdAt: iso(daysAgo(7)) },
    { id: 'job-6', orgId: ORG, customerId: 'cust-3', quoteId: 'quote-4', title: 'Retaining Wall — Phase 1', description: '90 ft segmental wall, demo + haul old timbers.', address: '6740 Old Cheney Rd, Lincoln, NE', status: 'in_progress', completedAt: null, scheduledDate: today, scheduledDates: [today, isoDate(daysAhead(1))], scheduledTime: '07:30', revenue: 12400, total: 12400, assignedTo: ['m-brodie', 'm-nick', 'm-cole'], priority: 'high', wcClass: 'masonry', workAuthorization: 'contract', createdAt: iso(daysAgo(20)) },
    { id: 'job-7', orgId: ORG, customerId: 'cust-1', quoteId: null, title: 'Weekly Mow — Henderson', description: 'Mow, edge, trim, blow.', address: '8420 Eagle Ridge Rd, Lincoln, NE', status: 'scheduled', completedAt: null, scheduledDate: today, scheduledTime: '08:00', revenue: 65, total: 65, assignedTo: ['m-sean'], priority: 'normal', wcClass: 'lawn_care', workAuthorization: 'contract', createdAt: iso(daysAgo(6)) },
    { id: 'job-8', orgId: ORG, customerId: 'cust-5', quoteId: 'quote-5', title: 'Property Cleanup — Adams', description: 'Full property cleanup + haul.', address: '5012 S 84th St, Lincoln, NE', status: 'scheduled', completedAt: null, scheduledDate: isoDate(daysAhead(3)), scheduledTime: '09:00', revenue: 1450, total: 1450, assignedTo: ['m-kenton', 'm-brenden'], priority: 'normal', wcClass: 'lawn_care', workAuthorization: 'contract', createdAt: iso(daysAgo(4)) },
    { id: 'job-9', orgId: ORG, customerId: 'cust-10', quoteId: null, title: 'Sod Install — 2,000 sq ft', description: 'Grade, prep, lay sod, starter fertilizer.', address: '9015 Firethorn Ln, Lincoln, NE', status: 'scheduled', completedAt: null, scheduledDate: isoDate(daysAhead(7)), scheduledTime: '07:30', revenue: 3400, total: 3400, assignedTo: ['m-brodie', 'm-sean', 'm-nick'], priority: 'normal', wcClass: 'landscape_gardening', workAuthorization: 'contract', createdAt: iso(daysAgo(10)) },
    { id: 'job-10', orgId: ORG, customerId: 'cust-2', quoteId: null, title: 'Patio Sealing (warranty touch-up)', description: 'Re-seal after efflorescence complaint. Comped most of it.', address: '3215 Sheridan Blvd, Lincoln, NE', status: 'completed', completedAt: iso(daysAgo(45)), scheduledDate: isoDate(daysAgo(45)), revenue: 700, total: 700, assignedTo: ['m-brodie', 'm-cole'], priority: 'normal', wcClass: 'masonry', workAuthorization: 'contract', createdAt: iso(daysAgo(46)) },
  ];

  // ── Job expenses (COGS) ───────────────────────────────────
  let jeId = 0;
  const je = (jobId, category, amount, description, vendor, dDaysAgo) => ({
    id: `je-${++jeId}`, orgId: ORG, jobId, category, amount, description, vendor: vendor || '', date: isoDate(daysAgo(dDaysAgo)), createdAt: iso(daysAgo(dDaysAgo)),
  });
  const jobExpenses = [
    je('job-1', 'materials', 2400, 'Pavers + base + edging', 'Menards', 14), je('job-1', 'equipment', 250, 'Plate compactor rental', 'Sunbelt', 16), je('job-1', 'dump_fees', 100, 'Spoils haul', '', 13), je('job-1', 'fuel', 60, 'Crew trucks', '', 14),
    je('job-2', 'materials', 850, 'Mulch + fabric + edging', 'Outdoor Solutions', 9), je('job-2', 'dump_fees', 100, 'Old mulch + debris', '', 9), je('job-2', 'fuel', 40, 'Crew truck', '', 9),
    je('job-3', 'materials', 1200, 'Mulch + plantings', 'Outdoor Solutions', 22), je('job-3', 'equipment', 150, 'Trailer + blowers', '', 22), je('job-3', 'dump_fees', 200, 'Yard waste', '', 21), je('job-3', 'fuel', 80, 'Crew trucks', '', 22),
    je('job-4', 'materials', 2900, 'Pavers, fire-pit kit, wall block', 'Menards', 34), je('job-4', 'equipment', 300, 'Compactor + saw rental', 'Sunbelt', 34), je('job-4', 'dump_fees', 100, 'Spoils', '', 33), je('job-4', 'fuel', 90, 'Waverly round trips', '', 34),
    je('job-5', 'materials', 90, 'String + bags', '', 5), je('job-5', 'fuel', 50, 'Crew truck', '', 5),
    je('job-6', 'materials', 1800, 'Wall block (partial delivery)', 'Menards', 2), je('job-6', 'equipment', 220, 'Compactor rental', 'Sunbelt', 1),
    je('job-10', 'materials', 380, 'Sealer + sand', 'Home Depot', 45), je('job-10', 'dump_fees', 100, 'Haul', '', 45),
  ];

  // ── Time entries (labor) ──────────────────────────────────
  // Split each member's hours into ≤9h days ending around the job's completion.
  let teId = 0;
  const laborEntries = (jobId, endDaysAgo, crew) => {
    const out = [];
    for (const [memberId, totalHours] of crew) {
      const days = Math.max(1, Math.ceil(totalHours / 9));
      const perDay = totalHours / days;
      for (let d = 0; d < days; d++) {
        const base = daysAgo(endDaysAgo + (days - 1 - d));
        const start = atHour(base, 8, 0);
        const end = new Date(start.getTime() + perDay * 60 * 60 * 1000);
        out.push({ id: `te-${++teId}`, orgId: ORG, teamMemberId: memberId, jobId, clockIn: iso(start), clockOut: iso(end), breakMinutes: 0, createdAt: iso(end) });
      }
    }
    return out;
  };
  const timeEntries = [
    ...laborEntries('job-1', 12, [['m-brodie', 36], ['m-nick', 36], ['m-cole', 36]]),
    ...laborEntries('job-2', 8, [['m-brodie', 22], ['m-sean', 22]]),
    ...laborEntries('job-3', 20, [['m-brodie', 18], ['m-nick', 16], ['m-kenton', 16], ['m-cole', 16]]),
    ...laborEntries('job-4', 30, [['m-brodie', 32], ['m-sean', 30], ['m-nick', 30], ['m-cole', 30]]),
    ...laborEntries('job-5', 5, [['m-kenton', 14], ['m-brenden', 14]]),
    ...laborEntries('job-6', 0, [['m-brodie', 8], ['m-nick', 8], ['m-cole', 8]]),
    ...laborEntries('job-10', 45, [['m-brodie', 6], ['m-cole', 6]]),
  ];

  // ── Invoices ──────────────────────────────────────────────
  const inv = (id, num, customerId, jobId, total, amountPaid, status, dueDaysOffset, createdDaysAgo, extra = {}) => ({
    id, orgId: ORG, invoiceNumber: num, customerId, jobId, quoteId: extra.quoteId || null,
    total, amountPaid, subtotal: total, tax: 0, taxRate: 0, status,
    items: extra.items || [{ name: extra.itemName || 'Landscaping services', quantity: 1, unitPrice: total, total }],
    dueDate: isoDate(dueDaysOffset >= 0 ? daysAhead(dueDaysOffset) : daysAgo(-dueDaysOffset)),
    paidDate: extra.paidDaysAgo != null ? isoDate(daysAgo(extra.paidDaysAgo)) : null,
    notes: extra.notes || '', reminderCount: extra.reminderCount || 0,
    lastReminderAt: extra.reminderDaysAgo != null ? iso(daysAgo(extra.reminderDaysAgo)) : null,
    publicToken: extra.publicToken || null, createdAt: iso(daysAgo(createdDaysAgo)),
  });
  const invoices = [
    inv('inv-1', 'INV-0001', 'cust-1', 'job-1', 8650, 8650, 'paid', -3, 11, { quoteId: 'quote-1', paidDaysAgo: 10, publicToken: 'demoi1', itemName: 'Backyard paver patio' }),
    inv('inv-2', 'INV-0002', 'cust-2', 'job-2', 3200, 3200, 'paid', -1, 8, { quoteId: 'quote-2', paidDaysAgo: 7, publicToken: 'demoi2', itemName: 'Front bed refresh + mulch' }),
    inv('inv-3', 'INV-0003', 'cust-4', 'job-3', 6400, 3200, 'partial', 5, 16, { quoteId: 'quote-3', publicToken: 'demoi3', itemName: 'Spring cleanup + mulch', notes: 'Half on completion, balance net-15.' }),
    inv('inv-4', 'INV-0004', 'cust-6', 'job-4', 9800, 9800, 'paid', -18, 28, { quoteId: 'quote-7', paidDaysAgo: 25, publicToken: 'demoi4', itemName: 'Fire pit + paver patio' }),
    inv('inv-5', 'INV-0005', 'cust-7', 'job-5', 2400, 0, 'unpaid', 10, 4, { publicToken: 'demoi5', itemName: 'Commercial lawn — May' }),
    inv('inv-6', 'INV-0006', 'cust-3', 'job-6', 6200, 0, 'overdue', -6, 20, { publicToken: 'demoi6', itemName: 'Retaining wall — progress draw', reminderCount: 1, reminderDaysAgo: 2, notes: 'Phase 1 progress billing.' }),
    inv('inv-7', 'INV-0007', 'cust-2', 'job-10', 700, 700, 'paid', -33, 44, { paidDaysAgo: 40, publicToken: 'demoi7', itemName: 'Patio re-seal (warranty)' }),
    inv('inv-8', 'INV-0008', 'cust-12', null, 3750, 0, 'unpaid', 14, 3, { publicToken: 'demoi8', notes: 'Subcontract labor — 5 days @ $750', items: [{ name: 'Subcontract labor — day rate', quantity: 5, unitPrice: 750, total: 3750 }] }),
  ];

  // ── Payments (cash-basis revenue) ─────────────────────────
  const payments = [
    { id: 'pay-1', orgId: ORG, invoiceId: 'inv-1', amount: 8650, method: 'card', status: 'succeeded', paidAt: iso(daysAgo(10)), processorFee: 251.15, netAmount: 8398.85, notes: '', stripePaymentIntentId: 'pi_demo_1', createdAt: iso(daysAgo(10)) },
    { id: 'pay-2', orgId: ORG, invoiceId: 'inv-2', amount: 3200, method: 'cash', status: 'succeeded', paidAt: iso(daysAgo(7)), processorFee: 0, netAmount: 3200, notes: '', createdAt: iso(daysAgo(7)) },
    { id: 'pay-3', orgId: ORG, invoiceId: 'inv-3', amount: 3200, method: 'check', status: 'succeeded', paidAt: iso(daysAgo(15)), processorFee: 0, netAmount: 3200, notes: 'Deposit / first half', createdAt: iso(daysAgo(15)) },
    { id: 'pay-4', orgId: ORG, invoiceId: 'inv-4', amount: 9800, method: 'ach', status: 'succeeded', paidAt: iso(daysAgo(25)), processorFee: 5, netAmount: 9795, notes: '', stripePaymentIntentId: 'pi_demo_4', createdAt: iso(daysAgo(25)) },
    { id: 'pay-7', orgId: ORG, invoiceId: 'inv-7', amount: 700, method: 'cash', status: 'succeeded', paidAt: iso(daysAgo(40)), processorFee: 0, netAmount: 700, notes: '', createdAt: iso(daysAgo(40)) },
  ];

  // ── Company expenses (overhead) ───────────────────────────
  const ce = (id, category, amount, description, vendor, dDaysAgo, recurring) => ({
    id, orgId: ORG, category, amount, description, vendor: vendor || '', date: isoDate(daysAgo(dDaysAgo)), recurring: !!recurring, recurringInterval: recurring ? 'monthly' : null, createdAt: iso(daysAgo(dDaysAgo)),
  });
  const companyExpenses = [
    ce('ce-1', 'vehicle', 650, 'Truck payment', 'Ally', 15, true),
    ce('ce-2', 'insurance', 420, 'GL + workers comp premium', 'EMC', 12, true),
    ce('ce-3', 'fuel', 380, 'Fuel — crew trucks', '', 9, false),
    ce('ce-4', 'software', 45, 'QuickBooks + tools', '', 20, true),
    ce('ce-5', 'marketing', 3000, 'WE Media — marketing & dev (Macoy)', 'WE Media', 5, true),
    ce('ce-6', 'office_supplies', 120, 'Printer, paper, forms', '', 22, false),
    ce('ce-7', 'payroll_tax', 1180, 'Employer payroll taxes — May', '', 3, false),
    ce('ce-8', 'other', 260, 'Mower blades + trimmer line', 'Outdoor Power', 30, false),
    ce('ce-9', 'fuel', 340, 'Fuel — prior period', '', 38, false),
    ce('ce-10', 'insurance', 420, 'GL + workers comp premium', 'EMC', 42, true),
  ];

  // ── Contracts ─────────────────────────────────────────────
  const contracts = [
    { id: 'ctr-1', orgId: ORG, contractNumber: 'C-1001', customerId: 'cust-1', quoteId: 'quote-1', jobId: 'job-1', status: 'signed', signatureTypedName: 'Mark Henderson', signedAt: iso(daysAgo(41)), pdfUrl: '', createdAt: iso(daysAgo(42)) },
    { id: 'ctr-2', orgId: ORG, contractNumber: 'C-1002', customerId: 'cust-6', quoteId: 'quote-7', jobId: 'job-4', status: 'signed', signatureTypedName: 'Robert Wells', signedAt: iso(daysAgo(36)), pdfUrl: '', createdAt: iso(daysAgo(37)) },
    { id: 'ctr-3', orgId: ORG, contractNumber: 'C-1003', customerId: 'cust-3', quoteId: 'quote-4', jobId: null, status: 'sent', signatureTypedName: null, pdfUrl: '', createdAt: iso(daysAgo(5)) },
  ];

  // ── Calendar events ───────────────────────────────────────
  const calendarEvents = [
    { id: 'ev-1', orgId: ORG, title: 'Quote — Mitchell retaining wall', date: today, time: '10:00', customerId: 'cust-3', type: 'quote', createdAt: iso(daysAgo(3)) },
    { id: 'ev-2', orgId: ORG, title: 'Crew: Henderson patio finish', date: isoDate(daysAhead(1)), time: '08:00', customerId: 'cust-1', type: 'job', createdAt: iso(daysAgo(3)) },
    { id: 'ev-3', orgId: ORG, title: 'Material pickup — Outdoor Solutions', date: isoDate(daysAhead(2)), time: '07:30', customerId: null, type: 'task', createdAt: iso(daysAgo(2)) },
    { id: 'ev-4', orgId: ORG, title: 'Site walk — Prairie Commons', date: isoDate(daysAgo(2)), time: '13:00', customerId: 'cust-7', type: 'meeting', createdAt: iso(daysAgo(6)) },
  ];

  // ── Activity feed ─────────────────────────────────────────
  const activity = [
    { id: 'act-1', orgId: ORG, type: 'payment', title: 'Payment received', message: 'Payment received — $8,650 from Mark Henderson', description: 'Payment received — $8,650 from Mark Henderson', createdAt: iso(daysAgo(10)) },
    { id: 'act-2', orgId: ORG, type: 'job_completed', title: 'Job completed', message: 'Completed: Spring Cleanup + Mulch — Greenfield HOA', description: 'Completed: Spring Cleanup + Mulch — Greenfield HOA', createdAt: iso(daysAgo(20)) },
    { id: 'act-3', orgId: ORG, type: 'quote', title: 'Quote sent', message: 'Quote #1004 sent to Sarah Mitchell', description: 'Quote #1004 sent to Sarah Mitchell', createdAt: iso(daysAgo(6)) },
    { id: 'act-4', orgId: ORG, type: 'lead', title: 'New lead', message: 'New website lead — Michael Brennan', description: 'New website lead — Michael Brennan', createdAt: iso(daysAgo(3)) },
  ];

  // ── Contractors (1099) ────────────────────────────────────
  const contractors = [
    { id: 'con-1', orgId: ORG, contactName: 'Macoy Wollenburg', businessName: 'WE Media', classification: '1099_contractor', email: 'macoy@wemedia.example.com', phone: '(402) 555-0300', address: 'Lincoln, NE', notes: 'Marketing + development.', createdAt: iso(daysAgo(80)) },
    { id: 'con-2', orgId: ORG, contactName: 'Lincoln Iron Works', businessName: 'Lincoln Iron Works', classification: '1099_contractor', email: 'shop@lincolniron.example.com', phone: '(402) 555-0311', address: 'Lincoln, NE', notes: 'Custom ornamental iron fab partner.', createdAt: iso(daysAgo(50)) },
  ];

  // ── Mileage ───────────────────────────────────────────────
  const mileageEntries = [
    { id: 'mil-1', orgId: ORG, teamMemberId: 'demo-user-1', date: isoDate(daysAgo(5)), miles: 28, purpose: 'Material pickup — Outdoor Solutions (Roca)', jobId: null, createdAt: iso(daysAgo(5)) },
    { id: 'mil-2', orgId: ORG, teamMemberId: 'm-brodie', date: isoDate(daysAgo(8)), miles: 42, purpose: 'Job site — Waverly', jobId: 'job-4', createdAt: iso(daysAgo(8)) },
    { id: 'mil-3', orgId: ORG, teamMemberId: 'demo-user-1', date: isoDate(daysAgo(2)), miles: 16, purpose: 'Estimate — Mitchell', jobId: null, createdAt: iso(daysAgo(2)) },
  ];

  // ── Write everything ──────────────────────────────────────
  const set = (key, val) => localStorage.setItem(`lucky_${key}`, JSON.stringify(val));
  set('team_members', teamMembers);
  set('suppliers', suppliers);
  set('materials', materials);
  set('customers', customers);
  set('quotes', quotes);
  set('jobs', jobs);
  set('job_expenses', jobExpenses);
  set('time_entries', timeEntries);
  set('time_segments', []);
  set('invoices', invoices);
  set('payments', payments);
  set('company_expenses', companyExpenses);
  set('contracts', contracts);
  set('calendar_events', calendarEvents);
  set('activity', activity);
  set('contractors', contractors);
  set('mileage_entries', mileageEntries);
  set('services', []);
  set('job_media', []);
  set('quote_media', []);
}
