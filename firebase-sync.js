import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-analytics.js";
import { getDatabase, ref, set, onValue, get, push } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";
import { getFirestore, collection, onSnapshot, doc, getDoc, setDoc, addDoc, serverTimestamp, query, orderBy, limit, where, updateDoc, getDocs, or, enableIndexedDbPersistence, deleteDoc, Timestamp, runTransaction, increment, arrayUnion } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-storage.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

// Initialize Firebase with Public Configuration
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const firestore = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// Enable Offline Persistence
enableIndexedDbPersistence(firestore).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn("Firestore Persistence failed: Multiple tabs open.");
    } else if (err.code == 'unimplemented') {
        console.warn("Firestore Persistence failed: Browser not supported.");
    }
});

// Make available globally for app.js and order.js
export const firebaseFS = firestore;
export const firebaseST = storage;
export const firebaseAuth = auth;
export const firebaseHooks = { doc, getDoc, collection, query, where, updateDoc, addDoc, serverTimestamp, onSnapshot, getDocs, setDoc, sRef, uploadBytes, getDownloadURL, or, deleteDoc, Timestamp, runTransaction, increment, arrayUnion, signInWithEmailAndPassword, onAuthStateChanged, signOut };

window.firebaseFS = firebaseFS;
window.firebaseST = firebaseST;
window.firebaseAuth = firebaseAuth;
window.firebaseHooks = firebaseHooks;

class FirebaseSyncEngine {
    constructor() {
        this.isSyncing = false;
        this.isReady = false;
        console.log("[Firebase] Sync Engine Initialized (Firestore Modular SDK)");
    }

    startListener() {
        this.isReady = true;

        // Listen for internal sync triggers
        window.addEventListener('storage', (e) => {
            if (e.key === 'yukt_pms_sync') {
                this.pushAllToCloud();
            }
        });
        
        // --- 1. ROOMS REAL-TIME SYNC ---
        const roomsCol = collection(window.firebaseFS, 'rooms');
        onSnapshot(roomsCol, (snapshot) => {
            if (this.isSyncing) return;
            const roomsData = {};
            snapshot.forEach(d => {
                const data = d.data();
                // Key by both numeric and string forms for bullet-proof lookup
                const key = data.number;
                roomsData[key] = data;
                if (typeof key === 'number') roomsData[String(key)] = data;
                if (typeof key === 'string') roomsData[Number(key)] = data;
            });
            const roomsArr = Object.values(roomsData);

            if (roomsArr.length > 0) {
                this.syncArrayToIDB('rooms', roomsArr);
                if (window.app && window.app.db) {
                    window.app.db.rooms = roomsData;
                    if (window.app.currentPortal === 'reception') {
                        window.app.renderRoomGrid();
                        window.app.renderRoomOrderPanel();
                        window.app.renderServiceRequests();
                        // Refresh command center if a room is selected
                        if (window.app.selectedRoomId) window.app.updateCommandCenter();
                    }
                }
            }
        });

        // --- 2. NOTIFICATIONS SYNC ---
        const notifyCol = collection(window.firebaseFS, 'notifications');
        const notifyQuery = query(notifyCol, orderBy('timestamp', 'desc'), limit(50));
        onSnapshot(notifyQuery, (snapshot) => {
            const notices = [];
            snapshot.forEach(d => notices.push(d.data()));
            if (window.app && window.app.db) {
                window.app.db.notifications = notices;
                if (window.app.currentPortal === 'reception') window.app.renderFullNotificationTab();
                window.app.renderNotificationSidebar();
            }
        });

        // --- 3. TABLES SYNC ---
        const tablesCol = collection(window.firebaseFS, 'tables');
        onSnapshot(tablesCol, (snapshot) => {
            const tablesData = {};
            snapshot.forEach(d => {
                tablesData[d.id] = d.data();
            });
            if (Object.keys(tablesData).length > 0) {
                localStorage.setItem('yukt_rest_tables', JSON.stringify(tablesData));
                if (window.app && window.app.db) {
                    window.app.db.restaurantTables = tablesData;
                    if (window.app.currentPortal === 'rest-desk') window.app.renderRestDesk();
                }
            }
        });

        // --- 4. SERVICE REQUESTS SYNC ---
        const serviceCol = collection(window.firebaseFS, 'serviceRequests');
        onSnapshot(serviceCol, (snapshot) => {
            const requests = [];
            let hasNew = false;
            snapshot.docChanges().forEach(change => {
                if (change.type === "added" && change.doc.data().status === 'pending') {
                    hasNew = true;
                }
            });

            snapshot.forEach(d => {
                requests.push({ id: d.id, ...d.data() });
            });

            if (window.app && window.app.db) {
                window.app.db.serviceRequests = requests;
                if (window.app.currentPortal === 'reception') {
                    window.app.renderServiceRequests();
                    if (hasNew) {
                        this.playReceptionAlert();
                        this.playKitchenAlert(); // Alert both for service
                    }
                }
            }
        });

        // --- 5. GLOBAL SETTINGS & AVAILABILITY SYNC ---
        const settingsDoc = doc(window.firebaseFS, 'settings', 'global');
        onSnapshot(settingsDoc, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                if (data.menuUrl) {
                    const currentUrl = localStorage.getItem('yukt_menu_sheet_url');
                    if (currentUrl !== data.menuUrl) {
                        localStorage.setItem('yukt_menu_sheet_url', data.menuUrl);
                        if (window.app) window.app.db.loadMenu();
                    }
                }
            }
        });

        const availabilityDoc = doc(window.firebaseFS, 'settings', 'availability');
        onSnapshot(availabilityDoc, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                if (data.unavailableItems) {
                    localStorage.setItem('br_unavailable_items', JSON.stringify(data.unavailableItems));
                    if (window.app && window.app.db) {
                        window.app.db.unavailableItems = data.unavailableItems;
                        window.app.syncState();
                        if (window.app.currentPortal === 'kitchen') window.app.renderAvailabilityTool();
                    }
                    // For Guest Portal (order.js)
                    if (window.portal) {
                        window.portal.renderMenu();
                    }
                }
            }
        });

        // --- 5. UNIFIED ORDERS SYNC (KDS Alerts) ---
        const ordersCol = collection(window.firebaseFS, 'orders');
        onSnapshot(ordersCol, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                const order = change.doc.data();
                const status = order.status;
                const oid = order.order_id || change.doc.id;
                const roomNum = order.roomNumber || order.roomId || '';
                const app = window.app;
                
                // Portal Detection Logic (Check both currentPortal and currentTab)
                const isKitchenPortal = app && (app.currentPortal === 'kitchen' || app.currentTab === 'kitchen');
                const isReceptionPortal = app && (app.currentPortal === 'reception' || app.currentTab === 'dashboard' || app.currentTab === 'reception');

                // ---------- NEW ORDER ARRIVED ----------
                if (change.type === 'added' && (status === 'Pending' || status === 'Kitchen')) {
                    // 1. Kitchen beep (Only in Kitchen tab)
                    if (isKitchenPortal) {
                        this.playKitchenAlert();
                        app.showToast(`🔔 New Order: Room ${roomNum} — ${oid}`, 'info');
                    }

                    // 2. Reception alert + print (Only in Reception/Dashboard)
                    if (isReceptionPortal) {
                        this.playReceptionAlert();
                        app.generateKOT({ ...order, id: oid, items: order.items || [] });
                    }

                    // 3. Persistent notification card
                    if (app && app.db && roomNum) {
                        app.db.addNotification(
                            'order',
                            `🛎 New Order — Room ${roomNum} | ID: ${oid}`,
                            'reception',
                            { type: 'room', orderId: oid, roomNumber: roomNum, items: order.items || [] }
                        );
                    }
                }

                // ---------- ORDER MARKED READY (by KDS) ----------
                if (change.type === 'modified' && (status === 'Served' || status === 'ready')) {
                    if (isReceptionPortal) {
                        this.playReceptionAlert();
                        app.showToast(`✅ FOOD READY: Room ${roomNum} — ${oid}`, 'success');
                    }
                    if (app && app.db && roomNum) {
                        app.db.addNotification(
                            'ready',
                            `✅ READY for Pickup — Room ${roomNum} | ${oid}`,
                            'reception',
                            { type: 'room', orderId: oid, roomNumber: roomNum, items: order.items || [] }
                        );
                    }
                }

                // ---------- ORDER ON THE WAY ----------
                if (change.type === 'modified' && status === 'On the Way') {
                    if (app && app.db && roomNum) {
                        app.db.addNotification(
                            'info',
                            `🛵 On the Way — Room ${roomNum} | ${oid}`,
                            'reception',
                            { type: 'room', orderId: oid, roomNumber: roomNum, items: order.items || [] }
                        );
                    }
                }

                // ---------- ORDER DELIVERED ----------
                if (change.type === 'modified' && status === 'Delivered') {
                    if (isReceptionPortal) {
                        this.playReceptionAlert();
                        app.showToast(`✔ Delivered — Room ${roomNum} | Bill Updated`, 'success');
                    }
                }
            });

            // Rebuild kitchenOrders list
            const orderList = [];
            snapshot.forEach(d => {
                const data = d.data();
                orderList.push({
                    ...data,
                    id: data.order_id || d.id,
                    total_price: data.total_price || data.total || 0,
                    status: data.status || 'Pending'
                });
            });

            if (window.app && window.app.db) {
                window.app.db.kitchenOrders = orderList;
                this.syncArrayToIDB('kitchenOrders', orderList);
                if (window.app.currentPortal === 'kitchen') window.app.renderKDS();
                if (window.app.currentPortal === 'reception') {
                    window.app.syncState();
                    window.app.renderRoomOrderPanel();
                    window.app.updateCommandCenter();
                }
            }
        });
    }

    // --- ALERTS & SOUNDS ---
    playKitchenAlert() {
        const app = window.app;
        if (app && (app.currentPortal === 'kitchen' || app.currentTab === 'kitchen')) {
            new Audio('kitchensound.mp3.mpeg').play().catch(() => {});
        }
    }

    playWaiterAlert() {
        const app = window.app;
        if (app && (app.currentPortal === 'rest-waiter' || app.currentPortal === 'hotel-waiter' || app.currentTab === 'rest-waiter')) {
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            new Audio('receptionnotificationalert.mp3.mpeg').play().catch(() => {});
            app.showToast("ORDER READY FOR SERVICE!", "success");
        }
    }

    playReceptionAlert() {
        if (!this.audioUnlocked) return;
        const app = window.app;
        if (app && (app.currentPortal === 'reception' || app.currentTab === 'dashboard' || app.currentTab === 'reception')) {
            new Audio('receptionnotificationalert.mp3.mpeg').play().catch(() => {});
        }
    }

    unlockAudio() {
        this.audioUnlocked = true;
        const btn = document.getElementById('audio-unlock-btn');
        if (btn) btn.innerHTML = "🔊 ALERTS ACTIVE";
        // Play a silent pip to unlock
        new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==').play().catch(() => {});
    }

    // --- WRITE OPERATIONS (Firestore Transition) ---
    async pushSettingsToCloud() {
        try {
            const url = localStorage.getItem('yukt_menu_sheet_url') || '';
            const settingsRef = doc(window.firebaseFS, 'settings', 'global');
            await setDoc(settingsRef, {
                menuUrl: url,
                lastUpdated: serverTimestamp()
            });
        } catch(e) { console.error("Settings sync failed", e); }
    }

    async updateRoomStatus(roomNum, status, guestData = null) {
        try {
            const { doc, updateDoc, serverTimestamp } = window.firebaseHooks;
            const roomRef = doc(window.firebaseFS, 'rooms', roomNum.toString());
            const updatePayload = {
                status: status,
                last_updated: serverTimestamp()
            };
            if (guestData) {
                updatePayload.guestName = guestData.name || guestData.guestName;
                updatePayload.guestPhone = guestData.phone || guestData.guestPhone;
                updatePayload.guest = {
                    ...guestData,
                    guestName: guestData.name || guestData.guestName,
                    guestPhone: guestData.phone || guestData.guestPhone,
                    checkInTime: guestData.checkInTime || Date.now()
                };
            } else {
                updatePayload.guest = null;
                updatePayload.guestName = null;
                updatePayload.guestPhone = null;
                updatePayload.billGenerated = false;
            }
            await updateDoc(roomRef, updatePayload);
            console.log(`[Room] Status updated for ${roomNum} to ${status}`);
        } catch(e) { console.error("Update Room Status Failed", e); }
    }

    async pushRoomToCloud(roomObj) {
        try {
            const roomRef = doc(window.firebaseFS, 'rooms', roomObj.number);
            await setDoc(roomRef, { ...roomObj, last_updated: serverTimestamp() });
        } catch(e) { console.error("Cloud Room Sync Failed", e); }
    }

    async pushTableToCloud(tableObj) {
        try {
            const tableRef = doc(window.firebaseFS, 'tables', tableObj.id.toString());
            await setDoc(tableRef, { ...tableObj, last_updated: serverTimestamp() });
        } catch(e) { console.error("Cloud Table Sync Failed", e); }
    }

    async pushOrderToCloud(orderObj) {
        try {
            const { collection, doc, setDoc, updateDoc, serverTimestamp, increment, arrayUnion } = window.firebaseHooks;
            const ordersRef = collection(window.firebaseFS, 'orders');
            
            // 1. Identify Order ID
            const oid = orderObj.order_id || orderObj.id || `room-${orderObj.roomNumber}-${Date.now()}`;
            const orderDocRef = doc(window.firebaseFS, 'orders', String(oid));

            // Status Normalization
            let cloudStatus = orderObj.status || 'Pending';
            if (cloudStatus === 'preparing') cloudStatus = 'Kitchen';
            if (cloudStatus === 'ready')     cloudStatus = 'Served';
            if (cloudStatus === 'ontheway')  cloudStatus = 'On the Way';

            const finalOrderData = {
                ...orderObj,
                order_id: oid,
                id: oid,
                status: cloudStatus,
                timestamp: serverTimestamp()
            };

            await setDoc(orderDocRef, finalOrderData);
            console.log('[Order] Written to Firestore with id:', oid);

            // 2. MISSION: Atomically Inject Detail into Guest Document
            if (orderObj.guestId && orderObj.roomNumber) {
                const guestRef = doc(window.firebaseFS, 'guests', orderObj.guestId);
                
                // Format items for the master ledger
                const itemsToAppend = (orderObj.items || []).map(i => ({
                    name: i.name,
                    qty: i.qty,
                    price: i.price,
                    variant: i.variant || 'Full',
                    orderId: oid,
                    timestamp: Date.now()
                }));

                await updateDoc(guestRef, {
                    foodTotal: increment(orderObj.total || 0),
                    current_bill: increment(orderObj.total || 0),
                    billItems: arrayUnion(...itemsToAppend) 
                });
                console.log('[Ledger] Guest record updated with itemized orders.');
            }
        } catch(e) { console.error("Cloud Order Push Failed", e); }
    }

    async pushGuestToCloud(guestObj) {
        try {
            const { collection, addDoc, serverTimestamp, Timestamp } = window.firebaseHooks;
            const guestsRef = collection(window.firebaseFS, 'guests');
            const dataToSave = {
                guestName: guestObj.guestName || guestObj.name || guestObj.fullName || "Unknown Guest",
                guestPhone: guestObj.guestPhone || guestObj.phone || guestObj.phoneNumber || "---",
                age: Number(guestObj.age) || 0,
                idImageUrl: guestObj.idProofUrl || guestObj.idImageUrl || null,
                advancePaid: Number(guestObj.advance) || Number(guestObj.advancePaid) || 0,
                roomNumber: guestObj.room || guestObj.roomNumber,
                tariff: Number(guestObj.tariff) || 0,
                checkInDate: Timestamp.now(), 
                checkInTimestamp: serverTimestamp(),
                foodOrders: guestObj.foodOrders || [],
                foodSync: "active",
                status: 'active'
            };

            console.log('Pushing to Firestore:', dataToSave);
            const guestDoc = await addDoc(guestsRef, dataToSave);

            // Mission 3: Government Compliance Log (Duplicate Snapshot)
            const policeRef = collection(window.firebaseFS, 'police_logs');
            await addDoc(policeRef, {
                ...dataToSave,
                originalGuestId: guestDoc.id,
                complianceTimestamp: serverTimestamp(),
                logType: 'GOVT_MANDATORY_LOG'
            });

            return guestDoc.id;
        } catch(e) { 
            console.error("Cloud Guest Sync Failed", e); 
            throw e; 
        }
    }

    async deleteGuestFromCloud(guestId) {
        try {
            const { doc, deleteDoc } = window.firebaseHooks;
            const guestRef = doc(window.firebaseFS, 'guests', guestId);
            await deleteDoc(guestRef);
        } catch(e) { console.error("Guest deletion failed", e); }
    }

    async finishCheckoutTransaction(roomNumber, billObj, guestId) {
        try {
            const { doc, updateDoc, collection, addDoc, serverTimestamp, deleteDoc } = window.firebaseHooks;
            
            // Step B: Create record in ledger
            const ledgerRef = collection(window.firebaseFS, 'ledger');
            await addDoc(ledgerRef, { 
                ...billObj, 
                timestamp: serverTimestamp(),
                logType: 'ROOM_CHECKOUT'
            });

            // Step C: Update room collection
            const roomRef = doc(window.firebaseFS, 'rooms', roomNumber.toString());
            await updateDoc(roomRef, {
                status: 'available',
                guest: null,
                currentGuestId: null,
                orderSerial: 0, // Reset serial
                last_updated: serverTimestamp()
            });

            // Step D: Delete from guests collection
            if (guestId) {
                const guestRef = doc(window.firebaseFS, 'guests', guestId);
                await deleteDoc(guestRef);
            }

            console.log("[Firebase] Checkout Transaction Successful");
        } catch(e) {
            console.error("Checkout Transaction Failed", e);
            throw e;
        }
    }

    async pushBillingToCloud(billObj) {
        try {
            const billingRef = collection(window.firebaseFS, 'billing');
            const ledgerRef = collection(window.firebaseFS, 'ledger');
            const payload = { ...billObj, timestamp: serverTimestamp() };
            await Promise.all([
                addDoc(billingRef, payload),
                addDoc(ledgerRef, payload)
            ]);
        } catch(e) { console.error("Billing sync failed", e); }
    }

    async pushLedgerEntry(entry) {
        try {
            const ledgerRef = collection(window.firebaseFS, 'ledger');
            await addDoc(ledgerRef, { ...entry, timestamp: serverTimestamp() });
        } catch(e) { console.error("Cloud Ledger Sync Failed", e); }
    }

    async updateOrderStatus(orderId, status) {
        try {
            // Since we store orders with order_id as doc ID via setDoc, update directly
            let cloudStatus = status;
            if (status === 'ready' || status === 'Ready')         cloudStatus = 'Served';
            if (status === 'preparing' || status === 'Kitchen')   cloudStatus = 'Kitchen';
            if (status === 'ontheway' || status === 'On the Way') cloudStatus = 'On the Way';
            if (status === 'Delivered' || status === 'delivered') cloudStatus = 'Delivered';

            // 1. Try direct doc update (fast path — works when setDoc was used)
            try {
                const orderDocRef = doc(window.firebaseFS, 'orders', String(orderId));
                await updateDoc(orderDocRef, { status: cloudStatus });
                console.log('[Status] Updated', orderId, '->', cloudStatus);
                return;
            } catch (directErr) { /* fallthrough to query */ }

            // 2. Fallback: query by order_id field (legacy docs)
            const q = query(
                collection(window.firebaseFS, 'orders'),
                where('order_id', '==', String(orderId))
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
                await Promise.all(snap.docs.map(d => updateDoc(d.ref, { status: cloudStatus })));
            }
        } catch(e) { console.error("Cloud Status Update Failed", e); }
    }

    async getNextOrderSerial(roomId) {
        try {
            const { doc, runTransaction, increment } = window.firebaseHooks;
            const counterRef = doc(window.firebaseFS, 'metadata', 'counters');
            let nextGlobalId = 1000;
            
            await runTransaction(window.firebaseFS, async (tx) => {
                const snap = await tx.get(counterRef);
                if (!snap.exists()) {
                    tx.set(counterRef, { lastOrderId: 1000 });
                    nextGlobalId = 1001;
                } else {
                    nextGlobalId = (snap.data().lastOrderId || 1000) + 1;
                }
                tx.update(counterRef, { lastOrderId: nextGlobalId });
            });
            
            return String(nextGlobalId);
        } catch(e) {
            console.error("Global sequence failed", e);
            return String(Date.now()).slice(-6);
        }
    }

    async getUserProfile(email) {
        if (!email) return null;
        try {
            // 1. Try direct document lookup (efficient)
            const docRef = doc(window.firebaseFS, 'users', email);
            const docSnap = await firebaseHooks.getDoc(docRef);
            if (docSnap.exists()) return docSnap.data();

            // 2. Fallback to query by assignedEmail
            const usersRef = collection(window.firebaseFS, 'users');
            const q = query(usersRef, where('assignedEmail', '==', email));
            const snap = await getDocs(q);
            if (!snap.empty) return snap.docs[0].data();
            
            return null;
        } catch(e) { console.error("Profile fetch failed", e); return null; }
    }

    async uploadIdFile(file, guestPhone) {
        try {
            const fileName = `guest_ids/${guestPhone}_${Date.now()}.jpg`;
            const storageRef = sRef(window.firebaseST, fileName);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            return url;
        } catch(e) {
            console.error("File upload failed", e);
            throw e;
        }
    }

    async pushAllToCloud() {
        this.isSyncing = true;
        try {
            if (!window.app || !window.app.db || !window.app.db.idb) {
                this.isSyncing = false; return;
            }
            const rooms = window.app.db.rooms;
            for (let num in rooms) {
                await this.pushRoomToCloud(rooms[num]);
            }
            const tables = window.app.db.restaurantTables;
            for (let id in tables) {
                await this.pushTableToCloud(tables[id]);
            }
            const notices = window.app.db.notifications.slice(0, 10);
            for (let n of notices) {
                const nRef = doc(window.firebaseFS, 'notifications', n.id);
                await setDoc(nRef, n);
            }
            console.log("[Firebase] Manual Sync Complete");
        } catch(e) { console.error("Global Sync Failed", e); }
        this.isSyncing = false;
    }

    // Helper: Local Sync
    syncArrayToIDB(storeName, arrayData) {
        if (!window.app || !window.app.db || !window.app.db.idb) return;
        try {
            const tx = window.app.db.idb.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            arrayData.forEach(item => store.put(item));
            if (storeName === 'kitchenOrders' && window.app.currentPortal === 'kitchen') {
                tx.oncomplete = () => window.app.renderKDS();
            }
        } catch(e) { console.warn("IDB Sync Error", e); }
    }
}

window.FirebaseSync = new FirebaseSyncEngine();
setTimeout(() => window.FirebaseSync.startListener(), 1000);
