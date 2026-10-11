import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  FileSpreadsheet,
  Users,
  DollarSign,
  AlertOctagon,
  Clock,
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { AttendanceRecord, Payment, Membership, AccessLog } from '../types';
import { AttendanceTrendChart, PeakHoursChart } from '../components/charts/SimpleCharts';
import { formatDateISO } from '../utils/dateUtils';

export const ReportsPage: React.FC = () => {
  const { currentGym } = useAuth();
  const gymId = currentGym?.gymId || 'gym-01';

  const [activeReport, setActiveReport] = useState<
    'attendance' | 'revenue' | 'membership' | 'expiry' | 'failures' | 'peak'
  >('attendance');

  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [aSnap, pSnap, mSnap, lSnap] = await Promise.all([
          getDocs(query(collection(db, 'attendance'), where('gymId', '==', gymId))),
          getDocs(query(collection(db, 'payments'), where('gymId', '==', gymId))),
          getDocs(query(collection(db, 'memberships'), where('gymId', '==', gymId))),
          getDocs(query(collection(db, 'accessLogs'), where('gymId', '==', gymId))),
        ]);

        setAttendance(aSnap.docs.map(d => d.data() as AttendanceRecord));
        setPayments(pSnap.docs.map(d => d.data() as Payment));
        setMemberships(mSnap.docs.map(d => d.data() as Membership));
        setAccessLogs(lSnap.docs.map(d => d.data() as AccessLog));
      } catch (e) {
        console.error('Error fetching reports data', e);
      }
    };
    fetchData();
  }, [gymId]);

  const exportCurrentReportCSV = () => {
    let filename = `gymguard_report_${activeReport}_${formatDateISO()}.csv`;
    let csvData = '';

    if (activeReport === 'attendance') {
      const headers = ['Attendance ID', 'Member ID', 'Member Name', 'Check-In', 'Check-Out', 'Duration Mins', 'Entry Method', 'Status'];
      const rows = attendance.map(a => [
        a.attendanceId,
        a.memberId,
        a.memberName || '',
        a.checkInTime,
        a.checkOutTime || '',
        a.durationMinutes || 0,
        a.entryMethod,
        a.status,
      ]);
      csvData = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } else if (activeReport === 'revenue') {
      const headers = ['Payment ID', 'Member ID', 'Member Name', 'Amount', 'Method', 'Date', 'Status'];
      const rows = payments.map(p => [
        p.paymentId,
        p.memberId,
        p.memberName || '',
        p.amount,
        p.paymentMethod,
        p.paymentDate,
        p.status,
      ]);
      csvData = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } else if (activeReport === 'failures') {
      const headers = ['Log ID', 'Timestamp', 'Member ID', 'Member Name', 'Device', 'Result', 'Reason'];
      const rows = accessLogs.filter(l => l.result !== 'ACCESS_GRANTED').map(l => [
        l.accessLogId,
        l.timestamp,
        l.memberId || 'UNKNOWN',
        l.memberName || 'UNKNOWN',
        l.deviceName || l.deviceId,
        l.result,
        `"${l.reason.replace(/"/g, '""')}"`,
      ]);
      csvData = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } else {
      const headers = ['Membership ID', 'Member ID', 'Plan Name', 'Start Date', 'End Date', 'Amount', 'Status'];
      const rows = memberships.map(m => [
        m.membershipId,
        m.memberId,
        m.planName,
        m.startDate,
        m.endDate,
        m.amount,
        m.status,
      ]);
      csvData = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deniedLogs = accessLogs.filter(l => l.result !== 'ACCESS_GRANTED');
  const totalRevenue = payments.reduce((sum, p) => sum + (p.status === 'PAID' ? p.amount : 0), 0);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Reports & Business Intelligence
            </h1>
            <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
              Firestore Analytics
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Generate audit logs, security denial analysis, and financial performance records.
          </p>
        </div>

        <button
          onClick={exportCurrentReportCSV}
          className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl shadow transition-colors self-start sm:self-auto"
        >
          <Download className="w-4 h-4" /> Export Active Report (CSV)
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 overflow-x-auto text-xs">
        {[
          { id: 'attendance', label: 'Attendance' },
          { id: 'revenue', label: 'Revenue & Payments' },
          { id: 'membership', label: 'Memberships' },
          { id: 'failures', label: 'Access Denials & Failures' },
          { id: 'peak', label: 'Peak Hours' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id as any)}
            className={`px-3.5 py-2 rounded-xl font-semibold transition-colors ${
              activeReport === tab.id
                ? 'bg-emerald-500 text-zinc-950'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeReport === 'attendance' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white">Daily Attendance Distribution</h3>
          <AttendanceTrendChart />
          <div className="pt-3 border-t border-zinc-800 text-xs text-zinc-400 flex justify-between">
            <span>Total Attendance Records Logged: <strong>{attendance.length}</strong></span>
            <span>Completed Check-Outs: <strong>{attendance.filter(a => a.status === 'COMPLETED').length}</strong></span>
          </div>
        </div>
      )}

      {activeReport === 'revenue' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-white">Financial Summary</h3>
            <span className="text-xl font-bold font-mono text-emerald-400">${totalRevenue.toLocaleString()}</span>
          </div>
          <div className="space-y-2 text-xs">
            {payments.slice(0, 10).map(p => (
              <div key={p.paymentId} className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-850 flex justify-between items-center">
                <span>{p.memberName || p.memberId} &bull; {p.paymentMethod}</span>
                <span className="font-mono text-emerald-400 font-bold">${p.amount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeReport === 'failures' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Access Denials & Door Lock Events</h3>
            <span className="text-xs text-rose-400 font-mono font-bold">{deniedLogs.length} Denied Scans</span>
          </div>
          <div className="space-y-2 text-xs">
            {deniedLogs.map(l => (
              <div key={l.accessLogId} className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-1">
                <div className="flex justify-between font-bold">
                  <span>{l.memberName || 'Unregistered'} ({l.result})</span>
                  <span className="text-[10px] font-mono text-rose-400">{l.timestamp.split('T')[0]}</span>
                </div>
                <p className="text-xs text-zinc-300">{l.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeReport === 'peak' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white">Hourly Facility Occupancy Analysis</h3>
          <PeakHoursChart />
        </div>
      )}

      {activeReport === 'membership' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white">Membership Portfolio Breakdown</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850">
              <span className="text-zinc-500">Active</span>
              <p className="text-lg font-bold text-emerald-400 font-mono">
                {memberships.filter(m => m.status === 'ACTIVE').length}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850">
              <span className="text-zinc-500">Expiring (7d)</span>
              <p className="text-lg font-bold text-amber-400 font-mono">
                {memberships.filter(m => m.status === 'EXPIRING_SOON').length}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850">
              <span className="text-zinc-500">Expired</span>
              <p className="text-lg font-bold text-rose-400 font-mono">
                {memberships.filter(m => m.status === 'EXPIRED').length}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850">
              <span className="text-zinc-500">Frozen</span>
              <p className="text-lg font-bold text-cyan-400 font-mono">
                {memberships.filter(m => m.status === 'FROZEN').length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
