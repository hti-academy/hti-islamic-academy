// ==========================================
// main.js
// অ্যাপ্লিকেশনের মূল এন্ট্রি পয়েন্ট এবং গ্লোবাল স্টেট ম্যানেজমেন্ট
// ==========================================

// Global App State
window.AppState = {
  currentUser: null,
  userProfile: null,
  activeRole: null,
  currentView: 'login-view'
};

// অ্যাপ চালুর মূল ইভেন্ট
document.addEventListener('DOMContentLoaded', () => {
  console.log("HTI App Initializing...");
  setupEventListeners();
});

// ইনিশিয়াল অথেন্টিকেশন চেক ও অ্যাপ স্টার্ট
firebase.auth().onAuthStateChanged(async (user) => {
  if (user) {
    showLoading();
    try {
      window.AppState.currentUser = user;
      
      // ইউজার প্রোফাইল ডাটা লোড
      const profileDoc = await db.collection('users').doc(user.uid).get();
      if (profileDoc.exists) {
        window.AppState.userProfile = profileDoc.data();
        window.AppState.activeRole = window.AppState.userProfile.role || 'student';
        
        // নেভিগেশন ও রোল নির্দিষ্ট ভিউ সেটআপ
        setupRoleNavigation(window.AppState.activeRole);
        showView(getDashboardForRole(window.AppState.activeRole));
      } else {
        console.error("User profile not found in Firestore!");
        hideLoading();
        showView('login-view');
      }
    } catch (error) {
      console.error("Error loading user state:", error);
      showToast("ডাটা লোড করতে সমস্যা হয়েছে!", "danger");
      hideLoading();
      showView('login-view');
    } finally {
      hideLoading();
    }
  } else {
    // লগইন করা না থাকলে স্পিনার লুকিয়ে লগইন স্ক্রিন দেখাবে
    window.AppState.currentUser = null;
    window.AppState.userProfile = null;
    window.AppState.activeRole = null;
    hideLoading();
    showView('login-view');
  }
});

// রোল অনুযায়ী ড্যাশবোর্ড ঠিক করা
function getDashboardForRole(role) {
  switch (role) {
    case 'super_admin':
    case 'admin':
      return 'admin-dashboard-view';
    case 'teacher':
      return 'teacher-dashboard-view';
    case 'student':
    case 'parent':
      return 'student-dashboard-view';
    default:
      return 'login-view';
  }
}

// গ্লোবাল ইভেন্ট লিসেনার
function setupEventListeners() {
  // লগআউট বাটন হ্যান্ডলার
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showLoading();
      firebase.auth().signOut()
        .then(() => {
          showToast("সফলভাবে লগআউট হয়েছে", "success");
        })
        .catch((error) => {
          console.error("Logout error:", error);
          showToast("লগআউট করতে সমস্যা হয়েছে", "danger");
        })
        .finally(() => {
          hideLoading();
        });
    });
  }
}
