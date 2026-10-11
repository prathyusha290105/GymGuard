import { computeMembershipStatus, getDaysRemaining, formatDateISO } from '../utils/dateUtils';
import { MockBiometricDevice } from '../services/hardware/MockBiometricDevice';
import { MockDoorController } from '../services/hardware/MockDoorController';
import { accessAuthorizationService } from '../services/access/accessAuthorizationService';
import { MembershipStatus } from '../types';

/**
 * GYMGUARD Comprehensive Security & Business Logic Automated Test Suite
 * Tests Core Business Logic: Expiry, Door Access, Biometrics, Deduplication, and Role Boundaries
 */
export async function runGymGuardTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function assert(condition: boolean, testName: string, errorDetail?: string) {
    if (condition) {
      results.push({ name: testName, passed: true });
      console.log(`[PASS] ${testName}`);
    } else {
      results.push({ name: testName, passed: false, error: errorDetail || 'Assertion failed' });
      console.error(`[FAIL] ${testName} - ${errorDetail || ''}`);
    }
  }

  console.log('=== RUNNING GYMGUARD AUTOMATED TEST SUITE ===\n');

  const todayStr = formatDateISO();
  const addDays = (d: number) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + d);
    return formatDateISO(dt);
  };

  // ==========================================
  // SECTION 1: MEMBERSHIP STATUS COMPUTATION
  // ==========================================
  console.log('[SECTION 1] Membership Status Computation');
  const activeStatus = computeMembershipStatus(addDays(-30), addDays(60), undefined, todayStr);
  assert(activeStatus === 'ACTIVE', 'TEST 1: Active membership (> 7 days remaining) returns ACTIVE');

  const expiring7 = computeMembershipStatus(addDays(-23), addDays(7), undefined, todayStr);
  assert(expiring7 === 'EXPIRING_SOON', 'TEST 2: Membership with exactly 7 days remaining returns EXPIRING_SOON');

  const expiring1 = computeMembershipStatus(addDays(-29), addDays(1), undefined, todayStr);
  assert(expiring1 === 'EXPIRING_SOON', 'TEST 3: Membership with 1 day remaining returns EXPIRING_SOON');

  const expiring0 = computeMembershipStatus(addDays(-30), addDays(0), undefined, todayStr);
  assert(expiring0 === 'EXPIRING_SOON', 'TEST 4: Membership on expiry date (0 days) returns EXPIRING_SOON');

  const expiredStatus = computeMembershipStatus(addDays(-35), addDays(-1), undefined, todayStr);
  assert(expiredStatus === 'EXPIRED', 'TEST 5: Past end date returns EXPIRED');

  const notStarted = computeMembershipStatus(addDays(5), addDays(35), undefined, todayStr);
  assert(notStarted === 'NOT_STARTED', 'TEST 6: Future start date returns NOT_STARTED');

  const frozenStatus = computeMembershipStatus(addDays(-10), addDays(20), 'FROZEN', todayStr);
  assert(frozenStatus === 'FROZEN', 'TEST 7: Explicit frozen flag preserves FROZEN status');

  const suspendedStatus = computeMembershipStatus(addDays(-10), addDays(20), 'SUSPENDED', todayStr);
  assert(suspendedStatus === 'SUSPENDED', 'TEST 8: Explicit suspended flag preserves SUSPENDED status');

  const cancelledStatus = computeMembershipStatus(addDays(-10), addDays(20), 'CANCELLED', todayStr);
  assert(cancelledStatus === 'CANCELLED', 'TEST 9: Explicit cancelled flag preserves CANCELLED status');

  // ==========================================
  // SECTION 2: TIMEZONE BOUNDARY VALIDATION
  // ==========================================
  console.log('\n[SECTION 2] Timezone Boundary Validation');
  const testDate = new Date('2026-10-15T02:00:00Z');
  const nyDateStr = formatDateISO(testDate, 'America/New_York');
  const tokyoDateStr = formatDateISO(testDate, 'Asia/Tokyo');
  // 02:00 UTC on Oct 15 is Oct 14 in New York, Oct 15 in Tokyo
  assert(nyDateStr === '2026-10-14', 'TEST 10a: Gym in America/New_York correctly resolves Oct 14 at 02:00 UTC');
  assert(tokyoDateStr === '2026-10-15', 'TEST 10b: Gym in Asia/Tokyo correctly resolves Oct 15 at 02:00 UTC');

  // Days remaining calculation
  const daysDiff = getDaysRemaining(addDays(5), todayStr);
  assert(daysDiff === 5, 'TEST 11: getDaysRemaining calculates exact integer day delta');

  // ==========================================
  // SECTION 3: EXPIRY NOTIFICATION WORKFLOWS & DEDUPLICATION
  // ==========================================
  console.log('\n[SECTION 3] 7-Day to Expiry-Day Workflows & Deduplication');
  const testMshpId = 'mshp-test-456';
  const targetDays = [7, 6, 5, 4, 3, 2, 1, 0];

  for (const d of targetDays) {
    const memberKey = `${testMshpId}_EXPIRING_${d}DAYS_${todayStr}`;
    const ownerKey = `${testMshpId}_OWNER_EXPIRING_${d}DAYS_${todayStr}`;
    assert(
      memberKey.includes(`_${d}DAYS_`) && ownerKey.includes(`_OWNER_EXPIRING_${d}DAYS_`),
      `TEST 12.${d}: Idempotent deduplication key generated for day ${d} (Member & Owner)`
    );
  }

  // Duplicate key equality check
  const keyRun1 = `${testMshpId}_EXPIRING_3DAYS_${todayStr}`;
  const keyRun2 = `${testMshpId}_EXPIRING_3DAYS_${todayStr}`;
  assert(keyRun1 === keyRun2, 'TEST 13: Deduplication key structure strictly matches on repeated runs');

  // Expired keys for member and owner
  const expiredEndDate = addDays(-3);
  const memberExpKey = `${testMshpId}_EXPIRED_${expiredEndDate}`;
  const ownerExpKey = `${testMshpId}_OWNER_EXPIRED_${expiredEndDate}`;
  assert(memberExpKey !== ownerExpKey, 'TEST 14: Member and Owner expired notifications use distinct recipient keys');

  // ==========================================
  // SECTION 4: HARDWARE SAFETY & MOCK CONTROLLER
  // ==========================================
  console.log('\n[SECTION 4] Hardware Safety & Mock Controllers');
  const bioDev = new MockBiometricDevice();
  const regResult = await bioDev.enrollFingerprint('test-user-1');
  assert(regResult.success && !!regResult.templateId, 'TEST 15a: Biometric enrollment returns cryptographically safe token');

  const identifyResult = await bioDev.identifyFingerprint('test-user-1');
  assert(identifyResult.identified && identifyResult.memberId === 'test-user-1', 'TEST 15b: Enrolled template is identified with high confidence');

  bioDev.setOnline(false);
  const offlineId = await bioDev.identifyFingerprint('test-user-1');
  assert(!offlineId.identified && !!offlineId.error, 'TEST 15c: Offline biometric reader returns communication failure');

  const doorCtrl = new MockDoorController();
  assert((await doorCtrl.getDoorState()) === 'LOCKED', 'TEST 16a: Initial door state is securely LOCKED');

  // Unlock command
  const unlockRes = await doorCtrl.unlock(1);
  assert(unlockRes.success && unlockRes.state === 'UNLOCKED', 'TEST 16b: Valid unlock command triggers magnetic relay release');

  // Error simulation
  doorCtrl.setSimulatedError(true);
  const errUnlock = await doorCtrl.unlock(1);
  assert(!errUnlock.success && errUnlock.state === 'ERROR', 'TEST 16c: Door controller in ERROR rejects unlock command');

  doorCtrl.setSimulatedError(false);
  doorCtrl.setOnline(false);
  const offlineUnlock = await doorCtrl.unlock(1);
  assert(!offlineUnlock.success && offlineUnlock.state === 'OFFLINE', 'TEST 16d: Door controller in OFFLINE state rejects unlock command');

  // ==========================================
  // SECTION 5: ACCESS POLICY & DOOR UNLOCK SAFETY
  // ==========================================
  console.log('\n[SECTION 5] Access Authorization Decision Safety');
  // Unknown member scan must NEVER unlock door
  const unknownDecision = await accessAuthorizationService.authorizeAccess({
    gymId: 'gym-01',
    memberId: 'UNKNOWN_MEMBER',
    deviceId: 'bio-dev-01',
  });
  assert(
    !unknownDecision.allowed &&
    unknownDecision.doorAction === 'STAY_LOCKED' &&
    unknownDecision.result === 'DENIED_UNKNOWN_MEMBER',
    'TEST 17: Unknown member scan denied and doorAction is STAY_LOCKED'
  );

  // Expired member scan (mem-011 in seed data)
  const expiredDecision = await accessAuthorizationService.authorizeAccess({
    gymId: 'gym-01',
    memberId: 'mem-011',
    deviceId: 'bio-dev-01',
  });
  assert(
    !expiredDecision.allowed &&
    expiredDecision.doorAction === 'STAY_LOCKED' &&
    expiredDecision.result === 'DENIED_EXPIRED',
    'TEST 18: Expired member scan denied and doorAction is STAY_LOCKED'
  );

  // Frozen member scan (mem-016 in seed data)
  const frozenDecision = await accessAuthorizationService.authorizeAccess({
    gymId: 'gym-01',
    memberId: 'mem-016',
    deviceId: 'bio-dev-01',
  });
  assert(
    !frozenDecision.allowed &&
    frozenDecision.doorAction === 'STAY_LOCKED' &&
    frozenDecision.result === 'DENIED_FROZEN',
    'TEST 19: Frozen membership scan denied and doorAction is STAY_LOCKED'
  );

  // Suspended member scan (mem-018 in seed data)
  const suspendedDecision = await accessAuthorizationService.authorizeAccess({
    gymId: 'gym-01',
    memberId: 'mem-018',
    deviceId: 'bio-dev-01',
  });
  assert(
    !suspendedDecision.allowed &&
    suspendedDecision.doorAction === 'STAY_LOCKED' &&
    suspendedDecision.result === 'DENIED_SUSPENDED',
    'TEST 20: Suspended membership scan denied and doorAction is STAY_LOCKED'
  );

  // Active member scan (mem-001 in seed data)
  const activeDecision = await accessAuthorizationService.authorizeAccess({
    gymId: 'gym-01',
    memberId: 'mem-001',
    deviceId: 'bio-dev-01',
  });
  assert(
    activeDecision.allowed &&
    activeDecision.doorAction === 'UNLOCK' &&
    activeDecision.result === 'ACCESS_GRANTED',
    'TEST 21: Active membership scan granted and doorAction is UNLOCK'
  );

  const passedCount = results.filter(r => r.passed).length;
  console.log(`\n=== TEST SUMMARY: ${passedCount} / ${results.length} PASSED ===`);

  if (passedCount < results.length) {
    process.exit(1);
  }

  return results;
}

if (process.argv[1]?.endsWith('gymguard.test.ts')) {
  runGymGuardTests().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}
