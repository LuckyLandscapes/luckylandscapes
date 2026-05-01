// ─── Contract template ────────────────────────────────────────────────────────
// Renders a service agreement from a quote + customer + org. The output is
// frozen into contracts.body at generation time so future template changes
// don't retroactively rewrite what a customer agreed to.
//
// The clauses below are written for Lucky Landscapes' typical residential
// hardscape / softscape / lawn work in Lincoln, NE. They cover scope, payment
// (deposit + balance due on completion), change orders, weather delays,
// underground utilities, warranty, and termination — the standard set every
// landscape contractor needs. Customize the CLAUSE_* constants below as the
// business evolves; legal review is recommended before treating these as
// authoritative for high-value work.

const COMPANY_NAME = 'Lucky Landscapes';
const COMPANY_ADDR = '109 South Canopy ST, Lincoln, NE';
const COMPANY_PHONE = '(402) 405-5475';
const COMPANY_EMAIL = 'rileykopf@luckylandscapes.com';

function fmtMoney(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(n) || 0);
}

function fmtDate(d) {
  if (!d) return 'TBD';
  const date = typeof d === 'string' ? new Date(d.includes('T') ? d : d + 'T12:00:00') : d;
  if (Number.isNaN(date.getTime())) return 'TBD';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function customerFullName(c) {
  if (!c) return 'Customer';
  return [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || 'Customer';
}

function customerAddress(c) {
  if (!c) return '';
  const street = c.address || '';
  const cityLine = [c.city, c.state, c.zip].filter(Boolean).join(', ').replace(', ', ', ');
  return [street, cityLine].filter(Boolean).join('\n');
}

function buildScopeOfWork(quote) {
  const items = Array.isArray(quote?.items) ? quote.items : [];
  if (!items.length) return '(No line items recorded — scope to be defined in writing before work begins.)';
  return items.map((it, i) => {
    const qty = it.quantity || 1;
    const name = it.name || it.description || 'Service';
    const desc = it.description && it.description !== it.name ? ` — ${it.description}` : '';
    const total = it.total != null ? `  ${fmtMoney(it.total)}` : '';
    return `  ${i + 1}. ${qty} × ${name}${desc}${total}`;
  }).join('\n');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildContractFromQuote({ quote, customer, options = {} }) {
  const total = Number(quote?.total || 0);
  const deposit = Number(quote?.materialsCost || 0) + Number(quote?.deliveryFee || 0);
  const balance = Math.max(0, total - deposit);
  const startDate = options.startDate || null;
  const completionWindow = options.completionWindow || 'within 14 business days of the agreed start date, weather permitting';
  const category = quote?.category || 'Landscape services';
  const scope = buildScopeOfWork(quote);
  const customerName = customerFullName(customer);
  const customerAddr = customerAddress(customer);
  const today = new Date();

  const body = renderContractBody({
    customerName,
    customerEmail: customer?.email || '',
    customerPhone: customer?.phone || '',
    customerAddr,
    category,
    scope,
    total,
    deposit,
    balance,
    startDate,
    completionWindow,
    quoteNumber: quote?.quoteNumber || '',
    today,
  });

  return {
    title: `${category} — Service Agreement`,
    category,
    scopeOfWork: scope,
    totalAmount: total,
    depositAmount: deposit,
    startDate,
    completionWindow,
    body,
    customerSnapshot: {
      name: customerName,
      email: customer?.email || '',
      phone: customer?.phone || '',
      address: customer?.address || '',
      city: customer?.city || '',
      state: customer?.state || '',
      zip: customer?.zip || '',
    },
  };
}

export function renderContractBody({
  customerName,
  customerEmail,
  customerPhone,
  customerAddr,
  category,
  scope,
  total,
  deposit,
  balance,
  startDate,
  completionWindow,
  quoteNumber,
  today,
}) {
  const dateStr = fmtDate(today || new Date());
  const startStr = fmtDate(startDate);
  const depositLine = deposit > 0
    ? `A non-refundable deposit of ${fmtMoney(deposit)} (covering materials and delivery) is due upon signing. The remaining balance of ${fmtMoney(balance)} is due upon substantial completion of the work, payable within seven (7) days of invoice.`
    : `Full payment of ${fmtMoney(total)} is due upon substantial completion of the work, payable within seven (7) days of invoice.`;

  return [
    `${COMPANY_NAME.toUpperCase()} — SERVICE AGREEMENT`,
    `Agreement Date: ${dateStr}`,
    quoteNumber ? `Reference Quote: #${quoteNumber}` : null,
    '',
    'PARTIES',
    `This Service Agreement ("Agreement") is entered into between ${COMPANY_NAME} ("Contractor"), located at ${COMPANY_ADDR}, and the undersigned customer ("Customer"):`,
    '',
    `  Name:    ${customerName}`,
    customerEmail ? `  Email:   ${customerEmail}` : null,
    customerPhone ? `  Phone:   ${customerPhone}` : null,
    customerAddr ? `  Address: ${customerAddr.split('\n').join('\n           ')}` : null,
    '',
    '1. SCOPE OF WORK',
    `Contractor agrees to perform the following ${category.toLowerCase()} services at the Customer's property:`,
    '',
    scope,
    '',
    'Any work outside this scope must be authorized in writing as a Change Order (Section 5) before it is performed.',
    '',
    '2. PRICE & PAYMENT',
    `Total contract price: ${fmtMoney(total)}.`,
    depositLine,
    'Accepted payment methods include credit/debit card, ACH bank transfer, check, and cash. Past-due balances accrue interest at 12% per month (12% APR). Customer is responsible for reasonable collection costs and attorneys\' fees if collection becomes necessary.',
    '',
    '3. SCHEDULE',
    `Estimated start date: ${startStr}. Contractor will substantially complete the work ${completionWindow}. Both parties acknowledge that landscape work is weather-dependent, and Contractor may reschedule for rain, snow, frozen ground, or unsafe conditions without penalty. Contractor will give Customer reasonable notice of weather-related delays.`,
    '',
    '4. SITE ACCESS, UTILITIES & EXISTING CONDITIONS',
    `Customer will provide reasonable access to the work area, including water and electricity where needed, during normal working hours (7:00 AM – 7:00 PM, Monday–Saturday). Customer is responsible for marking, or having marked, the location of any private underground utilities, sprinkler lines, invisible pet fences, low-voltage wiring, septic systems, and other buried features not covered by Nebraska 811. Contractor will call Nebraska 811 ("Diggers Hotline") for public utility locates before any excavation. Contractor is not liable for damage to unmarked private buried infrastructure.`,
    '',
    '5. CHANGE ORDERS',
    'Any change to the scope, materials, or price of the work must be agreed to in writing (email or signed amendment) before that change is performed. Verbal change requests are not binding. Change orders may extend the completion window.',
    '',
    '6. MATERIALS & SUBSTITUTIONS',
    'Plant material, stone, mulch, pavers, and other supplies are sourced from Contractor\'s preferred vendors. If a specified item becomes unavailable or substantially increases in cost between signing and installation, Contractor may substitute a comparable item of equal or greater value, or issue a Change Order for the price difference, at Customer\'s option.',
    '',
    '7. WARRANTY',
    'Contractor warrants its workmanship for one (1) year from substantial completion. Hardscape installations (paver patios, retaining walls, edging) are warranted against settling or failure caused by defective workmanship for one (1) year. Live plant material is warranted to be healthy at time of installation; because plant survival depends on Customer watering, weather, animal damage, and other factors outside Contractor\'s control, plants are NOT warranted against death after installation unless a separate plant warranty is purchased in writing. This warranty does not cover damage from neglect, abuse, vandalism, severe weather (hail, flooding, drought, freeze), or work modified by anyone other than Contractor.',
    '',
    '8. CUSTOMER RESPONSIBILITIES AFTER COMPLETION',
    'Customer agrees to water newly installed plants and sod as instructed at hand-off, to keep equipment off freshly installed turf or hardscape until cured/established, and to notify Contractor in writing within seven (7) days of any visible defect. Failure to perform basic aftercare voids the workmanship warranty for affected items.',
    '',
    '9. INSURANCE & LIABILITY',
    `Contractor carries general liability insurance and will provide a Certificate of Insurance on request. Contractor's total liability under this Agreement is limited to the amount paid by Customer for the specific work giving rise to the claim. Neither party is liable to the other for indirect, incidental, or consequential damages.`,
    '',
    '10. PHOTOGRAPHY & PORTFOLIO USE',
    'Customer grants Contractor permission to photograph completed work for portfolio, marketing, social media, and website use. Photographs will not identify Customer\'s street address or full name without separate written permission. Customer may revoke this permission at any time by written notice.',
    '',
    '11. CANCELLATION & TERMINATION',
    'Customer may cancel this Agreement in writing within three (3) business days of signing for a full refund of any deposit. After that period, the deposit becomes non-refundable to cover materials ordered and labor scheduled. If Customer terminates after work has begun, Customer will pay for all labor performed and materials installed or delivered to the job site, plus a 15% restocking fee on any returnable unused materials. Contractor may terminate this Agreement and remove its equipment if Customer fails to pay amounts when due, fails to provide reasonable site access, or makes the worksite unsafe.',
    '',
    '12. DISPUTES',
    'The parties will attempt to resolve any dispute in good faith before pursuing legal action. This Agreement is governed by the laws of the State of Nebraska, and venue for any legal action lies in Lancaster County, Nebraska.',
    '',
    '13. ENTIRE AGREEMENT',
    'This document, together with the referenced quote and any signed change orders, constitutes the entire agreement between the parties and supersedes any prior verbal or written discussions. No modification is binding unless made in writing and signed by both parties.',
    '',
    'CUSTOMER SIGNATURE',
    'By signing below, Customer acknowledges that they have read, understood, and agree to be bound by every section of this Agreement, and that the person signing is at least 18 years of age and authorized to enter into this Agreement on behalf of the property at the address listed above.',
    '',
    `${COMPANY_NAME}`,
    `${COMPANY_ADDR} • ${COMPANY_PHONE} • ${COMPANY_EMAIL}`,
  ].filter(line => line !== null).join('\n');
}
