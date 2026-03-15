import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-analytics.js";
import { getDatabase, ref, set, onValue, get, push } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";
import { getFirestore, collection, onSnapshot, doc, setDoc, addDoc, serverTimestamp, query, orderBy, limit, where, updateDoc, getDocs, or, enableIndexedDbPersistence, deleteDoc, Timestamp, runTransaction } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-storage.js";

// Initialize Firebase with Public Configuration
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const firestore = getFirestore(app);
const storage = getStorage(app);

// Enable Offline Persistence
enableIndexedDbPersistence(firestore).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn("Firestore Persistence failed: Multiple tabs open.");
    } else if (err.code == 'unimplemented') {
        console.warn("Firestore Persistence failed: Browser not supported.");
    }
});

// Make available globally for app.js and order.js
window.firebaseFS = firestore;
window.firebaseST = storage;
window.firebaseHooks = { doc, collection, query, where, updateDoc, addDoc, serverTimestamp, onSnapshot, getDocs, setDoc, sRef, uploadBytes, getDownloadURL, or, deleteDoc, Timestamp, runTransaction };
