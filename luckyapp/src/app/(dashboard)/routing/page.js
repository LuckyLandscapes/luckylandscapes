'use client';

import { useEffect, useMemo, useState } from 'react';
import { useData } from '@/lib/data';
import { Route, MapPin, ArrowRight, ExternalLink, Play, Loader2 } from 'lucide-react';
import {
  composeAddress,
  nearestNeighborTsp,
  geocodeBatch,
  googleMapsRouteUrl,
} from '@/lib/routeOptimizer';
import AddressLink from '@/components/AddressLink';

const SHOP_ADDRESS_KEY = 'lucky_routing_shop_address';

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export default function RoutingPage() {
  const { jobs, getCustomer, calendarEvents } = useData();
  const [date, setDate] = useState(todayISO());
  const [shopAddress, setShopAddress] = useState('');
  const [geocodeStatus, setGeocodeStatus] = useState({ running: false, current: 0, total: 0 });
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [error, setError] = useState(null);

  // Pull shop address from localStorage on mount — once Riley sets it, it
  // sticks across sessions. (Could move to organization settings later.)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem(SHOP_ADDRESS_KEY);
      if (saved) setShopAddress(saved);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (shopAddress) window.localStorage.setItem(SHOP_ADDRESS_KEY, shopAddress);
    } catch { /* noop */ }
  }, [shopAddress]);

  // Find every stop scheduled for the selected date: jobs with that
  // scheduledDate, plus calendar events that have a customer attached.
  const stopsForDate = useMemo(() => {
    const out = [];
    for (const j of jobs) {
      if (!j.scheduledDate) continue;
      // jobs.scheduledDate may be a string OR an array (workdaySet)
      const dates = Array.isArray(j.scheduledDate) ? j.scheduledDate : [j.scheduledDate];
      if (!dates.includes(date)) continue;
      const customer = getCustomer(j.customerId);
      const address = composeAddress(customer);
      if (!address) continue;
      out.push({
        id: `job-${j.id}`,
        kind: 'job',
        jobId: j.id,
        label: customer ? `${customer.firstName} ${customer.lastName || ''}`.trim() : 'Job',
        sub: j.title || j.category || '',
        time: j.scheduledTime || null,
        address,
      });
    }
    for (const e of calendarEvents) {
      if (e.date !== date) continue;
      if (e.jobId) continue; // already counted via the job
      if (!e.customerId) continue;
      const customer = getCustomer(e.customerId);
      const address = composeAddress(customer);
      if (!address) continue;
      out.push({
        id: `event-${e.id}`,
        kind: 'event',
        label: customer ? `${customer.firstName} ${customer.lastName || ''}`.trim() : 'Event',
        sub: e.title || '',
        time: e.startTime || null,
        address,
      });
    }
    return out;
  }, [jobs, calendarEvents, getCustomer, date]);

  const handleOptimize = async () => {
    setError(null);
    setOptimizedRoute(null);
    if (stopsForDate.length === 0) {
      setError('No stops scheduled for this date.');
      return;
    }
    if (!shopAddress) {
      setError('Set your shop / starting address before optimizing.');
      return;
    }

    setGeocodeStatus({ running: true, current: 0, total: stopsForDate.length + 1 });
    const addresses = [shopAddress, ...stopsForDate.map(s => s.address)];
    const geocoded = await geocodeBatch(addresses, {
      onProgress: (i, total) => setGeocodeStatus({ running: true, current: i, total }),
    });
    setGeocodeStatus({ running: false, current: 0, total: 0 });

    const failed = geocoded.filter(g => g.error);
    if (geocoded[0].error) {
      setError(`Could not geocode shop address "${shopAddress}". Check spelling.`);
      return;
    }
    const validCoords = geocoded.map((g, i) => ({
      ...g,
      label: i === 0 ? 'Shop' : stopsForDate[i - 1].label,
      sub: i === 0 ? 'starting point' : stopsForDate[i - 1].sub,
      time: i === 0 ? null : stopsForDate[i - 1].time,
      stop: i === 0 ? null : stopsForDate[i - 1],
    })).filter(g => g.lat != null && g.lng != null);

    if (validCoords.length < 2) {
      setError('Not enough valid addresses geocoded to plan a route.');
      return;
    }

    const { order, totalMiles } = nearestNeighborTsp(validCoords, 0);
    const orderedStops = order.map(idx => validCoords[idx]);

    setOptimizedRoute({
      stops: orderedStops,
      totalMiles,
      failed,
      mapUrl: googleMapsRouteUrl(orderedStops.map(s => s.address)),
    });
  };

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1><Route size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Route Optimizer</h1>
          <p style={{ color: 'var(--text-tertiary)' }}>
            Order today&apos;s stops by nearest-neighbor for the shortest mowing/job route.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Date</label>
            <input
              type="date"
              className="form-input"
              value={date}
              onChange={(e) => { setDate(e.target.value); setOptimizedRoute(null); }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Shop / starting address</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 1234 Pine St, Lincoln, NE 68501"
              value={shopAddress}
              onChange={(e) => setShopAddress(e.target.value)}
            />
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleOptimize}
          disabled={geocodeStatus.running || stopsForDate.length === 0 || !shopAddress}
        >
          {geocodeStatus.running ? (
            <>
              <Loader2 size={16} className="spin" />
              Geocoding ({geocodeStatus.current}/{geocodeStatus.total})…
            </>
          ) : (
            <>
              <Play size={16} /> Optimize {stopsForDate.length} stop{stopsForDate.length === 1 ? '' : 's'}
            </>
          )}
        </button>

        {error && (
          <p style={{ color: 'var(--status-danger)', marginTop: 'var(--space-sm)', fontSize: '0.85rem' }}>
            {error}
          </p>
        )}
      </div>

      {/* Stops list — pre-optimization */}
      {!optimizedRoute && (
        <div className="card">
          <h4 style={{ marginBottom: 'var(--space-md)' }}>
            Scheduled stops for {date} — {stopsForDate.length}
          </h4>
          {stopsForDate.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)' }}>
              Nothing scheduled. Pick a different date or schedule jobs from the calendar.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {stopsForDate.map((s) => (
                <li key={s.id} style={{ padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--border-primary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MapPin size={14} style={{ color: 'var(--text-tertiary)' }} />
                    <strong>{s.label}</strong>
                    {s.time && <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>· {s.time}</span>}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginLeft: 22 }}>
                    <AddressLink query={s.address}>{s.address}</AddressLink>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Optimized route */}
      {optimizedRoute && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
            <h4 style={{ margin: 0 }}>
              Optimized route — ~{optimizedRoute.totalMiles.toFixed(1)} mi straight-line
            </h4>
            {optimizedRoute.mapUrl && (
              <a className="btn btn-primary btn-sm" href={optimizedRoute.mapUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} /> Open in Google Maps
              </a>
            )}
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }}>
            Straight-line miles. Actual driving will be ~1.2-1.5× this for grid-style cities like Lincoln.
            Order is the suggested path — adjust manually for traffic, school zones, or service-time preferences.
          </p>

          <ol style={{ paddingLeft: 'var(--space-lg)' }}>
            {optimizedRoute.stops.map((s, i) => (
              <li key={`${s.address}-${i}`} style={{ padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--border-primary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong>{s.label}</strong>
                  {s.time && <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>· {s.time}</span>}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                  <AddressLink query={s.address}>{s.address}</AddressLink>
                </div>
                {s.sub && <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{s.sub}</div>}
              </li>
            ))}
          </ol>

          {optimizedRoute.failed.length > 0 && (
            <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)', background: 'rgba(220, 38, 38, 0.08)', borderRadius: 'var(--radius-md)' }}>
              <strong style={{ color: 'var(--status-danger)' }}>Could not geocode:</strong>
              <ul style={{ margin: '4px 0 0 16px', fontSize: '0.85rem' }}>
                {optimizedRoute.failed.map((f, i) => (
                  <li key={i}>{f.address}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
