// ============================================================
// attendance.js
// কেন এই ফাইলটা আছে: প্রতিদিনের উপস্থিতি রেকর্ড করা (স্পেক ৬)।
// গুরুত্বপূর্ণ: createdAt সবসময় server timestamp দিয়ে সেট হবে,
// client-side Date() দিয়ে না — নাহলে ৭-দিনের এডিট লিমিট bypass করা
// সম্ভব হয়ে যাবে ফোনের সময় বদলে (স্পেক ১৫.৩)।
// ============================================================

const VALID_STATUSES = ['present', 'absent', 'late', 'mid_leave', 'late_mid_leave'];

// --- একটা নির্দিষ্ট দিনে একটা ব্যাচের attendance মার্ক করা ---
// entries: [{ studentId, hasCode, status }]
async function markAttendance(batchId, date, entries) {
  if (!isTeacher() && !isAdmin()) throw new Error('অনুমতি নেই');
  if (isTeacher() && currentUser.assignedBatch !== batchId) {
    throw new Error('শুধু নিজের ব্যাচের attendance মার্ক করা যাবে');
  }

  const batch = db.batch();
  for (const entry of entries) {
    if (!VALID_STATUSES.includes(entry.status)) continue;

    // একই ছাত্রের একই দিনের entry আগে থেকে থাকলে সেটার id ব্যবহার করব (upsert),
    // নাহলে duplicate entry তৈরি হয়ে যাবে
    const docId = `${entry.studentId}_${date}`;
    const ref = db.collection('attendance').doc(docId);

    batch.set(ref, {
      studentId: entry.studentId,
      hasCode: entry.hasCode,
      batchId: batchId,
      date: date,
      status: entry.status,
      markedBy: currentUser.uid,
      // ⚠️ serverTimestamp() — client date না। এটাই ৭-দিন সুরক্ষার ভিত্তি (স্পেক ১৫.৩)
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: false }); // নতুন entry হলে পুরো ওভাররাইট; existing edit আলাদা ফাংশনে
  }
  await batch.commit();
}

// --- একটা বিদ্যমান attendance entry এডিট করা (৭ দিনের সীমা প্রযোজ্য Teacher-এর জন্য) ---
async function editAttendanceEntry(studentId, date, newStatus) {
  const docId = `${studentId}_${date}`;
  const ref = db.collection('attendance').doc(docId);
  const doc = await ref.get();

  if (!doc.exists) throw new Error('এই এন্ট্রি খুঁজে পাওয়া যায়নি');
  const data = doc.data();

  if (isTeacher()) {
    if (currentUser.assignedBatch !== data.batchId) {
      throw new Error('শুধু নিজের ব্যাচের entry এডিট করা যাবে');
    }
    if (!isWithin7Days(data.createdAt)) {
      throw new Error('৭ দিন পার হয়ে গেছে, এখন শুধু Admin এডিট করতে পারবে');
    }
  } else if (!isAdmin()) {
    throw new Error('অনুমতি নেই');
  }

  // ⚠️ createdAt কখনো আপডেট করা হচ্ছে না — এটা immutable থাকবে,
  // rules-এও এটা এনফোর্স হবে (স্পেক ১৫.৩)
  await ref.update({
    status: newStatus,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// --- একটা ব্যাচের একটা দিনের attendance লোড করা ---
async function getAttendanceForDate(batchId, date) {
  const snap = await db.collection('attendance')
    .where('batchId', '==', batchId)
    .where('date', '==', date)
    .get();
  const result = {};
  snap.docs.forEach(d => { result[d.data().studentId] = { id: d.id, ...d.data() }; });
  return result;
}

// --- Sync status দেখানোর জন্য helper (স্পেক ১২, hasPendingWrites flag ব্যবহার করে) ---
// UI-তে এভাবে ব্যবহার হবে: attendance collection-এ listener বসিয়ে
// snapshot.metadata.hasPendingWrites চেক করা
function getSyncStatusListener(batchId, date, callback) {
  return db.collection('attendance')
    .where('batchId', '==', batchId)
    .where('date', '==', date)
    .onSnapshot({ includeMetadataChanges: true }, (snapshot) => {
      const hasPending = snapshot.metadata.hasPendingWrites;
      const isOffline = snapshot.metadata.fromCache && hasPending;
      callback({ hasPending, isOffline, docs: snapshot.docs });
    });
}
