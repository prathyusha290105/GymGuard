import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../config/firebase';
import {
  AccessDecision,
  AccessLog,
  AccessResult,
  Member,
  Membership,
  Device,
} from '../../types';
import { formatDateISO, getDaysRemaining } from '../../utils/dateUtils';
import { accessControllerService } from '../hardware/accessControllerService';
import { attendanceService } from '../attendance/attendanceService';

// In-memory cache to throttle duplicate rapid scans per member
const lastScanTimes = new Map<string, number>();

export interface AuthorizeAccessRequest {
  gymId: string;
  memberId?: string;
  deviceId: string;
  direction?: 'IN' | 'OUT';
  source?: string;
}

class AccessAuthorizationService {
  /**
   * The single source of truth for physical access control decisions
   */
  async authorizeAccess(params: AuthorizeAccessRequest): Promise<AccessDecision> {
    const { gymId, memberId, deviceId, direction = 'IN', source = 'BIOMETRIC_READER' } = params;
    const now = new Date();
    const todayStr = formatDateISO(now);
    const logId = `log_${now.getTime()}_${Math.random().toString(36).substring(2, 6)}`;

    // Check device status
    let deviceName = 'Turnstile Entrance Reader';
    try {
      const devDoc = await getDoc(doc(db, 'devices', deviceId));
      if (devDoc.exists()) {
        const devData = devDoc.data() as Device;
        deviceName = devData.name;
        if (devData.status === 'DISABLED') {
          return this.recordAndDeny(logId, gymId, memberId, 'Unknown', deviceId, deviceName, 'DENIED_DEVICE_NOT_AUTHORIZED', 'Device is disabled in settings', direction, source);
        }
        if (devData.status === 'OFFLINE') {
          return this.recordAndDeny(logId, gymId, memberId, 'Unknown', deviceId, deviceName, 'DEVICE_ERROR', 'Reader controller is offline', direction, source);
        }
      }
    } catch {
      // Proceed with standard reader
    }

    // 1. Verify member ID provided
    if (!memberId || memberId === 'UNKNOWN_MEMBER' || memberId === 'UNKNOWN_FINGERPRINT') {
      return this.recordAndDeny(
        logId,
        gymId,
        undefined,
        'Unknown Individual',
        deviceId,
        deviceName,
        'DENIED_UNKNOWN_MEMBER',
        'Fingerprint template not found in enrolled member database.',
        direction,
        source
      );
    }

    // Duplicate scan check (within 10 seconds for same member to avoid accidental double-clicks)
    const lastScan = lastScanTimes.get(memberId);
    if (lastScan && now.getTime() - lastScan < 10000) {
      // Allowed scan still active
      console.log(`[AccessAuthorization] Member ${memberId} scanned within throttle window`);
    }
    lastScanTimes.set(memberId, now.getTime());

    // 2. Fetch member document
    let member: Member | null = null;
    try {
      const memberDoc = await getDoc(doc(db, 'members', memberId));
      if (!memberDoc.exists()) {
        return this.recordAndDeny(
          logId,
          gymId,
          memberId,
          'Unregistered Member',
          deviceId,
          deviceName,
          'DENIED_UNKNOWN_MEMBER',
          'Member record does not exist in gym registry.',
          direction,
          source
        );
      }
      member = memberDoc.data() as Member;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `members/${memberId}`);
    }

    if (!member) {
      return this.recordAndDeny(logId, gymId, memberId, 'Unknown', deviceId, deviceName, 'DENIED_UNKNOWN_MEMBER', 'Member not found', direction, source);
    }

    // 3. Verify member account status
    if (member.status === 'INACTIVE') {
      return this.recordAndDeny(logId, gymId, memberId, member.fullName, deviceId, deviceName, 'DENIED_INACTIVE_MEMBER', 'Member profile is deactivated.', direction, source, member);
    }
    if (member.status === 'SUSPENDED') {
      return this.recordAndDeny(logId, gymId, memberId, member.fullName, deviceId, deviceName, 'DENIED_SUSPENDED', 'Member profile has been suspended by management.', direction, source, member);
    }
    if (member.status === 'BLACKLISTED') {
      return this.recordAndDeny(logId, gymId, memberId, member.fullName, deviceId, deviceName, 'DENIED_CANCELLED', 'Member is blacklisted from entering premises.', direction, source, member);
    }

    // 4. Retrieve current membership
    let membership: Membership | null = null;
    try {
      const q = query(
        collection(db, 'memberships'),
        where('gymId', '==', gymId),
        where('memberId', '==', memberId)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const list = snap.docs.map(d => d.data() as Membership);
        list.sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
        membership = list[0];
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'memberships');
    }

    if (!membership) {
      return this.recordAndDeny(
        logId,
        gymId,
        memberId,
        member.fullName,
        deviceId,
        deviceName,
        'DENIED_EXPIRED',
        'No active membership subscription on file for this member.',
        direction,
        source,
        member
      );
    }

    // 5. Evaluate membership status and dates
    if (membership.status === 'FROZEN') {
      return this.recordAndDeny(
        logId,
        gymId,
        memberId,
        member.fullName,
        deviceId,
        deviceName,
        'DENIED_FROZEN',
        `Membership is frozen: ${membership.freezeReason || 'Requested by member'}`,
        direction,
        source,
        member,
        membership
      );
    }

    if (membership.status === 'SUSPENDED') {
      return this.recordAndDeny(
        logId,
        gymId,
        memberId,
        member.fullName,
        deviceId,
        deviceName,
        'DENIED_SUSPENDED',
        'Membership subscription suspended due to administrative action or arrears.',
        direction,
        source,
        member,
        membership
      );
    }

    if (membership.status === 'CANCELLED') {
      return this.recordAndDeny(
        logId,
        gymId,
        memberId,
        member.fullName,
        deviceId,
        deviceName,
        'DENIED_CANCELLED',
        'Membership has been permanently cancelled.',
        direction,
        source,
        member,
        membership
      );
    }

    // Date checks
    if (todayStr < membership.startDate) {
      return this.recordAndDeny(
        logId,
        gymId,
        memberId,
        member.fullName,
        deviceId,
        deviceName,
        'DENIED_MEMBERSHIP_NOT_STARTED',
        `Membership has not started yet. Starts on ${membership.startDate}.`,
        direction,
        source,
        member,
        membership
      );
    }

    const daysRemaining = getDaysRemaining(membership.endDate, todayStr);
    if (daysRemaining < 0 || todayStr > membership.endDate || membership.status === 'EXPIRED') {
      return this.recordAndDeny(
        logId,
        gymId,
        memberId,
        member.fullName,
        deviceId,
        deviceName,
        'DENIED_EXPIRED',
        `Membership expired on ${membership.endDate}. Renewal required.`,
        direction,
        source,
        member,
        membership,
        daysRemaining
      );
    }

    // ==========================================
    // ALL CHECKS PASSED: AUTHORIZATION GRANTED!
    // ==========================================
    const successReason = daysRemaining <= 7
      ? `Valid Membership (Expiring soon: ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} remaining)`
      : `Valid Membership (${membership.planName} - ${daysRemaining} days remaining)`;

    // 1. Record Access Log
    const log: AccessLog = {
      accessLogId: logId,
      gymId,
      memberId,
      memberName: member.fullName,
      deviceId,
      deviceName,
      result: 'ACCESS_GRANTED',
      reason: successReason,
      direction,
      source,
      timestamp: now.toISOString(),
    };
    try {
      await setDoc(doc(db, 'accessLogs', logId), log);
    } catch (e) {
      console.error('Failed to log access', e);
    }

    // 2. Request Physical Door Unlock via AccessControllerService
    const unlockResult = await accessControllerService.unlockDoor(4);
    if (!unlockResult.success) {
      console.warn('Door controller reported unlock issue:', unlockResult.message);
    }

    // 3. Record Attendance (Toggle check-in / check-out based on current status)
    let attendanceRecorded = false;
    try {
      const activeCheckIn = await attendanceService.getActiveCheckIn(gymId, memberId);
      if (activeCheckIn && direction === 'OUT') {
        await attendanceService.recordCheckOut(activeCheckIn);
        attendanceRecorded = true;
      } else if (activeCheckIn && direction === 'IN') {
        // If already marked inside, treat consecutive scan as check-out if more than 30s passed
        const checkInTime = new Date(activeCheckIn.checkInTime).getTime();
        if (now.getTime() - checkInTime > 30000) {
          await attendanceService.recordCheckOut(activeCheckIn);
          attendanceRecorded = true;
        }
      } else {
        await attendanceService.recordCheckIn({
          gymId,
          memberId,
          memberName: member.fullName,
          deviceId,
          entryMethod: 'FINGERPRINT',
        });
        attendanceRecorded = true;
      }
    } catch (err) {
      console.error('Error handling attendance checkin', err);
    }

    return {
      allowed: true,
      result: 'ACCESS_GRANTED',
      reason: successReason,
      member,
      membership,
      daysRemaining,
      doorAction: 'UNLOCK',
      attendanceRecorded,
    };
  }

  private async recordAndDeny(
    logId: string,
    gymId: string,
    memberId: string | undefined,
    memberName: string,
    deviceId: string,
    deviceName: string,
    result: AccessResult,
    reason: string,
    direction: 'IN' | 'OUT',
    source: string,
    member?: Member,
    membership?: Membership,
    daysRemaining?: number
  ): Promise<AccessDecision> {
    const log: AccessLog = {
      accessLogId: logId,
      gymId,
      memberId,
      memberName,
      deviceId,
      deviceName,
      result,
      reason,
      direction,
      source,
      timestamp: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'accessLogs', logId), log);
    } catch (e) {
      console.error('Failed to write deny log', e);
    }

    return {
      allowed: false,
      result,
      reason,
      member,
      membership,
      daysRemaining,
      doorAction: 'STAY_LOCKED',
      attendanceRecorded: false,
    };
  }
}

export const accessAuthorizationService = new AccessAuthorizationService();
