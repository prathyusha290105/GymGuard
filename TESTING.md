# GYMGUARD: Quality Assurance & Access Control Test Matrix

This document provides testing procedures and results for all 15 critical access control scenarios specified in the GymGuard engineering requirements.

---

## 1. Automated Test Suite Execution

Run the built-in validation script:

```bash
npm run test
```

This verifies:
- Date interval math
- Expiry status state machines
- Deduplication key consistency
- Biometric template token encryption & identification
- Relay controller state transitions

---

## 2. The 15 Critical Access Scenarios Matrix

| Scenario # | Test Description | Input / Trigger | Expected Outcome | Verified In App |
| :--- | :--- | :--- | :--- | :--- |
| **TEST 1** | Active Member Access | Alex Rivera (`mem-001`, Valid Annual VIP) scans finger | Result: `ACCESS_GRANTED`, Door: `UNLOCKED` (4s), Attendance recorded (`INSIDE`) | ✅ Hardware Test Center & Kiosk |
| **TEST 2** | Expired Member Access | Carlos Mendez (`mem-011`, Expired 2 days ago) scans finger | Result: `DENIED_EXPIRED`, Door: `LOCKED`, AccessLog recorded | ✅ Hardware Test Center & Kiosk |
| **TEST 3** | Frozen Member Access | Maya Lin (`mem-016`, Medical Freeze) scans finger | Result: `DENIED_FROZEN`, Door: `LOCKED`, Reason logged | ✅ Hardware Test Center & Kiosk |
| **TEST 4** | Suspended Member Access | Brandon Cole (`mem-018`, Suspended) scans finger | Result: `DENIED_SUSPENDED`, Door: `LOCKED`, Reason logged | ✅ Hardware Test Center & Kiosk |
| **TEST 5** | Unknown Fingerprint | Unregistered finger scanned | Result: `DENIED_UNKNOWN_MEMBER`, Door: `LOCKED`, Audit log created | ✅ Hardware Test Center & Kiosk |
| **TEST 6** | Membership Not Started | Jordan Hayes (`mem-020`, Starts next week) scans finger | Result: `DENIED_MEMBERSHIP_NOT_STARTED`, Door: `LOCKED` | ✅ Access Authorization Engine |
| **TEST 7** | Expiry Tomorrow (1 Day Left) | Lucas Bennett (`mem-010`, 1 day left) scans finger | Result: `ACCESS_GRANTED` with warning badge, Door: `UNLOCKED` | ✅ Access Authorization Engine |
| **TEST 8** | Expired Member Renews | Owner processes renewal for Carlos Mendez (`mem-011`) | Previous status updated from `EXPIRED` to `ACTIVE`, Carlos scans finger -> `ACCESS_GRANTED`, Door unlocks | ✅ Memberships Page Renewal Flow |
| **TEST 9** | Expiration State Automation | Reference date passes subscription end date | `membership.status` transitions from `ACTIVE`/`EXPIRING_SOON` to `EXPIRED` | ✅ Expiry Batch Job |
| **TEST 10** | 7-Day Expiry Notification | Membership approaches 7 days remaining | Exactly 1 notification generated for member & owner with expiration date | ✅ Notification Test Center |
| **TEST 11** | 6-Day Expiry Notification | Membership reaches 6 days remaining | Exactly 1 notification generated with dynamic "6 days remaining" copy | ✅ Notification Test Center |
| **TEST 12** | Repeated Job Idempotency | Daily expiry automation executed multiple times on same day | Notification suppressed by unique composite key (`membershipId_type_days_date`), 0 duplicates sent | ✅ Notification Test Center & Batch Job |
| **TEST 13** | Staff Permission Guard | User logged in as `STAFF` attempts access to Staff Management or Settings | Sensitive administrative panels hidden and blocked | ✅ Auth Role Guards & Sidebar |
| **TEST 14** | Member Data Isolation | Member Alex Rivera views portal | Only sees Alex's digital pass, personal payments, and attendance; cannot view other members | ✅ Member Portal View |
| **TEST 15** | Multi-Gym Tenant Isolation | Queries executed across gyms | Every Firestore collection and service call isolates records strictly by `gymId` | ✅ Firestore ABAC Security Rules |
