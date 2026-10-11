import React, { useState, useEffect } from 'react';
import {
  Layers,
  CreditCard,
  Plus,
  RefreshCw,
  PauseCircle,
  PlayCircle,
  Calendar,
  DollarSign,
  Search,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { collection, getDocs, query, where, doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { Membership, MembershipPlan, Member } from '../types';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { formatDateISO, getDaysRemaining } from '../utils/dateUtils';
import { membershipService } from '../services/membership/membershipService';

interface MembershipsPageProps {
  initialRenewId?: string;
  onNavigate?: (tab: string, meta?: any) => void;
}

export const MembershipsPage: React.FC<MembershipsPageProps> = ({ initialRenewId }) => {
  const { currentGym, currentUser } = useAuth();
  const gymId = currentGym?.gymId || 'gym-01';

  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'memberships' | 'plans'>('memberships');
  const [searchQuery, setSearchQuery] = useState('');

  // Renewal Modal State
  const [renewTarget, setRenewTarget] = useState<Membership | null>(null);
  const [renewPlanId, setRenewPlanId] = useState<string>('');
  const [renewStartDate, setRenewStartDate] = useState<string>(formatDateISO());
  const [renewPaymentMethod, setRenewPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD'>('CARD');

  // Freeze Modal State
  const [freezeTarget, setFreezeTarget] = useState<Membership | null>(null);
  const [freezeReason, setFreezeReason] = useState<string>('');

  // New Plan Modal State
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planForm, setPlanForm] = useState({
    name: '',
    description: '',
    durationDays: 30,
    price: 60,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const mSnap = await getDocs(query(collection(db, 'memberships'), where('gymId', '==', gymId)));
      const mList = mSnap.docs.map(d => d.data() as Membership);
      setMemberships(mList);

      const pSnap = await getDocs(query(collection(db, 'membershipPlans'), where('gymId', '==', gymId)));
      const pList = pSnap.docs.map(d => d.data() as MembershipPlan);
      setPlans(pList);

      const memSnap = await getDocs(query(collection(db, 'members'), where('gymId', '==', gymId)));
      setMembers(memSnap.docs.map(d => d.data() as Member));

      if (initialRenewId) {
        const found = mList.find(m => m.membershipId === initialRenewId);
        if (found) {
          setRenewTarget(found);
          setRenewPlanId(found.planId);
        }
      }
    } catch (e) {
      console.error('Error fetching memberships', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [gymId]);

  const handleRenewSubmit = async () => {
    if (!renewTarget) return;
    const plan = plans.find(p => p.planId === renewPlanId) || plans[0];
    const member = members.find(m => m.memberId === renewTarget.memberId);

    try {
      await membershipService.renewMembership({
        gymId,
        memberId: renewTarget.memberId,
        memberName: member?.fullName || 'Member',
        plan,
        startDate: renewStartDate,
        amountPaid: plan.price,
        paymentMethod: renewPaymentMethod,
        renewedBy: currentUser?.fullName,
      });
      alert(`Membership successfully renewed for ${plan.name}!`);
      setRenewTarget(null);
      await loadData();
    } catch (err: any) {
      alert(`Renewal failed: ${err.message || err}`);
    }
  };

  const handleFreezeSubmit = async () => {
    if (!freezeTarget) return;
    const member = members.find(m => m.memberId === freezeTarget.memberId);
    try {
      await membershipService.freezeMembership({
        membershipId: freezeTarget.membershipId,
        gymId,
        memberId: freezeTarget.memberId,
        memberName: member?.fullName || 'Member',
        reason: freezeReason || 'Temporary hold requested by member',
      });
      alert('Membership frozen. Biometric door access is now paused.');
      setFreezeTarget(null);
      await loadData();
    } catch (err: any) {
      alert(`Freeze failed: ${err.message || err}`);
    }
  };

  const handleUnfreeze = async (mshp: Membership) => {
    if (confirm('Unfreeze membership and restore immediate biometric door access?')) {
      try {
        await membershipService.unfreezeMembership(mshp);
        alert('Membership unfrozen and active!');
        await loadData();
      } catch (err: any) {
        alert(`Unfreeze failed: ${err.message || err}`);
      }
    }
  };

  const handleCreatePlan = async () => {
    if (!planForm.name) return alert('Plan name required');
    const planId = `plan-${planForm.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString().slice(-3)}`;
    const newPlan: MembershipPlan = {
      planId,
      gymId,
      name: planForm.name,
      description: planForm.description,
      durationDays: Number(planForm.durationDays),
      price: Number(planForm.price),
      active: true,
      createdAt: new Date().toISOString(),
    };
    await membershipService.savePlan(newPlan);
    setShowPlanModal(false);
    await loadData();
  };

  const filteredMemberships = memberships.filter(m => {
    const member = members.find(mem => mem.memberId === m.memberId);
    const searchString = `${member?.fullName || ''} ${m.planName} ${m.memberId}`.toLowerCase();
    return searchString.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Subscriptions & Plans
            </h1>
            <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
              {memberships.length} Active Subscriptions
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Manage plans, process renewals, apply temporary freezes, and monitor expirations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-zinc-950 p-1 rounded-xl border border-zinc-800 flex text-xs">
            <button
              onClick={() => setActiveSubTab('memberships')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activeSubTab === 'memberships'
                  ? 'bg-emerald-500 text-zinc-950'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Subscriptions
            </button>
            <button
              onClick={() => setActiveSubTab('plans')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activeSubTab === 'plans'
                  ? 'bg-emerald-500 text-zinc-950'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Membership Plans ({plans.length})
            </button>
          </div>
        </div>
      </div>

      {activeSubTab === 'memberships' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl flex items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search member name or plan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Subscriptions Table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-zinc-950/60 text-zinc-400 border-b border-zinc-800">
                    <th className="py-3 px-4 font-semibold">Member</th>
                    <th className="py-3 px-4 font-semibold">Plan Name</th>
                    <th className="py-3 px-4 font-semibold">Start Date</th>
                    <th className="py-3 px-4 font-semibold">Expiry Date</th>
                    <th className="py-3 px-4 font-semibold text-center">Remaining</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredMemberships.map((mshp) => {
                    const member = members.find(m => m.memberId === mshp.memberId);
                    const days = getDaysRemaining(mshp.endDate);
                    return (
                      <tr key={mshp.membershipId} className="hover:bg-zinc-850/50 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-white">{member?.fullName || mshp.memberId}</p>
                          <p className="text-[10px] text-zinc-400 font-mono">{mshp.memberId}</p>
                        </td>

                        <td className="py-3 px-4 font-medium text-zinc-200">
                          {mshp.planName}
                        </td>

                        <td className="py-3 px-4 font-mono text-[11px] text-zinc-400">
                          {mshp.startDate}
                        </td>

                        <td className="py-3 px-4 font-mono text-[11px] text-zinc-300">
                          {mshp.endDate}
                        </td>

                        <td className="py-3 px-4 text-center font-mono">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                              days < 0
                                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                                : days <= 7
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                                : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                            }`}
                          >
                            {days < 0 ? 'EXPIRED' : `${days}d`}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <Badge status={mshp.status} type="membership" />
                          {mshp.freezeReason && (
                            <p className="text-[10px] text-cyan-400 mt-0.5 max-w-[150px] truncate" title={mshp.freezeReason}>
                              {mshp.freezeReason}
                            </p>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {mshp.status === 'FROZEN' ? (
                            <button
                              onClick={() => handleUnfreeze(mshp)}
                              className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded text-xs font-semibold border border-cyan-500/20 transition-colors inline-flex items-center gap-1"
                            >
                              <PlayCircle className="w-3 h-3" /> Unfreeze
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setFreezeTarget(mshp);
                                setFreezeReason('');
                              }}
                              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 rounded text-xs font-medium border border-zinc-700 transition-colors inline-flex items-center gap-1"
                            >
                              <PauseCircle className="w-3 h-3" /> Freeze
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setRenewTarget(mshp);
                              setRenewPlanId(mshp.planId);
                              setRenewStartDate(formatDateISO());
                            }}
                            className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded text-xs font-semibold border border-emerald-500/20 transition-colors inline-flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" /> Renew
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Membership Plans Management (Section 9) */}
      {activeSubTab === 'plans' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowPlanModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl shadow transition-colors"
            >
              <Plus className="w-4 h-4" /> Create New Plan
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((p) => (
              <div
                key={p.planId}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-white text-base">{p.name}</h3>
                    <span className="text-lg font-mono font-bold text-emerald-400">${p.price}</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed mb-3">{p.description}</p>
                </div>

                <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Duration: <strong className="text-zinc-200">{p.durationDays} days</strong></span>
                  <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-semibold">
                    ACTIVE TIER
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Renewal Modal (Section 26) */}
      {renewTarget && (
        <Modal
          isOpen={!!renewTarget}
          onClose={() => setRenewTarget(null)}
          title={`Renew Membership: ${members.find(m => m.memberId === renewTarget.memberId)?.fullName}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="text-zinc-400 block mb-1">Select Membership Plan</label>
              <select
                value={renewPlanId}
                onChange={(e) => setRenewPlanId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              >
                {plans.map(p => (
                  <option key={p.planId} value={p.planId}>
                    {p.name} - ${p.price} ({p.durationDays} days)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-zinc-400 block mb-1">Renewal Start Date</label>
              <input
                type="date"
                value={renewStartDate}
                onChange={(e) => setRenewStartDate(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              >
              </input>
            </div>

            <div>
              <label className="text-zinc-400 block mb-1">Payment Method</label>
              <select
                value={renewPaymentMethod}
                onChange={(e) => setRenewPaymentMethod(e.target.value as any)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="CARD">Credit / Debit Card</option>
                <option value="UPI">UPI Payment</option>
                <option value="CASH">Cash</option>
              </select>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850 flex justify-between items-center">
              <span className="text-zinc-400">Total Due:</span>
              <span className="text-base font-bold text-emerald-400 font-mono">
                ${plans.find(p => p.planId === renewPlanId)?.price || 0}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setRenewTarget(null)}
                className="px-3 py-2 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRenewSubmit}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl shadow transition-colors"
              >
                Process Renewal & Notify
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Freeze Modal (Section 27) */}
      {freezeTarget && (
        <Modal
          isOpen={!!freezeTarget}
          onClose={() => setFreezeTarget(null)}
          title={`Freeze Membership: ${members.find(m => m.memberId === freezeTarget.memberId)?.fullName}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-bold">Access Control Notice</span>
              </div>
              During freeze, biometric door access will immediately return <strong>DENIED_FROZEN</strong> and the door will remain locked.
            </div>

            <div>
              <label className="text-zinc-400 block mb-1">Reason for Freeze *</label>
              <textarea
                rows={3}
                placeholder="e.g. Medical rehabilitation, overseas travel..."
                value={freezeReason}
                onChange={(e) => setFreezeReason(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setFreezeTarget(null)}
                className="px-3 py-2 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={handleFreezeSubmit}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold rounded-xl shadow"
              >
                Confirm Freeze
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Plan Modal */}
      {showPlanModal && (
        <Modal
          isOpen={showPlanModal}
          onClose={() => setShowPlanModal(false)}
          title="Create Membership Plan"
          maxWidth="md"
        >
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-zinc-400 block mb-1">Plan Name *</label>
              <input
                type="text"
                placeholder="e.g. VIP 60-Day Summer Pass"
                value={planForm.name}
                onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-zinc-400 block mb-1">Description</label>
              <input
                type="text"
                placeholder="Details & amenities..."
                value={planForm.description}
                onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-400 block mb-1">Duration (Days)</label>
                <input
                  type="number"
                  value={planForm.durationDays}
                  onChange={(e) => setPlanForm({ ...planForm, durationDays: Number(e.target.value) })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-zinc-400 block mb-1">Price ($)</label>
                <input
                  type="number"
                  value={planForm.price}
                  onChange={(e) => setPlanForm({ ...planForm, price: Number(e.target.value) })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setShowPlanModal(false)}
                className="px-3 py-2 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlan}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl shadow"
              >
                Save Plan
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
