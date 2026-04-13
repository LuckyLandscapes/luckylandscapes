'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import {
  LayoutDashboard,
  Users,
  FileText,
  Palette,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { label: 'Navigation', type: 'section' },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/quotes', label: 'Quotes', icon: FileText, badgeKey: 'draftQuotes' },
  { href: '/catalog', label: 'Material Catalog', icon: Palette },
  { label: 'System', type: 'section' },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { quotes } = useData();
  const [mobileOpen, setMobileOpen] = useState(false);

  const draftQuotes = quotes.filter(q => q.status === 'draft').length;
  const badges = { draftQuotes: draftQuotes || null };

  const initials = user?.fullName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || '??';

  return (
    <>
      {/* Mobile Toggle */}
      <button
        className="sidebar-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        style={{ display: undefined }}
      >
        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 99, display: 'none',
          }}
          className="sidebar-mobile-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-header">
          <div style={{ fontSize: '1.75rem' }}>🍀</div>
          <div className="sidebar-brand">
            <span className="sidebar-brand-name">Lucky App</span>
            <span className="sidebar-brand-sub">{user?.orgName || 'Business Platform'}</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navItems.map((item, i) => {
            if (item.type === 'section') {
              return (
                <div key={i} className="sidebar-section-label">
                  {item.label}
                </div>
              );
            }

            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const badge = item.badgeKey ? badges[item.badgeKey] : null;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={20} />
                <span>{item.label}</span>
                {badge && <span className="sidebar-badge">{badge}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={logout}>
            <div className="sidebar-user-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.fullName}</div>
              <div className="sidebar-user-role">{user?.role}</div>
            </div>
            <LogOut size={16} style={{ color: 'var(--text-tertiary)' }} />
          </div>
        </div>
      </aside>
    </>
  );
}
