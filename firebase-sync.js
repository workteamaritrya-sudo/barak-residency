import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-analytics.js";
import { getDatabase, ref, set, onValue, get, push } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";
import { getFirestore, collection, onSnapshot, doc, setDoc, addDoc, serverTimestamp, query, orderBy, limit, where, updateDoc, getDocs, or, enableIndexedDbPersistence, deleteDoc, Timestamp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
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
window.firebaseHooks = { doc, collection, query, where, updateDoc, addDoc, serverTimestamp, onSnapshot, getDocs, setDoc, sRef, uploadBytes, getDownloadURL, or, deleteDoc, Timestamp };

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
            const roomsArr = [];
            snapshot.forEach(d => {
                const data = d.data();
                roomsData[data.number] = data;
                roomsArr.push(data);
            });
            
            if (roomsArr.length > 0) {
                this.syncArrayToIDB('rooms', roomsArr);
                if (window.app && window.app.db) {
                    window.app.db.rooms = roomsData;
                    if (window.app.currentPortal === 'reception') window.app.renderRoomGrid();
                }
                
                /* Guest Portal Redirect/Expiry Logic - DISABLED per Mission Fix
                if (window.portal && window.portal.roomNumber) {
                    const roomInfo = roomsData[window.portal.roomNumber];
                    if (roomInfo && roomInfo.status === 'available') {
                        localStorage.removeItem('br_guest_session');
                        localStorage.removeItem(`br_active_order_${window.portal.roomNumber}`);
                        window.portal.showError("Session Expired", "You have been checked out. Thank you!");
                    }
                } */
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

        // --- 4. GLOBAL SETTINGS SYNC ---
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

        // --- 5. UNIFIED ORDERS SYNC (KDS Alerts) ---
        const ordersCol = collection(window.firebaseFS, 'orders');
        onSnapshot(ordersCol, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                const order = change.doc.data();
                if (change.type === "modified" && order.status === 'Served') {
                    this.playWaiterAlert();
                } else if (change.type === "added" && order.status === 'Pending') {
                    this.playKitchenAlert();
                    this.playReceptionAlert();
                    // Mission: Auto-notify Reception Dashboard for Badge Update
                    if (window.app && window.app.db && order.roomId) {
                        window.app.db.addNotification('order', `New Order: Room ${order.roomId}`, 'reception', { 
                            type: 'room', 
                            orderId: order.order_id || order.id, 
                            roomId: order.roomId 
                        });
                    }
                }
            });
            
            const orderList = [];
            snapshot.forEach(d => {
                const data = d.data();
                // Placeholder logic for fetch errors or missing fields
                orderList.push({
                    ...data, 
                    id: data.order_id || d.id,
                    total_price: data.total_price || data.total || 0,
                    status: data.status || 'Pending'
                });
            });
            if (window.app && window.app.db) {
                this.syncArrayToIDB('kitchenOrders', orderList);
            }
        });
    }

    // --- ALERTS & SOUNDS ---
    playKitchenAlert() {
        if (window.app && window.app.currentPortal === 'kitchen') {
            new Audio('kitchensound.mp3.mpeg').play().catch(() => {});
        }
    }

    playWaiterAlert() {
        if (window.app && (window.app.currentPortal === 'rest-waiter' || window.app.currentPortal === 'hotel-waiter')) {
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            new Audio('receptionnotificationalert.mp3.mpeg').play().catch(() => {});
            window.app.showToast("ORDER READY FOR SERVICE!", "success");
        }
    }

    playReceptionAlert() {
        if (window.app && window.app.currentPortal === 'reception') {
            new Audio('receptionnotificationalert.mp3.mpeg').play().catch(() => {});
            window.app.showToast("New Order Received!", "info");
        }
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
            const ordersRef = collection(window.firebaseFS, 'orders');
            let cloudStatus = 'Pending';
            if (orderObj.status === 'preparing' || orderObj.status === 'Kitchen') cloudStatus = 'Kitchen';
            if (orderObj.status === 'ready' || orderObj.status === 'Served') cloudStatus = 'Served';
            
            await addDoc(ordersRef, {
                ...orderObj,
                order_id: orderObj.id,
                status: cloudStatus,
                timestamp: serverTimestamp()
            });
        } catch(e) { console.error("Cloud Order Push Failed", e); }
    }

    async pushGuestToCloud(guestObj) {
        try {
            const { collection, addDoc, serverTimestamp, Timestamp } = window.firebaseHooks;
            const guestsRef = collection(window.firebaseFS, 'guests');
            const dataToSave = {
                fullName: guestObj.name || guestObj.fullName || "Unknown Guest",
                phoneNumber: guestObj.phone || guestObj.phoneNumber || "---",
                age: Number(guestObj.age) || 0,
                idImageUrl: guestObj.idProofUrl || guestObj.idImageUrl || null,
                advancePaid: Number(guestObj.advance) || Number(guestObj.advancePaid) || 0,
                roomNumber: guestObj.room || guestObj.roomNumber,
                tariff: Number(guestObj.tariff) || 0,
                checkInDate: Timestamp.now(), // Fixed: Use Firestore Timestamp
                checkInTimestamp: serverTimestamp(),
                foodOrders: guestObj.foodOrders || [],
                foodSync: "active",
                status: 'active'
            };

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
            const ordersRef = collection(window.firebaseFS, 'orders');
            const q = query(ordersRef, where('order_id', '==', orderId));
            const snap = await getDocs(q);
            snap.forEach(async (d) => {
                await updateDoc(d.ref, { status: status });
            });
        } catch(e) { console.error("Cloud Status Update Failed", e); }
    }

    async getNextOrderSerial(id, guestId = null) {
        try {
            const { collection, query, where, getDocs, or } = window.firebaseHooks;
            const ordersRef = collection(window.firebaseFS, 'orders');
            
            let q;
            if (guestId) {
                // If guestId is provided, count orders for this specific guest check-in session
                q = query(ordersRef, where('guestId', '==', guestId));
            } else {
                // Fallback to room/table total count if no guest context
                q = query(ordersRef, 
                    or(
                        where('roomId', '==', id.toString()),
                        where('tableId', '==', id.toString())
                    )
                );
            }
            
            const snap = await getDocs(q);
            const count = snap.size;
            return `${id}${count + 1}`;
        } catch(e) {
            console.error("Failed to get next serial", e);
            return `${id}${Date.now().toString().slice(-4)}`;
        }
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
