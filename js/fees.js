// ============================================================
// fees.js
// কেন এই ফাইলটা আছে: বেতন এন্ট্রি আর FIFO বকেয়া হিসাব (স্পেক ৫)।
// মূল জটিলতা: Staff শুধু "কত টাকা পেলাম" লেখে, app নিজে থেকে
// সবচেয়ে পুরনো বকেয়া মাস থেকে ভরাট করে, আর প্রতিটা মাসের
// ঐতিহাসিক rate ব্যবহার করে (আজকের rate না)।
// ============================================================

// --- একটা ছাত্রের কোন কোন মাস বকেয়া আছে বের করা ---
// studentCreatedMonth থেকে বর্তমান মাস পর্যন্ত সব মাস ধরে,
// যেগুলোতে ইতিমধ্যে পেমেন্ট cover করেনি সেগুলোই বকেয়া
async function getDueMonths(studentId, studentCreatedYearMonth) {
  const feesSnap = await db.collection('fees').where('studentId', '==', studentId).get();
  const paidMonths = new Set();
  feesSnap.docs.forEach(d => {
    (d.data().monthsCovered || []).forEach(m => paidMonths.add(m));
  });

  const allMonths = monthsBetween(studentCreatedYearMonth, currentYearMonth());
  return allMonths.filter(m => !paidMonths.has(m));
}

// --- FIFO fee entry (স্পেক ৫.২) ---
// amountReceived: আজকে হাতে পাওয়া মোট টাকা
// batchFeeHistory: ঐ ব্যাচের monthlyFeeHistory array (historical rate-এর জন্য)
async function recordFeePayment(studentId, hasCode, batchId, amountReceived, receivedDate, batchFeeHistory, studentCreatedYearMonth, categoryAmounts) {
  if (!isTeacher() && !isAdmin()) throw new Error('অনুমতি নেই');

  const dueMonths = await getDueMonths(studentId, studentCreatedYearMonth);
  const monthsCovered = [];
  const unratedMonths = []; // যেসব মাসের rate সেট নেই — এগুলো বকেয়াই থাকবে, কভার হবে না
  let remaining = amountReceived;

  // সবচেয়ে পুরনো মাস থেকে শুরু করে ভরাট করা (FIFO)
  // rate না থাকা মাস স্কিপ করা হয় না — সেটা এখনও বকেয়া, শুধু rate না বসানো পর্যন্ত
  // কভার করা যাবে না (Admin আগে ঐ মাসের rate batch settings-এ বসাবে)
  for (const month of dueMonths) {
    const rate = getRateForMonth(batchFeeHistory, month);
    if (rate === null) {
      unratedMonths.push(month);
      continue; // এই মাস বকেয়াই থাকল, শুধু rate অজানা বলে এখন কভার করা গেল না
    }
    if (remaining >= rate) {
      monthsCovered.push(month);
      remaining -= rate;
    } else {
      break; // আর পুরো মাস কভার করার মতো টাকা নেই
    }
  }

  const docRef = await db.collection('fees').add({
    studentId,
    hasCode,
    batchId,
    amountReceived,
    receivedDate, // আসল তারিখ যেদিন টাকা হাতে পাওয়া গেছে
    monthsCovered, // যেসব মাসের বকেয়া মেটানো হলো
    categoryBreakdown: categoryAmounts || {}, // {admission, monthly, books, additional}
    enteredBy: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  return { id: docRef.id, monthsCovered, remainingUnallocated: remaining, unratedMonths };
}

// --- Fee category লিস্ট ও নতুন category যোগ (স্পেক ৫.১, majority voting লাগে না) ---
async function getFeeCategories() {
  const snap = await db.collection('feeCategories').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function addFeeCategory(name) {
  if (!isAdmin()) throw new Error('শুধু Admin নতুন fee category যোগ করতে পারবে');
  const docRef = await db.collection('feeCategories').add({
    name,
    createdBy: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await logActivity('fee_category_added', docRef.id, name);
  return docRef.id;
}

// --- একটা ব্যাচের monthly fee rate পরিবর্তন (নতুন effective date সহ, ইতিহাস রক্ষা করে) ---
async function updateMonthlyFeeRate(batchId, newAmount, effectiveFromYearMonth) {
  if (!isAdmin()) throw new Error('শুধু Admin fee rate পরিবর্তন করতে পারবে');
  const batchRef = db.collection('batches').doc(batchId);
  await batchRef.update({
    monthlyFeeHistory: firebase.firestore.FieldValue.arrayUnion({
      amount: newAmount,
      effectiveFrom: effectiveFromYearMonth
    })
  });
  await logActivity('fee_rate_changed', batchId, `New rate ₹${newAmount} from ${effectiveFromYearMonth}`);
}

// --- একটা ছাত্রের সব fee history (profile view-এর জন্য) ---
async function getStudentFeeHistory(studentId) {
  const snap = await db.collection('fees')
    .where('studentId', '==', studentId)
    .orderBy('receivedDate', 'desc')
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
