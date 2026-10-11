import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Search,
  Plus,
  CreditCard,
  ArrowUpRight,
  Download,
} from 'lucide-react';
import { collection, getDocs, query, where, doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { Payment, Member } from '../types';
import { formatDateISO } from '../utils/dateUtils';
import { Modal } from '../components/common/Modal';

export const PaymentsPage: React.FC = () => {
  const { currentGym } = useAuth();
  const gymId = currentGym?.gymId || 'gym-01';

  const [payments, setPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    memberId: '',
    amount: 60,
    paymentMethod: 'CARD' as any,
    notes: 'Gym subscription fee',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'payments'), where('gymId', '==', gymId)));
      const list = snap.docs.map(d => d.data() as Payment);
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPayments(list);

      const memSnap = await getDocs(query(collection(db, 'members'), where('gymId', '==', gymId)));
      const memList = memSnap.docs.map(d => d.data() as Member);
      setMembers(memList);
      if (memList.length > 0 && !form.memberId) {
        setForm(prev => ({ ...prev, memberId: memList[0].memberId }));
      }
    } catch (e) {
      console.error('Error fetching payments', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [gymId]);

  const handleRecordPayment = async () => {
    const member = members.find(m => m.memberId === form.memberId);
    if (!member) return;

    const paymentId = `pay_${Date.now()}`;
    const newPay: Payment = {
      paymentId,
      gymId,
      memberId: member.memberId,
      memberName: member.fullName,
      amount: Number(form.amount),
      paymentMethod: form.paymentMethod,
      transactionId: `TXN_${Date.now()}`,
      paymentDate: formatDateISO(),
      status: 'PAID',
      notes: form.notes,
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'payments', paymentId), newPay);
    setShowAddModal(false);
    await loadData();
  };

  const totalRevenue = payments.reduce((sum, p) => sum + (p.status === 'PAID' ? p.amount : 0), 0);

  const filteredPayments = payments.filter(p => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (p.memberName || '').toLowerCase().includes(q) ||
        p.paymentId.toLowerCase().includes(q) ||
        (p.transactionId || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Payment Transactions
            </h1>
            <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
              ${totalRevenue.toLocaleString()} Total Revenue
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Membership dues, renewal transactions, and payment receipts.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl shadow transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Record Payment
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-zinc-950/60 text-zinc-400 border-b border-zinc-800">
                <th className="py-3 px-4 font-semibold">Transaction</th>
                <th className="py-3 px-4 font-semibold">Member</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Method</th>
                <th className="py-3 px-4 font-semibold">Amount</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredPayments.map(p => (
                <tr key={p.paymentId} className="hover:bg-zinc-850/50 transition-colors">
                  <td className="py-3 px-4 font-mono text-[11px] text-zinc-300">
                    {p.transactionId || p.paymentId}
                  </td>
                  <td className="py-3 px-4 font-semibold text-white">
                    {p.memberName || p.memberId}
                  </td>
                  <td className="py-3 px-4 text-zinc-400 font-mono text-[11px]">
                    {p.paymentDate}
                  </td>
                  <td className="py-3 px-4 text-zinc-300">
                    {p.paymentMethod}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                    ${p.amount}
                  </td>
                  <td className="py-3 px-4">
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-semibold">
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-zinc-400 text-[11px]">
                    {p.notes || '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Record New Payment"
          maxWidth="md"
        >
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-zinc-400 block mb-1">Member</label>
              <select
                value={form.memberId}
                onChange={(e) => setForm({ ...form, memberId: e.target.value })}
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
              <label className="text-zinc-400 block mb-1">Amount ($)</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-zinc-400 block mb-1">Payment Method</label>
              <select
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as any })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="CARD">Credit / Debit Card</option>
                <option value="UPI">UPI</option>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </div>

            <div>
              <label className="text-zinc-400 block mb-1">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-2 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl shadow"
              >
                Save Payment
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
