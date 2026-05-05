// Material volume + weight calculator helpers.
//
// One source of truth for converting (area × depth) → cubic yards / cubic feet
// and estimating delivery weight in lbs/tons. Intended for landscaping bulk
// materials sold by the cubic yard (mulch, topsoil, rock, sand) — not for
// brick/paver-style unit materials.
//
// Industry averages used here are approximate. Actual yard weight varies with
// moisture, compaction, and material grade; treat outputs as estimates for
// quoting and delivery sizing, not as a billable measurement.

// lbs per cubic yard. Sources: midpoint of common supplier published ranges
// (Outdoor Solutions, Menards, Home Depot bulk product pages, plus the
// USDA NRCS Engineering Field Handbook for soil/aggregate densities).
export const MATERIAL_DENSITY_LBS_PER_CY = {
  mulch_hardwood: 900,
  mulch_dyed: 950,
  mulch_cedar: 800,
  topsoil: 2200,
  compost: 1100,
  sand: 2700,
  pea_gravel: 2800,
  river_rock_3_4: 2700,
  river_rock_1_5: 2700,
  decorative_rock: 2800,
  crushed_limestone: 2700,
  paver_base: 2900,
  fill_dirt: 2400,
};

export const MATERIAL_TYPES = [
  { id: 'mulch_hardwood', label: 'Hardwood mulch', recommendedDepthIn: 3, unitVolume: 'cu yd' },
  { id: 'mulch_dyed', label: 'Dyed mulch', recommendedDepthIn: 3, unitVolume: 'cu yd' },
  { id: 'mulch_cedar', label: 'Cedar mulch', recommendedDepthIn: 3, unitVolume: 'cu yd' },
  { id: 'topsoil', label: 'Topsoil', recommendedDepthIn: 4, unitVolume: 'cu yd' },
  { id: 'compost', label: 'Compost', recommendedDepthIn: 2, unitVolume: 'cu yd' },
  { id: 'sand', label: 'Sand', recommendedDepthIn: 2, unitVolume: 'cu yd' },
  { id: 'pea_gravel', label: 'Pea gravel', recommendedDepthIn: 2, unitVolume: 'cu yd' },
  { id: 'river_rock_3_4', label: 'River rock (¾")', recommendedDepthIn: 2, unitVolume: 'cu yd' },
  { id: 'river_rock_1_5', label: 'River rock (1½")', recommendedDepthIn: 3, unitVolume: 'cu yd' },
  { id: 'decorative_rock', label: 'Decorative rock', recommendedDepthIn: 2, unitVolume: 'cu yd' },
  { id: 'crushed_limestone', label: 'Crushed limestone', recommendedDepthIn: 4, unitVolume: 'cu yd' },
  { id: 'paver_base', label: 'Paver base / road base', recommendedDepthIn: 6, unitVolume: 'cu yd' },
  { id: 'fill_dirt', label: 'Fill dirt', recommendedDepthIn: 6, unitVolume: 'cu yd' },
];

// Depth presets (inches) — matches what crews actually spread.
export const DEPTH_PRESETS = [2, 3, 4, 6];

// Bag products for retail-store fallback math (Menards / Home Depot).
// Most bagged mulch covers ~6 sqft at 3" depth or ~9 sqft at 2" depth.
export const BAGGED_MULCH_CU_FT_PER_BAG = 2;
export const BAGGED_TOPSOIL_CU_FT_PER_BAG = 0.75;

// ────────────────────────────────────────────────────────────────────────
// Pure helpers — all return finite numbers; never throw.

export function cubicYardsFromAreaAndDepth(sqft, depthInches) {
  const a = Number(sqft) || 0;
  const d = Number(depthInches) || 0;
  if (a <= 0 || d <= 0) return 0;
  // sqft × (depth_in / 12 in per ft) = cu ft. Then / 27 cu ft per cu yd.
  return (a * (d / 12)) / 27;
}

export function cubicFeetFromAreaAndDepth(sqft, depthInches) {
  const a = Number(sqft) || 0;
  const d = Number(depthInches) || 0;
  if (a <= 0 || d <= 0) return 0;
  return a * (d / 12);
}

export function weightLbsForVolume(cubicYards, materialId) {
  const cy = Number(cubicYards) || 0;
  const lbsPerCy = MATERIAL_DENSITY_LBS_PER_CY[materialId];
  if (cy <= 0 || !lbsPerCy) return 0;
  return cy * lbsPerCy;
}

export function bagsNeeded(cubicFeet, cuFtPerBag) {
  const cuf = Number(cubicFeet) || 0;
  const per = Number(cuFtPerBag) || 0;
  if (cuf <= 0 || per <= 0) return 0;
  return Math.ceil(cuf / per);
}

// One-shot helper used by the UI: returns everything you need for one
// material at one (area, depth). Rounded for display.
export function summarize({ sqft, depthInches, materialId }) {
  const cy = cubicYardsFromAreaAndDepth(sqft, depthInches);
  const cuFt = cubicFeetFromAreaAndDepth(sqft, depthInches);
  const lbs = weightLbsForVolume(cy, materialId);
  const tons = lbs / 2000;
  const isMulch = materialId && materialId.startsWith('mulch');
  const isSoil = materialId === 'topsoil' || materialId === 'compost';
  const cuFtPerBag = isMulch ? BAGGED_MULCH_CU_FT_PER_BAG
    : isSoil ? BAGGED_TOPSOIL_CU_FT_PER_BAG
    : null;
  const bags = cuFtPerBag ? bagsNeeded(cuFt, cuFtPerBag) : null;
  return {
    cubicYards: cy,
    cubicYardsRounded: Math.round(cy * 100) / 100,
    cubicFeet: cuFt,
    cubicFeetRounded: Math.round(cuFt * 10) / 10,
    weightLbs: Math.round(lbs),
    weightTons: Math.round(tons * 100) / 100,
    bagsNeeded: bags,
    cuFtPerBag,
  };
}
