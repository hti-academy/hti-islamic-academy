// ==========================================
// main.js - Standalone & Safe Initialization
// ==========================================

window.AppState = {
  currentUser: null,
  userProfile: null,
  activeRole: null,
  currentView: 'login-view'
};

// স্পিনার ফোর্সফুলি বন্ধ করার সেফটি ফাংশন
function forceHideSpinner() {
  const spinner = document.getElementById('global-loading');
  if (spinner) {
    spinner.style.display = 'none';
  }
}

// ভিউ দেখানোর সেফটি ফাংশন
function forceShowLoginView() {
  const loginView = document.getElementById('login-view');
  if (loginView) {
    loginView.classList.remove('d-none');
    loginView.style.display = 'block';
  }
}

// ফায়ারবেস অথেন্টিকেশন লিসেনার
document.addEventListener('DOMContentLoaded', () => {
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged(async (user) => {
      if (user) {
        try {
          window.AppState.currentUser = user;
          const profileDoc = await db.collection('users').doc(user.uid).get();
          if (profileDoc.exists) {
            window.AppState.userProfile = profileDoc.data();
            window.AppState.activeRole = window.AppState.userProfile.role || 'student';
            
            if (typeof setupRoleNavigation === 'function') {
              setupRoleNavigation(window.AppState.activeRole);
            }
            if (typeof showView === 'function' && typeof getDashboardForRole === 'function') {
              showView(getDashboardForRole(window.AppState.activeRole));
            }
          } else {
            forceShowLoginView();
          }
        } catch (error) {
          console.error("Profile load error:", error);
          forceShowLoginView();
        } finally {
          forceHideSpinner();
        }
      } else {
        // ইউজার না থাকলে সরাসরি স্পিনার বন্ধ ও লগইন স্ক্রিন শো
        window.AppState.currentUser = null;
        window.AppState.userProfile = null;
        window.AppState.activeRole = null;
        
        forceHideSpinner();
        forceShowLoginView();
      }
    });
  } else {
    // ফায়ারবেস লোড না হলে সরাসরি স্পিনার বন্ধ
    forceHideSpinner();
    forceShowLoginView();
  }
});

// রোল অনুযায়ী ড্যাশবোর্ড
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
