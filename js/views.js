// ============================================================
// views.js
// কেন এই ফাইলটা আছে: প্রতিটা স্ক্রিন (dashboard, attendance, fees, students, more)
// এর HTML বানানো আর #main-content-এ বসানো। এটাই UI-এর মূল অংশ।
// নেভিগেশন history stack-এ রাখা হচ্ছে যাতে ফোনের hardware back বাটন
// ঠিকভাবে কাজ করে (স্পেক ১৩)।
// ============================================================

const mainContent = document.getElementById('main-content');
const headerTitle = document.getElementById('header-title');
const backBtn = document.getElementById('btn-back');

let navStack = []; // in-app navigation history (স্পেক ১৩)
let currentViewName = 'dashboard';

// --- ভিউ পরিবর্তনের মূল ফাংশন ---
function navigateTo(viewName, params = {}, pushHistory = true) {
  if (pushHistory) {
    navStack.push({ view: currentViewName, params: window.__currentParams || {} });
    history.pushState({ view: viewName, params }, '', `#${viewName}`);
  }
  currentViewName = viewName;
  window.__currentParams = params;

  backBtn.style.visibility = navStack.length > 0 ? 'visible' : 'hidden';

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  renderView(viewName, params);
}

// hardware/browser back বাটন হ্যান্ডলিং (স্পেক ১৩)
window.addEventListener('popstate', (e) => {
  if (navStack.length > 0) {
    const prev = navStack.pop();
    currentViewName = prev.view;
    window.__currentParams = prev.params;
    backBtn.style.visibility = navStack.length > 0 ? 'visible' : 'hidden';
    renderView(prev.view, prev.params);
  }
  // navStack খালি হলে ব্রাউজার/অ্যাপ স্বাভাবিকভাবেই বন্ধ হয়ে যাবে (স্পেক ১৩)
});

backBtn.addEventListener('click', () => history.back());

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    navStack = []; // bottom nav থেকে নতুন সেকশনে গেলে history reset
    navigateTo(btn.dataset.view, {}, true);
  });
});

// --- ভিউ রেন্ডার ডিসপ্যাচার ---
async function renderView(viewName, params) {
  showLoading(true);
  try {
    switch (viewName) {
      case 'dashboard': await renderDashboard(); headerTitle.textContent = 'HTI Academy'; break;
      case 'attendance': await renderAttendanceHome(); headerTitle.textContent = 'উপস্থিতি'; break;
      case 'attendance-mark': await renderAttendanceMark(params); headerTitle.textContent = 'উপস্থিতি মার্ক করো'; break;
      case 'fees': await renderFeesHome(); headerTitle.textContent = 'বেতন'; break;
      case 'fees-entry': await renderFeeEntry(params); headerTitle.textContent = 'বেতন এন্ট্রি'; break;
      case 'students': await renderStudentsHome(); headerTitle.textContent = 'ছাত্র তালিকা'; break;
      case 'student-add': await renderStudentAdd(); headerTitle.textContent = 'নতুন ছাত্র'; break;
      case 'student-detail': await renderStudentDetail(params); headerTitle.textContent = 'ছাত্রের বিবরণ'; break;
      case 'more': await renderMoreHome(); headerTitle.textContent = 'আরও'; break;
      case 'pending-requests': await renderPendingRequests(); headerTitle.textContent = 'অনুরোধসমূহ'; break;
      case 'activity-log': await renderActivityLog(); headerTitle.textContent = 'অ্যাক্টিভিটি লগ'; break;
      case 'reports': await renderReports(); headerTitle.textContent = 'রিপোর্ট / এক্সপোর্ট'; break;
      case 'admin-users': await renderAdminUsers(); headerTitle.textContent = 'ইউজার ম্যানেজমেন্ট'; break;
      case 'archive': await renderArchive(); headerTitle.textContent = 'Deleted Students'; break;
      default: mainContent.innerHTML = '<p>পেজ খুঁজে পাওয়া যায়নি</p>';
    }
  } catch (err) {
    console.error(err);
    showToast(err.message || 'কিছু একটা ভুল হয়েছে', true);
  }
  showLoading(false);
}

function showLoading(show) {
  document.getElementById('global-loading').style.display = show ? 'flex' : 'none';
}

// ============================================================
// DASHBOARD
// ============================================================
async function renderDashboard() {
  const pendingCount = (isAdmin()) ? await getPendingRequestsCount() : 0;

  let roleLabel = '';
  if (isHeadAdmin()) roleLabel = 'Head Admin';
  else if (isAdmin()) roleLabel = 'Admin';
  else if (isTeacher()) roleLabel = `Teacher (${currentUser.assignedBatch})`;

  mainContent.innerHTML = `
    <div class="card">
      <p style="margin:0 0 4px; color:#6b6b6b; font-size:14px;">স্বাগতম</p>
      <h2 style="margin:0;">${currentUser.name}</h2>
      <p style="margin:6px 0 0; color:#1b6e4d; font-weight:600;">${roleLabel}</p>
    </div>

    ${pendingCount > 0 ? `
    <div class="card" style="border-color:#e53935; cursor:pointer;" id="dash-pending-card">
      <p style="margin:0; font-weight:600;">🔴 ${pendingCount}টা pending request আছে</p>
      <p style="margin:4px 0 0; font-size:13px; color:#6b6b6b;">ট্যাপ করে দেখো</p>
    </div>` : ''}

    <div class="card">
      <h3 style="margin-top:0;">দ্রুত অ্যাকশন</h3>
      <div style="display:flex; flex-direction:column; gap:10px;">
        <button class="btn-secondary" id="dash-mark-attendance">আজকের উপস্থিতি মার্ক করো</button>
        <button class="btn-secondary" id="dash-add-fee">বেতন এন্ট্রি করো</button>
        ${(isTeacher() || isAdmin()) ? `<button class="btn-secondary" id="dash-add-student">নতুন ছাত্র যোগ করো</button>` : ''}
      </div>
    </div>
  `;

  if (pendingCount > 0) {
    document.getElementById('dash-pending-card').addEventListener('click', () => navigateTo('pending-requests'));
  }
  document.getElementById('dash-mark-attendance').addEventListener('click', () => navigateTo('attendance'));
  document.getElementById('dash-add-fee').addEventListener('click', () => navigateTo('fees'));
  const addStudentBtn = document.getElementById('dash-add-student');
  if (addStudentBtn) addStudentBtn.addEventListener('click', () => navigateTo('student-add'));
}

// ============================================================
// ATTENDANCE
// ============================================================
async function renderAttendanceHome() {
  let batches = await getAllBatches();
  if (isTeacher()) {
    batches = batches.filter(b => b.id === currentUser.assignedBatch);
  }

  mainContent.innerHTML = `
    <div class="card">
      <label for="att-batch">ব্যাচ বেছে নাও</label>
      <select id="att-batch">
        ${batches.map(b => `<option value="${b.id}">${b.name || b.id}</option>`).join('')}
      </select>
      <label for="att-date">তারিখ</label>
      <input type="date" id="att-date" value="${todayStr()}">
      <button class="btn-primary" id="att-go">উপস্থিতি মার্ক করো</button>
    </div>
  `;

  document.getElementById('att-go').addEventListener('click', () => {
    const batchId = document.getElementById('att-batch').value;
    const date = document.getElementById('att-date').value;
    if (!batchId) { showToast('ব্যাচ বেছে নাও', true); return; }
    navigateTo('attendance-mark', { batchId, date });
  });
}

async function renderAttendanceMark(params) {
  const { batchId, date } = params;
  const [students, existing] = await Promise.all([
    getStudentsByBatch(batchId),
    getAttendanceForDate(batchId, date)
  ]);

  if (students.length === 0) {
    mainContent.innerHTML = `<div class="empty-state">এই ব্যাচে কোনো active ছাত্র নেই</div>`;
    return;
  }

  const statusOptions = [
    { key: 'present', label: 'Present' },
    { key: 'absent', label: 'Absent' },
    { key: 'late', label: 'Late' },
    { key: 'mid_leave', label: 'Mid-Leave' },
    { key: 'late_mid_leave', label: 'L+ML' }
  ];

  mainContent.innerHTML = `
    <p style="color:#6b6b6b; font-size:14px;">${batchId} • ${date}</p>
    <div id="att-list">
      ${students.map(s => `
        <div class="card" data-student-id="${s.id}" data-has-code="${s.hasCode}">
          <p style="margin:0 0 8px; font-weight:600;">${s.name} <span style="color:#6b6b6b; font-weight:400;">(${s.hasCode})</span></p>
          <div class="status-group">
            ${statusOptions.map(opt => `
              <button class="status-btn ${opt.key} ${existing[s.id]?.status === opt.key ? 'selected' : ''}" data-status="${opt.key}">${opt.label}</button>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
    <button class="btn-primary" id="att-submit" style="margin-top:10px;">সেভ করো</button>
  `;

  document.querySelectorAll('#att-list .status-group').forEach(group => {
    group.addEventListener('click', (e) => {
      if (!e.target.classList.contains('status-btn')) return;
      group.querySelectorAll('.status-btn').forEach(b => b.classList.remove('selected'));
      e.target.classList.add('selected');
    });
  });

  document.getElementById('att-submit').addEventListener('click', async (e) => {
    const btn = e.target;
    const entries = [];
    document.querySelectorAll('#att-list > .card').forEach(card => {
      const selected = card.querySelector('.status-btn.selected');
      if (selected) {
        entries.push({
          studentId: card.dataset.studentId,
          hasCode: card.dataset.hasCode,
          status: selected.dataset.status
        });
      }
    });
    if (entries.length === 0) {
      showToast('কোনো ছাত্রের স্ট্যাটাস বেছে নাওনি', true);
      return;
    }
    setButtonLoading(btn, true, 'সেভ হচ্ছে...');
    try {
      await markAttendance(batchId, date, entries);
      showToast(`${entries.length} জনের উপস্থিতি সেভ হয়েছে ✓`);
    } catch (err) {
      showToast(err.message, true);
    }
    setButtonLoading(btn, false);
  });
}
// ============================================================
// STUDENTS
// ============================================================
async function renderStudentsHome() {
  let batches = await getAllBatches();
  if (isTeacher()) batches = batches.filter(b => b.id === currentUser.assignedBatch);

  mainContent.innerHTML = `
    <div class="card">
      <label for="stu-batch">ব্যাচ বেছে নাও</label>
      <select id="stu-batch">
        ${batches.map(b => `<option value="${b.id}">${b.name || b.id}</option>`).join('')}
      </select>
    </div>
    ${(isTeacher() || isAdmin()) ? `<button class="btn-primary" id="stu-add-btn" style="margin-bottom:12px;">+ নতুন ছাত্র যোগ করো</button>` : ''}
    <div id="stu-list"></div>
  `;

  const addBtn = document.getElementById('stu-add-btn');
  if (addBtn) addBtn.addEventListener('click', () => navigateTo('student-add'));

  async function loadList() {
    const batchId = document.getElementById('stu-batch').value;
    const students = await getStudentsByBatch(batchId);
    const listEl = document.getElementById('stu-list');
    if (students.length === 0) {
      listEl.innerHTML = `<div class="empty-state">কোনো ছাত্র নেই</div>`;
      return;
    }
    listEl.innerHTML = `<div class="card">` + students.map(s => `
      <div class="student-row" data-id="${s.id}" style="cursor:pointer;">
        <div>
          <div class="student-name">${s.name}</div>
          <div class="student-meta">${s.hasCode}</div>
        </div>
        <span class="badge ${s.feeStatus === 'free' ? 'badge-free' : 'badge-paid'}">${s.feeStatus === 'free' ? 'Free' : 'Paid'}</span>
      </div>
    `).join('') + `</div>`;

    listEl.querySelectorAll('.student-row').forEach(row => {
      row.addEventListener('click', () => navigateTo('student-detail', { studentId: row.dataset.id }));
    });
  }

  document.getElementById('stu-batch').addEventListener('change', loadList);
  loadList();
}

async function renderStudentAdd() {
  let batches = await getAllBatches();
  if (isTeacher()) batches = batches.filter(b => b.id === currentUser.assignedBatch);

  mainContent.innerHTML = `
    <div class="card">
      <label for="new-name">ছাত্রের নাম</label>
      <input type="text" id="new-name" placeholder="পুরো নাম">
      <label for="new-phone">অভিভাবকের ফোন নম্বর</label>
      <input type="tel" id="new-phone" placeholder="যোগাযোগের নম্বর">
      <label for="new-batch">ব্যাচ</label>
      <select id="new-batch">
        ${batches.map(b => `<option value="${b.id}">${b.name || b.id}</option>`).join('')}
      </select>
      <label for="new-status">Fee স্ট্যাটাস</label>
      <select id="new-status">
        <option value="paid">Paid</option>
        <option value="free">Free</option>
      </select>
      <button class="btn-primary" id="new-submit">ছাত্র যোগ করো</button>
    </div>
  `;

  document.getElementById('new-submit').addEventListener('click', async (e) => {
    const btn = e.target;
    const name = document.getElementById('new-name').value.trim();
    const phone = document.getElementById('new-phone').value.trim();
    const batchId = document.getElementById('new-batch').value;
    const status = document.getElementById('new-status').value;

    if (!name) { showToast('নাম লেখো', true); return; }
    if (!phone) { showToast('অভিভাবকের ফোন নম্বর বাধ্যতামূলক', true); return; }

    setButtonLoading(btn, true, 'যোগ হচ্ছে...');
    try {
      const result = await addStudent(name, phone, batchId, status);
      showToast(`${result.name} যোগ হয়েছে — কোড: ${result.hasCode} ✓`);
      navigateTo('students', {}, false);
      history.back(); // navStack ঠিক রাখতে, students home এ ফিরিয়ে নেওয়া
    } catch (err) {
      showToast(err.message, true);
      setButtonLoading(btn, false);
    }
  });
}

async function renderStudentDetail(params) {
  const studentDoc = await db.collection('students').doc(params.studentId).get();
  if (!studentDoc.exists) { mainContent.innerHTML = `<div class="empty-state">ছাত্র পাওয়া যায়নি</div>`; return; }
  const student = { id: studentDoc.id, ...studentDoc.data() };
  const feeHistory = await getStudentFeeHistory(student.id);

  const canDelete = isHeadAdmin() || (isTeacher() && student.currentBatch === currentUser.assignedBatch);
  const canRequestStatusChange = isTeacher() && student.currentBatch === currentUser.assignedBatch;

  mainContent.innerHTML = `
    <div class="card">
      <h2 style="margin:0 0 4px;">${student.name}</h2>
      <p style="color:#6b6b6b; margin:0 0 10px;">${student.hasCode} • ${student.currentBatch}</p>
      <span class="badge ${student.feeStatus === 'free' ? 'badge-free' : 'badge-paid'}">${student.feeStatus === 'free' ? 'Free' : 'Paid'}</span>
      <p style="margin-top:12px; font-size:14px;">অভিভাবকের ফোন: ${student.guardianPhone}</p>
    </div>

    <div class="card">
      <h3 style="margin-top:0;">ব্যাচের ইতিহাস</h3>
      ${(student.batchHistory || []).map(h => `
        <p style="font-size:13px; margin:4px 0;">${h.batch}: ${h.from} → ${h.to || 'এখন পর্যন্ত'}</p>
      `).join('')}
    </div>

    <div class="card">
      <h3 style="margin-top:0;">সাম্প্রতিক Fee এন্ট্রি</h3>
      ${feeHistory.length === 0 ? '<p style="color:#6b6b6b;">কোনো এন্ট্রি নেই</p>' :
        feeHistory.slice(0, 5).map(f => `
          <div class="student-row">
            <div>${f.receivedDate}</div>
            <div>₹${f.amountReceived}</div>
          </div>
        `).join('')}
    </div>

    ${canRequestStatusChange ? `
    <div class="card">
      <h3 style="margin-top:0;">Free/Paid পরিবর্তনের অনুরোধ</h3>
      <button class="btn-secondary" id="req-status-change">
        ${student.feeStatus === 'free' ? 'Paid-এ পরিবর্তনের অনুরোধ করো' : 'Free-তে পরিবর্তনের অনুরোধ করো'}
      </button>
    </div>` : ''}

    ${canDelete ? `
    <div class="card">
      <h3 style="margin-top:0; color:#c0392b;">ছাত্র Delete করো</h3>
      <p style="font-size:13px; color:#6b6b6b;">নিশ্চিত করতে টাইপ করো: <strong>${student.name} ${student.hasCode}</strong></p>
      <input type="text" id="del-confirm" placeholder="নাম আর কোড টাইপ করো">
      <button class="btn-danger" id="del-submit">Delete করো</button>
    </div>` : ''}
  `;

  const reqBtn = document.getElementById('req-status-change');
  if (reqBtn) {
    reqBtn.addEventListener('click', async () => {
      const newStatus = student.feeStatus === 'free' ? 'paid' : 'free';
      try {
        const result = await requestFeeStatusChange(student.id, newStatus, '');
        showToast('অনুরোধ পাঠানো হয়েছে। WhatsApp reminder-এর জন্য নিচের লিংকে ট্যাপ করো।');
        window.open(result.waLink, '_blank');
      } catch (err) { showToast(err.message, true); }
    });
  }

  const delBtn = document.getElementById('del-submit');
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      const confirmText = document.getElementById('del-confirm').value;
      setButtonLoading(delBtn, true, 'Delete হচ্ছে...');
      try {
        await deleteStudent(student.id, confirmText);
        showToast('ছাত্র delete হয়েছে এবং আর্কাইভে সরানো হয়েছে');
        history.back();
      } catch (err) {
        showToast(err.message, true);
        setButtonLoading(delBtn, false);
      }
    });
  }
}

// ============================================================
// MORE MENU
// ============================================================
async function renderMoreHome() {
  mainContent.innerHTML = `
    <div class="card">
      <div style="display:flex; flex-direction:column; gap:10px;">
        <button class="btn-secondary" id="more-pending">অনুরোধসমূহ (Pending Requests)</button>
        <button class="btn-secondary" id="more-log">অ্যাক্টিভিটি লগ</button>
        <button class="btn-secondary" id="more-reports">রিপোর্ট / এক্সপোর্ট</button>
        ${isHeadAdmin() ? `<button class="btn-secondary" id="more-users">ইউজার ম্যানেজমেন্ট</button>` : ''}
        ${isHeadAdmin() ? `<button class="btn-secondary" id="more-archive">Deleted Students আর্কাইভ</button>` : ''}
      </div>
    </div>
  `;
  document.getElementById('more-pending').addEventListener('click', () => navigateTo('pending-requests'));
  document.getElementById('more-log').addEventListener('click', () => navigateTo('activity-log'));
  document.getElementById('more-reports').addEventListener('click', () => navigateTo('reports'));
  const usersBtn = document.getElementById('more-users');
  if (usersBtn) usersBtn.addEventListener('click', () => navigateTo('admin-users'));
  const archiveBtn = document.getElementById('more-archive');
  if (archiveBtn) archiveBtn.addEventListener('click', () => navigateTo('archive'));
}

// ============================================================
// PENDING REQUESTS
// ============================================================
async function renderPendingRequests() {
  const requests = await getPendingRequests();
  const cleanups = isHeadAdmin() ? await getTeacherRemovalsPendingCleanup() : [];

  if (requests.length === 0 && cleanups.length === 0) {
    mainContent.innerHTML = `<div class="empty-state">কোনো pending request নেই</div>`;
    return;
  }

  const requestsHtml = requests.map(r => {
    let desc = '';
    if (r.type === 'batch_transfer') desc = `Batch Transfer: ${r.payload.studentName} (${r.payload.hasCode}) — ${r.payload.fromBatch} → ${r.payload.toBatch}`;
    else if (r.type === 'fee_status_change') desc = `Fee Status: ${r.payload.studentName} (${r.payload.hasCode}) — ${r.payload.currentStatus} → ${r.payload.newStatus}`;
    else if (r.type === 'teacher_removal') desc = `Teacher Removal: ${r.payload.teacherName} (${r.payload.batchId}) — কারণ: ${r.payload.reason}`;

    return `
      <div class="card" data-req-id="${r.id}" data-req-type="${r.type}">
        <p style="margin:0 0 10px;">${desc}</p>
        <div style="display:flex; gap:8px;">
          <button class="btn-primary btn-small req-approve">✓ Approve</button>
          <button class="btn-danger btn-small req-reject">✗ Reject</button>
        </div>
      </div>
    `;
  }).join('');

  // Head Admin-only: majority vote-এ approved হয়ে যাওয়া teacher removal, যার
  // user role এখনো clear করা বাকি
  const cleanupHtml = cleanups.map(r => `
    <div class="card" data-cleanup-id="${r.id}" data-teacher-uid="${r.payload.teacherUid}">
      <p style="margin:0 0 10px;">⚠️ ${r.payload.teacherName}-কে majority vote-এ ${r.payload.batchId} থেকে সরানো হয়েছে। Login role এখনো active — clear করো।</p>
      <button class="btn-danger btn-small cleanup-role">Role Clear করো</button>
    </div>
  `).join('');

  mainContent.innerHTML = cleanupHtml + requestsHtml;

  document.querySelectorAll('[data-req-id]').forEach(card => {
    const reqId = card.dataset.reqId;
    const reqType = card.dataset.reqType;

    card.querySelector('.req-approve').addEventListener('click', async () => {
      try {
        if (reqType === 'fee_status_change') await respondToFeeStatusChange(reqId, true);
        else if (reqType === 'batch_transfer') { const r = await respondToTransfer(reqId, true, ''); window.open(r.waLink, '_blank'); }
        else if (reqType === 'teacher_removal') await voteOnTeacherRemoval(reqId);
        showToast('Approved ✓');
        renderPendingRequests();
      } catch (err) { showToast(err.message, true); }
    });

    card.querySelector('.req-reject').addEventListener('click', async () => {
      try {
        if (reqType === 'fee_status_change') await respondToFeeStatusChange(reqId, false);
        else if (reqType === 'batch_transfer') { const r = await respondToTransfer(reqId, false, ''); window.open(r.waLink, '_blank'); }
        showToast('Reject করা হয়েছে');
        renderPendingRequests();
      } catch (err) { showToast(err.message, true); }
    });
  });

  document.querySelectorAll('[data-cleanup-id]').forEach(card => {
    const reqId = card.dataset.cleanupId;
    const teacherUid = card.dataset.teacherUid;
    card.querySelector('.cleanup-role').addEventListener('click', async () => {
      try {
        await clearRemovedTeacherRole(reqId, teacherUid);
        showToast('Role clear হয়েছে ✓');
        renderPendingRequests();
      } catch (err) { showToast(err.message, true); }
    });
  });
}

// ============================================================
// ACTIVITY LOG
// ============================================================
async function renderActivityLog() {
  const logs = await getActivityLog(50);
  if (logs.length === 0) {
    mainContent.innerHTML = `<div class="empty-state">কোনো লগ নেই</div>`;
    return;
  }
  mainContent.innerHTML = `<div class="card">` + logs.map(l => `
    <div style="padding:10px 0; border-bottom:1px solid #e0e0e0;">
      <p style="margin:0; font-size:14px;"><strong>${l.performedByName || '?'}</strong> — ${l.details}</p>
      <p style="margin:2px 0 0; font-size:12px; color:#6b6b6b;">
        ${l.createdAt ? l.createdAt.toDate().toLocaleString('bn-BD') : ''}
        ${isHeadAdmin() ? ` • <a href="#" class="log-delete" data-id="${l.id}" style="color:#c0392b;">Delete</a>` : ''}
      </p>
    </div>
  `).join('') + `</div>`;

  document.querySelectorAll('.log-delete').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await deleteLogEntry(link.dataset.id);
        renderActivityLog();
      } catch (err) { showToast(err.message, true); }
    });
  });
}

// ============================================================
// REPORTS
// ============================================================
async function renderReports() {
  const showDesktopNotice = !isDesktopWidth();
  let batches = await getAllBatches();
  if (isTeacher()) batches = batches.filter(b => b.id === currentUser.assignedBatch);

  mainContent.innerHTML = `
    ${showDesktopNotice ? `<div class="desktop-only-notice">📊 এক্সপোর্ট ফিচারটি শুধু ল্যাপটপ/কম্পিউটার থেকে ব্যবহার করা যাবে।</div>` : ''}
    <div class="card">
      <label for="rep-batch">ব্যাচ (ঐচ্ছিক)</label>
      <select id="rep-batch">
        <option value="">সব ব্যাচ</option>
        ${batches.map(b => `<option value="${b.id}">${b.name || b.id}</option>`).join('')}
      </select>
      <label for="rep-start">শুরুর তারিখ</label>
      <input type="date" id="rep-start">
      <label for="rep-end">শেষ তারিখ</label>
      <input type="date" id="rep-end" value="${todayStr()}">
      <button class="btn-primary" id="rep-attendance" style="margin-bottom:8px;">Attendance Export করো</button>
      <button class="btn-secondary" id="rep-fees">Fee Export করো</button>
    </div>
  `;

  function getFilters() {
    return {
      batchId: document.getElementById('rep-batch').value || null,
      startDate: document.getElementById('rep-start').value || '2020-01-01',
      endDate: document.getElementById('rep-end').value || todayStr()
    };
  }

  document.getElementById('rep-attendance').addEventListener('click', () => exportAttendanceReport(getFilters()));
  document.getElementById('rep-fees').addEventListener('click', () => exportFeeReport(getFilters()));
}

// ============================================================
// ADMIN: USER MANAGEMENT (Head Admin only)
// ============================================================
async function renderAdminUsers() {
  const [pendingUsers, batches] = await Promise.all([getPendingUsers(), getAllBatches()]);

  mainContent.innerHTML = `
    <div class="card">
      <h3 style="margin-top:0;">সাইন-আপ কন্ট্রোল</h3>
      <button class="btn-secondary" id="toggle-signup-on">সাইন-আপ চালু করো</button>
      <button class="btn-danger" id="toggle-signup-off" style="margin-top:8px;">সাইন-আপ বন্ধ করো</button>
    </div>

    <h3>Pending Approval (${pendingUsers.length})</h3>
    ${pendingUsers.length === 0 ? '<div class="empty-state">কেউ pending নেই</div>' :
      pendingUsers.map(u => `
        <div class="card" data-uid="${u.uid}">
          <p style="margin:0 0 8px; font-weight:600;">${u.name} <span style="font-weight:400; color:#6b6b6b;">(${u.email})</span></p>
          <select class="role-select" style="margin-bottom:8px;">
            <option value="">-- role বেছে নাও --</option>
            <option value="admin">Admin</option>
            <option value="teacher">Teacher</option>
          </select>
          <select class="batch-select" style="display:none; margin-bottom:8px;">
            ${batches.map(b => `<option value="${b.id}">${b.name || b.id}</option>`).join('')}
          </select>
          <div style="display:flex; gap:8px;">
            <button class="btn-primary btn-small assign-role-btn">Role দাও</button>
            <button class="btn-danger btn-small remove-user-btn">Remove করো</button>
          </div>
        </div>
      `).join('')}
  `;

  document.getElementById('toggle-signup-on').addEventListener('click', async () => {
    await toggleSignup(true); showToast('সাইন-আপ চালু করা হয়েছে');
  });
  document.getElementById('toggle-signup-off').addEventListener('click', async () => {
    await toggleSignup(false); showToast('সাইন-আপ বন্ধ করা হয়েছে');
  });

  document.querySelectorAll('[data-uid]').forEach(card => {
    const uid = card.dataset.uid;
    const roleSelect = card.querySelector('.role-select');
    const batchSelect = card.querySelector('.batch-select');

    roleSelect.addEventListener('change', () => {
      batchSelect.style.display = roleSelect.value === 'teacher' ? 'block' : 'none';
    });

    card.querySelector('.assign-role-btn').addEventListener('click', async () => {
      const role = roleSelect.value;
      if (!role) { showToast('role বেছে নাও', true); return; }
      const batchId = role === 'teacher' ? batchSelect.value : null;
      try {
        await assignRole(uid, role, batchId);
        showToast('Role দেওয়া হয়েছে ✓');
        renderAdminUsers();
      } catch (err) { showToast(err.message, true); }
    });

    card.querySelector('.remove-user-btn').addEventListener('click', async () => {
      try {
        await removePendingUser(uid);
        showToast('Remove করা হয়েছে');
        renderAdminUsers();
      } catch (err) { showToast(err.message, true); }
    });
  });
}

// ============================================================
// ARCHIVE (Deleted Students - Head Admin only)
// ============================================================
async function renderArchive() {
  const archive = await getDeletedStudentsArchive();
  mainContent.innerHTML = `
    <button class="btn-secondary" id="archive-export" style="margin-bottom:12px;">Excel-এ Export করো</button>
    ${archive.length === 0 ? '<div class="empty-state">আর্কাইভ খালি</div>' :
      `<div class="card">` + archive.map(s => `
        <div class="student-row">
          <div>
            <div class="student-name">${s.name}</div>
            <div class="student-meta">${s.hasCode} • ${(s.feeHistory || []).length}টা fee এন্ট্রি</div>
          </div>
        </div>
      `).join('') + `</div>`}
  `;
  document.getElementById('archive-export').addEventListener('click', exportArchive);
}

// ============================================================
// FEES
// ============================================================
async function renderFeesHome() {
  let batches = await getAllBatches();
  if (isTeacher()) batches = batches.filter(b => b.id === currentUser.assignedBatch);

  mainContent.innerHTML = `
    <div class="card">
      <label for="fee-batch">ব্যাচ বেছে নাও</label>
      <select id="fee-batch">
        ${batches.map(b => `<option value="${b.id}">${b.name || b.id}</option>`).join('')}
      </select>
      <label for="fee-has">ছাত্রের HAS কোড লেখো</label>
      <input type="text" id="fee-has" placeholder="যেমন HAS-42">
      <button class="btn-primary" id="fee-find">খুঁজে বের করো</button>
    </div>
    <div id="fee-search-result"></div>
  `;

  document.getElementById('fee-find').addEventListener('click', async (e) => {
    const hasCode = document.getElementById('fee-has').value.trim();
    if (!isValidHasCode(hasCode)) { showToast('সঠিক HAS কোড দাও (যেমন HAS-42)', true); return; }
    setButtonLoading(e.target, true, 'খোঁজা হচ্ছে...');
    const student = await findStudentByHasCode(hasCode);
    setButtonLoading(e.target, false);
    if (!student) { showToast('এই কোডের কোনো ছাত্র পাওয়া যায়নি', true); return; }
    navigateTo('fees-entry', { studentId: student.id });
  });
}

async function renderFeeEntry(params) {
  const studentDoc = await db.collection('students').doc(params.studentId).get();
  if (!studentDoc.exists) { mainContent.innerHTML = `<div class="empty-state">ছাত্র পাওয়া যায়নি</div>`; return; }
  const student = { id: studentDoc.id, ...studentDoc.data() };

  if (student.feeStatus === 'free') {
    mainContent.innerHTML = `
      <div class="card">
        <p style="margin:0 0 6px; font-weight:600;">${student.name} (${student.hasCode})</p>
        <span class="badge badge-free">Free</span>
        <p style="color:#6b6b6b; margin-top:12px;">এই ছাত্র Free ক্যাটাগরিতে আছে, তাই fee এন্ট্রি প্রযোজ্য না।</p>
      </div>`;
    return;
  }

  const batchDoc = await db.collection('batches').doc(student.currentBatch).get();
  const batchData = batchDoc.data();
  const createdYM = student.createdAt ? `${student.createdAt.toDate().getFullYear()}-${String(student.createdAt.toDate().getMonth()+1).padStart(2,'0')}` : currentYearMonth();
  const dueMonths = await getDueMonths(student.id, createdYM);

  mainContent.innerHTML = `
    <div class="card">
      <p style="margin:0 0 6px; font-weight:600;">${student.name} (${student.hasCode})</p>
      <span class="badge badge-paid">Paid</span>
      <p style="color:#6b6b6b; font-size:13px; margin-top:10px;">
        বকেয়া মাস: ${dueMonths.length ? dueMonths.join(', ') : 'কোনো বকেয়া নেই'}
      </p>
    </div>
    <div class="card">
      <label for="fee-amount">আজ কত টাকা পেলে</label>
      <input type="number" id="fee-amount" placeholder="₹">
      <label for="fee-date">টাকা পাওয়ার তারিখ</label>
      <input type="date" id="fee-date" value="${todayStr()}">
      <button class="btn-primary" id="fee-submit">সেভ করো</button>
    </div>
  `;

  document.getElementById('fee-submit').addEventListener('click', async (e) => {
    const btn = e.target;
    const amount = parseFloat(document.getElementById('fee-amount').value);
    const date = document.getElementById('fee-date').value;
    if (!amount || amount <= 0) { showToast('সঠিক পরিমাণ লেখো', true); return; }

    setButtonLoading(btn, true, 'সেভ হচ্ছে...');
    try {
      const result = await recordFeePayment(
        student.id, student.hasCode, student.currentBatch,
        amount, date, batchData.monthlyFeeHistory || [], createdYM, {}
      );
      let msg = `সেভ হয়েছে ✓ কভার হলো: ${result.monthsCovered.join(', ') || 'কোনো পুরো মাস না'}`;
      if (result.unratedMonths && result.unratedMonths.length) {
        msg += ` ⚠️ এই মাস(গুলো)র rate সেট নেই, তাই বকেয়াই রইল: ${result.unratedMonths.join(', ')} — আগে batch settings-এ rate বসাও`;
      }
      showToast(msg);
      navigateTo('fees');
    } catch (err) {
      showToast(err.message, true);
    }
    setButtonLoading(btn, false);
  });
}
