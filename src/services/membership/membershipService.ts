import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../config/firebase';
import {
  Membership,
  MembershipPlan,
  MembershipHistory,
  Member,
  GymSettings
} from '../../types';
import { formatDateISO, getDaysRemaining, computeMembershipStatus } from '../../utils/dateUtils';
import { notificationService } from '../notifications/notificationService';

class MembershipService {
  /**
   * Fetch all plans for a gym
   */
  async getPlans(gymId: string): Promise<MembershipPlan[]> {
    try {
      const q = query(collection(db, 'membershipPlans'), where('gymId', '==', gymId));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as MembershipPlan);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'membershipPlans');
      return [];
    }
  }

  /**
   * Create or update plan
   */
  async savePlan(plan: MembershipPlan): Promise<void> {
    try {
      await setDoc(doc(db, 'membershipPlans', plan.planId), plan);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `membershipPlans/${plan.planId}`);
    }
  }

  /**
   * Get active/current membership for a member
   */
  async getMemberActiveMembership(gymId: string, memberId: string): Promise<Membership | null> {
    try {
      const q = query(
        collection(db, 'memberships'),
        where('gymId', '==', gymId),
        where('memberId', '==', memberId)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;

      // Find the most recently updated or active membership
      const list = snap.docs.map(d => d.data() as Membership);
      list.sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
      return list[0];
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'memberships');
      return null;
    }
  }

  /**
   * Get all memberships for gym
   */
  async getGymMemberships(gymId: string): Promise<Membership[]> {
    try {
      const q = query(collection(db, 'memberships'), where('gymId', '==', gymId));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as Membership);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'memberships');
      return [];
    }
  }

  /**
   * Renew a membership
   */
  async renewMembership(params: {
    gymId: string;
    memberId: string;
    memberName: string;
    plan: MembershipPlan;
    startDate: string;
    amountPaid: number;
    paymentMethod: any;
    renewedBy?: string;
  }): Promise<Membership> {
    const { gymId, memberId, memberName, plan, startDate, amountPaid, renewedBy } = params;
    const existingMembership = await this.getMemberActiveMembership(gymId, memberId);

    // Calculate new end date based on plan durationDays
    const startObj = new Date(startDate + 'T00:00:00');
    const endObj = new Date(startObj);
    endObj.setDate(endObj.getDate() + plan.durationDays);
    const endDate = formatDateISO(endObj);

    // 1. Archive current membership to membershipHistory if it existed
    if (existingMembership) {
      const historyId = `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const historyRecord: MembershipHistory = {
        historyId,
        membershipId: existingMembership.membershipId,
        memberId: existingMembership.memberId,
        gymId: existingMembership.gymId,
        planId: existingMembership.planId,
        planName: existingMembership.planName,
        startDate: existingMembership.startDate,
        endDate: existingMembership.endDate,
        amount: existingMembership.amount,
        renewedAt: new Date().toISOString(),
        renewedBy,
      };
      await setDoc(doc(db, 'membershipHistory', historyId), historyRecord);
    }

    // 2. Create or update active membership
    const membershipId = existingMembership?.membershipId || `mshp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newStatus = computeMembershipStatus(startDate, endDate);

    const updatedMembership: Membership = {
      membershipId,
      memberId,
      gymId,
      planId: plan.planId,
      planName: plan.name,
      startDate,
      endDate,
      amount: amountPaid,
      paymentStatus: 'PAID',
      status: newStatus,
      createdAt: existingMembership?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'memberships', membershipId), updatedMembership);

    // 3. Dispatch MEMBERSHIP_RENEWED notification
    await notificationService.sendNotification({
      gymId,
      recipientId: memberId,
      recipientRole: 'MEMBER',
      type: 'MEMBERSHIP_RENEWED',
      title: 'Membership Renewed Successfully',
      message: `Your membership has been renewed for ${plan.name}. Valid until ${endDate}.`,
    });

    await notificationService.sendNotification({
      gymId,
      recipientId: gymId,
      recipientRole: 'OWNER',
      type: 'MEMBERSHIP_RENEWED',
      title: 'Member Renewed',
      message: `${memberName} renewed plan ${plan.name} until ${endDate}.`,
    });

    return updatedMembership;
  }

  /**
   * Freeze membership
   */
  async freezeMembership(params: {
    membershipId: string;
    gymId: string;
    memberId: string;
    memberName: string;
    reason: string;
  }): Promise<void> {
    const { membershipId, gymId, memberId, memberName, reason } = params;
    const ref = doc(db, 'memberships', membershipId);
    await updateDoc(ref, {
      status: 'FROZEN',
      freezeReason: reason,
      updatedAt: new Date().toISOString(),
    });

    await notificationService.sendNotification({
      gymId,
      recipientId: memberId,
      recipientRole: 'MEMBER',
      type: 'MEMBERSHIP_FROZEN',
      title: 'Membership Frozen',
      message: `Your membership has been frozen: "${reason}". Access is temporarily paused.`,
    });
  }

  /**
   * Unfreeze membership
   */
  async unfreezeMembership(membership: Membership): Promise<void> {
    const newStatus = computeMembershipStatus(membership.startDate, membership.endDate);
    const ref = doc(db, 'memberships', membership.membershipId);
    await updateDoc(ref, {
      status: newStatus,
      freezeReason: '',
      updatedAt: new Date().toISOString(),
    });

    await notificationService.sendNotification({
      gymId: membership.gymId,
      recipientId: membership.memberId,
      recipientRole: 'MEMBER',
      type: 'MEMBERSHIP_UNFROZEN',
      title: 'Membership Active',
      message: 'Your membership freeze has ended and gym access is restored.',
    });
  }

  /**
   * CRITICAL EXPIRY AUTOMATION BATCH JOB
   * Evaluates all active memberships, calculates days remaining,
   * updates status to EXPIRING_SOON / EXPIRED, and dispatches
   * idempotent alerts (7, 6, 5, 4, 3, 2, 1 days before and on expiry).
   */
  async runExpiryAutomationJob(gymId: string, referenceDateStr: string = formatDateISO()): Promise<{
    processed: number;
    expiringSoonCount: number;
    expiredCount: number;
    notificationsSent: number;
    duplicatesPrevented: number;
  }> {
    const memberships = await this.getGymMemberships(gymId);
    let expiringSoonCount = 0;
    let expiredCount = 0;
    let notificationsSent = 0;
    let duplicatesPrevented = 0;

    // Fetch members to have names and emails
    const membersSnap = await getDocs(query(collection(db, 'members'), where('gymId', '==', gymId)));
    const membersMap = new Map<string, Member>();
    membersSnap.docs.forEach(d => {
      const m = d.data() as Member;
      membersMap.set(m.memberId, m);
    });

    for (const mshp of memberships) {
      // Don't modify frozen or suspended memberships
      if (mshp.status === 'FROZEN' || mshp.status === 'SUSPENDED' || mshp.status === 'CANCELLED') {
        continue;
      }

      const daysLeft = getDaysRemaining(mshp.endDate, referenceDateStr);
      const member = membersMap.get(mshp.memberId);
      const memberName = member?.fullName || 'Member';

      if (daysLeft < 0) {
        // Expired
        expiredCount++;
        if (mshp.status !== 'EXPIRED') {
          await updateDoc(doc(db, 'memberships', mshp.membershipId), {
            status: 'EXPIRED',
            updatedAt: new Date().toISOString(),
          });
        }

        // On expiry notification with key
        const key = `${mshp.membershipId}_EXPIRED_${mshp.endDate}`;
        const res = await notificationService.sendNotification({
          gymId,
          recipientId: mshp.memberId,
          recipientRole: 'MEMBER',
          type: 'MEMBERSHIP_EXPIRED',
          title: 'Membership Expired',
          message: 'Your gym membership has expired. Please renew your membership to regain gym access.',
          notificationKey: key,
          recipientContact: member ? { email: member.email, phone: member.phone } : undefined,
        });

        if (res.sent) notificationsSent++;
        if (res.isDuplicate) duplicatesPrevented++;

      } else if (daysLeft <= 7 && daysLeft >= 0) {
        // Expiring soon
        expiringSoonCount++;
        if (mshp.status !== 'EXPIRING_SOON') {
          await updateDoc(doc(db, 'memberships', mshp.membershipId), {
            status: 'EXPIRING_SOON',
            updatedAt: new Date().toISOString(),
          });
        }

        // Send daily reminder for 7, 6, 5, 4, 3, 2, 1 days
        const reminderDayText = daysLeft === 1
          ? 'tomorrow'
          : `in ${daysLeft} days on ${mshp.endDate}`;

        const memberMsg = daysLeft === 1
          ? 'Your gym membership expires tomorrow. Please renew your membership to continue accessing the gym.'
          : `Your GymGuard membership expires in ${daysLeft} days on ${mshp.endDate}. Please renew your membership to continue accessing the gym.`;

        const ownerMsg = `${memberName}'s gym membership expires ${reminderDayText}.`;

        const memberKey = `${mshp.membershipId}_EXPIRING_${daysLeft}DAYS_${referenceDateStr}`;
        const ownerKey = `${mshp.membershipId}_OWNER_EXPIRING_${daysLeft}DAYS_${referenceDateStr}`;

        // Member alert
        const resMember = await notificationService.sendNotification({
          gymId,
          recipientId: mshp.memberId,
          recipientRole: 'MEMBER',
          type: 'MEMBERSHIP_EXPIRING_SOON',
          title: `Membership Expiring (${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left)`,
          message: memberMsg,
          notificationKey: memberKey,
          recipientContact: member ? { email: member.email, phone: member.phone } : undefined,
        });

        if (resMember.sent) notificationsSent++;
        if (resMember.isDuplicate) duplicatesPrevented++;

        // Owner alert
        const resOwner = await notificationService.sendNotification({
          gymId,
          recipientId: gymId,
          recipientRole: 'OWNER',
          type: 'MEMBERSHIP_EXPIRING_SOON',
          title: `Member Expiry Alert: ${memberName}`,
          message: ownerMsg,
          notificationKey: ownerKey,
        });

        if (resOwner.sent) notificationsSent++;
        if (resOwner.isDuplicate) duplicatesPrevented++;
      } else {
        // Active (> 7 days)
        if (mshp.status !== 'ACTIVE') {
          await updateDoc(doc(db, 'memberships', mshp.membershipId), {
            status: 'ACTIVE',
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    return {
      processed: memberships.length,
      expiringSoonCount,
      expiredCount,
      notificationsSent,
      duplicatesPrevented,
    };
  }
}

export const membershipService = new MembershipService();
