import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MembersPage } from './pages/MembersPage';
import { MembershipsPage } from './pages/MembershipsPage';
import { AttendancePage } from './pages/AttendancePage';
import { AccessControlKioskPage } from './pages/AccessControlKioskPage';
import { HardwareTestCenterPage } from './pages/HardwareTestCenterPage';
import { DevicesPage } from './pages/DevicesPage';
import { AccessLogsPage } from './pages/AccessLogsPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ReportsPage } from './pages/ReportsPage';
import { StaffPage } from './pages/StaffPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { MemberPortalPage } from './pages/MemberPortalPage';

function AppContent() {
  const { currentUser, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [navMeta, setNavMeta] = useState<any>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center animate-pulse">
          <span className="text-emerald-400 font-extrabold text-xl">G</span>
        </div>
        <p className="text-xs text-zinc-400 font-mono">Initializing GymGuard Security Architecture...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLoginSuccess={() => setActiveTab('dashboard')} />;
  }

  // Handle redirect if member logs in
  const isMember = currentUser.role === 'MEMBER';
  const effectiveTab = isMember && activeTab === 'dashboard' ? 'member-portal' : activeTab;

  const handleNavigate = (tab: string, meta?: any) => {
    setActiveTab(tab);
    setNavMeta(meta);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-zinc-950">
      <Navbar activeTab={effectiveTab} setActiveTab={setActiveTab} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeTab={effectiveTab} setActiveTab={setActiveTab} />

        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
          {effectiveTab === 'dashboard' && <DashboardPage onNavigate={handleNavigate} />}
          {effectiveTab === 'members' && (
            <MembersPage initialMemberId={navMeta?.memberId} onNavigate={handleNavigate} />
          )}
          {effectiveTab === 'memberships' && (
            <MembershipsPage initialRenewId={navMeta?.renewId} onNavigate={handleNavigate} />
          )}
          {effectiveTab === 'attendance' && <AttendancePage />}
          {effectiveTab === 'kiosk' && <AccessControlKioskPage />}
          {effectiveTab === 'hardware-test' && <HardwareTestCenterPage />}
          {effectiveTab === 'devices' && <DevicesPage />}
          {effectiveTab === 'access-logs' && <AccessLogsPage />}
          {effectiveTab === 'payments' && <PaymentsPage />}
          {effectiveTab === 'notifications' && <NotificationsPage />}
          {effectiveTab === 'reports' && <ReportsPage />}
          {effectiveTab === 'staff' && <StaffPage />}
          {effectiveTab === 'settings' && <SettingsPage />}
          {effectiveTab === 'audit-logs' && <AuditLogsPage />}

          {/* Member Portal routes */}
          {(effectiveTab === 'member-portal' ||
            effectiveTab === 'member-membership' ||
            effectiveTab === 'member-attendance' ||
            effectiveTab === 'member-payments' ||
            effectiveTab === 'member-notifications' ||
            effectiveTab === 'member-profile') && (
            <MemberPortalPage initialSubTab={effectiveTab} />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
