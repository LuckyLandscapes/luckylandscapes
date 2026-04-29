// Lucky Landscapes supplier catalog & pricing.
// Pricing reference: outdoorsolutions-lincoln.com/price-list (the OS prices
// also serve as the baseline for the same SKUs at Menards / Home Depot — the
// user adjusts via the Edit modal once they price-shop locally).
//
// Supplier mapping per the user's policy:
//   - Mulch & Rock                       → Outdoor Solutions
//   - Hardscape & block (edging, walls,
//     drystack, pavers, steps, masonry,
//     bulk gravel, natural stone)         → Menards
//   - Bagged goods / retail (soil, sod,
//     seed, fabric, fire pits, water
//     features, accessories, treatments)  → Home Depot

// Compact constructors per supplier so each item declares one explicitly.
const make = (supplier) => (name, category, unit, low, high = low, extras = {}) => ({
  name, category, unit, supplier,
  costLow: low, costHigh: high, ...extras,
});
const os = make('Outdoor Solutions');
const mn = make('Menards');
const hd = make('Home Depot');

// Back-compat alias so old imports (`m`) keep working — defaults to OS.
const m = os;

export const OUTDOOR_SOLUTIONS_CATALOG = [
  // ── Mulches (cu yd) ─────────────────────────────────────────
  os('Aromatic Cedar Mulch',     'Mulch', 'cu yd', 55,  55, { description: 'Premium aromatic cedar mulch.' }),
  os('Black Mulch',              'Mulch', 'cu yd', 45,  45, { color: 'Black', description: 'Dyed black landscape mulch.' }),
  os('Brown Mulch',              'Mulch', 'cu yd', 45,  45, { color: 'Brown', description: 'Dyed brown landscape mulch.' }),
  os('Coffee Mulch',             'Mulch', 'cu yd', 45,  45, { color: 'Coffee', description: 'Dyed coffee-tone mulch.' }),
  os('Dark Hardwood Mulch',      'Mulch', 'cu yd', 37,  37, { description: 'Natural dark hardwood mulch.' }),
  os('Nursery Mulch',            'Mulch', 'cu yd', 28,  28, { description: 'Economy nursery-grade mulch.' }),

  // ── Topsoils (cu yd) ────────────────────────────────────────
  os('Black Dirt',               'Soil & Amendments', 'cu yd', 20, 20),
  os('Garden Mix',                'Soil & Amendments', 'cu yd', 62, 62, { description: 'Premium garden planting mix.' }),
  os('Processed Black Dirt',      'Soil & Amendments', 'cu yd', 32, 32),
  os('Pulverized Topsoil',        'Soil & Amendments', 'cu yd', 44, 44),

  // ── Construction Materials (ton) ────────────────────────────
  os('1.5″ Screened Limestone',  'Sand & Gravel', 'ton', 68, 68),
  os('1″ Screened Limestone',    'Sand & Gravel', 'ton', 68, 68),
  os('3/8″ Limestone Chips',     'Sand & Gravel', 'ton', 82, 82),
  os('47B',                      'Sand & Gravel', 'ton', 46, 46, { description: 'Crushed road base.' }),
  os('Limestone Screenings',     'Sand & Gravel', 'ton', 46, 46),
  os('Washed Sand',              'Sand & Gravel', 'ton', 42, 42),

  // ── Landscape Rock (ton) ────────────────────────────────────
  os('Black Granite Chips',      'Rock', 'ton', 204, 204, { color: 'Black' }),
  os('Black Lava Rock',          'Rock', 'ton', 300, 300, { color: 'Black', notes: 'Also sold per bag at $10.' }),
  os('Black Obsidian',           'Rock', 'ton', 198, 198, { color: 'Black' }),
  os('Cedar Creek 2″',           'Rock', 'ton', 120, 120),
  os('Cherokee Red Large',       'Rock', 'ton', 198, 198, { color: 'Red' }),
  os('Cherokee Red Small',       'Rock', 'ton', 198, 198, { color: 'Red' }),
  os('Dakota Cobble 1.5″x3″',    'Rock', 'ton', 175, 175),
  os('Indian Sunset',            'Rock', 'ton', 198, 198),
  os('Mesa Grey 1-2″',           'Rock', 'ton', 215, 215, { color: 'Grey' }),
  os('Mexican Beach Pebbles',    'Rock', 'ton', 660, 660, { description: 'Premium smooth black beach pebbles.' }),
  os('Midnight Chips',           'Rock', 'ton', 198, 198, { color: 'Black' }),
  os('Mountain Granite',         'Rock', 'ton', 180, 180),
  os('Oak Creek 1″ x 2″',        'Rock', 'ton', 168, 168),
  os('Osage Buff',               'Rock', 'ton', 160, 160, { color: 'Buff' }),
  os('Ozark Brown 1″',           'Rock', 'ton', 162, 162, { color: 'Brown' }),
  os('Ozark Brown 2″',           'Rock', 'ton', 180, 180, { color: 'Brown' }),
  os('Ozark River Chips',        'Rock', 'ton', 148, 148),
  os('Pawnee Red',               'Rock', 'ton', 0,   0,   { color: 'Red', soldOut: true }),
  os('Rainbow Rock',             'Rock', 'ton', 0,   0,   { soldOut: true }),
  os('River Cobbles',            'Rock', 'ton', 118, 118),
  os('River Pebbles',            'Rock', 'ton', 84,  84),
  os('River Rock',               'Rock', 'ton', 110, 110),
  os('Shawnee Creek 1″',         'Rock', 'ton', 162, 162),
  os('Slate Chips',              'Rock', 'ton', 400, 400),
  os('Western Sunset',           'Rock', 'ton', 198, 198),
  os('White Marble',             'Rock', 'ton', 400, 400, { color: 'White' }),

  // ── Cobblestone & Mini Boulders (ton) ───────────────────────
  os('Black Obsidian Minis',     'Boulders', 'ton', 390, 390, { color: 'Black' }),
  os('Chip Creek Cobble',        'Boulders', 'ton', 280, 280),
  os('Colorado Moss Mini',       'Boulders', 'ton', 460, 460),
  os('Colorado River Flats',     'Boulders', 'ton', 480, 480),
  os('Dakota Cobble 3″-6″',      'Boulders', 'ton', 214, 214),
  os('Gage Valley Cobble',       'Boulders', 'ton', 144, 144),
  os('Glacier Granite 8″-18″',   'Boulders', 'ton', 198, 198),
  os('Glacier Granite Cobble 2″-4″', 'Boulders', 'ton', 160, 160),
  os('Indian Sunset Minis',      'Boulders', 'ton', 390, 390),
  os('Mesa Gray Cobble',         'Boulders', 'ton', 240, 240, { color: 'Grey' }),
  os('Oak Creek 2″-4″',          'Boulders', 'ton', 178, 178),
  os('Oak Creek 4″-8″',          'Boulders', 'ton', 178, 178),
  os('Western Sunset Minis',     'Boulders', 'ton', 460, 460),
  os('Whiskey Creek Minis',      'Boulders', 'ton', 390, 390),
  os('White Quartzite Minis',    'Boulders', 'ton', 390, 390, { color: 'White' }),

  // ── Boulders (ton) ──────────────────────────────────────────
  os('Alpine River Boulders',    'Boulders', 'ton', 300, 300),
  os('Black Granite Boulders',   'Boulders', 'ton', 290, 290, { color: 'Black' }),
  os('Black Obsidian Boulders',  'Boulders', 'ton', 290, 290, { color: 'Black' }),
  os('Cheyenne Boulders',        'Boulders', 'ton', 375, 375),
  os('Glacier Granite Boulders', 'Boulders', 'ton', 224, 224),
  os('Holey Boulders',           'Boulders', 'ton', 352, 352),
  os('Weathered Limestone Boulders', 'Boulders', 'ton', 370, 370),
  os('Whiskey Creek Boulders',   'Boulders', 'ton', 330, 330),
  os('White Quartzite Boulders', 'Boulders', 'ton', 290, 290, { color: 'White' }),

  // ── Basalt Columns (each) ───────────────────────────────────
  os('Basalt Column 18″',        'Boulders', 'each', 260,  260),
  os('Basalt Column 24″',        'Boulders', 'each', 350,  350),
  os('Basalt Column 30″',        'Boulders', 'each', 435,  435),
  os('Basalt Column 36″',        'Boulders', 'each', 525,  525),
  os('Basalt Columns Trio (18″-24″-30″)', 'Boulders', 'each', 975,  975),
  os('Basalt Columns Trio (24″-30″-36″)', 'Boulders', 'each', 1215, 1215),

  // ── Flagstone (ton) ─────────────────────────────────────────
  os('Arizona Buff Flagstone',     'Flagstone', 'ton', 495, 495, { color: 'Buff' }),
  os('Black Hills Flagstone',      'Flagstone', 'ton', 375, 375),
  os('Black Hills Supreme Flagstone', 'Flagstone', 'ton', 590, 590),
  os('Cherry Blend Flagstone',     'Flagstone', 'ton', 480, 480),
  os('Colorado Red Flagstone',     'Flagstone', 'ton', 355, 355, { color: 'Red' }),
  os('Foxglove Flagstone',         'Flagstone', 'ton', 375, 375),
  os('Sandhills Blue Flagstone',   'Flagstone', 'ton', 590, 590, { color: 'Blue' }),
  os('Smoke Quartzite Flagstone',  'Flagstone', 'ton', 580, 580),

  // ── Drystack Walls (ton) ────────────────────────────────────
  os('Big Sky 12″ Saw Cut Drystack',     'Retaining Wall', 'ton', 480, 480),
  os('Big Sky 6″ Saw Cut Drystack',      'Retaining Wall', 'ton', 460, 460),
  os('Black Hills Drystack',             'Retaining Wall', 'ton', 400, 400),
  os('Colorado Moss Drystack',           'Retaining Wall', 'ton', 420, 420),
  os('Copper Mountain 12″ Saw Cut Drystack', 'Retaining Wall', 'ton', 440, 440),
  os('Copper Mountain 6″ Saw Cut Drystack',  'Retaining Wall', 'ton', 370, 370),
  os('Cottonwood Tumbled 5″ Drystack',   'Retaining Wall', 'ton', 470, 470),
  os('Dover Grey 14″ Premium Drystack',  'Retaining Wall', 'ton', 178, 178, { color: 'Grey' }),
  os('Dover Grey 6″ Drystack',           'Retaining Wall', 'ton', 270, 270, { color: 'Grey' }),
  os('Dover Grey Tumbled 5″ Drystack',   'Retaining Wall', 'ton', 470, 470, { color: 'Grey' }),
  os('Foxglove Drystack',                'Retaining Wall', 'ton', 400, 400),
  os('Foxglove Sawn Drystack',           'Retaining Wall', 'ton', 545, 545),
  os('Weathered Fieldstone Drystack',    'Retaining Wall', 'ton', 330, 330),
  os('Whiskey Creek Beam Drystack',      'Retaining Wall', 'ton', 365, 365),
  os('Whiskey Creek Ledgestone Drystack', 'Retaining Wall', 'ton', 365, 365),

  // ── Edging ──────────────────────────────────────────────────
  os('Big Sky Saw Cut Edging',     'Edging', 'ton',  520, 520),
  os('Black Hills Natural Edging', 'Edging', 'ton',  395, 395),
  os('Colorado Red Edging',        'Edging', 'ton',  375, 375, { color: 'Red' }),
  os('Cottonwood Tumbled Edging',  'Edging', 'ton',  595, 595),
  os('EdgePro Prolip',             'Edging', 'each', 20,  20),
  os('EdgePro ProLip 90° corner',  'Edging', 'each', 4,   4),
  os('Foxglove Edging',            'Edging', 'ton',  395, 395),
  os('Steel Edging',               'Edging', 'each', 30,  30),
  os('White Marble Edging',        'Edging', 'ton',  545, 545, { color: 'White' }),
  os('Windsor Saw Cut Edging',     'Edging', 'ton',  470, 470),

  // ── Pavers ──────────────────────────────────────────────────
  os('Belgard Belgian Cobble',           'Pavers', 'sqft', 7.40, 7.40),
  os('Belgard Dimensions 18',            'Pavers', 'sqft', 6.95, 6.95),
  os('Belgard Dimensions Accent',        'Pavers', 'each', 2.60, 2.60),
  os('Belgard Mega Arbel',               'Pavers', 'sqft', 8.40, 8.40),
  os('Belgard Origins 18',               'Pavers', 'sqft', 6.95, 6.95),
  os('Belgard Papyrus',                  'Pavers', 'sqft', 7.60, 7.60),
  os('Rochester Bullnose',               'Pavers', 'each', 5.20, 5.20),
  os('Rochester Colonial Rectangle',     'Pavers', 'each', 3.30, 3.30),
  os('Rochester Contours',               'Pavers', 'sqft', 10.80, 10.80),
  os('Rochester Reno 3 pc',              'Pavers', 'sqft', 5.90, 5.90),
  os('Rochester Silhouette',             'Pavers', 'sqft', 10.00, 10.00),
  os('Rochester Tahoe 3 pc',             'Pavers', 'sqft', 5.90, 5.90),
  os('Rochester Windom',                 'Pavers', 'sqft', 7.05, 7.05),

  // ── Retaining Walls ─────────────────────────────────────────
  os('Anchor 24″ Column Cap',         'Retaining Wall', 'each', 195,  195),
  os('Anchor 30″ Column Cap',         'Retaining Wall', 'each', 240,  240),
  os('Belgard Weston 3pc',            'Retaining Wall', 'sqft', 11.75, 11.75),
  os('Belgard Weston Universal',      'Retaining Wall', 'each', 6.40,  6.40),
  os('Brisa Cap',                     'Retaining Wall', 'each', 8.00,  8.00),
  os('Brisa Column Unit',             'Retaining Wall', 'each', 17.50, 17.50),
  os('Brisa Freestanding Wall',       'Retaining Wall', 'sqft', 21.35, 21.35),
  os('Brisa Retaining Wall',          'Retaining Wall', 'sqft', 17.35, 17.35),
  os('Diamond Block',                 'Retaining Wall', 'each', 8.75,  8.75),
  os('Diamond Cap',                   'Retaining Wall', 'each', 6.70,  6.70),
  os('Diamond Pro',                   'Retaining Wall', 'each', 10.85, 10.85),
  os('Diamond Pro Cap',               'Retaining Wall', 'each', 8.75,  8.75),
  os('Diamond Pro Corners',           'Retaining Wall', 'each', 16.05, 16.05),
  os('Diamond Pro Stone Cut Cap',     'Retaining Wall', 'each', 8.80,  8.80),
  os('Diamond Pro Stone Cut Corners', 'Retaining Wall', 'each', 16.05, 16.05),
  os('Diamond Pro Stone Cut / Virtual Joint', 'Retaining Wall', 'each', 11.60, 11.60),
  os('Highland Freestanding',         'Retaining Wall', 'each', 12.05, 12.05),
  os('Highland Retaining Wall',       'Retaining Wall', 'each', 11.85, 12.20),
  os('Highland XL Cap',               'Retaining Wall', 'each', 9.40,  9.40),
  os('Rochester 25″ Column Cap',      'Retaining Wall', 'each', 180,   180),
  os('Rochester 30″ Column Cap',      'Retaining Wall', 'each', 240,   240),
  os('U Start Base Block',            'Retaining Wall', 'each', 7.95,  7.95),
  os('Versa-Lifter',                  'Retaining Wall', 'each', 85,    85),
  os('Versa-Lok Caps (Grey/Tan)',     'Retaining Wall', 'each', 7.70,  7.70),
  os('Versa-Lok Caps (Blend)',        'Retaining Wall', 'each', 8.90,  8.90),
  os('Versa-Lok Standard (Grey/Tan)', 'Retaining Wall', 'each', 9.85,  9.85),
  os('Versa-Lok Standard (Blends)',   'Retaining Wall', 'each', 11.00, 11.00),
  os('Versa-Pins',                    'Retaining Wall', 'each', 0.33,  0.33),
  os('Eco-Blox',                      'Retaining Wall', 'each', 75,    75),
  os('Eco-Rise',                      'Retaining Wall', 'each', 105,   105),

  // ── Steps (each + ton mix) ──────────────────────────────────
  os('Big Sky Saw Cut Steps 4′',           'Retaining Wall', 'each', 168, 168),
  os('Black Hills Natural Steps',          'Retaining Wall', 'ton',  345, 345),
  os('Black Hills Snapped 3′ Steps',       'Retaining Wall', 'each', 96,  96),
  os('Black Hills Snapped 4′ Steps',       'Retaining Wall', 'each', 123, 123),
  os('Black Hills Steps Sawn 4′',          'Retaining Wall', 'each', 240, 240),
  os('Colorado Red 3′ Snapped Steps',      'Retaining Wall', 'each', 175, 175),
  os('Colorado Red 4′ Snapped Steps',      'Retaining Wall', 'each', 230, 230),
  os('Copper Mountain Saw Cut 4′',   'Retaining Wall', 'each', 145, 145),
  os('Dover Grey Steps 3′',                'Retaining Wall', 'each', 125, 125),
  os('Dover Grey Steps 4′',                'Retaining Wall', 'each', 165, 165),
  os('Dover Grey Steps 5′',                'Retaining Wall', 'each', 205, 205),
  os('Driftwood Steps 4′',                 'Retaining Wall', 'each', 280, 280),
  os('Foxglove 3′ Snapped Steps',          'Retaining Wall', 'each', 96,  96),
  os('Foxglove 4′ Snapped Steps',          'Retaining Wall', 'each', 123, 123),
  os('Foxglove Steps Sawn 4′',             'Retaining Wall', 'each', 240, 240),
  os('Landing Steps',                      'Retaining Wall', 'each', 124, 124),
  os('Windsor Saw Cut Steps 4′',           'Retaining Wall', 'each', 180, 180),

  // ── Grass Seed / Erosion ────────────────────────────────────
  os('Lebanon Pro Starter Fertilizer',     'Sod & Seed', 'each', 38,  38),
  os('Preferred Turf Plus 5# Bag',         'Sod & Seed', 'each', 19,  19),
  os('Preferred Turf Plus 25# Bag',        'Sod & Seed', 'each', 82,  82),
  os('Preferred Turf Plus 50# Bag',        'Sod & Seed', 'each', 147, 147),
  os('Straw Blanket 4′x50′ Single Sided',  'Sod & Seed', 'each', 30,  30),
  os('Straw Blanket 8′x112.5′ Double Sided', 'Sod & Seed', 'each', 80,  80),

  // ── Landscape Fabric (each) ─────────────────────────────────
  os('12.5′x54′ Soil Separation Fabric',   'Other', 'each', 127, 127),
  os('3′x100′ 3oz. Fabric',                'Other', 'each', 36,  36),
  os('3′x100′ 4oz. Fabric',                'Other', 'each', 54,  54),
  os('3′x50′ 3oz. Fabric',                 'Other', 'each', 18,  18),
  os('3′x50′ 4oz. Fabric',                 'Other', 'each', 27,  27),
  os('4′x100′ 3oz. Fabric',                'Other', 'each', 48,  48),
  os('4′x100′ 4oz. Fabric',                'Other', 'each', 76,  76),
  os('4′x250′ 4oz. Fabric',                'Other', 'each', 150, 150),
  os('4′x50′ 3oz. Fabric',                 'Other', 'each', 24,  24),
  os('4′x50′ 4oz. Fabric',                 'Other', 'each', 38,  38),
  os('4′x50′ LS3 Fabric',                  'Other', 'each', 25,  25),
  os('4′x50′ Soil Separation Fabric',      'Other', 'each', 42,  42),
  os('6′x100′ 3oz. Fabric',                'Other', 'each', 67,  67),
  os('6′x100′ 4oz. Fabric',                'Other', 'each', 98,  98),
  os('6′x250′ 4oz. Fabric',                'Other', 'each', 225, 225),
  os('Fabric Staples 50ct Package',        'Other', 'each', 7,   7),
  os('Geo-Grid Bidirectional',             'Other', 'each', 83,  83),

  // ── Hardscape Accessories ───────────────────────────────────
  os('10 oz. Retaining Wall Block Adhesive', 'Other', 'each', 7,    7),
  os('28 oz. Retaining Wall Block Adhesive', 'Other', 'each', 13,   13),
  os('PaveEdge Paver Restraint',             'Other', 'each', 20,   20),
  os('Paver Edging Stakes',                  'Other', 'each', 0.90, 0.90),
  os('SRW Hexabase',                         'Other', 'each', 8.75, 8.75),
  os('SRW Pavermate Z3 (Tan)',               'Other', 'each', 28,   28),
  os('SRW Pavermate Z3 (Granite/Black)',     'Other', 'each', 32,   32),
  os('SRW X-Treme (Tan)',                    'Other', 'each', 32,   32),
  os('SRW X-Treme (Granite)',                'Other', 'each', 34,   34),
  os('Steel Edging Spikes',                  'Other', 'each', 0.98, 0.98),
  os('Techniseal EdgeBond',                  'Other', 'each', 28,   28),
  os('Techniseal HD Paver Prep – Efflo Cleaner', 'Other', 'each', 42, 42),
  os('Techniseal iN Paver Sealer – Natural Look', 'Other', 'each', 110, 110),
  os('Techniseal NextBase',                  'Other', 'each', 22,   22),
  os('Techniseal WL-87 3-in-1 Sealer',       'Other', 'each', 80,   80),

  // ── Fire Pits & Burners ─────────────────────────────────────
  os('33″ x 10″ H Burner Kit',           'Other', 'each', 310,  310),
  os('45″ x 10″ H Burner Kit',           'Other', 'each', 345,  345),
  os('Black Lava Rock (Bag)',            'Other', 'bag',  10,   10),
  os('Firegear 22″ Burning Spur Kit',    'Other', 'each', 320,  320),
  os('Firegear 31″ Burning Spur Kit',    'Other', 'each', 350,  350),
  os('Fireglass (Solid Colors)',         'Other', 'each', 35,   35),
  os('Fireglass (Reflective)',           'Other', 'each', 50,   50),
  os('Firepit Vent Kit 4″',              'Other', 'each', 100,  100, { description: 'Sold per pair.' }),
  os('Firepit Vent Kit 6″',              'Other', 'each', 110,  110, { description: 'Sold per pair.' }),
  os('Lume Smokeless Firepit Insert',    'Other', 'each', 420,  420),
  os('Propane Conversion Kit',           'Other', 'each', 60,   60),
  os('Tumbled Lava Stones',              'Other', 'each', 110,  110),
  os('Belgard 4pc Firepit Cap',          'Other', 'each', 470,  470),
  os('Belgard Weston Firepit',           'Other', 'each', 495,  495),
  os('Rochester 8 pc Firepit Cap',       'Other', 'each', 410,  410),
  os('Rochester Grand Firepit',          'Other', 'each', 650,  650),

  // ── Water Features ──────────────────────────────────────────
  os('3″ Check Valve Assembly',          'Other', 'each', 170,  170),
  os('Auto Fill Kit',                    'Other', 'each', 35,   35),
  os('Flex Hose .75″',                  'Other', 'ft',   2.25, 2.25),
  os('Flex Hose 1.5″ x 25′',             'Other', 'each', 85,   85),
  os('Flex Hose 2″ x 25′',               'Other', 'each', 120,  120),
  os('Flex Hose 2″ x 50′',               'Other', 'each', 225,  225),
  os('Flex Hose 3″ x 50′',               'Other', 'each', 515,  515),
  os('Matala Filter',                    'Other', 'each', 65,   65),
  os('Media Bag',                        'Other', 'each', 10,   10),
  os('Triton Check Valve',               'Other', 'each', 70,   70),
  os('Waterfall Foam',                   'Other', 'each', 22,   22),
  os('Triton Ionizer',                   'Other', 'each', 260,  260),
  os('Triton Ionizer Replacement Anode', 'Other', 'each', 75,   75),
  os('Typhoon Aeration Kit 1800',        'Other', 'each', 185,  185),
  os('Typhoon Aeration Kit 3600',        'Other', 'each', 285,  285),
  os('SP1600 Fastfalls',                 'Other', 'each', 155,  155),
  os('SP1900 Fastfalls',                 'Other', 'each', 225,  225),
  os('SP2600 Fastfalls',                 'Other', 'each', 300,  300),
  os('SP3800 Fastfalls',                 'Other', 'each', 400,  400),
  os('BF1600 Filter Falls',              'Other', 'each', 295,  295),
  os('BF1900 Filter Falls',              'Other', 'each', 430,  430),
  os('BF2600 Filter Falls',              'Other', 'each', 525,  525),
  os('BF3800 Filter Falls',              'Other', 'each', 840,  840),
  os('FB3500 Fountain Basin',            'Other', 'each', 400,  400),
  os('FB4700 Fountain Basin',            'Other', 'each', 600,  600),
  os('FBKIT1 Plumbing Kit',              'Other', 'each', 85,   85),
  os('FBKIT3 Plumbing Kit',              'Other', 'each', 120,  120),
  os('Pond Liner',                       'Other', 'sqft', 1.25, 1.25),
  os('Pond Underlayment',                'Other', 'sqft', 0.35, 0.35),
  os('PS3900 Pro Series Skimmer',        'Other', 'each', 320,  320),
  os('PS4600 Pro Series Skimmer',        'Other', 'each', 465,  465),
  os('PS7000 Pro Series Skimmer',        'Other', 'each', 590,  590),
  os('A-31',                        'Other', 'each', 960,  960),
  os('L-310',                       'Other', 'each', 1680, 1680),
  os('MD750',                       'Other', 'each', 105,  105),
  os('PV15000',               'Other', 'each', 415,  415),
  os('PV1700',                'Other', 'each', 230,  230),
  os('PV7500',                'Other', 'each', 275,  275),
  os('TT1500 TidalWave 3 Pump',          'Other', 'each', 220,  220),
  os('TT2000 TidalWave 3 Pump',          'Other', 'each', 245,  245),
  os('TT3000 TidalWave 3 Pump',          'Other', 'each', 290,  290),
  os('TT4000 TidalWave 3 Pump',          'Other', 'each', 415,  415),
  os('TT5000 TidalWave 3 Pump',          'Other', 'each', 460,  460),
  os('TT6000 TidalWave 3 Pump',          'Other', 'each', 510,  510),
  os('TT7500 TidalWave 3 Pump',          'Other', 'each', 655,  655),
  os('TT9000 TidalWave 3 Pump',          'Other', 'each', 700,  700),
  os('BioMax+ 1 Gallon',                 'Other', 'each', 50,   50),
  os('BioMax+ 32oz',                     'Other', 'each', 20,   20),
  os('EcoKlean 10lb',                    'Other', 'each', 65,   65),
  os('EcoKlean 2lb',                     'Other', 'each', 25,   25),
  os('Reclaim Sludge Remover',           'Other', 'each', 25,   25),

  // ─────────────────────────────────────────────────────────────
  //  MENARDS — generic landscape commodities the user buys local
  //  (edgers, retaining-wall block, base materials). Prices are
  //  estimates; supplierUrl is a Lincoln-store-scoped search so
  //  the user can click through to confirm the exact SKU.
  // ─────────────────────────────────────────────────────────────
  mn('Suncast Landscape Edging — 60 ft Coil', 'Edging', 'each', 25, 30, {
    description: 'Black plastic landscape edging, contractor coil. Buy at Menards.',
    supplierUrl: 'https://www.menards.com/main/search.html?search=suncast+landscape+edging&store=3094',
  }),
  mn('Vigoro 4 ft Steel Edging Section',     'Edging', 'each', 12, 18, {
    description: 'Heavy-duty steel landscape edging strip with stakes. Buy at Menards.',
    supplierUrl: 'https://www.menards.com/main/search.html?search=steel+landscape+edging&store=3094',
  }),
  mn('Pavestone Anchor Diamond Pro Block',   'Retaining Wall', 'each', 4, 6, {
    description: 'Standard retaining wall block, gray. Buy at Menards.',
    supplierUrl: 'https://www.menards.com/main/search.html?search=anchor+diamond+pro+block&store=3094',
  }),
  mn('Pavestone Holland Paver',              'Pavers', 'sqft', 3, 4, {
    description: 'Standard 4×8 Holland paver, several colors. Buy at Menards.',
    supplierUrl: 'https://www.menards.com/main/search.html?search=holland+paver&store=3094',
  }),
  mn('Quikrete Paver Sand 0.5 cu ft',        'Sand & Gravel', 'bag', 5, 7, {
    description: 'Polymeric paver leveling sand, bagged. Buy at Menards.',
    supplierUrl: 'https://www.menards.com/main/search.html?search=quikrete+paver+sand&store=3094',
  }),
  mn('Sakrete All-Purpose Sand 50 lb',       'Sand & Gravel', 'bag', 5, 7, {
    description: 'Bagged construction sand. Buy at Menards.',
    supplierUrl: 'https://www.menards.com/main/search.html?search=sakrete+sand&store=3094',
  }),
  mn('Tundra 4 ft x 50 ft Landscape Fabric', 'Other', 'each', 18, 28, {
    description: 'Woven landscape fabric, 3 oz contractor grade. Buy at Menards.',
    supplierUrl: 'https://www.menards.com/main/search.html?search=landscape+fabric&store=3094',
  }),
  mn('Master Mark Plastic Edging Stakes',    'Other', 'each', 0.50, 1.00, {
    description: 'Plastic spikes for landscape edging. Buy at Menards.',
    supplierUrl: 'https://www.menards.com/main/search.html?search=edging+stakes&store=3094',
  }),

  // ─────────────────────────────────────────────────────────────
  //  HOME DEPOT — generic landscape commodities, Lincoln-scoped.
  //  Same disclaimer as the Menards block above.
  // ─────────────────────────────────────────────────────────────
  hd('Master Mark 4 ft Steel Edging Section', 'Edging', 'each', 12, 18, {
    description: 'Steel landscape edging. Buy at Home Depot.',
    supplierUrl: 'https://www.homedepot.com/s/master%20mark%20steel%20edging?NCNI-5&storeId=3204',
  }),
  hd('Suncast Plastic Edging Coil 60 ft',    'Edging', 'each', 25, 35, {
    description: 'Black plastic edging coil. Buy at Home Depot.',
    supplierUrl: 'https://www.homedepot.com/s/suncast%20plastic%20edging?NCNI-5&storeId=3204',
  }),
  hd('Pavestone RumbleStone Retaining Wall Block', 'Retaining Wall', 'each', 4, 6, {
    description: 'Standard retaining wall block. Buy at Home Depot.',
    supplierUrl: 'https://www.homedepot.com/s/pavestone%20rumblestone?NCNI-5&storeId=3204',
  }),
  hd('Pavestone Holland 4 in. x 8 in. Paver', 'Pavers', 'each', 0.40, 0.80, {
    description: 'Standard Holland paver, several colors. Buy at Home Depot.',
    supplierUrl: 'https://www.homedepot.com/s/pavestone%20holland%20paver?NCNI-5&storeId=3204',
  }),
  hd('Vigoro 3 ft x 50 ft Landscape Fabric', 'Other', 'each', 14, 22, {
    description: 'Woven landscape fabric, contractor grade. Buy at Home Depot.',
    supplierUrl: 'https://www.homedepot.com/s/vigoro%20landscape%20fabric?NCNI-5&storeId=3204',
  }),
  hd('Quikrete Paver Sand 0.5 cu ft',        'Sand & Gravel', 'bag', 5, 7, {
    description: 'Polymeric paver leveling sand, bagged. Buy at Home Depot.',
    supplierUrl: 'https://www.homedepot.com/s/quikrete%20paver%20sand?NCNI-5&storeId=3204',
  }),
  hd('Scotts Premium Topsoil 0.75 cu ft',    'Soil & Amendments', 'bag', 3, 5, {
    description: 'Bagged topsoil for spot-fill jobs. Buy at Home Depot.',
    supplierUrl: 'https://www.homedepot.com/s/scotts%20premium%20topsoil?NCNI-5&storeId=3204',
  }),
  hd('Anchor Wall Block Adhesive 28 oz',     'Other', 'each', 10, 15, {
    description: 'Construction-grade block adhesive. Buy at Home Depot.',
    supplierUrl: 'https://www.homedepot.com/s/anchor%20block%20adhesive?NCNI-5&storeId=3204',
  }),
];

// Loose name match: lowercase, strip punctuation/whitespace/quotes,
// collapse fancy quotes (″ ′ – —) to ascii. Used to find existing rows
// to update vs. inserting new.
export function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[″"]/g, '')
    .replace(/[′']/g, '')
    .replace(/[–—-]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Strict product lookup against the OS scrape. Each seed name was aligned to
// match an OS site listing during scraping, so direct + trivial variant
// matching (parens, plurals) is enough — no fuzzy "category bucket" fallbacks
// that produce wrong images. If a future seed item misses, fix the seed name
// rather than loosening the lookup.
const TRIVIAL_VARIANTS = (name) => {
  const set = new Set([name]);
  set.add(name.replace(/\s*\([^)]*\)\s*/g, ' '));            // drop parens
  set.add(name.replace(/\s*\(([^)]*)\)\s*/g, ' $1 '));        // unwrap parens
  return [...set];
};

// Returns { image, url, category } for a seed item, or null.
// `productMap` is OUTDOOR_SOLUTIONS_PRODUCTS — keyed by normalized OS name.
export function getProductForName(name, productMap) {
  if (!name || !productMap) return null;
  for (const v of TRIVIAL_VARIANTS(name)) {
    const k = normalizeName(v);
    if (productMap[k]) return productMap[k];
    if (productMap[k + 's']) return productMap[k + 's'];
    if (k.endsWith('s') && productMap[k.slice(0, -1)]) return productMap[k.slice(0, -1)];
  }
  return null;
}
