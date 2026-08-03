// ============================================================
// utils.js
// কেন এই ফাইলটা আছে: ছোট ছোট helper function যেগুলো একাধিক জায়গায়
// বারবার লাগবে (তারিখ ফরম্যাট করা, WhatsApp লিংক বানানো, ইত্যাদি)।
// একই কোড বারবার না লিখে এখানে একবার লিখে সব জায়গা থেকে ব্যবহার করা হচ্ছে।
// ============================================================

// আজকের তারিখ "YYYY-MM-DD" ফরম্যাটে (Firestore-এ এই ফরম্যাটেই তারিখ রাখা হচ্ছে
// যাতে string comparison দিয়েই sort/filter করা যায়, আলাদা Date parsing লাগে না)
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "YYYY-MM" ফরম্যাটে বর্তমান মাস (fee-এর জন্য)
function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// দুটো "YYYY-MM" এর মধ্যে সব মাসের লিস্ট বের করে (FIFO fee হিসাবের জন্য কাজে লাগে)
function monthsBetween(startYM, endYM) {
  const months = [];
  let [sy, sm] = startYM.split('-').map(Number);
  const [ey, em] = endYM.split('-').map(Number);
  while (sy < ey || (sy === ey && sm <= em)) {
    months.push(`${sy}-${String(sm).padStart(2, '0')}`);
    sm++;
    if (sm > 12) { sm = 1; sy++; }
  }
  return months;
}

// একটা নির্দিষ্ট মাসে monthly fee rate কত ছিল, সেটা batch-এর rate history থেকে বের করা
// (স্পেক ৫.২ - historical rate ব্যবহার করতে হবে, আজকের rate না)
function getRateForMonth(feeHistory, yearMonth) {
  // feeHistory: [{amount, effectiveFrom}], effectiveFrom অনুযায়ী descending sort করে
  // যেই entry-র effectiveFrom <= yearMonth তার মধ্যে সবচেয়ে সাম্প্রতিকটা নেব।
  // কোনো entry ম্যাচ না করলে null ফেরত দেওয়া হয় (rate অজানা) — পুরনো rate-এ
  // fallback করা হয় না, কারণ সেটা ভুল বছরের রেট দিয়ে চুপচাপ বিল করতে পারে।
  if (!feeHistory || feeHistory.length === 0) return null;
  const sorted = [...feeHistory].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  const match = sorted.find(entry => entry.effectiveFrom <= yearMonth);
  return match ? match.amount : null;
}

// wa.me prefilled message লিংক বানানো (স্পেক সেকশন ৮)
// phone: country code সহ (যেমন 91XXXXXXXXXX), যদি না থাকে তাহলে খালি রেখে দিলে
// ইউজারকে নিজে থেকে কন্টাক্ট বেছে নিতে হবে
function waLink(phone, message) {
  const encoded = encodeURIComponent(message);
  if (phone) {
    return `https://wa.me/${phone}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}

// HAS কোড ফরম্যাট ভ্যালিডেশন (যেমন "HAS-42")
function isValidHasCode(code) {
  return /^HAS-\d+$/.test(code.trim());
}

// Attendance status-এর বাংলা লেবেল (UI-তে দেখানোর জন্য)
const ATTENDANCE_LABELS = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  mid_leave: 'Mid-Leave',
  late_mid_leave: 'L+ML'
};

// রোল-চেক helper — role-based UI hide/show করতে বারবার লাগবে
function hasAnyRole(userRole, allowedRoles) {
  return allowedRoles.includes(userRole);
}

// ৭ দিনের মধ্যে কিনা চেক করা (client-side UI hint-এর জন্য;
// আসল সুরক্ষা Security Rules-এ, এটা শুধু UI-তে বাটন enable/disable করতে)
function isWithin7Days(firestoreTimestamp) {
  if (!firestoreTimestamp) return false;
  const created = firestoreTimestamp.toDate();
  const now = new Date();
  const diffDays = (now - created) / (1000 * 60 * 60 * 24);
  return diffDays <= 7;
}

// সহজ toast/notification দেখানোর জন্য (কোনো library ছাড়াই)
function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = `toast ${isError ? 'toast-error' : 'toast-success'}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Loading spinner/overlay দেখানো-লুকানো (submit বাটন disable করার সময় দরকার)
function setButtonLoading(btn, isLoading, loadingText = 'অপেক্ষা করুন...') {
  if (isLoading) {
    btn.dataset.originalText = btn.textContent;
    btn.textContent = loadingText;
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.originalText || btn.textContent;
    btn.disabled = false;
  }
}
