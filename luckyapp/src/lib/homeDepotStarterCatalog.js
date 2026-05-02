// Home Depot Lincoln-area starter catalog. Hand-curated — Home Depot
// bot-blocks scraping (PerimeterX), and pricing varies by ZIP. These are
// items Lucky uses HD as the supplier for: bagged retail goods (sod,
// seed, mulch bags, fertilizer), specific brands not at OS/Menards, and
// occasional hardscape backups.
//
// Prices are 2026-05 typical retail in Lincoln (HD South store #3204).
// Supplier URLs point to product pages where I have a stable URL, search
// otherwise — the live "Refresh prices" button is unreliable for HD.
//
// Customer-visibility follows the same rule as Menards: substrate sand,
// fabric, and adhesive are flagged internal-only.

const HD_STORE = 'storeId=3204';  // South Lincoln
const search = (q) => `https://www.homedepot.com/s/${encodeURIComponent(q)}?${HD_STORE}`;

export const HOME_DEPOT_STARTER_CATALOG = [
  // ── Pavers (customer-visible) ──────────────────────────────────────────
  {
    name: 'Pavestone Holland 4 in. x 8 in. Paver',
    category: 'Pavers',
    unit: 'each',
    unitCost: 0.60,
    description: 'Tumbled-edge concrete paver. Common for residential walkways and small patios.',
    supplierUrl: search('Pavestone Holland paver'),
  },
  {
    name: 'Pavestone RumbleStone Patio Stone',
    category: 'Pavers',
    unit: 'each',
    unitCost: 5,
    description: 'Tumbled finish patio stone — natural look for stepping pads.',
    supplierUrl: search('RumbleStone patio'),
  },

  // ── Retaining Wall (customer-visible) ──────────────────────────────────
  {
    name: 'Pavestone RumbleStone Wall Block',
    category: 'Retaining Wall',
    unit: 'each',
    unitCost: 5,
    description: 'Tumbled retaining wall block. Mortarless install with adhesive on top course.',
    supplierUrl: search('RumbleStone wall block'),
  },

  // ── Edging (customer-visible) ──────────────────────────────────────────
  {
    name: 'Master Mark 4 ft Steel Edging Section',
    category: 'Edging',
    unit: 'each',
    unitCost: 15,
    description: 'Heavy-duty steel landscape edging — pin-anchored, clean lines.',
    supplierUrl: search('steel landscape edging 4ft'),
  },
  {
    name: 'Suncast Plastic Edging Coil 60 ft',
    category: 'Edging',
    unit: 'each',
    unitCost: 30,
    description: 'Flexible plastic edging coil — economy for curving bed lines.',
    supplierUrl: search('Suncast landscape edging coil'),
  },

  // ── Soil & Amendments (customer-visible) ───────────────────────────────
  {
    name: 'Scotts Premium Topsoil 0.75 cu ft',
    category: 'Soil & Amendments',
    unit: 'bag',
    unitCost: 4,
    description: 'Bagged premium topsoil — small fill jobs and turf prep.',
    supplierUrl: search('Scotts premium topsoil'),
  },
  {
    name: 'Miracle-Gro Garden Soil 1.5 cu ft',
    category: 'Soil & Amendments',
    unit: 'bag',
    unitCost: 7,
    description: 'Bagged garden soil — flowerbed planting and amendment.',
    supplierUrl: search('Miracle-Gro garden soil'),
  },

  // ── Mulch (customer-visible) ───────────────────────────────────────────
  {
    name: 'Vigoro Hardwood Mulch 2 cu ft Bag',
    category: 'Mulch',
    unit: 'bag',
    unitCost: 5,
    description: 'Bagged hardwood mulch — convenience for tight-access projects.',
    supplierUrl: search('hardwood mulch bag'),
  },
  {
    name: 'Black Shredded Hardwood Mulch 2 cu ft',
    category: 'Mulch',
    unit: 'bag',
    color: 'Black',
    unitCost: 5,
    description: 'Dyed black bagged mulch — alternative to OS bulk for small beds.',
    supplierUrl: search('black mulch 2 cu ft'),
  },

  // ── Sod & Seed (customer-visible) ──────────────────────────────────────
  {
    name: 'Scotts Turf Builder Lawn Soil 1.5 cu ft',
    category: 'Sod & Seed',
    unit: 'bag',
    unitCost: 8,
    description: 'Pre-mixed soil + amendments for new seeding projects.',
    supplierUrl: search('Scotts Turf Builder lawn soil'),
  },
  {
    name: 'Pennington Kentucky 31 Tall Fescue Seed 25 lb',
    category: 'Sod & Seed',
    unit: 'each',
    unitCost: 60,
    description: 'Standard tough turf-type fescue — durable for Nebraska climate.',
    supplierUrl: search('Kentucky 31 fescue seed 25 lb'),
  },
  {
    name: 'Scotts Lawn Starter Fertilizer 15 lb',
    category: 'Sod & Seed',
    unit: 'bag',
    unitCost: 25,
    description: 'New-lawn starter fertilizer — applied with new seed or sod install.',
    supplierUrl: search('Scotts starter fertilizer'),
  },

  // ── Fire Pits (customer-visible) ───────────────────────────────────────
  {
    name: 'Hampton Bay Carrolton 40 in Fire Pit',
    category: 'Fire Pits',
    unit: 'each',
    unitCost: 250,
    description: 'Wood-burning steel fire pit — drop-in unit for built or freestanding installs.',
    supplierUrl: search('Hampton Bay Carrolton fire pit'),
  },

  // ── Sand & Gravel (internal — substrate / joint) ───────────────────────
  {
    name: 'Quikrete Paver Sand 0.5 cu ft',
    category: 'Sand & Gravel',
    unit: 'bag',
    unitCost: 6,
    description: 'Bagged paver base sand. Substrate.',
    isCustomerVisible: false,
    supplierUrl: search('Quikrete paver sand'),
  },
  {
    name: 'Sakrete Polymeric Sand 50 lb',
    category: 'Sand & Gravel',
    unit: 'bag',
    unitCost: 35,
    description: 'Polymeric joint sand — locks pavers, blocks weeds.',
    isCustomerVisible: false,
    supplierUrl: search('polymeric sand 50 lb'),
  },

  // ── Other / accessories (internal-only) ────────────────────────────────
  {
    name: 'Vigoro 3 ft x 50 ft Landscape Fabric',
    category: 'Other',
    unit: 'each',
    unitCost: 18,
    description: 'Woven landscape fabric — substrate under mulch/rock beds.',
    isCustomerVisible: false,
    supplierUrl: search('landscape fabric 3x50'),
  },
  {
    name: 'Anchor Wall Block Adhesive 28 oz',
    category: 'Other',
    unit: 'each',
    unitCost: 12,
    description: 'Construction adhesive for capping retaining walls and fire pits.',
    isCustomerVisible: false,
    supplierUrl: search('wall block adhesive'),
  },
];

export const HOME_DEPOT_STARTER_CATALOG_COUNT = HOME_DEPOT_STARTER_CATALOG.length;
