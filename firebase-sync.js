import { firebaseConfig, app } from "./firebase-config.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-analytics.js";
import { getDatabase, ref, set, onValue, get, push } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { getFirestore, collection, onSnapshot, doc, getDoc, setDoc, addDoc, serverTimestamp, query, orderBy, limit, where, updateDoc, getDocs, or, enableIndexedDbPersistence, deleteDoc, Timestamp, runTransaction, increment, arrayUnion } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

// Initialize Firebase with Public Configuration
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
export const firebaseHooks = { doc, getDoc, collection, query, where, updateDoc, addDoc, serverTimestamp, onSnapshot, getDocs, setDoc, sRef, uploadBytes, getDownloadURL, or, deleteDoc, Timestamp, runTransaction, increment, arrayUnion, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut };

window.firebaseFS = firebaseFS;
window.firebaseST = firebaseST;
window.firebaseAuth = firebaseAuth;
window.firebaseHooks = firebaseHooks;

class FirebaseSyncEngine {
    constructor() {
        this.isSyncing = false;
        this.isReady = false;
        console.log("[Firebase] Sync Engine Initialized (v11.1.0)");
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
                    if (window.app.currentPortal === 'rest-waiter') window.app.renderRestWaiterSidebar();
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
                        this.playKitchenAlert();
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
                
                const isKitchenPortal = app && (app.currentPortal === 'kitchen' || app.currentTab === 'kitchen');
                const isReceptionPortal = app && (app.currentPortal === 'reception' || app.currentTab === 'dashboard' || app.currentTab === 'reception');

                if (change.type === 'added' && (status === 'Pending' || status === 'Kitchen' || status === 'Placed')) {
                    if (isKitchenPortal) {
                        this.playKitchenAlert();
                        app.showToast(` New Order: Room ${roomNum} — ${oid}`, 'info');
                    }
                    if (isReceptionPortal) {
                        this.playReceptionAlert();
                        app.generateKOT({ ...order, id: oid, items: order.items || [] });
                    }
                    if (app && app.db && roomNum) {
                        app.db.addNotification(
                            'order',
                            ` New Order — Room ${roomNum} | ID: ${oid}`,
                            'reception',
                            { type: 'room', orderId: oid, roomNumber: roomNum, items: order.items || [] }
                        );
                    }
                }

                if (change.type === 'modified' && (status === 'Served' || status === 'ready')) {
                    if (isReceptionPortal) {
                        this.playReceptionAlert();
                        app.showToast(` FOOD READY: Room ${roomNum} — ${oid}`, 'success');
                    }
                    if (app && app.db && roomNum) {
                        app.db.addNotification(
                            'ready',
                            ` READY for Pickup — Room ${roomNum} | ${oid}`,
                            'reception',
                            { type: 'room', orderId: oid, roomNumber: roomNum, items: order.items || [] }
                        );
                    }
                }

                if (change.type === 'modified' && status === 'On the Way') {
                    if (app && app.db && roomNum) {
                        app.db.addNotification(
                            'info',
                            ` On the Way — Room ${roomNum} | ${oid}`,
                            'reception',
                            { type: 'room', orderId: oid, roomNumber: roomNum, items: order.items || [] }
                        );
                    }
                }

                if (change.type === 'modified' && status === 'Delivered') {
                    if (isReceptionPortal) {
                        this.playReceptionAlert();
                        app.showToast(` Delivered — Room ${roomNum} | Bill Updated`, 'success');
                    }
                }
            });

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
        if (btn) btn.innerHTML = " ALERTS ACTIVE";
        new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==').play().catch(() => {});
    }

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
            const oid = orderObj.order_id || orderObj.id || `room-${orderObj.roomNumber}-${Date.now()}`;
            const orderDocRef = doc(window.firebaseFS, 'orders', String(oid));

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

            if (orderObj.guestId && orderObj.roomNumber) {
                const guestRef = doc(window.firebaseFS, 'guests', orderObj.guestId);
                const itemsToAppend = (orderObj.items || []).map(i => ({
                    name: i.name, qty: i.qty, price: i.price, variant: i.variant || 'Full', orderId: oid, timestamp: Date.now()
                }));

                await updateDoc(guestRef, {
                    foodTotal: increment(orderObj.total || 0),
                    current_bill: increment(orderObj.total || 0),
                    billItems: arrayUnion(...itemsToAppend) 
                });
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

            const guestDoc = await addDoc(guestsRef, dataToSave);
            const policeRef = collection(window.firebaseFS, 'police_logs');
            await addDoc(policeRef, { ...dataToSave, originalGuestId: guestDoc.id, complianceTimestamp: serverTimestamp(), logType: 'GOVT_MANDATORY_LOG' });
            return guestDoc.id;
        } catch(e) { throw e; }
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
            const ledgerRef = collection(window.firebaseFS, 'ledger');
            await addDoc(ledgerRef, { ...billObj, timestamp: serverTimestamp(), logType: 'ROOM_CHECKOUT' });
            const roomRef = doc(window.firebaseFS, 'rooms', roomNumber.toString());
            await updateDoc(roomRef, { status: 'available', guest: null, currentGuestId: null, orderSerial: 0, last_updated: serverTimestamp() });
            if (guestId) {
                const guestRef = doc(window.firebaseFS, 'guests', guestId);
                await deleteDoc(guestRef);
            }
        } catch(e) { throw e; }
    }

    async pushBillingToCloud(billObj) {
        try {
            const billingRef = collection(window.firebaseFS, 'billing');
            const ledgerRef = collection(window.firebaseFS, 'ledger');
            const payload = { ...billObj, timestamp: serverTimestamp() };
            await Promise.all([ addDoc(billingRef, payload), addDoc(ledgerRef, payload) ]);
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
            let cloudStatus = status;
            if (status === 'ready' || status === 'Ready')         cloudStatus = 'Served';
            if (status === 'preparing' || status === 'Kitchen')   cloudStatus = 'Kitchen';
            if (status === 'ontheway' || status === 'On the Way') cloudStatus = 'On the Way';
            if (status === 'Delivered' || status === 'delivered') cloudStatus = 'Delivered';

            try {
                const orderDocRef = doc(window.firebaseFS, 'orders', String(orderId));
                await updateDoc(orderDocRef, { status: cloudStatus });
                return;
            } catch (directErr) {}

            const q = query(collection(window.firebaseFS, 'orders'), where('order_id', '==', String(orderId)));
            const snap = await getDocs(q);
            if (!snap.empty) {
                await Promise.all(snap.docs.map(d => updateDoc(d.ref, { status: cloudStatus })));
            }
        } catch(e) { console.error("Cloud Status Update Failed", e); }
    }

    async getNextOrderSerial(roomId) {
        try {
            const { doc, runTransaction } = window.firebaseHooks;
            const roomRef = doc(window.firebaseFS, 'rooms', String(roomId));
            let nextSerial = 1;
            await runTransaction(window.firebaseFS, async (tx) => {
                const snap = await tx.get(roomRef);
                const current = snap.exists() ? (snap.data().lifetimeOrderCount || 0) : 0;
                nextSerial = current + 1;
                tx.update(roomRef, { lifetimeOrderCount: nextSerial });
            });
            return `${roomId}-${nextSerial}`;
        } catch(e) { return `${roomId}-${Date.now().toString().slice(-4)}`; }
    }

    async getUserByEmpId(empId) {
        if (!empId) return null;
        try {
            const usersRef = collection(window.firebaseFS, 'users');
            // Check original and uppercase
            let q = query(usersRef, where('empId', '==', empId));
            let snap = await getDocs(q);
            if (snap.empty) {
                q = query(usersRef, where('empId', '==', empId.toUpperCase()));
                snap = await getDocs(q);
            }
            if (snap.empty) return null;
            return { id: snap.docs[0].id, ...snap.docs[0].data() };
        } catch (e) {
            console.error("[Sync] empId lookup failed:", e);
            return null;
        }
    }

    async getUserProfile(email) {
        if (!email) return null;
        try {
            const docRef = doc(window.firebaseFS, 'users', email);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) return docSnap.data();
            const usersRef = collection(window.firebaseFS, 'users');
            const q = query(usersRef, where('assignedEmail', '==', email));
            const snap = await getDocs(q);
            if (!snap.empty) return snap.docs[0].data();
            return null;
        } catch(e) { return null; }
    }

    async uploadIdFile(file, guestPhone) {
        try {
            const fileName = `guest_ids/${guestPhone}_${Date.now()}.jpg`;
            const storageRef = sRef(window.firebaseST, fileName);
            await uploadBytes(storageRef, file);
            return await getDownloadURL(storageRef);
        } catch(e) { throw e; }
    }

    async pushAllToCloud() {
        this.isSyncing = true;
        try {
            if (!window.app || !window.app.db || !window.app.db.idb) { this.isSyncing = false; return; }
            for (let num in window.app.db.rooms) await this.pushRoomToCloud(window.app.db.rooms[num]);
            for (let id in window.app.db.restaurantTables) await this.pushTableToCloud(window.app.db.restaurantTables[id]);
            const notices = window.app.db.notifications.slice(0, 10);
            for (let n of notices) await setDoc(doc(window.firebaseFS, 'notifications', n.id), n);
        } catch(e) { console.error("Global Sync Failed", e); }
        this.isSyncing = false;
    }

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
