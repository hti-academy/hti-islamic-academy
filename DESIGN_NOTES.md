# HTI Academy - Internal Design Notes (for Claude's own reference while coding)

## Firestore Collections

### users/{uid}
- name: string
- email: string
- role: "head_admin" | "admin" | "teacher" | null (null = pending approval)
- assignedBatch: string | null (batch id, only for teachers, e.g. "M-1")
- createdAt: serverTimestamp

### batches/{batchId}  e.g. "M-1", "E-1"
- name: string (e.g. "Morning - Section 1")
- timing: "Morning" | "Evening"
- teacherUid: string | null
- allowed_editors: array of admin UIDs (denormalized, per spec 15.1)
- monthlyFeeHistory: array of { amount: number, effectiveFrom: "YYYY-MM" }
  (used for FIFO historical rate calc)

### students/{studentId}  studentId = doc id, but HAS code stored as field
- hasCode: string ("HAS-1", "HAS-2"...)
- name: string
- guardianPhone: string
- feeStatus: "free" | "paid"
- currentBatch: string (batch id)
- batchHistory: array of { batch: string, from: "YYYY-MM-DD", to: "YYYY-MM-DD"|null }
- createdAt: serverTimestamp
- active: true (false when soft-deleted, but per spec deleted students move to archive collection entirely)

### counters/studentCounter
- value: number (incremented via transaction)

### attendance/{autoId}
- studentId, hasCode, batchId (snapshot at time of entry)
- date: "YYYY-MM-DD"
- status: "present"|"absent"|"late"|"mid_leave"|"late_mid_leave"
- markedBy: uid
- createdAt: serverTimestamp() -- SERVER side, immutable after creation (15.3)
- updatedAt: serverTimestamp()

### fees/{autoId}
- studentId, hasCode, batchId (snapshot)
- amountReceived: number
- receivedDate: "YYYY-MM-DD" (actual physical date)
- monthsCovered: array of "YYYY-MM" (FIFO allocated)
- categoryBreakdown: { admission, monthly, books, additional } amounts
- enteredBy: uid
- createdAt: serverTimestamp()

### feeCategories/{catId}
- name: string
- createdBy: uid
- createdAt

### pending_requests/{autoId}
- type: "batch_transfer" | "fee_status_change" | "teacher_removal"
- status: "pending"|"approved"|"rejected"
- payload: {...type-specific}
- requestedBy: uid
- createdAt
- approvals: array of uids (for teacher_removal majority vote)

### deleted_students_archive/{autoId}
- full student data + feeHistory array (attendance NOT included per spec 4.3)
- deletedBy, deletedAt

### activity_log/{autoId}
- action: string
- performedBy: uid
- targetId: string
- details: string
- createdAt: serverTimestamp

## Security Rules key points (spec section 10.5 + 15)
- Teacher: read/write own batch's attendance/fee only
- Admin: read all always; write only if uid in batch.allowed_editors
- Teacher attendance edit: only within 7 days of createdAt (server timestamp, immutable)
- activity_log: all read, only head_admin delete
- student delete: teacher (own batch) + head_admin; archive read only head_admin
- createdAt fields must use request.time on create, and be immutable on update

## HAS ID generation: use Firestore transaction on counters/studentCounter

## App structure (vanilla JS PWA, no framework - keeps it simple, matches HTI PayLink pattern user already knows)
- index.html - login/signup
- app.html - main shell after login (role-based nav)
- js/firebase-config.js
- js/auth.js
- js/students.js
- js/attendance.js
- js/fees.js
- js/batches.js
- js/requests.js (pending_requests handling incl WhatsApp wa.me links)
- js/reports.js (xlsx export, desktop-only gate)
- js/activity-log.js
- js/utils.js
- manifest.json + service worker for PWA/offline
