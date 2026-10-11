import React, { useState, useEffect } from 'react';
import {
  Radio,
  Fingerprint,
  Lock,
  RefreshCw,
  Plus,
  Wifi,
  WifiOff,
  Cpu,
  CheckCircle2,
} from 'lucide-react';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { Device, DeviceStatus } from '../types';
import { Badge } from '../components/common/Badge';

export const DevicesPage: React.FC = () => {
  const { currentGym } = useAuth();
  const gymId = currentGym?.gymId || 'gym-01';

  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [pingingId, setPingingId] = useState<string | null>(null);

  const loadDevices = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'devices'), where('gymId', '==', gymId)));
      setDevices(snap.docs.map(d => d.data() as Device));
    } catch (e) {
      console.error('Error fetching devices', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, [gymId]);

  const handlePingDevice = async (d: Device) => {
    setPingingId(d.deviceId);
    await new Promise(r => setTimeout(r, 600));

    const updated = {
      ...d,
      status: 'ONLINE' as DeviceStatus,
      lastSeen: new Date().toISOString(),
    };
    await updateDoc(doc(db, 'devices', d.deviceId), {
      status: 'ONLINE',
      lastSeen: updated.lastSeen,
    });
    setDevices(prev => prev.map(item => item.deviceId === d.deviceId ? updated : item));
    setPingingId(null);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Hardware Devices & Door Relays
            </h1>
            <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
              {devices.length} Registered Endpoints
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Vendor-agnostic hardware adapter controllers for biometric sensors and Wiegand relays.
          </p>
        </div>

        <button
          onClick={loadDevices}
          className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-semibold rounded-xl border border-zinc-700 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Status
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {devices.map((d) => (
          <div
            key={d.deviceId}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-zinc-800 border border-zinc-700 text-emerald-400">
                    {d.type === 'BIOMETRIC' ? <Fingerprint className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white leading-tight">{d.name}</h3>
                    <span className="text-[10px] text-zinc-400 font-mono">{d.deviceId}</span>
                  </div>
                </div>
                <Badge status={d.status} type="device" />
              </div>

              <div className="space-y-1.5 text-xs text-zinc-400">
                <div className="flex justify-between">
                  <span>Location:</span>
                  <span className="font-semibold text-zinc-200">{d.location}</span>
                </div>
                <div className="flex justify-between">
                  <span>IP Address:</span>
                  <span className="font-mono text-zinc-200">{d.ipAddress}</span>
                </div>
                <div className="flex justify-between">
                  <span>Firmware:</span>
                  <span className="font-mono text-zinc-400 text-[11px]">{d.firmware}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 font-mono">
                TCP Socket: 4370
              </span>
              <button
                onClick={() => handlePingDevice(d)}
                disabled={pingingId === d.deviceId}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-semibold rounded-lg border border-zinc-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${pingingId === d.deviceId ? 'animate-spin' : ''}`} />
                Ping Socket
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
