import React, { useState, useEffect } from 'react';
import {
  Clock,
  Search,
  Filter,
  CheckCircle2,
  DoorOpen,
  UserCheck,
  Calendar,
  Plus,
} from 'lucide-react';
import { collection, getDocs, query, where, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { AttendanceRecord, Member } from '../types';
import { formatTimeDisplay, formatDuration, formatDateISO } from '../utils/dateUtils';
import { attendanceService } from '../services/attendance/attendanceService';
import { Modal } from '../components/common/Modal';

export const AttendancePage: React.FC = () => {
  const { currentGym } = useAuth();
  const gymId = currentGym?.gymId || 'gym-01';

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'INSIDE' | 'COMPLETED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Manual Check-in Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualMemberId, setManualMemberId] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'attendance'), where('gymId', '==', gymId)));
      const list = snap.docs.map(d => d.data() as AttendanceRecord);
      list.sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());
      setRecords(list);

      const mSnap = await getDocs(query(collection(db, 'members'), where('gymId', '==', gymId)));
      const memList = mSnap.docs.map(d => d.data() as Member);
      setMembers(memList);
      if (memList.length > 0) {
        setManualMemberId(memList[0].memberId);
      }
    } catch (e) {
      console.error('Error fetching attendance', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [gymId]);

  const handleManualCheckIn = async () => {
    const member = members.find(m => m.memberId === manualMemberId);
    if (!member) return;

    try {
      await attendanceService.recordCheckIn({
        gymId,
        memberId: member.memberId,
        memberName: member.fullName,
        deviceId: 'manual-desk',
        entryMethod: 'MANUAL',
      });
      setShowManualModal(false);
      await loadData();
    } catch (err) {
      alert('Manual check-in error');
    }
  };

  const handleManualCheckOut = async (record: AttendanceRecord) => {
    try {
      await attendanceService.recordCheckOut(record);
      await loadData();
    } catch (err) {
      alert('Manual check-out error');
    }
  };

  const filteredRecords = records.filter(r => {
    if (filterStatus === 'INSIDE' && r.status !== 'INSIDE') return false;
    if (filterStatus === 'COMPLETED' && r.status !== 'COMPLETED') return false;
    if (searchQuery) {
      const match = (r.memberName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    r.memberId.toLowerCase().includes(searchQuery.toLowerCase());
      if (!match) return false;
    }
    return true;
  });

  const currentlyInsideCount = records.filter(r => r.status === 'INSIDE').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Attendance Records
            </h1>
            <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
              {currentlyInsideCount} Currently Inside
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time biometric turnstile check-ins, departures, and workout session durations.
          </p>
        </div>

        <button
          onClick={() => setShowManualModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl shadow transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Manual Front Desk Entry
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 p-3 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search member name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {(['ALL', 'INSIDE', 'COMPLETED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterStatus === st
                  ? 'bg-emerald-500 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {st === 'INSIDE' ? `Inside (${currentlyInsideCount})` : st}
            </button>
          ))}
        </div>
      </div>

      {/* Attendance Log Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-zinc-950/60 text-zinc-400 border-b border-zinc-800">
                <th className="py-3 px-4 font-semibold">Member</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Check-In Time</th>
                <th className="py-3 px-4 font-semibold">Check-Out Time</th>
                <th className="py-3 px-4 font-semibold">Duration</th>
                <th className="py-3 px-4 font-semibold">Method</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-zinc-400">
                    No attendance records found.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const checkInObj = new Date(r.checkInTime);
                  const isInside = r.status === 'INSIDE';
                  const liveDurationMins = isInside
                    ? Math.max(1, Math.round((Date.now() - checkInObj.getTime()) / (1000 * 60)))
                    : r.durationMinutes || 0;

                  return (
                    <tr key={r.attendanceId} className="hover:bg-zinc-850/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-white">
                        <p>{r.memberName || r.memberId}</p>
                        <p className="text-[10px] text-zinc-400 font-mono">{r.memberId}</p>
                      </td>

                      <td className="py-3 px-4 text-zinc-300 font-mono text-[11px]">
                        {r.checkInTime.split('T')[0]}
                      </td>

                      <td className="py-3 px-4 text-emerald-400 font-mono font-medium">
                        {formatTimeDisplay(r.checkInTime)}
                      </td>

                      <td className="py-3 px-4 text-zinc-400 font-mono">
                        {r.checkOutTime ? formatTimeDisplay(r.checkOutTime) : '--:--'}
                      </td>

                      <td className="py-3 px-4 font-mono font-semibold text-zinc-200">
                        {formatDuration(liveDurationMins)}
                      </td>

                      <td className="py-3 px-4">
                        <span className="bg-zinc-800 text-zinc-300 text-[10px] font-mono px-2 py-0.5 rounded border border-zinc-700">
                          {r.entryMethod}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isInside
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 animate-pulse'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          }`}
                        >
                          {isInside ? '● INSIDE' : 'COMPLETED'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        {isInside && (
                          <button
                            onClick={() => handleManualCheckOut(r)}
                            className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded text-xs font-semibold border border-amber-500/20 transition-colors"
                          >
                            Check Out
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Check-in Modal */}
      {showManualModal && (
        <Modal
          isOpen={showManualModal}
          onClose={() => setShowManualModal(false)}
          title="Manual Front Desk Check-In"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-zinc-400">
              Manually admit a member if they forgot their fingerprint or during turnstile maintenance.
            </p>
            <div>
              <label className="text-zinc-400 block mb-1">Select Member</label>
              <select
                value={manualMemberId}
                onChange={(e) => setManualMemberId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              >
                {members.map(m => (
                  <option key={m.memberId} value={m.memberId}>
                    {m.fullName} ({m.memberId}) - Status: {m.status}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setShowManualModal(false)}
                className="px-3 py-2 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={handleManualCheckIn}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl shadow"
              >
                Admit Member
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
