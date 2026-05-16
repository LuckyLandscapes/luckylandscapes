import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/stripeServer';

// One-time migration endpoint: copies the hardcoded static portfolio from
// the marketing site's projectData array into the marketing_gallery table.
// Each image in a multi-photo project becomes its own row (so a 6-photo
// "Lawn Maintenance" project ends up as 6 individual cards on the public
// site). Before/after pairs stay grouped (single row, two image URLs).
//
// Designed to be idempotent — re-running won't duplicate. We use a
// deterministic image_path key derived from the source URL, then upsert
// on conflict. Safe to call repeatedly.
//
// The image is fetched from luckylandscapes.com (where the optimized static
// version already lives), re-uploaded to the marketing-gallery Supabase
// bucket, and a row is inserted. Sequential with concurrency=4 so we
// don't slam either side or hit Vercel's function timeout.

const MARKETING_SITE_ORIGIN = 'https://luckylandscapes.com';
const TARGET_BUCKET = 'marketing-gallery';

// Mirror of the original static projectData in marketing/main.js. Each
// entry will become 1+ rows in marketing_gallery. Before/after pairs use
// `beforeAfter: true` and the first image becomes the "before".
const LEGACY_PORTFOLIO = [
  {
    title: 'Custom Built Deck',
    tag: 'Construction',
    extraTags: ['Outdoor Living'],
    desc: 'A custom built deck designed to extend this family\'s outdoor living space. We selected premium composite materials with a complementary border pattern, creating a durable and beautiful surface perfect for entertainment and relaxation.',
    images: ['/images/megandeck/1.webp', '/images/megandeck/2.webp'],
    featured: true,
  },
  {
    title: 'Retaining Walls',
    tag: 'Hardscaping',
    extraTags: ['Retaining Walls'],
    desc: 'We specialize in building strong, long-lasting retaining walls that solve drainage and erosion problems while looking great. Using high-quality materials and proven construction methods, we create retaining walls that protect your property and enhance its curb appeal.',
    images: [
      '/images/retainingwall/1-1.webp',
      '/images/retainingwall/1-2.webp',
      '/images/retainingwall/1-3.webp',
      '/images/retainingwall/1-4.webp',
      '/images/retainingwall/1-5.webp',
    ],
    featured: true,
  },
  {
    title: 'Lawn Maintenance',
    tag: 'Maintenance',
    extraTags: ['Lawn Care'],
    desc: 'Regular lawn maintenance to keep your lawn looking its best. Includes mowing, edging, trimming, blowing, and hedge trimming.',
    images: [
      '/images/lawncare/1.webp',
      '/images/lawncare/2.webp',
      '/images/lawncare/3.webp',
      '/images/lawncare/4.webp',
      '/images/lawncare/5.webp',
      '/images/lawncare/6.webp',
    ],
    featured: true,
  },
  {
    title: 'Fire Place',
    tag: 'Hardscaping',
    extraTags: ['Outdoor Living'],
    desc: 'A custom built fire place designed to extend this family\'s outdoor living space. We selected premium materials with a complementary border pattern, creating a durable and beautiful surface perfect for entertainment and relaxation.',
    images: ['/images/fireplace/1.jpg'],
    featured: true,
  },
  {
    title: 'Garden Bed',
    tag: 'Garden Beds',
    extraTags: ['Landscaping'],
    desc: 'A beautiful garden bed built to maximize outdoor living space. Featuring low-maintenance materials and a design that flows seamlessly from the home to the backyard.',
    images: ['/images/mulchgardenbeds/1.webp', '/images/mulchgardenbeds/2.jpg'],
    featured: true,
  },
  {
    title: 'Design & Build',
    tag: 'Landscaping',
    extraTags: ['Custom Build'],
    desc: 'Transforming outdoor spaces with thoughtful design and expert construction. From concept to completion, we create landscapes that enhance beauty and functionality.',
    images: [
      '/images/landscapedesign/3.webp',
      '/images/landscapedesign/1.webp',
      '/images/landscapedesign/2.webp',
    ],
    featured: true,
  },
  {
    title: 'Lawn Restoration',
    tag: 'Seasonal Cleanup',
    extraTags: ['Before & After', 'Lawn Care'],
    desc: 'A thorough lawn cleanup that removed weeds, debris, and overgrowth from the yard, leaving it looking fresh and inviting. See the dramatic before-and-after transformation.',
    beforeAfter: true,
    images: ['/images/LawnRestore/before.webp', '/images/LawnRestore/after.webp'],
    featured: true,
  },
  {
    title: 'Brick Garden Walls',
    tag: 'Hardscaping',
    extraTags: ['Garden Beds'],
    desc: 'This brick garden wall solved a significant grading challenge while adding striking visual appeal. Built with precision to withstand the elements and elevate the landscape.',
    images: [
      '/images/bricklaying/1.webp',
      '/images/bricklaying/2.webp',
      '/images/bricklaying/3.webp',
    ],
    featured: true,
  },
  {
    title: 'Front Yard Beds',
    tag: 'Landscaping',
    extraTags: ['Garden Beds'],
    desc: 'Complete front yard garden bed installation featuring fresh mulch, clean edging, and carefully selected plantings that bring year-round curb appeal.',
    images: [
      '/images/gardenbed/1.webp',
      '/images/gardenbed/2.webp',
      '/images/gardenbed/3.webp',
      '/images/gardenbed/4.webp',
    ],
    featured: true,
  },
];

// Slug a string into a path-safe segment so the legacy keys are stable
// across runs (no UUIDs — we want re-imports to hit the same key and skip).
function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function extFromUrl(url) {
  const m = url.match(/\.([a-z0-9]+)(?:\?|$)/i);
  return (m ? m[1] : 'jpg').toLowerCase();
}

function mediaTypeForExt(ext) {
  if (ext === 'webp') return 'image/webp';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'avif') return 'image/avif';
  return 'application/octet-stream';
}

// Async pool runner — concurrency-limited parallel execution. Keeps the
// Vercel function under its time budget for ~30 sequential fetches that
// would otherwise blow past 10s.
async function pool(items, limit, worker) {
  const results = [];
  const queue = items.slice();
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      results.push(await worker(item));
    }
  });
  await Promise.all(runners);
  return results;
}

export async function POST(request) {
  // Auth — Bearer token from Supabase session. Requires a real user.
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ error: 'missing_auth' }, { status: 401 });

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'db_not_configured' }, { status: 500 });

  const { data: authData, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authData?.user) {
    return NextResponse.json({ error: 'invalid_auth' }, { status: 401 });
  }

  // Resolve the user's org from team_members. The import targets that org.
  const { data: member, error: memberErr } = await supabase
    .from('team_members')
    .select('org_id, role')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (memberErr || !member?.org_id) {
    return NextResponse.json({ error: 'no_org' }, { status: 403 });
  }
  if (member.role !== 'owner' && member.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const orgId = member.org_id;

  // Find the current max sort_order so imported items append to the bottom
  // of whatever's already there (Riley's existing uploads stay where they are).
  const { data: maxRow } = await supabase
    .from('marketing_gallery')
    .select('sort_order')
    .eq('org_id', orgId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  let sortCursor = ((maxRow?.sort_order ?? -10) + 10);  // first imported = max + 10

  // Build the per-row plan up front so we can report exactly what we'll do.
  // Each row gets a unique sort_order spaced by 10 so the manage page's
  // drag-and-drop has room to drop between any pair without renumbering.
  // First photo of each multi-photo project is flagged as cover.
  const plan = [];
  for (const project of LEGACY_PORTFOLIO) {
    const projSlug = slug(project.title);
    const tags = [project.tag, ...(project.extraTags || [])].filter(Boolean);

    // For multi-photo projects we use project.title as the project_name so
    // they collapse back into one card on the public site. Single-photo
    // projects don't need a project_name (each is its own card anyway).
    // Before/after pairs are inherently single-card so no project_name needed.
    const groupName = (!project.beforeAfter && project.images.length > 1) ? project.title : null;

    if (project.beforeAfter && project.images.length === 2) {
      // Single row representing the before/after pair.
      const [beforeUrl, afterUrl] = project.images;
      plan.push({
        kind: 'pair',
        projSlug,
        title: project.title,
        description: project.desc,
        tags,
        featured: !!project.featured,
        projectName: null,
        isCover: false,  // standalone card; cover flag is moot
        sortOrder: sortCursor,
        mainSourceUrl: MARKETING_SITE_ORIGIN + afterUrl,
        beforeSourceUrl: MARKETING_SITE_ORIGIN + beforeUrl,
        mainKey: `${orgId}/legacy/${projSlug}/after.${extFromUrl(afterUrl)}`,
        beforeKey: `${orgId}/legacy/${projSlug}/before.${extFromUrl(beforeUrl)}`,
      });
      sortCursor += 10;
    } else {
      // Each image → its own row. Title becomes "<Project> #N" if >1 image,
      // else just the project title. The FIRST image in a multi-photo project
      // is flagged as the cover so it represents the project on the website.
      project.images.forEach((relUrl, idx) => {
        const ext = extFromUrl(relUrl);
        const photoSlug = slug(relUrl.split('/').pop().replace(/\.[^.]+$/, ''));
        const title = project.images.length > 1 ? `${project.title} #${idx + 1}` : project.title;
        plan.push({
          kind: 'single',
          projSlug,
          title,
          description: project.desc,
          tags,
          featured: !!project.featured,
          projectName: groupName,
          isCover: !!groupName && idx === 0,  // first photo of a grouped project = cover
          sortOrder: sortCursor,
          mainSourceUrl: MARKETING_SITE_ORIGIN + relUrl,
          mainKey: `${orgId}/legacy/${projSlug}/${photoSlug}.${ext}`,
        });
        sortCursor += 10;
      });
    }
  }

  // Skip rows that already exist (idempotency). We match on image_path.
  const allKeys = plan.map(p => p.mainKey);
  const { data: existing } = await supabase
    .from('marketing_gallery')
    .select('image_path')
    .in('image_path', allKeys);
  const existingKeys = new Set((existing || []).map(r => r.image_path).filter(Boolean));

  const remaining = plan.filter(p => !existingKeys.has(p.mainKey));

  // Fetch + upload + insert each row, with concurrency 4.
  const results = await pool(remaining, 4, async (item) => {
    try {
      // Main image
      const mainBuf = await fetchAsBuffer(item.mainSourceUrl);
      await supabase.storage
        .from(TARGET_BUCKET)
        .upload(item.mainKey, mainBuf, {
          contentType: mediaTypeForExt(extFromUrl(item.mainSourceUrl)),
          upsert: true,
          cacheControl: '31536000',
        });
      const { data: mainPub } = supabase.storage.from(TARGET_BUCKET).getPublicUrl(item.mainKey);

      let beforeUrl = null, beforePath = null;
      if (item.kind === 'pair') {
        const beforeBuf = await fetchAsBuffer(item.beforeSourceUrl);
        await supabase.storage
          .from(TARGET_BUCKET)
          .upload(item.beforeKey, beforeBuf, {
            contentType: mediaTypeForExt(extFromUrl(item.beforeSourceUrl)),
            upsert: true,
            cacheControl: '31536000',
          });
        const { data: beforePub } = supabase.storage.from(TARGET_BUCKET).getPublicUrl(item.beforeKey);
        beforeUrl = beforePub.publicUrl;
        beforePath = item.beforeKey;
      }

      const { error: insErr } = await supabase.from('marketing_gallery').insert({
        org_id: orgId,
        title: item.title,
        description: item.description || null,
        tags: item.tags,
        image_url: mainPub.publicUrl,
        image_path: item.mainKey,
        image_bytes: mainBuf.byteLength,
        before_image_url: beforeUrl,
        before_image_path: beforePath,
        is_published: true,
        is_featured: item.featured,
        is_cover: item.isCover,
        project_name: item.projectName,
        sort_order: item.sortOrder,
      });
      if (insErr) throw new Error(`insert: ${insErr.message}`);

      return { ok: true, key: item.mainKey, title: item.title };
    } catch (err) {
      return { ok: false, key: item.mainKey, title: item.title, error: err.message };
    }
  });

  const imported = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  const skipped = plan.length - remaining.length;

  // Ensure a marketing_categories row exists for every tag we just inserted.
  // Skipped photos already have categories from a prior run, so the union
  // of all tags across the plan is what we need. ON CONFLICT DO NOTHING via
  // .upsert with ignoreDuplicates=true so re-imports don't error.
  const allTags = Array.from(new Set(plan.flatMap(p => p.tags || [])));
  if (allTags.length) {
    const { error: catErr } = await supabase
      .from('marketing_categories')
      .upsert(
        allTags.map(name => ({
          org_id: orgId,
          name,
          // Imported categories stay hidden by default — same policy as the
          // 043 migration backfill. Riley enables what he wants in Manage
          // Categories.
          is_visible: false,
          sort_order: 0,
        })),
        { onConflict: 'org_id,name', ignoreDuplicates: true }
      );
    if (catErr) console.error('[import-legacy] category backfill failed', catErr);
  }

  return NextResponse.json({
    summary: { totalPlanned: plan.length, imported, skipped, failed: failed.length },
    failed,
  });
}

async function fetchAsBuffer(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  const arrayBuf = await res.arrayBuffer();
  return new Uint8Array(arrayBuf);
}
