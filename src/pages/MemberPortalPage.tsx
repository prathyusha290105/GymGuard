import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Calendar,
  Clock,
  DollarSign,
  Bell,
  AlertTriangle,
  Fingerprint,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ChevronRight,
  User,
} from 'lucide-react';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { Member, Membership, AttendanceRecord, Payment, AppNotification } from '../types';
import { Badge } from '../components/common/Badge';
import { getDaysRemaining, formatTimeDisplay } from '../utils/dateUtils';

interface MemberPortalPageProps {
  initialSubTab?: string;
}

export const MemberPortalPage: React.FC<MemberPortalPageProps> = ({ initialSubTab }) => {
  const { currentUser, currentGym } = useAuth();
  const gymId = currentGym?.gymId || 'gym-01';
  const memberId = currentUser?.memberId || 'mem-001';

  const [member, setMember] = useState<Member | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'card' | 'attendance' | 'payments' | 'notifications' | 'profile'>('card');

  useEffect(() => {
    if (initialSubTab) {
      if (initialSubTab === 'member-membership') setActiveTab('card');
      else if (initialSubTab === 'member-attendance') setActiveTab('attendance');
      else if (initialSubTab === 'member-payments') setActiveTab('payments');
      else if (initialSubTab === 'member-notifications') setActiveTab('notifications');
      else if (initialSubTab === 'member-profile') setActiveTab('profile');
    }
  }, [initialSubTab]);

  useEffect(() => {
    const fetchMemberData = async () => {
      setLoading(true);
      try {
        const mDoc = await getDoc(doc(db, 'members', memberId));
        if (mDoc.exists()) setMember(mDoc.data() as Member);

        const mshpSnap = await getDocs(
          query(collection(db, 'memberships'), where('gymId', '==', gymId), where('memberId', '==', memberId))
        );
        if (!mshpSnap.empty) {
          const list = mshpSnap.docs.map(d => d.data() as Membership);
          list.sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
          setMembership(list[0]);
        }

        const attSnap = await getDocs(
          query(collection(db, 'attendance'), where('gymId', '==', gymId), where('memberId', '==', memberId))
        );
        setAttendance(attSnap.docs.map(d => d.data() as AttendanceRecord));

        const paySnap = await getDocs(
          query(collection(db, 'payments'), where('gymId', '==', gymId), where('memberId', '==', memberId))
        );
        setPayments(paySnap.docs.map(d => d.data() as Payment));

        const notifSnap = await getDocs(
          query(collection(db, 'notifications'), where('gymId', '==', gymId), where('recipientId', '==', memberId))
        );
        setNotifications(notifSnap.docs.map(d => d.data() as AppNotification));
      } catch (e) {
        console.error('Error fetching member portal data', e);
      } finally {
        setLoading(false);
      }
    };
    fetchMemberData();
  }, [gymId, memberId]);

  if (loading) {
    return <div className="text-xs text-zinc-400 py-10 text-center">Loading member dashboard...</div>;
  }

  const daysRemaining = membership ? getDaysRemaining(membership.endDate) : -999;
  const isExpired = membership?.status === 'EXPIRED' || daysRemaining < 0;
  const isExpiringSoon = membership?.status === 'EXPIRING_SOON' || (daysRemaining >= 0 && daysRemaining <= 7);

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Welcome, {member?.fullName || currentUser?.fullName || 'Athlete'}!
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            {currentGym?.name || 'GymGuard Elite Fitness'} &bull; Biometric Key ID: {member?.biometricTemplateId || 'ENROLLED'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge status={membership?.status || 'ACTIVE'} type="membership" />
        </div>
      </div>

      {/* Prominent Warning if Expired (Section 28) */}
      {isExpired && (
        <div className="p-4 bg-rose-500/15 border-2 border-rose-500/40 rounded-2xl text-rose-300 flex items-start gap-3.5 shadow-lg shadow-rose-950/30">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-white text-sm">
              Your membership has expired. Turnstile access is currently locked.
            </h3>
            <p className="text-xs text-rose-200 mt-0.5">
              Please contact the front desk or renew your subscription to regain automatic biometric door entry.
            </p>
          </div>
        </div>
      )}

      {/* Expiring Soon Alert */}
      {isExpiringSoon && !isExpired && (
        <div className="p-4 bg-amber-500/15 border-2 border-amber-500/40 rounded-2xl text-amber-300 flex items-start gap-3.5 shadow-lg shadow-amber-950/30">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-white text-sm">
              Membership expiring in {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} ({membership?.endDate})!
            </h3>
            <p className="text-xs text-amber-200 mt-0.5">
              Renew today to avoid interruption at the entrance turnstiles.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 overflow-x-auto text-xs">
        {[
          { id: 'card', label: 'Membership Card' },
          { id: 'attendance', label: 'My Attendance' },
          { id: 'payments', label: 'My Payments' },
          { id: 'notifications', label: 'My Notifications' },
          { id: 'profile', label: 'Profile' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-3.5 py-2 rounded-xl font-semibold transition-colors ${
              activeTab === t.id
                ? 'bg-emerald-500 text-zinc-950 font-bold'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Digital Membership Card */}
      {activeTab === 'card' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Visual NFC / Biometric Card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-950 to-emerald-950/40 border border-zinc-800 p-6 shadow-2xl flex flex-col justify-between min-h-[220px]">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-emerald-400 uppercase">
                  GYMGUARD DIGITAL PASS
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">{member?.fullName}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Fingerprint className="w-6 h-6" />
              </div>
            </div>

            <div className="my-4">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs text-zinc-400">Plan Tier:</span>
                <span className="text-sm font-bold text-white">{membership?.planName || 'Standard'}</span>
              </div>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-zinc-400">Valid Until:</span>
                <span className="font-mono text-zinc-200">{membership?.endDate || 'N/A'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80">
              <span className="text-[10px] font-mono text-zinc-500">
                ID: {member?.memberId}
              </span>
              <Badge status={membership?.status || 'ACTIVE'} type="membership" />
            </div>
          </div>

          {/* Subscription Details Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
                Biometric Turnstile Credentials
              </h4>
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850 flex justify-between items-center">
                  <span className="text-zinc-400">Fingerprint Status:</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Enrolled & Active
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850 flex justify-between items-center">
                  <span className="text-zinc-400">Days Remaining:</span>
                  <span className={`font-mono font-bold text-sm ${
                    isExpired ? 'text-rose-400' : isExpiringSoon ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {isExpired ? 'EXPIRED' : `${daysRemaining} Days`}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-zinc-400 bg-zinc-950 p-3 rounded-xl border border-zinc-850">
              Hold your registered finger on the turnstile glass scanner at the front entrance for instantaneous magnetic door release.
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Attendance */}
      {activeTab === 'attendance' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Workout Attendance Log</h3>
          <div className="space-y-2">
            {attendance.length === 0 ? (
              <p className="text-xs text-zinc-500 py-6 text-center">No attendance history yet.</p>
            ) : (
              attendance.map(a => (
                <div key={a.attendanceId} className="p-3 rounded-xl bg-zinc-950 border border-zinc-850 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-white">Turnstile Check-In: {formatTimeDisplay(a.checkInTime)}</span>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Date: {a.checkInTime.split('T')[0]}</p>
                  </div>
                  <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
                    {a.status === 'INSIDE' ? 'Currently Inside' : `${a.durationMinutes || 0} mins workout`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Payments */}
      {activeTab === 'payments' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Payment Receipts</h3>
          <div className="space-y-2">
            {payments.length === 0 ? (
              <p className="text-xs text-zinc-500 py-6 text-center">No payment receipts on file.</p>
            ) : (
              payments.map(p => (
                <div key={p.paymentId} className="p-3 rounded-xl bg-zinc-950 border border-zinc-850 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-white">${p.amount} &bull; {p.paymentMethod}</span>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{p.paymentDate} &bull; {p.transactionId}</p>
                  </div>
                  <span className="text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {p.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Notifications */}
      {activeTab === 'notifications' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Personal Alerts</h3>
          <div className="space-y-2">
            {notifications.length === 0 ? (
              <p className="text-xs text-zinc-500 py-6 text-center">No alerts for your account.</p>
            ) : (
              notifications.map(n => (
                <div key={n.notificationId} className="p-3 rounded-xl bg-zinc-950 border border-zinc-850 text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">{n.title}</span>
                    <span className="text-[10px] font-mono text-zinc-500">{formatTimeDisplay(n.createdAt)}</span>
                  </div>
                  <p className="text-zinc-300 leading-snug">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Profile */}
      {activeTab === 'profile' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm space-y-3 text-xs">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Member Details</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850">
              <span className="text-zinc-500 block">Phone</span>
              <span className="font-semibold text-white">{member?.phone}</span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850">
              <span className="text-zinc-500 block">Email</span>
              <span className="font-semibold text-white">{member?.email}</span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850">
              <span className="text-zinc-500 block">Joined</span>
              <span className="font-semibold text-white">{member?.joiningDate}</span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850">
              <span className="text-zinc-500 block">Emergency Contact</span>
              <span className="font-semibold text-white">{member?.emergencyContactName || 'N/A'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
