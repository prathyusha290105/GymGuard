import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Plus,
  Shield,
  Mail,
  Lock,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { collection, getDocs, query, where, doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types';
import { Modal } from '../components/common/Modal';

export const StaffPage: React.FC = () => {
  const { currentGym, currentUser } = useAuth();
  const gymId = currentGym?.gymId || 'gym-01';

  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStaff, setNewStaff] = useState({
    fullName: '',
    email: '',
    role: 'STAFF' as 'STAFF' | 'GYM_OWNER',
  });

  const loadStaff = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('gymId', '==', gymId)));
      const list = snap.docs.map(d => d.data() as UserProfile);
      setStaffList(list.filter(u => u.role === 'STAFF' || u.role === 'GYM_OWNER'));
    } catch (e) {
      console.error('Error fetching staff', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, [gymId]);

  const [formError, setFormError] = useState<string | null>(null);

  const handleAddStaff = async () => {
    if (!newStaff.fullName.trim() || !newStaff.email.trim()) {
      setFormError('Name and email are required');
      return;
    }
    setFormError(null);
    const uid = `staff_${Date.now()}`;
    const userProf: UserProfile = {
      uid,
      email: newStaff.email.trim(),
      fullName: newStaff.fullName.trim(),
      role: newStaff.role,
      gymId,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'users', uid), userProf);
    setShowAddModal(false);
    await loadStaff();
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Staff & Role Management
            </h1>
            <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
              Owner Restricted
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Authorize staff access to member registration, manual check-in, and renewal operations.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl shadow transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Add Staff Member
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {staffList.map((s) => (
          <div key={s.uid} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
                  {s.fullName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-white text-xs">{s.fullName}</h3>
                  <span className="text-[10px] text-zinc-400 font-mono">{s.role}</span>
                </div>
              </div>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] px-2 py-0.5 rounded font-semibold">
                ACTIVE
              </span>
            </div>

            <div className="text-xs text-zinc-400 space-y-1 pt-2 border-t border-zinc-800">
              <p>Email: <span className="text-zinc-200">{s.email}</span></p>
              <p>Permissions: <span className="text-zinc-300">{s.role === 'GYM_OWNER' ? 'Full Administrator' : 'Front Desk & Memberships'}</span></p>
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add Staff Member"
          maxWidth="md"
        >
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-zinc-400 block mb-1">Full Name</label>
              <input
                type="text"
                placeholder="Staff Member Name"
                value={newStaff.fullName}
                onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-zinc-400 block mb-1">Email</label>
              <input
                type="email"
                placeholder="staff@gymguard.demo"
                value={newStaff.email}
                onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-zinc-400 block mb-1">Role Assignment</label>
              <select
                value={newStaff.role}
                onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as any })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="STAFF">Front Desk Staff (Members, Check-In, Renewal)</option>
                <option value="GYM_OWNER">Co-Owner (Full Admin Privileges)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-2 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStaff}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl shadow"
              >
                Save Staff
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
