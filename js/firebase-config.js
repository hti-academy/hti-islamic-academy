// ============================================================
// firebase-config.js
// কেন এই ফাইলটা আছে: Firebase project-এর সাথে সংযোগ স্থাপন করা।
// এই একটা ফাইলেই শুধু তোমার নিজের Firebase project-এর key বসাতে হবে।
// বাকি কোনো ফাইলে হাত দেওয়ার দরকার নেই এই সেটআপের জন্য।
// ============================================================

// ⚠️ ধাপ ১: Firebase Console থেকে তোমার project-এর config এখানে বসাও।
// কোথায় পাবে: Firebase Console > Project Settings > General > Your apps > SDK setup and configuration
const firebaseConfig = {
  apiKey: "AIzaSyBjy2wfQiBsTi1cEcG1S6FHQsD3yFQqvNE",
  authDomain: "hti-islamic-academy.firebaseapp.com",
  projectId: "hti-islamic-academy",
  storageBucket: "hti-islamic-academy.firebasestorage.app",
  messagingSenderId: "31154700623",
  appId: "1:31154700623:web:caa06810a33c13e36f053a"
};

// Firebase app initialize
firebase.initializeApp(firebaseConfig);

// এখান থেকে সব ফাইল auth আর db ব্যবহার করবে
const auth = firebase.auth();
const db = firebase.firestore();

// অফলাইন সাপোর্ট চালু করা হচ্ছে (স্পেক সেকশন ১২ অনুযায়ী)
// এটা থাকলে ইউজার ইন্টারনেট ছাড়াও ডাটা পড়তে/লিখতে পারবে, পরে auto-sync হবে
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  if (err.code === 'failed-precondition') {
    // একাধিক ট্যাব খোলা থাকলে এই error আসতে পারে, সমস্যা না
    console.warn('Persistence: একাধিক ট্যাব খোলা আছে');
  } else if (err.code === 'unimplemented') {
    console.warn('এই ব্রাউজার অফলাইন persistence সাপোর্ট করে না');
  }
});
