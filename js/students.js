// ============================================================
// students.js
// কেন এই ফাইলটা আছে: ছাত্র যোগ করা, খোঁজা, delete/archive করা (স্পেক ৪)।
// সবচেয়ে গুরুত্বপূর্ণ অংশ: HAS কোড generate করা atomic transaction দিয়ে,
// যাতে দুইজন Teacher একসাথে ছাত্র যোগ করলেও duplicate কোড না হয় (স্পেক ১৫.২)।
// ============================================================

// --- নতুন ছাত্র যোগ করা (স্পেক ৪.১, ৪.২) ---
// HAS কোড জেনারেশন আর student ডকুমেন্ট তৈরি একই transaction-এ করা হয়, যাতে
// student create ফেইল করলে counter value নষ্ট না হয় (নাহলে HAS সিরিজে গ্যাপ পড়ত)
async function addStudent(name, guardianPhone, batchId, feeStatus) {
  if (!guardianPhone || guardianPhone.trim() === '') {
    throw new Error('অভিভাবকের ফোন নম্বর বাধ্যতামূলক');
  }
  if (!isTeacher() && !isAdmin()) {
    throw new Error('শুধু Teacher বা Admin ছাত্র যোগ করতে পারবে');
  }

  const today = todayStr();
  const counterRef = db.collection('counters').doc('studentCounter');
  const studentRef = db.collection('students').doc(); // নতুন doc ID আগেই বানানো

  const result = await db.runTransaction(async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    let nextValue = 1;
    if (counterDoc.exists) {
      nextValue = counterDoc.data().value + 1;
    }
    const hasCode = `HAS-${nextValue}`;

    transaction.set(counterRef, { value: nextValue });
    transaction.set(studentRef, {
      hasCode,
      name,
      guardianPhone,
      feeStatus, // "free" | "paid"
      currentBatch: batchId,
      batchHistory: [{ batch: batchId, from: today, to: null }],
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    return { hasCode };
  });

  await logActivity('student_added', studentRef.id, `${name} (${result.hasCode}) added to ${batchId}`);

  return { id: studentRef.id, hasCode: result.hasCode, name, guardianPhone, feeStatus, currentBatch: batchId };
}

// --- একটা ব্যাচের সব active ছাত্র (Teacher নিজের ব্যাচের, Admin সব ব্যাচের) ---
async function getStudentsByBatch(batchId) {
  const snap = await db.collection('students')
    .where('currentBatch', '==', batchId)
    .where('active', '==', true)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// --- অভিভাবকের ফোন নম্বর দিয়ে ছাত্র খোঁজা (fallback lookup, স্পেক ৪.১) ---
async function findStudentByPhone(phone) {
  const snap = await db.collection('students')
    .where('guardianPhone', '==', phone)
    .where('active', '==', true)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// --- HAS কোড দিয়ে সরাসরি ছাত্র খোঁজা ---
async function findStudentByHasCode(hasCode) {
  const snap = await db.collection('students')
    .where('hasCode', '==', hasCode)
    .where('active', '==', true)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

// --- Free/Paid status পরিবর্তনের অনুরোধ (স্পেক ৪.২) ---
// শুধু Teacher শুরু করতে পারে, Admin approve করে
async function requestFeeStatusChange(studentId, newStatus, adminPhone) {
  if (!isTeacher()) throw new Error('শুধু Teacher এই পরিবর্তনের অনুরোধ শুরু করতে পারবে');

  const studentDoc = await db.collection('students').doc(studentId).get();
  const student = studentDoc.data();

  if (student.currentBatch !== currentUser.assignedBatch) {
    throw new Error('শুধু নিজের ব্যাচের ছাত্রের জন্য অনুরোধ করা যাবে');
  }

  const reqRef = await db.collection('pending_requests').add({
    type: 'fee_status_change',
    status: 'pending',
    payload: {
      studentId,
      studentName: student.name,
      hasCode: student.hasCode,
      currentStatus: student.feeStatus,
      newStatus
    },
    requestedBy: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  const message = `HTI Academy: ${student.name} (${student.hasCode}) এর status ${student.feeStatus} থেকে ${newStatus}-এ পরিবর্তনের অনুরোধ। App-এ গিয়ে Approve/Reject করুন।`;
  return { requestId: reqRef.id, waLink: waLink(adminPhone, message) };
}

// --- Admin fee status change approve/reject করা ---
async function respondToFeeStatusChange(requestId, approve) {
  if (!isAdmin()) throw new Error('শুধু Admin এটা Approve/Reject করতে পারবে');

  const reqRef = db.collection('pending_requests').doc(requestId);
  const reqDoc = await reqRef.get();
  const req = reqDoc.data();

  await reqRef.update({
    status: approve ? 'approved' : 'rejected',
    respondedBy: currentUser.uid,
    respondedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  if (approve) {
    await db.collection('students').doc(req.payload.studentId).update({
      feeStatus: req.payload.newStatus
    });
  }

  await logActivity('fee_status_change',
    req.payload.studentId,
    `${req.payload.hasCode}: ${req.payload.currentStatus} → ${req.payload.newStatus} (${approve ? 'approved' : 'rejected'})`);
}

// --- ছাত্র Delete + Archive (স্পেক ৪.৩) ---
// confirmText: ইউজার যা টাইপ করেছে যাচাইয়ের জন্য (নাম + HAS কোড)
async function deleteStudent(studentId, confirmText) {
  const studentDoc = await db.collection('students').doc(studentId).get();
  if (!studentDoc.exists) throw new Error('ছাত্র খুঁজে পাওয়া যায়নি');
  const student = studentDoc.data();

  const expectedConfirm = `${student.name} ${student.hasCode}`;
  if (confirmText.trim() !== expectedConfirm) {
    throw new Error(`নিশ্চিত করতে হলে ঠিক এভাবে লিখতে হবে: "${expectedConfirm}"`);
  }

  // পারমিশন চেক (client-side hint; আসল enforcement rules-এ)
  const canDelete = isHeadAdmin() ||
    (isTeacher() && student.currentBatch === currentUser.assignedBatch);
  if (!canDelete) throw new Error('তোমার এই ছাত্র delete করার permission নেই');

  // ছাত্রের সব fee history আর attendance রেকর্ড আগে থেকে পড়ে নেওয়া (আর্কাইভ + ডিলিটের জন্য)
  const feesSnap = await db.collection('fees').where('studentId', '==', studentId).get();
  const feeHistory = feesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const attSnap = await db.collection('attendance').where('studentId', '==', studentId).get();

  // সব লেখালিখি একটা atomic batch-এ — আর্কাইভ create, student delete, attendance delete
  // একসাথে হয় নয়তো একটাও হয় না। মাঝপথে নেটওয়ার্ক/পারমিশন সমস্যা হলে এতিম ডাটা থাকবে না।
  const batch = db.batch();

  const archiveRef = db.collection('deleted_students_archive').doc();
  batch.set(archiveRef, {
    ...student,
    originalId: studentId,
    feeHistory,
    deletedBy: currentUser.uid,
    deletedByName: currentUser.name,
    deletedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  batch.delete(db.collection('students').doc(studentId));

  // মূল student ডকুমেন্ট ডিলিট (attendance আর্কাইভ হবে না, স্পেক অনুযায়ী মুছে যাবে)
  attSnap.docs.forEach(d => batch.delete(d.ref));

  await batch.commit();

  await logActivity('student_deleted', studentId, `${student.name} (${student.hasCode})`);
}

// --- আর্কাইভ bag দেখা (শুধু Head Admin) ---
async function getDeletedStudentsArchive() {
  if (!isHeadAdmin()) throw new Error('শুধু Head Admin আর্কাইভ দেখতে পারবে');
  const snap = await db.collection('deleted_students_archive').orderBy('deletedAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
