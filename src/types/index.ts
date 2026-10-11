export type UserRole = 'SUPER_ADMIN' | 'GYM_OWNER' | 'STAFF' | 'MEMBER';

export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'BLACKLISTED';

export type BiometricStatus = 'NOT_ENROLLED' | 'ENROLLED' | 'DISABLED';

export type MembershipStatus =
  | 'NOT_STARTED'
  | 'ACTIVE'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'FROZEN'
  | 'SUSPENDED'
  | 'CANCELLED';

export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'OTHER';

export type PaymentStatus = 'PAID' | 'PENDING' | 'FAILED' | 'REFUNDED';

export type AttendanceEntryMethod = 'FINGERPRINT' | 'ADMIN' | 'MANUAL' | 'QR';

export type AttendanceStatus = 'INSIDE' | 'COMPLETED';

export type AccessResult =
  | 'ACCESS_GRANTED'
  | 'DENIED_UNKNOWN_MEMBER'
  | 'DENIED_MEMBERSHIP_NOT_STARTED'
  | 'DENIED_EXPIRED'
  | 'DENIED_FROZEN'
  | 'DENIED_SUSPENDED'
  | 'DENIED_CANCELLED'
  | 'DENIED_INACTIVE_MEMBER'
  | 'DENIED_DEVICE_NOT_AUTHORIZED'
  | 'DEVICE_ERROR';

export type DeviceType = 'BIOMETRIC' | 'DOOR_CONTROLLER';

export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'ERROR' | 'DISABLED';

export type DoorState = 'LOCKED' | 'UNLOCKING' | 'UNLOCKED' | 'OFFLINE' | 'ERROR';

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP';

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  gymId: string;
  memberId?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Gym {
  gymId: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  timezone: string;
  logoUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Member {
  memberId: string;
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
  joiningDate: string;
  status: MemberStatus;
  biometricStatus: BiometricStatus;
  biometricTemplateId?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MembershipPlan {
  planId: string;
  gymId: string;
  name: string;
  description: string;
  durationDays: number;
  price: number;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Membership {
  membershipId: string;
  memberId: string;
  gymId: string;
  planId: string;
  planName: string;
  startDate: string; // ISO date string YYYY-MM-DD
  endDate: string; // ISO date string YYYY-MM-DD
  amount: number;
  paymentStatus: 'PAID' | 'PENDING' | 'PARTIAL';
  status: MembershipStatus;
  freezeStart?: string;
  freezeEnd?: string;
  freezeReason?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MembershipHistory {
  historyId: string;
  membershipId: string;
  memberId: string;
  gymId: string;
  planId: string;
  planName: string;
  startDate: string;
  endDate: string;
  amount: number;
  renewedAt: string;
  renewedBy?: string;
}

export interface Payment {
  paymentId: string;
  gymId: string;
  memberId: string;
  memberName?: string;
  membershipId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionId?: string;
  paymentDate: string;
  status: PaymentStatus;
  notes?: string;
  createdAt: string;
}

export interface AttendanceRecord {
  attendanceId: string;
  gymId: string;
  memberId: string;
  memberName?: string;
  deviceId?: string;
  checkInTime: string; // ISO timestamp
  checkOutTime?: string; // ISO timestamp
  durationMinutes?: number;
  entryMethod: AttendanceEntryMethod;
  status: AttendanceStatus;
  createdAt: string;
}

export interface AccessLog {
  accessLogId: string;
  gymId: string;
  memberId?: string;
  memberName?: string;
  deviceId?: string;
  deviceName?: string;
  result: AccessResult;
  reason: string;
  direction: 'IN' | 'OUT';
  source: string;
  timestamp: string; // ISO string
}

export interface Device {
  deviceId: string;
  gymId: string;
  name: string;
  type: DeviceType;
  location: string;
  ipAddress: string;
  status: DeviceStatus;
  lastSeen: string;
  firmware: string;
}

export interface AppNotification {
  notificationId: string;
  gymId: string;
  recipientId: string;
  recipientRole: 'OWNER' | 'STAFF' | 'MEMBER';
  channel: NotificationChannel;
  type: string;
  title: string;
  message: string;
  read: boolean;
  notificationKey?: string;
  createdAt: string;
}

export interface AuditLog {
  auditId: string;
  gymId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  resource: string;
  resourceId?: string;
  timestamp: string;
  details?: string;
}

export interface GymSettings {
  settingsId: string;
  gymId: string;
  expiryNoticeDays: number;
  duplicateScanIntervalSeconds: number;
  gracePeriodDays: number;
  timezone: string;
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  whatsappNotificationsEnabled: boolean;
  doorUnlockDurationSeconds: number;
  updatedAt?: string;
}

export interface AccessDecision {
  allowed: boolean;
  result: AccessResult;
  reason: string;
  member?: Member;
  membership?: Membership;
  daysRemaining?: number;
  doorAction: 'UNLOCK' | 'STAY_LOCKED';
  attendanceRecorded: boolean;
}
