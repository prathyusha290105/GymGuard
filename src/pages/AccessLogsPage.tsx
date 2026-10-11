import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  Download,
  ShieldCheck,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { AccessLog } from '../types';
import { Badge } from '../components/common/Badge';
import { formatTimeDisplay } from '../utils/dateUtils';

export const AccessLogsPage: React.FC = () => {
  const { currentGym } = useAuth();
  const gymId = currentGym?.gymId || 'gym-01';

  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultFilter, setResultFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'accessLogs'), where('gymId', '==', gymId)));
      const list = snap.docs.map(d => d.data() as AccessLog);
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(list);
    } catch (e) {
      console.error('Error fetching access logs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [gymId]);

  const exportCSV = () => {
    const headers = ['Timestamp', 'Member ID', 'Member Name', 'Device', 'Result', 'Reason', 'Direction', 'Source'];
    const rows = logs.map(l => [
      l.timestamp,
      l.memberId || 'UNKNOWN',
      l.memberName || 'UNKNOWN',
      l.deviceName || l.deviceId,
      l.result,
      `"${l.reason.replace(/"/g, '""')}"`,
      l.direction,
      l.source,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `gymguard_access_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLogs = logs.filter(l => {
    if (resultFilter !== 'ALL') {
      if (resultFilter === 'GRANTED' && l.result !== 'ACCESS_GRANTED') return false;
      if (resultFilter === 'DENIED' && l.result === 'ACCESS_GRANTED') return false;
      if (resultFilter === 'EXPIRED' && l.result !== 'DENIED_EXPIRED') return false;
      if (resultFilter === 'FROZEN' && l.result !== 'DENIED_FROZEN') return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        (l.memberName || '').toLowerCase().includes(q) ||
        (l.memberId || '').toLowerCase().includes(q) ||
        (l.reason || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Access Attempt Audit Logs
            </h1>
            <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
              {logs.length} Total Attempts
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Immutable security log of every biometric scan, door unlock, and denied entry attempt.
          </p>
        </div>

        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-semibold rounded-xl border border-zinc-700 transition-colors self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-emerald-400" /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 p-3 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search member, ID, or reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'GRANTED', 'DENIED', 'EXPIRED', 'FROZEN'].map((f) => (
            <button
              key={f}
              onClick={() => setResultFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                resultFilter === f
                  ? 'bg-emerald-500 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-zinc-950/60 text-zinc-400 border-b border-zinc-800">
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold">Member</th>
                <th className="py-3 px-4 font-semibold">Device</th>
                <th className="py-3 px-4 font-semibold">Result</th>
                <th className="py-3 px-4 font-semibold">Reason & Audit Details</th>
                <th className="py-3 px-4 font-semibold">Dir</th>
                <th className="py-3 px-4 font-semibold">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-zinc-500">
                    No access logs recorded matching criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((l) => (
                  <tr key={l.accessLogId} className="hover:bg-zinc-850/50 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-zinc-300">
                      <div>{l.timestamp.split('T')[0]}</div>
                      <div className="text-zinc-500 text-[10px]">{formatTimeDisplay(l.timestamp)}</div>
                    </td>

                    <td className="py-3 px-4">
                      <p className="font-semibold text-white">{l.memberName || 'Unregistered'}</p>
                      <p className="text-[10px] text-zinc-400 font-mono">{l.memberId || 'N/A'}</p>
                    </td>

                    <td className="py-3 px-4 text-zinc-300">
                      {l.deviceName || l.deviceId}
                    </td>

                    <td className="py-3 px-4">
                      <Badge status={l.result} type="access" />
                    </td>

                    <td className="py-3 px-4 text-zinc-300 max-w-xs leading-snug">
                      {l.reason}
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-mono text-zinc-400 text-[11px] bg-zinc-800 px-1.5 py-0.5 rounded">
                        {l.direction}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-zinc-500 text-[10px] font-mono">
                      {l.source}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
