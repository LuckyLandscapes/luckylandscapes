/**
 * Seed the materials catalog from images in the old Supabase "Materials" bucket.
 * 
 * Run with:  node src/scripts/seed-catalog.js
 * 
 * Requires .env.local in the project root with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Load .env.local manually
const envPath = path.resolve(__dirname, '../../.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const match = line.match(/^(\w+)=(.*)/);
    if (match) process.env[match[1]] = match[2].trim();
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Old bucket name (capital M)
const BUCKET = 'Materials';

function getPublicUrl(filename) {
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${filename}`;
}

// ─── Catalog Data ───────────────────────────────────────────────
// Images mapped to real landscaping materials with accurate details

const CATALOG = [
  // ── MULCH ──
  {
    name: 'Premium Black Mulch',
    category: 'Mulch',
    subcategory: 'Dyed',
    description: 'Rich jet-black dyed hardwood mulch. Provides excellent contrast for flower beds and landscaping borders. Color-enhanced to last longer.',
    unit: 'cu yd',
    unitAlt: 'scoop',
    costLow: 38,
    costHigh: 85,
    supplier: 'Outdoor Solutions',
    color: 'Black',
    texture: 'Shredded',
    coveragePerUnit: '1 cu yd ≈ 100 sqft at 3" depth',
    image: 'black-mulch.jpg',
    notes: 'Best seller. Most popular for modern landscapes.',
  },
  {
    name: 'Natural Brown Mulch',
    category: 'Mulch',
    subcategory: 'Dyed',
    description: 'Classic brown-dyed hardwood mulch. Natural look that complements any landscape. Long-lasting color retention.',
    unit: 'cu yd',
    unitAlt: 'scoop',
    costLow: 35,
    costHigh: 80,
    supplier: 'Outdoor Solutions',
    color: 'Brown',
    texture: 'Shredded',
    coveragePerUnit: '1 cu yd ≈ 100 sqft at 3" depth',
    image: 'brown-mulch.jpg',
    notes: 'Great all-around choice. Classic look.',
  },
  {
    name: 'Coffee Brown Mulch',
    category: 'Mulch',
    subcategory: 'Dyed',
    description: 'Deep coffee-brown dyed hardwood mulch. Warm, rich tone that enhances garden aesthetics.',
    unit: 'cu yd',
    unitAlt: 'scoop',
    costLow: 38,
    costHigh: 85,
    supplier: 'Outdoor Solutions',
    color: 'Coffee Brown',
    texture: 'Shredded',
    coveragePerUnit: '1 cu yd ≈ 100 sqft at 3" depth',
    image: 'coffee-mulch.jpg',
    notes: 'Popular premium option. Darker than standard brown.',
  },
  {
    name: 'Natural Cedar Mulch',
    category: 'Mulch',
    subcategory: 'Natural',
    description: 'Aromatic natural cedar mulch. Naturally pest-resistant and helps repel insects. No dyes — pure cedar color and scent.',
    unit: 'cu yd',
    unitAlt: 'scoop',
    costLow: 40,
    costHigh: 90,
    supplier: 'Outdoor Solutions',
    color: 'Natural Cedar',
    texture: 'Shredded',
    coveragePerUnit: '1 cu yd ≈ 100 sqft at 3" depth',
    image: 'cedar-mulch.jpg',
    notes: 'Natural insect repellent. Great around foundations.',
  },
  {
    name: 'Hardwood Mulch',
    category: 'Mulch',
    subcategory: 'Natural',
    description: 'Economy natural hardwood mulch. Undyed, breaks down to enrich soil. Great for garden beds and tree rings.',
    unit: 'cu yd',
    unitAlt: 'scoop',
    costLow: 28,
    costHigh: 65,
    supplier: 'Outdoor Solutions',
    color: 'Natural Brown',
    texture: 'Shredded',
    coveragePerUnit: '1 cu yd ≈ 100 sqft at 3" depth',
    image: 'hardwood-mulch.jpg',
    notes: 'Budget-friendly option. Fades faster than dyed.',
  },
  {
    name: 'Nursery Mulch',
    category: 'Mulch',
    subcategory: 'Fine',
    description: 'Fine-grade nursery mulch ideal for delicate plantings and garden beds. Decomposes faster to feed soil.',
    unit: 'cu yd',
    unitAlt: 'scoop',
    costLow: 30,
    costHigh: 70,
    supplier: 'Outdoor Solutions',
    color: 'Mixed Brown',
    texture: 'Fine Shredded',
    coveragePerUnit: '1 cu yd ≈ 110 sqft at 3" depth',
    image: 'nursery-mulch.jpg',
    notes: 'Best for annual flower beds and new plantings.',
  },

  // ── ROCK ──
  {
    name: 'River Rock',
    category: 'Rock',
    subcategory: 'River Stone',
    description: 'Natural river rock, 1.5"–3" smooth stones. Mixed earth tones — great for drainage areas, dry creek beds, and decorative borders.',
    unit: 'ton',
    unitAlt: '',
    costLow: 55,
    costHigh: 120,
    supplier: 'Outdoor Solutions',
    color: 'Mixed Earth Tones',
    texture: 'Smooth',
    coveragePerUnit: '1 ton ≈ 80 sqft at 2" depth',
    image: 'river-rock.jpg',
    notes: 'Versatile. Good for drainage and aesthetics.',
  },
  {
    name: 'River Pebbles',
    category: 'Rock',
    subcategory: 'River Stone',
    description: 'Small, smooth river pebbles ¾"–1.5". Perfect for ground cover, pathways, and decorative accents around plants.',
    unit: 'ton',
    unitAlt: '',
    costLow: 60,
    costHigh: 130,
    supplier: 'Outdoor Solutions',
    color: 'Mixed Tan/Grey',
    texture: 'Smooth',
    coveragePerUnit: '1 ton ≈ 100 sqft at 2" depth',
    image: 'river-pebbles.jpg',
    notes: 'Smaller than river rock. Great for ground cover.',
  },
  {
    name: 'River Cobbles',
    category: 'Rock',
    subcategory: 'River Stone',
    description: 'Large river cobblestones 3"–6". Perfect for dry creek beds, water features, and bold landscape accents.',
    unit: 'ton',
    unitAlt: '',
    costLow: 65,
    costHigh: 140,
    supplier: 'Outdoor Solutions',
    color: 'Mixed Natural',
    texture: 'Smooth',
    coveragePerUnit: '1 ton ≈ 50 sqft at 3" depth',
    image: 'river-cobbles.jpg',
    notes: 'Larger accent stones. Great for creek beds.',
  },
  {
    name: 'Mexican Beach Pebbles',
    category: 'Rock',
    subcategory: 'Premium Stone',
    description: 'Ultra-smooth polished beach pebbles. Premium landscaping stone with beautiful dark grey to black coloring. Stunning wet or dry.',
    unit: 'ton',
    unitAlt: '',
    costLow: 200,
    costHigh: 400,
    supplier: 'Outdoor Solutions',
    color: 'Dark Grey/Black',
    texture: 'Polished Smooth',
    coveragePerUnit: '1 ton ≈ 60 sqft at 2" depth',
    image: 'mexican-beach-pebbles.jpg',
    notes: 'Premium pricing. Very popular for modern designs.',
    isFavorite: true,
  },
  {
    name: 'Cherokee Red (Small)',
    category: 'Rock',
    subcategory: 'Crushed',
    description: 'Small ¾"–1" crushed red granite. Vibrant reddish-brown color that pops against green foliage.',
    unit: 'ton',
    unitAlt: '',
    costLow: 50,
    costHigh: 110,
    supplier: 'Outdoor Solutions',
    color: 'Red/Brown',
    texture: 'Crushed Angular',
    coveragePerUnit: '1 ton ≈ 80 sqft at 2" depth',
    image: 'cherokee-red-small.jpg',
    notes: 'Small grade. Good for beds and borders.',
  },
  {
    name: 'Cherokee Red (Large)',
    category: 'Rock',
    subcategory: 'Crushed',
    description: 'Large 1.5"–3" crushed red granite. Bold reddish-brown color for larger landscape areas and dramatic contrast.',
    unit: 'ton',
    unitAlt: '',
    costLow: 50,
    costHigh: 110,
    supplier: 'Outdoor Solutions',
    color: 'Red/Brown',
    texture: 'Crushed Angular',
    coveragePerUnit: '1 ton ≈ 70 sqft at 2" depth',
    image: 'cherokee-red-large.jpg',
    notes: 'Larger grade for bigger beds.',
  },
  {
    name: 'Pawnee Red',
    category: 'Rock',
    subcategory: 'Crushed',
    description: 'Deep red crushed quartzite rock. Rich crimson color that maintains vibrancy. Low-maintenance ground cover.',
    unit: 'ton',
    unitAlt: '',
    costLow: 55,
    costHigh: 115,
    supplier: 'Outdoor Solutions',
    color: 'Deep Red',
    texture: 'Crushed',
    coveragePerUnit: '1 ton ≈ 80 sqft at 2" depth',
    image: 'pawnee-red.jpg',
    notes: 'Deeper red than Cherokee. Premium look.',
  },
  {
    name: 'Black Lava Rock',
    category: 'Rock',
    subcategory: 'Volcanic',
    description: 'Lightweight volcanic lava rock. Porous texture provides excellent drainage. Dramatic dark color for modern landscapes.',
    unit: 'cu yd',
    unitAlt: '',
    costLow: 45,
    costHigh: 100,
    supplier: 'Outdoor Solutions',
    color: 'Black',
    texture: 'Porous/Rough',
    coveragePerUnit: '1 cu yd ≈ 120 sqft at 2" depth (lightweight)',
    image: 'black-lava-rock.jpg',
    notes: 'Very lightweight. Goes further per yard. Great around fire pits.',
  },
  {
    name: 'Black Obsidian Chips',
    category: 'Rock',
    subcategory: 'Decorative Chips',
    description: 'Glossy black obsidian-style decorative chips. Sleek, modern look for contemporary landscape designs.',
    unit: 'ton',
    unitAlt: '',
    costLow: 75,
    costHigh: 160,
    supplier: 'Outdoor Solutions',
    color: 'Glossy Black',
    texture: 'Angular Chips',
    coveragePerUnit: '1 ton ≈ 80 sqft at 2" depth',
    image: 'black-obsidian.jpg',
    notes: 'Premium decorative stone. Stunning in modern designs.',
  },
  {
    name: 'Black Granite Chips',
    category: 'Rock',
    subcategory: 'Decorative Chips',
    description: 'Dark granite decorative chips ¾"–1.5". Elegant dark grey-black stone for beds, paths, and accent areas.',
    unit: 'ton',
    unitAlt: '',
    costLow: 65,
    costHigh: 140,
    supplier: 'Outdoor Solutions',
    color: 'Dark Grey/Black',
    texture: 'Angular Chips',
    coveragePerUnit: '1 ton ≈ 80 sqft at 2" depth',
    image: 'black-granite-chips.jpg',
    notes: 'More subtle than obsidian. Clean look.',
  },
  {
    name: 'Midnight Chips',
    category: 'Rock',
    subcategory: 'Decorative Chips',
    description: 'Dark blue-black decorative stone chips. Unique color that shifts between blue and black in different lighting.',
    unit: 'ton',
    unitAlt: '',
    costLow: 70,
    costHigh: 150,
    supplier: 'Outdoor Solutions',
    color: 'Blue-Black',
    texture: 'Angular Chips',
    coveragePerUnit: '1 ton ≈ 80 sqft at 2" depth',
    image: 'midnight-chips.jpg',
    notes: 'Unique color. Great for accent areas.',
  },
  {
    name: 'Slate Chips',
    category: 'Rock',
    subcategory: 'Decorative Chips',
    description: 'Natural slate stone chips in mixed grey tones. Flat, angular pieces perfect for paths and contemporary ground cover.',
    unit: 'ton',
    unitAlt: '',
    costLow: 60,
    costHigh: 130,
    supplier: 'Outdoor Solutions',
    color: 'Grey/Blue',
    texture: 'Flat Angular',
    coveragePerUnit: '1 ton ≈ 90 sqft at 2" depth',
    image: 'Slate-Chips.jpg',
    notes: 'Popular for modern designs. Flat pieces.',
  },
  {
    name: 'Ozark River Chips',
    category: 'Rock',
    subcategory: 'Decorative Chips',
    description: 'Mixed-color Ozark river stone chips. Blend of warm earth tones from the Ozark region.',
    unit: 'ton',
    unitAlt: '',
    costLow: 55,
    costHigh: 120,
    supplier: 'Outdoor Solutions',
    color: 'Mixed Earth Tones',
    texture: 'Semi-Smooth Chips',
    coveragePerUnit: '1 ton ≈ 80 sqft at 2" depth',
    image: 'ozark-river-chips.jpg',
    notes: 'Good blend of colors. Ozark region stone.',
  },
  {
    name: 'Ozark Brown (Light)',
    category: 'Rock',
    subcategory: 'Crushed',
    description: 'Light tan-brown crushed Ozark stone. Warm neutral tones blend naturally with any landscape.',
    unit: 'ton',
    unitAlt: '',
    costLow: 45,
    costHigh: 100,
    supplier: 'Outdoor Solutions',
    color: 'Light Brown/Tan',
    texture: 'Crushed',
    coveragePerUnit: '1 ton ≈ 80 sqft at 2" depth',
    image: 'ozark-brown1.jpg',
    notes: 'Lighter shade. Natural look.',
  },
  {
    name: 'Ozark Brown (Dark)',
    category: 'Rock',
    subcategory: 'Crushed',
    description: 'Dark chocolate-brown crushed Ozark stone. Rich, warm tone for a refined natural look.',
    unit: 'ton',
    unitAlt: '',
    costLow: 45,
    costHigh: 100,
    supplier: 'Outdoor Solutions',
    color: 'Dark Brown',
    texture: 'Crushed',
    coveragePerUnit: '1 ton ≈ 80 sqft at 2" depth',
    image: 'ozark-brown2.jpg',
    notes: 'Darker shade. Richer tone than light variety.',
  },
  {
    name: 'Osage Buff',
    category: 'Rock',
    subcategory: 'Crushed',
    description: 'Warm buff/tan colored crushed limestone. Light, neutral tone that brightens landscape beds.',
    unit: 'ton',
    unitAlt: '',
    costLow: 45,
    costHigh: 100,
    supplier: 'Outdoor Solutions',
    color: 'Buff/Tan',
    texture: 'Crushed',
    coveragePerUnit: '1 ton ≈ 80 sqft at 2" depth',
    image: 'osage-buff.jpg',
    notes: 'Light color brightens shady areas.',
  },
  {
    name: 'Mesa Grey',
    category: 'Rock',
    subcategory: 'Crushed',
    description: 'Cool grey crushed stone. Clean, neutral look perfect for modern and minimalist landscapes.',
    unit: 'ton',
    unitAlt: '',
    costLow: 50,
    costHigh: 110,
    supplier: 'Outdoor Solutions',
    color: 'Grey',
    texture: 'Crushed',
    coveragePerUnit: '1 ton ≈ 80 sqft at 2" depth',
    image: 'mesa-grey.jpg',
    notes: 'Clean neutral grey. Very versatile.',
  },
  {
    name: 'Mountain Granite',
    category: 'Rock',
    subcategory: 'Crushed',
    description: 'Mixed grey-white granite crushed stone. Speckled natural granite with silver and white tones.',
    unit: 'ton',
    unitAlt: '',
    costLow: 55,
    costHigh: 120,
    supplier: 'Outdoor Solutions',
    color: 'Grey/White Speckled',
    texture: 'Crushed',
    coveragePerUnit: '1 ton ≈ 80 sqft at 2" depth',
    image: 'mountain-granite.jpg',
    notes: 'Natural granite appearance. Classic stone.',
  },
  {
    name: 'White Marble Chips',
    category: 'Rock',
    subcategory: 'Premium Stone',
    description: 'Bright white marble decorative chips. Premium stone that dramatically brightens any landscape area. Stunning contrast against dark mulch or foliage.',
    unit: 'ton',
    unitAlt: '',
    costLow: 100,
    costHigh: 220,
    supplier: 'Outdoor Solutions',
    color: 'White',
    texture: 'Angular Chips',
    coveragePerUnit: '1 ton ≈ 80 sqft at 2" depth',
    image: 'white-marble.jpg',
    notes: 'Premium. Very bright — can reflect heat. Great accents.',
    isFavorite: true,
  },
  {
    name: 'Rainbow Rock',
    category: 'Rock',
    subcategory: 'Decorative',
    description: 'Multi-colored decorative rock mix. Vibrant blend of red, brown, tan, and grey stones for colorful ground cover.',
    unit: 'ton',
    unitAlt: '',
    costLow: 60,
    costHigh: 130,
    supplier: 'Outdoor Solutions',
    color: 'Multi-Color',
    texture: 'Mixed',
    coveragePerUnit: '1 ton ≈ 80 sqft at 2" depth',
    image: 'rainbow-rock.jpg',
    notes: 'Fun colorful mix. Popular for residential.',
  },
  {
    name: 'Indian Sunset',
    category: 'Rock',
    subcategory: 'Decorative',
    description: 'Warm sunset-toned decorative rock. Beautiful blend of orange, red, and brown hues reminiscent of a sunset sky.',
    unit: 'ton',
    unitAlt: '',
    costLow: 60,
    costHigh: 130,
    supplier: 'Outdoor Solutions',
    color: 'Orange/Red/Brown',
    texture: 'Mixed',
    coveragePerUnit: '1 ton ≈ 80 sqft at 2" depth',
    image: 'indian-sunset.jpg',
    notes: 'Beautiful warm tones. Eye-catching.',
  },
  {
    name: 'Western Sunset',
    category: 'Rock',
    subcategory: 'Decorative',
    description: 'Warm desert-toned decorative rock. Blend of tan, coral, and rust colors inspired by western landscapes.',
    unit: 'ton',
    unitAlt: '',
    costLow: 60,
    costHigh: 130,
    supplier: 'Outdoor Solutions',
    color: 'Tan/Coral/Rust',
    texture: 'Mixed',
    coveragePerUnit: '1 ton ≈ 80 sqft at 2" depth',
    image: 'western-sunset.jpg',
    notes: 'Similar to Indian Sunset but more tan tones.',
  },
  {
    name: 'Cedar Creek',
    category: 'Rock',
    subcategory: 'Decorative',
    description: 'Warm brown creek stone blend. Mixed brown and tan tones reminiscent of a natural creek bed.',
    unit: 'ton',
    unitAlt: '',
    costLow: 55,
    costHigh: 115,
    supplier: 'Outdoor Solutions',
    color: 'Brown/Tan Mix',
    texture: 'Semi-Smooth',
    coveragePerUnit: '1 ton ≈ 80 sqft at 2" depth',
    image: 'cedar-creek.jpg',
    notes: 'Natural creek bed look.',
  },
  {
    name: 'Oak Creek',
    category: 'Rock',
    subcategory: 'Decorative',
    description: 'Rich brown and grey creek stone blend. Natural mixed tones for organic-looking landscapes.',
    unit: 'ton',
    unitAlt: '',
    costLow: 55,
    costHigh: 115,
    supplier: 'Outdoor Solutions',
    color: 'Brown/Grey Mix',
    texture: 'Semi-Smooth',
    coveragePerUnit: '1 ton ≈ 80 sqft at 2" depth',
    image: 'oak-creek.jpg',
    notes: 'Slightly different tone mix than Cedar Creek.',
  },
  {
    name: 'Shawnee Creek',
    category: 'Rock',
    subcategory: 'Decorative',
    description: 'Mixed earth-tone creek stone. Warm blend of natural creek bed colors for landscape features and borders.',
    unit: 'ton',
    unitAlt: '',
    costLow: 55,
    costHigh: 115,
    supplier: 'Outdoor Solutions',
    color: 'Mixed Earth Tones',
    texture: 'Semi-Smooth',
    coveragePerUnit: '1 ton ≈ 80 sqft at 2" depth',
    image: 'shawnee-creek.jpg',
    notes: 'Good creek bed blend.',
  },
  {
    name: 'Dakota Cobble',
    category: 'Rock',
    subcategory: 'Cobblestone',
    description: 'Natural Dakota cobblestone. Mixed tan and brown cobbles perfect for borders, edging, and rustic landscape accents.',
    unit: 'ton',
    unitAlt: '',
    costLow: 70,
    costHigh: 150,
    supplier: 'Outdoor Solutions',
    color: 'Tan/Brown',
    texture: 'Rounded',
    coveragePerUnit: '1 ton ≈ 40 sqft at 3" depth',
    image: 'dakota-cobble.jpg',
    notes: 'Great for borders and edging.',
  },
];

// ─── Main ────────────────────────────────────────────────────
async function main() {
  // Fetch existing org ID
  const { data: orgData } = await supabase.from('team_members').select('org_id').limit(1).single();
  if (!orgData) {
    console.error('No org found. Make sure you have at least one team member.');
    process.exit(1);
  }
  const orgId = orgData.org_id;
  console.log(`📦 Seeding catalog for org: ${orgId}`);
  console.log(`📷 Using images from bucket: "${BUCKET}"`);
  console.log(`🔢 ${CATALOG.length} materials to seed\n`);

  // Check for existing materials
  const { data: existing } = await supabase.from('materials').select('name').eq('org_id', orgId);
  const existingNames = new Set((existing || []).map(m => m.name));

  let inserted = 0;
  let skipped = 0;

  for (const item of CATALOG) {
    if (existingNames.has(item.name)) {
      console.log(`⏭️  Skipping "${item.name}" (already exists)`);
      skipped++;
      continue;
    }

    const imageUrl = getPublicUrl(item.image);

    const row = {
      org_id: orgId,
      name: item.name,
      category: item.category,
      subcategory: item.subcategory || null,
      description: item.description || null,
      unit: item.unit || 'cu yd',
      unit_alt: item.unitAlt || null,
      cost_low: item.costLow || 0,
      cost_high: item.costHigh || 0,
      supplier: item.supplier || null,
      image_url: imageUrl,
      image: imageUrl,
      color: item.color || null,
      texture: item.texture || null,
      coverage_per_unit: item.coveragePerUnit || null,
      notes: item.notes || null,
      is_favorite: item.isFavorite || false,
      sold_out: false,
      sort_order: inserted,
      last_price_check: new Date().toISOString(),
    };

    const { error } = await supabase.from('materials').insert(row);
    if (error) {
      console.error(`❌ Failed to insert "${item.name}":`, error.message);
    } else {
      console.log(`✅ Inserted "${item.name}" — ${item.category}/${item.subcategory || '-'}`);
      inserted++;
    }
  }

  console.log(`\n🎉 Done! Inserted: ${inserted}, Skipped: ${skipped}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
