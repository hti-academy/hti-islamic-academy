// ============================================================
// service-worker.js
// কেন এই ফাইলটা আছে: PWA-কে অফলাইনেও খোলার মতো বানানো (app shell cache করে)।
// আসল ডাটা (students/attendance/fees) Firestore নিজেই অফলাইন handle করে
// (firebase-config.js-এ enablePersistence দেখো) — এই ফাইল শুধু
// HTML/CSS/JS ফাইলগুলো cache করে যাতে অফলাইনেও অ্যাপ খুলতে পারে।
// ============================================================

const CACHE_NAME = 'hti-academy-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/firebase-config.js',
  './js/utils.js',
  './js/auth.js',
  './js/activity-log.js',
  './js/batches.js',
  './js/students.js',
  './js/attendance.js',
  './js/fees.js',
  './js/requests.js',
  './js/reports.js',
  './js/views.js',
  './js/main.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// শুধু GET request cache করা হচ্ছে; Firebase/API কলগুলো নেটওয়ার্ক দিয়েই যাবে
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Firestore/Auth-এর নিজস্ব request গুলো cache করার দরকার নেই, ওরা নিজেরাই অফলাইন handle করে
  if (event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        // নতুন fetch হওয়া ফাইলও cache-এ রেখে দেওয়া (পরের বার অফলাইনে কাজে লাগবে)
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
