import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  Gym,
  UserProfile,
  Member,
  MembershipPlan,
  Membership,
  Payment,
  AttendanceRecord,
  AccessLog,
  Device,
  GymSettings,
  AppNotification
} from '../../types';
import { formatDateISO } from '../../utils/dateUtils';
import { mockBiometricDevice } from '../hardware/MockBiometricDevice';

export const DEMO_GYM_ID = 'gym-01';

export const DEMO_USERS = {
  OWNER: {
    email: 'owner@gymguard.demo',
    password: 'GymGuard@123',
    fullName: 'Marcus Vance',
    role: 'GYM_OWNER' as const,
  },
  STAFF: {
    email: 'staff@gymguard.demo',
    password: 'GymGuard@123',
    fullName: 'Sarah Jenkins',
    role: 'STAFF' as const,
  },
  MEMBER: {
    email: 'member@gymguard.demo',
    password: 'GymGuard@123',
    fullName: 'Alex Rivera',
    role: 'MEMBER' as const,
    memberId: 'mem-001',
  },
};

export async function isDatabaseSeeded(): Promise<boolean> {
  try {
    const gymDoc = await getDoc(doc(db, 'gyms', DEMO_GYM_ID));
    return gymDoc.exists();
  } catch {
    return false;
  }
}

export async function seedDemoData(): Promise<void> {
  const now = new Date();
  const todayStr = formatDateISO(now);

  // Helper to add days to today
  const addDays = (days: number): string => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return formatDateISO(d);
  };

  // 1. Gym
  const gym: Gym = {
    gymId: DEMO_GYM_ID,
    name: 'GymGuard Elite Fitness Center',
    address: '742 Evergreen Blvd, Suite 400, Metro City',
    phone: '+1 (555) 382-9901',
    email: 'contact@gymguard-elite.com',
    timezone: 'America/New_York',
    createdAt: now.toISOString(),
  };
  await setDoc(doc(db, 'gyms', DEMO_GYM_ID), gym);

  // 2. Settings
  const settings: GymSettings = {
    settingsId: `settings-${DEMO_GYM_ID}`,
    gymId: DEMO_GYM_ID,
    expiryNoticeDays: 7,
    duplicateScanIntervalSeconds: 30,
    gracePeriodDays: 0,
    timezone: 'America/New_York',
    emailNotificationsEnabled: true,
    smsNotificationsEnabled: true,
    whatsappNotificationsEnabled: true,
    doorUnlockDurationSeconds: 4,
    updatedAt: now.toISOString(),
  };
  await setDoc(doc(db, 'settings', settings.settingsId), settings);

  // 3. Devices
  const devices: Device[] = [
    {
      deviceId: 'bio-dev-01',
      gymId: DEMO_GYM_ID,
      name: 'Main Turnstile Fingerprint Reader (Optical 500 DPI)',
      type: 'BIOMETRIC',
      location: 'Front Turnstile A',
      ipAddress: '192.168.1.101',
      status: 'ONLINE',
      lastSeen: now.toISOString(),
      firmware: 'v3.4.12-secure',
    },
    {
      deviceId: 'door-ctrl-01',
      gymId: DEMO_GYM_ID,
      name: 'Heavy-Duty Magnetic Door Relay Controller',
      type: 'DOOR_CONTROLLER',
      location: 'Main Glass Entry Doors',
      ipAddress: '192.168.1.102',
      status: 'ONLINE',
      lastSeen: now.toISOString(),
      firmware: 'v2.1.8-relay',
    },
    {
      deviceId: 'bio-dev-02',
      gymId: DEMO_GYM_ID,
      name: 'Studio B VIP Scanner',
      type: 'BIOMETRIC',
      location: 'VIP & Sauna Wing',
      ipAddress: '192.168.1.103',
      status: 'ONLINE',
      lastSeen: now.toISOString(),
      firmware: 'v3.4.12-secure',
    },
  ];
  for (const d of devices) {
    await setDoc(doc(db, 'devices', d.deviceId), d);
  }

  // 4. Membership Plans
  const plans: MembershipPlan[] = [
    {
      planId: 'plan-monthly',
      gymId: DEMO_GYM_ID,
      name: 'Monthly Standard',
      description: 'Standard access to main gym floor and locker rooms for 30 days.',
      durationDays: 30,
      price: 60,
      active: true,
      createdAt: now.toISOString(),
    },
    {
      planId: 'plan-quarterly',
      gymId: DEMO_GYM_ID,
      name: 'Quarterly Prime',
      description: '90-day access including group fitness and cardio zone.',
      durationDays: 90,
      price: 155,
      active: true,
      createdAt: now.toISOString(),
    },
    {
      planId: 'plan-half-yearly',
      gymId: DEMO_GYM_ID,
      name: 'Semi-Annual Pro',
      description: '180-day unlimited access with complimentary towel service and shaker.',
      durationDays: 180,
      price: 280,
      active: true,
      createdAt: now.toISOString(),
    },
    {
      planId: 'plan-yearly',
      gymId: DEMO_GYM_ID,
      name: 'Annual VIP All-Access',
      description: '365-day 24/7 unlimited biometric access, guest passes, and sauna.',
      durationDays: 365,
      price: 499,
      active: true,
      createdAt: now.toISOString(),
    },
    {
      planId: 'plan-custom-student',
      planName: 'Student Term Pass',
      gymId: DEMO_GYM_ID,
      name: 'Student Term Pass',
      description: '120-day semester access with verified student ID.',
      durationDays: 120,
      price: 180,
      active: true,
      createdAt: now.toISOString(),
    } as any,
  ];
  for (const p of plans) {
    await setDoc(doc(db, 'membershipPlans', p.planId), p);
  }

  // 5. Members List (20 realistic profiles)
  const memberDefinitions: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'BLACKLISTED';
    membershipStatus: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'FROZEN' | 'SUSPENDED' | 'NOT_STARTED';
    planId: string;
    startOffset: number;
    endOffset: number; // relative to today
    freezeReason?: string;
  }> = [
    // 5 Active (> 7 days)
    { id: 'mem-001', name: 'Alex Rivera', email: 'member@gymguard.demo', phone: '+1 555-0101', gender: 'MALE', status: 'ACTIVE', membershipStatus: 'ACTIVE', planId: 'plan-yearly', startOffset: -120, endOffset: 245 },
    { id: 'mem-002', name: 'Elena Rostova', email: 'elena.rostova@example.com', phone: '+1 555-0102', gender: 'FEMALE', status: 'ACTIVE', membershipStatus: 'ACTIVE', planId: 'plan-half-yearly', startOffset: -40, endOffset: 140 },
    { id: 'mem-003', name: 'David Chen', email: 'david.chen@example.com', phone: '+1 555-0103', gender: 'MALE', status: 'ACTIVE', membershipStatus: 'ACTIVE', planId: 'plan-quarterly', startOffset: -20, endOffset: 70 },
    { id: 'mem-004', name: 'Sophia Martinez', email: 'sophia.m@example.com', phone: '+1 555-0104', gender: 'FEMALE', status: 'ACTIVE', membershipStatus: 'ACTIVE', planId: 'plan-yearly', startOffset: -90, endOffset: 275 },
    { id: 'mem-005', name: 'Marcus Sterling', email: 'm.sterling@example.com', phone: '+1 555-0105', gender: 'MALE', status: 'ACTIVE', membershipStatus: 'ACTIVE', planId: 'plan-monthly', startOffset: -10, endOffset: 20 },

    // 5 Expiring Soon (7, 5, 3, 2, 1 days)
    { id: 'mem-006', name: 'Rahul Sharma', email: 'rahul.s@example.com', phone: '+1 555-0106', gender: 'MALE', status: 'ACTIVE', membershipStatus: 'EXPIRING_SOON', planId: 'plan-monthly', startOffset: -23, endOffset: 7 },
    { id: 'mem-007', name: 'Jessica Taylor', email: 'jess.taylor@example.com', phone: '+1 555-0107', gender: 'FEMALE', status: 'ACTIVE', membershipStatus: 'EXPIRING_SOON', planId: 'plan-quarterly', startOffset: -85, endOffset: 5 },
    { id: 'mem-008', name: 'Liam O’Connor', email: 'liam.oc@example.com', phone: '+1 555-0108', gender: 'MALE', status: 'ACTIVE', membershipStatus: 'EXPIRING_SOON', planId: 'plan-monthly', startOffset: -27, endOffset: 3 },
    { id: 'mem-009', name: 'Aaliyah Khan', email: 'aaliyah.k@example.com', phone: '+1 555-0109', gender: 'FEMALE', status: 'ACTIVE', membershipStatus: 'EXPIRING_SOON', planId: 'plan-yearly', startOffset: -363, endOffset: 2 },
    { id: 'mem-010', name: 'Lucas Bennett', email: 'lucas.b@example.com', phone: '+1 555-0110', gender: 'MALE', status: 'ACTIVE', membershipStatus: 'EXPIRING_SOON', planId: 'plan-monthly', startOffset: -29, endOffset: 1 },

    // 5 Expired (-1, -7, -25, -60, -120 days)
    { id: 'mem-011', name: 'Carlos Mendez', email: 'carlos.m@example.com', phone: '+1 555-0111', gender: 'MALE', status: 'ACTIVE', membershipStatus: 'EXPIRED', planId: 'plan-monthly', startOffset: -32, endOffset: -2 },
    { id: 'mem-012', name: 'Zoe Washington', email: 'zoe.w@example.com', phone: '+1 555-0112', gender: 'FEMALE', status: 'ACTIVE', membershipStatus: 'EXPIRED', planId: 'plan-monthly', startOffset: -38, endOffset: -8 },
    { id: 'mem-013', name: 'Ethan Hunt', email: 'ethan.h@example.com', phone: '+1 555-0113', gender: 'MALE', status: 'ACTIVE', membershipStatus: 'EXPIRED', planId: 'plan-quarterly', startOffset: -115, endOffset: -25 },
    { id: 'mem-014', name: 'Chloe Dubois', email: 'chloe.d@example.com', phone: '+1 555-0114', gender: 'FEMALE', status: 'ACTIVE', membershipStatus: 'EXPIRED', planId: 'plan-half-yearly', startOffset: -240, endOffset: -60 },
    { id: 'mem-015', name: 'Victor Vance', email: 'victor.v@example.com', phone: '+1 555-0115', gender: 'MALE', status: 'INACTIVE', membershipStatus: 'EXPIRED', planId: 'plan-yearly', startOffset: -480, endOffset: -115 },

    // 2 Frozen
    { id: 'mem-016', name: 'Maya Lin', email: 'maya.lin@example.com', phone: '+1 555-0116', gender: 'FEMALE', status: 'ACTIVE', membershipStatus: 'FROZEN', planId: 'plan-yearly', startOffset: -60, endOffset: 120, freezeReason: 'Knee rehabilitation after surgery' },
    { id: 'mem-017', name: 'Omar Farooq', email: 'omar.f@example.com', phone: '+1 555-0117', gender: 'MALE', status: 'ACTIVE', membershipStatus: 'FROZEN', planId: 'plan-half-yearly', startOffset: -30, endOffset: 90, freezeReason: 'Overseas business trip (30 days)' },

    // 2 Suspended
    { id: 'mem-018', name: 'Brandon Cole', email: 'brandon.c@example.com', phone: '+1 555-0118', gender: 'MALE', status: 'SUSPENDED', membershipStatus: 'SUSPENDED', planId: 'plan-monthly', startOffset: -15, endOffset: 15 },
    { id: 'mem-019', name: 'Natasha Roman', email: 'natasha.r@example.com', phone: '+1 555-0119', gender: 'FEMALE', status: 'SUSPENDED', membershipStatus: 'SUSPENDED', planId: 'plan-quarterly', startOffset: -45, endOffset: 45 },

    // 1 Not Started (Future subscription)
    { id: 'mem-020', name: 'Jordan Hayes', email: 'jordan.h@example.com', phone: '+1 555-0120', gender: 'OTHER', status: 'ACTIVE', membershipStatus: 'NOT_STARTED', planId: 'plan-monthly', startOffset: 5, endOffset: 35 },
  ];

  for (const def of memberDefinitions) {
    const templateToken = `FP_HASH_${def.id.toUpperCase()}_SEC`;
    // Register mock template in hardware simulator
    mockBiometricDevice.registerTemplate(def.id, templateToken);

    const member: Member = {
      memberId: def.id,
      gymId: DEMO_GYM_ID,
      fullName: def.name,
      photo: `https://images.unsplash.com/photo-${1500000000000 + parseInt(def.id.split('-')[1]) * 10000}?auto=format&fit=crop&w=200&h=200&q=80`,
      dateOfBirth: '1995-05-14',
      gender: def.gender,
      phone: def.phone,
      email: def.email,
      address: `${100 + parseInt(def.id.split('-')[1])} Fitness Ave, Metro City`,
      emergencyContactName: 'Emergency Contact',
      emergencyContactPhone: '+1 555-9999',
      joiningDate: addDays(def.startOffset),
      status: def.status,
      biometricStatus: 'ENROLLED',
      biometricTemplateId: templateToken,
      createdAt: addDays(def.startOffset),
    };
    const existingMemSnap = await getDoc(doc(db, 'members', def.id));
    if (!existingMemSnap.exists()) {
      await setDoc(doc(db, 'members', member.memberId), member);
    }

    // Membership
    const plan = plans.find(p => p.planId === def.planId) || plans[0];
    const membership: Membership = {
      membershipId: `mshp-${def.id}`,
      memberId: def.id,
      gymId: DEMO_GYM_ID,
      planId: plan.planId,
      planName: plan.name,
      startDate: addDays(def.startOffset),
      endDate: addDays(def.endOffset),
      amount: plan.price,
      paymentStatus: 'PAID',
      status: def.membershipStatus,
      freezeReason: def.freezeReason || '',
      createdAt: addDays(def.startOffset),
      updatedAt: now.toISOString(),
    };
    const existingMshp = await getDoc(doc(db, 'memberships', membership.membershipId));
    if (!existingMshp.exists()) {
      await setDoc(doc(db, 'memberships', membership.membershipId), membership);
    }

    // Payment record
    const payment: Payment = {
      paymentId: `pay-${def.id}`,
      gymId: DEMO_GYM_ID,
      memberId: def.id,
      memberName: def.name,
      membershipId: membership.membershipId,
      amount: plan.price,
      paymentMethod: def.id === 'mem-001' ? 'CARD' : 'UPI',
      transactionId: `TXN_${Date.now()}_${def.id}`,
      paymentDate: addDays(def.startOffset),
      status: 'PAID',
      notes: `Payment for ${plan.name}`,
      createdAt: addDays(def.startOffset),
    };
    const existingPay = await getDoc(doc(db, 'payments', payment.paymentId));
    if (!existingPay.exists()) {
      await setDoc(doc(db, 'payments', payment.paymentId), payment);
    }
  }

  // 6. Currently Inside Attendance (e.g. 3 active gym-goers right now)
  const currentlyInside: AttendanceRecord[] = [
    {
      attendanceId: 'att-live-1',
      gymId: DEMO_GYM_ID,
      memberId: 'mem-001',
      memberName: 'Alex Rivera',
      deviceId: 'bio-dev-01',
      checkInTime: new Date(now.getTime() - 84 * 60 * 1000).toISOString(), // 1h 24m ago
      entryMethod: 'FINGERPRINT',
      status: 'INSIDE',
      createdAt: new Date(now.getTime() - 84 * 60 * 1000).toISOString(),
    },
    {
      attendanceId: 'att-live-2',
      gymId: DEMO_GYM_ID,
      memberId: 'mem-002',
      memberName: 'Elena Rostova',
      deviceId: 'bio-dev-01',
      checkInTime: new Date(now.getTime() - 42 * 60 * 1000).toISOString(), // 42m ago
      entryMethod: 'FINGERPRINT',
      status: 'INSIDE',
      createdAt: new Date(now.getTime() - 42 * 60 * 1000).toISOString(),
    },
    {
      attendanceId: 'att-live-3',
      gymId: DEMO_GYM_ID,
      memberId: 'mem-003',
      memberName: 'David Chen',
      deviceId: 'bio-dev-01',
      checkInTime: new Date(now.getTime() - 18 * 60 * 1000).toISOString(), // 18m ago
      entryMethod: 'FINGERPRINT',
      status: 'INSIDE',
      createdAt: new Date(now.getTime() - 18 * 60 * 1000).toISOString(),
    },
  ];
  for (const att of currentlyInside) {
    await setDoc(doc(db, 'attendance', att.attendanceId), att);
  }

  // Historical completed attendance records
  const historicalAttendance: AttendanceRecord[] = [
    {
      attendanceId: 'att-hist-1',
      gymId: DEMO_GYM_ID,
      memberId: 'mem-004',
      memberName: 'Sophia Martinez',
      deviceId: 'bio-dev-01',
      checkInTime: new Date(now.getTime() - 5 * 3600 * 1000).toISOString(),
      checkOutTime: new Date(now.getTime() - 4 * 3600 * 1000).toISOString(),
      durationMinutes: 60,
      entryMethod: 'FINGERPRINT',
      status: 'COMPLETED',
      createdAt: new Date(now.getTime() - 5 * 3600 * 1000).toISOString(),
    },
    {
      attendanceId: 'att-hist-2',
      gymId: DEMO_GYM_ID,
      memberId: 'mem-005',
      memberName: 'Marcus Sterling',
      deviceId: 'bio-dev-01',
      checkInTime: new Date(now.getTime() - 8 * 3600 * 1000).toISOString(),
      checkOutTime: new Date(now.getTime() - 7 * 3600 * 1000).toISOString(),
      durationMinutes: 55,
      entryMethod: 'FINGERPRINT',
      status: 'COMPLETED',
      createdAt: new Date(now.getTime() - 8 * 3600 * 1000).toISOString(),
    },
  ];
  for (const att of historicalAttendance) {
    await setDoc(doc(db, 'attendance', att.attendanceId), att);
  }

  // 7. Access Logs (including valid and denied attempts)
  const initialLogs: AccessLog[] = [
    {
      accessLogId: 'log-01',
      gymId: DEMO_GYM_ID,
      memberId: 'mem-001',
      memberName: 'Alex Rivera',
      deviceId: 'bio-dev-01',
      deviceName: 'Main Turnstile Fingerprint Reader',
      result: 'ACCESS_GRANTED',
      reason: 'Valid Membership (Annual VIP All-Access - 245 days remaining)',
      direction: 'IN',
      source: 'BIOMETRIC_READER',
      timestamp: new Date(now.getTime() - 84 * 60 * 1000).toISOString(),
    },
    {
      accessLogId: 'log-02',
      gymId: DEMO_GYM_ID,
      memberId: 'mem-011',
      memberName: 'Carlos Mendez',
      deviceId: 'bio-dev-01',
      deviceName: 'Main Turnstile Fingerprint Reader',
      result: 'DENIED_EXPIRED',
      reason: 'Membership expired on 2026-10-04. Renewal required.',
      direction: 'IN',
      source: 'BIOMETRIC_READER',
      timestamp: new Date(now.getTime() - 120 * 60 * 1000).toISOString(),
    },
    {
      accessLogId: 'log-03',
      gymId: DEMO_GYM_ID,
      memberId: 'mem-016',
      memberName: 'Maya Lin',
      deviceId: 'bio-dev-01',
      deviceName: 'Main Turnstile Fingerprint Reader',
      result: 'DENIED_FROZEN',
      reason: 'Membership is frozen: Knee rehabilitation after surgery',
      direction: 'IN',
      source: 'BIOMETRIC_READER',
      timestamp: new Date(now.getTime() - 180 * 60 * 1000).toISOString(),
    },
  ];
  for (const log of initialLogs) {
    await setDoc(doc(db, 'accessLogs', log.accessLogId), log);
  }

  // 8. Notifications
  const initialNotifs: AppNotification[] = [
    {
      notificationId: 'notif-demo-1',
      gymId: DEMO_GYM_ID,
      recipientId: DEMO_GYM_ID,
      recipientRole: 'OWNER',
      channel: 'IN_APP',
      type: 'MEMBERSHIP_EXPIRING_SOON',
      title: 'Member Expiry Alert: Rahul Sharma',
      message: "Rahul Sharma's gym membership expires in 7 days on " + addDays(7) + '.',
      read: false,
      createdAt: now.toISOString(),
    },
    {
      notificationId: 'notif-demo-2',
      gymId: DEMO_GYM_ID,
      recipientId: 'mem-006',
      recipientRole: 'MEMBER',
      channel: 'IN_APP',
      type: 'MEMBERSHIP_EXPIRING_SOON',
      title: 'Membership Expiring (7 days left)',
      message: `Your GymGuard membership expires in 7 days on ${addDays(7)}. Please renew your membership to continue accessing the gym.`,
      read: false,
      createdAt: now.toISOString(),
    },
  ];
  for (const notif of initialNotifs) {
    await setDoc(doc(db, 'notifications', notif.notificationId), notif);
  }
}
