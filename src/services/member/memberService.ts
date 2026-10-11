import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Member, MemberStatus, BiometricStatus } from '../../types';

export interface CreateMemberInput {
  gymId: string;
  fullName: string;
  photo?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  phone: string;
  email: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  joiningDate?: string;
  status?: MemberStatus;
  biometricStatus?: BiometricStatus;
  biometricTemplateId?: string;
  notes?: string;
}

export interface UpdateMemberInput {
  fullName?: string;
  photo?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  phone?: string;
  email?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  status?: MemberStatus;
  notes?: string;
}

class MemberService {
  /**
   * Fetch all members for a gym from Firestore
   */
  async getMembers(gymId: string): Promise<Member[]> {
    const q = query(collection(db, 'members'), where('gymId', '==', gymId));
    const snapshot = await getDocs(q);
    const members = snapshot.docs.map(d => d.data() as Member);
    return members.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  /**
   * Fetch a single member by memberId from Firestore
   */
  async getMemberById(memberId: string): Promise<Member | null> {
    const ref = doc(db, 'members', memberId);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) return null;
    return snapshot.data() as Member;
  }

  /**
   * Create a new member in Cloud Firestore
   */
  async createMember(input: CreateMemberInput): Promise<Member> {
    const memberId = `mem-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();

    const newMember: Member = {
      memberId,
      gymId: input.gymId,
      fullName: (input.fullName || '').trim(),
      photo: input.photo || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80`,
      dateOfBirth: input.dateOfBirth || '',
      gender: input.gender || 'MALE',
      phone: (input.phone || '').trim(),
      email: (input.email || '').trim().toLowerCase(),
      address: input.address || '',
      emergencyContactName: input.emergencyContactName || '',
      emergencyContactPhone: input.emergencyContactPhone || '',
      joiningDate: input.joiningDate || now.split('T')[0],
      status: input.status || 'ACTIVE',
      biometricStatus: input.biometricStatus || 'NOT_ENROLLED',
      biometricTemplateId: input.biometricTemplateId || '',
      notes: input.notes || '',
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, 'members', memberId), newMember);
    return newMember;
  }

  /**
   * Update an existing member profile in Cloud Firestore
   */
  async updateMember(memberId: string, updates: UpdateMemberInput): Promise<Member> {
    const ref = doc(db, 'members', memberId);
    const existing = await this.getMemberById(memberId);
    if (!existing) {
      throw new Error(`Member with ID ${memberId} does not exist in Firestore.`);
    }

    const payload: Partial<Member> = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Remove any undefined keys to avoid Firestore invalid-argument errors
    Object.keys(payload).forEach(key => {
      if ((payload as any)[key] === undefined) {
        delete (payload as any)[key];
      }
    });

    await updateDoc(ref, payload);
    return { ...existing, ...payload } as Member;
  }

  /**
   * Delete a member document from Cloud Firestore
   */
  async deleteMember(memberId: string): Promise<void> {
    const ref = doc(db, 'members', memberId);
    await deleteDoc(ref);
  }

  /**
   * Update biometric template reference in Firestore
   */
  async updateBiometrics(memberId: string, biometricStatus: BiometricStatus, templateId?: string): Promise<void> {
    const ref = doc(db, 'members', memberId);
    await updateDoc(ref, {
      biometricStatus,
      biometricTemplateId: templateId || '',
      updatedAt: new Date().toISOString(),
    });
  }
}

export const memberService = new MemberService();
