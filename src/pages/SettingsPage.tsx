import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Building,
  Clock,
  ShieldCheck,
  Bell,
  CheckCircle2,
} from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { Gym, GymSettings } from '../types';

export const SettingsPage: React.FC = () => {
  const { currentGym } = useAuth();
  const gymId = currentGym?.gymId || 'gym-01';

  const [gymData, setGymData] = useState<Gym | null>(null);
  const [settingsData, setSettingsData] = useState<GymSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const gDoc = await getDoc(doc(db, 'gyms', gymId));
        if (gDoc.exists()) setGymData(gDoc.data() as Gym);

        const sDoc = await getDoc(doc(db, 'settings', `settings-${gymId}`));
        if (sDoc.exists()) setSettingsData(sDoc.data() as GymSettings);
      } catch (e) {
        console.error('Error fetching settings', e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [gymId]);

  const handleSave = async () => {
    if (!gymData || !settingsData) return;
    try {
      await updateDoc(doc(db, 'gyms', gymId), { ...gymData, updatedAt: new Date().toISOString() });
      await updateDoc(doc(db, 'settings', `settings-${gymId}`), {
        ...settingsData,
        updatedAt: new Date().toISOString(),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (e) {
      alert('Failed to save settings');
    }
  };

  if (loading || !gymData || !settingsData) {
    return <div className="text-xs text-zinc-400 py-10 text-center">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Facility Configuration & Thresholds
            </h1>
            <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
              Multi-Tenant
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Configure biometric door hold duration, automated expiry notice days, and contact details.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl shadow transition-colors self-start sm:self-auto"
        >
          <Save className="w-4 h-4" /> Save Configuration
        </button>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          Settings successfully persisted to Cloud Firestore.
        </div>
      )}

      {/* Facility Profile */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
          <Building className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Gym Organization Details</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-zinc-400 block mb-1">Gym Name</label>
            <input
              type="text"
              value={gymData.name}
              onChange={(e) => setGymData({ ...gymData, name: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">Primary Email</label>
            <input
              type="email"
              value={gymData.email}
              onChange={(e) => setGymData({ ...gymData, email: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">Telephone</label>
            <input
              type="tel"
              value={gymData.phone}
              onChange={(e) => setGymData({ ...gymData, phone: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">Operating Timezone</label>
            <input
              type="text"
              value={gymData.timezone}
              onChange={(e) => setGymData({ ...gymData, timezone: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-zinc-400 block mb-1">Physical Address</label>
            <input
              type="text"
              value={gymData.address}
              onChange={(e) => setGymData({ ...gymData, address: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Access Control & Expiry Thresholds */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
          <Clock className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Access Control & Expiry Automation</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-zinc-400 block mb-1">Expiry Notice Window (Days before)</label>
            <input
              type="number"
              value={settingsData.expiryNoticeDays}
              onChange={(e) => setSettingsData({ ...settingsData, expiryNoticeDays: Number(e.target.value) })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
            <span className="text-[10px] text-zinc-500 mt-1 block">Default: 7 days daily warning</span>
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">Door Magnetic Unlock Hold Duration (Seconds)</label>
            <input
              type="number"
              value={settingsData.doorUnlockDurationSeconds}
              onChange={(e) => setSettingsData({ ...settingsData, doorUnlockDurationSeconds: Number(e.target.value) })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
            <span className="text-[10px] text-zinc-500 mt-1 block">Relay release pulse duration (default: 4s)</span>
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">Duplicate Scan Suppression Interval (Seconds)</label>
            <input
              type="number"
              value={settingsData.duplicateScanIntervalSeconds}
              onChange={(e) => setSettingsData({ ...settingsData, duplicateScanIntervalSeconds: Number(e.target.value) })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
            <span className="text-[10px] text-zinc-500 mt-1 block">Throttles double taps at turnstiles (default: 30s)</span>
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">Grace Period Following Expiry (Days)</label>
            <input
              type="number"
              value={settingsData.gracePeriodDays}
              onChange={(e) => setSettingsData({ ...settingsData, gracePeriodDays: Number(e.target.value) })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
            <span className="text-[10px] text-zinc-500 mt-1 block">0 = Immediate door lock upon expiration</span>
          </div>
        </div>
      </div>
    </div>
  );
};
