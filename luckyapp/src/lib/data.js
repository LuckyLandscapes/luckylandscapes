'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConnected } from './supabase';
import { useAuth } from './auth';

const DataContext = createContext(null);

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
  const [jobMedia, setJobMedia] = useState([]);
  const [loading, setLoading] = useState(true);

  // ─── Fetch all data ─────────────────────────────────────
  useEffect(() => {
    if (!orgId) { setLoading(false); return; }

    if (connected) {
      fetchAllFromSupabase();
      const unsub = subscribeRealtime();
      return unsub;
    } else {
      // Demo mode — load from localStorage
      setCustomers(loadLocal('customers'));
      setQuotes(loadLocal('quotes'));
      setJobs(loadLocal('jobs'));
      setCalendarEvents(loadLocal('calendar_events'));
      setTeamMembers(loadLocal('team_members'));
      setActivity(loadLocal('activity'));
      setTimeEntries(loadLocal('time_entries'));
      setJobMedia(loadLocal('job_media'));
      setLoading(false);
    }
  }, [orgId, connected]);

  // ─── Supabase fetchers ──────────────────────────────────
  async function fetchAllFromSupabase() {
    setLoading(true);
    try {
      const [cust, quot, jb, cal, team, act, te] = await Promise.all([
        supabase.from('customers').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('quotes').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('jobs').select('*').eq('org_id', orgId).order('scheduled_date', { ascending: true }),
        supabase.from('calendar_events').select('*').eq('org_id', orgId).order('date', { ascending: true }),
        supabase.from('team_members').select('*').eq('org_id', orgId),
        supabase.from('activity').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(50),
        supabase.from('time_entries').select('*').eq('org_id', orgId).order('clock_in', { ascending: false }).limit(100),
      ]);

      if (cust.data) setCustomers(snakeToCamel(cust.data));
      if (quot.data) setQuotes(snakeToCamel(quot.data));
      if (jb.data) setJobs(snakeToCamel(jb.data));
      if (cal.data) setCalendarEvents(snakeToCamel(cal.data));
      if (team.data) setTeamMembers(snakeToCamel(team.data));
      if (act.data) setActivity(snakeToCamel(act.data));
      if (te.data) setTimeEntries(snakeToCamel(te.data));
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
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }

  // ─── Getters ────────────────────────────────────────────
  const getCustomer = useCallback((id) => customers.find(c => c.id === id) || null, [customers]);
  const getQuote = useCallback((id) => quotes.find(q => q.id === id) || null, [quotes]);
  const getJob = useCallback((id) => jobs.find(j => j.id === id) || null, [jobs]);
  const getTeamMember = useCallback((id) => teamMembers.find(m => m.id === id) || null, [teamMembers]);

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
    if (connected) {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
    }
    setCustomers(prev => {
      const next = prev.filter(c => c.id !== id);
      if (!connected) saveLocal('customers', next);
      return next;
    });
  }, [connected]);

  // ─── Quote CRUD ─────────────────────────────────────────
  const addQuote = useCallback(async (data) => {
    if (connected) {
      const { data: row, error } = await supabase.from('quotes')
        .insert({ ...camelToSnake(data), org_id: orgId })
        .select().single();
      if (error) throw error;
      const q = snakeToCamel(row);
      setQuotes(prev => [q, ...prev]);
      return q;
    } else {
      const q = { ...data, id: crypto.randomUUID(), orgId, createdAt: new Date().toISOString() };
      setQuotes(prev => { const next = [q, ...prev]; saveLocal('quotes', next); return next; });
      return q;
    }
  }, [connected, orgId]);

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
    if (connected) {
      const { error } = await supabase.from('jobs').update(camelToSnake(data)).eq('id', id);
      if (error) throw error;
    }
    setJobs(prev => {
      const next = prev.map(j => j.id === id ? { ...j, ...data } : j);
      if (!connected) saveLocal('jobs', next);
      return next;
    });
  }, [connected]);

  const deleteJob = useCallback(async (id) => {
    if (connected) {
      const { error } = await supabase.from('jobs').delete().eq('id', id);
      if (error) throw error;
    }
    setJobs(prev => {
      const next = prev.filter(j => j.id !== id);
      if (!connected) saveLocal('jobs', next);
      return next;
    });
  }, [connected]);

  // ─── Convert Quote → Job ───────────────────────────────
  const convertQuoteToJob = useCallback(async ({ quoteId, scheduledDate, scheduledTime, crewNotes, assignedTo }) => {
    const quote = getQuote(quoteId);
    if (!quote) return null;
    const customer = quote.customerId ? getCustomer(quote.customerId) : null;

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
      estimatedDuration: '4 hours',
      assignedTo: assignedTo || [],
      crewNotes: crewNotes || '',
      total: quote.total || 0,
      priority: 'normal',
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

  // ─── Time Entries ───────────────────────────────────────
  const clockIn = useCallback(async (memberId) => {
    const entry = {
      teamMemberId: memberId,
      clockIn: new Date().toISOString(),
    };
    if (connected) {
      const { data: row, error } = await supabase.from('time_entries')
        .insert({ ...camelToSnake(entry), org_id: orgId })
        .select().single();
      if (error) throw error;
      const te = snakeToCamel(row);
      setTimeEntries(prev => [te, ...prev]);
      return te;
    } else {
      const te = { ...entry, id: crypto.randomUUID(), orgId };
      setTimeEntries(prev => { const next = [te, ...prev]; saveLocal('time_entries', next); return next; });
      return te;
    }
  }, [connected, orgId]);

  const clockOut = useCallback(async (entryId) => {
    const now = new Date().toISOString();
    if (connected) {
      const { error } = await supabase.from('time_entries').update({ clock_out: now }).eq('id', entryId);
      if (error) throw error;
    }
    setTimeEntries(prev => {
      const next = prev.map(t => t.id === entryId ? { ...t, clockOut: now } : t);
      if (!connected) saveLocal('time_entries', next);
      return next;
    });
  }, [connected]);

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

  // ─── Context value ──────────────────────────────────────
  const value = {
    // State
    customers, quotes, jobs, calendarEvents, teamMembers,
    activity, timeEntries, jobMedia, loading,

    // Getters
    getCustomer, getQuote, getJob, getTeamMember,

    // Customers
    addCustomer, updateCustomer, deleteCustomer,

    // Quotes
    addQuote, updateQuote,

    // Jobs
    addJob, updateJob, deleteJob, convertQuoteToJob,

    // Calendar
    addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,

    // Activity
    addActivity,

    // Time
    clockIn, clockOut,

    // Team
    addTeamMember, updateTeamMember,

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
