'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const DataContext = createContext(null);

// ---------- Seed Data ----------
const SEED_CUSTOMERS = [
  { id: 'c1', firstName: 'Burdette', lastName: 'Schoen', email: 'burdette@email.com', phone: '(402) 555-0101', address: '1420 S 27th St', city: 'Lincoln', state: 'NE', zip: '68502', tags: ['active', 'vip'], notes: 'Repeat customer, great relationship. Overseeded fall 2025.', source: 'website', createdAt: '2025-09-15' },
  { id: 'c2', firstName: 'Trent', lastName: 'Jenkins', email: 'trent.j@email.com', phone: '(402) 555-0202', address: '3305 Pioneers Blvd', city: 'Lincoln', state: 'NE', zip: '68506', tags: ['active'], notes: 'Hardscaping project completed.', source: 'referral', createdAt: '2025-11-03' },
  { id: 'c3', firstName: 'Than', lastName: 'Aye', email: 'than.aye@email.com', phone: '(402) 555-0303', address: '840 N 56th St', city: 'Lincoln', state: 'NE', zip: '68504', tags: ['active'], notes: 'Mulch job completed, very satisfied.', source: 'website', createdAt: '2026-01-12' },
  { id: 'c4', firstName: 'Sarah', lastName: 'Mitchell', email: 'sarah.m@email.com', phone: '(402) 555-0404', address: '2750 Old Cheney Rd', city: 'Lincoln', state: 'NE', zip: '68516', tags: ['lead'], notes: 'Interested in full landscape design for new build.', source: 'website', createdAt: '2026-03-28' },
  { id: 'c5', firstName: 'James', lastName: 'Ortega', email: 'jortega@email.com', phone: '(402) 555-0505', address: '920 S Cotner Blvd', city: 'Lincoln', state: 'NE', zip: '68510', tags: ['lead'], notes: 'Needs retaining wall quote for backyard slope.', source: 'website', createdAt: '2026-04-05' },
];

const SEED_QUOTES = [
  {
    id: 'q1', quoteNumber: 1001, customerId: 'c1', status: 'accepted', category: 'Lawn Care', total: 1850, createdAt: '2025-10-01', items: [
      { name: 'Weekly Mowing (Season)', quantity: 1, unit: 'season', unitPrice: 1200, total: 1200 },
      { name: 'Seasonal Cleanup ×2', quantity: 2, unit: 'visit', unitPrice: 225, total: 450 },
      { name: 'Hedge Trimming', quantity: 1, unit: 'visit', unitPrice: 200, total: 200 },
    ]
  },
  {
    id: 'q2', quoteNumber: 1002, customerId: 'c2', status: 'accepted', category: 'Hardscaping', total: 4200, createdAt: '2025-11-10', items: [
      { name: 'Paver Patio (280 sqft)', quantity: 280, unit: 'sqft', unitPrice: 12, total: 3360 },
      { name: 'Polymeric Sand', quantity: 1, unit: 'bag', unitPrice: 40, total: 40 },
      { name: 'Base Material & Prep', quantity: 1, unit: 'lot', unitPrice: 800, total: 800 },
    ]
  },
  {
    id: 'q3', quoteNumber: 1003, customerId: 'c3', status: 'accepted', category: 'Garden & Beds', total: 780, createdAt: '2026-01-20', items: [
      { name: 'Premium Black Mulch', quantity: 6, unit: 'cu yd', unitPrice: 85, total: 510 },
      { name: 'Bed Edging', quantity: 45, unit: 'ft', unitPrice: 4, total: 180 },
      { name: 'Weed Barrier Fabric', quantity: 1, unit: 'roll', unitPrice: 90, total: 90 },
    ]
  },
  {
    id: 'q4', quoteNumber: 1004, customerId: 'c4', status: 'sent', category: 'Landscape Design', total: 8500, createdAt: '2026-04-01', items: [
      { name: 'Design Consultation & Plan', quantity: 1, unit: 'project', unitPrice: 500, total: 500 },
      { name: 'Front Yard Landscaping', quantity: 1, unit: 'project', unitPrice: 3500, total: 3500 },
      { name: 'Backyard Patio + Fire Pit', quantity: 1, unit: 'project', unitPrice: 4500, total: 4500 },
    ]
  },
  {
    id: 'q5', quoteNumber: 1005, customerId: 'c5', status: 'draft', category: 'Hardscaping', total: 3200, createdAt: '2026-04-10', items: [
      { name: 'Retaining Wall (30 ft, 3 ft high)', quantity: 90, unit: 'face ft', unitPrice: 30, total: 2700 },
      { name: 'Drainage System', quantity: 1, unit: 'lot', unitPrice: 500, total: 500 },
    ]
  },
];

const SEED_MATERIALS = [
  // ========== MULCH (Outdoor Solutions) ==========
  { id: 'm1', category: 'Mulch', name: 'Aromatic Cedar', description: 'Premium aromatic cedar mulch. Natural insect-repelling properties with a rich cedar scent.', unit: 'cu yd', costLow: 55, costHigh: 55, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/cedar-mulch.jpg' },
  { id: 'm2', category: 'Mulch', name: 'Black Mulch', description: 'Rich black dyed hardwood mulch. Most popular color choice.', unit: 'cu yd', costLow: 45, costHigh: 45, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/black-mulch.jpg' },
  { id: 'm3', category: 'Mulch', name: 'Brown Mulch', description: 'Natural brown hardwood mulch. Classic, warm tone.', unit: 'cu yd', costLow: 45, costHigh: 45, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/brown-mulch.jpg' },
  { id: 'm4', category: 'Mulch', name: 'Coffee Mulch', description: 'Rich coffee-colored hardwood mulch. Deep, warm aesthetic.', unit: 'cu yd', costLow: 45, costHigh: 45, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/coffee-mulch.jpg' },
  { id: 'm5', category: 'Mulch', name: 'Dark Hardwood', description: 'Natural dark hardwood mulch. Economical and long-lasting.', unit: 'cu yd', costLow: 37, costHigh: 37, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/hardwood-mulch.jpg' },
  { id: 'm6', category: 'Mulch', name: 'Nursery Mulch', description: 'Budget-friendly nursery grade mulch. Great for large coverage areas.', unit: 'cu yd', costLow: 28, costHigh: 28, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/nursery-mulch.jpg' },

  // ========== LANDSCAPE ROCK (Outdoor Solutions) ==========
  { id: 'r1', category: 'Landscape Rock', name: 'Black Granite Chips', description: 'Sleek black granite chips. Modern, high-contrast look.', unit: 'ton', costLow: 0.102, costHigh: 204, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/black-granite-chips.jpg', unitAlt: 'lb' },
  { id: 'r2', category: 'Landscape Rock', name: 'Black Lava Rock', description: 'Lightweight volcanic lava rock. Excellent drainage and insulation. Also available in $10 bags.', unit: 'ton', costLow: 0.15, costHigh: 300, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/black-lava-rock.jpg', unitAlt: 'lb' },
  { id: 'r3', category: 'Landscape Rock', name: 'Black Obsidian', description: 'Dark glossy obsidian-style decorative rock.', unit: 'ton', costLow: 0.099, costHigh: 198, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/black-obsidian.jpg', unitAlt: 'lb' },
  { id: 'r4', category: 'Landscape Rock', name: 'Cedar Creek 2"', description: 'Natural earth-toned creek rock, 2 inch size.', unit: 'ton', costLow: 0.06, costHigh: 120, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/cedar-creek.jpg', unitAlt: 'lb' },
  { id: 'r5', category: 'Landscape Rock', name: 'Cherokee Red Large', description: 'Bold red decorative rock, large size.', unit: 'ton', costLow: 0.099, costHigh: 198, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/cherokee-red-large.jpg', unitAlt: 'lb' },
  { id: 'r6', category: 'Landscape Rock', name: 'Cherokee Red Small', description: 'Bold red decorative rock, small size.', unit: 'ton', costLow: 0.099, costHigh: 198, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/cherokee-red-small.jpg', unitAlt: 'lb' },
  { id: 'r7', category: 'Landscape Rock', name: 'Dakota Cobble 1½"x3"', description: 'Natural cobblestone, 1.5 to 3 inch size. Great for borders and beds.', unit: 'ton', costLow: 0.0875, costHigh: 175, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/dakota-cobble.jpg', unitAlt: 'lb' },
  { id: 'r8', category: 'Landscape Rock', name: 'Indian Sunset', description: 'Warm sunset-toned decorative rock. Beautiful color blend.', unit: 'ton', costLow: 0.099, costHigh: 198, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/indian-sunset.jpg', unitAlt: 'lb' },
  { id: 'r9', category: 'Landscape Rock', name: 'Mesa Grey 1-2"', description: 'Neutral grey decorative rock, 1-2 inch size. Clean, modern look.', unit: 'ton', costLow: 0.1075, costHigh: 215, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/mesa-grey.jpg', unitAlt: 'lb' },
  { id: 'r10', category: 'Landscape Rock', name: 'Mexican Beach Pebbles', description: 'Premium smooth black beach pebbles. High-end accent rock.', unit: 'ton', costLow: 0.33, costHigh: 660, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/mexican-beach-pebbles.jpg', unitAlt: 'lb' },
  { id: 'r11', category: 'Landscape Rock', name: 'Midnight Chips', description: 'Dark midnight-toned decorative chips.', unit: 'ton', costLow: 0.099, costHigh: 198, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/midnight-chips.jpg', unitAlt: 'lb' },
  { id: 'r12', category: 'Landscape Rock', name: 'Mountain Granite', description: 'Natural mountain granite. Durable and versatile.', unit: 'ton', costLow: 0.09, costHigh: 180, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/mountain-granite.jpg', unitAlt: 'lb' },
  { id: 'r13', category: 'Landscape Rock', name: 'Oak Creek 1"x2"', description: 'Warm-toned creek rock, 1-2 inch size.', unit: 'ton', costLow: 0.084, costHigh: 168, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/oak-creek.jpg', unitAlt: 'lb' },
  { id: 'r14', category: 'Landscape Rock', name: 'Osage Buff', description: 'Warm buff-colored decorative rock. Natural, earthy feel.', unit: 'ton', costLow: 0.08, costHigh: 160, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/osage-buff.jpg', unitAlt: 'lb' },
  { id: 'r15', category: 'Landscape Rock', name: 'Ozark Brown 1"', description: 'Rich brown Ozark rock, 1 inch size.', unit: 'ton', costLow: 0.081, costHigh: 162, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/ozark-brown1.jpg', unitAlt: 'lb' },
  { id: 'r16', category: 'Landscape Rock', name: 'Ozark Brown 2"', description: 'Rich brown Ozark rock, 2 inch size.', unit: 'ton', costLow: 0.09, costHigh: 180, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/ozark-brown2.jpg', unitAlt: 'lb' },
  { id: 'r17', category: 'Landscape Rock', name: 'Ozark River Chips', description: 'Natural river chip rock from the Ozarks.', unit: 'ton', costLow: 0.074, costHigh: 148, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/ozark-river-chips.jpg', unitAlt: 'lb' },
  { id: 'r18', category: 'Landscape Rock', name: 'Pawnee Red', description: 'Red decorative landscape rock.', unit: 'ton', costLow: 0.09, costHigh: 0, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/pawnee-red.jpg', unitAlt: 'lb', soldOut: true },
  { id: 'r19', category: 'Landscape Rock', name: 'Rainbow Rock', description: 'Multi-colored decorative landscape rock.', unit: 'ton', costLow: 0.09, costHigh: 0, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/rainbow-rock.jpg', unitAlt: 'lb', soldOut: true },
  { id: 'r20', category: 'Landscape Rock', name: 'River Cobbles', description: 'Smooth rounded river cobbles. Classic natural look.', unit: 'ton', costLow: 0.059, costHigh: 118, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/river-cobbles.jpg', unitAlt: 'lb' },
  { id: 'r21', category: 'Landscape Rock', name: 'River Pebbles', description: 'Small smooth river pebbles. Great for ground cover and accents.', unit: 'ton', costLow: 0.042, costHigh: 84, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/river-pebbles.jpg', unitAlt: 'lb' },
  { id: 'r22', category: 'Landscape Rock', name: 'River Rock', description: 'Smooth, rounded river rock. Great for beds and drainage.', unit: 'ton', costLow: 0.055, costHigh: 110, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/river-rock.jpg', unitAlt: 'lb' },
  { id: 'r23', category: 'Landscape Rock', name: 'Shawnee Creek 1"', description: 'Natural Shawnee creek rock, 1 inch size.', unit: 'ton', costLow: 0.081, costHigh: 162, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/shawnee-creek.jpg', unitAlt: 'lb' },
  { id: 'r24', category: 'Landscape Rock', name: 'Slate Chips', description: 'Flat slate chip rock. Premium decorative look.', unit: 'ton', costLow: 0.20, costHigh: 400, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/slate-chips.jpg', unitAlt: 'lb' },
  { id: 'r25', category: 'Landscape Rock', name: 'Western Sunset', description: 'Warm sunset-toned decorative rock with orange and red hues.', unit: 'ton', costLow: 0.099, costHigh: 198, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/western-sunset.jpg', unitAlt: 'lb' },
  { id: 'r26', category: 'Landscape Rock', name: 'White Marble', description: 'Bright white marble decorative rock. Clean, bright look.', unit: 'ton', costLow: 0.20, costHigh: 400, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/white-marble.jpg', unitAlt: 'lb' },

  // ========== EDGING (Outdoor Solutions) ==========
  { id: 'e1', category: 'Edging', name: 'Big Sky Saw Cut Edging', description: 'Premium saw-cut natural stone edging.', unit: 'ton', costLow: 0.26, costHigh: 520, supplier: 'Outdoor Solutions', image: '🪨', unitAlt: 'lb' },
  { id: 'e2', category: 'Edging', name: 'Black Hills Natural Edging', description: 'Natural Black Hills stone edging. Rustic, organic look.', unit: 'ton', costLow: 0.1975, costHigh: 395, supplier: 'Outdoor Solutions', image: '⬛', unitAlt: 'lb' },
  { id: 'e3', category: 'Edging', name: 'Colorado Red Edging', description: 'Bold Colorado red stone edging.', unit: 'ton', costLow: 0.1875, costHigh: 375, supplier: 'Outdoor Solutions', image: '🔴', unitAlt: 'lb' },
  { id: 'e4', category: 'Edging', name: 'Cottonwood Tumbled Edging', description: 'Tumbled Cottonwood stone edging. Soft, natural finish.', unit: 'ton', costLow: 0.2975, costHigh: 595, supplier: 'Outdoor Solutions', image: '🟤', unitAlt: 'lb' },
  { id: 'e5', category: 'Edging', name: 'EdgePro Prolip', description: 'Professional EdgePro Prolip landscape edging.', unit: 'each', costLow: 20, costHigh: 20, supplier: 'Outdoor Solutions', image: '➖' },
  { id: 'e6', category: 'Edging', name: 'EdgePro ProLip 90° Corner', description: 'EdgePro ProLip 90-degree corner piece.', unit: 'each', costLow: 4, costHigh: 4, supplier: 'Outdoor Solutions', image: '📐' },
  { id: 'e7', category: 'Edging', name: 'Foxglove Edging', description: 'Foxglove natural stone edging.', unit: 'ton', costLow: 0.1975, costHigh: 395, supplier: 'Outdoor Solutions', image: '🌸', unitAlt: 'lb' },
  { id: 'e8', category: 'Edging', name: 'Steel Edging', description: 'Professional-grade steel edging. Clean lines, very durable.', unit: 'each', costLow: 30, costHigh: 30, supplier: 'Outdoor Solutions', image: '➖' },
  { id: 'e9', category: 'Edging', name: 'White Marble Edging', description: 'Bright white marble stone edging. Premium, clean look.', unit: 'ton', costLow: 0.2725, costHigh: 545, supplier: 'Outdoor Solutions', image: '⬜', unitAlt: 'lb' },
  { id: 'e10', category: 'Edging', name: 'Windsor Saw Cut Edging', description: 'Windsor saw-cut stone edging. Refined, uniform profile.', unit: 'ton', costLow: 0.235, costHigh: 470, supplier: 'Outdoor Solutions', image: '🪨', unitAlt: 'lb' },

  // ========== PAVERS ==========
  { id: 'p1', category: 'Pavers', name: 'Concrete Pavers', description: 'Standard interlocking concrete pavers. Available in multiple colors.', unit: 'sqft', costLow: 3, costHigh: 8, supplier: 'Outdoor Solutions', image: '🧱' },
  { id: 'p2', category: 'Pavers', name: 'Brick Pavers', description: 'Classic clay brick pavers. Timeless look and extreme durability.', unit: 'sqft', costLow: 6, costHigh: 15, supplier: 'Outdoor Solutions', image: '🔴' },
  { id: 'p3', category: 'Pavers', name: 'Natural Stone Pavers', description: 'Premium bluestone or travertine pavers. High-end finish.', unit: 'sqft', costLow: 10, costHigh: 25, supplier: 'Outdoor Solutions', image: '💎' },

  // ========== RETAINING WALL ==========
  { id: 'w1', category: 'Retaining Wall', name: 'Versa-Lok Block', description: 'Engineered retaining wall block. Standard for structural walls.', unit: 'face ft', costLow: 18, costHigh: 35, supplier: 'Outdoor Solutions', image: '🧊' },
  { id: 'w2', category: 'Retaining Wall', name: 'Natural Boulder', description: 'Large natural boulders for rustic retaining walls.', unit: 'ton', costLow: 200, costHigh: 500, supplier: 'Outdoor Solutions', image: '🪨' },
];

const SEED_SERVICES = [
  { id: 's1', category: 'Lawn Care', name: 'Weekly Mowing', unit: 'visit', defaultPrice: 45 },
  { id: 's2', category: 'Lawn Care', name: 'Bi-Weekly Mowing', unit: 'visit', defaultPrice: 55 },
  { id: 's3', category: 'Lawn Care', name: 'Seasonal Cleanup', unit: 'visit', defaultPrice: 225 },
  { id: 's4', category: 'Lawn Care', name: 'One-Time Leaf Removal', unit: 'visit', defaultPrice: 175 },
  { id: 's5', category: 'Lawn Care', name: 'Hedge/Shrub Trimming', unit: 'visit', defaultPrice: 200 },
  { id: 's6', category: 'Garden & Beds', name: 'Mulch (installed)', unit: 'cu yd', defaultPrice: 85 },
  { id: 's7', category: 'Garden & Beds', name: 'Rock/Stone (installed)', unit: 'ton', defaultPrice: 280 },
  { id: 's8', category: 'Garden & Beds', name: 'Bed Edging', unit: 'ft', defaultPrice: 4 },
  { id: 's9', category: 'Garden & Beds', name: 'Plant Installation', unit: 'each', defaultPrice: 45 },
  { id: 's10', category: 'Hardscaping', name: 'Concrete Pavers', unit: 'sqft', defaultPrice: 12 },
  { id: 's11', category: 'Hardscaping', name: 'Natural Stone Pavers', unit: 'sqft', defaultPrice: 22 },
  { id: 's12', category: 'Hardscaping', name: 'Retaining Wall', unit: 'face ft', defaultPrice: 30 },
  { id: 's13', category: 'Hardscaping', name: 'Fire Pit', unit: 'project', defaultPrice: 2500 },
  { id: 's14', category: 'Cleanup', name: 'Full Yard Cleanup', unit: 'project', defaultPrice: 350 },
  { id: 's15', category: 'Cleanup', name: 'Junk Removal', unit: 'load', defaultPrice: 250 },
  { id: 's16', category: 'Design', name: 'Design Consultation', unit: 'project', defaultPrice: 500 },
  { id: 's17', category: 'Design', name: 'Full Landscape Design & Build', unit: 'project', defaultPrice: 5000 },
];

const SEED_ACTIVITY = [
  { id: 'a1', customerId: 'c5', quoteId: 'q5', type: 'quote_created', title: 'Quote #1005 created', description: 'Retaining wall — $3,200 draft', createdAt: '2026-04-10T14:30:00' },
  { id: 'a2', customerId: 'c4', quoteId: 'q4', type: 'quote_sent', title: 'Quote #1004 sent to Sarah Mitchell', description: 'Landscape Design — $8,500', createdAt: '2026-04-02T09:15:00' },
  { id: 'a3', customerId: 'c3', quoteId: 'q3', type: 'quote_accepted', title: 'Quote #1003 accepted', description: 'Than Aye — Garden & Beds — $780', createdAt: '2026-01-22T16:45:00' },
  { id: 'a4', customerId: 'c2', quoteId: 'q2', type: 'quote_accepted', title: 'Quote #1002 accepted', description: 'Trent Jenkins — Hardscaping — $4,200', createdAt: '2025-11-15T11:00:00' },
  { id: 'a5', customerId: 'c1', quoteId: 'q1', type: 'quote_accepted', title: 'Quote #1001 accepted', description: 'Burdette Schoen — Lawn Care — $1,850', createdAt: '2025-10-05T08:30:00' },
];

// ---------- Helper ----------
function loadData(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  const saved = localStorage.getItem(`lucky_app_${key}`);
  if (saved) {
    try { return JSON.parse(saved); }
    catch { return fallback; }
  }
  return fallback;
}

function saveData(key, data) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`lucky_app_${key}`, JSON.stringify(data));
}

// ---------- Provider ----------
export function DataProvider({ children }) {
  const [customers, setCustomers] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [services, setServices] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setCustomers(loadData('customers', SEED_CUSTOMERS));
    setQuotes(loadData('quotes', SEED_QUOTES));
    setMaterials(loadData('materials', SEED_MATERIALS));
    setServices(loadData('services', SEED_SERVICES));
    setActivity(loadData('activity', SEED_ACTIVITY));
    setLoaded(true);
  }, []);

  // Persist on change
  useEffect(() => { if (loaded) saveData('customers', customers); }, [customers, loaded]);
  useEffect(() => { if (loaded) saveData('quotes', quotes); }, [quotes, loaded]);
  useEffect(() => { if (loaded) saveData('materials', materials); }, [materials, loaded]);
  useEffect(() => { if (loaded) saveData('services', services); }, [services, loaded]);
  useEffect(() => { if (loaded) saveData('activity', activity); }, [activity, loaded]);

  // ---------- Customer CRUD ----------
  const addCustomer = useCallback((customer) => {
    const newCustomer = {
      ...customer,
      id: `c${Date.now()}`,
      tags: customer.tags || ['lead'],
      createdAt: new Date().toISOString().split('T')[0],
      source: 'manual',
    };
    setCustomers(prev => [newCustomer, ...prev]);
    addActivity({
      customerId: newCustomer.id,
      type: 'customer_added',
      title: `${newCustomer.firstName} ${newCustomer.lastName || ''} added`,
      description: 'New customer created',
    });
    return newCustomer;
  }, []);

  const updateCustomer = useCallback((id, updates) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const deleteCustomer = useCallback((id) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
  }, []);

  // ---------- Quote CRUD ----------
  const addQuote = useCallback((quote) => {
    const maxNum = quotes.reduce((max, q) => Math.max(max, q.quoteNumber || 0), 1000);
    const newQuote = {
      ...quote,
      id: `q${Date.now()}`,
      quoteNumber: maxNum + 1,
      status: 'draft',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setQuotes(prev => [newQuote, ...prev]);
    addActivity({
      customerId: newQuote.customerId,
      quoteId: newQuote.id,
      type: 'quote_created',
      title: `Quote #${newQuote.quoteNumber} created`,
      description: `${newQuote.category} — $${newQuote.total?.toLocaleString()}`,
    });
    return newQuote;
  }, [quotes]);

  const updateQuote = useCallback((id, updates) => {
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
  }, []);

  // ---------- Activity ----------
  const addActivity = useCallback((entry) => {
    const newEntry = {
      ...entry,
      id: `a${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setActivity(prev => [newEntry, ...prev]);
  }, []);

  // ---------- Helpers ----------
  const getCustomer = useCallback((id) => customers.find(c => c.id === id), [customers]);
  const getQuote = useCallback((id) => quotes.find(q => q.id === id), [quotes]);
  const getCustomerQuotes = useCallback((customerId) => quotes.filter(q => q.customerId === customerId), [quotes]);
  const getCustomerActivity = useCallback((customerId) => activity.filter(a => a.customerId === customerId), [activity]);

  const value = {
    customers, quotes, materials, services, activity, loaded,
    addCustomer, updateCustomer, deleteCustomer,
    addQuote, updateQuote,
    addActivity,
    getCustomer, getQuote, getCustomerQuotes, getCustomerActivity,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
