// Menards Lincoln-area starter catalog. Hand-curated, with product URLs
// and CDN images researched via WebSearch + WebFetch. Menards uses
// Akamai/Incapsula bot detection, so the live "Refresh prices" button
// won't reach these — but the supplier-link chip in the catalog detail
// panel deep-links straight to the product page for manual lookup.
//
// Product names match what Menards actually stocks (their house brands
// are Midwest Block, Wood Ecology, Akona, RockStep, Hardscaper's Choice,
// Polar Plastics, Master Mark, Loctite). Where a Pavestone/Anchor/Vigoro
// equivalent doesn't exist at Menards, the closest house-brand
// substitute is used — descriptions flag this so the salesperson knows.
//
// Prices are 2026-05 typical retail, approximate. Verify before quoting.
//
// Customer-visibility flag: substrate sand, polymeric joint sand, fabric,
// adhesive, and stakes are flagged internal-only — they're plumbing the
// customer doesn't pick by photo.

export const MENARDS_STARTER_CATALOG = [
  // ── Pavers (customer-visible) ──────────────────────────────────────────
  {
    name: 'Charcoal Holland Paver 4 in. x 8 in.',
    category: 'Pavers',
    unit: 'each',
    unitCost: 0.79,
    description: 'Tumbled-edge concrete paver, sold per piece. ~4.5 pieces per sqft. Menards house-brand Holland (Pavestone equivalent).',
    supplierUrl: 'https://www.menards.com/main/building-materials/landscaping-materials/pavers-patio-blocks/4-x-8-holland-paver/1793058/p-1444441411401-c-5786.htm',
    // Menards CDN doesn't expose this product's photo via a stable URL —
    // upload one in the catalog form, or click "Refresh prices" to try
    // pulling og:image from the product page.
    color: 'Charcoal',
  },
  {
    name: '12 in. x 12 in. Smooth Patio Block',
    category: 'Pavers',
    unit: 'each',
    unitCost: 4.50,
    description: '12" square smooth concrete patio block — common for stepping pads and small patios. Stack-and-go install.',
    supplierUrl: 'https://www.menards.com/main/building-materials/landscaping-materials/pavers-patio-blocks/12-x-12-smooth-patio-block/1791310/p-1444441417480-c-5786.htm',
    // Menards CDN URL not stable — placeholder fallback until upload.
  },
  {
    name: 'RockStep 36 in. Broken Face Step',
    category: 'Pavers',
    unit: 'each',
    unitCost: 60,
    description: 'Cast-stone step block, 36" long with broken-face textured front. ~6" rise.',
    supplierUrl: 'https://www.menards.com/main/building-materials/landscaping-materials/stone-steps/rockstep-reg-36-random-broken-face-step/24236/p-1444441888815-c-9534.htm',
    imageUrl: 'https://cdn.menardc.com/main/items/media/SHARE002/ProductMedium/1794053-1794054-3and4-broken-face-step-brown.jpg',
  },

  // ── Retaining Wall (customer-visible) ──────────────────────────────────
  {
    name: 'Sienna Clifton Straight Retaining Wall Block 8 in. x 18 in.',
    category: 'Retaining Wall',
    unit: 'each',
    unitCost: 5,
    description: 'Standard retaining wall block, 8" tall, 1 sqft face coverage. Menards equivalent of Anchor Diamond Pro / Pavestone hardscape block.',
    supplierUrl: 'https://www.menards.com/main/building-materials/landscaping-materials/retaining-wall-block/8-x-18-clifton-straight-retaining-wall-block/1793965/p-1444441434373-c-5787.htm',
    imageUrl: 'https://cdn.menardc.com/main/items/media/MWBLK001/ProductMedium/1793964_3965_3966_3969.jpg',
    color: 'Sienna',
  },
  {
    name: 'Crestone Beveled Wall Block 3-1/2 in. x 11-1/2 in.',
    category: 'Retaining Wall',
    unit: 'each',
    unitCost: 4,
    description: 'Lower-profile wall block (3-1/2" tall, beveled face) for short walls and tree rings.',
    supplierUrl: 'https://www.menards.com/main/building-materials/landscaping-materials/retaining-wall-block/3-1-2-x-11-1-2-crestone-reg-beveled-retaining-wall-block/1794083/p-1444441419726-c-5787.htm',
    // Menards CDN URL not stable — placeholder fallback until upload.
    color: 'Tan',
  },

  // ── Edging (customer-visible) ──────────────────────────────────────────
  {
    name: 'Colmet 8 ft Steel Landscape Edging w/ Stakes',
    category: 'Edging',
    unit: 'each',
    unitCost: 28,
    description: 'Heavy-duty 8 ft steel landscape edging strip with stakes. Cuts to length for clean curves. Menards stocks 8 ft sections (no 4 ft).',
    supplierUrl: 'https://www.menards.com/main/building-materials/landscaping-materials/lawn-edging-tree-rings/col-met-reg-4-x-8-green-steel-lawn-edging-with-stakes/814/p-1470102769650-c-13237.htm',
    imageUrl: 'https://cdn.menardc.com/main/items/media/COLLI002/ProductMedium/2683015_FV.jpg',
    color: 'Green',
  },
  {
    name: "Hardscaper's Choice 60 ft Coiled Paver Edging",
    category: 'Edging',
    unit: 'each',
    unitCost: 27,
    description: 'Flexible 60 ft commercial-grade plastic landscape edging coil — economy option for bed lines.',
    supplierUrl: 'https://www.menards.com/main/building-materials/landscaping-materials/landscape-edgers/hardscapers-choice-commercial-grade-60-coiled-paver-edging/3103-60mn-3/p-1642874261508653-c-5783.htm',
    imageUrl: 'https://cdn.menardc.com/main/items/media/DIMEX001/ProductMedium/3103-60MN-3highRES.jpg',
  },

  // ── Sand & Gravel (mostly internal — base/joint material) ──────────────
  {
    name: 'Leveling Sand 0.5 cu ft',
    category: 'Sand & Gravel',
    unit: 'bag',
    unitCost: 6,
    description: 'Bagged paver leveling/base sand. Substrate beneath pavers. Menards house-brand (Quikrete equivalent).',
    isCustomerVisible: false,
    supplierUrl: 'https://www.menards.com/main/building-materials/landscaping-materials/landscape-rock/leveling-sand-1-2-cu-ft/1891138/p-1444441404926.htm',
    imageUrl: 'https://cdn.menardc.com/main/items/media/MWBAG001/ProductMedium/1891138_3_22_22.jpg',
  },
  {
    name: 'All Purpose Dried Sand 60 lb',
    category: 'Sand & Gravel',
    unit: 'bag',
    unitCost: 6,
    description: 'General-purpose 60 lb bagged dried sand. Menards house-brand (Sakrete equivalent — Menards stocks 60 lb, not 50 lb).',
    isCustomerVisible: false,
    supplierUrl: 'https://www.menards.com/main/building-materials/concrete-cement-masonry/bagged-concrete-cement-mortar/all-purpose-dried-sand-60-lbs/1891090/p-1506407329497-c-5648.htm',
    imageUrl: 'https://cdn.menardc.com/main/items/media/MWBAG001/ProductMedium/189-1090_All_Purpose_Dried_Sand_Front.jpg',
  },
  {
    name: 'Akona High-Performance Polymeric Sand 50 lb',
    category: 'Sand & Gravel',
    unit: 'bag',
    unitCost: 35,
    description: 'Polymeric joint sand — sets hard between pavers, prevents weeds. Menards Akona house-brand (Sakrete equivalent).',
    isCustomerVisible: false,
    supplierUrl: 'https://www.menards.com/main/building-materials/landscaping-materials/landscape-rock/high-performance-polymeric-paver-locking-sand-50-lb/189-1168/p-1522305010704-c-5784.htm',
    imageUrl: 'https://cdn.menardc.com/main/items/media/DYNAM021/ProductMedium/1891168_SC_042722.jpg',
  },

  // ── Soil & Amendments (customer-visible) ───────────────────────────────
  {
    name: 'Premium Topsoil 0.75 cu ft Bag',
    category: 'Soil & Amendments',
    unit: 'bag',
    unitCost: 4,
    description: 'Bagged premium topsoil — small fill jobs and turf prep.',
    supplierUrl: 'https://www.menards.com/main/outdoors/gardening/lawn-plant-care/compost-soils-amendments/premium-top-soil-75-cu-ft/premium-top-soil/p-1444449052683-c-1463608034794.htm',
    imageUrl: 'https://cdn.menardc.com/main/items/media/NEWPL001/ProductMedium/066NPL_PremiumTopSoilSM2.jpg',
  },

  // ── Mulch (customer-visible) ───────────────────────────────────────────
  {
    name: 'Brown Wood Mulch 2 cu ft Bag',
    category: 'Mulch',
    unit: 'bag',
    unitCost: 5,
    description: 'Bagged hardwood mulch, brown — economy alternative to bulk for small beds. Menards house-brand.',
    color: 'Brown',
    supplierUrl: 'https://www.menards.com/main/building-materials/landscaping-materials/mulch/brown-wood-mulch-2-0-cu-ft/1803044/p-1444447329607-c-1539779646023.htm',
    imageUrl: 'https://cdn.menardc.com/main/items/media/WOODE004/ProductMedium/1803044_Master_030922.jpg',
  },

  // ── Sod & Seed (customer-visible) ──────────────────────────────────────
  {
    name: 'Pennington Smart Seed Sun & Shade Mix 7 lb',
    category: 'Sod & Seed',
    unit: 'each',
    unitCost: 35,
    description: 'Drought-tolerant turf-type tall fescue + Kentucky bluegrass blend. Good for mixed light conditions.',
    supplierUrl: 'https://www.menards.com/main/outdoors/gardening/lawn-plant-care/grass-seed/pennington-reg-smart-seed-reg-sun-shade-mix-grass-seed/100543719/p-105478916989-c-1463608034796.htm',
    imageUrl: 'https://cdn.menardc.com/main/items/media/CENTR102/ProductMedium/2660904_FV.jpg',
  },

  // ── Fire Pits (customer-visible) ───────────────────────────────────────
  {
    name: '36 in. Lakewood Fire Pit Project',
    category: 'Fire Pits',
    unit: 'each',
    unitCost: 320,
    description: '36" round fire pit project — pre-cut wall blocks, stack-and-go install. Menards Project Material List adds all components at checkout.',
    supplierUrl: 'https://www.menards.com/main/outdoors/fire-pits-outdoor-heating/36-lakewood-fire-pit-project-material-list/1989004/p-1535524296679.htm',
    imageUrl: 'https://cdn.menardc.com/main/items/media/99998/ProductMedium/198-9004_P_ALT.jpg',
  },

  // ── Other / accessories (internal-only) ────────────────────────────────
  {
    name: 'Polar Plastics 4 ft x 50 ft Black Mulch Landscape Fabric',
    category: 'Other',
    unit: 'each',
    unitCost: 23,
    description: 'Non-woven landscape fabric — substrate under mulch and rock beds. Menards house-brand (Tundra/Vigoro equivalent).',
    isCustomerVisible: false,
    supplierUrl: 'https://www.menards.com/main/building-materials/landscaping-materials/landscaping-fabric/polar-plastics-4-x-50-black-mulch-landscape-fabric/2689199/p-1444451029084-c-13236.htm',
    imageUrl: 'https://cdn.menardc.com/main/items/media/POLAR002/ProductMedium/2689199-A2.jpg',
  },
  {
    name: 'Master Mark 10 in. Edging Stakes (10-pk)',
    category: 'Other',
    unit: 'each',
    unitCost: 8,
    description: 'Plastic stakes for fastening landscape edging to ground.',
    isCustomerVisible: false,
    supplierUrl: 'https://www.menards.com/main/building-materials/landscaping-materials/lawn-edging-tree-rings/master-mark-plastics-reg-10-black-terrace-board-landscape-edging-stakes-10-pack/99410/p-1498545510842-c-13237.htm',
    imageUrl: 'https://cdn.menardc.com/main/items/media/MASTE004/ProductMedium/99410BlackTBStakesSide.jpg',
  },
  {
    name: 'Loctite PL 500 Landscape Block Adhesive 28 oz',
    category: 'Other',
    unit: 'each',
    unitCost: 12,
    description: 'Construction adhesive for top course of retaining walls and fire pits. Industry-standard (Anchor brand equivalent).',
    isCustomerVisible: false,
    supplierUrl: 'https://www.menards.com/main/paint/adhesives-glue-tape/adhesive/construction-adhesives/loctite-reg-pl-reg-500-landscape-block-adhesive/1602122/p-1444432345419-c-7921.htm',
    imageUrl: 'https://cdn.menardc.com/main/items/media/HENKE004/ProductMedium/5202015_pl500_28oz_CMYK.jpg',
  },
];

export const MENARDS_STARTER_CATALOG_COUNT = MENARDS_STARTER_CATALOG.length;
