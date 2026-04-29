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
  hd('Black Dirt',               'Soil & Amendments', 'cu yd', 20, 20),
  hd('Garden Mix',                'Soil & Amendments', 'cu yd', 62, 62, { description: 'Premium garden planting mix.' }),
  hd('Processed Black Dirt',      'Soil & Amendments', 'cu yd', 32, 32),
  hd('Pulverized Topsoil',        'Soil & Amendments', 'cu yd', 44, 44),

  // ── Construction Materials (ton) ────────────────────────────
  mn('1.5″ Screened Limestone',  'Sand & Gravel', 'ton', 68, 68),
  mn('1″ Screened Limestone',    'Sand & Gravel', 'ton', 68, 68),
  mn('3/8″ Limestone Chips',     'Sand & Gravel', 'ton', 82, 82),
  mn('47B',                      'Sand & Gravel', 'ton', 46, 46, { description: 'Crushed road base.' }),
  mn('Limestone Screenings',     'Sand & Gravel', 'ton', 46, 46),
  mn('Washed Sand',              'Sand & Gravel', 'ton', 42, 42),

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
  mn('Black Obsidian Minis',     'Boulders', 'ton', 390, 390, { color: 'Black' }),
  mn('Chip Creek Cobble',        'Boulders', 'ton', 280, 280),
  mn('Colorado Moss Mini',       'Boulders', 'ton', 460, 460),
  mn('Colorado River Flats',     'Boulders', 'ton', 480, 480),
  mn('Dakota Cobble 3″-6″',      'Boulders', 'ton', 214, 214),
  mn('Gage Valley Cobble',       'Boulders', 'ton', 144, 144),
  mn('Glacier Granite 8″-18″',   'Boulders', 'ton', 198, 198),
  mn('Glacier Granite Cobble 2″-4″', 'Boulders', 'ton', 160, 160),
  mn('Indian Sunset Minis',      'Boulders', 'ton', 390, 390),
  mn('Mesa Gray Cobble',         'Boulders', 'ton', 240, 240, { color: 'Grey' }),
  mn('Oak Creek 2″-4″',          'Boulders', 'ton', 178, 178),
  mn('Oak Creek 4″-8″',          'Boulders', 'ton', 178, 178),
  mn('Western Sunset Minis',     'Boulders', 'ton', 460, 460),
  mn('Whiskey Creek Minis',      'Boulders', 'ton', 390, 390),
  mn('White Quartzite Minis',    'Boulders', 'ton', 390, 390, { color: 'White' }),

  // ── Boulders (ton) ──────────────────────────────────────────
  mn('Alpine River Boulders',    'Boulders', 'ton', 300, 300),
  mn('Black Granite Boulders',   'Boulders', 'ton', 290, 290, { color: 'Black' }),
  mn('Black Obsidian Boulders',  'Boulders', 'ton', 290, 290, { color: 'Black' }),
  mn('Cheyenne Boulders',        'Boulders', 'ton', 375, 375),
  mn('Glacier Granite Boulders', 'Boulders', 'ton', 224, 224),
  mn('Holey Boulders',           'Boulders', 'ton', 352, 352),
  mn('Weathered Limestone Boulders', 'Boulders', 'ton', 370, 370),
  mn('Whiskey Creek Boulders',   'Boulders', 'ton', 330, 330),
  mn('White Quartzite Boulders', 'Boulders', 'ton', 290, 290, { color: 'White' }),

  // ── Basalt Columns (each) ───────────────────────────────────
  mn('Basalt Column 18″',        'Boulders', 'each', 260,  260),
  mn('Basalt Column 24″',        'Boulders', 'each', 350,  350),
  mn('Basalt Column 30″',        'Boulders', 'each', 435,  435),
  mn('Basalt Column 36″',        'Boulders', 'each', 525,  525),
  mn('Basalt Columns Trio (18″-24″-30″)', 'Boulders', 'each', 975,  975),
  mn('Basalt Columns Trio (24″-30″-36″)', 'Boulders', 'each', 1215, 1215),

  // ── Flagstone (ton) ─────────────────────────────────────────
  mn('Arizona Buff Flagstone',     'Flagstone', 'ton', 495, 495, { color: 'Buff' }),
  mn('Black Hills Flagstone',      'Flagstone', 'ton', 375, 375),
  mn('Black Hills Supreme Flagstone', 'Flagstone', 'ton', 590, 590),
  mn('Cherry Blend Flagstone',     'Flagstone', 'ton', 480, 480),
  mn('Colorado Red Flagstone',     'Flagstone', 'ton', 355, 355, { color: 'Red' }),
  mn('Foxglove Flagstone',         'Flagstone', 'ton', 375, 375),
  mn('Sandhills Blue Flagstone',   'Flagstone', 'ton', 590, 590, { color: 'Blue' }),
  mn('Smoke Quartzite Flagstone',  'Flagstone', 'ton', 580, 580),

  // ── Drystack Walls (ton) ────────────────────────────────────
  mn('Big Sky 12″ Saw Cut Drystack',     'Retaining Wall', 'ton', 480, 480),
  mn('Big Sky 6″ Saw Cut Drystack',      'Retaining Wall', 'ton', 460, 460),
  mn('Black Hills Drystack',             'Retaining Wall', 'ton', 400, 400),
  mn('Colorado Moss Drystack',           'Retaining Wall', 'ton', 420, 420),
  mn('Copper Mountain 12″ Saw Cut Drystack', 'Retaining Wall', 'ton', 440, 440),
  mn('Copper Mountain 6″ Saw Cut Drystack',  'Retaining Wall', 'ton', 370, 370),
  mn('Cottonwood Tumbled 5″ Drystack',   'Retaining Wall', 'ton', 470, 470),
  mn('Dover Grey 14″ Premium Drystack',  'Retaining Wall', 'ton', 178, 178, { color: 'Grey' }),
  mn('Dover Grey 6″ Drystack',           'Retaining Wall', 'ton', 270, 270, { color: 'Grey' }),
  mn('Dover Grey Tumbled 5″ Drystack',   'Retaining Wall', 'ton', 470, 470, { color: 'Grey' }),
  mn('Foxglove Drystack',                'Retaining Wall', 'ton', 400, 400),
  mn('Foxglove Sawn Drystack',           'Retaining Wall', 'ton', 545, 545),
  mn('Weathered Fieldstone Drystack',    'Retaining Wall', 'ton', 330, 330),
  mn('Whiskey Creek Beam Drystack',      'Retaining Wall', 'ton', 365, 365),
  mn('Whiskey Creek Ledgestone Drystack', 'Retaining Wall', 'ton', 365, 365),

  // ── Edging ──────────────────────────────────────────────────
  mn('Big Sky Saw Cut Edging',     'Edging', 'ton',  520, 520),
  mn('Black Hills Natural Edging', 'Edging', 'ton',  395, 395),
  mn('Colorado Red Edging',        'Edging', 'ton',  375, 375, { color: 'Red' }),
  mn('Cottonwood Tumbled Edging',  'Edging', 'ton',  595, 595),
  mn('EdgePro Prolip',             'Edging', 'each', 20,  20),
  mn('EdgePro ProLip 90° corner',  'Edging', 'each', 4,   4),
  mn('Foxglove Edging',            'Edging', 'ton',  395, 395),
  mn('Steel Edging',               'Edging', 'each', 30,  30),
  mn('White Marble Edging',        'Edging', 'ton',  545, 545, { color: 'White' }),
  mn('Windsor Saw Cut Edging',     'Edging', 'ton',  470, 470),

  // ── Pavers ──────────────────────────────────────────────────
  mn('Belgard Belgian Cobble',           'Pavers', 'sqft', 7.40, 7.40),
  mn('Belgard Dimensions 18',            'Pavers', 'sqft', 6.95, 6.95),
  mn('Belgard Dimensions Accent',        'Pavers', 'each', 2.60, 2.60),
  mn('Belgard Mega Arbel',               'Pavers', 'sqft', 8.40, 8.40),
  mn('Belgard Origins 18',               'Pavers', 'sqft', 6.95, 6.95),
  mn('Belgard Papyrus',                  'Pavers', 'sqft', 7.60, 7.60),
  mn('Rochester Bullnose',               'Pavers', 'each', 5.20, 5.20),
  mn('Rochester Colonial Rectangle',     'Pavers', 'each', 3.30, 3.30),
  mn('Rochester Contours',               'Pavers', 'sqft', 10.80, 10.80),
  mn('Rochester Reno 3 pc',              'Pavers', 'sqft', 5.90, 5.90),
  mn('Rochester Silhouette',             'Pavers', 'sqft', 10.00, 10.00),
  mn('Rochester Tahoe 3 pc',             'Pavers', 'sqft', 5.90, 5.90),
  mn('Rochester Windom',                 'Pavers', 'sqft', 7.05, 7.05),

  // ── Retaining Walls ─────────────────────────────────────────
  mn('Anchor 24″ Column Cap',         'Retaining Wall', 'each', 195,  195),
  mn('Anchor 30″ Column Cap',         'Retaining Wall', 'each', 240,  240),
  mn('Belgard Weston 3pc',            'Retaining Wall', 'sqft', 11.75, 11.75),
  mn('Belgard Weston Universal',      'Retaining Wall', 'each', 6.40,  6.40),
  mn('Brisa Cap',                     'Retaining Wall', 'each', 8.00,  8.00),
  mn('Brisa Column Unit',             'Retaining Wall', 'each', 17.50, 17.50),
  mn('Brisa Freestanding Wall',       'Retaining Wall', 'sqft', 21.35, 21.35),
  mn('Brisa Retaining Wall',          'Retaining Wall', 'sqft', 17.35, 17.35),
  mn('Diamond Block',                 'Retaining Wall', 'each', 8.75,  8.75),
  mn('Diamond Cap',                   'Retaining Wall', 'each', 6.70,  6.70),
  mn('Diamond Pro',                   'Retaining Wall', 'each', 10.85, 10.85),
  mn('Diamond Pro Cap',               'Retaining Wall', 'each', 8.75,  8.75),
  mn('Diamond Pro Corners',           'Retaining Wall', 'each', 16.05, 16.05),
  mn('Diamond Pro Stone Cut Cap',     'Retaining Wall', 'each', 8.80,  8.80),
  mn('Diamond Pro Stone Cut Corners', 'Retaining Wall', 'each', 16.05, 16.05),
  mn('Diamond Pro Stone Cut / Virtual Joint', 'Retaining Wall', 'each', 11.60, 11.60),
  mn('Highland Freestanding',         'Retaining Wall', 'each', 12.05, 12.05),
  mn('Highland Retaining Wall',       'Retaining Wall', 'each', 11.85, 12.20),
  mn('Highland XL Cap',               'Retaining Wall', 'each', 9.40,  9.40),
  mn('Rochester 25″ Column Cap',      'Retaining Wall', 'each', 180,   180),
  mn('Rochester 30″ Column Cap',      'Retaining Wall', 'each', 240,   240),
  mn('U Start Base Block',            'Retaining Wall', 'each', 7.95,  7.95),
  mn('Versa-Lifter',                  'Retaining Wall', 'each', 85,    85),
  mn('Versa-Lok Caps (Grey/Tan)',     'Retaining Wall', 'each', 7.70,  7.70),
  mn('Versa-Lok Caps (Blend)',        'Retaining Wall', 'each', 8.90,  8.90),
  mn('Versa-Lok Standard (Grey/Tan)', 'Retaining Wall', 'each', 9.85,  9.85),
  mn('Versa-Lok Standard (Blends)',   'Retaining Wall', 'each', 11.00, 11.00),
  mn('Versa-Pins',                    'Retaining Wall', 'each', 0.33,  0.33),
  mn('Eco-Blox',                      'Retaining Wall', 'each', 75,    75),
  mn('Eco-Rise',                      'Retaining Wall', 'each', 105,   105),

  // ── Steps (each + ton mix) ──────────────────────────────────
  mn('Big Sky Saw Cut Steps 4′',           'Retaining Wall', 'each', 168, 168),
  mn('Black Hills Natural Steps',          'Retaining Wall', 'ton',  345, 345),
  mn('Black Hills Snapped 3′ Steps',       'Retaining Wall', 'each', 96,  96),
  mn('Black Hills Snapped 4′ Steps',       'Retaining Wall', 'each', 123, 123),
  mn('Black Hills Steps Sawn 4′',          'Retaining Wall', 'each', 240, 240),
  mn('Colorado Red 3′ Snapped Steps',      'Retaining Wall', 'each', 175, 175),
  mn('Colorado Red 4′ Snapped Steps',      'Retaining Wall', 'each', 230, 230),
  mn('Copper Mountain Saw Cut 4′ Steps',   'Retaining Wall', 'each', 145, 145),
  mn('Dover Grey Steps 3′',                'Retaining Wall', 'each', 125, 125),
  mn('Dover Grey Steps 4′',                'Retaining Wall', 'each', 165, 165),
  mn('Dover Grey Steps 5′',                'Retaining Wall', 'each', 205, 205),
  mn('Driftwood Steps 4′',                 'Retaining Wall', 'each', 280, 280),
  mn('Foxglove 3′ Snapped Steps',          'Retaining Wall', 'each', 96,  96),
  mn('Foxglove 4′ Snapped Steps',          'Retaining Wall', 'each', 123, 123),
  mn('Foxglove Steps Sawn 4′',             'Retaining Wall', 'each', 240, 240),
  mn('Landing Steps',                      'Retaining Wall', 'each', 124, 124),
  mn('Windsor Saw Cut Steps 4′',           'Retaining Wall', 'each', 180, 180),

  // ── Grass Seed / Erosion ────────────────────────────────────
  hd('Lebanon Pro Starter Fertilizer',     'Sod & Seed', 'each', 38,  38),
  hd('Preferred Turf Plus 5# Bag',         'Sod & Seed', 'each', 19,  19),
  hd('Preferred Turf Plus 25# Bag',        'Sod & Seed', 'each', 82,  82),
  hd('Preferred Turf Plus 50# Bag',        'Sod & Seed', 'each', 147, 147),
  hd('Straw Blanket 4′x50′ Single Sided',  'Sod & Seed', 'each', 30,  30),
  hd('Straw Blanket 8′x112.5′ Double Sided', 'Sod & Seed', 'each', 80,  80),

  // ── Landscape Fabric (each) ─────────────────────────────────
  hd('12.5′x54′ Soil Separation Fabric',   'Other', 'each', 127, 127),
  hd('3′x100′ 3oz. Fabric',                'Other', 'each', 36,  36),
  hd('3′x100′ 4oz. Fabric',                'Other', 'each', 54,  54),
  hd('3′x50′ 3oz. Fabric',                 'Other', 'each', 18,  18),
  hd('3′x50′ 4oz. Fabric',                 'Other', 'each', 27,  27),
  hd('4′x100′ 3oz. Fabric',                'Other', 'each', 48,  48),
  hd('4′x100′ 4oz. Fabric',                'Other', 'each', 76,  76),
  hd('4′x250′ 4oz. Fabric',                'Other', 'each', 150, 150),
  hd('4′x50′ 3oz. Fabric',                 'Other', 'each', 24,  24),
  hd('4′x50′ 4oz. Fabric',                 'Other', 'each', 38,  38),
  hd('4′x50′ LS3 Fabric',                  'Other', 'each', 25,  25),
  hd('4′x50′ Soil Separation Fabric',      'Other', 'each', 42,  42),
  hd('6′x100′ 3oz. Fabric',                'Other', 'each', 67,  67),
  hd('6′x100′ 4oz. Fabric',                'Other', 'each', 98,  98),
  hd('6′x250′ 4oz. Fabric',                'Other', 'each', 225, 225),
  hd('Fabric Staples 50ct Package',        'Other', 'each', 7,   7),
  hd('Geo-Grid Bidirectional',             'Other', 'each', 83,  83),

  // ── Hardscape Accessories ───────────────────────────────────
  hd('10 oz. Retaining Wall Block Adhesive', 'Other', 'each', 7,    7),
  hd('28 oz. Retaining Wall Block Adhesive', 'Other', 'each', 13,   13),
  hd('PaveEdge Paver Restraint',             'Other', 'each', 20,   20),
  hd('Paver Edging Stakes',                  'Other', 'each', 0.90, 0.90),
  hd('SRW Hexabase',                         'Other', 'each', 8.75, 8.75),
  hd('SRW Pavermate Z3 (Tan)',               'Other', 'each', 28,   28),
  hd('SRW Pavermate Z3 (Granite/Black)',     'Other', 'each', 32,   32),
  hd('SRW X-Treme (Tan)',                    'Other', 'each', 32,   32),
  hd('SRW X-Treme (Granite)',                'Other', 'each', 34,   34),
  hd('Steel Edging Spikes',                  'Other', 'each', 0.98, 0.98),
  hd('Techniseal EdgeBond',                  'Other', 'each', 28,   28),
  hd('Techniseal HD Paver Prep – Efflo Cleaner', 'Other', 'each', 42, 42),
  hd('Techniseal iN Paver Sealer – Natural Look', 'Other', 'each', 110, 110),
  hd('Techniseal NextBase',                  'Other', 'each', 22,   22),
  hd('Techniseal WL-87 3-in-1 Sealer',       'Other', 'each', 80,   80),

  // ── Fire Pits & Burners ─────────────────────────────────────
  hd('33″ x 10″ H Burner Kit',           'Other', 'each', 310,  310),
  hd('45″ x 10″ H Burner Kit',           'Other', 'each', 345,  345),
  hd('Black Lava Rock (Bag)',            'Other', 'bag',  10,   10),
  hd('Firegear 22″ Burning Spur Kit',    'Other', 'each', 320,  320),
  hd('Firegear 31″ Burning Spur Kit',    'Other', 'each', 350,  350),
  hd('Fireglass (Solid Colors)',         'Other', 'each', 35,   35),
  hd('Fireglass (Reflective)',           'Other', 'each', 50,   50),
  hd('Firepit Vent Kit 4″',              'Other', 'each', 100,  100, { description: 'Sold per pair.' }),
  hd('Firepit Vent Kit 6″',              'Other', 'each', 110,  110, { description: 'Sold per pair.' }),
  hd('Lume Smokeless Firepit Insert',    'Other', 'each', 420,  420),
  hd('Propane Conversion Kit',           'Other', 'each', 60,   60),
  hd('Tumbled Lava Stones',              'Other', 'each', 110,  110),
  hd('Belgard 4pc Firepit Cap',          'Other', 'each', 470,  470),
  hd('Belgard Weston Firepit',           'Other', 'each', 495,  495),
  hd('Rochester 8 pc Firepit Cap',       'Other', 'each', 410,  410),
  hd('Rochester Grand Firepit',          'Other', 'each', 650,  650),

  // ── Water Features ──────────────────────────────────────────
  hd('3″ Check Valve Assembly',          'Other', 'each', 170,  170),
  hd('Auto Fill Kit',                    'Other', 'each', 35,   35),
  hd('Flex Hose 0.75″',                  'Other', 'ft',   2.25, 2.25),
  hd('Flex Hose 1.5″ x 25′',             'Other', 'each', 85,   85),
  hd('Flex Hose 2″ x 25′',               'Other', 'each', 120,  120),
  hd('Flex Hose 2″ x 50′',               'Other', 'each', 225,  225),
  hd('Flex Hose 3″ x 50′',               'Other', 'each', 515,  515),
  hd('Matala Filter',                    'Other', 'each', 65,   65),
  hd('Media Bag',                        'Other', 'each', 10,   10),
  hd('Triton Check Valve',               'Other', 'each', 70,   70),
  hd('Waterfall Foam',                   'Other', 'each', 22,   22),
  hd('Triton Ionizer',                   'Other', 'each', 260,  260),
  hd('Triton Ionizer Replacement Anode', 'Other', 'each', 75,   75),
  hd('Typhoon Aeration Kit 1800',        'Other', 'each', 185,  185),
  hd('Typhoon Aeration Kit 3600',        'Other', 'each', 285,  285),
  hd('SP1600 Fastfalls',                 'Other', 'each', 155,  155),
  hd('SP1900 Fastfalls',                 'Other', 'each', 225,  225),
  hd('SP2600 Fastfalls',                 'Other', 'each', 300,  300),
  hd('SP3800 Fastfalls',                 'Other', 'each', 400,  400),
  hd('BF1600 Filter Falls',              'Other', 'each', 295,  295),
  hd('BF1900 Filter Falls',              'Other', 'each', 430,  430),
  hd('BF2600 Filter Falls',              'Other', 'each', 525,  525),
  hd('BF3800 Filter Falls',              'Other', 'each', 840,  840),
  hd('FB3500 Fountain Basin',            'Other', 'each', 400,  400),
  hd('FB4700 Fountain Basin',            'Other', 'each', 600,  600),
  hd('FBKIT1 Plumbing Kit',              'Other', 'each', 85,   85),
  hd('FBKIT3 Plumbing Kit',              'Other', 'each', 120,  120),
  hd('Pond Liner',                       'Other', 'sqft', 1.25, 1.25),
  hd('Pond Underlayment',                'Other', 'sqft', 0.35, 0.35),
  hd('PS3900 Pro Series Skimmer',        'Other', 'each', 320,  320),
  hd('PS4600 Pro Series Skimmer',        'Other', 'each', 465,  465),
  hd('PS7000 Pro Series Skimmer',        'Other', 'each', 590,  590),
  hd('A-31 Pump',                        'Other', 'each', 960,  960),
  hd('L-310 Pump',                       'Other', 'each', 1680, 1680),
  hd('MD750 Pump',                       'Other', 'each', 105,  105),
  hd('PV15000 Pump Vault',               'Other', 'each', 415,  415),
  hd('PV1700 Pump Vault',                'Other', 'each', 230,  230),
  hd('PV7500 Pump Vault',                'Other', 'each', 275,  275),
  hd('TT1500 TidalWave 3 Pump',          'Other', 'each', 220,  220),
  hd('TT2000 TidalWave 3 Pump',          'Other', 'each', 245,  245),
  hd('TT3000 TidalWave 3 Pump',          'Other', 'each', 290,  290),
  hd('TT4000 TidalWave 3 Pump',          'Other', 'each', 415,  415),
  hd('TT5000 TidalWave 3 Pump',          'Other', 'each', 460,  460),
  hd('TT6000 TidalWave 3 Pump',          'Other', 'each', 510,  510),
  hd('TT7500 TidalWave 3 Pump',          'Other', 'each', 655,  655),
  hd('TT9000 TidalWave 3 Pump',          'Other', 'each', 700,  700),
  hd('BioMax+ 1 Gallon',                 'Other', 'each', 50,   50),
  hd('BioMax+ 32oz',                     'Other', 'each', 20,   20),
  hd('EcoKlean 10lb',                    'Other', 'each', 65,   65),
  hd('EcoKlean 2lb',                     'Other', 'each', 25,   25),
  hd('Reclaim Sludge Remover',           'Other', 'each', 25,   25),
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

// Best-effort image lookup. Many OS items share a category-level image
// (pumps, skimmers, fast falls, etc.), so we try in order:
//   1. exact normalized name
//   2. with parenthesized variant suffix dropped — "SRW X-Treme (Tan)" → "srwxtreme"
//   3. with a trailing qualifier word dropped — "Black Hills Drystack" → "blackhills"
//   4. category bucket — "TT1500 TidalWave 3 Pump" → "pumps"
const STRIP_TAIL = /(mulch(?:es)?|edging|drystack|boulders?|flagstone|cobble|minis|fabric|pumps?|pumpvaults?|fastfalls|filterfalls|fountainbasins?|plumbingkit|steps|columncaps?)$/;

const CATEGORY_BUCKETS = [
  { test: /pumpvault|^pv\d/i,                key: 'pumpvaults' },
  { test: /(?:^|\b)pump(?!vault)|^tt\d|^a-?\d|^l-?\d|^md\d/i, key: 'pumps' },
  { test: /skimmer|^ps\d/i,                  key: 'pondskimmers' },
  { test: /fastfalls|^sp\d/i,                key: 'fastfalls' },
  { test: /filterfalls|^bf\d/i,              key: 'filterfalls' },
  { test: /fountainbasin|^fb\d|^fbkit/i,     key: 'fountainbasins' },
  { test: /pondliner|underlayment/i,         key: 'pondlinerunderlayment' },
  { test: /basaltcolumn/i,                   key: 'basaltcolumns' },
  { test: /eco.?blox|eco.?rise/i,            key: 'ecobloxecorise' },
  { test: /versalokcap/i,                    key: 'versalokcaps' },
  { test: /versalokstandard/i,               key: 'versalokstandard' },
  { test: /srwpavermate/i,                   key: 'srwpavermatez3' },
  { test: /srwxtreme/i,                      key: 'srwxtreme' },
  { test: /fireglass/i,                      key: 'fireglass' },
  { test: /aeration|aerator|ionizer|typhoon/i, key: 'aeratorsionizers' },
  { test: /biomax|ecoklean|reclaim|sludge/i, key: 'waterfeaturetreatments' },
  // Anything else under pond / accessories — flex hoses, check valves, etc.
  { test: /flexhose|checkvalve|matalafilter|mediabag|waterfallfoam|autofillkit/i, key: 'accessories' },
];

// The OS site is inconsistent: sometimes it writes "1.5", sometimes "1 1/2",
// sometimes spells out "degree" instead of "°". We try every input both ways.
function nameVariants(name) {
  const set = new Set();
  const candidates = [
    name,
    name.replace(/°/g, ' degree '),
    name.replace(/(\d)\.5\b/g, '$1 1/2'),
    name.replace(/°/g, ' degree ').replace(/(\d)\.5\b/g, '$1 1/2'),
    name.replace(/\s*\([^)]*\)\s*/g, ' '),                  // drop parenthesized variant
    name.replace(/\s*\(([^)]*)\)\s*/g, ' $1 '),             // unwrap parenthesized variant
  ];
  for (const c of candidates) set.add(c);
  return [...set];
}

function tryLookup(imageMap, key) {
  if (imageMap[key]) return imageMap[key];
  if (imageMap[key + 's']) return imageMap[key + 's'];
  if (key.endsWith('s') && imageMap[key.slice(0, -1)]) return imageMap[key.slice(0, -1)];
  return null;
}

export function getImageForName(name, imageMap) {
  if (!name || !imageMap) return null;
  for (const variant of nameVariants(name)) {
    const k = normalizeName(variant);
    const direct = tryLookup(imageMap, k);
    if (direct) return direct;
    let stripped = k;
    for (let i = 0; i < 4 && STRIP_TAIL.test(stripped); i++) {
      stripped = stripped.replace(STRIP_TAIL, '');
      const hit = tryLookup(imageMap, stripped);
      if (hit) return hit;
    }
  }
  // Category bucket fallback (using the original name's normalized form)
  const k0 = normalizeName(name);
  for (const { test, key } of CATEGORY_BUCKETS) {
    if (test.test(k0) && imageMap[key]) return imageMap[key];
  }
  return null;
}
