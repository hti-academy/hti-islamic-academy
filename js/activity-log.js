// ============================================================
// activity-log.js
// কেন এই ফাইলটা আছে: Accountability আর transparency-র জন্য (স্পেক সেকশন ১১)।
// যেকোনো sensitive action (role change, fee status change, student delete,
// teacher removal vote ইত্যাদি) এখানে permanent ভাবে রেকর্ড হয়।
// সবাই পড়তে পারবে, শুধু Head Admin delete করতে পারবে (rules-এ enforce হবে)।
// ============================================================

// প্রতিটা sensitive action-এর পর এই ফাংশন কল হবে
async function logActivity(action, targetId, details) {
  if (!currentUser) return;
  await db.collection('activity_log').add({
    action: action,
    performedBy: currentUser.uid,
    performedByName: currentUser.name,
    targetId: targetId,
    details: details,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// সাম্প্রতিক লগ লোড করা (সবার জন্য দেখার permission আছে)
async function getActivityLog(limitCount = 50) {
  const snap = await db.collection('activity_log')
    .orderBy('createdAt', 'desc')
    .limit(limitCount)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// একটা নির্দিষ্ট লগ এন্ট্রি ডিলিট করা (শুধু Head Admin, rules-এও এনফোর্স হবে)
async function deleteLogEntry(logId) {
  if (!isHeadAdmin()) throw new Error('শুধু Head Admin লগ ডিলিট করতে পারবে');
  await db.collection('activity_log').doc(logId).delete();
}
