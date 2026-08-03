// ============================================================
// requests.js
// কেন এই ফাইলটা আছে: Teacher removal-এর মতো "উচ্চ-ঝুঁকিপূর্ণ" কাজের জন্য
// majority voting সিস্টেম (স্পেক ৩.৪)। এখানে auto-assign নেই —
// majority হলেই শুধু গ্রুপ খালি হয়ে যায়, Head Admin ম্যানুয়ালি বসায়।
// ============================================================

// --- সব pending request দেখা (dashboard badge-এর জন্য, স্পেক ১৫.৪) ---
async function getPendingRequestsCount() {
  const snap = await db.collection('pending_requests').where('status', '==', 'pending').get();
  let count = snap.size;
  if (isHeadAdmin()) {
    const cleanupSnap = await db.collection('pending_requests')
      .where('type', '==', 'teacher_removal')
      .where('status', '==', 'approved')
      .where('roleCleared', '==', false)
      .get();
    count += cleanupSnap.size;
  }
  return count;
}

async function getPendingRequests() {
  const snap = await db.collection('pending_requests')
    .where('status', '==', 'pending')
    .orderBy('createdAt', 'desc')
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// --- Teacher removal প্রস্তাব করা (কোনো একজন Admin) ---
async function proposeTeacherRemoval(batchId, teacherUid, teacherName, reason) {
  if (!isAdmin()) throw new Error('শুধু Admin এই প্রস্তাব দিতে পারবে');

  const reqRef = await db.collection('pending_requests').add({
    type: 'teacher_removal',
    status: 'pending',
    payload: { batchId, teacherUid, teacherName, reason },
    requestedBy: currentUser.uid,
    approvals: [currentUser.uid], // প্রস্তাবকারী নিজে স্বয়ংক্রিয়ভাবে approve গণ্য হয়
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  await logActivity('teacher_removal_proposed', teacherUid, `${teacherName} (${batchId}): ${reason}`);
  return reqRef.id;
}

// --- বাকি Admin-রা vote দেয় ---
async function voteOnTeacherRemoval(requestId) {
  if (!isAdmin()) throw new Error('শুধু Admin ভোট দিতে পারবে');

  const reqRef = db.collection('pending_requests').doc(requestId);

  await db.runTransaction(async (transaction) => {
    const reqDoc = await transaction.get(reqRef);
    const req = reqDoc.data();

    if (req.status !== 'pending') return; // আগেই সিদ্ধান্ত হয়ে গেছে

    const approvals = req.approvals || [];
    if (approvals.includes(currentUser.uid)) return; // দুইবার ভোট আটকানো

    approvals.push(currentUser.uid);

    // মোট Admin সংখ্যা বের করা majority চেক করতে
    // (এই কাউন্ট প্রতিবার query করা হচ্ছে, transaction-এর বাইরে করলে ভালো হতো,
    // কিন্তু ছোট স্কেলে (কয়েকজন Admin) এটা যথেষ্ট গ্রহণযোগ্য cost)
    transaction.update(reqRef, { approvals });
  });

  // Transaction-এর পরে majority চেক করে finalize করা
  await checkAndFinalizeTeacherRemoval(requestId);
}

async function checkAndFinalizeTeacherRemoval(requestId) {
  const reqRef = db.collection('pending_requests').doc(requestId);
  const reqDoc = await reqRef.get();
  const req = reqDoc.data();
  if (req.status !== 'pending') return;

  const adminSnap = await db.collection('users')
    .where('role', 'in', ['admin', 'head_admin'])
    .get();
  const totalAdmins = adminSnap.size;
  const approvals = req.approvals || [];

  if (approvals.length > totalAdmins / 2) {
    // Majority হয়ে গেছে — batch-এর teacherUid খালি করা যেকোনো Admin-এর ভোটের
    // মধ্য দিয়েই সম্ভব (rules-এ isAdmin() অনুমতি আছে)
    await db.collection('batches').doc(req.payload.batchId).update({ teacherUid: null });

    // request status 'approved' করা — এটা majority ভোটের অংশ হিসেবেই rules অনুমতি দেয়
    // roleCleared: false রাখা হচ্ছে যাতে Head Admin dashboard-এ এই cleanup-pending
    // request খুঁজে পায় (getTeacherRemovalsPendingCleanup)
    await reqRef.update({
      status: 'approved',
      roleCleared: false,
      finalizedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await logActivity('teacher_removed', req.payload.teacherUid,
      `${req.payload.teacherName} removed from ${req.payload.batchId} by majority vote (${approvals.length}/${totalAdmins}) — Head Admin needs to clear the teacher's user role`);

    // টিচারের user doc-এ role/assignedBatch null করা শুধু Head Admin করতে পারবে
    // (rules অনুযায়ী users update head_admin-only) — তাই এটা আলাদা ধাপ,
    // Head Admin app-এ "Pending: user role cleanup" হিসেবে দেখবে এবং সম্পন্ন করবে।
  }
}

// --- Head Admin dashboard: majority vote-এ approved হওয়া কিন্তু user-role cleanup বাকি থাকা request গুলো ---
async function getTeacherRemovalsPendingCleanup() {
  if (!isHeadAdmin()) return [];
  const snap = await db.collection('pending_requests')
    .where('type', '==', 'teacher_removal')
    .where('status', '==', 'approved')
    .where('roleCleared', '==', false)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// --- Head Admin ধাপ: majority vote-এ সরানো টিচারের user role/assignedBatch খালি করা ---
async function clearRemovedTeacherRole(requestId, teacherUid) {
  if (!isHeadAdmin()) throw new Error('শুধু Head Admin এই কাজ সম্পন্ন করতে পারবে');
  await db.collection('users').doc(teacherUid).update({ role: null, assignedBatch: null });
  await db.collection('pending_requests').doc(requestId).update({ roleCleared: true });
  await logActivity('teacher_role_cleared', teacherUid, `User role/assignedBatch cleared after majority-vote removal`);
}

// --- Head Admin ম্যানুয়ালি একজন Admin-কে খালি ব্যাচে সাময়িক বসানো ---
async function assignTemporaryTeacher(batchId, adminUid) {
  if (!isHeadAdmin()) throw new Error('শুধু Head Admin এই কাজ করতে পারবে');
  await db.collection('batches').doc(batchId).update({ teacherUid: adminUid, temporaryAssignment: true });
  await logActivity('temporary_teacher_assigned', batchId, `Admin ${adminUid} assigned temporarily`);
}
