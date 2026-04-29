// Outdoor Solutions Lincoln — full product catalog & pricing.
// Source: https://outdoorsolutions-lincoln.com/price-list/
// Used by the catalog import button (see /catalog page) to seed or refresh
// our materials catalog. Per-ton items only carry the ton price (we don't
// quote in lbs); items also sold by the bag include the bag price as a note.

const SUPPLIER = 'Outdoor Solutions';

// Compact constructor so the array stays readable.
const m = (name, category, unit, low, high = low, extras = {}) => ({
  name, category, unit, supplier: SUPPLIER,
  costLow: low, costHigh: high, ...extras,
});

export const OUTDOOR_SOLUTIONS_CATALOG = [
  // ── Mulches (cu yd) ─────────────────────────────────────────
  m('Aromatic Cedar Mulch',     'Mulch', 'cu yd', 55,  55, { description: 'Premium aromatic cedar mulch.' }),
  m('Black Mulch',              'Mulch', 'cu yd', 45,  45, { color: 'Black', description: 'Dyed black landscape mulch.' }),
  m('Brown Mulch',              'Mulch', 'cu yd', 45,  45, { color: 'Brown', description: 'Dyed brown landscape mulch.' }),
  m('Coffee Mulch',             'Mulch', 'cu yd', 45,  45, { color: 'Coffee', description: 'Dyed coffee-tone mulch.' }),
  m('Dark Hardwood Mulch',      'Mulch', 'cu yd', 37,  37, { description: 'Natural dark hardwood mulch.' }),
  m('Nursery Mulch',            'Mulch', 'cu yd', 28,  28, { description: 'Economy nursery-grade mulch.' }),

  // ── Topsoils (cu yd) ────────────────────────────────────────
  m('Black Dirt',               'Soil & Amendments', 'cu yd', 20, 20),
  m('Garden Mix',                'Soil & Amendments', 'cu yd', 62, 62, { description: 'Premium garden planting mix.' }),
  m('Processed Black Dirt',      'Soil & Amendments', 'cu yd', 32, 32),
  m('Pulverized Topsoil',        'Soil & Amendments', 'cu yd', 44, 44),

  // ── Construction Materials (ton) ────────────────────────────
  m('1.5″ Screened Limestone',  'Sand & Gravel', 'ton', 68, 68),
  m('1″ Screened Limestone',    'Sand & Gravel', 'ton', 68, 68),
  m('3/8″ Limestone Chips',     'Sand & Gravel', 'ton', 82, 82),
  m('47B',                      'Sand & Gravel', 'ton', 46, 46, { description: 'Crushed road base.' }),
  m('Limestone Screenings',     'Sand & Gravel', 'ton', 46, 46),
  m('Washed Sand',              'Sand & Gravel', 'ton', 42, 42),

  // ── Landscape Rock (ton) ────────────────────────────────────
  m('Black Granite Chips',      'Rock', 'ton', 204, 204, { color: 'Black' }),
  m('Black Lava Rock',          'Rock', 'ton', 300, 300, { color: 'Black', notes: 'Also sold per bag at $10.' }),
  m('Black Obsidian',           'Rock', 'ton', 198, 198, { color: 'Black' }),
  m('Cedar Creek 2″',           'Rock', 'ton', 120, 120),
  m('Cherokee Red Large',       'Rock', 'ton', 198, 198, { color: 'Red' }),
  m('Cherokee Red Small',       'Rock', 'ton', 198, 198, { color: 'Red' }),
  m('Dakota Cobble 1.5″x3″',    'Rock', 'ton', 175, 175),
  m('Indian Sunset',            'Rock', 'ton', 198, 198),
  m('Mesa Grey 1-2″',           'Rock', 'ton', 215, 215, { color: 'Grey' }),
  m('Mexican Beach Pebbles',    'Rock', 'ton', 660, 660, { description: 'Premium smooth black beach pebbles.' }),
  m('Midnight Chips',           'Rock', 'ton', 198, 198, { color: 'Black' }),
  m('Mountain Granite',         'Rock', 'ton', 180, 180),
  m('Oak Creek 1″ x 2″',        'Rock', 'ton', 168, 168),
  m('Osage Buff',               'Rock', 'ton', 160, 160, { color: 'Buff' }),
  m('Ozark Brown 1″',           'Rock', 'ton', 162, 162, { color: 'Brown' }),
  m('Ozark Brown 2″',           'Rock', 'ton', 180, 180, { color: 'Brown' }),
  m('Ozark River Chips',        'Rock', 'ton', 148, 148),
  m('Pawnee Red',               'Rock', 'ton', 0,   0,   { color: 'Red', soldOut: true }),
  m('Rainbow Rock',             'Rock', 'ton', 0,   0,   { soldOut: true }),
  m('River Cobbles',            'Rock', 'ton', 118, 118),
  m('River Pebbles',            'Rock', 'ton', 84,  84),
  m('River Rock',               'Rock', 'ton', 110, 110),
  m('Shawnee Creek 1″',         'Rock', 'ton', 162, 162),
  m('Slate Chips',              'Rock', 'ton', 400, 400),
  m('Western Sunset',           'Rock', 'ton', 198, 198),
  m('White Marble',             'Rock', 'ton', 400, 400, { color: 'White' }),

  // ── Cobblestone & Mini Boulders (ton) ───────────────────────
  m('Black Obsidian Minis',     'Boulders', 'ton', 390, 390, { color: 'Black' }),
  m('Chip Creek Cobble',        'Boulders', 'ton', 280, 280),
  m('Colorado Moss Mini',       'Boulders', 'ton', 460, 460),
  m('Colorado River Flats',     'Boulders', 'ton', 480, 480),
  m('Dakota Cobble 3″-6″',      'Boulders', 'ton', 214, 214),
  m('Gage Valley Cobble',       'Boulders', 'ton', 144, 144),
  m('Glacier Granite 8″-18″',   'Boulders', 'ton', 198, 198),
  m('Glacier Granite Cobble 2″-4″', 'Boulders', 'ton', 160, 160),
  m('Indian Sunset Minis',      'Boulders', 'ton', 390, 390),
  m('Mesa Gray Cobble',         'Boulders', 'ton', 240, 240, { color: 'Grey' }),
  m('Oak Creek 2″-4″',          'Boulders', 'ton', 178, 178),
  m('Oak Creek 4″-8″',          'Boulders', 'ton', 178, 178),
  m('Western Sunset Minis',     'Boulders', 'ton', 460, 460),
  m('Whiskey Creek Minis',      'Boulders', 'ton', 390, 390),
  m('White Quartzite Minis',    'Boulders', 'ton', 390, 390, { color: 'White' }),

  // ── Boulders (ton) ──────────────────────────────────────────
  m('Alpine River Boulders',    'Boulders', 'ton', 300, 300),
  m('Black Granite Boulders',   'Boulders', 'ton', 290, 290, { color: 'Black' }),
  m('Black Obsidian Boulders',  'Boulders', 'ton', 290, 290, { color: 'Black' }),
  m('Cheyenne Boulders',        'Boulders', 'ton', 375, 375),
  m('Glacier Granite Boulders', 'Boulders', 'ton', 224, 224),
  m('Holey Boulders',           'Boulders', 'ton', 352, 352),
  m('Weathered Limestone Boulders', 'Boulders', 'ton', 370, 370),
  m('Whiskey Creek Boulders',   'Boulders', 'ton', 330, 330),
  m('White Quartzite Boulders', 'Boulders', 'ton', 290, 290, { color: 'White' }),

  // ── Basalt Columns (each) ───────────────────────────────────
  m('Basalt Column 18″',        'Boulders', 'each', 260,  260),
  m('Basalt Column 24″',        'Boulders', 'each', 350,  350),
  m('Basalt Column 30″',        'Boulders', 'each', 435,  435),
  m('Basalt Column 36″',        'Boulders', 'each', 525,  525),
  m('Basalt Columns Trio (18″-24″-30″)', 'Boulders', 'each', 975,  975),
  m('Basalt Columns Trio (24″-30″-36″)', 'Boulders', 'each', 1215, 1215),

  // ── Flagstone (ton) ─────────────────────────────────────────
  m('Arizona Buff Flagstone',     'Flagstone', 'ton', 495, 495, { color: 'Buff' }),
  m('Black Hills Flagstone',      'Flagstone', 'ton', 375, 375),
  m('Black Hills Supreme Flagstone', 'Flagstone', 'ton', 590, 590),
  m('Cherry Blend Flagstone',     'Flagstone', 'ton', 480, 480),
  m('Colorado Red Flagstone',     'Flagstone', 'ton', 355, 355, { color: 'Red' }),
  m('Foxglove Flagstone',         'Flagstone', 'ton', 375, 375),
  m('Sandhills Blue Flagstone',   'Flagstone', 'ton', 590, 590, { color: 'Blue' }),
  m('Smoke Quartzite Flagstone',  'Flagstone', 'ton', 580, 580),

  // ── Drystack Walls (ton) ────────────────────────────────────
  m('Big Sky 12″ Saw Cut Drystack',     'Retaining Wall', 'ton', 480, 480),
  m('Big Sky 6″ Saw Cut Drystack',      'Retaining Wall', 'ton', 460, 460),
  m('Black Hills Drystack',             'Retaining Wall', 'ton', 400, 400),
  m('Colorado Moss Drystack',           'Retaining Wall', 'ton', 420, 420),
  m('Copper Mountain 12″ Saw Cut Drystack', 'Retaining Wall', 'ton', 440, 440),
  m('Copper Mountain 6″ Saw Cut Drystack',  'Retaining Wall', 'ton', 370, 370),
  m('Cottonwood Tumbled 5″ Drystack',   'Retaining Wall', 'ton', 470, 470),
  m('Dover Grey 14″ Premium Drystack',  'Retaining Wall', 'ton', 178, 178, { color: 'Grey' }),
  m('Dover Grey 6″ Drystack',           'Retaining Wall', 'ton', 270, 270, { color: 'Grey' }),
  m('Dover Grey Tumbled 5″ Drystack',   'Retaining Wall', 'ton', 470, 470, { color: 'Grey' }),
  m('Foxglove Drystack',                'Retaining Wall', 'ton', 400, 400),
  m('Foxglove Sawn Drystack',           'Retaining Wall', 'ton', 545, 545),
  m('Weathered Fieldstone Drystack',    'Retaining Wall', 'ton', 330, 330),
  m('Whiskey Creek Beam Drystack',      'Retaining Wall', 'ton', 365, 365),
  m('Whiskey Creek Ledgestone Drystack', 'Retaining Wall', 'ton', 365, 365),

  // ── Edging ──────────────────────────────────────────────────
  m('Big Sky Saw Cut Edging',     'Edging', 'ton',  520, 520),
  m('Black Hills Natural Edging', 'Edging', 'ton',  395, 395),
  m('Colorado Red Edging',        'Edging', 'ton',  375, 375, { color: 'Red' }),
  m('Cottonwood Tumbled Edging',  'Edging', 'ton',  595, 595),
  m('EdgePro Prolip',             'Edging', 'each', 20,  20),
  m('EdgePro ProLip 90° corner',  'Edging', 'each', 4,   4),
  m('Foxglove Edging',            'Edging', 'ton',  395, 395),
  m('Steel Edging',               'Edging', 'each', 30,  30),
  m('White Marble Edging',        'Edging', 'ton',  545, 545, { color: 'White' }),
  m('Windsor Saw Cut Edging',     'Edging', 'ton',  470, 470),

  // ── Pavers ──────────────────────────────────────────────────
  m('Belgard Belgian Cobble',           'Pavers', 'sqft', 7.40, 7.40),
  m('Belgard Dimensions 18',            'Pavers', 'sqft', 6.95, 6.95),
  m('Belgard Dimensions Accent',        'Pavers', 'each', 2.60, 2.60),
  m('Belgard Mega Arbel',               'Pavers', 'sqft', 8.40, 8.40),
  m('Belgard Origins 18',               'Pavers', 'sqft', 6.95, 6.95),
  m('Belgard Papyrus',                  'Pavers', 'sqft', 7.60, 7.60),
  m('Rochester Bullnose',               'Pavers', 'each', 5.20, 5.20),
  m('Rochester Colonial Rectangle',     'Pavers', 'each', 3.30, 3.30),
  m('Rochester Contours',               'Pavers', 'sqft', 10.80, 10.80),
  m('Rochester Reno 3 pc',              'Pavers', 'sqft', 5.90, 5.90),
  m('Rochester Silhouette',             'Pavers', 'sqft', 10.00, 10.00),
  m('Rochester Tahoe 3 pc',             'Pavers', 'sqft', 5.90, 5.90),
  m('Rochester Windom',                 'Pavers', 'sqft', 7.05, 7.05),

  // ── Retaining Walls ─────────────────────────────────────────
  m('Anchor 24″ Column Cap',         'Retaining Wall', 'each', 195,  195),
  m('Anchor 30″ Column Cap',         'Retaining Wall', 'each', 240,  240),
  m('Belgard Weston 3pc',            'Retaining Wall', 'sqft', 11.75, 11.75),
  m('Belgard Weston Universal',      'Retaining Wall', 'each', 6.40,  6.40),
  m('Brisa Cap',                     'Retaining Wall', 'each', 8.00,  8.00),
  m('Brisa Column Unit',             'Retaining Wall', 'each', 17.50, 17.50),
  m('Brisa Freestanding Wall',       'Retaining Wall', 'sqft', 21.35, 21.35),
  m('Brisa Retaining Wall',          'Retaining Wall', 'sqft', 17.35, 17.35),
  m('Diamond Block',                 'Retaining Wall', 'each', 8.75,  8.75),
  m('Diamond Cap',                   'Retaining Wall', 'each', 6.70,  6.70),
  m('Diamond Pro',                   'Retaining Wall', 'each', 10.85, 10.85),
  m('Diamond Pro Cap',               'Retaining Wall', 'each', 8.75,  8.75),
  m('Diamond Pro Corners',           'Retaining Wall', 'each', 16.05, 16.05),
  m('Diamond Pro Stone Cut Cap',     'Retaining Wall', 'each', 8.80,  8.80),
  m('Diamond Pro Stone Cut Corners', 'Retaining Wall', 'each', 16.05, 16.05),
  m('Diamond Pro Stone Cut / Virtual Joint', 'Retaining Wall', 'each', 11.60, 11.60),
  m('Highland Freestanding',         'Retaining Wall', 'each', 12.05, 12.05),
  m('Highland Retaining Wall',       'Retaining Wall', 'each', 11.85, 12.20),
  m('Highland XL Cap',               'Retaining Wall', 'each', 9.40,  9.40),
  m('Rochester 25″ Column Cap',      'Retaining Wall', 'each', 180,   180),
  m('Rochester 30″ Column Cap',      'Retaining Wall', 'each', 240,   240),
  m('U Start Base Block',            'Retaining Wall', 'each', 7.95,  7.95),
  m('Versa-Lifter',                  'Retaining Wall', 'each', 85,    85),
  m('Versa-Lok Caps (Grey/Tan)',     'Retaining Wall', 'each', 7.70,  7.70),
  m('Versa-Lok Caps (Blend)',        'Retaining Wall', 'each', 8.90,  8.90),
  m('Versa-Lok Standard (Grey/Tan)', 'Retaining Wall', 'each', 9.85,  9.85),
  m('Versa-Lok Standard (Blends)',   'Retaining Wall', 'each', 11.00, 11.00),
  m('Versa-Pins',                    'Retaining Wall', 'each', 0.33,  0.33),
  m('Eco-Blox',                      'Retaining Wall', 'each', 75,    75),
  m('Eco-Rise',                      'Retaining Wall', 'each', 105,   105),

  // ── Steps (each + ton mix) ──────────────────────────────────
  m('Big Sky Saw Cut Steps 4′',           'Retaining Wall', 'each', 168, 168),
  m('Black Hills Natural Steps',          'Retaining Wall', 'ton',  345, 345),
  m('Black Hills Snapped 3′ Steps',       'Retaining Wall', 'each', 96,  96),
  m('Black Hills Snapped 4′ Steps',       'Retaining Wall', 'each', 123, 123),
  m('Black Hills Steps Sawn 4′',          'Retaining Wall', 'each', 240, 240),
  m('Colorado Red 3′ Snapped Steps',      'Retaining Wall', 'each', 175, 175),
  m('Colorado Red 4′ Snapped Steps',      'Retaining Wall', 'each', 230, 230),
  m('Copper Mountain Saw Cut 4′ Steps',   'Retaining Wall', 'each', 145, 145),
  m('Dover Grey Steps 3′',                'Retaining Wall', 'each', 125, 125),
  m('Dover Grey Steps 4′',                'Retaining Wall', 'each', 165, 165),
  m('Dover Grey Steps 5′',                'Retaining Wall', 'each', 205, 205),
  m('Driftwood Steps 4′',                 'Retaining Wall', 'each', 280, 280),
  m('Foxglove 3′ Snapped Steps',          'Retaining Wall', 'each', 96,  96),
  m('Foxglove 4′ Snapped Steps',          'Retaining Wall', 'each', 123, 123),
  m('Foxglove Steps Sawn 4′',             'Retaining Wall', 'each', 240, 240),
  m('Landing Steps',                      'Retaining Wall', 'each', 124, 124),
  m('Windsor Saw Cut Steps 4′',           'Retaining Wall', 'each', 180, 180),

  // ── Grass Seed / Erosion ────────────────────────────────────
  m('Lebanon Pro Starter Fertilizer',     'Sod & Seed', 'each', 38,  38),
  m('Preferred Turf Plus 5# Bag',         'Sod & Seed', 'each', 19,  19),
  m('Preferred Turf Plus 25# Bag',        'Sod & Seed', 'each', 82,  82),
  m('Preferred Turf Plus 50# Bag',        'Sod & Seed', 'each', 147, 147),
  m('Straw Blanket 4′x50′ Single Sided',  'Sod & Seed', 'each', 30,  30),
  m('Straw Blanket 8′x112.5′ Double Sided', 'Sod & Seed', 'each', 80,  80),

  // ── Landscape Fabric (each) ─────────────────────────────────
  m('12.5′x54′ Soil Separation Fabric',   'Other', 'each', 127, 127),
  m('3′x100′ 3oz. Fabric',                'Other', 'each', 36,  36),
  m('3′x100′ 4oz. Fabric',                'Other', 'each', 54,  54),
  m('3′x50′ 3oz. Fabric',                 'Other', 'each', 18,  18),
  m('3′x50′ 4oz. Fabric',                 'Other', 'each', 27,  27),
  m('4′x100′ 3oz. Fabric',                'Other', 'each', 48,  48),
  m('4′x100′ 4oz. Fabric',                'Other', 'each', 76,  76),
  m('4′x250′ 4oz. Fabric',                'Other', 'each', 150, 150),
  m('4′x50′ 3oz. Fabric',                 'Other', 'each', 24,  24),
  m('4′x50′ 4oz. Fabric',                 'Other', 'each', 38,  38),
  m('4′x50′ LS3 Fabric',                  'Other', 'each', 25,  25),
  m('4′x50′ Soil Separation Fabric',      'Other', 'each', 42,  42),
  m('6′x100′ 3oz. Fabric',                'Other', 'each', 67,  67),
  m('6′x100′ 4oz. Fabric',                'Other', 'each', 98,  98),
  m('6′x250′ 4oz. Fabric',                'Other', 'each', 225, 225),
  m('Fabric Staples 50ct Package',        'Other', 'each', 7,   7),
  m('Geo-Grid Bidirectional',             'Other', 'each', 83,  83),

  // ── Hardscape Accessories ───────────────────────────────────
  m('10 oz. Retaining Wall Block Adhesive', 'Other', 'each', 7,    7),
  m('28 oz. Retaining Wall Block Adhesive', 'Other', 'each', 13,   13),
  m('PaveEdge Paver Restraint',             'Other', 'each', 20,   20),
  m('Paver Edging Stakes',                  'Other', 'each', 0.90, 0.90),
  m('SRW Hexabase',                         'Other', 'each', 8.75, 8.75),
  m('SRW Pavermate Z3 (Tan)',               'Other', 'each', 28,   28),
  m('SRW Pavermate Z3 (Granite/Black)',     'Other', 'each', 32,   32),
  m('SRW X-Treme (Tan)',                    'Other', 'each', 32,   32),
  m('SRW X-Treme (Granite)',                'Other', 'each', 34,   34),
  m('Steel Edging Spikes',                  'Other', 'each', 0.98, 0.98),
  m('Techniseal EdgeBond',                  'Other', 'each', 28,   28),
  m('Techniseal HD Paver Prep – Efflo Cleaner', 'Other', 'each', 42, 42),
  m('Techniseal iN Paver Sealer – Natural Look', 'Other', 'each', 110, 110),
  m('Techniseal NextBase',                  'Other', 'each', 22,   22),
  m('Techniseal WL-87 3-in-1 Sealer',       'Other', 'each', 80,   80),

  // ── Fire Pits & Burners ─────────────────────────────────────
  m('33″ x 10″ H Burner Kit',           'Other', 'each', 310,  310),
  m('45″ x 10″ H Burner Kit',           'Other', 'each', 345,  345),
  m('Black Lava Rock (Bag)',            'Other', 'bag',  10,   10),
  m('Firegear 22″ Burning Spur Kit',    'Other', 'each', 320,  320),
  m('Firegear 31″ Burning Spur Kit',    'Other', 'each', 350,  350),
  m('Fireglass (Solid Colors)',         'Other', 'each', 35,   35),
  m('Fireglass (Reflective)',           'Other', 'each', 50,   50),
  m('Firepit Vent Kit 4″',              'Other', 'each', 100,  100, { description: 'Sold per pair.' }),
  m('Firepit Vent Kit 6″',              'Other', 'each', 110,  110, { description: 'Sold per pair.' }),
  m('Lume Smokeless Firepit Insert',    'Other', 'each', 420,  420),
  m('Propane Conversion Kit',           'Other', 'each', 60,   60),
  m('Tumbled Lava Stones',              'Other', 'each', 110,  110),
  m('Belgard 4pc Firepit Cap',          'Other', 'each', 470,  470),
  m('Belgard Weston Firepit',           'Other', 'each', 495,  495),
  m('Rochester 8 pc Firepit Cap',       'Other', 'each', 410,  410),
  m('Rochester Grand Firepit',          'Other', 'each', 650,  650),

  // ── Water Features ──────────────────────────────────────────
  m('3″ Check Valve Assembly',          'Other', 'each', 170,  170),
  m('Auto Fill Kit',                    'Other', 'each', 35,   35),
  m('Flex Hose 0.75″',                  'Other', 'ft',   2.25, 2.25),
  m('Flex Hose 1.5″ x 25′',             'Other', 'each', 85,   85),
  m('Flex Hose 2″ x 25′',               'Other', 'each', 120,  120),
  m('Flex Hose 2″ x 50′',               'Other', 'each', 225,  225),
  m('Flex Hose 3″ x 50′',               'Other', 'each', 515,  515),
  m('Matala Filter',                    'Other', 'each', 65,   65),
  m('Media Bag',                        'Other', 'each', 10,   10),
  m('Triton Check Valve',               'Other', 'each', 70,   70),
  m('Waterfall Foam',                   'Other', 'each', 22,   22),
  m('Triton Ionizer',                   'Other', 'each', 260,  260),
  m('Triton Ionizer Replacement Anode', 'Other', 'each', 75,   75),
  m('Typhoon Aeration Kit 1800',        'Other', 'each', 185,  185),
  m('Typhoon Aeration Kit 3600',        'Other', 'each', 285,  285),
  m('SP1600 Fastfalls',                 'Other', 'each', 155,  155),
  m('SP1900 Fastfalls',                 'Other', 'each', 225,  225),
  m('SP2600 Fastfalls',                 'Other', 'each', 300,  300),
  m('SP3800 Fastfalls',                 'Other', 'each', 400,  400),
  m('BF1600 Filter Falls',              'Other', 'each', 295,  295),
  m('BF1900 Filter Falls',              'Other', 'each', 430,  430),
  m('BF2600 Filter Falls',              'Other', 'each', 525,  525),
  m('BF3800 Filter Falls',              'Other', 'each', 840,  840),
  m('FB3500 Fountain Basin',            'Other', 'each', 400,  400),
  m('FB4700 Fountain Basin',            'Other', 'each', 600,  600),
  m('FBKIT1 Plumbing Kit',              'Other', 'each', 85,   85),
  m('FBKIT3 Plumbing Kit',              'Other', 'each', 120,  120),
  m('Pond Liner',                       'Other', 'sqft', 1.25, 1.25),
  m('Pond Underlayment',                'Other', 'sqft', 0.35, 0.35),
  m('PS3900 Pro Series Skimmer',        'Other', 'each', 320,  320),
  m('PS4600 Pro Series Skimmer',        'Other', 'each', 465,  465),
  m('PS7000 Pro Series Skimmer',        'Other', 'each', 590,  590),
  m('A-31 Pump',                        'Other', 'each', 960,  960),
  m('L-310 Pump',                       'Other', 'each', 1680, 1680),
  m('MD750 Pump',                       'Other', 'each', 105,  105),
  m('PV15000 Pump Vault',               'Other', 'each', 415,  415),
  m('PV1700 Pump Vault',                'Other', 'each', 230,  230),
  m('PV7500 Pump Vault',                'Other', 'each', 275,  275),
  m('TT1500 TidalWave 3 Pump',          'Other', 'each', 220,  220),
  m('TT2000 TidalWave 3 Pump',          'Other', 'each', 245,  245),
  m('TT3000 TidalWave 3 Pump',          'Other', 'each', 290,  290),
  m('TT4000 TidalWave 3 Pump',          'Other', 'each', 415,  415),
  m('TT5000 TidalWave 3 Pump',          'Other', 'each', 460,  460),
  m('TT6000 TidalWave 3 Pump',          'Other', 'each', 510,  510),
  m('TT7500 TidalWave 3 Pump',          'Other', 'each', 655,  655),
  m('TT9000 TidalWave 3 Pump',          'Other', 'each', 700,  700),
  m('BioMax+ 1 Gallon',                 'Other', 'each', 50,   50),
  m('BioMax+ 32oz',                     'Other', 'each', 20,   20),
  m('EcoKlean 10lb',                    'Other', 'each', 65,   65),
  m('EcoKlean 2lb',                     'Other', 'each', 25,   25),
  m('Reclaim Sludge Remover',           'Other', 'each', 25,   25),
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
