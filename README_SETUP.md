# HTI Academy App — সেটআপ গাইড

## যা যা তৈরি হয়েছে
- পুরো PWA (login, dashboard, attendance, fees, students, reports, activity log)
- Firestore Security Rules (`firestore.rules`)
- PWA manifest + service worker (অফলাইন সাপোর্ট)

## এখন যা করতে হবে (তোমাকে)

### ধাপ ১: Firebase Project বানানো
1. https://console.firebase.google.com এ যাও
2. "Add project" — নাম দাও (যেমন "hti-academy")
3. Google Analytics স্কিপ করতে পারো (দরকার নেই)

### ধাপ ২: Authentication চালু করা
1. Firebase Console-এ বাম দিকে "Authentication" → "Get started"
2. "Email/Password" প্রোভাইডার চালু (enable) করো

### ধাপ ৩: Firestore Database বানানো
1. বাম দিকে "Firestore Database" → "Create database"
2. "Start in production mode" বেছে নাও (rules আমরা নিজেরাই বসাবো)
3. Location: `asia-south1` (Mumbai) বেছে নিলে ভালো, ভারতের কাছাকাছি

### ধাপ ৪: Web App যোগ করা ও Config নেওয়া
1. Project Settings (⚙️ আইকন) → "Your apps" → "</>' (Web) আইকনে ক্লিক
2. একটা nickname দাও (যেমন "hti-academy-web")
3. যে config object দেখাবে সেটা কপি করো — এরকম দেখতে হবে:
   ```
   const firebaseConfig = { apiKey: "...", authDomain: "...", ... };
   ```
4. এই কনফিগ `js/firebase-config.js` ফাইলে বসাও (উপরের দিকে `firebaseConfig` অবজেক্টের জায়গায়)

### ধাপ ৫: Security Rules বসানো
1. Firestore Database → "Rules" ট্যাব
2. `firestore.rules` ফাইলের পুরো কন্টেন্ট কপি করে পেস্ট করো
3. "Publish" চাপো
4. **টেস্ট করা জরুরি**: "Rules Playground" (বা Simulator) দিয়ে অন্তত এই কেসগুলো টেস্ট করো:
   - Teacher নিজের ব্যাচের বাইরে attendance লিখতে পারছে না
   - Teacher ৭ দিনের পুরনো attendance এডিট করতে পারছে না, Admin পারছে
   - Head Admin ছাড়া কেউ activity_log delete করতে পারছে না

### ধাপ ৬: প্রথম Head Admin অ্যাকাউন্ট বানানো (Bootstrap)
এটা স্পেকের ১০.২ অনুযায়ী দরকার — normal সাইন-আপ দিয়ে প্রথম Head Admin বানানো যায় না।

সহজ উপায় (script ছাড়াই, ম্যানুয়ালি Firebase Console দিয়ে):
1. Authentication ট্যাবে গিয়ে "Add user" — নিজের ইমেইল/পাসওয়ার্ড দিয়ে অ্যাকাউন্ট বানাও
2. ঐ user-এর UID কপি করো (Authentication লিস্টে দেখাবে)
3. Firestore Database → "Start collection" → collection ID: `users`
4. Document ID-তে ঐ UID পেস্ট করো, আর এই fields যোগ করো:
   - `name` (string): তোমার নাম
   - `email` (string): তোমার ইমেইল
   - `role` (string): `head_admin`
   - `assignedBatch` (null)
   - `createdAt` (timestamp): এখনকার সময়

এরপর ঐ ইমেইল/পাসওয়ার্ড দিয়ে অ্যাপে লগইন করলেই Head Admin হিসেবে ঢুকবে।

### ধাপ ৭: প্রাথমিক ব্যাচ তৈরি করা
Firestore-এ ম্যানুয়ালি `batches` collection বানাও, দুটো ডকুমেন্ট:
- Document ID: `M-1`, fields: `name: "Morning - Section 1"`, `timing: "Morning"`, `teacherUid: null`, `allowed_editors: []`, `monthlyFeeHistory: [{amount: 200, effectiveFrom: "2026-01"}]` (তোমার আসল মাসিক ফি বসাও)
- Document ID: `E-1`, একইভাবে `timing: "Evening"`

### ধাপ ৮: হোস্টিং — কোথায় আপলোড করবে
GitHub Pages (তুমি HTI PayLink-এ যেভাবে করেছিলে, একইভাবে):
1. GitHub-এ নতুন repository বানাও (যেমন `hti-academy`)
2. এই পুরো ফোল্ডারের সব ফাইল আপলোড করো (index.html, manifest.json, service-worker.js, css/, js/, icons/)
3. Settings → Pages → Source: main branch → Save
4. কিছুক্ষণ পর একটা লিংক পাবে (যেমন `https://username.github.io/hti-academy/`)

### ধাপ ৯: টেস্ট করা
1. লিংক খুলে সাইন-আপ ট্রাই করো (প্রথমে signup বন্ধ থাকবে — Head Admin অ্যাকাউন্ট দিয়ে লগইন করে "আরও" → "ইউজার ম্যানেজমেন্ট"-এ গিয়ে সাইন-আপ চালু করো)
2. একটা টেস্ট ছাত্র যোগ করো, দেখো HAS কোড ঠিকমতো জেনারেট হচ্ছে কিনা
3. Attendance মার্ক করে দেখো
4. Fee এন্ট্রি করে দেখো FIFO ঠিকমতো কাজ করছে কিনা

## বাগ পেলে
যা যা টেস্ট করেছ আর কোথায় সমস্যা হচ্ছে সেটা আমাকে বলো, আমি ফাইল আপডেট করে দেব।
