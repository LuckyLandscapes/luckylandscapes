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
  { id: 'q1', quoteNumber: 1001, customerId: 'c1', status: 'accepted', category: 'Lawn Care', total: 1850, createdAt: '2025-10-01', items: [
    { name: 'Weekly Mowing (Season)', quantity: 1, unit: 'season', unitPrice: 1200, total: 1200 },
    { name: 'Seasonal Cleanup ×2', quantity: 2, unit: 'visit', unitPrice: 225, total: 450 },
    { name: 'Hedge Trimming', quantity: 1, unit: 'visit', unitPrice: 200, total: 200 },
  ]},
  { id: 'q2', quoteNumber: 1002, customerId: 'c2', status: 'accepted', category: 'Hardscaping', total: 4200, createdAt: '2025-11-10', items: [
    { name: 'Paver Patio (280 sqft)', quantity: 280, unit: 'sqft', unitPrice: 12, total: 3360 },
    { name: 'Polymeric Sand', quantity: 1, unit: 'bag', unitPrice: 40, total: 40 },
    { name: 'Base Material & Prep', quantity: 1, unit: 'lot', unitPrice: 800, total: 800 },
  ]},
  { id: 'q3', quoteNumber: 1003, customerId: 'c3', status: 'accepted', category: 'Garden & Beds', total: 780, createdAt: '2026-01-20', items: [
    { name: 'Premium Black Mulch', quantity: 6, unit: 'cu yd', unitPrice: 85, total: 510 },
    { name: 'Bed Edging', quantity: 45, unit: 'ft', unitPrice: 4, total: 180 },
    { name: 'Weed Barrier Fabric', quantity: 1, unit: 'roll', unitPrice: 90, total: 90 },
  ]},
  { id: 'q4', quoteNumber: 1004, customerId: 'c4', status: 'sent', category: 'Landscape Design', total: 8500, createdAt: '2026-04-01', items: [
    { name: 'Design Consultation & Plan', quantity: 1, unit: 'project', unitPrice: 500, total: 500 },
    { name: 'Front Yard Landscaping', quantity: 1, unit: 'project', unitPrice: 3500, total: 3500 },
    { name: 'Backyard Patio + Fire Pit', quantity: 1, unit: 'project', unitPrice: 4500, total: 4500 },
  ]},
  { id: 'q5', quoteNumber: 1005, customerId: 'c5', status: 'draft', category: 'Hardscaping', total: 3200, createdAt: '2026-04-10', items: [
    { name: 'Retaining Wall (30 ft, 3 ft high)', quantity: 90, unit: 'face ft', unitPrice: 30, total: 2700 },
    { name: 'Drainage System', quantity: 1, unit: 'lot', unitPrice: 500, total: 500 },
  ]},
];

const SEED_MATERIALS = [
  { id: 'm1', category: 'Mulch', name: 'Premium Black Mulch', description: 'Rich black dyed hardwood mulch. Most popular color choice.', unit: 'cu yd', costLow: 45, costHigh: 85, supplier: 'Midwest Mulch Supply', image: '🖤' },
  { id: 'm2', category: 'Mulch', name: 'Brown Mulch', description: 'Natural brown hardwood mulch. Classic, warm tone.', unit: 'cu yd', costLow: 40, costHigh: 75, supplier: 'Midwest Mulch Supply', image: '🤎' },
  { id: 'm3', category: 'Mulch', name: 'Red Cedar Mulch', description: 'Naturally aromatic cedar with rich red hue. Repels insects.', unit: 'cu yd', costLow: 55, costHigh: 95, supplier: 'Midwest Mulch Supply', image: '❤️' },
  { id: 'm4', category: 'Mulch', name: 'Cypress Mulch', description: 'Premium cypress blend. Long-lasting, natural blonde color.', unit: 'cu yd', costLow: 60, costHigh: 100, supplier: 'Midwest Mulch Supply', image: '💛' },
  { id: 'm5', category: 'Rock & Stone', name: 'River Rock (1-3")', description: 'Smooth, rounded river rock. Great for beds and drainage.', unit: 'ton', costLow: 120, costHigh: 280, supplier: 'Lincoln Landscape Supply', image: '🪨' },
  { id: 'm6', category: 'Rock & Stone', name: 'Limestone Gravel', description: 'Crushed limestone, great base material or decorative use.', unit: 'ton', costLow: 65, costHigh: 140, supplier: 'Lincoln Landscape Supply', image: '⬜' },
  { id: 'm7', category: 'Rock & Stone', name: 'Flagstone', description: 'Natural flagstone slabs for patios, walkways, and stepping stones.', unit: 'sqft', costLow: 4, costHigh: 12, supplier: 'Lincoln Landscape Supply', image: '🟫' },
  { id: 'm8', category: 'Pavers', name: 'Concrete Pavers', description: 'Standard interlocking concrete pavers. Available in multiple colors.', unit: 'sqft', costLow: 3, costHigh: 8, supplier: 'Belgard / Pavestone', image: '🧱' },
  { id: 'm9', category: 'Pavers', name: 'Brick Pavers', description: 'Classic clay brick pavers. Timeless look and extreme durability.', unit: 'sqft', costLow: 6, costHigh: 15, supplier: 'Pine Hall Brick', image: '🔴' },
  { id: 'm10', category: 'Pavers', name: 'Natural Stone Pavers', description: 'Premium bluestone or travertine pavers. High-end finish.', unit: 'sqft', costLow: 10, costHigh: 25, supplier: 'Various', image: '💎' },
  { id: 'm11', category: 'Edging', name: 'Vinyl Edging', description: 'Flexible vinyl landscape edging. Budget-friendly option.', unit: 'ft', costLow: 1, costHigh: 3, supplier: 'Various', image: '〰️' },
  { id: 'm12', category: 'Edging', name: 'Steel Edging', description: 'Professional-grade steel edging. Clean lines, very durable.', unit: 'ft', costLow: 3, costHigh: 6, supplier: 'Col-Met', image: '➖' },
  { id: 'm13', category: 'Edging', name: 'Aluminum Edging', description: 'Lightweight aluminum. Won\'t rust, easy to shape curves.', unit: 'ft', costLow: 3, costHigh: 7, supplier: 'Sure-Loc', image: '🔲' },
  { id: 'm14', category: 'Retaining Wall', name: 'Versa-Lok Block', description: 'Engineered retaining wall block. Standard for structural walls.', unit: 'face ft', costLow: 18, costHigh: 35, supplier: 'Versa-Lok', image: '🧊' },
  { id: 'm15', category: 'Retaining Wall', name: 'Natural Boulder', description: 'Large natural boulders for rustic retaining walls.', unit: 'ton', costLow: 200, costHigh: 500, supplier: 'Local Quarry', image: '🪨' },
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
