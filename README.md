# GYMGUARD: Smart Gym Management & Biometric Door Access Control

**GYMGUARD** is an enterprise-grade, multi-tenant gym facility management platform featuring centralized biometric fingerprint authorization, real-time magnetic door controller automation, idempotent membership expiration workflows, and multi-channel notification infrastructure.

---

## 1. System Architecture

```
                       [ Biometric Scanner / Kiosk ]
                                     | (Fingerprint Minutiae / Token)
                                     v
                       [ AccessAuthorizationService ]
                        (Central Backend Authority)
                                     |
    +--------------------------------+--------------------------------+
    |                                |                                |
[ Member & Status Check ]   [ Expiry & Date Verification ]   [ Device Integrity ]
    |                                |                                |
    +--------------------------------+--------------------------------+
                                     |
                      Is Membership Active & Valid?
                                     |
                    +----------------+----------------+
                    |                                 |
                 [ YES ]                            [ NO ]
                    |                                 |
       1. Door Relay Trip (4s)              1. Keep Door Locked
       2. Log ACCESS_GRANTED                2. Log Denial Reason
       3. Record Attendance (Inside)        3. Trigger Audit Alert
```

---

## 2. Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Motion
- **Database & Auth:** Google Cloud Firestore (Multi-tenant schema), Firebase Authentication
- **Hardware Abstraction Layer:** `BiometricService`, `AccessControllerService`, `MockBiometricDevice`, `MockDoorController`
- **Automation Engine:** Scheduled daily membership expiry job with idempotent hash keys (`membershipId_type_days_date`)
- **Reporting:** Real-time Firestore aggregation, CSV data exports

---

## 3. Demo Credentials

The platform ships pre-configured with 20 realistic gym member records (covering Active, Expiring, Expired, Frozen, and Suspended states) and 3 role presets with instant 1-click login:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Gym Owner** | `owner@gymguard.demo` | `GymGuard@123` | Full administrative control, settings, staff, reports, audit logs |
| **Staff Member** | `staff@gymguard.demo` | `GymGuard@123` | Member registration, attendance logs, renewals, front desk kiosk |
| **Member** | `member@gymguard.demo` | `GymGuard@123` | Personal digital pass, attendance history, renewal alerts, receipts |

---

## 4. Multi-Tenant Firestore Schema

Every document strictly enforces tenant boundaries using `gymId`:

- `/gyms/{gymId}`: Organization profile, operational timezones, metadata
- `/users/{userId}`: Auth accounts linking to RBAC (`SUPER_ADMIN`, `GYM_OWNER`, `STAFF`, `MEMBER`)
- `/members/{memberId}`: Member profiles, contact info, biometric tokens
- `/membershipPlans/{planId}`: Available packages (Monthly, Quarterly, Semi-Annual, Annual VIP)
- `/memberships/{membershipId}`: Current subscriptions, start/end dates, freeze records
- `/attendance/{attendanceId}`: Check-in, check-out, duration tracking
- `/accessLogs/{accessLogId}`: Audit trail of every scan attempt with exact pass/fail reasons
- `/devices/{deviceId}`: Hardware scanners and door relays
- `/notifications/{notificationId}`: In-app and queued alerts
- `/settings/{settingsId}`: Gym thresholds (expiry notification days, duplicate scan interval, grace period)
- `/auditLogs/{auditId}`: Administrative action logs

---

## 5. Expiry Automation & Deduplication

1. Daily job evaluates all active memberships.
2. Calculates remaining days relative to gym timezone.
3. If $0 \le \text{days} \le 7$: Status updates to `EXPIRING_SOON`.
4. Notifications are dispatched for 7, 6, 5, 4, 3, 2, 1 days remaining.
5. An idempotency key (`{membershipId}_EXPIRING_{days}DAYS_{date}`) guarantees duplicate notifications are suppressed even if the job runs multiple times per day.
6. Once $\text{today} > \text{endDate}$: Status automatically transitions to `EXPIRED`, door access is strictly revoked, and an expired notification is sent.

---

## 6. Development & Testing Instructions

Run the automated test suite:
```bash
npm run test
```

Run TypeScript compilation check:
```bash
npm run lint
```

Start the local server:
```bash
npm run dev
```
