// ============================================================
// reports.js
// কেন এই ফাইলটা আছে: Attendance আর Fee রিপোর্ট Excel-এ export করা (স্পেক ৯)।
// গুরুত্বপূর্ণ শর্ত: এই ফিচার শুধু ল্যাপটপ/ডেস্কটপ স্ক্রিনে কাজ করবে,
// মোবাইলে বাটন চাপলে redirect message দেখাবে (স্পেক ১৫.৫)।
// এক্সপোর্ট ফাইলে অভিভাবকের ফোন নম্বর কখনো থাকবে না (স্পেক ৯, privacy)।
// ============================================================

// ডেস্কটপ কিনা চেক করা (স্পেক ১৫.৫ — screen width ভিত্তিক সহজ চেক)
function isDesktopWidth() {
  return window.innerWidth >= 1024;
}

// --- Attendance রিপোর্ট export ---
async function exportAttendanceReport(filters) {
  // filters: { startDate, endDate, batchId (optional), studentId (optional) }
  if (!isDesktopWidth()) {
    showToast('এই ফিচারটি ব্যবহার করতে ল্যাপটপ বা কম্পিউটার থেকে অ্যাক্সেস করুন।', true);
    return;
  }

  // পারমিশন বাউন্ডারি: Teacher শুধু নিজের ব্যাচ export করতে পারবে
  let batchId = filters.batchId;
  if (isTeacher()) {
    batchId = currentUser.assignedBatch;
  }

  let query = db.collection('attendance')
    .where('date', '>=', filters.startDate)
    .where('date', '<=', filters.endDate);
  if (batchId) query = query.where('batchId', '==', batchId);
  if (filters.studentId) query = query.where('studentId', '==', filters.studentId);

  const snap = await query.get();
  const rows = snap.docs.map(d => {
    const data = d.data();
    return {
      'ছাত্রের নাম': data.studentName || '',
      'HAS কোড': data.hasCode,
      'ব্যাচ': data.batchId,
      'তারিখ': data.date,
      'স্ট্যাটাস': ATTENDANCE_LABELS[data.status] || data.status
      // ⚠️ অভিভাবকের ফোন নম্বর এখানে ইচ্ছাকৃতভাবে নেই (privacy, স্পেক ৯)
    };
  });

  downloadAsXlsx(rows, `Attendance_${filters.startDate}_to_${filters.endDate}.xlsx`, 'Attendance');
}

// --- Fee রিপোর্ট export ---
async function exportFeeReport(filters) {
  if (!isDesktopWidth()) {
    showToast('এই ফিচারটি ব্যবহার করতে ল্যাপটপ বা কম্পিউটার থেকে অ্যাক্সেস করুন।', true);
    return;
  }

  let batchId = filters.batchId;
  if (isTeacher()) {
    batchId = currentUser.assignedBatch;
  }

  let query = db.collection('fees')
    .where('receivedDate', '>=', filters.startDate)
    .where('receivedDate', '<=', filters.endDate);
  if (batchId) query = query.where('batchId', '==', batchId);
  if (filters.studentId) query = query.where('studentId', '==', filters.studentId);

  const snap = await query.get();
  const rows = snap.docs.map(d => {
    const data = d.data();
    return {
      'HAS কোড': data.hasCode,
      'ব্যাচ': data.batchId,
      'প্রাপ্ত তারিখ': data.receivedDate,
      'পরিমাণ (₹)': data.amountReceived,
      'কভার করা মাস': (data.monthsCovered || []).join(', ')
      // ⚠️ ফোন নম্বর এখানেও নেই
    };
  });

  downloadAsXlsx(rows, `Fees_${filters.startDate}_to_${filters.endDate}.xlsx`, 'Fees');
}

// --- SheetJS দিয়ে xlsx ফাইল বানিয়ে ডাউনলোড করা ---
function downloadAsXlsx(rows, filename, sheetName) {
  if (rows.length === 0) {
    showToast('এই ফিল্টারে কোনো ডাটা পাওয়া যায়নি', true);
    return;
  }
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

// --- Head Admin: Deleted students archive export (স্পেক ৪.৩) ---
async function exportArchive() {
  if (!isHeadAdmin()) throw new Error('শুধু Head Admin আর্কাইভ export করতে পারবে');
  if (!isDesktopWidth()) {
    showToast('এই ফিচারটি ব্যবহার করতে ল্যাপটপ বা কম্পিউটার থেকে অ্যাক্সেস করুন।', true);
    return;
  }
  const archive = await getDeletedStudentsArchive();
  const rows = archive.map(s => ({
    'HAS কোড': s.hasCode,
    'নাম': s.name,
    'শেষ ব্যাচ': s.currentBatch,
    'Fee স্ট্যাটাস': s.feeStatus,
    'Delete হওয়ার তারিখ': s.deletedAt ? s.deletedAt.toDate().toLocaleDateString('bn-BD') : '',
    'মোট Fee এন্ট্রি': (s.feeHistory || []).length
  }));
  downloadAsXlsx(rows, `Deleted_Students_Archive.xlsx`, 'Archive');
}
