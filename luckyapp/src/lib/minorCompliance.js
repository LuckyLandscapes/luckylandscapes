// FLSA child-labor compliance helpers.
//
// Lucky's crew is half high-school juniors (per docs/company.md), so the
// app surfaces age-driven restrictions to keep Riley from accidentally
// scheduling a 16-year-old to run a chainsaw or work past a school-week
// hour cap.
//
// IMPORTANT: this is NOT a payroll-tax surface. Non-family W-2 employees
// owe full FICA / FUTA / state UI from $1, regardless of age. Family
// employment exemptions (under-18 child of sole-prop owner = FICA-exempt;
// under-21 = FUTA-exempt) do NOT apply to Riley's crew.
//
// Source: 29 CFR Part 570 (FLSA child labor) — federal floor; Nebraska
// follows federal. Always check Nebraska Department of Labor for any
// state-specific add-ons before using this as legal advice.

// Birthdays are stored as 'YYYY-MM-DD' strings in Postgres / camelCased
// to dateOfBirth on the JS side. Parse safely.
function parseDob(dob) {
  if (!dob) return null;
  // Both 'YYYY-MM-DD' and full ISO timestamps work with Date()
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// Years between dob and `asOf` (defaults to today). Floored.
export function computeAge(dob, asOf = new Date()) {
  const d = parseDob(dob);
  if (!d) return null;
  let age = asOf.getFullYear() - d.getFullYear();
  const monthDiff = asOf.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < d.getDate())) age--;
  return age;
}

export function isMinor(dob) {
  const age = computeAge(dob);
  return age != null && age < 18;
}

export function isUnder16(dob) {
  const age = computeAge(dob);
  return age != null && age < 16;
}

// Hazardous tasks barred for under-18 employees in non-agricultural work.
// 29 CFR 570.50–570.68 condensed to landscape-relevant items.
export const HAZARDOUS_TASKS_UNDER_18 = [
  'Riding mowers >20HP (HO 7)',
  'Chainsaws and circular saws (HO 14)',
  'Wood chippers (HO 14)',
  'Trenchers and earth-moving equipment (HO 16)',
  'Operating most power-driven hoists (HO 7)',
  'Roofing and work on roofs (HO 16)',
  'Driving on the job (limited under HO 2)',
];

// Hour caps for under-16 in non-agricultural work (29 CFR 570.35).
// School-day vs non-school-day distinction matters: weekends, holidays,
// and summer break are "non-school" days even if school is in session.
export const HOUR_CAPS_UNDER_16 = {
  schoolDayMaxHours: 3,
  schoolWeekMaxHours: 18,
  nonSchoolDayMaxHours: 8,
  nonSchoolWeekMaxHours: 40,
  earliestStart: '7:00 AM',
  latestEnd: { schoolWeek: '7:00 PM', summer: '9:00 PM' },
};

// One-shot helper: given a team member with optional DOB, return a list
// of human-readable warning strings the UI can surface. Empty array if
// the member is 18+, has no DOB, or DOB parsing failed.
export function getComplianceWarnings(member) {
  const warnings = [];
  if (!member?.dateOfBirth) return warnings;
  const age = computeAge(member.dateOfBirth);
  if (age == null) return warnings;
  if (age >= 18) return warnings;

  warnings.push(`Minor employee (age ${age}). FLSA child-labor rules apply.`);
  warnings.push(`Cannot operate: ${HAZARDOUS_TASKS_UNDER_18.slice(0, 4).join('; ')}; etc.`);

  if (age < 16) {
    warnings.push(`Under 16: school-day hour cap is ${HOUR_CAPS_UNDER_16.schoolDayMaxHours}h; school-week cap is ${HOUR_CAPS_UNDER_16.schoolWeekMaxHours}h.`);
    warnings.push(`Cannot work before ${HOUR_CAPS_UNDER_16.earliestStart} or after 7 PM during the school year.`);
  }

  return warnings;
}

// Color tier for the age pill on the team list — green for adults,
// orange for 16–17 (most restrictions), red for under 16 (strict caps).
export function ageTier(member) {
  const age = computeAge(member?.dateOfBirth);
  if (age == null) return 'unknown';
  if (age < 16) return 'strict';
  if (age < 18) return 'restricted';
  return 'adult';
}
