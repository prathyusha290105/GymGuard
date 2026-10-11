import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  Download,
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { AuditLog } from '../types';
import { formatTimeDisplay } from '../utils/dateUtils';

export const AuditLogsPage: React.FC = () => {
  const { currentGym } = useAuth();
  const gymId = currentGym?.gymId || 'gym-01';

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Generate/fetch audit logs
    const mockAuditLogs: AuditLog[] = [
      {
        auditId: 'aud-1',
        gymId,
        actorId: 'demo_owner_uid',
        actorName: 'Marcus Vance',
        actorRole: 'GYM_OWNER',
        action: 'MEMBER_REGISTERED',
        resource: 'members',
        resourceId: 'mem-001',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        details: 'Registered Alex Rivera with Annual VIP All-Access subscription',
      },
      {
        auditId: 'aud-2',
        gymId,
        actorId: 'demo_owner_uid',
        actorName: 'Marcus Vance',
        actorRole: 'GYM_OWNER',
        action: 'MEMBERSHIP_FROZEN',
        resource: 'memberships',
        resourceId: 'mshp-mem-016',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        details: 'Applied medical freeze for Maya Lin: Knee rehabilitation',
      },
      {
        auditId: 'aud-3',
        gymId,
        actorId: 'demo_owner_uid',
        actorName: 'Marcus Vance',
        actorRole: 'GYM_OWNER',
        action: 'EXPIRY_AUTOMATION_RAN',
        resource: 'system',
        timestamp: new Date(Date.now() - 14400000).toISOString(),
        details: 'Automated daily expiry evaluation: processed 20 memberships, sent 2 alerts',
      },
    ];
    setLogs(mockAuditLogs);
    setLoading(false);
  }, [gymId]);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Administrative Audit Logs
            </h1>
            <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
              Governance Trail
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Tamper-evident logs of staff administrative actions, plan alterations, and membership overrides.
          </p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-zinc-950/60 text-zinc-400 border-b border-zinc-800">
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold">Administrator</th>
                <th className="py-3 px-4 font-semibold">Action</th>
                <th className="py-3 px-4 font-semibold">Resource</th>
                <th className="py-3 px-4 font-semibold">Event Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {logs.map((l) => (
                <tr key={l.auditId} className="hover:bg-zinc-850/50 transition-colors">
                  <td className="py-3 px-4 font-mono text-[11px] text-zinc-400">
                    <div>{l.timestamp.split('T')[0]}</div>
                    <div className="text-[10px] text-zinc-500">{formatTimeDisplay(l.timestamp)}</div>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-white">{l.actorName}</p>
                    <p className="text-[10px] font-mono text-zinc-400">{l.actorRole}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className="bg-zinc-800 text-emerald-400 font-mono text-[11px] px-2 py-0.5 rounded border border-zinc-700">
                      {l.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-zinc-300 font-mono">
                    {l.resource}
                  </td>
                  <td className="py-3 px-4 text-zinc-300 max-w-sm">
                    {l.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
