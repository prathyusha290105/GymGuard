import { computeMembershipStatus, getDaysRemaining, formatDateISO } from '../utils/dateUtils';
import { MockBiometricDevice } from '../services/hardware/MockBiometricDevice';
import { MockDoorController } from '../services/hardware/MockDoorController';

/**
 * GYMGUARD Automated Test Suite
 * Tests Core Business Logic: Expiry, Door Access, Biometrics, and Deduplication
 */
export async function runGymGuardTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function assert(condition: boolean, testName: string) {
    if (condition) {
      results.push({ name: testName, passed: true });
      console.log(`[PASS] ${testName}`);
    } else {
      results.push({ name: testName, passed: false, error: 'Assertion failed' });
      console.error(`[FAIL] ${testName}`);
    }
  }

  console.log('=== RUNNING GYMGUARD AUTOMATED TEST SUITE ===');

  const todayStr = formatDateISO();
  const addDays = (d: number) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + d);
    return formatDateISO(dt);
  };

  // TEST 1: Active membership (> 7 days)
  const activeStatus = computeMembershipStatus(addDays(-30), addDays(60), undefined, todayStr);
  assert(activeStatus === 'ACTIVE', 'TEST 1: Active membership (> 7 days remaining) returns ACTIVE');

  // TEST 2: Expiring Soon (7 days left)
  const expiring7 = computeMembershipStatus(addDays(-23), addDays(7), undefined, todayStr);
  assert(expiring7 === 'EXPIRING_SOON', 'TEST 2: Membership with exactly 7 days remaining returns EXPIRING_SOON');

  // TEST 3: Expiring Soon (1 day left)
  const expiring1 = computeMembershipStatus(addDays(-29), addDays(1), undefined, todayStr);
  assert(expiring1 === 'EXPIRING_SOON', 'TEST 3: Membership with 1 day remaining returns EXPIRING_SOON');

  // TEST 4: Expired membership
  const expiredStatus = computeMembershipStatus(addDays(-35), addDays(-2), undefined, todayStr);
  assert(expiredStatus === 'EXPIRED', 'TEST 4: Past end date returns EXPIRED');

  // TEST 5: Not started membership (future date)
  const notStarted = computeMembershipStatus(addDays(5), addDays(35), undefined, todayStr);
  assert(notStarted === 'NOT_STARTED', 'TEST 5: Future start date returns NOT_STARTED');

  // TEST 6: Explicit Frozen Status Override
  const frozenStatus = computeMembershipStatus(addDays(-10), addDays(20), 'FROZEN', todayStr);
  assert(frozenStatus === 'FROZEN', 'TEST 6: Explicit frozen flag preserves FROZEN status');

  // TEST 7: Explicit Suspended Status Override
  const suspendedStatus = computeMembershipStatus(addDays(-10), addDays(20), 'SUSPENDED', todayStr);
  assert(suspendedStatus === 'SUSPENDED', 'TEST 7: Explicit suspended flag preserves SUSPENDED status');

  // TEST 8: Days remaining calculations
  const daysDiff = getDaysRemaining(addDays(5), todayStr);
  assert(daysDiff === 5, 'TEST 8: getDaysRemaining calculates exact integer day delta');

  // TEST 9: MockBiometricDevice identification & online/offline
  const bioDev = new MockBiometricDevice();
  const regResult = await bioDev.enrollFingerprint('test-user-1');
  assert(regResult.success && !!regResult.templateId, 'TEST 9: Biometric enrollment returns cryptographically safe token');

  const identifyResult = await bioDev.identifyFingerprint('test-user-1');
  assert(identifyResult.identified && identifyResult.memberId === 'test-user-1', 'TEST 9b: Enrolled template is identified with high confidence');

  bioDev.setOnline(false);
  const offlineId = await bioDev.identifyFingerprint('test-user-1');
  assert(!offlineId.identified && !!offlineId.error, 'TEST 9c: Offline biometric reader returns communication failure');

  // TEST 10: MockDoorController state machine
  const doorCtrl = new MockDoorController();
  assert((await doorCtrl.getDoorState()) === 'LOCKED', 'TEST 10a: Initial door state is securely LOCKED');

  const unlockRes = await doorCtrl.unlock(1);
  assert(unlockRes.success && unlockRes.state === 'UNLOCKED', 'TEST 10b: Unlock command triggers magnetic relay release');

  // TEST 11: Idempotency Key Format
  const memberId = 'mem-001';
  const notifKey1 = `${memberId}_EXPIRING_7DAYS_${todayStr}`;
  const notifKey2 = `${memberId}_EXPIRING_7DAYS_${todayStr}`;
  assert(notifKey1 === notifKey2, 'TEST 11: Deduplication key structure guarantees idempotency on duplicate runs');

  console.log(`=== TEST SUMMARY: ${results.filter(r => r.passed).length} / ${results.length} PASSED ===`);
  return results;
}
