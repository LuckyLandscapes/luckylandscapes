// Menards Lincoln-area starter catalog. Hand-curated — Menards bot-blocks
// scraping (Akamai), and pricing varies by ZIP. These are the items Lucky
// most often buys from the South Lincoln store (#3094) when OS doesn't
// have it or the price is materially better.
//
// Prices are 2026-05 typical retail and approximate. After import, the
// salesperson should verify and edit in the catalog form. Supplier URLs
// point to search results (not product pages) since Menards doesn't have
// stable JSON-LD on product pages — the live "Refresh prices" button
// won't work on these, but the chip in the detail panel still deep-links
// for manual lookup.
//
// Customer-visibility flag follows Riley's rule: "the customer doesn't
// need to see glues, base layers — just the stuff on top, rocks bricks
// mulch etc." So fabric, adhesive, base sand, polymeric joint sand, and
// stakes are flagged internal-only.

const MENARDS_STORE = 'store=3094';  // South Lincoln
const search = (q) => `https://www.menards.com/main/search.html?search=${encodeURIComponent(q)}&${MENARDS_STORE}`;

export const MENARDS_STARTER_CATALOG = [
  // ── Pavers (customer-visible) ──────────────────────────────────────────
  {
    name: 'Pavestone Holland Paver',
    category: 'Pavers',
    unit: 'sqft',
    unitCost: 3.50,
    description: 'Standard tumbled-edge concrete paver in charcoal/red blends.',
    supplierUrl: search('Pavestone Holland paver'),
  },
  {
    name: 'Pavestone Manchester Patio Stone',
    category: 'Pavers',
    unit: 'each',
    unitCost: 4.50,
    description: '12" square patio stone — common for stepping pads and small patios.',
    supplierUrl: search('Pavestone Manchester patio stone'),
  },
  {
    name: 'Borgert Stone Step',
    category: 'Pavers',
    unit: 'each',
    unitCost: 60,
    description: 'Cast-stone step block, 6" rise, multiple lengths.',
    supplierUrl: search('Borgert step'),
  },

  // ── Retaining Wall (customer-visible) ──────────────────────────────────
  {
    name: 'Pavestone Anchor Diamond Pro Block',
    category: 'Retaining Wall',
    unit: 'each',
    unitCost: 5,
    description: 'Standard retaining wall block, 12"×8"×4". Buy in pallet quantities for projects >50 sqft.',
    supplierUrl: search('anchor diamond pro block'),
  },
  {
    name: 'Pavestone Manchester Wall Block',
    category: 'Retaining Wall',
    unit: 'each',
    unitCost: 4,
    description: 'Lower-profile wall block for short walls and tree rings.',
    supplierUrl: search('Manchester wall block'),
  },

  // ── Edging (customer-visible) ──────────────────────────────────────────
  {
    name: 'Vigoro 4 ft Steel Edging Section',
    category: 'Edging',
    unit: 'each',
    unitCost: 15,
    description: 'Heavy-duty steel landscape edging strip with stakes — use for clean curves.',
    supplierUrl: search('steel landscape edging'),
  },
  {
    name: 'Suncast Plastic Edging Coil 60 ft',
    category: 'Edging',
    unit: 'each',
    unitCost: 27,
    description: 'Flexible plastic landscape edging — economy option for bed lines.',
    supplierUrl: search('Suncast plastic landscape edging'),
  },

  // ── Sand & Gravel (mostly internal — base/joint material) ──────────────
  {
    name: 'Quikrete Paver Sand 0.5 cu ft',
    category: 'Sand & Gravel',
    unit: 'bag',
    unitCost: 6,
    description: 'Bagged paver base sand. Substrate beneath pavers.',
    isCustomerVisible: false,
    supplierUrl: search('Quikrete paver sand'),
  },
  {
    name: 'Sakrete All-Purpose Sand 50 lb',
    category: 'Sand & Gravel',
    unit: 'bag',
    unitCost: 6,
    description: 'General-purpose bagged sand for joints and small fills.',
    isCustomerVisible: false,
    supplierUrl: search('Sakrete all-purpose sand'),
  },
  {
    name: 'Sakrete Polymeric Sand 50 lb',
    category: 'Sand & Gravel',
    unit: 'bag',
    unitCost: 35,
    description: 'Polymeric joint sand — sets hard between pavers, prevents weeds.',
    isCustomerVisible: false,
    supplierUrl: search('polymeric sand'),
  },

  // ── Soil & Amendments (customer-visible) ───────────────────────────────
  {
    name: 'Premium Topsoil 0.75 cu ft Bag',
    category: 'Soil & Amendments',
    unit: 'bag',
    unitCost: 4,
    description: 'Bagged topsoil — small fill jobs.',
    supplierUrl: search('premium topsoil bag'),
  },

  // ── Mulch (customer-visible) ───────────────────────────────────────────
  {
    name: 'Vigoro Hardwood Mulch 2 cu ft Bag',
    category: 'Mulch',
    unit: 'bag',
    unitCost: 5,
    description: 'Bagged hardwood mulch — economy alternative to bulk for small beds.',
    supplierUrl: search('hardwood mulch bag'),
  },

  // ── Sod & Seed (customer-visible) ──────────────────────────────────────
  {
    name: 'Pennington Smart Seed 7 lb',
    category: 'Sod & Seed',
    unit: 'each',
    unitCost: 35,
    description: 'Pennington Smart Seed — drought-tolerant turf-type tall fescue blend.',
    supplierUrl: search('Pennington Smart Seed'),
  },

  // ── Fire Pits (customer-visible) ───────────────────────────────────────
  {
    name: 'Anchor 4-Piece Fire Pit Kit',
    category: 'Fire Pits',
    unit: 'each',
    unitCost: 320,
    description: '4-piece pre-cut wall block kit for a 36" round fire pit. Stack-and-go install.',
    supplierUrl: search('anchor fire pit kit'),
  },

  // ── Other / accessories (internal-only) ────────────────────────────────
  {
    name: 'Tundra 4 ft x 50 ft Landscape Fabric',
    category: 'Other',
    unit: 'each',
    unitCost: 23,
    description: 'Woven landscape fabric — substrate under mulch and rock beds.',
    isCustomerVisible: false,
    supplierUrl: search('landscape fabric 4x50'),
  },
  {
    name: 'Master Mark Plastic Edging Stakes (10-pk)',
    category: 'Other',
    unit: 'each',
    unitCost: 8,
    description: 'Plastic stakes for fastening edging to ground.',
    isCustomerVisible: false,
    supplierUrl: search('plastic edging stakes'),
  },
  {
    name: 'Anchor Wall Block Adhesive 28 oz',
    category: 'Other',
    unit: 'each',
    unitCost: 12,
    description: 'Construction adhesive for top course of retaining walls and fire pits.',
    isCustomerVisible: false,
    supplierUrl: search('wall block adhesive'),
  },
];

export const MENARDS_STARTER_CATALOG_COUNT = MENARDS_STARTER_CATALOG.length;
