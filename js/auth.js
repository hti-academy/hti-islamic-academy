// ============================================================
// auth.js
// কেন এই ফাইলটা আছে: লগইন, সাইন-আপ, আর ইউজারের role লোড করা।
// এই ফাইলটাই ঠিক করে ইউজার app-এর ভেতরে ঢুকতে পারবে কিনা,
// আর ঢুকলে তার role অনুযায়ী কী দেখবে।
// ============================================================

let currentUser = null; // { uid, name, email, role, assignedBatch }

// সাইন-আপ চালু/বন্ধ আছে কিনা — এটা একটা config document থেকে চেক হবে
// (Head Admin app-এর ভেতর থেকেই এটা toggle করবে, স্পেক ৩.২)
async function isSignupEnabled() {
  const doc = await db.collection('config').doc('settings').get();
  return doc.exists && doc.data().signupEnabled === true;
}

// --- সাইন আপ ---
// নতুন account role ছাড়াই তৈরি হয় (pending approval), স্পেক ৩.২ অনুযায়ী
async function signUp(name, email, password) {
  const enabled = await isSignupEnabled();
  if (!enabled) {
    throw new Error('এখন নতুন সাইন-আপ বন্ধ আছে। Head Admin-এর সাথে যোগাযোগ করো।');
  }

  const cred = await auth.createUserWithEmailAndPassword(email, password);
  await db.collection('users').doc(cred.user.uid).set({
    name: name,
    email: email,
    role: null, // pending — Head Admin পরে বসাবে
    assignedBatch: null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return cred.user;
}

// --- লগইন ---
async function logIn(email, password) {
  const cred = await auth.signInWithEmailAndPassword(email, password);
  return cred.user;
}

// --- পাসওয়ার্ড রিসেট (স্পেক ১০.৩) ---
async function sendPasswordReset(email) {
  await auth.sendPasswordResetEmail(email);
}

// --- লগ আউট ---
async function logOut() {
  await auth.signOut();
  currentUser = null;
}

// ইউজারের profile (role সহ) Firestore থেকে লোড করা
async function loadUserProfile(uid) {
  const doc = await db.collection('users').doc(uid).get();
  if (!doc.exists) return null;
  return { uid, ...doc.data() };
}

// এই ফাংশনটা app শুরু হওয়ার সময় একবার কল হবে।
// Firebase-এর auth state listener ব্যবহার করে ঠিক করে দেয় ইউজার লগইন করা আছে কিনা,
// আর থাকলে তার role অনুযায়ী সঠিক পেজে পাঠায়।
function initAuthListener(onReady) {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      const profile = await loadUserProfile(user.uid);
      if (!profile) {
        // এই কেসটা সাধারণত হবে না, কিন্তু safety-এর জন্য
        currentUser = null;
        onReady(null);
        return;
      }
      currentUser = profile;
      onReady(profile);
    } else {
      currentUser = null;
      onReady(null);
    }
  });
}

// রোল-ভিত্তিক শর্টকাট চেক
function isHeadAdmin() { return currentUser && currentUser.role === 'head_admin'; }
function isAdmin() { return currentUser && (currentUser.role === 'admin' || currentUser.role === 'head_admin'); }
function isTeacher() { return currentUser && currentUser.role === 'teacher'; }
function isPending() { return currentUser && currentUser.role === null; }

// --- Head Admin: নতুন ইউজারকে role দেওয়া (স্পেক ৩.২) ---
async function assignRole(targetUid, role, batchId = null) {
  if (!isHeadAdmin()) throw new Error('শুধু Head Admin এই কাজ করতে পারবে');
  const updateData = { role };
  if (role === 'teacher') {
    updateData.assignedBatch = batchId;
  } else {
    updateData.assignedBatch = null;
  }
  await db.collection('users').doc(targetUid).update(updateData);

  // যদি teacher হয়, তার UID batch document-এ বসিয়ে দেওয়া
  if (role === 'teacher' && batchId) {
    await db.collection('batches').doc(batchId).update({ teacherUid: targetUid });
  }

  await logActivity('role_assigned', targetUid, `Role set to ${role}${batchId ? ' (batch: ' + batchId + ')' : ''}`);
}

// ভুলবশত সাইন-আপ হওয়া অ্যাকাউন্ট রিমুভ করা (স্পেক ৩.২)
async function removePendingUser(targetUid) {
  if (!isHeadAdmin()) throw new Error('শুধু Head Admin এই কাজ করতে পারবে');
  await db.collection('users').doc(targetUid).delete();
  // নোট: Firebase Auth থেকে ইউজার ডিলিট করতে Admin SDK লাগবে (server-side),
  // তাই এখানে শুধু Firestore profile ডিলিট হচ্ছে। Auth account রয়ে যাবে,
  // কিন্তু profile না থাকায় সে app-এর কিছুই দেখতে/করতে পারবে না।
}

// pending থাকা সব ইউজারের লিস্ট (Head Admin dashboard-এর জন্য)
async function getPendingUsers() {
  const snap = await db.collection('users').where('role', '==', null).get();
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

// সাইন-আপ চালু/বন্ধ করা (Head Admin)
async function toggleSignup(enabled) {
  if (!isHeadAdmin()) throw new Error('শুধু Head Admin এই কাজ করতে পারবে');
  await db.collection('config').doc('settings').set({ signupEnabled: enabled }, { merge: true });
}
