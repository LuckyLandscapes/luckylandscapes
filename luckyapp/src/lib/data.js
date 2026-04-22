'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConnected } from './supabase';
import { useAuth } from './auth';

const DataContext = createContext(null);

// ---------- Default catalogs (used when seeding a new org) ----------
const DEFAULT_MATERIALS = [
  // MULCH
  { category: 'Mulch', name: 'Aromatic Cedar', description: 'Premium aromatic cedar mulch. Natural insect-repelling properties with a rich cedar scent.', unit: 'cu yd', cost_low: 55, cost_high: 55, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/cedar-mulch.jpg' },
  { category: 'Mulch', name: 'Black Mulch', description: 'Rich black dyed hardwood mulch. Most popular color choice.', unit: 'cu yd', cost_low: 45, cost_high: 45, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/black-mulch.jpg' },
  { category: 'Mulch', name: 'Brown Mulch', description: 'Natural brown hardwood mulch. Classic, warm tone.', unit: 'cu yd', cost_low: 45, cost_high: 45, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/brown-mulch.jpg' },
  { category: 'Mulch', name: 'Coffee Mulch', description: 'Rich coffee-colored hardwood mulch. Deep, warm aesthetic.', unit: 'cu yd', cost_low: 45, cost_high: 45, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/coffee-mulch.jpg' },
  { category: 'Mulch', name: 'Dark Hardwood', description: 'Natural dark hardwood mulch. Economical and long-lasting.', unit: 'cu yd', cost_low: 37, cost_high: 37, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/hardwood-mulch.jpg' },
  { category: 'Mulch', name: 'Nursery Mulch', description: 'Budget-friendly nursery grade mulch. Great for large coverage areas.', unit: 'cu yd', cost_low: 28, cost_high: 28, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/nursery-mulch.jpg' },
  // LANDSCAPE ROCK
  { category: 'Landscape Rock', name: 'Black Granite Chips', description: 'Sleek black granite chips. Modern, high-contrast look.', unit: 'ton', unit_alt: 'lb', cost_low: 0.102, cost_high: 204, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/black-granite-chips.jpg' },
  { category: 'Landscape Rock', name: 'Black Lava Rock', description: 'Lightweight volcanic lava rock. Excellent drainage and insulation.', unit: 'ton', unit_alt: 'lb', cost_low: 0.15, cost_high: 300, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/black-lava-rock.jpg' },
  { category: 'Landscape Rock', name: 'Black Obsidian', description: 'Dark glossy obsidian-style decorative rock.', unit: 'ton', unit_alt: 'lb', cost_low: 0.099, cost_high: 198, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/black-obsidian.jpg' },
  { category: 'Landscape Rock', name: 'Cedar Creek 2"', description: 'Natural earth-toned creek rock, 2 inch size.', unit: 'ton', unit_alt: 'lb', cost_low: 0.06, cost_high: 120, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/cedar-creek.jpg' },
  { category: 'Landscape Rock', name: 'Cherokee Red Large', description: 'Bold red decorative rock, large size.', unit: 'ton', unit_alt: 'lb', cost_low: 0.099, cost_high: 198, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/cherokee-red-large.jpg' },
  { category: 'Landscape Rock', name: 'Cherokee Red Small', description: 'Bold red decorative rock, small size.', unit: 'ton', unit_alt: 'lb', cost_low: 0.099, cost_high: 198, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/cherokee-red-small.jpg' },
  { category: 'Landscape Rock', name: 'Dakota Cobble 1½"x3"', description: 'Natural cobblestone, 1.5 to 3 inch size.', unit: 'ton', unit_alt: 'lb', cost_low: 0.0875, cost_high: 175, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/dakota-cobble.jpg' },
  { category: 'Landscape Rock', name: 'Indian Sunset', description: 'Warm sunset-toned decorative rock.', unit: 'ton', unit_alt: 'lb', cost_low: 0.099, cost_high: 198, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/indian-sunset.jpg' },
  { category: 'Landscape Rock', name: 'Mesa Grey 1-2"', description: 'Neutral grey decorative rock, 1-2 inch size.', unit: 'ton', unit_alt: 'lb', cost_low: 0.1075, cost_high: 215, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/mesa-grey.jpg' },
  { category: 'Landscape Rock', name: 'Mexican Beach Pebbles', description: 'Premium smooth black beach pebbles.', unit: 'ton', unit_alt: 'lb', cost_low: 0.33, cost_high: 660, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/mexican-beach-pebbles.jpg' },
  { category: 'Landscape Rock', name: 'Midnight Chips', description: 'Dark midnight-toned decorative chips.', unit: 'ton', unit_alt: 'lb', cost_low: 0.099, cost_high: 198, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/midnight-chips.jpg' },
  { category: 'Landscape Rock', name: 'Mountain Granite', description: 'Natural mountain granite. Durable and versatile.', unit: 'ton', unit_alt: 'lb', cost_low: 0.09, cost_high: 180, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/mountain-granite.jpg' },
  { category: 'Landscape Rock', name: 'Oak Creek 1"x2"', description: 'Warm-toned creek rock, 1-2 inch size.', unit: 'ton', unit_alt: 'lb', cost_low: 0.084, cost_high: 168, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/oak-creek.jpg' },
  { category: 'Landscape Rock', name: 'Osage Buff', description: 'Warm buff-colored decorative rock.', unit: 'ton', unit_alt: 'lb', cost_low: 0.08, cost_high: 160, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/osage-buff.jpg' },
  { category: 'Landscape Rock', name: 'Ozark Brown 1"', description: 'Rich brown Ozark rock, 1 inch size.', unit: 'ton', unit_alt: 'lb', cost_low: 0.081, cost_high: 162, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/ozark-brown1.jpg' },
  { category: 'Landscape Rock', name: 'Ozark Brown 2"', description: 'Rich brown Ozark rock, 2 inch size.', unit: 'ton', unit_alt: 'lb', cost_low: 0.09, cost_high: 180, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/ozark-brown2.jpg' },
  { category: 'Landscape Rock', name: 'Ozark River Chips', description: 'Natural river chip rock from the Ozarks.', unit: 'ton', unit_alt: 'lb', cost_low: 0.074, cost_high: 148, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/ozark-river-chips.jpg' },
  { category: 'Landscape Rock', name: 'Pawnee Red', description: 'Red decorative landscape rock.', unit: 'ton', unit_alt: 'lb', cost_low: 0.09, cost_high: 0, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/pawnee-red.jpg', sold_out: true },
  { category: 'Landscape Rock', name: 'Rainbow Rock', description: 'Multi-colored decorative landscape rock.', unit: 'ton', unit_alt: 'lb', cost_low: 0.09, cost_high: 0, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/rainbow-rock.jpg', sold_out: true },
  { category: 'Landscape Rock', name: 'River Cobbles', description: 'Smooth rounded river cobbles.', unit: 'ton', unit_alt: 'lb', cost_low: 0.059, cost_high: 118, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/river-cobbles.jpg' },
  { category: 'Landscape Rock', name: 'River Pebbles', description: 'Small smooth river pebbles.', unit: 'ton', unit_alt: 'lb', cost_low: 0.042, cost_high: 84, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/river-pebbles.jpg' },
  { category: 'Landscape Rock', name: 'River Rock', description: 'Smooth, rounded river rock.', unit: 'ton', unit_alt: 'lb', cost_low: 0.055, cost_high: 110, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/river-rock.jpg' },
  { category: 'Landscape Rock', name: 'Shawnee Creek 1"', description: 'Natural Shawnee creek rock, 1 inch size.', unit: 'ton', unit_alt: 'lb', cost_low: 0.081, cost_high: 162, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/shawnee-creek.jpg' },
  { category: 'Landscape Rock', name: 'Slate Chips', description: 'Flat slate chip rock. Premium decorative look.', unit: 'ton', unit_alt: 'lb', cost_low: 0.20, cost_high: 400, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/slate-chips.jpg' },
  { category: 'Landscape Rock', name: 'Western Sunset', description: 'Warm sunset-toned decorative rock.', unit: 'ton', unit_alt: 'lb', cost_low: 0.099, cost_high: 198, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/western-sunset.jpg' },
  { category: 'Landscape Rock', name: 'White Marble', description: 'Bright white marble decorative rock.', unit: 'ton', unit_alt: 'lb', cost_low: 0.20, cost_high: 400, supplier: 'Outdoor Solutions', image: 'https://sedomwhfewxnngpzmkay.supabase.co/storage/v1/object/public/Materials/white-marble.jpg' },
  // EDGING
  { category: 'Edging', name: 'Big Sky Saw Cut Edging', description: 'Premium saw-cut natural stone edging.', unit: 'ton', unit_alt: 'lb', cost_low: 0.26, cost_high: 520, supplier: 'Outdoor Solutions', image: '🪨' },
  { category: 'Edging', name: 'Black Hills Natural Edging', description: 'Natural Black Hills stone edging.', unit: 'ton', unit_alt: 'lb', cost_low: 0.1975, cost_high: 395, supplier: 'Outdoor Solutions', image: '⬛' },
  { category: 'Edging', name: 'Colorado Red Edging', description: 'Bold Colorado red stone edging.', unit: 'ton', unit_alt: 'lb', cost_low: 0.1875, cost_high: 375, supplier: 'Outdoor Solutions', image: '🔴' },
  { category: 'Edging', name: 'Cottonwood Tumbled Edging', description: 'Tumbled Cottonwood stone edging.', unit: 'ton', unit_alt: 'lb', cost_low: 0.2975, cost_high: 595, supplier: 'Outdoor Solutions', image: '🟤' },
  { category: 'Edging', name: 'EdgePro Prolip', description: 'Professional EdgePro Prolip landscape edging.', unit: 'each', cost_low: 20, cost_high: 20, supplier: 'Outdoor Solutions', image: '➖' },
  { category: 'Edging', name: 'EdgePro ProLip 90° Corner', description: 'EdgePro ProLip 90-degree corner piece.', unit: 'each', cost_low: 4, cost_high: 4, supplier: 'Outdoor Solutions', image: '📐' },
  { category: 'Edging', name: 'Foxglove Edging', description: 'Foxglove natural stone edging.', unit: 'ton', unit_alt: 'lb', cost_low: 0.1975, cost_high: 395, supplier: 'Outdoor Solutions', image: '🌸' },
  { category: 'Edging', name: 'Steel Edging', description: 'Professional-grade steel edging.', unit: 'each', cost_low: 30, cost_high: 30, supplier: 'Outdoor Solutions', image: '➖' },
  { category: 'Edging', name: 'White Marble Edging', description: 'Bright white marble stone edging.', unit: 'ton', unit_alt: 'lb', cost_low: 0.2725, cost_high: 545, supplier: 'Outdoor Solutions', image: '⬜' },
  { category: 'Edging', name: 'Windsor Saw Cut Edging', description: 'Windsor saw-cut stone edging.', unit: 'ton', unit_alt: 'lb', cost_low: 0.235, cost_high: 470, supplier: 'Outdoor Solutions', image: '🪨' },
  // PAVERS
  { category: 'Pavers', name: 'Concrete Pavers', description: 'Standard interlocking concrete pavers.', unit: 'sqft', cost_low: 3, cost_high: 8, supplier: 'Outdoor Solutions', image: '🧱' },
  { category: 'Pavers', name: 'Brick Pavers', description: 'Classic clay brick pavers.', unit: 'sqft', cost_low: 6, cost_high: 15, supplier: 'Outdoor Solutions', image: '🔴' },
  { category: 'Pavers', name: 'Natural Stone Pavers', description: 'Premium bluestone or travertine pavers.', unit: 'sqft', cost_low: 10, cost_high: 25, supplier: 'Outdoor Solutions', image: '💎' },
  // RETAINING WALL
  { category: 'Retaining Wall', name: 'Versa-Lok Block', description: 'Engineered retaining wall block.', unit: 'face ft', cost_low: 18, cost_high: 35, supplier: 'Outdoor Solutions', image: '🧊' },
  { category: 'Retaining Wall', name: 'Natural Boulder', description: 'Large natural boulders for rustic retaining walls.', unit: 'ton', cost_low: 200, cost_high: 500, supplier: 'Outdoor Solutions', image: '🪨' },
];

const DEFAULT_SERVICES = [
  { category: 'Lawn Care', name: 'Weekly Mowing', unit: 'visit', default_price: 45 },
  { category: 'Lawn Care', name: 'Bi-Weekly Mowing', unit: 'visit', default_price: 55 },
  { category: 'Lawn Care', name: 'Seasonal Cleanup', unit: 'visit', default_price: 225 },
  { category: 'Lawn Care', name: 'One-Time Leaf Removal', unit: 'visit', default_price: 175 },
  { category: 'Lawn Care', name: 'Hedge/Shrub Trimming', unit: 'visit', default_price: 200 },
  { category: 'Garden & Beds', name: 'Mulch (installed)', unit: 'cu yd', default_price: 85 },
  { category: 'Garden & Beds', name: 'Rock/Stone (installed)', unit: 'ton', default_price: 280 },
  { category: 'Garden & Beds', name: 'Bed Edging', unit: 'ft', default_price: 4 },
  { category: 'Garden & Beds', name: 'Plant Installation', unit: 'each', default_price: 45 },
  { category: 'Hardscaping', name: 'Concrete Pavers', unit: 'sqft', default_price: 12 },
  { category: 'Hardscaping', name: 'Natural Stone Pavers', unit: 'sqft', default_price: 22 },
  { category: 'Hardscaping', name: 'Retaining Wall', unit: 'face ft', default_price: 30 },
  { category: 'Hardscaping', name: 'Fire Pit', unit: 'project', default_price: 2500 },
  { category: 'Cleanup', name: 'Full Yard Cleanup', unit: 'project', default_price: 350 },
  { category: 'Cleanup', name: 'Junk Removal', unit: 'load', default_price: 250 },
  { category: 'Design', name: 'Design Consultation', unit: 'project', default_price: 500 },
  { category: 'Design', name: 'Full Landscape Design & Build', unit: 'project', default_price: 5000 },
];

// ---------- Supabase → camelCase mappers ----------
function mapCustomerFromDb(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    tags: row.tags || [],
    notes: row.notes,
    source: row.source,
    createdAt: row.created_at?.split('T')[0] || '',
  };
}

function mapQuoteFromDb(row) {
  return {
    id: row.id,
    quoteNumber: row.quote_number,
    customerId: row.customer_id,
    status: row.status,
    category: row.category,
    items: row.items || [],
    total: parseFloat(row.total) || 0,
    notes: row.notes,
    createdAt: row.created_at?.split('T')[0] || '',
  };
}

function mapActivityFromDb(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    quoteId: row.quote_id,
    type: row.type,
    title: row.title,
    description: row.description,
    createdAt: row.created_at || '',
  };
}

function mapTeamMemberFromDb(row) {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    avatarUrl: row.avatar_url,
    hourlyRate: parseFloat(row.hourly_rate) || 15,
    isActive: row.is_active,
    createdAt: row.created_at?.split('T')[0] || '',
  };
}

function mapTimeEntryFromDb(row) {
  return {
    id: row.id,
    orgId: row.org_id,
    memberId: row.member_id,
    jobId: row.job_id,
    clockIn: row.clock_in,
    clockOut: row.clock_out,
    durationMinutes: row.duration_minutes,
    notes: row.notes || '',
    createdAt: row.created_at || '',
  };
}

function mapMaterialFromDb(row) {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    description: row.description,
    unit: row.unit,
    unitAlt: row.unit_alt,
    costLow: parseFloat(row.cost_low) || 0,
    costHigh: parseFloat(row.cost_high) || 0,
    supplier: row.supplier,
    image: row.image,
    soldOut: row.sold_out || false,
  };
}

function mapServiceFromDb(row) {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    unit: row.unit,
    defaultPrice: parseFloat(row.default_price) || 0,
  };
}

function mapJobFromDb(row) {
  return {
    id: row.id,
    quoteId: row.quote_id,
    customerId: row.customer_id,
    title: row.title,
    status: row.status,
    description: row.description,
    address: row.address,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    estimatedDuration: row.estimated_duration,
    assignedTo: row.assigned_to || [],
    crewNotes: row.crew_notes,
    total: parseFloat(row.total) || 0,
    createdAt: row.created_at?.split('T')[0] || '',
  };
}

function mapCalendarEventFromDb(row) {
  return {
    id: row.id,
    jobId: row.job_id,
    quoteId: row.quote_id,
    customerId: row.customer_id,
    title: row.title,
    type: row.type,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    allDay: row.all_day,
    color: row.color,
    notes: row.notes,
    googleEventId: row.google_event_id,
    createdAt: row.created_at?.split('T')[0] || '',
  };
}

// ---------- Provider ----------
export function DataProvider({ children }) {
  const { user } = useAuth();
  const orgId = user?.orgId;

  const [customers, setCustomers] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [services, setServices] = useState([]);
  const [activity, setActivity] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // ---------- Load data from Supabase ----------
  useEffect(() => {
    if (!orgId || !isSupabaseConnected()) {
      setLoaded(true);
      return;
    }

    let cancelled = false;

    async function loadAll() {
      try {
        const [custRes, quoteRes, actRes, matRes, svcRes, teamRes, jobsRes, eventsRes, timeRes] = await Promise.all([
          supabase.from('customers').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
          supabase.from('quotes').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
          supabase.from('activity').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
          supabase.from('materials').select('*').eq('org_id', orgId).order('category').order('name'),
          supabase.from('services').select('*').eq('org_id', orgId).order('category').order('name'),
          supabase.from('team_members').select('*').eq('org_id', orgId).order('created_at', { ascending: true }),
          supabase.from('jobs').select('*').eq('org_id', orgId).order('scheduled_date', { ascending: true }),
          supabase.from('calendar_events').select('*').eq('org_id', orgId).order('date', { ascending: true }),
          supabase.from('time_entries').select('*').eq('org_id', orgId).order('clock_in', { ascending: false }).limit(500),
        ]);

        if (cancelled) return;

        setCustomers((custRes.data || []).map(mapCustomerFromDb));
        setQuotes((quoteRes.data || []).map(mapQuoteFromDb));
        setActivity((actRes.data || []).map(mapActivityFromDb));
        setMaterials((matRes.data || []).map(mapMaterialFromDb));
        setServices((svcRes.data || []).map(mapServiceFromDb));
        setTeamMembers((teamRes.data || []).map(mapTeamMemberFromDb));
        setJobs((jobsRes.data || []).map(mapJobFromDb));
        setCalendarEvents((eventsRes.data || []).map(mapCalendarEventFromDb));
        setTimeEntries((timeRes.data || []).map(mapTimeEntryFromDb));

        // Seed default catalogs if empty (first-time setup)
        if ((matRes.data || []).length === 0) {
          await seedMaterials(orgId);
        }
        if ((svcRes.data || []).length === 0) {
          await seedServices(orgId);
        }

        setLoaded(true);
      } catch (err) {
        console.error('Error loading data from Supabase:', err);
        setLoaded(true);
      }
    }

    loadAll();
    return () => { cancelled = true; };
  }, [orgId]);

  // ---------- Supabase Realtime Subscriptions ----------
  useEffect(() => {
    if (!orgId || !isSupabaseConnected()) return;

    // Helper: only process changes for our org
    const isOurs = (payload) => payload.new?.org_id === orgId || payload.old?.org_id === orgId;

    const channel = supabase
      .channel(`org-${orgId}-realtime`)
      // --- Calendar Events ---
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calendar_events' }, (payload) => {
        if (!isOurs(payload)) return;
        setCalendarEvents(prev => {
          if (prev.some(e => e.id === payload.new.id)) return prev;
          return [...prev, mapCalendarEventFromDb(payload.new)];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calendar_events' }, (payload) => {
        if (!isOurs(payload)) return;
        setCalendarEvents(prev => prev.map(e => e.id === payload.new.id ? mapCalendarEventFromDb(payload.new) : e));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'calendar_events' }, (payload) => {
        if (!isOurs(payload)) return;
        setCalendarEvents(prev => prev.filter(e => e.id !== payload.old.id));
      })
      // --- Jobs ---
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jobs' }, (payload) => {
        if (!isOurs(payload)) return;
        setJobs(prev => {
          if (prev.some(j => j.id === payload.new.id)) return prev;
          return [...prev, mapJobFromDb(payload.new)];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs' }, (payload) => {
        if (!isOurs(payload)) return;
        setJobs(prev => prev.map(j => j.id === payload.new.id ? mapJobFromDb(payload.new) : j));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'jobs' }, (payload) => {
        if (!isOurs(payload)) return;
        setJobs(prev => prev.filter(j => j.id !== payload.old.id));
      })
      // --- Customers ---
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'customers' }, (payload) => {
        if (!isOurs(payload)) return;
        setCustomers(prev => {
          if (prev.some(c => c.id === payload.new.id)) return prev;
          return [mapCustomerFromDb(payload.new), ...prev];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'customers' }, (payload) => {
        if (!isOurs(payload)) return;
        setCustomers(prev => prev.map(c => c.id === payload.new.id ? mapCustomerFromDb(payload.new) : c));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'customers' }, (payload) => {
        if (!isOurs(payload)) return;
        setCustomers(prev => prev.filter(c => c.id !== payload.old.id));
      })
      // --- Quotes ---
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quotes' }, (payload) => {
        if (!isOurs(payload)) return;
        setQuotes(prev => {
          if (prev.some(q => q.id === payload.new.id)) return prev;
          return [mapQuoteFromDb(payload.new), ...prev];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'quotes' }, (payload) => {
        if (!isOurs(payload)) return;
        setQuotes(prev => prev.map(q => q.id === payload.new.id ? mapQuoteFromDb(payload.new) : q));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'quotes' }, (payload) => {
        if (!isOurs(payload)) return;
        setQuotes(prev => prev.filter(q => q.id !== payload.old.id));
      })
      // --- Activity ---
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity' }, (payload) => {
        if (!isOurs(payload)) return;
        setActivity(prev => {
          if (prev.some(a => a.id === payload.new.id)) return prev;
          return [mapActivityFromDb(payload.new), ...prev];
        });
      })
      // --- Time Entries ---
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'time_entries' }, (payload) => {
        if (!isOurs(payload)) return;
        setTimeEntries(prev => {
          if (prev.some(t => t.id === payload.new.id)) return prev;
          return [mapTimeEntryFromDb(payload.new), ...prev];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'time_entries' }, (payload) => {
        if (!isOurs(payload)) return;
        setTimeEntries(prev => prev.map(t => t.id === payload.new.id ? mapTimeEntryFromDb(payload.new) : t));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'time_entries' }, (payload) => {
        if (!isOurs(payload)) return;
        setTimeEntries(prev => prev.filter(t => t.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId]);

  // ---------- Seed helpers ----------
  async function seedMaterials(oid) {
    const rows = DEFAULT_MATERIALS.map(m => ({ ...m, org_id: oid }));
    const { data, error } = await supabase.from('materials').insert(rows).select();
    if (!error && data) setMaterials(data.map(mapMaterialFromDb));
  }

  async function seedServices(oid) {
    const rows = DEFAULT_SERVICES.map(s => ({ ...s, org_id: oid }));
    const { data, error } = await supabase.from('services').insert(rows).select();
    if (!error && data) setServices(data.map(mapServiceFromDb));
  }

  // ---------- Customer CRUD ----------
  const addCustomer = useCallback(async (customer) => {
    if (!orgId) return null;
    const row = {
      org_id: orgId,
      first_name: customer.firstName,
      last_name: customer.lastName || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      zip: customer.zip || '',
      tags: customer.tags || ['lead'],
      notes: customer.notes || '',
      source: 'manual',
    };

    const { data, error } = await supabase.from('customers').insert(row).select().single();
    if (error) { console.error('Error adding customer:', error); return null; }

    const mapped = mapCustomerFromDb(data);
    setCustomers(prev => [mapped, ...prev]);

    // Log activity
    await addActivity({
      customerId: mapped.id,
      type: 'customer_added',
      title: `${mapped.firstName} ${mapped.lastName || ''} added`,
      description: 'New customer created',
    });

    return mapped;
  }, [orgId]);

  const updateCustomer = useCallback(async (id, updates) => {
    const dbUpdates = {};
    if (updates.firstName !== undefined) dbUpdates.first_name = updates.firstName;
    if (updates.lastName !== undefined) dbUpdates.last_name = updates.lastName;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.address !== undefined) dbUpdates.address = updates.address;
    if (updates.city !== undefined) dbUpdates.city = updates.city;
    if (updates.state !== undefined) dbUpdates.state = updates.state;
    if (updates.zip !== undefined) dbUpdates.zip = updates.zip;
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    // Optimistic update
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));

    const { error } = await supabase.from('customers').update(dbUpdates).eq('id', id);
    if (error) console.error('Error updating customer:', error);
  }, []);

  const deleteCustomer = useCallback(async (id) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) console.error('Error deleting customer:', error);
  }, []);

  // ---------- Quote CRUD ----------
  const addQuote = useCallback(async (quote) => {
    if (!orgId) return null;

    // Get next quote number
    const maxNum = quotes.reduce((max, q) => Math.max(max, q.quoteNumber || 0), 1000);
    const quoteNumber = maxNum + 1;

    const row = {
      org_id: orgId,
      customer_id: quote.customerId || null,
      quote_number: quoteNumber,
      status: 'draft',
      category: quote.category || '',
      items: quote.items || [],
      total: quote.total || 0,
      notes: quote.notes || '',
    };

    const { data, error } = await supabase.from('quotes').insert(row).select().single();
    if (error) { console.error('Error adding quote:', error); return null; }

    const mapped = mapQuoteFromDb(data);
    setQuotes(prev => [mapped, ...prev]);

    await addActivity({
      customerId: mapped.customerId,
      quoteId: mapped.id,
      type: 'quote_created',
      title: `Quote #${mapped.quoteNumber} created`,
      description: `${mapped.category} — $${mapped.total?.toLocaleString()}`,
    });

    return mapped;
  }, [orgId, quotes]);

  const updateQuote = useCallback(async (id, updates) => {
    const dbUpdates = {};
    if (updates.customerId !== undefined) dbUpdates.customer_id = updates.customerId;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.items !== undefined) dbUpdates.items = updates.items;
    if (updates.total !== undefined) dbUpdates.total = updates.total;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    // Optimistic update
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));

    const { error } = await supabase.from('quotes').update(dbUpdates).eq('id', id);
    if (error) console.error('Error updating quote:', error);
  }, []);

  const deleteQuote = useCallback(async (id) => {
    setQuotes(prev => prev.filter(q => q.id !== id));
    const { error } = await supabase.from('quotes').delete().eq('id', id);
    if (error) console.error('Error deleting quote:', error);
  }, []);

  // ---------- Activity ----------
  // ---------- Team Members ----------
  const loadTeamMembers = useCallback(async () => {
    if (!orgId || !isSupabaseConnected()) return;
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true });
    if (data) setTeamMembers(data.map(mapTeamMemberFromDb));
  }, [orgId]);

  const updateTeamMember = useCallback(async (id, updates) => {
    const dbUpdates = {};
    if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.hourlyRate !== undefined) dbUpdates.hourly_rate = updates.hourlyRate;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

    setTeamMembers(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    const { error } = await supabase.from('team_members').update(dbUpdates).eq('id', id);
    if (error) console.error('Error updating team member:', error);
  }, []);

  const addActivity = useCallback(async (entry) => {
    if (!orgId) return;
    const row = {
      org_id: orgId,
      customer_id: entry.customerId || null,
      quote_id: entry.quoteId || null,
      type: entry.type,
      title: entry.title,
      description: entry.description || '',
    };

    const { data, error } = await supabase.from('activity').insert(row).select().single();
    if (error) { console.error('Error adding activity:', error); return; }

    const mapped = mapActivityFromDb(data);
    setActivity(prev => [mapped, ...prev]);
  }, [orgId]);

  // ---------- Time Entry CRUD (Clock In/Out) ----------
  const clockIn = useCallback(async (memberId, jobId = null) => {
    if (!orgId) return null;
    const row = {
      org_id: orgId,
      member_id: memberId,
      job_id: jobId,
      clock_in: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('time_entries').insert(row).select().single();
    if (error) { console.error('Error clocking in:', error); return null; }

    const mapped = mapTimeEntryFromDb(data);
    setTimeEntries(prev => [mapped, ...prev]);
    return mapped;
  }, [orgId]);

  const clockOut = useCallback(async (entryId, notes = '') => {
    const now = new Date();
    const entry = timeEntries.find(t => t.id === entryId);
    const durationMinutes = entry
      ? Math.round((now - new Date(entry.clockIn)) / 60000)
      : null;

    const dbUpdates = {
      clock_out: now.toISOString(),
      duration_minutes: durationMinutes,
      notes: notes || '',
    };

    setTimeEntries(prev => prev.map(t =>
      t.id === entryId ? { ...t, clockOut: now.toISOString(), durationMinutes, notes } : t
    ));

    const { error } = await supabase.from('time_entries').update(dbUpdates).eq('id', entryId);
    if (error) console.error('Error clocking out:', error);
  }, [timeEntries]);

  const updateTimeEntry = useCallback(async (id, updates) => {
    const dbUpdates = {};
    if (updates.clockIn !== undefined) dbUpdates.clock_in = updates.clockIn;
    if (updates.clockOut !== undefined) dbUpdates.clock_out = updates.clockOut;
    if (updates.durationMinutes !== undefined) dbUpdates.duration_minutes = updates.durationMinutes;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.jobId !== undefined) dbUpdates.job_id = updates.jobId;

    setTimeEntries(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    const { error } = await supabase.from('time_entries').update(dbUpdates).eq('id', id);
    if (error) console.error('Error updating time entry:', error);
  }, []);

  const deleteTimeEntry = useCallback(async (id) => {
    setTimeEntries(prev => prev.filter(t => t.id !== id));
    const { error } = await supabase.from('time_entries').delete().eq('id', id);
    if (error) console.error('Error deleting time entry:', error);
  }, []);

  // Get the currently active (open) time entry for a member
  const getActiveTimeEntry = useCallback((memberId) => {
    return timeEntries.find(t => t.memberId === memberId && !t.clockOut);
  }, [timeEntries]);

  // Get time entries for a specific member
  const getMemberTimeEntries = useCallback((memberId, days = 30) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return timeEntries.filter(t =>
      t.memberId === memberId && new Date(t.clockIn) >= cutoff
    );
  }, [timeEntries]);

  // ---------- Job CRUD ----------
  const addJob = useCallback(async (job) => {
    if (!orgId) return null;
    const row = {
      org_id: orgId,
      quote_id: job.quoteId || null,
      customer_id: job.customerId || null,
      title: job.title,
      status: job.status || 'scheduled',
      description: job.description || '',
      address: job.address || '',
      scheduled_date: job.scheduledDate || null,
      scheduled_time: job.scheduledTime || null,
      estimated_duration: job.estimatedDuration || '4 hours',
      assigned_to: job.assignedTo || [],
      crew_notes: job.crewNotes || '',
      total: job.total || 0,
    };

    const { data, error } = await supabase.from('jobs').insert(row).select().single();
    if (error) { console.error('Error adding job:', error); return null; }

    const mapped = mapJobFromDb(data);
    setJobs(prev => [mapped, ...prev]);

    await addActivity({
      customerId: mapped.customerId,
      type: 'job_scheduled',
      title: `Job scheduled: ${mapped.title}`,
      description: `Scheduled for ${mapped.scheduledDate}`,
    });

    return mapped;
  }, [orgId]);

  const updateJob = useCallback(async (id, updates) => {
    const dbUpdates = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.address !== undefined) dbUpdates.address = updates.address;
    if (updates.scheduledDate !== undefined) dbUpdates.scheduled_date = updates.scheduledDate;
    if (updates.scheduledTime !== undefined) dbUpdates.scheduled_time = updates.scheduledTime;
    if (updates.estimatedDuration !== undefined) dbUpdates.estimated_duration = updates.estimatedDuration;
    if (updates.assignedTo !== undefined) dbUpdates.assigned_to = updates.assignedTo;
    if (updates.crewNotes !== undefined) dbUpdates.crew_notes = updates.crewNotes;
    if (updates.total !== undefined) dbUpdates.total = updates.total;

    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...updates } : j));
    const { error } = await supabase.from('jobs').update(dbUpdates).eq('id', id);
    if (error) console.error('Error updating job:', error);
  }, []);

  const deleteJob = useCallback(async (id) => {
    setJobs(prev => prev.filter(j => j.id !== id));
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (error) console.error('Error deleting job:', error);
  }, []);

  // ---------- Calendar Event CRUD ----------
  const addCalendarEvent = useCallback(async (event) => {
    if (!orgId) return null;
    const row = {
      org_id: orgId,
      job_id: event.jobId || null,
      quote_id: event.quoteId || null,
      customer_id: event.customerId || null,
      title: event.title,
      type: event.type || 'other',
      date: event.date,
      start_time: event.startTime || null,
      end_time: event.endTime || null,
      all_day: event.allDay || false,
      color: event.color || '#3a9c4a',
      notes: event.notes || '',
    };

    const { data, error } = await supabase.from('calendar_events').insert(row).select().single();
    if (error) { console.error('Error adding calendar event:', error); return null; }

    const mapped = mapCalendarEventFromDb(data);
    setCalendarEvents(prev => [...prev, mapped]);
    return mapped;
  }, [orgId]);

  const updateCalendarEvent = useCallback(async (id, updates) => {
    const dbUpdates = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime;
    if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime;
    if (updates.allDay !== undefined) dbUpdates.all_day = updates.allDay;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.googleEventId !== undefined) dbUpdates.google_event_id = updates.googleEventId;

    setCalendarEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    const { error } = await supabase.from('calendar_events').update(dbUpdates).eq('id', id);
    if (error) console.error('Error updating calendar event:', error);
  }, []);

  const deleteCalendarEvent = useCallback(async (id) => {
    setCalendarEvents(prev => prev.filter(e => e.id !== id));
    const { error } = await supabase.from('calendar_events').delete().eq('id', id);
    if (error) console.error('Error deleting calendar event:', error);
  }, []);

  // ---------- Quote → Job Conversion ----------
  const convertQuoteToJob = useCallback(async ({ quoteId, scheduledDate, scheduledTime, crewNotes, assignedTo }) => {
    const quote = quotes.find(q => q.id === quoteId);
    if (!quote) return null;
    const customer = customers.find(c => c.id === quote.customerId);

    const jobTitle = `${quote.category || 'Job'} — ${customer ? `${customer.firstName} ${customer.lastName || ''}`.trim() : 'Unknown Customer'}`;

    const job = await addJob({
      quoteId,
      customerId: quote.customerId,
      title: jobTitle,
      description: (quote.items || []).map(i => `${i.name} (${i.quantity} ${i.unit})`).join('\n'),
      address: customer?.address ? `${customer.address}, ${customer.city || ''} ${customer.state || ''} ${customer.zip || ''}`.trim() : '',
      scheduledDate,
      scheduledTime: scheduledTime || '08:00',
      estimatedDuration: '4 hours',
      assignedTo: assignedTo || [],
      crewNotes: crewNotes || '',
      total: quote.total,
    });

    if (!job) return null;

    // Create corresponding calendar event
    await addCalendarEvent({
      jobId: job.id,
      quoteId,
      customerId: quote.customerId,
      title: jobTitle,
      type: 'job',
      date: scheduledDate,
      startTime: scheduledTime || '08:00',
      endTime: null,
      color: '#3a9c4a',
      notes: crewNotes || '',
    });

    return job;
  }, [quotes, customers, addJob, addCalendarEvent]);

  // ---------- Helpers ----------
  const getCustomer = useCallback((id) => customers.find(c => c.id === id), [customers]);
  const getQuote = useCallback((id) => quotes.find(q => q.id === id), [quotes]);
  const getJob = useCallback((id) => jobs.find(j => j.id === id), [jobs]);
  const getCustomerQuotes = useCallback((customerId) => quotes.filter(q => q.customerId === customerId), [quotes]);
  const getCustomerActivity = useCallback((customerId) => activity.filter(a => a.customerId === customerId), [activity]);
  const getEventsByDate = useCallback((date) => calendarEvents.filter(e => e.date === date), [calendarEvents]);
  const getJobsByDate = useCallback((date) => jobs.filter(j => j.scheduledDate === date), [jobs]);

  // Get jobs assigned to a specific team member
  const getMyJobs = useCallback((memberId) => {
    return jobs.filter(j => (j.assignedTo || []).includes(memberId));
  }, [jobs]);

  const value = {
    customers, quotes, materials, services, activity, teamMembers, jobs, calendarEvents, timeEntries, loaded,
    addCustomer, updateCustomer, deleteCustomer,
    addQuote, updateQuote, deleteQuote,
    addJob, updateJob, deleteJob,
    addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
    convertQuoteToJob,
    addActivity,
    getCustomer, getQuote, getJob, getCustomerQuotes, getCustomerActivity,
    getEventsByDate, getJobsByDate,
    loadTeamMembers, updateTeamMember,
    clockIn, clockOut, updateTimeEntry, deleteTimeEntry,
    getActiveTimeEntry, getMemberTimeEntries, getMyJobs,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
