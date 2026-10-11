import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  updateDoc,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../config/firebase';
import { AttendanceRecord, AttendanceEntryMethod } from '../../types';

class AttendanceService {
  /**
   * Get active check-in if member is currently inside
   */
  async getActiveCheckIn(gymId: string, memberId: string): Promise<AttendanceRecord | null> {
    try {
      const q = query(
        collection(db, 'attendance'),
        where('gymId', '==', gymId),
        where('memberId', '==', memberId),
        where('status', '==', 'INSIDE'),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      return snapshot.docs[0].data() as AttendanceRecord;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'attendance');
      return null;
    }
  }

  /**
   * Record entry (Check-in)
   */
  async recordCheckIn(params: {
    gymId: string;
    memberId: string;
    memberName?: string;
    deviceId?: string;
    entryMethod: AttendanceEntryMethod;
  }): Promise<AttendanceRecord> {
    const attendanceId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const record: AttendanceRecord = {
      attendanceId,
      gymId: params.gymId,
      memberId: params.memberId,
      memberName: params.memberName || '',
      deviceId: params.deviceId || '',
      checkInTime: now,
      entryMethod: params.entryMethod,
      status: 'INSIDE',
      createdAt: now,
    };

    try {
      await setDoc(doc(db, 'attendance', attendanceId), record);
      return record;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `attendance/${attendanceId}`);
      throw error;
    }
  }

  /**
   * Record exit (Check-out)
   */
  async recordCheckOut(activeRecord: AttendanceRecord): Promise<AttendanceRecord> {
    const now = new Date();
    const checkInDate = new Date(activeRecord.checkInTime);
    const durationMinutes = Math.max(1, Math.round((now.getTime() - checkInDate.getTime()) / (1000 * 60)));

    const updated: AttendanceRecord = {
      ...activeRecord,
      checkOutTime: now.toISOString(),
      durationMinutes,
      status: 'COMPLETED',
    };

    try {
      await updateDoc(doc(db, 'attendance', activeRecord.attendanceId), {
        checkOutTime: updated.checkOutTime,
        durationMinutes,
        status: 'COMPLETED',
      });
      return updated;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `attendance/${activeRecord.attendanceId}`);
      throw error;
    }
  }

  /**
   * Get all members currently inside a gym
   */
  async getCurrentlyInside(gymId: string): Promise<AttendanceRecord[]> {
    try {
      const q = query(
        collection(db, 'attendance'),
        where('gymId', '==', gymId),
        where('status', '==', 'INSIDE')
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(d => d.data() as AttendanceRecord);
      return list.sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'attendance');
      return [];
    }
  }

  /**
   * Get attendance records for a member or gym
   */
  async getAttendanceHistory(gymId: string, memberId?: string, limitCount: number = 100): Promise<AttendanceRecord[]> {
    try {
      let q;
      if (memberId) {
        q = query(
          collection(db, 'attendance'),
          where('gymId', '==', gymId),
          where('memberId', '==', memberId),
          limit(limitCount)
        );
      } else {
        q = query(
          collection(db, 'attendance'),
          where('gymId', '==', gymId),
          limit(limitCount)
        );
      }
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(d => d.data() as AttendanceRecord);
      return list.sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'attendance');
      return [];
    }
  }
}

export const attendanceService = new AttendanceService();
