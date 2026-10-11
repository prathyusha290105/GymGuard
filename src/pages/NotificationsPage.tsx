import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCheck,
  Send,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Mail,
  MessageSquare,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { AppNotification, Member, Membership } from '../types';
import { notificationService } from '../services/notifications/notificationService';
import { membershipService } from '../services/membership/membershipService';
import { formatTimeDisplay, formatDateISO } from '../utils/dateUtils';

export const NotificationsPage: React.FC = () => {
  const { currentGym, currentUser } = useAuth();
  const gymId = currentGym?.gymId || 'gym-01';

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);

  // Test Center State (Section 38)
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [testDaysRemaining, setTestDaysRemaining] = useState<number>(7);
  const [testResult, setTestResult] = useState<{
    sent: boolean;
    isDuplicate: boolean;
    recipient: string;
    message: string;
    key: string;
  } | null>(null);

  // Batch Job State
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchSummary, setBatchSummary] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await notificationService.getGymNotifications(gymId, 100);
      setNotifications(list);

      const memSnap = await getDocs(query(collection(db, 'members'), where('gymId', '==', gymId)));
      const memList = memSnap.docs.map(d => d.data() as Member);
      setMembers(memList);
      if (memList.length > 0 && !selectedMemberId) {
        setSelectedMemberId(memList[0].memberId);
      }

      const mshpSnap = await getDocs(query(collection(db, 'memberships'), where('gymId', '==', gymId)));
      setMemberships(mshpSnap.docs.map(d => d.data() as Membership));
    } catch (e) {
      console.error('Error fetching notifications', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [gymId]);

  const handleMarkAllRead = async () => {
    await notificationService.markAllAsRead(gymId);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleRunBatchExpiryJob = async () => {
    setBatchLoading(true);
    setBatchSummary(null);
    try {
      const res = await membershipService.runExpiryAutomationJob(gymId);
      setBatchSummary(
        `Automated Job Completed: Evaluated ${res.processed} memberships. Sent ${res.notificationsSent} alerts. Filtered out ${res.duplicatesPrevented} duplicate triggers.`
      );
      await loadData();
    } catch (err: any) {
      setBatchSummary(`Batch job error: ${err.message || err}`);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleTestExpiryNotification = async () => {
    const member = members.find(m => m.memberId === selectedMemberId);
    if (!member) return;

    const mshp = memberships.find(m => m.memberId === member.memberId);
    const todayStr = formatDateISO();
    const expiryDate = mshp?.endDate || '2026-10-15';

    let title = '';
    let message = '';
    let type = '';

    if (testDaysRemaining <= 0) {
      title = 'Membership Expired';
      message = 'Your gym membership has expired. Please renew your membership to regain gym access.';
      type = 'MEMBERSHIP_EXPIRED';
    } else if (testDaysRemaining === 1) {
      title = 'Membership Expiring (1 day left)';
      message = 'Your gym membership expires tomorrow. Please renew your membership to continue accessing the gym.';
      type = 'MEMBERSHIP_EXPIRING_SOON';
    } else {
      title = `Membership Expiring (${testDaysRemaining} days left)`;
      message = `Your GymGuard membership expires in ${testDaysRemaining} days on ${expiryDate}. Please renew your membership to continue accessing the gym.`;
      type = 'MEMBERSHIP_EXPIRING_SOON';
    }

    const notificationKey = `${mshp?.membershipId || 'test'}_TEST_${testDaysRemaining}DAYS_${todayStr}`;

    const res = await notificationService.sendNotification({
      gymId,
      recipientId: member.memberId,
      recipientRole: 'MEMBER',
      channel: 'IN_APP',
      type,
      title,
      message,
      notificationKey,
      recipientContact: {
        email: member.email,
        phone: member.phone,
      },
    });

    setTestResult({
      sent: res.sent,
      isDuplicate: res.isDuplicate,
      recipient: `${member.fullName} (${member.email})`,
      message,
      key: notificationKey,
    });

    await loadData();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Notification & Expiry Automation Center
            </h1>
            <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
              {unreadCount} Unread
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Automated 7-day expiry warnings, email/SMS provider dispatch, and idempotent notification testing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-semibold rounded-xl border border-zinc-700 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" /> Mark All Read
          </button>
          <button
            onClick={handleRunBatchExpiryJob}
            disabled={batchLoading}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold rounded-xl shadow transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${batchLoading ? 'animate-spin' : ''}`} />
            Run Daily Expiry Job
          </button>
        </div>
      </div>

      {batchSummary && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{batchSummary}</span>
          </div>
          <button onClick={() => setBatchSummary(null)} className="text-zinc-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* Split: Notification Test Center (Section 38) & Provider Channels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Test Center (Section 37 & 38) */}
        <div className="lg:col-span-5 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Notification Test Center
            </h3>
          </div>
          <p className="text-xs text-zinc-400">
            Select any member and expiry countdown day to simulate the exact notification and verify duplicate suppression.
          </p>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-zinc-400 block mb-1">Target Member</label>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              >
                {members.map(m => (
                  <option key={m.memberId} value={m.memberId}>
                    {m.fullName} ({m.memberId})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-zinc-400 block mb-1">Days Remaining Countdown</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[7, 6, 5, 4, 3, 2, 1, 0].map((d) => (
                  <button
                    key={d}
                    onClick={() => setTestDaysRemaining(d)}
                    className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      testDaysRemaining === d
                        ? 'bg-emerald-500 text-zinc-950 border-emerald-400'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {d === 0 ? 'Expired' : `${d}d`}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleTestExpiryNotification}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl shadow transition-colors flex items-center justify-center gap-2 mt-2"
            >
              <Send className="w-4 h-4" /> TEST EXPIRY NOTIFICATION
            </button>
          </div>

          {testResult && (
            <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 animate-in fade-in ${
              testResult.isDuplicate
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}>
              <div className="flex items-center justify-between font-bold">
                <span>
                  {testResult.isDuplicate
                    ? '⚠️ Duplicate Alert Suppressed (Idempotent)'
                    : '✓ Notification Successfully Generated'}
                </span>
                <span className="font-mono text-[10px]">{testResult.isDuplicate ? 'SUPPRESSED' : 'DISPATCHED'}</span>
              </div>
              <p className="text-zinc-300"><strong>Recipient:</strong> {testResult.recipient}</p>
              <p className="text-zinc-300"><strong>Message:</strong> &ldquo;{testResult.message}&rdquo;</p>
              <p className="text-[10px] text-zinc-500 font-mono truncate">
                Key: {testResult.key}
              </p>
            </div>
          )}

          {/* Provider Channel Status (Section 12: Clearly show if not configured) */}
          <div className="pt-3 border-t border-zinc-800 space-y-2">
            <span className="text-[10px] font-mono uppercase text-zinc-500">Gateway Status</span>
            <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
              <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-850">
                <span className="block font-semibold text-emerald-400">IN-APP</span>
                <span className="text-zinc-500">Active</span>
              </div>
              <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-850">
                <span className="block font-semibold text-amber-400">EMAIL</span>
                <span className="text-zinc-500">Sandbox Mock</span>
              </div>
              <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-850">
                <span className="block font-semibold text-amber-400">SMS / WA</span>
                <span className="text-zinc-500">Sandbox Mock</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Live Notification Log Stream */}
        <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Notification History Log
              </h3>
            </div>
            <span className="text-xs font-mono text-zinc-500">{notifications.length} alerts on record</span>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {notifications.length === 0 ? (
              <p className="text-xs text-zinc-500 py-10 text-center">No notifications recorded.</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.notificationId}
                  className={`p-3 rounded-xl border text-xs transition-colors ${
                    n.read
                      ? 'bg-zinc-950/60 border-zinc-850 text-zinc-400'
                      : 'bg-zinc-850/80 border-emerald-500/30 text-zinc-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-white">{n.title}</span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {formatTimeDisplay(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-zinc-300 leading-snug">{n.message}</p>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span>Channel: {n.channel} &bull; Target: {n.recipientRole}</span>
                    {!n.read && (
                      <button
                        onClick={() => {
                          notificationService.markAsRead(n.notificationId);
                          setNotifications(prev =>
                            prev.map(i => i.notificationId === n.notificationId ? { ...i, read: true } : i)
                          );
                        }}
                        className="text-emerald-400 hover:underline"
                      >
                        Mark Read
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
