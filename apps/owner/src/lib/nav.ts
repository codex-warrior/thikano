import type { StaffPermission } from '@thikano/domain';

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Hidden for members without this permission (the page itself also checks). */
  permission?: StaffPermission;
  ownerOnly?: boolean;
}

export const NAV: { group?: string; items: NavItem[] }[] = [
  { items: [{ href: '/', label: 'Dashboard', icon: 'layout-dashboard' }] },
  {
    group: 'Property',
    items: [
      { href: '/properties', label: 'Properties', icon: 'building-2', permission: 'inventory.read' },
      { href: '/rooms', label: 'Rooms & Beds', icon: 'bed-double', permission: 'inventory.read' },
      { href: '/residents', label: 'Residents', icon: 'users', permission: 'residents.read' },
    ],
  },
  {
    group: 'Money & care',
    items: [
      { href: '/rent', label: 'Rent & Payments', icon: 'indian-rupee', permission: 'rent.read' },
      { href: '/maintenance', label: 'Maintenance', icon: 'wrench', permission: 'maintenance.read' },
    ],
  },
  {
    group: 'Grow',
    items: [
      { href: '/vacancies', label: 'Vacancies', icon: 'door-open', permission: 'inventory.read' },
      { href: '/leads', label: 'Listings & Leads', icon: 'inbox', permission: 'leads.read' },
      { href: '/earnings', label: 'Services & Earnings', icon: 'sparkles', permission: 'earnings.read' },
    ],
  },
  {
    group: 'Run',
    items: [
      { href: '/notices', label: 'Notices', icon: 'megaphone', permission: 'notices.write' },
      { href: '/staff', label: 'Staff', icon: 'id-card', ownerOnly: true },
      { href: '/reports', label: 'Reports', icon: 'chart-column', permission: 'inventory.read' },
    ],
  },
  { items: [{ href: '/settings', label: 'Settings', icon: 'settings' }] },
];
