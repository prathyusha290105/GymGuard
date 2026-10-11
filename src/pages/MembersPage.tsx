import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  UserPlus,
  Fingerprint,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  Clock,
  Shield,
  FileText,
  Bell,
  Trash2,
  Edit2,
  CheckCircle2,
  X,
  ChevronRight,
  ArrowRight,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Save,
} from 'lucide-react';
import { collection, getDocs, query, where, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { Member, Membership, MembershipPlan, AttendanceRecord, Payment, AccessLog, BiometricStatus } from '../types';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { formatDateISO, getDaysRemaining, formatTimeDisplay } from '../utils/dateUtils';
import { memberService } from '../services/member/memberService';
import { biometricService } from '../services/hardware/biometricService';
import { mockBiometricDevice } from '../services/hardware/MockBiometricDevice';

interface MembersPageProps {
  initialMemberId?: string;
  onNavigate?: (tab: string, meta?: any) => void;
}

export const MembersPage: React.FC<MembersPageProps> = ({ initialMemberId, onNavigate }) => {
  const { currentGym } = useAuth();
  const gymId = currentGym?.gymId || 'gym-01';

  const [members, setMembers] = useState<Member[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Status feedback toast/banner
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Selected member profile modal
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [profileTab, setProfileTab] = useState<'overview' | 'membership' | 'attendance' | 'payments' | 'access' | 'biometrics'>('overview');
  const [memberAttendance, setMemberAttendance] = useState<AttendanceRecord[]>([]);
  const [memberPayments, setMemberPayments] = useState<Payment[]>([]);
  const [memberLogs, setMemberLogs] = useState<AccessLog[]>([]);

  // Edit Member Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    gender: 'MALE' as 'MALE' | 'FEMALE' | 'OTHER',
    dateOfBirth: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    status: 'ACTIVE' as any,
  });

  // Delete Member Confirmation State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Multi-step Registration Wizard State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regStep, setRegStep] = useState(1);
  const [isRegistering, setIsRegistering] = useState(false);
  const [regData, setRegData] = useState({
    fullName: '',
    email: '',
    phone: '',
    gender: 'MALE' as 'MALE' | 'FEMALE' | 'OTHER',
    dateOfBirth: '1995-01-01',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    planId: '',
    paymentMethod: 'CARD' as any,
    amount: 0,
    enrolledBio: false,
    bioTemplateId: '',
  });

  const showFeedback = (type: 'success' | 'error' | 'info', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const memList = await memberService.getMembers(gymId);
      setMembers(memList);

      const mshpSnap = await getDocs(query(collection(db, 'memberships'), where('gymId', '==', gymId)));
      setMemberships(mshpSnap.docs.map(d => d.data() as Membership));

      const planSnap = await getDocs(query(collection(db, 'membershipPlans'), where('gymId', '==', gymId)));
      setPlans(planSnap.docs.map(d => d.data() as MembershipPlan));

      if (initialMemberId) {
        const found = memList.find(m => m.memberId === initialMemberId);
        if (found) {
          openMemberProfile(found);
        }
      }
    } catch (e: any) {
      console.warn('Error fetching members data from Firestore', e);
      showFeedback('error', `Failed to retrieve records from Firestore: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [gymId]);

  const openMemberProfile = async (member: Member) => {
    setSelectedMember(member);
    setProfileTab('overview');

    // Load related data from Firestore
    try {
      const attSnap = await getDocs(
        query(collection(db, 'attendance'), where('gymId', '==', gymId), where('memberId', '==', member.memberId))
      );
      setMemberAttendance(attSnap.docs.map(d => d.data() as AttendanceRecord));

      const paySnap = await getDocs(
        query(collection(db, 'payments'), where('gymId', '==', gymId), where('memberId', '==', member.memberId))
      );
      setMemberPayments(paySnap.docs.map(d => d.data() as Payment));

      const logSnap = await getDocs(
        query(collection(db, 'accessLogs'), where('gymId', '==', gymId), where('memberId', '==', member.memberId))
      );
      setMemberLogs(logSnap.docs.map(d => d.data() as AccessLog));
    } catch (e) {
      console.warn('Error fetching member details from Firestore', e);
    }
  };

  const openEditModal = (member: Member) => {
    setEditFormData({
      fullName: member.fullName,
      phone: member.phone,
      email: member.email,
      gender: member.gender || 'MALE',
      dateOfBirth: member.dateOfBirth || '',
      address: member.address || '',
      emergencyContactName: member.emergencyContactName || '',
      emergencyContactPhone: member.emergencyContactPhone || '',
      status: member.status,
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedMember) return;
    setIsUpdating(true);
    try {
      const updated = await memberService.updateMember(selectedMember.memberId, {
        fullName: editFormData.fullName,
        phone: editFormData.phone,
        email: editFormData.email,
        gender: editFormData.gender,
        dateOfBirth: editFormData.dateOfBirth,
        address: editFormData.address,
        emergencyContactName: editFormData.emergencyContactName,
        emergencyContactPhone: editFormData.emergencyContactPhone,
        status: editFormData.status,
      });

      setSelectedMember(updated);
      setMembers(prev => prev.map(m => m.memberId === updated.memberId ? updated : m));
      setShowEditModal(false);
      showFeedback('success', `Member "${updated.fullName}" updated in Cloud Firestore.`);
    } catch (err: any) {
      showFeedback('error', `Failed to update member: ${err.message || err}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete) return;
    setIsDeleting(true);
    try {
      await memberService.deleteMember(memberToDelete.memberId);
      mockBiometricDevice.unregisterTemplate(memberToDelete.memberId);
      setMembers(prev => prev.filter(m => m.memberId !== memberToDelete.memberId));
      if (selectedMember?.memberId === memberToDelete.memberId) {
        setSelectedMember(null);
      }
      setShowDeleteModal(false);
      showFeedback('success', `Member "${memberToDelete.fullName}" deleted from Firestore.`);
      setMemberToDelete(null);
    } catch (err: any) {
      showFeedback('error', `Failed to delete member: ${err.message || err}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEnrollFingerprint = async () => {
    if (!selectedMember) return;
    try {
      const res = await biometricService.enrollMemberFingerprint(selectedMember.memberId);
      if (res.success && res.templateId) {
        await memberService.updateBiometrics(selectedMember.memberId, 'ENROLLED', res.templateId);
        mockBiometricDevice.registerTemplate(selectedMember.memberId, res.templateId);
        const updated = {
          ...selectedMember,
          biometricStatus: 'ENROLLED' as BiometricStatus,
          biometricTemplateId: res.templateId,
        };
        setSelectedMember(updated);
        setMembers(prev => prev.map(m => m.memberId === updated.memberId ? updated : m));
        showFeedback('success', `Fingerprint enrolled with template hash "${res.templateId}".`);
      } else {
        showFeedback('error', `Enrollment failed: ${res.error || 'Device offline'}`);
      }
    } catch (err: any) {
      showFeedback('error', `Enrollment failed: ${err.message || err}`);
    }
  };

  const handleRemoveFingerprint = async () => {
    if (!selectedMember) return;
    try {
      await biometricService.removeMemberFingerprint(selectedMember.memberId, selectedMember.biometricTemplateId || '');
      await memberService.updateBiometrics(selectedMember.memberId, 'NOT_ENROLLED', '');
      mockBiometricDevice.unregisterTemplate(selectedMember.memberId);
      const updated = {
        ...selectedMember,
        biometricStatus: 'NOT_ENROLLED' as BiometricStatus,
        biometricTemplateId: '',
      };
      setSelectedMember(updated);
      setMembers(prev => prev.map(m => m.memberId === updated.memberId ? updated : m));
      showFeedback('info', 'Biometric credential removed from reader.');
    } catch (err: any) {
      showFeedback('error', `Failed to remove fingerprint: ${err.message || err}`);
    }
  };

  // Multi-step Registration Handler
  const handleCompleteRegistration = async () => {
    setIsRegistering(true);
    const now = new Date();
    const todayStr = formatDateISO(now);

    const plan = plans.find(p => p.planId === regData.planId) || plans[0];
    const duration = plan?.durationDays || 30;
    const endObj = new Date(now);
    endObj.setDate(endObj.getDate() + duration);
    const endDate = formatDateISO(endObj);

    try {
      // 1. Create Member in Firestore via memberService
      const newMember = await memberService.createMember({
        gymId,
        fullName: regData.fullName,
        dateOfBirth: regData.dateOfBirth,
        gender: regData.gender,
        phone: regData.phone,
        email: regData.email,
        address: regData.address,
        emergencyContactName: regData.emergencyContactName,
        emergencyContactPhone: regData.emergencyContactPhone,
        joiningDate: todayStr,
        status: 'ACTIVE',
        biometricStatus: regData.enrolledBio ? 'ENROLLED' : 'NOT_ENROLLED',
        biometricTemplateId: regData.bioTemplateId,
      });

      if (regData.enrolledBio && regData.bioTemplateId) {
        mockBiometricDevice.registerTemplate(newMember.memberId, regData.bioTemplateId);
      }

      // 2. Create Membership in Firestore
      const mshpId = `mshp-${newMember.memberId}`;
      const newMshp: Membership = {
        membershipId: mshpId,
        memberId: newMember.memberId,
        gymId,
        planId: plan.planId,
        planName: plan.name,
        startDate: todayStr,
        endDate,
        amount: plan.price,
        paymentStatus: 'PAID',
        status: 'ACTIVE',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      await setDoc(doc(db, 'memberships', mshpId), newMshp);

      // 3. Create Payment in Firestore
      const payId = `pay-${newMember.memberId}`;
      const newPay: Payment = {
        paymentId: payId,
        gymId,
        memberId: newMember.memberId,
        memberName: regData.fullName,
        membershipId: mshpId,
        amount: plan.price,
        paymentMethod: regData.paymentMethod,
        transactionId: `TXN_${Date.now()}`,
        paymentDate: todayStr,
        status: 'PAID',
        notes: `Registration fee for ${plan.name}`,
        createdAt: now.toISOString(),
      };
      await setDoc(doc(db, 'payments', payId), newPay);

      await loadData();
      setShowRegisterModal(false);
      setSelectedMember(newMember);
      showFeedback('success', `Member "${newMember.fullName}" created & saved to Cloud Firestore!`);
    } catch (err: any) {
      showFeedback('error', `Failed to save member: ${err.message || err}`);
    } finally {
      setIsRegistering(false);
    }
  };

  // Filter members
  const filteredMembers = members.filter(m => {
    const matchesSearch =
      m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.memberId.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'ALL') return true;

    const mshp = memberships.find(ms => ms.memberId === m.memberId);
    if (statusFilter === 'ACTIVE') return m.status === 'ACTIVE' && mshp?.status === 'ACTIVE';
    if (statusFilter === 'EXPIRING') return mshp?.status === 'EXPIRING_SOON';
    if (statusFilter === 'EXPIRED') return mshp?.status === 'EXPIRED';
    if (statusFilter === 'FROZEN') return mshp?.status === 'FROZEN';
    if (statusFilter === 'SUSPENDED') return m.status === 'SUSPENDED' || mshp?.status === 'SUSPENDED';
    if (statusFilter === 'INACTIVE') return m.status === 'INACTIVE';
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Feedback */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : feedback.type === 'error'
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              : 'bg-zinc-800 border-zinc-700 text-zinc-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-zinc-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-zinc-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Member Directory
            </h1>
            <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
              {members.length} Members (Firestore Connected)
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time Cloud Firestore CRUD operations: Create, Read, Update, and Delete gym athletes.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={loadData}
            disabled={loading}
            title="Refresh from Firestore"
            className="p-2.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 rounded-xl border border-zinc-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              setRegStep(1);
              setRegData({
                fullName: '',
                email: '',
                phone: '',
                gender: 'MALE',
                dateOfBirth: '1995-01-01',
                address: '',
                emergencyContactName: '',
                emergencyContactPhone: '',
                planId: plans[0]?.planId || 'plan-monthly',
                paymentMethod: 'CARD',
                amount: plans[0]?.price || 60,
                enrolledBio: false,
                bioTemplateId: '',
              });
              setShowRegisterModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl shadow transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Add Member (Wizard)
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 p-3 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name, phone, email, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['ALL', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'FROZEN', 'SUSPENDED'].map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === filter
                  ? 'bg-emerald-500 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-750'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Members Grid / Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-zinc-950/60 text-zinc-400 border-b border-zinc-800">
                <th className="py-3 px-4 font-semibold">Member</th>
                <th className="py-3 px-4 font-semibold">Contact</th>
                <th className="py-3 px-4 font-semibold">Current Plan</th>
                <th className="py-3 px-4 font-semibold">Expiry Date</th>
                <th className="py-3 px-4 font-semibold">Biometrics</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-zinc-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
                      <span>Loading records from Cloud Firestore...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-zinc-400">
                    No members match the query or filter criteria.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => {
                  const mshp = memberships.find(ms => ms.memberId === m.memberId);
                  const days = mshp ? getDaysRemaining(mshp.endDate) : -999;
                  return (
                    <tr
                      key={m.memberId}
                      onClick={() => openMemberProfile(m)}
                      className="hover:bg-zinc-850/50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-white text-xs">
                            {m.fullName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{m.fullName}</p>
                            <p className="text-[10px] text-zinc-400 font-mono">{m.memberId}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-zinc-300">
                        <p>{m.phone}</p>
                        <p className="text-[10px] text-zinc-400">{m.email}</p>
                      </td>

                      <td className="py-3 px-4 text-zinc-300">
                        {mshp?.planName || 'No Active Plan'}
                      </td>

                      <td className="py-3 px-4">
                        {mshp ? (
                          <div>
                            <p className="font-mono text-[11px] text-zinc-200">{mshp.endDate}</p>
                            <p className={`text-[10px] font-semibold ${
                              days < 0 ? 'text-rose-400' : days <= 7 ? 'text-amber-400' : 'text-emerald-400'
                            }`}>
                              {days < 0 ? 'Expired' : `${days} days left`}
                            </p>
                          </div>
                        ) : (
                          <span className="text-zinc-500">--</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            m.biometricStatus === 'ENROLLED'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          }`}
                        >
                          <Fingerprint className="w-3 h-3" />
                          {m.biometricStatus}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <Badge
                          status={mshp?.status || m.status}
                          type={mshp ? 'membership' : 'member'}
                        />
                      </td>

                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMember(m);
                            openEditModal(m);
                          }}
                          className="px-2 py-1 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 rounded text-xs border border-zinc-700 transition-colors inline-flex items-center gap-1"
                          title="Edit Member in Firestore"
                        >
                          <Edit2 className="w-3 h-3" /> Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMemberToDelete(m);
                            setShowDeleteModal(true);
                          }}
                          className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded text-xs border border-rose-500/20 transition-colors inline-flex items-center gap-1"
                          title="Delete Member from Firestore"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Member Profile Drawer Modal */}
      {selectedMember && (
        <Modal
          isOpen={!!selectedMember && !showEditModal && !showDeleteModal}
          onClose={() => setSelectedMember(null)}
          title={`Member Profile: ${selectedMember.fullName}`}
          maxWidth="2xl"
        >
          {/* Profile Header */}
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg">
                {selectedMember.fullName.charAt(0)}
              </div>
              <div>
                <h4 className="text-base font-bold text-white">{selectedMember.fullName}</h4>
                <p className="text-xs text-zinc-400 font-mono">
                  ID: {selectedMember.memberId} &bull; Joined: {selectedMember.joiningDate}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => openEditModal(selectedMember)}
                className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded-lg border border-zinc-700 flex items-center gap-1.5 transition-colors font-medium"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit Profile
              </button>
              <Badge status={selectedMember.status} type="member" />
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 overflow-x-auto text-xs">
            {(['overview', 'membership', 'attendance', 'payments', 'access', 'biometrics'] as const).map(
              (tab) => (
                <button
                  key={tab}
                  onClick={() => setProfileTab(tab)}
                  className={`px-3 py-1.5 rounded-lg font-medium uppercase tracking-wider transition-colors ${
                    profileTab === tab
                      ? 'bg-emerald-500 text-zinc-950 font-bold'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {tab}
                </button>
              )
            )}
          </div>

          {/* Tab 1: Overview */}
          {profileTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850">
                  <span className="text-zinc-400 block mb-1">Phone Number</span>
                  <span className="font-semibold text-white">{selectedMember.phone}</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850">
                  <span className="text-zinc-400 block mb-1">Email Address</span>
                  <span className="font-semibold text-white">{selectedMember.email}</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850">
                  <span className="text-zinc-400 block mb-1">Date of Birth</span>
                  <span className="font-semibold text-white">{selectedMember.dateOfBirth || 'N/A'}</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850">
                  <span className="text-zinc-400 block mb-1">Gender</span>
                  <span className="font-semibold text-white">{selectedMember.gender || 'N/A'}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850 text-xs">
                <span className="text-zinc-400 block mb-1">Home Address</span>
                <span className="font-semibold text-white">{selectedMember.address || 'None provided'}</span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850 text-xs">
                <span className="text-zinc-400 block mb-1">Emergency Contact</span>
                <span className="font-semibold text-white">
                  {selectedMember.emergencyContactName || 'None'} ({selectedMember.emergencyContactPhone || 'N/A'})
                </span>
              </div>
            </div>
          )}

          {/* Tab 2: Membership */}
          {profileTab === 'membership' && (
            <div className="space-y-4">
              {memberships.filter(m => m.memberId === selectedMember.memberId).map(mshp => {
                const days = getDaysRemaining(mshp.endDate);
                return (
                  <div key={mshp.membershipId} className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">{mshp.planName}</span>
                      <Badge status={mshp.status} type="membership" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-zinc-400">Start Date:</span>
                        <p className="font-mono text-zinc-200">{mshp.startDate}</p>
                      </div>
                      <div>
                        <span className="text-zinc-400">Expiry Date:</span>
                        <p className="font-mono text-zinc-200">{mshp.endDate}</p>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-850 text-xs flex items-center justify-between">
                      <span className="text-zinc-400">Subscription Days Remaining:</span>
                      <span className={`font-mono font-bold ${days < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {days < 0 ? 'EXPIRED' : `${days} days`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab 3: Attendance */}
          {profileTab === 'attendance' && (
            <div className="space-y-2">
              {memberAttendance.length === 0 ? (
                <p className="text-xs text-zinc-500 py-6 text-center">No attendance records on file in Firestore.</p>
              ) : (
                memberAttendance.map(a => (
                  <div key={a.attendanceId} className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-850 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-white">Entry: {formatTimeDisplay(a.checkInTime)}</p>
                      <p className="text-[10px] text-zinc-400 font-mono">Date: {a.checkInTime.split('T')[0]}</p>
                    </div>
                    <span className="font-mono text-emerald-400 font-bold">
                      {a.durationMinutes ? `${a.durationMinutes}m` : 'INSIDE'}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 4: Payments */}
          {profileTab === 'payments' && (
            <div className="space-y-2">
              {memberPayments.length === 0 ? (
                <p className="text-xs text-zinc-500 py-6 text-center">No payment transactions recorded in Firestore.</p>
              ) : (
                memberPayments.map(p => (
                  <div key={p.paymentId} className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-850 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-white">${p.amount} &bull; {p.paymentMethod}</p>
                      <p className="text-[10px] text-zinc-400 font-mono">{p.paymentDate} &bull; {p.transactionId}</p>
                    </div>
                    <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {p.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 5: Access Logs */}
          {profileTab === 'access' && (
            <div className="space-y-2">
              {memberLogs.length === 0 ? (
                <p className="text-xs text-zinc-500 py-6 text-center">No door access attempts recorded in Firestore.</p>
              ) : (
                memberLogs.map(l => (
                  <div key={l.accessLogId} className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-850 flex items-center justify-between text-xs">
                    <div>
                      <Badge status={l.result} type="access" />
                      <p className="text-[11px] text-zinc-400 mt-1">{l.reason}</p>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                      {formatTimeDisplay(l.timestamp)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 6: Biometrics */}
          {profileTab === 'biometrics' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-white uppercase tracking-wider">
                      Biometric Enrollment Status
                    </h5>
                    <p className="text-[11px] text-zinc-400">
                      Optical minutiae hash representation. Raw images are never stored.
                    </p>
                  </div>
                  <Badge status={selectedMember.biometricStatus} type="default" />
                </div>

                {selectedMember.biometricTemplateId && (
                  <div className="p-2 rounded bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400">
                    Active Token: <span className="text-emerald-400">{selectedMember.biometricTemplateId}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleEnrollFingerprint}
                  className="p-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-2"
                >
                  <Fingerprint className="w-4 h-4" />
                  {selectedMember.biometricStatus === 'ENROLLED' ? 'Re-Enroll Fingerprint' : 'Enroll Fingerprint'}
                </button>

                {selectedMember.biometricStatus === 'ENROLLED' && (
                  <button
                    onClick={handleRemoveFingerprint}
                    className="p-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove Fingerprint
                  </button>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Edit Member Modal (Firestore Update) */}
      {showEditModal && selectedMember && (
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title={`Edit Member: ${selectedMember.fullName}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-400 block mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  value={editFormData.fullName}
                  onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Account Status</label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as any })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="ACTIVE">ACTIVE (Authorized)</option>
                  <option value="INACTIVE">INACTIVE (Deactivated)</option>
                  <option value="SUSPENDED">SUSPENDED (Turnstile Denied)</option>
                  <option value="BLACKLISTED">BLACKLISTED (Banned)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-400 block mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-400 block mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={editFormData.dateOfBirth}
                  onChange={(e) => setEditFormData({ ...editFormData, dateOfBirth: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Gender</label>
                <select
                  value={editFormData.gender}
                  onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value as any })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-zinc-400 block mb-1">Physical Address</label>
              <input
                type="text"
                value={editFormData.address}
                onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-400 block mb-1">Emergency Contact Name</label>
                <input
                  type="text"
                  value={editFormData.emergencyContactName}
                  onChange={(e) => setEditFormData({ ...editFormData, emergencyContactName: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Emergency Phone</label>
                <input
                  type="tel"
                  value={editFormData.emergencyContactPhone}
                  onChange={(e) => setEditFormData({ ...editFormData, emergencyContactPhone: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-3.5 py-2 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isUpdating}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl shadow transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isUpdating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{isUpdating ? 'Saving to Firestore...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Member Confirmation Modal */}
      {showDeleteModal && memberToDelete && (
        <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title={`Delete Member: ${memberToDelete.fullName}`}
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-white">Permanently Delete Member?</p>
                <p className="text-[11px] text-zinc-300 mt-0.5">
                  This will remove <strong>{memberToDelete.fullName}</strong> ({memberToDelete.memberId}) from Cloud Firestore and de-register any biometric keys.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-3.5 py-2 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteMember}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isDeleting ? 'Deleting from Firestore...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 6-Step Member Registration Wizard Modal */}
      {showRegisterModal && (
        <Modal
          isOpen={showRegisterModal}
          onClose={() => setShowRegisterModal(false)}
          title={`New Member Registration: Step ${regStep} of 6`}
          maxWidth="xl"
        >
          {/* Progress Tracker */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800 text-[11px] font-mono">
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <div
                key={s}
                className={`flex items-center gap-1 font-semibold ${
                  regStep === s
                    ? 'text-emerald-400'
                    : regStep > s
                    ? 'text-zinc-300'
                    : 'text-zinc-600'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  regStep === s
                    ? 'bg-emerald-500 text-zinc-950 font-bold'
                    : regStep > s
                    ? 'bg-zinc-800 text-emerald-400'
                    : 'bg-zinc-850 text-zinc-600'
                }`}>
                  {s}
                </span>
                <span className="hidden sm:inline">
                  {s === 1 ? 'Personal' : s === 2 ? 'Contact' : s === 3 ? 'Plan' : s === 4 ? 'Payment' : s === 5 ? 'Bio' : 'Done'}
                </span>
              </div>
            ))}
          </div>

          {/* STEP 1: Personal Information */}
          {regStep === 1 && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jordan Vance"
                  value={regData.fullName}
                  onChange={(e) => setRegData({ ...regData, fullName: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={regData.dateOfBirth}
                    onChange={(e) => setRegData({ ...regData, dateOfBirth: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Gender</label>
                  <select
                    value={regData.gender}
                    onChange={(e) => setRegData({ ...regData, gender: e.target.value as any })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Home Address</label>
                <input
                  type="text"
                  placeholder="123 Oak St, Metro City"
                  value={regData.address}
                  onChange={(e) => setRegData({ ...regData, address: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* STEP 2: Contact Information */}
          {regStep === 2 && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Primary Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="+1 (555) 000-0000"
                  value={regData.phone}
                  onChange={(e) => setRegData({ ...regData, phone: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="member@example.com"
                  value={regData.email}
                  onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Emergency Contact Name</label>
                  <input
                    type="text"
                    placeholder="Parent / Spouse"
                    value={regData.emergencyContactName}
                    onChange={(e) => setRegData({ ...regData, emergencyContactName: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Emergency Phone</label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 999-9999"
                    value={regData.emergencyContactPhone}
                    onChange={(e) => setRegData({ ...regData, emergencyContactPhone: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Membership Plan */}
          {regStep === 3 && (
            <div className="space-y-3">
              <label className="text-xs text-zinc-400 block">Select Initial Subscription Tier:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {plans.map((p) => (
                  <div
                    key={p.planId}
                    onClick={() => setRegData({ ...regData, planId: p.planId, amount: p.price })}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      regData.planId === p.planId
                        ? 'bg-emerald-500/15 border-emerald-500 text-white'
                        : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs">{p.name}</span>
                      <span className="font-mono font-bold text-emerald-400">${p.price}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400">{p.durationDays} days access</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: Payment */}
          {regStep === 4 && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <span className="text-xs text-zinc-400">Total Subscription Due:</span>
                <span className="text-lg font-bold text-emerald-400 font-mono">${regData.amount}</span>
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Payment Method</label>
                <select
                  value={regData.paymentMethod}
                  onChange={(e) => setRegData({ ...regData, paymentMethod: e.target.value as any })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="CARD">Credit / Debit Card</option>
                  <option value="UPI">UPI / Instant Pay</option>
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>
            </div>
          )}

          {/* STEP 5: Fingerprint Enrollment (Simulation) */}
          {regStep === 5 && (
            <div className="space-y-4 text-center py-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Fingerprint className="w-10 h-10 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Optical Scanner Enrollment</h4>
                <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                  Member places index finger on the reader to extract mathematical minutiae hash.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const token = `BIO_HASH_${Math.random().toString(36).substring(2, 8).toUpperCase()}_${Date.now().toString().slice(-4)}`;
                  setRegData({ ...regData, enrolledBio: true, bioTemplateId: token });
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  regData.enrolledBio
                    ? 'bg-emerald-500 text-zinc-950'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                }`}
              >
                {regData.enrolledBio ? '✓ Fingerprint Enrolled' : 'Simulate Fingerprint Scan'}
              </button>
            </div>
          )}

          {/* STEP 6: Confirmation */}
          {regStep === 6 && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Member:</span>
                  <span className="font-bold text-white">{regData.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Email:</span>
                  <span className="text-zinc-200">{regData.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Selected Plan:</span>
                  <span className="text-emerald-400 font-semibold">
                    {plans.find(p => p.planId === regData.planId)?.name} (${regData.amount})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Biometric Template:</span>
                  <span className="text-zinc-200">
                    {regData.enrolledBio ? 'ENROLLED (Ready for Door)' : 'NOT ENROLLED'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Wizard Footer Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            {regStep > 1 ? (
              <button
                type="button"
                onClick={() => setRegStep(regStep - 1)}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs rounded-xl font-medium"
              >
                Back
              </button>
            ) : <div />}

            {regStep < 6 ? (
              <button
                type="button"
                onClick={() => {
                  if (regStep === 1 && !regData.fullName.trim()) {
                    showFeedback('error', 'Full name is required.');
                    return;
                  }
                  if (regStep === 2 && (!regData.phone.trim() || !regData.email.trim())) {
                    showFeedback('error', 'Phone and email are required for basic member contact.');
                    return;
                  }
                  setRegStep(regStep + 1);
                }}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl shadow transition-colors flex items-center gap-1.5"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCompleteRegistration}
                disabled={isRegistering}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold text-xs rounded-xl shadow transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isRegistering ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                <span>{isRegistering ? 'Writing to Firestore...' : 'Confirm & Save to Firestore'}</span>
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
