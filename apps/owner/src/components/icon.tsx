import {
  BedDouble,
  Building2,
  ChartColumn,
  DoorOpen,
  IdCard,
  Inbox,
  IndianRupee,
  LayoutDashboard,
  Megaphone,
  Settings,
  Sparkles,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  'layout-dashboard': LayoutDashboard,
  'building-2': Building2,
  'bed-double': BedDouble,
  users: Users,
  'indian-rupee': IndianRupee,
  wrench: Wrench,
  'door-open': DoorOpen,
  inbox: Inbox,
  sparkles: Sparkles,
  megaphone: Megaphone,
  'id-card': IdCard,
  'chart-column': ChartColumn,
  settings: Settings,
};

export function NavIcon({ name, size = 17 }: { name: string; size?: number }) {
  const I = ICONS[name] ?? LayoutDashboard;
  return <I size={size} strokeWidth={1.9} />;
}
