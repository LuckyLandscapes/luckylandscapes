'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConnected } from './supabase';
import { useAuth } from './auth';
import { jobFinancials as computeJobFinancials, buildPnL as computeBuildPnL, buildARAging as computeARAging } from './finance';

const DataContext = createContext(null);

// URL-safe random token (hex) for public invoice payment links.
// Fail closed: refuse to generate a token if a CSPRNG is unavailable rather
// than silently fall back to Math.random (which only has ~53 bits of entropy
// and would weaken every payment link).
function makeUrlSafeToken(bytes = 18) {
  // Browser path
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const arr = new Uint8Array(bytes);
    window.crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Server path (Node/edge runtime)
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const arr = new Uint8Array(bytes);
    globalThis.crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  throw new Error('No CSPRNG available — cannot mint public token securely');
}

// ─── Snake ↔ Camel helpers ───────────────────────────────────
function snakeToCamel(obj) {
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (obj === null || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) ? snakeToCamel(v) : v;
  }
  return out;
}

function camelToSnake(obj) {
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  if (obj === null || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const snake = k.replace(/([A-Z])/g, '_$1').toLowerCase();
    out[snake] = v;
  }
  return out;
}

// ─── LocalStorage helpers (demo mode) ───────────────────────
function loadLocal(key, fallback = []) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(`lucky_${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveLocal(key, data) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`lucky_${key}`, JSON.stringify(data));
}

// ─── DataProvider ───────────────────────────────────────────
export function DataProvider({ children }) {
  const { user } = useAuth();
  const orgId = user?.orgId;
  const connected = isSupabaseConnected() && !!orgId;

  // State
  const [customers, setCustomers] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [timeSegments, setTimeSegments] = useState([]);
  const [jobMedia, setJobMedia] = useState([]);
  const [quoteMedia, setQuoteMedia] = useState([]);
  const [jobExpenses, setJobExpenses] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [services, setServices] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [companyExpenses, setCompanyExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [mileageEntries, setMileageEntries] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);

  // ─── Fetch all data ─────────────────────────────────────
  useEffect(() => {
    if (!orgId) { setLoading(false); return; }

    if (connected) {
      fetchAllFromSupabase();
      const unsub = subscribeRealtime();
      // Re-fetch when the tab becomes visible again. This fixes stale state
      // after the worker hands their phone to a customer to sign a contract
      // in-person on /sign/[token] — that route is outside the dashboard
      // layout, so realtime is briefly torn down. On return we want fresh data
      // immediately rather than waiting for the next realtime ping.
      const onVisible = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          fetchAllFromSupabase();
        }
      };
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', onVisible);
      }
      return () => {
        unsub?.();
        if (typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', onVisible);
        }
      };
    } else {
      // Demo mode — load from localStorage
      setCustomers(loadLocal('customers'));
      setQuotes(loadLocal('quotes'));
      setJobs(loadLocal('jobs'));
      setCalendarEvents(loadLocal('calendar_events'));
      setTeamMembers(loadLocal('team_members'));
      setActivity(loadLocal('activity'));
      setTimeEntries(loadLocal('time_entries'));
      setTimeSegments(loadLocal('time_segments'));
      setJobMedia(loadLocal('job_media'));
      setQuoteMedia(loadLocal('quote_media'));
      setJobExpenses(loadLocal('job_expenses'));
      setMaterials(loadLocal('materials'));
      setServices(loadLocal('services'));
      setInvoices(loadLocal('invoices'));
      setCompanyExpenses(loadLocal('company_expenses'));
      setPayments(loadLocal('payments'));
      setContracts(loadLocal('contracts'));
      setMileageEntries(loadLocal('mileage_entries'));
      setContractors(loadLocal('contractors'));
      setLoading(false);
    }
  }, [orgId, connected]);

  // ─── Supabase fetchers ──────────────────────────────────
  async function fetchAllFromSupabase() {
    setLoading(true);
    try {
      const [cust, quot, jb, cal, team, act, te, jexp, mat, svc, inv, jmed, cexp, pay, qmed, tseg, ctr, mile, cntr] = await Promise.all([
        supabase.from('customers').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('quotes').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('jobs').select('*').eq('org_id', orgId).order('scheduled_date', { ascending: true }),
        supabase.from('calendar_events').select('*').eq('org_id', orgId).order('date', { ascending: true }),
        supabase.from('team_members').select('*').eq('org_id', orgId),
        supabase.from('activity').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(50),
        supabase.from('time_entries').select('*').eq('org_id', orgId).order('clock_in', { ascending: false }).limit(1000),
        supabase.from('job_expenses').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('materials').select('*').eq('org_id', orgId).order('category', { ascending: true }),
        supabase.from('services').select('*').eq('org_id', orgId).order('category', { ascending: true }).then(r => r).catch(() => ({ data: null })),
        supabase.from('invoices').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).then(r => r).catch(() => ({ data: null })),
        supabase.from('job_media').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).then(r => r).catch(() => ({ data: null })),
        supabase.from('company_expenses').select('*').eq('org_id', orgId).order('date', { ascending: false }).then(r => r).catch(() => ({ data: null })),
        supabase.from('payments').select('*').eq('org_id', orgId).order('paid_at', { ascending: false }).then(r => r).catch(() => ({ data: null })),
        supabase.from('quote_media').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).then(r => r).catch(() => ({ data: null })),
        supabase.from('time_segments').select('*').eq('org_id', orgId).order('started_at', { ascending: false }).limit(2000).then(r => r).catch(() => ({ data: null })),
        supabase.from('contracts').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).then(r => r).catch(() => ({ data: null })),
        supabase.from('mileage_entries').select('*').eq('org_id', orgId).order('date', { ascending: false }).then(r => r).catch(() => ({ data: null })),
        supabase.from('contractors').select('*').eq('org_id', orgId).order('contact_name', { ascending: true }).then(r => r).catch(() => ({ data: null })),
      ]);

      if (cust.data) setCustomers(snakeToCamel(cust.data));
      if (quot.data) setQuotes(snakeToCamel(quot.data));
      if (jb.data) setJobs(snakeToCamel(jb.data));
      if (cal.data) setCalendarEvents(snakeToCamel(cal.data));
      if (team.data) setTeamMembers(snakeToCamel(team.data));
      if (act.data) setActivity(snakeToCamel(act.data));
      if (te.data) setTimeEntries(snakeToCamel(te.data).map(t => ({ ...t, teamMemberId: t.memberId || t.teamMemberId })));
      if (jexp.data) setJobExpenses(snakeToCamel(jexp.data));
      if (mat.data) setMaterials(snakeToCamel(mat.data));
      if (svc?.data) setServices(snakeToCamel(svc.data));
      if (inv?.data) setInvoices(snakeToCamel(inv.data));
      if (jmed?.data) setJobMedia(snakeToCamel(jmed.data));
      if (cexp?.data) setCompanyExpenses(snakeToCamel(cexp.data));
      if (pay?.data) setPayments(snakeToCamel(pay.data));
      if (qmed?.data) setQuoteMedia(snakeToCamel(qmed.data));
      if (tseg?.data) setTimeSegments(snakeToCamel(tseg.data));
      if (ctr?.data) setContracts(snakeToCamel(ctr.data));
      if (mile?.data) setMileageEntries(snakeToCamel(mile.data));
      if (cntr?.data) setContractors(snakeToCamel(cntr.data));
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }

  // ─── Realtime subscriptions ─────────────────────────────
  function subscribeRealtime() {
    if (!supabase) return () => {};

    const channel = supabase
      .channel('data-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        supabase.from('jobs').select('*').eq('org_id', orgId).order('scheduled_date', { ascending: true })
          .then(({ data }) => { if (data) setJobs(snakeToCamel(data)); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => {
        supabase.from('calendar_events').select('*').eq('org_id', orgId).order('date', { ascending: true })
          .then(({ data }) => { if (data) setCalendarEvents(snakeToCamel(data)); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => {
        supabase.from('customers').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
          .then(({ data }) => { if (data) setCustomers(snakeToCamel(data)); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, () => {
        supabase.from('team_members').select('*').eq('org_id', orgId)
          .then(({ data }) => { if (data) setTeamMembers(snakeToCamel(data)); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_media' }, () => {
        supabase.from('job_media').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
          .then(({ data }) => { if (data) setJobMedia(snakeToCamel(data)); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_expenses' }, () => {
        supabase.from('job_expenses').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
          .then(({ data }) => { if (data) setJobExpenses(snakeToCamel(data)); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'materials' }, () => {
        supabase.from('materials').select('*').eq('org_id', orgId).order('category', { ascending: true })
          .then(({ data }) => { if (data) setMaterials(snakeToCamel(data)); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, () => {
        supabase.from('quotes').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
          .then(({ data }) => { if (data) setQuotes(snakeToCamel(data)); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, () => {
        supabase.from('time_entries').select('*').eq('org_id', orgId).order('clock_in', { ascending: false }).limit(1000)
          .then(({ data }) => { if (data) setTimeEntries(snakeToCamel(data).map(t => ({ ...t, teamMemberId: t.memberId || t.teamMemberId }))); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_segments' }, () => {
        supabase.from('time_segments').select('*').eq('org_id', orgId).order('started_at', { ascending: false }).limit(2000)
          .then(({ data }) => { if (data) setTimeSegments(snakeToCamel(data)); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        supabase.from('invoices').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
          .then(({ data }) => { if (data) setInvoices(snakeToCamel(data)); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_expenses' }, () => {
        supabase.from('company_expenses').select('*').eq('org_id', orgId).order('date', { ascending: false })
          .then(({ data }) => { if (data) setCompanyExpenses(snakeToCamel(data)); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        supabase.from('payments').select('*').eq('org_id', orgId).order('paid_at', { ascending: false })
          .then(({ data }) => { if (data) setPayments(snakeToCamel(data)); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quote_media' }, () => {
        supabase.from('quote_media').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
          .then(({ data }) => { if (data) setQuoteMedia(snakeToCamel(data)); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, () => {
        supabase.from('contracts').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
          .then(({ data }) => { if (data) setContracts(snakeToCamel(data)); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mileage_entries' }, () => {
        supabase.from('mileage_entries').select('*').eq('org_id', orgId).order('date', { ascending: false })
          .then(({ data }) => { if (data) setMileageEntries(snakeToCamel(data)); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contractors' }, () => {
        supabase.from('contractors').select('*').eq('org_id', orgId).order('contact_name', { ascending: true })
          .then(({ data }) => { if (data) setContractors(snakeToCamel(data)); });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }

  // ─── Getters ────────────────────────────────────────────
  const getCustomer = useCallback((id) => customers.find(c => c.id === id) || null, [customers]);
  const getQuote = useCallback((id) => quotes.find(q => q.id === id) || null, [quotes]);
  const getJob = useCallback((id) => jobs.find(j => j.id === id) || null, [jobs]);
  const getTeamMember = useCallback((id) => teamMembers.find(m => m.id === id) || null, [teamMembers]);
  const getInvoice = useCallback((id) => invoices.find(i => i.id === id) || null, [invoices]);
  const getInvoicePayments = useCallback((invId) => payments.filter(p => p.invoiceId === invId), [payments]);
  const getContract = useCallback((id) => contracts.find(c => c.id === id) || null, [contracts]);

  // Customer-scoped getters (used by customer detail page)
  const getCustomerQuotes = useCallback((custId) => quotes.filter(q => q.customerId === custId), [quotes]);
  const getCustomerJobs = useCallback((custId) => jobs.filter(j => j.customerId === custId), [jobs]);
  const getCustomerActivity = useCallback((custId) => activity.filter(a => a.customerId === custId), [activity]);
  const getCustomerContracts = useCallback((custId) => contracts.filter(c => c.customerId === custId), [contracts]);

  // ─── Customer CRUD ──────────────────────────────────────
  const addCustomer = useCallback(async (data) => {
    if (connected) {
      const { data: row, error } = await supabase.from('customers')
        .insert({ ...camelToSnake(data), org_id: orgId })
        .select().single();
      if (error) throw error;
      const c = snakeToCamel(row);
      setCustomers(prev => [c, ...prev]);
      return c;
    } else {
      const c = { ...data, id: crypto.randomUUID(), orgId, createdAt: new Date().toISOString() };
      setCustomers(prev => { const next = [c, ...prev]; saveLocal('customers', next); return next; });
      return c;
    }
  }, [connected, orgId]);

  const updateCustomer = useCallback(async (id, data) => {
    if (connected) {
      const { error } = await supabase.from('customers').update(camelToSnake(data)).eq('id', id);
      if (error) throw error;
    }
    setCustomers(prev => {
      const next = prev.map(c => c.id === id ? { ...c, ...data } : c);
      if (!connected) saveLocal('customers', next);
      return next;
    });
  }, [connected]);

  const deleteCustomer = useCallback(async (id) => {
    // Collect all dependent records up front (so we can update local state for both modes)
    const customerJobIds = jobs.filter(j => j.customerId === id).map(j => j.id);
    const customerQuoteIds = quotes.filter(q => q.customerId === id).map(q => q.id);
    const customerInvoiceIds = invoices.filter(i => i.customerId === id).map(i => i.id);
    // Calendar events: those tied directly to the customer OR to one of their jobs
    const customerEventIds = calendarEvents
      .filter(e => e.customerId === id || (e.jobId && customerJobIds.includes(e.jobId)))
      .map(e => e.id);

    if (connected) {
      // Delete in dependency order so RLS / FKs don't trip
      if (customerInvoiceIds.length) {
        const { error } = await supabase.from('invoices').delete().in('id', customerInvoiceIds);
        if (error) throw error;
      }
      if (customerEventIds.length) {
        const { error } = await supabase.from('calendar_events').delete().in('id', customerEventIds);
        if (error) throw error;
      }
      if (customerJobIds.length) {
        const { error } = await supabase.from('jobs').delete().in('id', customerJobIds);
        if (error) throw error;
      }
      if (customerQuoteIds.length) {
        const { error } = await supabase.from('quotes').delete().in('id', customerQuoteIds);
        if (error) throw error;
      }
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
    }

    setInvoices(prev => {
      const next = prev.filter(i => !customerInvoiceIds.includes(i.id));
      if (!connected) saveLocal('invoices', next);
      return next;
    });
    setCalendarEvents(prev => {
      const next = prev.filter(e => !customerEventIds.includes(e.id));
      if (!connected) saveLocal('calendar_events', next);
      return next;
    });
    setJobs(prev => {
      const next = prev.filter(j => !customerJobIds.includes(j.id));
      if (!connected) saveLocal('jobs', next);
      return next;
    });
    setQuotes(prev => {
      const next = prev.filter(q => !customerQuoteIds.includes(q.id));
      if (!connected) saveLocal('quotes', next);
      return next;
    });
    setCustomers(prev => {
      const next = prev.filter(c => c.id !== id);
      if (!connected) saveLocal('customers', next);
      return next;
    });
  }, [connected, jobs, quotes, invoices, calendarEvents]);

  // ─── Quote CRUD ─────────────────────────────────────────
  const addQuote = useCallback(async (data) => {
    // Generate quote_number from existing quotes (DB has NOT NULL constraint)
    const maxNum = quotes.reduce((max, q) => Math.max(max, q.quoteNumber || 0), 1000);
    const nextQuoteNumber = maxNum + 1;

    // URL-safe public token for the customer-facing /quote/[token] link
    const publicToken = data.publicToken || makeUrlSafeToken();
    const payload = { ...data, publicToken };

    if (connected) {
      const dbPayload = { ...camelToSnake(payload), org_id: orgId, quote_number: nextQuoteNumber };
      // Remove 'id' if it's undefined/null (let Supabase generate it)
      if (!dbPayload.id) delete dbPayload.id;
      const { data: row, error } = await supabase.from('quotes')
        .insert(dbPayload)
        .select().single();
      if (error) {
        console.error('[addQuote] Supabase error:', JSON.stringify(error, null, 2));
        throw error;
      }
      const q = snakeToCamel(row);
      setQuotes(prev => [q, ...prev]);
      return q;
    } else {
      const q = { ...payload, id: crypto.randomUUID(), orgId, quoteNumber: nextQuoteNumber, createdAt: new Date().toISOString() };
      setQuotes(prev => { const next = [q, ...prev]; saveLocal('quotes', next); return next; });
      return q;
    }
  }, [connected, orgId, quotes]);

  const updateQuote = useCallback(async (id, data) => {
    if (connected) {
      const { error } = await supabase.from('quotes').update(camelToSnake(data)).eq('id', id);
      if (error) throw error;
    }
    setQuotes(prev => {
      const next = prev.map(q => q.id === id ? { ...q, ...data } : q);
      if (!connected) saveLocal('quotes', next);
      return next;
    });
  }, [connected]);

  const deleteQuote = useCallback(async (id) => {
    if (connected) {
      const { error } = await supabase.from('quotes').delete().eq('id', id);
      if (error) throw error;
    }
    setQuotes(prev => {
      const next = prev.filter(q => q.id !== id);
      if (!connected) saveLocal('quotes', next);
      return next;
    });
  }, [connected]);

  // ─── Contract CRUD ──────────────────────────────────────
  // Contracts are normally generated from a quote via the contractTemplate
  // helper, but the raw add/update/delete are kept generic so the same
  // table can power standalone agreements (e.g. seasonal maintenance).
  const addContract = useCallback(async (data) => {
    const maxNum = contracts.reduce((max, c) => Math.max(max, c.contractNumber || 0), 1000);
    const nextContractNumber = maxNum + 1;
    const publicToken = data.publicToken || makeUrlSafeToken();
    const payload = { ...data, publicToken, contractNumber: nextContractNumber, status: data.status || 'draft' };

    if (connected) {
      const dbPayload = { ...camelToSnake(payload), org_id: orgId };
      if (!dbPayload.id) delete dbPayload.id;
      const { data: row, error } = await supabase.from('contracts')
        .insert(dbPayload)
        .select().single();
      if (error) {
        console.error('[addContract] Supabase error:', JSON.stringify(error, null, 2));
        throw error;
      }
      const c = snakeToCamel(row);
      setContracts(prev => [c, ...prev]);
      return c;
    } else {
      const c = { ...payload, id: crypto.randomUUID(), orgId, createdAt: new Date().toISOString() };
      setContracts(prev => { const next = [c, ...prev]; saveLocal('contracts', next); return next; });
      return c;
    }
  }, [connected, orgId, contracts]);

  const updateContract = useCallback(async (id, data) => {
    if (connected) {
      const { error } = await supabase.from('contracts').update(camelToSnake(data)).eq('id', id);
      if (error) throw error;
    }
    setContracts(prev => {
      const next = prev.map(c => c.id === id ? { ...c, ...data } : c);
      if (!connected) saveLocal('contracts', next);
      return next;
    });
  }, [connected]);

  const deleteContract = useCallback(async (id) => {
    if (connected) {
      const { error } = await supabase.from('contracts').delete().eq('id', id);
      if (error) throw error;
    }
    setContracts(prev => {
      const next = prev.filter(c => c.id !== id);
      if (!connected) saveLocal('contracts', next);
      return next;
    });
  }, [connected]);

  // ─── Quote Media ───────────────────────────────────────
  // Photos are customer-anchored: every photo carries both the
  // originating quote_id (for cleanup-eligibility decisions) AND
  // the customer_id, so when a quote is rebuilt or the customer
  // comes back for another quote the gallery follows them.
  // The 30-day cleanup runs when a customer has no active work.
  const getQuoteMedia = useCallback((quoteId) => {
    const q = quotes.find(x => x.id === quoteId);
    if (q?.customerId) {
      return quoteMedia.filter(m => m.customerId === q.customerId);
    }
    // Fallback for quotes without a customer (legacy): match by quote_id
    return quoteMedia.filter(m => m.quoteId === quoteId);
  }, [quoteMedia, quotes]);

  // For the new-quote wizard's walkthrough step: photos can be captured
  // before any quote row exists, so the gallery looks them up by customer.
  const getQuoteMediaByCustomer = useCallback(
    (customerId) => quoteMedia.filter(m => m.customerId === customerId),
    [quoteMedia]
  );

  const addQuoteMedia = useCallback(async ({
    quoteId,        // optional — null/undefined when capturing during walkthrough before the quote is created
    customerId,     // explicit customer id; used when there's no quoteId yet
    filePath, fileUrl, fileSize,
    mediaType = 'image',
    durationSeconds = null,
    transcript = null,
    caption = '',
  }) => {
    const q = quoteId ? quotes.find(x => x.id === quoteId) : null;
    const resolvedCustomerId = customerId || q?.customerId || null;
    const payload = {
      quoteId: quoteId || null,
      customerId: resolvedCustomerId,
      filePath, fileUrl,
      fileSize: fileSize || 0,
      mediaType,
      durationSeconds,
      transcript,
      caption,
      pinned: false,
      uploadedBy: user?.id || null,
    };
    if (connected) {
      const { data: row, error } = await supabase.from('quote_media')
        .insert({ ...camelToSnake(payload), org_id: orgId })
        .select().single();
      if (error) throw error;
      const m = snakeToCamel(row);
      setQuoteMedia(prev => [m, ...prev]);
      return m;
    } else {
      const m = { ...payload, id: crypto.randomUUID(), orgId, createdAt: new Date().toISOString() };
      setQuoteMedia(prev => { const next = [m, ...prev]; saveLocal('quote_media', next); return next; });
      return m;
    }
  }, [connected, orgId, user, quotes]);

  const deleteQuoteMedia = useCallback(async (id) => {
    const existing = quoteMedia.find(m => m.id === id);
    if (connected) {
      if (existing?.filePath) {
        try { await supabase.storage.from('quote-media').remove([existing.filePath]); }
        catch (err) { console.warn('[deleteQuoteMedia] storage cleanup failed', err); }
      }
      const { error } = await supabase.from('quote_media').delete().eq('id', id);
      if (error) throw error;
    }
    setQuoteMedia(prev => {
      const next = prev.filter(m => m.id !== id);
      if (!connected) saveLocal('quote_media', next);
      return next;
    });
  }, [connected, quoteMedia]);

  // Inline edit of the caption / transcript on a media item.
  // Used for the Jobber-style "what the customer asked for" notes
  // beneath each photo / video / voice memo.
  const updateQuoteMediaCaption = useCallback(async (id, fields) => {
    const updates = {};
    if (fields.caption !== undefined)    updates.caption = fields.caption;
    if (fields.transcript !== undefined) updates.transcript = fields.transcript;
    if (Object.keys(updates).length === 0) return;
    if (connected) {
      const { error } = await supabase.from('quote_media').update(camelToSnake(updates)).eq('id', id);
      if (error) throw error;
    }
    setQuoteMedia(prev => {
      const next = prev.map(m => m.id === id ? { ...m, ...updates } : m);
      if (!connected) saveLocal('quote_media', next);
      return next;
    });
  }, [connected]);

  // Toggle the pinned flag — pinned photos are exempt from the
  // 30-day cleanup, so the user can hold onto important "before"
  // shots even after the customer's work wraps up.
  const togglePinQuoteMedia = useCallback(async (id) => {
    const existing = quoteMedia.find(m => m.id === id);
    if (!existing) return;
    const next = !existing.pinned;
    if (connected) {
      const { error } = await supabase.from('quote_media').update({ pinned: next }).eq('id', id);
      if (error) throw error;
    }
    setQuoteMedia(prev => {
      const updated = prev.map(m => m.id === id ? { ...m, pinned: next } : m);
      if (!connected) saveLocal('quote_media', updated);
      return updated;
    });
  }, [connected, quoteMedia]);

  // ─── Job CRUD ───────────────────────────────────────────
  const addJob = useCallback(async (data) => {
    if (connected) {
      const { data: row, error } = await supabase.from('jobs')
        .insert({ ...camelToSnake(data), org_id: orgId })
        .select().single();
      if (error) throw error;
      const j = snakeToCamel(row);
      setJobs(prev => [...prev, j]);
      return j;
    } else {
      const j = { ...data, id: crypto.randomUUID(), orgId, status: 'scheduled', createdAt: new Date().toISOString() };
      setJobs(prev => { const next = [...prev, j]; saveLocal('jobs', next); return next; });
      return j;
    }
  }, [connected, orgId]);

  const updateJob = useCallback(async (id, data) => {
    // Auto-set completedAt when status changes to 'completed' (Phase 1B)
    const payload = { ...data };
    if (payload.status === 'completed' && !payload.completedAt) {
      payload.completedAt = new Date().toISOString();
    }
    if (connected) {
      const { error } = await supabase.from('jobs').update(camelToSnake(payload)).eq('id', id);
      if (error) throw error;
    }
    setJobs(prev => {
      const next = prev.map(j => j.id === id ? { ...j, ...payload } : j);
      if (!connected) saveLocal('jobs', next);
      return next;
    });
  }, [connected]);

  const deleteJob = useCallback(async (id) => {
    if (connected) {
      // calendar_events.job_id is ON DELETE CASCADE in the DB, so no explicit child delete needed
      const { error } = await supabase.from('jobs').delete().eq('id', id);
      if (error) throw error;
    }
    // localStorage path needs explicit cascade
    setCalendarEvents(prev => {
      const next = prev.filter(e => e.jobId !== id);
      if (!connected) saveLocal('calendar_events', next);
      return next;
    });
    setJobs(prev => {
      const next = prev.filter(j => j.id !== id);
      if (!connected) saveLocal('jobs', next);
      return next;
    });
  }, [connected]);

  // ─── Convert Quote → Job ───────────────────────────────
  const convertQuoteToJob = useCallback(async ({ quoteId, scheduledDate, scheduledTime, estimatedHours, crewNotes, assignedTo }) => {
    const quote = getQuote(quoteId);
    if (!quote) return null;
    const customer = quote.customerId ? getCustomer(quote.customerId) : null;

    const hours = Number.isFinite(Number(estimatedHours)) && Number(estimatedHours) > 0
      ? Number(estimatedHours)
      : 4;

    const jobData = {
      quoteId,
      customerId: quote.customerId || null,
      title: `${quote.category || 'Job'} — ${customer ? `${customer.firstName} ${customer.lastName || ''}`.trim() : 'No Customer'}`,
      description: quote.notes || '',
      address: customer?.address
        ? `${customer.address}, ${customer.city || ''} ${customer.state || ''} ${customer.zip || ''}`.trim()
        : '',
      scheduledDate,
      scheduledTime: scheduledTime || null,
      estimatedDuration: `${hours} hours`,
      assignedTo: assignedTo || [],
      crewNotes: crewNotes || '',
      total: quote.total || 0,
      revenue: quote.total || 0,
    };

    const job = await addJob(jobData);

    // Update quote status to accepted
    if (job) {
      await updateQuote(quoteId, { status: 'accepted' });
    }

    return job;
  }, [getQuote, getCustomer, addJob, updateQuote]);

  // ─── Calendar Event CRUD ────────────────────────────────
  const addCalendarEvent = useCallback(async (data) => {
    if (connected) {
      const { data: row, error } = await supabase.from('calendar_events')
        .insert({ ...camelToSnake(data), org_id: orgId })
        .select().single();
      if (error) throw error;
      const e = snakeToCamel(row);
      setCalendarEvents(prev => [...prev, e]);
      return e;
    } else {
      const e = { ...data, id: crypto.randomUUID(), orgId, createdAt: new Date().toISOString() };
      setCalendarEvents(prev => { const next = [...prev, e]; saveLocal('calendar_events', next); return next; });
      return e;
    }
  }, [connected, orgId]);

  const updateCalendarEvent = useCallback(async (id, data) => {
    if (connected) {
      const { error } = await supabase.from('calendar_events').update(camelToSnake(data)).eq('id', id);
      if (error) throw error;
    }
    setCalendarEvents(prev => {
      const next = prev.map(e => e.id === id ? { ...e, ...data } : e);
      if (!connected) saveLocal('calendar_events', next);
      return next;
    });
  }, [connected]);

  const deleteCalendarEvent = useCallback(async (id) => {
    if (connected) {
      const { error } = await supabase.from('calendar_events').delete().eq('id', id);
      if (error) throw error;
    }
    setCalendarEvents(prev => {
      const next = prev.filter(e => e.id !== id);
      if (!connected) saveLocal('calendar_events', next);
      return next;
    });
  }, [connected]);

  // ─── Activity ───────────────────────────────────────────
  const addActivity = useCallback(async (data) => {
    if (connected) {
      const { data: row, error } = await supabase.from('activity')
        .insert({ ...camelToSnake(data), org_id: orgId })
        .select().single();
      if (error) throw error;
      const a = snakeToCamel(row);
      setActivity(prev => [a, ...prev]);
      return a;
    } else {
      const a = { ...data, id: crypto.randomUUID(), orgId, createdAt: new Date().toISOString() };
      setActivity(prev => { const next = [a, ...prev]; saveLocal('activity', next); return next; });
      return a;
    }
  }, [connected, orgId]);

  // ─── Time Tracking (Shifts + Segments) ──────────────────
  // A "shift" = one time_entries row spanning the worker's day.
  // Within the shift, the worker moves between SEGMENTS:
  //   - 'job'    paid, attributed to a specific job (used for job costing)
  //   - 'travel' paid, indirect labor (driving, yard, loading)
  //   - 'break'  unpaid, real-time start/stop (no more retroactive guessing)
  //
  // The legacy `clockIn(memberId, jobId)` / `clockOut(id)` API is kept as a
  // thin wrapper so older code paths (e.g. job-detail manual logging) keep
  // working. New worker UX should call startShift / switchSegment / endShift.

  async function insertSegment({ memberId, timeEntryId, kind, jobId = null, notes = '' }) {
    const startedAt = new Date().toISOString();
    if (connected) {
      const payload = {
        org_id: orgId,
        member_id: memberId,
        time_entry_id: timeEntryId,
        job_id: jobId || null,
        kind,
        started_at: startedAt,
        notes: notes || '',
      };
      const { data: row, error } = await supabase.from('time_segments').insert(payload).select().single();
      if (error) throw error;
      const seg = snakeToCamel(row);
      setTimeSegments(prev => [seg, ...prev]);
      return seg;
    } else {
      const seg = {
        id: crypto.randomUUID(),
        orgId,
        memberId,
        timeEntryId,
        jobId: jobId || null,
        kind,
        startedAt,
        endedAt: null,
        durationMinutes: null,
        notes: notes || '',
        createdAt: startedAt,
      };
      setTimeSegments(prev => { const next = [seg, ...prev]; saveLocal('time_segments', next); return next; });
      return seg;
    }
  }

  async function closeSegment(segmentId, updates = {}) {
    const seg = timeSegments.find(s => s.id === segmentId);
    if (!seg) return null;
    const endedAt = new Date().toISOString();
    const duration = Math.max(0, Math.round((new Date(endedAt) - new Date(seg.startedAt)) / 60000));
    const patch = { endedAt, durationMinutes: duration, ...updates };
    if (connected) {
      const { error } = await supabase.from('time_segments').update(camelToSnake(patch)).eq('id', segmentId);
      if (error) throw error;
    }
    setTimeSegments(prev => {
      const next = prev.map(s => s.id === segmentId ? { ...s, ...patch } : s);
      if (!connected) saveLocal('time_segments', next);
      return next;
    });
    return { ...seg, ...patch };
  }

  // Open a shift + an initial segment.
  const startShift = useCallback(async (memberId, { jobId = null, kind = null, notes = '' } = {}) => {
    const segKind = kind || (jobId ? 'job' : 'travel');
    const clockInAt = new Date().toISOString();
    let entry;
    if (connected) {
      const payload = { org_id: orgId, member_id: memberId, clock_in: clockInAt, job_id: jobId || null };
      const { data: row, error } = await supabase.from('time_entries').insert(payload).select().single();
      if (error) throw error;
      entry = snakeToCamel(row);
      entry.teamMemberId = entry.memberId;
      setTimeEntries(prev => [entry, ...prev]);
    } else {
      entry = {
        id: crypto.randomUUID(), orgId,
        teamMemberId: memberId, memberId,
        clockIn: clockInAt, jobId: jobId || null,
      };
      setTimeEntries(prev => { const next = [entry, ...prev]; saveLocal('time_entries', next); return next; });
    }
    const seg = await insertSegment({ memberId, timeEntryId: entry.id, kind: segKind, jobId, notes });
    return { entry, segment: seg };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, orgId]);

  // Close the current open segment and open a new one.
  const switchSegment = useCallback(async (timeEntryId, { kind, jobId = null, notes = '' } = {}) => {
    const entry = timeEntries.find(t => t.id === timeEntryId);
    if (!entry) return null;
    const memberId = entry.memberId || entry.teamMemberId;
    const open = timeSegments.find(s => s.timeEntryId === timeEntryId && !s.endedAt);
    if (open) await closeSegment(open.id);
    const seg = await insertSegment({ memberId, timeEntryId, kind, jobId, notes });
    return seg;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, timeEntries, timeSegments]);

  // Close any open segment, set clock_out, roll up break minutes onto the entry.
  const endShift = useCallback(async (timeEntryId, { notes = '' } = {}) => {
    const entry = timeEntries.find(t => t.id === timeEntryId);
    if (!entry) return null;
    const open = timeSegments.find(s => s.timeEntryId === timeEntryId && !s.endedAt);
    let closedOpen = null;
    if (open) closedOpen = await closeSegment(open.id, notes ? { notes } : {});

    const segsForEntry = timeSegments
      .map(s => (closedOpen && s.id === closedOpen.id ? closedOpen : s))
      .filter(s => s.timeEntryId === timeEntryId);
    const breakMins = segsForEntry
      .filter(s => s.kind === 'break')
      .reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0);

    const clockOutAt = new Date().toISOString();
    if (connected) {
      const { error } = await supabase.from('time_entries')
        .update({ clock_out: clockOutAt, break_minutes: breakMins })
        .eq('id', timeEntryId);
      if (error) throw error;
    }
    setTimeEntries(prev => {
      const next = prev.map(t => t.id === timeEntryId ? { ...t, clockOut: clockOutAt, breakMinutes: breakMins } : t);
      if (!connected) saveLocal('time_entries', next);
      return next;
    });
    return { clockOut: clockOutAt, breakMinutes: breakMins };
  }, [connected, timeEntries, timeSegments]);

  // ─── Legacy wrappers ────────────────────────────────────
  // Older callers (job-detail manual logging, payroll edits) still use these.
  // They preserve original behavior but DO open a segment so segment-based
  // reporting stays consistent across the app.
  const clockIn = useCallback(async (memberId, jobId = null) => {
    const { entry } = await startShift(memberId, { jobId });
    return entry;
  }, [startShift]);

  const clockOut = useCallback(async (entryId) => endShift(entryId), [endShift]);

  const updateTimeEntry = useCallback(async (id, data) => {
    if (connected) {
      const { error } = await supabase.from('time_entries').update(camelToSnake(data)).eq('id', id);
      if (error) throw error;
    }
    setTimeEntries(prev => {
      const next = prev.map(t => t.id === id ? { ...t, ...data } : t);
      if (!connected) saveLocal('time_entries', next);
      return next;
    });
  }, [connected]);

  const deleteTimeEntry = useCallback(async (id) => {
    if (connected) {
      // time_segments.time_entry_id is ON DELETE CASCADE — no explicit cleanup.
      const { error } = await supabase.from('time_entries').delete().eq('id', id);
      if (error) throw error;
    }
    setTimeSegments(prev => {
      const next = prev.filter(s => s.timeEntryId !== id);
      if (!connected) saveLocal('time_segments', next);
      return next;
    });
    setTimeEntries(prev => {
      const next = prev.filter(t => t.id !== id);
      if (!connected) saveLocal('time_entries', next);
      return next;
    });
  }, [connected]);

  // Append a note to the worker's currently-open segment. Used by the blocker
  // chips so the issue is attached to the moment it happened, not day's end.
  const annotateOpenSegment = useCallback(async (timeEntryId, note) => {
    const open = timeSegments.find(s => s.timeEntryId === timeEntryId && !s.endedAt);
    if (!open) return null;
    const trimmed = String(note || '').trim();
    if (!trimmed) return null;
    const merged = open.notes ? `${open.notes}\n${trimmed}` : trimmed;
    if (connected) {
      const { error } = await supabase.from('time_segments').update({ notes: merged }).eq('id', open.id);
      if (error) throw error;
    }
    setTimeSegments(prev => {
      const next = prev.map(s => s.id === open.id ? { ...s, notes: merged } : s);
      if (!connected) saveLocal('time_segments', next);
      return next;
    });
    return merged;
  }, [connected, timeSegments]);

  // ─── Job Expenses ──────────────────────────────────────
  const addJobExpense = useCallback(async (data) => {
    if (connected) {
      const { data: row, error } = await supabase.from('job_expenses')
        .insert({ ...camelToSnake(data), org_id: orgId })
        .select().single();
      if (error) throw error;
      const e = snakeToCamel(row);
      setJobExpenses(prev => [e, ...prev]);
      return e;
    } else {
      const e = { ...data, id: crypto.randomUUID(), orgId, createdAt: new Date().toISOString() };
      setJobExpenses(prev => { const next = [e, ...prev]; saveLocal('job_expenses', next); return next; });
      return e;
    }
  }, [connected, orgId]);

  const updateJobExpense = useCallback(async (id, data) => {
    if (connected) {
      const { error } = await supabase.from('job_expenses').update(camelToSnake(data)).eq('id', id);
      if (error) throw error;
    }
    setJobExpenses(prev => {
      const next = prev.map(e => e.id === id ? { ...e, ...data } : e);
      if (!connected) saveLocal('job_expenses', next);
      return next;
    });
  }, [connected]);

  const deleteJobExpense = useCallback(async (id) => {
    // Best-effort storage cleanup so deleted receipts don't sit in the bucket
    // chewing through the free-tier 1GB cap.
    const existing = jobExpenses.find(e => e.id === id);
    if (connected) {
      if (existing?.receiptPath) {
        try { await supabase.storage.from('receipts').remove([existing.receiptPath]); }
        catch (err) { console.warn('[deleteJobExpense] storage cleanup failed', err); }
      }
      const { error } = await supabase.from('job_expenses').delete().eq('id', id);
      if (error) throw error;
    }
    setJobExpenses(prev => {
      const next = prev.filter(e => e.id !== id);
      if (!connected) saveLocal('job_expenses', next);
      return next;
    });
  }, [connected, jobExpenses]);

  // ─── Financial Helpers ─────────────────────────────────
  const getJobFinancials = useCallback((jobId) => {
    const job = jobs.find(j => j.id === jobId);
    return computeJobFinancials(job, jobExpenses, timeEntries, teamMembers, timeSegments);
  }, [jobs, jobExpenses, timeEntries, teamMembers, timeSegments]);

  const getPnL = useCallback((period = 'month', basis = 'completed') =>
    computeBuildPnL({ jobs, jobExpenses, timeEntries, timeSegments, teamMembers, invoices, companyExpenses, period, basis }),
    [jobs, jobExpenses, timeEntries, timeSegments, teamMembers, invoices, companyExpenses]);

  const getARAging = useCallback(() => computeARAging(invoices), [invoices]);

  // ─── Team Members ───────────────────────────────────────
  const addTeamMember = useCallback(async (data) => {
    if (connected) {
      const { data: row, error } = await supabase.from('team_members')
        .insert({ ...camelToSnake(data), org_id: orgId })
        .select().single();
      if (error) throw error;
      const m = snakeToCamel(row);
      setTeamMembers(prev => [...prev, m]);
      return m;
    }
    // Demo / localStorage path
    const m = { ...data, id: crypto.randomUUID(), orgId, isActive: true, createdAt: new Date().toISOString() };
    setTeamMembers(prev => {
      const next = [...prev, m];
      saveLocal('team_members', next);
      return next;
    });
    return m;
  }, [connected, orgId]);

  const updateTeamMember = useCallback(async (id, data) => {
    if (connected) {
      const { error } = await supabase.from('team_members').update(camelToSnake(data)).eq('id', id);
      if (error) throw error;
    }
    setTeamMembers(prev => {
      const next = prev.map(m => m.id === id ? { ...m, ...data } : m);
      if (!connected) saveLocal('team_members', next);
      return next;
    });
  }, [connected]);

  // Reload team members from Supabase (used after invite API)
  const loadTeamMembers = useCallback(async () => {
    if (!connected) return;
    const { data } = await supabase.from('team_members').select('*').eq('org_id', orgId);
    if (data) setTeamMembers(snakeToCamel(data));
  }, [connected, orgId]);

  // Inject a team member record from API response into local state
  // (fallback when RLS blocks the reload from seeing the new member)
  const addTeamMemberFromApi = useCallback((rawMember) => {
    const m = snakeToCamel(rawMember);
    setTeamMembers(prev => {
      // Avoid duplicates
      if (prev.some(existing => existing.id === m.id)) return prev;
      return [...prev, m];
    });
  }, []);

  // ─── Invoice CRUD ───────────────────────────────────────
  const addInvoice = useCallback(async (data) => {
    // Generate a URL-safe public token client-side so it never has '/' or '+'
    // (the DB default may still be base64 from migration 014 — overriding here is safer)
    const publicToken = data.publicToken || makeUrlSafeToken();
    const payload = { ...data, publicToken };

    if (connected) {
      const { data: row, error } = await supabase.from('invoices')
        .insert({ ...camelToSnake(payload), org_id: orgId })
        .select().single();
      if (error) throw error;
      const inv = snakeToCamel(row);
      setInvoices(prev => [inv, ...prev]);
      return inv;
    } else {
      const inv = { ...payload, id: crypto.randomUUID(), orgId, createdAt: new Date().toISOString() };
      setInvoices(prev => { const next = [inv, ...prev]; saveLocal('invoices', next); return next; });
      return inv;
    }
  }, [connected, orgId]);

  const updateInvoice = useCallback(async (id, data) => {
    if (connected) {
      const { error } = await supabase.from('invoices').update(camelToSnake(data)).eq('id', id);
      if (error) throw error;
    }
    setInvoices(prev => {
      const next = prev.map(i => i.id === id ? { ...i, ...data } : i);
      if (!connected) saveLocal('invoices', next);
      return next;
    });
  }, [connected]);

  // ─── Company Expenses CRUD (Phase 2B) ──────────────────
  const addCompanyExpense = useCallback(async (data) => {
    if (connected) {
      const { data: row, error } = await supabase.from('company_expenses')
        .insert({ ...camelToSnake(data), org_id: orgId })
        .select().single();
      if (error) throw error;
      const e = snakeToCamel(row);
      setCompanyExpenses(prev => [e, ...prev]);
      return e;
    } else {
      const e = { ...data, id: crypto.randomUUID(), orgId, createdAt: new Date().toISOString() };
      setCompanyExpenses(prev => { const next = [e, ...prev]; saveLocal('company_expenses', next); return next; });
      return e;
    }
  }, [connected, orgId]);

  const updateCompanyExpense = useCallback(async (id, data) => {
    if (connected) {
      const { error } = await supabase.from('company_expenses').update(camelToSnake(data)).eq('id', id);
      if (error) throw error;
    }
    setCompanyExpenses(prev => {
      const next = prev.map(e => e.id === id ? { ...e, ...data } : e);
      if (!connected) saveLocal('company_expenses', next);
      return next;
    });
  }, [connected]);

  const deleteCompanyExpense = useCallback(async (id) => {
    const existing = companyExpenses.find(e => e.id === id);
    if (connected) {
      if (existing?.receiptPath) {
        try { await supabase.storage.from('receipts').remove([existing.receiptPath]); }
        catch (err) { console.warn('[deleteCompanyExpense] storage cleanup failed', err); }
      }
      const { error } = await supabase.from('company_expenses').delete().eq('id', id);
      if (error) throw error;
    }
    setCompanyExpenses(prev => {
      const next = prev.filter(e => e.id !== id);
      if (!connected) saveLocal('company_expenses', next);
      return next;
    });
  }, [connected, companyExpenses]);

  // ─── Mileage CRUD ───────────────────────────────────────
  // Each row is one trip. Photos live in the existing `receipts` bucket
  // under a mileage/ folder so we don't need a second storage policy set.
  const addMileageEntry = useCallback(async (data) => {
    if (connected) {
      const { data: row, error } = await supabase.from('mileage_entries')
        .insert({ ...camelToSnake(data), org_id: orgId })
        .select().single();
      if (error) throw error;
      const m = snakeToCamel(row);
      setMileageEntries(prev => [m, ...prev]);
      return m;
    } else {
      const m = { ...data, id: crypto.randomUUID(), orgId, createdAt: new Date().toISOString() };
      setMileageEntries(prev => { const next = [m, ...prev]; saveLocal('mileage_entries', next); return next; });
      return m;
    }
  }, [connected, orgId]);

  const updateMileageEntry = useCallback(async (id, data) => {
    if (connected) {
      const { error } = await supabase.from('mileage_entries').update(camelToSnake(data)).eq('id', id);
      if (error) throw error;
    }
    setMileageEntries(prev => {
      const next = prev.map(m => m.id === id ? { ...m, ...data } : m);
      if (!connected) saveLocal('mileage_entries', next);
      return next;
    });
  }, [connected]);

  const deleteMileageEntry = useCallback(async (id) => {
    const existing = mileageEntries.find(m => m.id === id);
    if (connected) {
      const paths = [existing?.startPhotoPath, existing?.endPhotoPath].filter(Boolean);
      if (paths.length) {
        try { await supabase.storage.from('receipts').remove(paths); }
        catch (err) { console.warn('[deleteMileageEntry] storage cleanup failed', err); }
      }
      const { error } = await supabase.from('mileage_entries').delete().eq('id', id);
      if (error) throw error;
    }
    setMileageEntries(prev => {
      const next = prev.filter(m => m.id !== id);
      if (!connected) saveLocal('mileage_entries', next);
      return next;
    });
  }, [connected, mileageEntries]);

  // ─── Contractor CRUD ────────────────────────────────────
  // Contractors are payees we issue 1099-NECs to. Distinct from customers
  // (we bill them) and team_members (W-2 employees).
  const addContractor = useCallback(async (data) => {
    if (connected) {
      const { data: row, error } = await supabase.from('contractors')
        .insert({ ...camelToSnake(data), org_id: orgId })
        .select().single();
      if (error) throw error;
      const c = snakeToCamel(row);
      setContractors(prev => [c, ...prev].sort((a, b) => (a.contactName || '').localeCompare(b.contactName || '')));
      return c;
    } else {
      const c = { ...data, id: crypto.randomUUID(), orgId, createdAt: new Date().toISOString() };
      setContractors(prev => { const next = [c, ...prev]; saveLocal('contractors', next); return next; });
      return c;
    }
  }, [connected, orgId]);

  const updateContractor = useCallback(async (id, data) => {
    if (connected) {
      const { error } = await supabase.from('contractors').update(camelToSnake(data)).eq('id', id);
      if (error) throw error;
    }
    setContractors(prev => {
      const next = prev.map(c => c.id === id ? { ...c, ...data } : c);
      if (!connected) saveLocal('contractors', next);
      return next;
    });
  }, [connected]);

  const deleteContractor = useCallback(async (id) => {
    const existing = contractors.find(c => c.id === id);
    if (connected) {
      if (existing?.w9Path) {
        try { await supabase.storage.from('receipts').remove([existing.w9Path]); }
        catch (err) { console.warn('[deleteContractor] storage cleanup failed', err); }
      }
      const { error } = await supabase.from('contractors').delete().eq('id', id);
      if (error) throw error;
    }
    setContractors(prev => {
      const next = prev.filter(c => c.id !== id);
      if (!connected) saveLocal('contractors', next);
      return next;
    });
  }, [connected, contractors]);

  // Roll up payments to a contractor for a given tax year. Pulls from both
  // job_expenses (subcontractor work on jobs) and company_expenses (any
  // overhead paid to a contractor) where contractor_id matches.
  const getContractorPaymentsForYear = useCallback((contractorId, taxYear) => {
    const start = `${taxYear}-01-01`;
    const end = `${taxYear}-12-31`;
    const inYear = (d) => d && d >= start && d <= end;
    const fromJob = jobExpenses
      .filter(e => e.contractorId === contractorId && inYear((e.date || e.createdAt || '').slice(0, 10)))
      .map(e => ({ id: e.id, source: 'job_expense', amount: Number(e.amount || 0), date: e.date || e.createdAt, description: e.description, jobId: e.jobId }));
    const fromCo = companyExpenses
      .filter(e => e.contractorId === contractorId && inYear((e.date || e.createdAt || '').slice(0, 10)))
      .map(e => ({ id: e.id, source: 'company_expense', amount: Number(e.amount || 0), date: e.date || e.createdAt, description: e.description }));
    const all = [...fromJob, ...fromCo].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const total = all.reduce((s, p) => s + p.amount, 0);
    return { payments: all, total };
  }, [jobExpenses, companyExpenses]);

  // ─── Payment CRUD ───────────────────────────────────────
  const addPayment = useCallback(async (data) => {
    if (connected) {
      const { data: row, error } = await supabase.from('payments')
        .insert({ ...camelToSnake(data), org_id: orgId })
        .select().single();
      if (error) throw error;
      const p = snakeToCamel(row);
      setPayments(prev => [p, ...prev]);
      return p;
    } else {
      const p = { ...data, id: crypto.randomUUID(), orgId, createdAt: new Date().toISOString() };
      setPayments(prev => { const next = [p, ...prev]; saveLocal('payments', next); return next; });
      return p;
    }
  }, [connected, orgId]);

  const updatePayment = useCallback(async (id, data) => {
    if (connected) {
      const { error } = await supabase.from('payments').update(camelToSnake(data)).eq('id', id);
      if (error) throw error;
    }
    setPayments(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...data } : p);
      if (!connected) saveLocal('payments', next);
      return next;
    });
  }, [connected]);

  const deletePayment = useCallback(async (id) => {
    if (connected) {
      const { error } = await supabase.from('payments').delete().eq('id', id);
      if (error) throw error;
    }
    setPayments(prev => {
      const next = prev.filter(p => p.id !== id);
      if (!connected) saveLocal('payments', next);
      return next;
    });
  }, [connected]);

  const deleteInvoice = useCallback(async (id) => {
    if (connected) {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
    }
    setInvoices(prev => {
      const next = prev.filter(i => i.id !== id);
      if (!connected) saveLocal('invoices', next);
      return next;
    });
  }, [connected]);

  // ─── Material CRUD ──────────────────────────────────────
  const addMaterial = useCallback(async (data) => {
    if (connected) {
      const { data: row, error } = await supabase.from('materials')
        .insert({ ...camelToSnake(data), org_id: orgId })
        .select().single();
      if (error) throw error;
      const m = snakeToCamel(row);
      setMaterials(prev => [m, ...prev]);
      return m;
    } else {
      const m = { ...data, id: crypto.randomUUID(), orgId, createdAt: new Date().toISOString() };
      setMaterials(prev => { const next = [m, ...prev]; saveLocal('materials', next); return next; });
      return m;
    }
  }, [connected, orgId]);

  const updateMaterial = useCallback(async (id, data) => {
    if (connected) {
      const { error } = await supabase.from('materials').update(camelToSnake(data)).eq('id', id);
      if (error) throw error;
    }
    setMaterials(prev => {
      const next = prev.map(m => m.id === id ? { ...m, ...data } : m);
      if (!connected) saveLocal('materials', next);
      return next;
    });
  }, [connected]);

  const deleteMaterial = useCallback(async (id) => {
    if (connected) {
      const { error } = await supabase.from('materials').delete().eq('id', id);
      if (error) throw error;
    }
    setMaterials(prev => {
      const next = prev.filter(m => m.id !== id);
      if (!connected) saveLocal('materials', next);
      return next;
    });
  }, [connected]);

  const clearAllMaterials = useCallback(async () => {
    const ids = materials.map(m => m.id);
    if (ids.length === 0) return { deleted: 0 };
    if (connected) {
      const { error } = await supabase.from('materials').delete().eq('org_id', orgId);
      if (error) throw error;
    }
    setMaterials(() => {
      if (!connected) saveLocal('materials', []);
      return [];
    });
    return { deleted: ids.length };
  }, [connected, orgId, materials]);

  // Bulk insert-or-update materials (used by the supplier catalog import).
  // Match logic: if `matchKey(existing)` equals `matchKey(item)` AND the
  // existing supplier matches (or is empty), update price/unit/etc. Otherwise
  // insert a new row. Returns { inserted, updated, errors }.
  const bulkUpsertMaterials = useCallback(async (items, matchKey) => {
    let inserted = 0, updated = 0;
    const errors = [];
    const stamp = new Date().toISOString();
    // Snapshot the current list so we don't re-match against rows we just
    // inserted (which would force every duplicate to update the first one).
    const indexAtStart = new Map();
    materials.forEach(existing => {
      const key = matchKey(existing);
      if (!indexAtStart.has(key)) indexAtStart.set(key, existing);
    });
    for (const item of items) {
      try {
        const key = matchKey(item);
        const match = indexAtStart.get(key);
        const supplierMatches = !match || !match.supplier || match.supplier === item.supplier;
        if (match && supplierMatches) {
          const patch = { ...item, lastPriceCheck: stamp };
          if (connected) {
            const { error } = await supabase.from('materials').update(camelToSnake(patch)).eq('id', match.id);
            if (error) throw error;
          }
          setMaterials(prev => {
            const next = prev.map(m => m.id === match.id ? { ...m, ...patch } : m);
            if (!connected) saveLocal('materials', next);
            return next;
          });
          updated += 1;
        } else {
          const payload = { ...item, lastPriceCheck: stamp };
          if (connected) {
            const { data: row, error } = await supabase.from('materials')
              .insert({ ...camelToSnake(payload), org_id: orgId })
              .select().single();
            if (error) throw error;
            const m = snakeToCamel(row);
            setMaterials(prev => [m, ...prev]);
          } else {
            const m = { ...payload, id: crypto.randomUUID(), orgId, createdAt: stamp };
            setMaterials(prev => { const next = [m, ...prev]; saveLocal('materials', next); return next; });
          }
          inserted += 1;
        }
      } catch (err) {
        errors.push({ item: item.name, error: err.message || String(err) });
      }
    }
    return { inserted, updated, errors };
  }, [connected, orgId, materials]);

  // ─── Context value ──────────────────────────────────────
  const value = {
    // State
    customers, quotes, jobs, calendarEvents, teamMembers,
    activity, timeEntries, timeSegments, jobMedia, jobExpenses, materials,
    services, invoices, companyExpenses, payments, loading,
    quoteMedia, contracts, mileageEntries, contractors,

    // Getters
    getCustomer, getQuote, getJob, getTeamMember, getInvoice,
    getInvoicePayments, getQuoteMedia, getQuoteMediaByCustomer, getContract,
    getCustomerQuotes, getCustomerJobs, getCustomerActivity, getCustomerContracts,

    // Customers
    addCustomer, updateCustomer, deleteCustomer,

    // Quotes
    addQuote, updateQuote, deleteQuote,
    addQuoteMedia, deleteQuoteMedia, togglePinQuoteMedia, updateQuoteMediaCaption,

    // Contracts
    addContract, updateContract, deleteContract,

    // Jobs
    addJob, updateJob, deleteJob, convertQuoteToJob,

    // Calendar
    addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,

    // Activity
    addActivity,

    // Time — new shift+segment API
    startShift, endShift, switchSegment, annotateOpenSegment,
    // Time — legacy aliases (kept so existing callers don't break)
    clockIn, clockOut, updateTimeEntry, deleteTimeEntry,

    // Expenses & Financials
    addJobExpense, updateJobExpense, deleteJobExpense, getJobFinancials,
    getPnL, getARAging,

    // Company Expenses (overhead)
    addCompanyExpense, updateCompanyExpense, deleteCompanyExpense,

    // Mileage (IRS log)
    addMileageEntry, updateMileageEntry, deleteMileageEntry,

    // Contractors / 1099
    addContractor, updateContractor, deleteContractor, getContractorPaymentsForYear,

    // Invoices
    addInvoice, updateInvoice, deleteInvoice,

    // Payments (online + manual)
    addPayment, updatePayment, deletePayment,

    // Materials
    addMaterial, updateMaterial, deleteMaterial, bulkUpsertMaterials, clearAllMaterials,

    // Team
    addTeamMember, updateTeamMember, loadTeamMembers, addTeamMemberFromApi,

    // Refetch
    refetch: fetchAllFromSupabase,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
