import { db } from '../config/firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { memberService } from '../services/member/memberService';
import { membershipService } from '../services/membership/membershipService';
import { attendanceService } from '../services/attendance/attendanceService';
import { notificationService } from '../services/notifications/notificationService';
import { seedDemoData } from '../services/seed/seedData';
import { Payment } from '../types';

async function runLiveAudit() {
  console.log('=== GYMGUARD FIREBASE INTEGRATION & PERSISTENCE VERIFICATION ===');
  console.log('Firebase project ID:', db.app.options.projectId);

  const gymId = 'gym-01';

  // 1. Gym / Config verification
  console.log('\n[1] Verifying Gym Document...');
  const gymDoc = await getDoc(doc(db, 'gyms', gymId));
  if (gymDoc.exists()) {
    console.log('✔ Gym document found:', gymDoc.data().name);
  } else {
    console.log('⚠ Gym document does not exist yet');
  }

  // 2. Member CRUD verification
  console.log('\n[2] Testing Member Creation & Edits on Firestore...');
  
  // CREATE
  const createdMember = await memberService.createMember({
    gymId: gymId,
    fullName: 'Audit Live Test Member',
    email: `audit_${Date.now()}@example.com`,
    phone: '+15550009999',
    status: 'ACTIVE',
    emergencyContactName: 'Audit Contact',
    emergencyContactPhone: '+15550008888',
    joiningDate: new Date().toISOString().split('T')[0]
  });
  console.log('✔ Member Created in Firestore:', createdMember.memberId);

  // READ BACK
  const fetchedMember = await memberService.getMemberById(createdMember.memberId);
  if (!fetchedMember) throw new Error('Failed to read back created member from Firestore');
  console.log('✔ Member Read Back from Firestore:', fetchedMember.fullName, '| Status:', fetchedMember.status);

  // UPDATE
  await memberService.updateMember(createdMember.memberId, {
    notes: 'Verified persistence by live audit script'
  });
  const updatedMember = await memberService.getMemberById(createdMember.memberId);
  if (updatedMember?.notes !== 'Verified persistence by live audit script') {
    throw new Error('Failed to read back updated notes from Firestore');
  }
  console.log('✔ Member Update Read Back Verified:', updatedMember.notes);

  // 3. Membership Creation & Renewal Verification
  console.log('\n[3] Testing Membership Creation & Renewal on Firestore...');
  const testPlan = {
    planId: 'plan-monthly',
    gymId: gymId,
    name: 'Monthly Standard',
    description: '30 days standard',
    durationDays: 30,
    price: 60,
    active: true,
    createdAt: new Date().toISOString(),
  };

  const renewedMshp = await membershipService.renewMembership({
    gymId: gymId,
    memberId: createdMember.memberId,
    memberName: createdMember.fullName,
    plan: testPlan,
    startDate: new Date().toISOString().split('T')[0],
    amountPaid: 60,
    paymentMethod: 'CARD',
    renewedBy: 'Audit Script',
  });
  console.log('✔ Membership Created/Renewed:', renewedMshp.membershipId, '| End Date:', renewedMshp.endDate);

  // READ BACK Membership
  const fetchedMshp = await membershipService.getMembershipById(renewedMshp.membershipId);
  if (!fetchedMshp) throw new Error('Failed to read back membership from Firestore');
  console.log('✔ Membership Read Back Verified:', fetchedMshp.membershipId, '| Status:', fetchedMshp.status);

  // 4. Payment Persistence Verification
  console.log('\n[4] Testing Payment Record Persistence on Firestore...');
  const paymentId = `pay_audit_${Date.now()}`;
  const paymentRecord: Payment = {
    paymentId,
    gymId,
    memberId: createdMember.memberId,
    memberName: createdMember.fullName,
    membershipId: renewedMshp.membershipId,
    amount: 60,
    paymentMethod: 'CARD',
    transactionId: `TXN_AUDIT_${Date.now()}`,
    paymentDate: new Date().toISOString().split('T')[0],
    status: 'PAID',
    notes: 'Audit live test payment',
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'payments', paymentId), paymentRecord);

  // READ BACK Payment
  const payDoc = await getDoc(doc(db, 'payments', paymentId));
  if (!payDoc.exists()) throw new Error('Failed to read back payment from Firestore');
  console.log('✔ Payment Read Back Verified:', payDoc.data().transactionId, '| Amount: $' + payDoc.data().amount);

  // 5. Attendance Logging & Checkout Verification
  console.log('\n[5] Testing Attendance Logging on Firestore...');
  const attendanceLog = await attendanceService.recordCheckIn({
    gymId: gymId,
    memberId: createdMember.memberId,
    memberName: createdMember.fullName,
    entryMethod: 'QR'
  });
  console.log('✔ Check-in Logged in Firestore:', attendanceLog.attendanceId);

  // Check out
  const checkOutLog = await attendanceService.recordCheckOut(attendanceLog);
  const attDoc = await getDoc(doc(db, 'attendance', attendanceLog.attendanceId));
  if (!attDoc.exists() || attDoc.data().status !== 'COMPLETED') {
    throw new Error('Failed to verify attendance check-out persistence in Firestore');
  }
  console.log('✔ Check-out Read Back Verified:', attDoc.data().status, '| Duration:', attDoc.data().durationMinutes, 'min');

  // 6. Notifications & Deduplication Verification
  console.log('\n[6] Testing Notifications & Deduplication on Firestore...');
  const dedupKey = `test_notif_${Date.now()}`;
  const notifResult1 = await notificationService.sendNotification({
    gymId: gymId,
    recipientId: createdMember.memberId,
    recipientRole: 'MEMBER',
    title: 'Audit Test Notification 1',
    message: 'First delivery attempt',
    type: 'MEMBERSHIP_EXPIRY',
    notificationKey: dedupKey,
  });
  console.log('✔ Notification 1 Processed:', notifResult1.notification?.notificationId, '| Sent:', notifResult1.sent);

  const notifResult2 = await notificationService.sendNotification({
    gymId: gymId,
    recipientId: createdMember.memberId,
    recipientRole: 'MEMBER',
    title: 'Audit Test Notification 2',
    message: 'Duplicate delivery attempt',
    type: 'MEMBERSHIP_EXPIRY',
    notificationKey: dedupKey,
  });
  if (!notifResult2.isDuplicate || notifResult2.sent) {
    throw new Error('Deduplication failed: Duplicate notification key was not rejected');
  }
  console.log('✔ Deduplication Verified: Duplicate key blocked (isDuplicate: true, sent: false)');

  // 7. Demo Data Protection Check (Demo seed must never overwrite real data)
  console.log('\n[7] Verifying Demo Data Overwrite Protection...');
  await seedDemoData();
  const checkMemberPreserved = await memberService.getMemberById(createdMember.memberId);
  if (checkMemberPreserved?.notes !== 'Verified persistence by live audit script') {
    throw new Error('Demo seed damaged client record');
  }
  console.log('✔ Demo Data Protection Verified: Client records intact after seed execution');

  // 8. Cleanup test records
  console.log('\n[8] Cleaning up temporary test records...');
  await membershipService.deleteMembership(renewedMshp.membershipId);
  await deleteDoc(doc(db, 'payments', paymentId));
  await deleteDoc(doc(db, 'attendance', attendanceLog.attendanceId));
  if (notifResult1.notification) {
    await deleteDoc(doc(db, 'notifications', notifResult1.notification.notificationId));
  }
  await memberService.deleteMember(createdMember.memberId);
  console.log('✔ Temporary test records safely deleted');

  console.log('\n=== AUDIT & PERSISTENCE VERIFICATION COMPLETE: ALL CHECKS PASSED ===\n');
}

runLiveAudit().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
