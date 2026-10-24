export interface NavItem {
  href: string;
  label: string;
  /** Economics & platform config: platform_admin only. */
  adminOnly?: boolean;
}

/** Admin navigation (docs/HABISTAT-ADMIN.md). */
export const NAV: { group?: string; items: NavItem[] }[] = [
  { items: [{ href: '/', label: 'Dashboard' }] },
  { group: 'Supply', items: [{ href: '/owners', label: 'Owners' }, { href: '/properties', label: 'Properties' }, { href: '/verification', label: 'Property Verification' }] },
  { group: 'People', items: [{ href: '/residents', label: 'Residents' }, { href: '/students', label: 'Students' }] },
  { group: 'Inventory', items: [{ href: '/listings', label: 'Listings' }] },
  { group: 'Marketplace', items: [{ href: '/leads', label: 'Leads' }, { href: '/bookings', label: 'Applications & Bookings' }] },
  { group: 'Services', items: [{ href: '/providers', label: 'Services & Providers', adminOnly: true }, { href: '/transactions', label: 'Transactions', adminOnly: true }, { href: '/revenue', label: 'Revenue', adminOnly: true }] },
  { group: 'Trust', items: [{ href: '/support', label: 'Support, Reviews & Disputes' }] },
  { group: 'Platform', items: [{ href: '/analytics', label: 'Reports & Analytics' }, { href: '/audit-logs', label: 'Audit Logs' }, { href: '/settings', label: 'Settings', adminOnly: true }] },
];
