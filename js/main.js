// ============================================================
// main.js
// কেন এই ফাইলটা আছে: অ্যাপ শুরু হওয়ার entry point।
// লগইন/সাইন-আপ ফর্মের বাটনগুলো এখানে wire করা হয়েছে,
// আর auth অবস্থা অনুযায়ী সঠিক ভিউ (login/pending/app) দেখানো হয়।
// ============================================================

const viewLogin = document.getElementById('view-login');
const viewPending = document.getElementById('view-pending');
const viewApp = document.getElementById('view-app');

function showOnly(el) {
  [viewLogin, viewPending, viewApp].forEach(v => v.style.display = v === el ? 'block' : 'none');
}

// --- লগইন/সাইন-আপ টগল ---
document.getElementById('link-signup').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('signup-form').style.display = 'block';
});
document.getElementById('link-login').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('signup-form').style.display = 'none';
  document.getElementById('login-form').style.display = 'block';
});

// --- লগইন ---
document.getElementById('btn-login').addEventListener('click', async (e) => {
  const btn = e.target;
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) { showToast('ইমেইল আর পাসওয়ার্ড দাও', true); return; }

  setButtonLoading(btn, true, 'লগইন হচ্ছে...');
  try {
    await logIn(email, password);
    // onAuthStateChanged বাকিটা সামলে নেবে
  } catch (err) {
    showToast(mapAuthError(err), true);
  }
  setButtonLoading(btn, false);
});

// --- সাইন-আপ ---
document.getElementById('btn-signup').addEventListener('click', async (e) => {
  const btn = e.target;
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  if (!name || !email || !password) { showToast('সব ঘর পূরণ করো', true); return; }
  if (password.length < 6) { showToast('পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে', true); return; }

  setButtonLoading(btn, true, 'অ্যাকাউন্ট তৈরি হচ্ছে...');
  try {
    await signUp(name, email, password);
  } catch (err) {
    showToast(mapAuthError(err), true);
  }
  setButtonLoading(btn, false);
});

// --- পাসওয়ার্ড রিসেট ---
document.getElementById('link-forgot').addEventListener('click', async (e) => {
  e.preventDefault();
  const email = prompt('তোমার ইমেইল লেখো:');
  if (!email) return;
  try {
    await sendPasswordReset(email);
    showToast('রিসেট লিংক ইমেইলে পাঠানো হয়েছে');
  } catch (err) {
    showToast(mapAuthError(err), true);
  }
});

// --- লগ আউট ---
document.getElementById('btn-logout').addEventListener('click', async () => {
  if (confirm('লগ আউট করতে চাও?')) await logOut();
});
document.getElementById('btn-pending-logout').addEventListener('click', async () => {
  await logOut();
});

// Firebase auth error কোড-কে বাংলা মেসেজে রূপান্তর
function mapAuthError(err) {
  const map = {
    'auth/user-not-found': 'এই ইমেইলে কোনো অ্যাকাউন্ট নেই',
    'auth/wrong-password': 'ভুল পাসওয়ার্ড',
    'auth/email-already-in-use': 'এই ইমেইলে আগে থেকে অ্যাকাউন্ট আছে',
    'auth/invalid-email': 'ইমেইল ঠিকানা সঠিক না',
    'auth/weak-password': 'পাসওয়ার্ড দুর্বল, কমপক্ষে ৬ অক্ষর দাও',
    'auth/invalid-credential': 'ইমেইল বা পাসওয়ার্ড ভুল'
  };
  return map[err.code] || err.message;
}

// --- অফলাইন/অনলাইন ব্যানার (স্পেক ১২) ---
window.addEventListener('online', () => {
  document.getElementById('offline-banner').style.display = 'none';
});
window.addEventListener('offline', () => {
  document.getElementById('offline-banner').style.display = 'block';
});
if (!navigator.onLine) {
  document.getElementById('offline-banner').style.display = 'block';
}

// --- অ্যাপ শুরু ---
initAuthListener(async (profile) => {
  if (!profile) {
    showOnly(viewLogin);
    return;
  }
  if (profile.role === null || profile.role === undefined) {
    showOnly(viewPending);
    return;
  }

  showOnly(viewApp);

  // pending batch transfer থাকলে সেগুলো apply করা (স্পেক ৭.২.৬)
  applyDueScheduledTransfers().catch(console.error);

  navStack = [];
  navigateTo('dashboard', {}, false);
  history.replaceState({ view: 'dashboard', params: {} }, '', '#dashboard');
});

// --- PWA সার্ভিস ওয়ার্কার রেজিস্টার ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(err => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
