// ============================================================
// batches.js
// কেন এই ফাইলটা আছে: ব্যাচ/গ্রুপ ম্যানেজমেন্ট (M-1, E-1 ইত্যাদি),
// Admin permission টগল (স্পেক ৩.৩), আর ব্যাচ ট্রান্সফার (স্পেক ৭)।
// ============================================================

// সব ব্যাচের লিস্ট
async function getAllBatches() {
  const snap = await db.collection('batches').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// একটা নতুন ব্যাচ তৈরি (Head Admin, ভবিষ্যতে সেকশন বাড়ানোর জন্য, স্পেক ৭.১)
async function createBatch(batchId, name, timing) {
  if (!isHeadAdmin()) throw new Error('শুধু Head Admin নতুন ব্যাচ তৈরি করতে পারবে');
  await db.collection('batches').doc(batchId).set({
    name: name,
    timing: timing, // "Morning" | "Evening"
    teacherUid: null,
    allowed_editors: [],
    monthlyFeeHistory: []
  });
}

// --- Admin এডিট-পারমিশন টগল (স্পেক ৩.৩ + ১৫.১ denormalization সমাধান) ---
// Teacher নিজে তার ব্যাচের জন্য একজন Admin-কে temporary edit access দেয়
async function toggleAdminEditAccess(batchId, adminUid, enable) {
  if (!isTeacher() || currentUser.assignedBatch !== batchId) {
    throw new Error('শুধু ঐ ব্যাচের Teacher এই পারমিশন দিতে/সরাতে পারবে');
  }
  const batchRef = db.collection('batches').doc(batchId);
  if (enable) {
    await batchRef.update({
      allowed_editors: firebase.firestore.FieldValue.arrayUnion(adminUid)
    });
  } else {
    await batchRef.update({
      allowed_editors: firebase.firestore.FieldValue.arrayRemove(adminUid)
    });
  }
  await logActivity('admin_edit_toggle', batchId, `Admin ${adminUid} access ${enable ? 'ON' : 'OFF'}`);
}

// --- ব্যাচ ট্রান্সফার প্রক্রিয়া (স্পেক ৭.২ + ১৫.৪ — app-ভিত্তিক, wa.me শুধু reminder) ---

// ধাপ ১: বর্তমান Teacher একটা transfer request তৈরি করে
async function requestBatchTransfer(studentId, fromBatch, toBatch, targetTeacherPhone) {
  if (!isTeacher() || currentUser.assignedBatch !== fromBatch) {
    throw new Error('শুধু ছাত্রের বর্তমান Teacher-ই transfer request পাঠাতে পারবে');
  }
  const studentDoc = await db.collection('students').doc(studentId).get();
  const student = studentDoc.data();

  const reqRef = await db.collection('pending_requests').add({
    type: 'batch_transfer',
    status: 'pending',
    payload: {
      studentId,
      studentName: student.name,
      hasCode: student.hasCode,
      fromBatch,
      toBatch
    },
    requestedBy: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  const message = `HTI Academy: ${student.name} (${student.hasCode}) কে ${fromBatch} থেকে ${toBatch}-এ transfer করার জন্য request পাঠানো হয়েছে। App-এ গিয়ে Accept/Reject করুন।`;
  return { requestId: reqRef.id, waLink: waLink(targetTeacherPhone, message) };
}

// ধাপ ২: টার্গেট Teacher Accept/Reject করে
async function respondToTransfer(requestId, accept, requesterPhone) {
  const reqRef = db.collection('pending_requests').doc(requestId);
  const reqDoc = await reqRef.get();
  const req = reqDoc.data();

  if (!isTeacher() || currentUser.assignedBatch !== req.payload.toBatch) {
    throw new Error('শুধু টার্গেট ব্যাচের Teacher-ই এটা Accept/Reject করতে পারবে');
  }

  await reqRef.update({
    status: accept ? 'approved' : 'rejected',
    respondedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  if (accept) {
    // স্থানান্তর কার্যকর হবে পরের দিন থেকে (স্পেক ৭.২.৬)
    // তাই এখানে effectiveDate হিসেবে আগামীকাল সেভ করা হচ্ছে,
    // আর একটা scheduled flag রাখা হচ্ছে যেটা daily check দিয়ে apply হবে
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    await db.collection('scheduled_transfers').add({
      studentId: req.payload.studentId,
      fromBatch: req.payload.fromBatch,
      toBatch: req.payload.toBatch,
      effectiveDate: tomorrowStr,
      applied: false
    });
  }

  await logActivity('batch_transfer_response', req.payload.studentId,
    `${accept ? 'Approved' : 'Rejected'}: ${req.payload.fromBatch} → ${req.payload.toBatch}`);

  const message = accept
    ? `HTI Academy: ${req.payload.studentName} (${req.payload.hasCode}) এর transfer request গ্রহণ করা হয়েছে। পরের দিন থেকে কার্যকর হবে।`
    : `HTI Academy: ${req.payload.studentName} (${req.payload.hasCode}) এর transfer request প্রত্যাখ্যান করা হয়েছে।`;
  return { waLink: waLink(requesterPhone, message) };
}

// এই ফাংশনটা app চালু হওয়ার সময় চেক করবে — আজকের তারিখ পার হওয়া
// কোনো scheduled transfer থাকলে সেটা এখন apply করে দেবে (batch history আপডেট সহ)
async function applyDueScheduledTransfers() {
  const today = todayStr();
  const snap = await db.collection('scheduled_transfers')
    .where('applied', '==', false)
    .where('effectiveDate', '<=', today)
    .get();

  for (const doc of snap.docs) {
    const transfer = doc.data();
    const studentRef = db.collection('students').doc(transfer.studentId);
    const studentDoc = await studentRef.get();
    const student = studentDoc.data();

    // পুরনো batchHistory entry বন্ধ করা (to তারিখ বসানো), নতুন entry শুরু করা
    const history = student.batchHistory || [];
    if (history.length > 0) {
      history[history.length - 1].to = transfer.effectiveDate;
    }
    history.push({ batch: transfer.toBatch, from: transfer.effectiveDate, to: null });

    await studentRef.update({
      currentBatch: transfer.toBatch,
      batchHistory: history
    });

    await doc.ref.update({ applied: true });
  }
}
