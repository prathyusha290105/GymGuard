import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  AlertCircle,
  Clock,
  DoorOpen,
  DollarSign,
  ArrowUpRight,
  RefreshCw,
  Bell,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import { AttendanceTrendChart, MembershipStatusChart, PeakHoursChart } from '../components/charts/SimpleCharts';
import { Member, Membership, AttendanceRecord, Payment } from '../types';
import { formatDateISO, getDaysRemaining, formatTimeDisplay, formatDuration } from '../utils/dateUtils';
import { membershipService } from '../services/membership/membershipService';

interface DashboardPageProps {
  onNavigate: (tab: string, meta?: any) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { currentGym } = useAuth();
  const gymId = currentGym?.gymId || 'gym-01';

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [insideRecords, setInsideRecords] = useState<AttendanceRecord[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);
  const [todayPayments, setTodayPayments] = useState<Payment[]>([]);
  const [runningJob, setRunningJob] = useState(false);
  const [jobResult, setJobResult] = useState<string | null>(null);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Members
      const membersSnap = await getDocs(query(collection(db, 'members'), where('gymId', '==', gymId)));
      const membersList = membersSnap.docs.map(d => d.data() as Member);
      setMembers(membersList);

      // 2. Memberships
      const mshpSnap = await getDocs(query(collection(db, 'memberships'), where('gymId', '==', gymId)));
      const mshpList = mshpSnap.docs.map(d => d.data() as Membership);
      setMemberships(mshpList);

      // 3. Attendance currently inside
      const insideSnap = await getDocs(
        query(collection(db, 'attendance'), where('gymId', '==', gymId), where('status', '==', 'INSIDE'))
      );
      setInsideRecords(insideSnap.docs.map(d => d.data() as AttendanceRecord));

      // 4. All today attendance
      const attSnap = await getDocs(query(collection(db, 'attendance'), where('gymId', '==', gymId)));
      const allAtt = attSnap.docs.map(d => d.data() as AttendanceRecord);
      const todayStr = formatDateISO();
      setTodayAttendance(allAtt.filter(a => a.checkInTime.startsWith(todayStr)));

      // 5. Payments
      const paySnap = await getDocs(query(collection(db, 'payments'), where('gymId', '==', gymId)));
      const allPay = paySnap.docs.map(d => d.data() as Payment);
      setTodayPayments(allPay);
    } catch (e) {
      console.warn('Dashboard data fetch encountered an issue, attempting re-seed or fallback', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [gymId]);

  // Calculations from real Firestore data
  const totalMembers = members.length;
  const activeMemberships = memberships.filter(m => m.status === 'ACTIVE').length;
  const expiringSoonMemberships = memberships.filter(m => m.status === 'EXPIRING_SOON').length;
  const expiredMemberships = memberships.filter(m => m.status === 'EXPIRED').length;
  const frozenCount = memberships.filter(m => m.status === 'FROZEN').length;
  const suspendedCount = memberships.filter(m => m.status === 'SUSPENDED').length;

  const todayCheckIns = todayAttendance.length;
  const todayCheckOuts = todayAttendance.filter(a => a.status === 'COMPLETED').length;
  const currentlyInsideCount = insideRecords.length;

  const todayRevenue = todayPayments
    .filter(p => p.status === 'PAID')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  // Expiring soon list
  const expiringSoonList = memberships
    .filter(m => {
      const days = getDaysRemaining(m.endDate);
      return days >= 0 && days <= 7;
    })
    .sort((a, b) => getDaysRemaining(a.endDate) - getDaysRemaining(b.endDate))
    .slice(0, 7);

  const handleRunDailyAutomation = async () => {
    setRunningJob(true);
    setJobResult(null);
    try {
      const res = await membershipService.runExpiryAutomationJob(gymId);
      setJobResult(
        `Job finished: Processed ${res.processed} memberships. Sent ${res.notificationsSent} alerts (${res.duplicatesPrevented} duplicates prevented).`
      );
      await loadDashboardData();
    } catch (err: any) {
      setJobResult(`Error running job: ${err?.message || err}`);
    } finally {
      setRunningJob(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              GYMGUARD Command Center
            </h1>
            <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
              Live Biometrics
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time biometric turnstile monitoring, automated expiry alerts, and tenant operations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunDailyAutomation}
            disabled={runningJob}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs rounded-xl shadow transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${runningJob ? 'animate-spin' : ''}`} />
            {runningJob ? 'Running Expiry Automation...' : 'Run Expiry Job Now'}
          </button>

          <button
            onClick={() => onNavigate('kiosk')}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs rounded-xl border border-zinc-700 transition-colors"
          >
            <DoorOpen className="w-3.5 h-3.5 text-emerald-400" />
            Launch Kiosk
          </button>
        </div>
      </div>

      {jobResult && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{jobResult}</span>
          </div>
          <button onClick={() => setJobResult(null)} className="text-zinc-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* 8 Primary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Members"
          value={totalMembers}
          subtitle="Registered profiles"
          icon={Users}
          variant="default"
        />
        <StatCard
          title="Active Members"
          value={activeMemberships}
          subtitle="Valid subscriptions"
          icon={UserCheck}
          variant="emerald"
        />
        <StatCard
          title="Expiring Soon"
          value={expiringSoonMemberships}
          subtitle="Within next 7 days"
          icon={AlertCircle}
          variant="amber"
        />
        <StatCard
          title="Expired"
          value={expiredMemberships}
          subtitle="Door locked on entry"
          icon={AlertCircle}
          variant="rose"
        />
        <StatCard
          title="Today's Check-Ins"
          value={todayCheckIns}
          subtitle="Fingerprint & kiosk"
          icon={Clock}
          variant="cyan"
        />
        <StatCard
          title="Today's Check-Outs"
          value={todayCheckOuts}
          subtitle="Recorded departures"
          icon={DoorOpen}
          variant="default"
        />
        <StatCard
          title="Currently Inside"
          value={currentlyInsideCount}
          subtitle="Live floor occupancy"
          icon={Users}
          variant="emerald"
        />
        <StatCard
          title="Total Revenue"
          value={`$${todayRevenue.toLocaleString()}`}
          subtitle="Lifetime receipts"
          icon={DollarSign}
          variant="emerald"
        />
      </div>

      {/* Grid: Expiring Soon Widget & Currently Inside */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Memberships Expiring Soon Table (Takes 2 cols) */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                  Memberships Expiring Soon
                </h2>
                <span className="bg-amber-500/10 text-amber-400 text-[10px] font-mono px-2 py-0.5 rounded-full border border-amber-500/20 font-semibold">
                  {expiringSoonMemberships} require attention
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Automated 7-day notification cadence is actively running.
              </p>
            </div>
            <button
              onClick={() => onNavigate('memberships')}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              View All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {expiringSoonList.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-400">
              No memberships expiring within the next 7 days.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-zinc-400 border-b border-zinc-800/80 pb-2">
                    <th className="py-2.5 font-medium">Member</th>
                    <th className="py-2.5 font-medium">Plan</th>
                    <th className="py-2.5 font-medium">Expiry Date</th>
                    <th className="py-2.5 font-medium text-center">Days Remaining</th>
                    <th className="py-2.5 font-medium">Status</th>
                    <th className="py-2.5 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {expiringSoonList.map((mshp) => {
                    const member = members.find(m => m.memberId === mshp.memberId);
                    const days = getDaysRemaining(mshp.endDate);
                    return (
                      <tr key={mshp.membershipId} className="hover:bg-zinc-850/50 transition-colors">
                        <td className="py-3 font-semibold text-white">
                          <button
                            onClick={() => onNavigate('members', { memberId: mshp.memberId })}
                            className="text-left hover:text-emerald-400 transition-colors"
                          >
                            {member?.fullName || mshp.memberId}
                            <span className="block text-[10px] font-normal text-zinc-400">
                              {member?.phone || mshp.memberId}
                            </span>
                          </button>
                        </td>
                        <td className="py-3 text-zinc-300">{mshp.planName}</td>
                        <td className="py-3 text-zinc-300 font-mono text-[11px]">{mshp.endDate}</td>
                        <td className="py-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                              days === 1
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {days} {days === 1 ? 'day' : 'days'}
                          </span>
                        </td>
                        <td className="py-3">
                          <Badge status={mshp.status} type="membership" />
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => onNavigate('memberships', { renewId: mshp.membershipId })}
                            className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded text-xs font-semibold border border-emerald-500/20 transition-colors"
                          >
                            Renew
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Currently Inside Widget (1 col) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                  Currently Inside
                </h2>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {currentlyInsideCount} On Premise
              </span>
            </div>

            {insideRecords.length === 0 ? (
              <p className="text-xs text-zinc-400 py-6 text-center">No members currently checked in.</p>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {insideRecords.map((att) => {
                  const checkInTime = new Date(att.checkInTime);
                  const elapsedMins = Math.max(1, Math.round((Date.now() - checkInTime.getTime()) / (1000 * 60)));
                  return (
                    <div
                      key={att.attendanceId}
                      className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs font-bold">
                          {att.memberName?.charAt(0) || 'M'}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white leading-tight">{att.memberName}</p>
                          <p className="text-[10px] text-zinc-400 font-mono">In: {formatTimeDisplay(att.checkInTime)}</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {formatDuration(elapsedMins)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigate('attendance')}
            className="w-full mt-4 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-medium rounded-xl border border-zinc-700 transition-colors text-center"
          >
            View Live Attendance Log
          </button>
        </div>
      </div>

      {/* Visual Analytics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Attendance Trend</h3>
            <span className="text-[10px] text-zinc-400">Last 7 Days</span>
          </div>
          <AttendanceTrendChart />
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Membership Health</h3>
            <span className="text-[10px] text-zinc-400">{memberships.length} Total</span>
          </div>
          <MembershipStatusChart
            stats={{
              active: activeMemberships,
              expiringSoon: expiringSoonMemberships,
              expired: expiredMemberships,
              frozen: frozenCount,
              suspended: suspendedCount,
            }}
          />
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Peak Gym Hours</h3>
            <span className="text-[10px] text-amber-400 font-semibold">Peak 5pm - 8pm</span>
          </div>
          <PeakHoursChart />
        </div>
      </div>
    </div>
  );
};
