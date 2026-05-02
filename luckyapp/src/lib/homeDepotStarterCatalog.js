// Home Depot starter catalog. Hand-curated, with product URLs and CDN
// images researched via WebSearch + WebFetch. Home Depot uses PerimeterX
// bot detection, so the live "Refresh prices" button won't reach these —
// but the supplier-link chip in the catalog detail panel deep-links
// straight to the product page for manual lookup.
//
// Product names match HD's actual listings. Where a brand isn't stocked
// (e.g. Master Mark steel edging is Vigoro at HD), the closest in-stock
// substitute is used — descriptions flag the brand swap.
//
// Prices are 2026-05 typical retail in Lincoln, NE (HD South store
// #3204), approximate. Verify before quoting.
//
// Customer-visibility: substrate sand, polymeric joint sand, fabric, and
// adhesive are flagged internal-only.

export const HOME_DEPOT_STARTER_CATALOG = [
  // ── Pavers (customer-visible) ──────────────────────────────────────────
  {
    name: 'Pavestone Holland 4 in. x 8 in. Paver — Georgia Blend',
    category: 'Pavers',
    unit: 'each',
    unitCost: 0.60,
    description: 'Tumbled-edge concrete paver, 60mm thick, sold per piece. 480 pieces / 103 sqft per pallet. Common for residential walkways and small patios.',
    color: 'Georgia Brown',
    supplierUrl: 'https://www.homedepot.com/p/Pavestone-Holland-7-87-in-L-x-3-94-in-W-x-2-36-in-H-60-mm-Georgia-Blend-Concrete-Paver-480-Pieces-103-sq-ft-Pallet-21736/310128151',
    imageUrl: 'https://images.thdstatic.com/productImages/831a1872-d470-4f91-aef6-109614b8eade/svn/georgia-brown-pavestone-concrete-pavers-21736-0-64_1000.jpg',
  },
  {
    name: 'Pavestone RumbleStone Square Patio Stone 7 in. x 7 in.',
    category: 'Pavers',
    unit: 'each',
    unitCost: 5,
    description: 'Tumbled-finish patio stone, Greystone color — natural look for stepping pads and small pads. 288 pieces / 98 sqft per pallet.',
    color: 'Greystone',
    supplierUrl: 'https://www.homedepot.com/p/Pavestone-RumbleStone-Square-7-in-x-7-in-x-1-75-in-Greystone-Concrete-Paver-288-Pcs-98-Sq-ft-Pallet-91134/203647917',
    imageUrl: 'https://images.thdstatic.com/productImages/111dcd8c-80ee-4ea1-a128-14af88f08a17/svn/greystone-pavestone-concrete-pavers-91134-64_100.jpg',
  },

  // ── Retaining Wall (customer-visible) ──────────────────────────────────
  {
    name: 'Pavestone RumbleStone Garden Wall Block 3.5 in. x 10.5 in. x 7 in.',
    category: 'Retaining Wall',
    unit: 'each',
    unitCost: 5,
    description: 'Tumbled retaining wall block — mortarless install with adhesive on top course.',
    color: 'Greystone',
    supplierUrl: 'https://www.homedepot.com/p/Pavestone-RumbleStone-Large-3-5-in-x-10-5-in-x-7-in-Greystone-Concrete-Garden-Wall-Block-91934/203158380',
    imageUrl: 'https://images.thdstatic.com/productImages/8d3e4577-59c1-4b24-9beb-e4123846de22/svn/greystone-pavestone-garden-wall-blocks-91934-64_100.jpg',
  },

  // ── Edging (customer-visible) ──────────────────────────────────────────
  {
    name: 'Vigoro 4 ft Black Metal Landscape Edging w/ Stakes',
    category: 'Edging',
    unit: 'each',
    unitCost: 15,
    description: 'Heavy-duty 4 ft black metal landscape edging — pin-anchored, clean lines. (HD stocks Vigoro for steel-look edging; Master Mark is plastic-only at HD.)',
    color: 'Black',
    supplierUrl: 'https://www.homedepot.com/p/Vigoro-4-ft-L-Black-Metal-Landscape-Edging-with-4-Stakes-867342/322685791',
    imageUrl: 'https://images.thdstatic.com/productImages/1dac2b50-a9c1-4c66-903e-02dae7aef31f/svn/black-vigoro-metal-edging-867342-fa_600.jpg',
  },
  {
    name: 'Suncast Pro 60 ft Plastic Coiled Edging',
    category: 'Edging',
    unit: 'each',
    unitCost: 30,
    description: 'Flexible 60 ft commercial plastic edging coil — economy for curving bed lines.',
    color: 'Black',
    supplierUrl: 'https://www.homedepot.com/p/Suncast-Pro-60-ft-Black-Plastic-Coiled-Edging-CPLPRO6000/203681857',
    imageUrl: 'https://images.thdstatic.com/productImages/9f9c70e8-0f1a-4221-9ec5-e1eba098f6db/svn/blacks-suncast-plastic-edging-cplpro6000-64_1000.jpg',
  },

  // ── Soil & Amendments (customer-visible) ───────────────────────────────
  {
    name: 'Scotts Premium Topsoil 0.75 cu ft',
    category: 'Soil & Amendments',
    unit: 'bag',
    unitCost: 4,
    description: 'Bagged premium topsoil with peat moss — small fill jobs and turf prep.',
    supplierUrl: 'https://www.homedepot.com/p/Scotts-Premium-Topsoil-0-75-cu-ft-Lawn-and-Garden-Top-Soil-Soil-Conditioner-with-Peat-Moss-71130756/100619053',
    imageUrl: 'https://images.thdstatic.com/productImages/4b67512d-791d-4b7e-801a-9d4ebee910b2/svn/scotts-topsoil-71130756-e4_600.jpg',
  },
  {
    name: 'Miracle-Gro All Purpose Garden Soil 1.5 cu ft',
    category: 'Soil & Amendments',
    unit: 'bag',
    unitCost: 7,
    description: 'Bagged garden soil — flowerbed planting, raised beds, shrub install.',
    supplierUrl: 'https://www.homedepot.com/p/Miracle-Gro-Garden-Soil-All-Purpose-1-5-cu-ft-for-In-Ground-Use-Gardens-and-Raised-Beds-Flowers-Vegetables-Trees-Shrubs-70359500/314619265',
    imageUrl: 'https://images.thdstatic.com/productImages/77a5ad4d-be26-4522-bd40-04de5186a40a/svn/miracle-gro-garden-soil-70359500-64_100.jpg',
  },

  // ── Mulch (customer-visible) ───────────────────────────────────────────
  {
    name: 'Vigoro Premium Brown Wood Mulch 2 cu ft Bag',
    category: 'Mulch',
    unit: 'bag',
    unitCost: 5,
    description: 'Bagged premium brown shredded hardwood mulch — convenience for tight-access projects.',
    color: 'Brown',
    supplierUrl: 'https://www.homedepot.com/p/Vigoro-Vigoro-2-cu-ft-Premium-Brown-Wood-Shredded-Bagged-Mulch-52050196/205606287',
    imageUrl: 'https://images.thdstatic.com/productImages/b5f89d3c-a78c-4041-96b0-1a366e9a4bbb/svn/vigoro-wood-mulch-52050196-64_1000.jpg',
  },
  {
    name: 'Vigoro Premium Black Wood Mulch 2 cu ft Bag',
    category: 'Mulch',
    unit: 'bag',
    unitCost: 5,
    description: 'Dyed black bagged shredded hardwood mulch — alternative to OS bulk for small beds.',
    color: 'Black',
    supplierUrl: 'https://www.homedepot.com/p/Vigoro-Vigoro-2-cu-ft-Premium-Black-Wood-Shredded-Bagged-Mulch-52050197/205606445',
    imageUrl: 'https://images.thdstatic.com/productImages/339af72a-e6ea-456b-820e-9197146d8017/svn/vigoro-wood-mulch-52050197-64_1000.jpg',
  },

  // ── Sod & Seed (customer-visible) ──────────────────────────────────────
  {
    name: 'Scotts Turf Builder Lawn Soil 1.5 cu ft',
    category: 'Sod & Seed',
    unit: 'bag',
    unitCost: 8,
    description: 'Pre-mixed soil + amendments for new seeding projects or top-dressing existing turf.',
    supplierUrl: 'https://www.homedepot.com/p/Scotts-Turf-Builder-Lawn-Soil-1-5-cu-ft-For-Lawn-Repair-or-Overseeding-Use-to-Plant-New-Grass-or-Top-Dress-Soil-79559750/202714346',
    imageUrl: 'https://images.thdstatic.com/productImages/97d3e879-a09e-46c3-a933-b3e9bf536b5d/svn/scotts-topsoil-79559750-64_1000.jpg',
  },
  {
    name: 'Pennington Kentucky 31 Tall Fescue Seed 20 lb',
    category: 'Sod & Seed',
    unit: 'each',
    unitCost: 50,
    description: 'Standard tough turf-type fescue — durable for Nebraska climate. Covers ~4,000 sqft. (HD stocks 20 lb as the primary size; 25 lb available occasionally.)',
    supplierUrl: 'https://www.homedepot.com/p/Pennington-Kentucky-31-Tall-Fescue-20-lb-4-000-sq-ft-Grass-Seed-100543701/314933308',
    imageUrl: 'https://images.thdstatic.com/productImages/f81d36a8-2387-4135-ae78-45071365b332/svn/pennington-grass-seed-100543701-64_1000.jpg',
  },
  {
    name: 'Scotts Turf Builder Starter Fertilizer 15 lb',
    category: 'Sod & Seed',
    unit: 'bag',
    unitCost: 25,
    description: 'New-lawn starter fertilizer — applied with new seed or sod install. Covers ~5,000 sqft.',
    supplierUrl: 'https://www.homedepot.com/p/Scotts-Turf-Builder-15-lbs-5-000-sq-ft-Starter-Dry-Lawn-Fertilizer-for-New-Grass-Use-When-Planting-Seed-21605/203187342',
    imageUrl: 'https://images.thdstatic.com/productImages/f2f23b95-2680-4886-8754-dc349b51c5cd/svn/scotts-lawn-fertilizers-21605-c3_600.jpg',
  },

  // ── Fire Pits (customer-visible) ───────────────────────────────────────
  {
    name: 'Hampton Bay Windgate 40 in. Steel Wood-Burning Fire Pit',
    category: 'Fire Pits',
    unit: 'each',
    unitCost: 250,
    description: 'Round steel wood-burning fire pit, 40" diameter, with spark guard. Drop-in unit for built or freestanding installs.',
    color: 'Black',
    supplierUrl: 'https://www.homedepot.com/p/Hampton-Bay-Windgate-40-in-Dia-Round-Steel-Wood-Burning-Fire-Pit-with-Spark-Guard-A301002900/308680536',
    imageUrl: 'https://images.thdstatic.com/productImages/680f1906-5f7b-46c6-a6f6-d5a6ad7c42e2/svn/black-hampton-bay-wood-burning-fire-pits-a301002900-64_1000.jpg',
  },

  // ── Sand & Gravel (internal — substrate / joint) ───────────────────────
  {
    name: 'Sakrete Paver Leveling Sand 0.5 cu ft',
    category: 'Sand & Gravel',
    unit: 'bag',
    unitCost: 6,
    description: 'Bagged paver leveling/base sand. Substrate.',
    isCustomerVisible: false,
    supplierUrl: 'https://www.homedepot.com/p/SAKRETE-0-5-cu-ft-Paver-Leveling-Sand-100061838/204679512',
    imageUrl: 'https://images.thdstatic.com/productImages/8a5240af-8be5-45f2-8ae6-1b72a92cd1ff/svn/sakrete-landscape-accessories-100061838-64_100.jpg',
  },
  {
    name: 'Sakrete PermaSand Polymeric Joint Sand 40 lb',
    category: 'Sand & Gravel',
    unit: 'bag',
    unitCost: 30,
    description: 'Polymeric joint sand — locks pavers, blocks weeds. (HD stocks 40 lb PermaSand; 50 lb is OS/Menards.)',
    isCustomerVisible: false,
    supplierUrl: 'https://www.homedepot.com/p/SAKRETE-PermaSand-40-lb-Paver-Joint-Sand-65470004/202070568',
    imageUrl: 'https://images.thdstatic.com/productImages/735c195d-f3c7-4cfa-b550-85c34427e3cf/svn/tan-sakrete-landscape-accessories-65470077-64_600.jpg',
  },

  // ── Other / accessories (internal-only) ────────────────────────────────
  {
    name: 'Vigoro WeedBlock 3 ft x 50 ft Landscape Fabric',
    category: 'Other',
    unit: 'each',
    unitCost: 18,
    description: 'Non-woven WeedBlock landscape fabric with microfunnels — substrate under mulch/rock beds.',
    isCustomerVisible: false,
    supplierUrl: 'https://www.homedepot.com/p/Vigoro-3-ft-x-50-ft-WeedBlock-Weed-Barrier-Landscape-Fabric-with-Microfunnels-FL03050MF/320189910',
    imageUrl: 'https://images.thdstatic.com/productImages/045ccfb8-f66f-44d3-bd61-2b25478d7ef7/svn/vigoro-landscape-fabric-fl03050mf-fa_600.jpg',
  },
  {
    name: 'Loctite PL 500 Landscape Block Adhesive 28 oz',
    category: 'Other',
    unit: 'each',
    unitCost: 12,
    description: 'Construction adhesive for capping retaining walls and fire pits. Industry-standard (Anchor brand equivalent).',
    isCustomerVisible: false,
    supplierUrl: 'https://www.homedepot.com/p/Loctite-PL-500-Landscape-Block-28-oz-Solvent-Construction-Adhesive-Tan-Cartridge-each-1602122/203265338',
    imageUrl: 'https://images.thdstatic.com/productImages/1869962a-2193-4a06-ad7c-362290c3b411/svn/loctite-specialty-construction-adhesive-1602122-64_600.jpg',
  },
];

export const HOME_DEPOT_STARTER_CATALOG_COUNT = HOME_DEPOT_STARTER_CATALOG.length;
