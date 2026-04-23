'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import {
  LayoutDashboard,
  Users,
  FileText,
  CalendarDays,
  Palette,
  Ruler,
  Settings,
  LogOut,
  Menu,
  X,
  MoreHorizontal,
  HardHat,
  Clock,
  UserCog,
  Briefcase,
} from 'lucide-react';
import { useState } from 'react';

// Owner/Admin navigation
const ownerNavItems = [
  { label: 'Navigation', type: 'section' },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner', 'admin'] },
  { href: '/customers', label: 'Customers', icon: Users, roles: ['owner', 'admin'] },
  { href: '/quotes', label: 'Quotes', icon: FileText, roles: ['owner', 'admin'], badgeKey: 'draftQuotes' },
  { href: '/jobs', label: 'Jobs', icon: Briefcase, roles: ['owner', 'admin'], badgeKey: 'activeJobs' },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays, roles: ['owner', 'admin'], badgeKey: 'todayEvents' },
  { href: '/catalog', label: 'Catalog', icon: Palette, roles: ['owner', 'admin'] },
  { href: '/measure', label: 'Measure', icon: Ruler, roles: ['owner', 'admin'] },
  { label: 'Management', type: 'section', roles: ['owner', 'admin'] },
  { href: '/team', label: 'Team & Payroll', icon: UserCog, roles: ['owner'] },
  { label: 'System', type: 'section' },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['owner', 'admin'] },
];

// Worker navigation
const workerNavItems = [
  { label: 'My Work', type: 'section' },
  { href: '/crew-dashboard', label: 'My Dashboard', icon: HardHat, roles: ['worker'] },
  { href: '/crew-schedule', label: 'My Schedule', icon: CalendarDays, roles: ['worker'] },
];

// Bottom nav for owners/admins
const ownerBottomNavItems = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/quotes', label: 'Quotes', icon: FileText },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
];

// Bottom nav for workers
const workerBottomNavItems = [
  { href: '/crew-dashboard', label: 'Home', icon: HardHat },
  { href: '/crew-schedule', label: 'Schedule', icon: CalendarDays },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout, isWorker } = useAuth();
  const { quotes, calendarEvents, jobs } = useData();
  const [mobileOpen, setMobileOpen] = useState(false);

  const draftQuotes = quotes.filter(q => q.status === 'draft').length;
  const activeJobs = jobs.filter(j => j.status === 'scheduled' || j.status === 'in_progress').length;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayEvents = calendarEvents.filter(e => e.date === todayStr).length
    + jobs.filter(j => j.scheduledDate === todayStr).length;
  const badges = { draftQuotes: draftQuotes || null, activeJobs: activeJobs || null, todayEvents: todayEvents || null };

  const initials = user?.fullName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || '??';

  // Choose nav items based on role
  const navItems = isWorker ? workerNavItems : ownerNavItems;
  const bottomNavItems = isWorker ? workerBottomNavItems : ownerBottomNavItems;

  // Role display label
  const roleLabel = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '';

  return (
    <>
      {/* Overlay */}
      {mobileOpen && (
        <div
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
          {/* Mobile close button inside sidebar */}
          <button
            className="sidebar-close-btn"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
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
              <div className="sidebar-user-role">{roleLabel}</div>
            </div>
            <LogOut size={16} style={{ color: 'var(--text-tertiary)' }} />
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav">
        {bottomNavItems.map(item => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          className={`mobile-bottom-nav-item ${mobileOpen ? 'active' : ''}`}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
