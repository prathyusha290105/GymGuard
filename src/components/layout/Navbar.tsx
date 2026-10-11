import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Bell,
  Lock,
  Unlock,
  AlertTriangle,
  LogOut,
  User as UserIcon,
  ChevronDown,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { mockDoorController } from '../../services/hardware/MockDoorController';
import { notificationService } from '../../services/notifications/notificationService';
import { AppNotification, DoorState } from '../../types';
import { formatTimeDisplay } from '../../utils/dateUtils';

interface NavbarProps {
  onOpenNotifications?: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { currentUser, currentGym, logout, loginWithDemo, seedDatabaseIfNeeded } = useAuth();
  const [doorState, setDoorState] = useState<DoorState>('LOCKED');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    const unsub = mockDoorController.subscribeState((st) => setDoorState(st));
    return () => unsub();
  }, []);

  const loadNotifs = async () => {
    if (!currentUser) return;
    try {
      const recipientId = currentUser.role === 'MEMBER' && currentUser.memberId
        ? currentUser.memberId
        : currentUser.gymId;
      const list = await notificationService.getNotifications(recipientId, 10);
      setNotifications(list);
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    loadNotifs();
    const interval = setInterval(loadNotifs, 10000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleResetData = async () => {
    setSeeding(true);
    await seedDatabaseIfNeeded();
    setSeeding(false);
  };

  return (
    <header className="h-16 bg-zinc-900/90 backdrop-blur border-b border-zinc-800 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Brand & Facility Info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab(currentUser?.role === 'MEMBER' ? 'member-portal' : 'dashboard')}>
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-base tracking-wide">GYMGUARD</span>
              <span className="text-[10px] font-mono uppercase bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">
                PRO BIOMETRIC
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 hidden sm:block">
              {currentGym?.name || 'Smart Gym Management'}
            </p>
          </div>
        </div>
      </div>

      {/* Right Controls: Door indicator, Quick Demo Switcher, Notifications, User */}
      <div className="flex items-center gap-3">
        {/* Live Door State Visual Indicator */}
        <div
          onClick={() => setActiveTab('hardware-test')}
          title="Click to view Hardware Controller Test Center"
          className={`cursor-pointer px-2.5 py-1 rounded-full text-xs font-mono flex items-center gap-1.5 border transition-all ${
            doorState === 'UNLOCKED'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 ring-2 ring-emerald-500/30 animate-pulse'
              : doorState === 'UNLOCKING'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
              : doorState === 'ERROR' || doorState === 'OFFLINE'
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
          }`}
        >
          {doorState === 'UNLOCKED' ? (
            <>
              <Unlock className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold text-emerald-300">DOOR UNLOCKED</span>
            </>
          ) : doorState === 'UNLOCKING' ? (
            <>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>RELAY TRIPPED</span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden md:inline">DOOR SECURED</span>
            </>
          )}
        </div>

        {/* Demo Role Switcher */}
        <div className="hidden lg:flex items-center bg-zinc-950/70 p-0.5 rounded-lg border border-zinc-800 text-xs">
          <span className="text-[10px] text-zinc-400 uppercase font-mono px-2">Role:</span>
          <button
            onClick={() => {
              loginWithDemo('OWNER');
              setActiveTab('dashboard');
            }}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              currentUser?.role === 'GYM_OWNER'
                ? 'bg-emerald-500 text-zinc-950 font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Owner
          </button>
          <button
            onClick={() => {
              loginWithDemo('STAFF');
              setActiveTab('dashboard');
            }}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              currentUser?.role === 'STAFF'
                ? 'bg-emerald-500 text-zinc-950 font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Staff
          </button>
          <button
            onClick={() => {
              loginWithDemo('MEMBER');
              setActiveTab('member-portal');
            }}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              currentUser?.role === 'MEMBER'
                ? 'bg-emerald-500 text-zinc-950 font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Member
          </button>
        </div>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-750 text-zinc-300 border border-zinc-700/60 relative"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Notifications ({unreadCount} unread)
                </span>
                <button
                  onClick={() => {
                    setShowNotifMenu(false);
                    setActiveTab('notifications');
                  }}
                  className="text-xs text-emerald-400 hover:underline"
                >
                  View All
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2">
                {notifications.length === 0 ? (
                  <p className="text-xs text-zinc-400 py-4 text-center">No notifications</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.notificationId}
                      onClick={() => {
                        notificationService.markAsRead(n.notificationId);
                        setNotifications((prev) =>
                          prev.map((item) =>
                            item.notificationId === n.notificationId ? { ...item, read: true } : item
                          )
                        );
                      }}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        n.read
                          ? 'bg-zinc-850/50 border-zinc-800 text-zinc-400'
                          : 'bg-zinc-800/90 border-emerald-500/30 text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-white">{n.title}</span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {formatTimeDisplay(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-snug">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Badge / Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-zinc-800">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-white leading-tight">{currentUser?.fullName}</p>
            <p className="text-[10px] font-mono text-zinc-400">{currentUser?.role}</p>
          </div>
          <button
            onClick={logout}
            title="Log Out"
            className="p-2 rounded-lg bg-zinc-800/80 hover:bg-rose-500/20 hover:text-rose-400 text-zinc-400 border border-zinc-700/60 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
