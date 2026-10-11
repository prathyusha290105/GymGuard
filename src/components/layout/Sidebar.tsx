import React from 'react';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Clock,
  ScanFace,
  Cpu,
  Radio,
  FileText,
  DollarSign,
  Bell,
  BarChart3,
  UserCheck,
  Settings,
  ShieldAlert,
  User,
  Sparkles,
  Layers,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
  highlight?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { currentUser } = useAuth();
  const isMember = currentUser?.role === 'MEMBER';
  const isOwner = currentUser?.role === 'GYM_OWNER' || currentUser?.role === 'SUPER_ADMIN';

  const adminNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'memberships', label: 'Memberships & Plans', icon: Layers },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'kiosk', label: 'Entrance Kiosk', icon: ScanFace, highlight: true },
    { id: 'hardware-test', label: 'Hardware Test Center', icon: Cpu, highlight: true },
    { id: 'devices', label: 'Devices & Controllers', icon: Radio },
    { id: 'access-logs', label: 'Access Logs', icon: FileText },
    { id: 'payments', label: 'Payments', icon: DollarSign },
    { id: 'notifications', label: 'Notification Center', icon: Bell },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    ...(isOwner ? [{ id: 'staff', label: 'Staff Management', icon: UserCheck }] : []),
    { id: 'settings', label: 'Settings', icon: Settings },
    ...(isOwner ? [{ id: 'audit-logs', label: 'Audit Logs', icon: ShieldAlert }] : []),
  ];

  const memberNavItems: NavItem[] = [
    { id: 'member-portal', label: 'Member Portal', icon: LayoutDashboard },
    { id: 'member-membership', label: 'My Membership', icon: CreditCard },
    { id: 'member-attendance', label: 'My Attendance', icon: Clock },
    { id: 'member-payments', label: 'My Payments', icon: DollarSign },
    { id: 'member-notifications', label: 'Notifications', icon: Bell },
    { id: 'member-profile', label: 'My Profile', icon: User },
  ];

  const navItems = isMember ? memberNavItems : adminNavItems;

  return (
    <aside className="w-64 bg-zinc-900/95 border-r border-zinc-800 flex flex-col justify-between shrink-0 hidden md:flex">
      <div className="py-4 px-3 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-mono uppercase text-zinc-400 tracking-wider">
          {isMember ? 'MEMBER ACCOUNT' : 'FACILITY MANAGEMENT'}
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-500 text-zinc-950 font-semibold shadow-sm'
                    : item.highlight
                    ? 'text-emerald-400 hover:bg-zinc-800 hover:text-emerald-300'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-zinc-950' : item.highlight ? 'text-emerald-400' : 'text-zinc-400'}`} />
                <span className="truncate">{item.label}</span>
                {item.highlight && !isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Hardware simulator quick pill at bottom */}
      <div className="p-3 m-3 rounded-xl bg-zinc-950 border border-zinc-800">
        <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-white">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Biometric Access</span>
        </div>
        <p className="text-[11px] text-zinc-400 leading-relaxed mb-2.5">
          Run real authorization tests or enter entrance kiosk mode.
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setActiveTab('hardware-test')}
            className="w-full py-1.5 text-[10px] font-semibold text-center bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded border border-zinc-700 transition-colors"
          >
            Hardware Test
          </button>
          <button
            onClick={() => setActiveTab('kiosk')}
            className="w-full py-1.5 text-[10px] font-semibold text-center bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30 transition-colors"
          >
            Open Kiosk
          </button>
        </div>
      </div>
    </aside>
  );
};
