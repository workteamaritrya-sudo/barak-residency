/**
 * 
 * BARAK RESIDENCY — Restaurant Desk App
 * Standalone · Firebase Firestore · No localStorage dependency
 * KDS-connected via shared Firestore orders collection
 * 
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import {
    getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc,
    onSnapshot, query, orderBy, limit, updateDoc, deleteDoc,
    serverTimestamp, where, increment, arrayUnion
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

//  Firebase Config 
const firebaseConfig = {
    apiKey: "AIzaSyANudXFm6QK4jJXKtXtAaDe9hWFDcBF8Vo",
    authDomain: "barak-residency-59405.firebaseapp.com",
    projectId: "barak-residency-59405",
    databaseURL: "https://barak-residency-59405-default-rtdb.firebaseio.com",
    storageBucket: "barak-residency-59405.firebasestorage.app",
    messagingSenderId: "3871550492",
    appId: "1:3871550492:web:2cf49bc0a963b4888f43d9"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

//  Master Menu Fallback 
const SHARED_MENU = [
    { id: 'm1-basmat', name: 'Basmati Rice', category: 'Main Course', price: 80, priceHalf: 50, description: 'Premium long grain steamed rice', imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm2-bhunak', name: 'Bhuna Khichuri', category: 'Main Course', price: 180, priceHalf: 100, description: 'Ghee-laden yellow lentil rice', imageUrl: 'https://images.unsplash.com/photo-1645177639578-56e89d924bb1?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm3-luchi', name: 'Luchi (4 pcs)', category: 'Starters', price: 60, priceHalf: 0, description: 'Deep-fried puffed bread', imageUrl: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400', portionType: 'Quantity', isAvailable: true },
    { id: 'm4-chola', name: 'Cholar Dal', category: 'Main Course', price: 90, priceHalf: 0, description: 'Bengal gram dal with coconut', imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm5-begun', name: 'Begun Bhaja', category: 'Starters', price: 40, priceHalf: 0, description: 'Fried eggplant slices', imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400', portionType: 'Quantity', isAvailable: true },
    { id: 'm6-aloop', name: 'Aloo Posto', category: 'Main Course', price: 150, priceHalf: 80, description: 'Potatoes in poppy seed paste', imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm7-shukto', name: 'Shukto', category: 'Main Course', price: 120, priceHalf: 70, description: 'Traditional bitter-sweet mixed veg', imageUrl: 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm8-mocha', name: 'Mochar Ghonto', category: 'Main Course', price: 160, priceHalf: 0, description: 'Banana flower dry curry', imageUrl: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm9-dhoka', name: 'Dhokar Dalna', category: 'Main Course', price: 140, priceHalf: 80, description: 'Lentil cakes in spicy gravy', imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm10-chick', name: 'Chicken Kosha', category: 'Main Course', price: 280, priceHalf: 160, description: 'Slow-cooked spicy chicken', imageUrl: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm11-mutt', name: 'Mutton Kosha', category: 'Main Course', price: 450, priceHalf: 250, description: 'Traditional spicy mutton curry', imageUrl: 'https://images.unsplash.com/photo-1545247181-516773cae754?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm12-ilish', name: 'Ilish Bhapa', category: 'Main Course', price: 450, priceHalf: 0, description: 'Hilsa steamed in mustard paste', imageUrl: 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm13-ruim', name: 'Rui Macher Jhol', category: 'Main Course', price: 180, priceHalf: 0, description: 'Rohu fish in light cumin gravy', imageUrl: 'https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm14-pabda', name: 'Pabda Jhal', category: 'Main Course', price: 250, priceHalf: 0, description: 'Pabda fish in spicy mustard', imageUrl: 'https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm15-ching', name: 'Chingri Malaikari', category: 'Main Course', price: 380, priceHalf: 0, description: 'Prawns in coconut milk gravy', imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm16-bhet', name: 'Bhetki Paturi', category: 'Main Course', price: 320, priceHalf: 0, description: 'Fish steamed in banana leaf', imageUrl: 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm17-sorsh', name: 'Sorshe Ilish', category: 'Main Course', price: 480, priceHalf: 0, description: 'Hilsa in pungent mustard gravy', imageUrl: 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm18-katla', name: 'Katla Kalia', category: 'Main Course', price: 220, priceHalf: 0, description: 'Rich Katla fish gravy', imageUrl: 'https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm19-pomf', name: 'Pomfret Masala', category: 'Main Course', price: 300, priceHalf: 0, description: 'Whole fried pomfret masala', imageUrl: 'https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm20-chikb', name: 'Chicken Biryani', category: 'Main Course', price: 320, priceHalf: 180, description: 'Kolkata style with potato', imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm21-mutb', name: 'Mutton Biryani', category: 'Main Course', price: 420, priceHalf: 220, description: 'Rich aromatic mutton rice', imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm22-fishf', name: 'Fish Finger (6pcs)', category: 'Starters', price: 220, priceHalf: 0, description: 'Crispy breaded fish strips', imageUrl: 'https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=400', portionType: 'Quantity', isAvailable: true },
    { id: 'm23-chikc', name: 'Chicken Cutlet', category: 'Starters', price: 150, priceHalf: 0, description: 'Minced chicken deep fried', imageUrl: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400', portionType: 'Quantity', isAvailable: true },
    { id: 'm24-vegc', name: 'Veg Chop (2pcs)', category: 'Starters', price: 40, priceHalf: 0, description: 'Beetroot and peanut croquettes', imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400', portionType: 'Quantity', isAvailable: true },
    { id: 'm25-alood', name: 'Aloo Dum', category: 'Main Course', price: 110, priceHalf: 60, description: 'Spicy baby potato curry', imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm26-chann', name: 'Channar Dalna', category: 'Main Course', price: 180, priceHalf: 100, description: 'Cottage cheese balls in gravy', imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm27-murig', name: 'Muri Ghonto', category: 'Main Course', price: 200, priceHalf: 0, description: 'Fish head cooked with rice', imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm28-lauch', name: 'Lau Chingri', category: 'Main Course', price: 190, priceHalf: 0, description: 'Bottle gourd with small prawns', imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm29-papad', name: 'Papad Bhaja', category: 'Starters', price: 15, priceHalf: 0, description: 'Crispy fried papadum', imageUrl: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400', portionType: 'Quantity', isAvailable: true },
    { id: 'm30-tomat', name: 'Tomato Chutney', category: 'Starters', price: 40, priceHalf: 0, description: 'Sweet and tangy tomato relish', imageUrl: 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=400', portionType: 'Quantity', isAvailable: true },
    { id: 'm31-mishti', name: 'Mishti Doi', category: 'Dessert', price: 60, priceHalf: 0, description: 'Sweet fermented yogurt', imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400', portionType: 'Quantity', isAvailable: true },
    { id: 'm32-roso', name: 'Rosogolla (2pcs)', category: 'Dessert', price: 40, priceHalf: 0, description: 'Sponge syrupy balls', imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400', portionType: 'Quantity', isAvailable: true },
    { id: 'm33-gulab', name: 'Gulab Jamun (2pcs)', category: 'Dessert', price: 50, priceHalf: 0, description: 'Fried milk solid balls', imageUrl: 'https://images.unsplash.com/photo-1620660998677-f5a6c07db9bb?w=400', portionType: 'Quantity', isAvailable: true },
    { id: 'm34-payesh', name: 'Payesh', category: 'Dessert', price: 100, priceHalf: 0, description: 'Rice pudding with jaggery', imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400', portionType: 'Quantity', isAvailable: true },
    { id: 'm35-sand', name: 'Sandesh (2pcs)', category: 'Dessert', price: 60, priceHalf: 0, description: 'Traditional dry milk sweet', imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400', portionType: 'Quantity', isAvailable: true },
    { id: 'm36-mw1l', name: 'Mineral Water 1L', category: 'Drinks', price: 20, priceHalf: 0, description: 'Chilled Bisleri', imageUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400', portionType: 'Bottle', isAvailable: true },
    { id: 'm37-mw500', name: 'Mineral Water 500ml', category: 'Drinks', price: 10, priceHalf: 0, description: 'Travel size water', imageUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400', portionType: 'Bottle', isAvailable: true },
    { id: 'm38-milkt', name: 'Milk Tea', category: 'Drinks', price: 25, priceHalf: 0, description: 'Strong Assam CTC Tea', imageUrl: 'https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?w=400', portionType: 'Cup', isAvailable: true },
    { id: 'm39-blkt', name: 'Black Tea', category: 'Drinks', price: 15, priceHalf: 0, description: 'Lemon and ginger tea', imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400', portionType: 'Cup', isAvailable: true },
    { id: 'm40-coffee', name: 'Coffee', category: 'Drinks', price: 40, priceHalf: 0, description: 'Instant milk coffee', imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400', portionType: 'Cup', isAvailable: true },
    { id: 'm41-lassi', name: 'Sweet Lassi', category: 'Drinks', price: 80, priceHalf: 0, description: 'Thick yogurt drink', imageUrl: 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=400', portionType: 'Cup', isAvailable: true },
    { id: 'm42-limsod', name: 'Fresh Lime Soda', category: 'Drinks', price: 60, priceHalf: 0, description: 'Sweet or Salted', imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400', portionType: 'Cup', isAvailable: true },
    { id: 'm43-cola', name: 'Coca Cola 500ml', category: 'Drinks', price: 45, priceHalf: 0, description: 'Pet bottle chilled', imageUrl: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400', portionType: 'Bottle', isAvailable: true },
    { id: 'm44-sprite', name: 'Sprite 500ml', category: 'Drinks', price: 45, priceHalf: 0, description: 'Pet bottle chilled', imageUrl: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400', portionType: 'Bottle', isAvailable: true },
    { id: 'm45-eggc', name: 'Egg Curry (2pcs)', category: 'Main Course', price: 120, priceHalf: 0, description: 'Boiled eggs in spicy gravy', imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm46-dakb', name: 'Chicken Dak Bunglow', category: 'Main Course', price: 300, priceHalf: 180, description: 'Heritage chicken curry with egg', imageUrl: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm47-posto', name: 'Posto Bora (4pcs)', category: 'Starters', price: 120, priceHalf: 0, description: 'Poppy seed fried fritters', imageUrl: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400', portionType: 'Quantity', isAvailable: true },
    { id: 'm48-dachr', name: 'Macher Matha Diye Dal', category: 'Main Course', price: 130, priceHalf: 0, description: 'Roasted Moong dal with fish head', imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm49-kanka', name: 'Kancha Lanka Murgi', category: 'Main Course', price: 290, priceHalf: 160, description: 'Green chili chicken (spicy)', imageUrl: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400', portionType: 'Plate', isAvailable: true },
    { id: 'm50-bhetf', name: 'Bhetki Fry', category: 'Starters', price: 180, priceHalf: 0, description: 'Pure Bhetki fillet fry', imageUrl: 'https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=400', portionType: 'Quantity', isAvailable: true }
];

//  State 
let tables = {};
let menu = JSON.parse(JSON.stringify(SHARED_MENU)); // Deep copy master base
let notifications = [];
let kitchenOrders = [];
let unavailableItems = [];
let restaurantRevenue = 0;
let activePickups = [];
let pickupCounter = 0;
let pickupCart = [];

//  Check-in & Reservation State 
let capturedGuestPhoto = null;
let capturedIdFiles = [];

//  Passcode Protection 
function verifyPasscode() {
    const input = document.getElementById('desk-pass-input').value;
    if (input === '2026') {
        document.getElementById('desk-passcode-overlay').style.fadeOut = '0.3s';
        setTimeout(() => {
            document.getElementById('desk-passcode-overlay').style.display = 'none';
        }, 300);
    } else {
        const err = document.getElementById('desk-pass-err');
        err.style.display = 'block';
        setTimeout(() => { err.style.display = 'none'; }, 2000);
    }
}

//  Check-in & Reservation UI 

function showCheckInForm() {
    document.getElementById('smart-checkin-modal').style.display = 'flex';
    if (window.deskApp.currentRoom) {
        document.getElementById('sci-room').value = window.deskApp.currentRoom;
    }
    sciNext(1);
}

function openReserveModal() {
    document.getElementById('reserve-modal').style.display = 'flex';
}

function sciNext(step) {
    document.querySelectorAll('.ci-view').forEach(v => v.style.display = 'none');
    document.getElementById(`ci-view-${step}`).style.display = 'block';
    
    // Update stepper
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`ci-step-${i}`);
        if (el) {
            el.style.color = i === step ? 'var(--gold-primary)' : 'var(--text-gray)';
            el.style.fontWeight = i === step ? 'bold' : 'normal';
        }
    }

    if (step === 2) startSciCamera();
}

async function startSciCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const video = document.getElementById('sci-video');
        video.srcObject = stream;
        video.style.display = 'block';
        document.getElementById('sci-photo-preview').style.display = 'none';
        window.sciStream = stream;
    } catch (e) { showToast('Camera access failed', 'error'); }
}

function captureLivePhoto() {
    const video = document.getElementById('sci-video');
    const canvas = document.getElementById('sci-canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    const dataUrl = canvas.toDataURL('image/jpeg');
    document.getElementById('sci-photo-preview').src = dataUrl;
    document.getElementById('sci-photo-preview').style.display = 'block';
    video.style.display = 'none';
    
    capturedGuestPhoto = dataUrl;
    if (window.sciStream) {
        window.sciStream.getTracks().forEach(t => t.stop());
    }
}

function handleMultiIdUpload(input) {
    capturedIdFiles = Array.from(input.files);
    document.getElementById('sci-id-list').innerText = `${capturedIdFiles.length} files attached`;
}

async function submitCheckIn() {
    const roomNum = document.getElementById('sci-room').value.trim();
    const guestName = document.getElementById('sci-name').value.trim();
    const phone = document.getElementById('sci-phone').value.trim();
    const tariff = parseFloat(document.getElementById('sci-tariff').value) || 2500;
    const advance = parseFloat(document.getElementById('sci-advance').value) || 0;

    if (!roomNum || !guestName || !phone) {
        showToast('Required fields missing', 'warning');
        return;
    }

    try {
        const stayID = `stay_${roomNum}_${Date.now()}`;
        const guestObj = {
            id: Date.now().toString(),
            roomNumber: roomNum,
            guestName, phone, tariff, advance,
            checkInTimestamp: Date.now(),
            stayID,
            status: 'active'
        };

        // Update Room in Firestore
        await setDoc(doc(db, 'rooms', roomNum), {
            status: 'occupied',
            guestName, guestPhone: phone,
            currentStayId: stayID,
            last_updated: serverTimestamp()
        }, { merge: true });

        // Add to Guests
        await setDoc(doc(db, 'guests', stayID), guestObj);

        await pushNotification('checkin', `Room ${roomNum} checked in — ${guestName}`, 'reception');
        
        showToast(`Room ${roomNum} Check-in Complete!`, 'success');
        document.getElementById('smart-checkin-modal').style.display = 'none';
    } catch (e) {
        console.error(e);
        showToast('Check-in failed', 'error');
    }
}

async function submitReservation() {
    const roomNum = document.getElementById('res-room').value.trim();
    const guestName = document.getElementById('res-name').value.trim();
    const arrival = document.getElementById('res-arrival').value;

    if (!roomNum || !guestName) {
        showToast('Required fields missing', 'warning');
        return;
    }

    try {
        await setDoc(doc(db, 'rooms', roomNum), {
            status: 'reserved',
            resGuestName: guestName,
            arrivalDate: arrival
        }, { merge: true });

        showToast(`Room ${roomNum} Reserved`, 'success');
        document.getElementById('reserve-modal').style.display = 'none';
    } catch (e) {
        showToast('Reservation failed', 'error');
    }
}

//  Firebase Helpers 

async function pushTableToCloud(tableObj) {
    try {
        const ref = doc(db, 'tables', String(tableObj.id));
        await setDoc(ref, { ...tableObj, last_updated: serverTimestamp() });
    } catch (e) { console.warn('[Table] Cloud push failed', e); }
}

async function pushNotification(type, message, target, data = null) {
    try {
        await addDoc(collection(db, 'notifications'), {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
            type, message, target,
            timestamp: Date.now(),
            status: 'new',
            data
        });
    } catch (e) { console.warn('[Notification] Push failed', e); }
}

async function updateOrderStatus(orderId, status) {
    try {
        const statusMap = {
            'ready': 'Served', 'preparing': 'Kitchen',
            'delivered': 'Delivered', 'completed': 'Delivered'
        };
        const cloudStatus = statusMap[status] || status;
        // Try direct doc update
        try {
            await updateDoc(doc(db, 'orders', String(orderId)), { status: cloudStatus });
            return;
        } catch (e) { }
        // Fallback: query by order_id field
        const q = query(collection(db, 'orders'), where('order_id', '==', String(orderId)));
        const snap = await getDocs(q);
        if (!snap.empty) {
            await Promise.all(snap.docs.map(d => updateDoc(d.ref, { status: cloudStatus })));
        }
    } catch (e) { console.error('[Status] Update failed', e); }
}

//  Real-time Listeners 

function startListeners() {
    // Tables — real-time from Firestore
    onSnapshot(collection(db, 'tables'), snap => {
        snap.forEach(d => { tables[d.id] = d.data(); });
        renderRestDesk();
    });

    // Orders — KDS sync (desk sees all orders)
    onSnapshot(collection(db, 'orders'), snap => {
        const orders = [];
        snap.forEach(d => {
            const data = d.data();
            orders.push({ ...data, id: data.order_id || d.id });
        });
        kitchenOrders = orders;
        renderRestDesk(); // Update pickup list and table totals
    });

    // Notifications — real-time sidebar
    const notifQ = query(collection(db, 'notifications'), orderBy('timestamp', 'desc'), limit(30));
    onSnapshot(notifQ, snap => {
        notifications = [];
        snap.forEach(d => notifications.push({ id: d.id, ...d.data() }));
        renderNotificationSidebar();
    });

    // Availability
    onSnapshot(doc(db, 'settings', 'availability'), snap => {
        if (snap.exists() && snap.data().unavailableItems) {
            unavailableItems = snap.data().unavailableItems;
            renderAvailabilityTool();
        }
    });

    // Menu items — Merge Sync (Safety First)
    onSnapshot(collection(db, 'menuItems'), async snap => {
        if (!snap.empty) {
            const cloudItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Core Merge Logic: Master Fallback is the Ground Truth for Structure
            const updatedMenu = JSON.parse(JSON.stringify(SHARED_MENU)).map(baseItem => {
                const cloudItem = cloudItems.find(c => String(c.id) === String(baseItem.id));
                if (!cloudItem) return baseItem;

                // Merge only valid properties — preserve structural keys (name, category)
                return {
                    ...baseItem,
                    price: cloudItem.price || cloudItem.PriceFull || cloudItem.Price || baseItem.price,
                    priceHalf: cloudItem.priceHalf || cloudItem.PriceHalf || baseItem.priceHalf,
                    imageUrl: cloudItem.imageUrl || cloudItem.ImageURL || cloudItem.image || baseItem.imageUrl,
                    isAvailable: cloudItem.isAvailable !== false
                };
            });

            menu = updatedMenu;
            renderAvailabilityTool();
            if (document.getElementById('pickup-modal')?.style.display === 'flex') {
                renderPickupMenu(document.getElementById('pickup-menu-search')?.value || '');
            }
        }
    });
}

//  Init 

async function init() {
    startClock();

    // Auth Check — note: this is a plain function, not a class method,
    // so we directly call the data/listener functions.
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            await loadInitialData();
            startListeners();
            showToast('Desk connected to Cloud ️', 'success');
        }
    });
}

async function loadInitialData() {
    // Tables
    const tablesSnap = await getDocs(collection(db, 'tables'));
    tablesSnap.forEach(d => { tables[d.id] = d.data(); });

    // Menu — Hands off! Listeners will handle merging into SHARED_MENU base.
    // revenue...


    // Revenue (from ledger sum or localStorage fallback)
    restaurantRevenue = parseFloat(localStorage.getItem('yukt_rest_rev') || '0');
    pickupCounter = parseInt(localStorage.getItem('br_pickup_counter') || '0');
    activePickups = JSON.parse(localStorage.getItem('yukt_active_pickups') || '[]');

    // Orders
    const ordersSnap = await getDocs(collection(db, 'orders'));
    ordersSnap.forEach(d => {
        const data = d.data();
        kitchenOrders.push({ ...data, id: data.order_id || d.id });
    });

    // Notifications
    try {
        const notifSnap = await getDocs(query(collection(db, 'notifications'), orderBy('timestamp', 'desc'), limit(30)));
        notifSnap.forEach(d => notifications.push({ id: d.id, ...d.data() }));
    } catch (e) { }

    // Availability
    try {
        const avail = await getDoc(doc(db, 'settings', 'availability'));
        if (avail.exists()) unavailableItems = avail.data().unavailableItems || [];
    } catch (e) { }

    renderRestDesk();
    renderNotificationSidebar();
    renderAvailabilityTool();
}

function getDefaultMenu() {
    return [
        { id: 'm1-basmat', name: 'Basmati Rice', category: 'Main Course', price: 80, priceHalf: 50, description: 'Premium long grain steamed rice', imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm2-bhunak', name: 'Bhuna Khichuri', category: 'Main Course', price: 180, priceHalf: 100, description: 'Ghee-laden yellow lentil rice', imageUrl: 'https://images.unsplash.com/photo-1645177639578-56e89d924bb1?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm3-luchi', name: 'Luchi (4 pcs)', category: 'Starters', price: 60, priceHalf: 0, description: 'Deep-fried puffed bread', imageUrl: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400', portionType: 'Quantity', isAvailable: true },
        { id: 'm4-chola', name: 'Cholar Dal', category: 'Main Course', price: 90, priceHalf: 0, description: 'Bengal gram dal with coconut', imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm5-begun', name: 'Begun Bhaja', category: 'Starters', price: 40, priceHalf: 0, description: 'Fried eggplant slices', imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400', portionType: 'Quantity', isAvailable: true },
        { id: 'm6-aloop', name: 'Aloo Posto', category: 'Main Course', price: 150, priceHalf: 80, description: 'Potatoes in poppy seed paste', imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm7-shukto', name: 'Shukto', category: 'Main Course', price: 120, priceHalf: 70, description: 'Traditional bitter-sweet mixed veg', imageUrl: 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm8-mocha', name: 'Mochar Ghonto', category: 'Main Course', price: 160, priceHalf: 0, description: 'Banana flower dry curry', imageUrl: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm9-dhoka', name: 'Dhokar Dalna', category: 'Main Course', price: 140, priceHalf: 80, description: 'Lentil cakes in spicy gravy', imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm10-chick', name: 'Chicken Kosha', category: 'Main Course', price: 280, priceHalf: 160, description: 'Slow-cooked spicy chicken', imageUrl: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm11-mutt', name: 'Mutton Kosha', category: 'Main Course', price: 450, priceHalf: 250, description: 'Traditional spicy mutton curry', imageUrl: 'https://images.unsplash.com/photo-1545247181-516773cae754?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm12-ilish', name: 'Ilish Bhapa', category: 'Main Course', price: 450, priceHalf: 0, description: 'Hilsa steamed in mustard paste', imageUrl: 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm13-ruim', name: 'Rui Macher Jhol', category: 'Main Course', price: 180, priceHalf: 0, description: 'Rohu fish in light cumin gravy', imageUrl: 'https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm14-pabda', name: 'Pabda Jhal', category: 'Main Course', price: 250, priceHalf: 0, description: 'Pabda fish in spicy mustard', imageUrl: 'https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm15-ching', name: 'Chingri Malaikari', category: 'Main Course', price: 380, priceHalf: 0, description: 'Prawns in coconut milk gravy', imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm16-bhet', name: 'Bhetki Paturi', category: 'Main Course', price: 320, priceHalf: 0, description: 'Fish steamed in banana leaf', imageUrl: 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm17-sorsh', name: 'Sorshe Ilish', category: 'Main Course', price: 480, priceHalf: 0, description: 'Hilsa in pungent mustard gravy', imageUrl: 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm18-katla', name: 'Katla Kalia', category: 'Main Course', price: 220, priceHalf: 0, description: 'Rich Katla fish gravy', imageUrl: 'https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm19-pomf', name: 'Pomfret Masala', category: 'Main Course', price: 300, priceHalf: 0, description: 'Whole fried pomfret masala', imageUrl: 'https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm20-chikb', name: 'Chicken Biryani', category: 'Main Course', price: 320, priceHalf: 180, description: 'Kolkata style with potato', imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm21-mutb', name: 'Mutton Biryani', category: 'Main Course', price: 420, priceHalf: 220, description: 'Rich aromatic mutton rice', imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm22-fishf', name: 'Fish Finger (6pcs)', category: 'Starters', price: 220, priceHalf: 0, description: 'Crispy breaded fish strips', imageUrl: 'https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=400', portionType: 'Quantity', isAvailable: true },
        { id: 'm23-chikc', name: 'Chicken Cutlet', category: 'Starters', price: 150, priceHalf: 0, description: 'Minced chicken deep fried', imageUrl: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400', portionType: 'Quantity', isAvailable: true },
        { id: 'm24-vegc', name: 'Veg Chop (2pcs)', category: 'Starters', price: 40, priceHalf: 0, description: 'Beetroot and peanut croquettes', imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400', portionType: 'Quantity', isAvailable: true },
        { id: 'm25-alood', name: 'Aloo Dum', category: 'Main Course', price: 110, priceHalf: 60, description: 'Spicy baby potato curry', imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm26-chann', name: 'Channar Dalna', category: 'Main Course', price: 180, priceHalf: 100, description: 'Cottage cheese balls in gravy', imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm27-murig', name: 'Muri Ghonto', category: 'Main Course', price: 200, priceHalf: 0, description: 'Fish head cooked with rice', imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm28-lauch', name: 'Lau Chingri', category: 'Main Course', price: 190, priceHalf: 0, description: 'Bottle gourd with small prawns', imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm29-papad', name: 'Papad Bhaja', category: 'Starters', price: 15, priceHalf: 0, description: 'Crispy fried papadum', imageUrl: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400', portionType: 'Quantity', isAvailable: true },
        { id: 'm30-tomat', name: 'Tomato Chutney', category: 'Starters', price: 40, priceHalf: 0, description: 'Sweet and tangy tomato relish', imageUrl: 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=400', portionType: 'Quantity', isAvailable: true },
        { id: 'm31-mishti', name: 'Mishti Doi', category: 'Dessert', price: 60, priceHalf: 0, description: 'Sweet fermented yogurt', imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm32-roso', name: 'Rosogolla (2pcs)', category: 'Dessert', price: 40, priceHalf: 0, description: 'Sponge syrupy balls', imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400', portionType: 'Quantity', isAvailable: true },
        { id: 'm33-gulab', name: 'Gulab Jamun (2pcs)', category: 'Dessert', price: 50, priceHalf: 0, description: 'Fried milk solid balls', imageUrl: 'https://images.unsplash.com/photo-1620660998677-f5a6c07db9bb?w=400', portionType: 'Quantity', isAvailable: true },
        { id: 'm34-payesh', name: 'Payesh', category: 'Dessert', price: 100, priceHalf: 0, description: 'Rice pudding with jaggery', imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400', portionType: 'Quantity', isAvailable: true },
        { id: 'm35-sand', name: 'Sandesh (2pcs)', category: 'Dessert', price: 60, priceHalf: 0, description: 'Traditional dry milk sweet', imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400', portionType: 'Quantity', isAvailable: true },
        { id: 'm36-mw1l', name: 'Mineral Water 1L', category: 'Drinks', price: 20, priceHalf: 0, description: 'Chilled Bisleri', imageUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400', portionType: 'Bottle', isAvailable: true },
        { id: 'm37-mw500', name: 'Mineral Water 500ml', category: 'Drinks', price: 10, priceHalf: 0, description: 'Travel size water', imageUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400', portionType: 'Bottle', isAvailable: true },
        { id: 'm38-milkt', name: 'Milk Tea', category: 'Drinks', price: 25, priceHalf: 0, description: 'Strong Assam CTC Tea', imageUrl: 'https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?w=400', portionType: 'Cup', isAvailable: true },
        { id: 'm39-blkt', name: 'Black Tea', category: 'Drinks', price: 15, priceHalf: 0, description: 'Lemon and ginger tea', imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400', portionType: 'Cup', isAvailable: true },
        { id: 'm40-coffee', name: 'Coffee', category: 'Drinks', price: 40, priceHalf: 0, description: 'Instant milk coffee', imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400', portionType: 'Cup', isAvailable: true },
        { id: 'm41-lassi', name: 'Sweet Lassi', category: 'Drinks', price: 80, priceHalf: 0, description: 'Thick yogurt drink', imageUrl: 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=400', portionType: 'Cup', isAvailable: true },
        { id: 'm42-limsod', name: 'Fresh Lime Soda', category: 'Drinks', price: 60, priceHalf: 0, description: 'Sweet or Salted', imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400', portionType: 'Cup', isAvailable: true },
        { id: 'm43-cola', name: 'Coca Cola 500ml', category: 'Drinks', price: 45, priceHalf: 0, description: 'Pet bottle chilled', imageUrl: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400', portionType: 'Bottle', isAvailable: true },
        { id: 'm44-sprite', name: 'Sprite 500ml', category: 'Drinks', price: 45, priceHalf: 0, description: 'Pet bottle chilled', imageUrl: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400', portionType: 'Bottle', isAvailable: true },
        { id: 'm45-eggc', name: 'Egg Curry (2pcs)', category: 'Main Course', price: 120, priceHalf: 0, description: 'Boiled eggs in spicy gravy', imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm46-dakb', name: 'Chicken Dak Bunglow', category: 'Main Course', price: 300, priceHalf: 180, description: 'Heritage chicken curry with egg', imageUrl: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm47-posto', name: 'Posto Bora (4pcs)', category: 'Starters', price: 120, priceHalf: 0, description: 'Poppy seed fried fritters', imageUrl: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400', portionType: 'Quantity', isAvailable: true },
        { id: 'm48-dachr', name: 'Macher Matha Diye Dal', category: 'Main Course', price: 130, priceHalf: 0, description: 'Roasted Moong dal with fish head', imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm49-kanka', name: 'Kancha Lanka Murgi', category: 'Main Course', price: 290, priceHalf: 160, description: 'Green chili chicken (spicy)', imageUrl: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400', portionType: 'Plate', isAvailable: true },
        { id: 'm50-bhetf', name: 'Bhetki Fry', category: 'Starters', price: 180, priceHalf: 0, description: 'Pure Bhetki fillet fry', imageUrl: 'https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=400', portionType: 'Quantity', isAvailable: true }
    ];
}

//  Clock 

function startClock() {
    const update = () => {
        const now = new Date();
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let h = now.getHours(); const ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
        const mm = String(now.getMinutes()).padStart(2, '0'), ss = String(now.getSeconds()).padStart(2, '0');
        const el = document.getElementById('clock');
        if (el) el.textContent = `${days[now.getDay()]}, ${String(now.getDate()).padStart(2, '0')} ${months[now.getMonth()]} | ${h}:${mm}:${ss} ${ampm}`;
    };
    update(); setInterval(update, 1000);
}

function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:5rem;right:1.5rem;padding:0.75rem 1.25rem;border-radius:8px;font-weight:600;font-size:0.9rem;z-index:99999;';
    t.style.background = type === 'success' ? '#4ADE80' : type === 'error' ? '#EF4444' : '#E5C366';
    t.style.color = '#050B1A';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function timeOnlyIST(ts) {
    return new Date(ts).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, hour: '2-digit', minute: '2-digit' });
}

//  Render Restaurant Desk 

function renderRestDesk() {
    const grid = document.getElementById('rest-desk-table-grid');
    if (!grid) return;
    grid.innerHTML = '';
    let totalPax = 0, activeTables = 0;
    const orderColors = { 1: '#FF3131', 2: '#39FF14', 3: '#1F51FF', 4: '#FFF01F', 5: '#A020F0' };

    Object.values(tables).sort((a, b) => String(a.id).localeCompare(String(b.id))).forEach(table => {
        if (table.status === 'occupied') {
            activeTables++; totalPax += table.pax || 0;
            const chars = table.chairs || [];
            const ab = table.activeBills || [];
            let guestDivs = '';
            if (ab.length > 0) {
                ab.forEach(b => {
                    const c = orderColors[b.colorIndex] || '#D4AF37';
                    // Get live total from kitchenOrders + table.orders
                    const billOrders = (table.orders || []).filter(o => o.id === b.billID || o.order_id === b.billID);
                    const billTotal = billOrders.reduce((s, o) => s + (o.total || o.total_price || 0), 0);
                    const linkedTag = b.colorIndex === 5 ? ` ${b.linkGroupId || 'L'}:` : '';
                    guestDivs += `<div onclick="event.stopPropagation();window.deskApp.selectDeskCheckout('${table.id}','${b.billID}')"
                        style="color:${c};font-weight:bold;margin-bottom:0.3rem;cursor:pointer;padding:0.2rem;border-radius:4px;border:1px solid ${b.colorIndex === 5 ? '#A020F0' : 'transparent'};">
                        ${linkedTag} ${b.billID} | ${b.guestName} <span style="color:#4ADE80;">₹${billTotal}</span></div>`;
                });
            } else {
                guestDivs = `<div onclick="event.stopPropagation();window.deskApp.selectDeskCheckout('${table.id}')" style="cursor:pointer;">${table.guestName || 'Occupied'}</div>`;
            }
            const cHtml = chars.map((c, i) => {
                let fs = '', ft = '';
                if (c.status === 'occupied') {
                    let gc = '#D4AF37';
                    if (ab.length > 0) {
                        let acc = 0, sel = null;
                        for (let b of ab) { acc += (b.pax || 1); if (i < acc) { sel = b; break; } }
                        if (sel) gc = orderColors[sel.colorIndex] || '#D4AF37';
                    }
                    fs = `fill:${gc};`; ft = `filter:drop-shadow(0 0 10px ${gc});`;
                    return `<div class="chair-circle occupied"><svg viewBox="0 0 24 24" class="person-icon" style="${ft}"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" style="${fs}"/></svg></div>`;
                }
                return `<div class="chair-circle"><svg viewBox="0 0 24 24" class="person-icon"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div>`;
            });
            const card = document.createElement('div');
            card.className = 'room-card active';
            card.onclick = () => selectDeskCheckout(table.id);
            const isLinked = ab.some(b => b.colorIndex === 5);
            if (isLinked) { card.style.borderColor = '#A020F0'; card.style.boxShadow = '0 0 15px rgba(160,32,240,0.4)'; }
            card.innerHTML = `
                <div class="room-header">
                    <span class="room-number">${table.id}</span>
                    <span class="room-status status-occupied" style="border-color:#F59E0B;color:#F59E0B;background:rgba(245,158,11,0.1);">Live Active</span>
                </div>
                <div class="room-guest border-bottom pb-2 mb-2" style="display:flex;flex-direction:column;">${guestDivs}</div>
                <div class="restaurant-table-view"><div class="table-layout-wrapper">
                    <div class="chair-row">${cHtml[0] || ''}${cHtml[1] || ''}</div>
                    <div class="table-engine-box" style="border-color:#F59E0B;">${table.id}</div>
                    <div class="chair-row">${cHtml[2] || ''}${cHtml[3] || ''}</div>
                </div></div>
                <div class="text-sm mt-3 text-center text-gray">${table.pax || 0} / 4 Seats Occupied</div>
                <div class="text-xl font-bold mt-2 text-center color-primary">₹${table.total || 0}</div>`;
            grid.appendChild(card);
        } else {
            const chars = table.chairs || [];
            const cHtml = chars.map(() => `<div class="chair-circle"><svg viewBox="0 0 24 24" class="person-icon"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div>`);
            const card = document.createElement('div');
            card.className = 'room-card';
            card.innerHTML = `
                <div class="room-header">
                    <span class="room-number text-gray">${table.id}</span>
                    <span class="room-status status-available">Available</span>
                </div>
                <div class="restaurant-table-view" style="opacity:0.5;"><div class="table-layout-wrapper">
                    <div class="chair-row">${cHtml[0] || ''}${cHtml[1] || ''}</div>
                    <div class="table-engine-box" style="border-color:var(--color-slate-700);color:var(--color-slate-400);">${table.id}</div>
                    <div class="chair-row">${cHtml[2] || ''}${cHtml[3] || ''}</div>
                </div></div>
                <div class="text-sm mt-3 text-center text-gray">0 / 4 Seats Occupied</div>`;
            grid.appendChild(card);
        }
    });

    const paxEl = document.getElementById('rest-desk-pax');
    const tabEl = document.getElementById('rest-desk-active-tables');
    if (paxEl) paxEl.textContent = totalPax;
    if (tabEl) tabEl.textContent = activeTables;

    // Trigger pickup sync
    renderPickupList();
    updateRevDisplay();
}

//  Checkout 

function selectDeskCheckout(tableId, billId = null) {
    const table = tables[tableId]; if (!table || table.status !== 'occupied') return;
    const ab = table.activeBills || [];
    let billsHtml = '';

    if (ab.length > 1) {
        billsHtml += `<div style="padding:0.5rem;background:rgba(160,32,240,0.1);color:#d4a0f7;border-radius:8px;margin-bottom:1rem;font-size:0.8rem;text-align:center;">
            This table has multiple linked bills. You can checkout each separately.
        </div>`;
    }

    ab.forEach(b => {
        const id = b.billID;
        const orders = (table.orders || []).filter(o => o.id === id || o.order_id === id);
        const total = orders.reduce((s, o) => s + (o.total || o.total_price || 0), 0);

        const isPaid = b.status === 'paid' || b.paid;

        billsHtml += `
            <div style="margin-bottom:1.5rem; border:1px solid ${isPaid ? '#10B981' : 'var(--glass-border)'}; border-radius:12px; padding:1.2rem; background:rgba(0,0,0,0.2);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem;">
                    <div>
                        <div style="font-weight:900; color:var(--gold-primary); font-size:1rem;">BILL ${id}</div>
                        <div style="font-size:0.8rem; color:var(--text-gray);">${b.guestName || 'Walk-in'} — ${b.pax || 1} PAX</div>
                    </div>
                    ${isPaid ?
                `<span style="color:#10B981; font-weight:800; font-size:0.8rem;">PAID </span>` :
                `<button class="btn btn-primary" style="padding:0.4rem 0.8rem; font-size:0.75rem; background:#10B981; border:none;" 
                            onclick="window.deskApp.checkoutBill('${tableId}', '${id}', ${total})">CHECKOUT</button>`
            }
                </div>
                <div style="font-size:0.85rem; border-top:1px dashed var(--glass-border); padding-top:0.8rem;">
                    ${orders.length > 0 ?
                orders.map(o => (o.items || []).map(i => `<div style="display:flex; justify-content:space-between; margin-bottom:0.2rem;">
                            <span class="text-gray">${i.qty}x ${i.name}</span>
                            <span>₹${i.qty * i.price}</span>
                        </div>`).join('')).join('') :
                '<div class="text-gray italic">No items found</div>'
            }
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:1rem; font-weight:bold; font-size:1.1rem; border-top:1px solid var(--glass-border); padding-top:0.8rem;">
                    <span>Subtotal</span>
                    <span style="color:#4ADE80;">₹${total}</span>
                </div>
            </div>`;
    });

    const grandTotal = (table.orders || []).reduce((s, o) => s + (o.total || o.total_price || 0), 0);
    const allPaid = ab.length > 0 && ab.every(b => b.status === 'paid' || b.paid);

    billsHtml += `
        <div style="margin-top:2rem; padding:1.5rem; background:var(--glass-bg); border-radius:12px; border:2px solid var(--gold-primary);">
            <div style="display:flex; justify-content:space-between; font-weight:900; font-size:1.3rem; margin-bottom:1.5rem;">
                <span>TABLE TOTAL</span>
                <span style="color:var(--gold-primary);">₹${grandTotal}</span>
            </div>
            ${allPaid ?
            `<button class="btn btn-primary btn-block" style="padding:1rem; font-size:1.1rem;" onclick="window.deskApp.printAndCloseTable('${tableId}', ${grandTotal})">CLOSE TABLE & SYNC</button>` :
            `<div style="font-size:0.8rem; color:#f43f5e; text-align:center;">All bills must be checked out to close table</div>`
        }
        </div>`;

    document.getElementById('checkout-modal-content').innerHTML = billsHtml;
    document.getElementById('checkout-modal-title').innerText = `TABLE ${tableId} — DASHBOARD`;

    // Store for closing action
    const modal = document.getElementById('checkout-modal');
    modal.dataset.tableId = tableId;
    modal.dataset.grandTotal = grandTotal;
    modal.style.display = 'flex';
}

async function checkoutBill(tableId, billId, amount) {
    const table = tables[tableId]; if (!table) return;
    const bill = (table.activeBills || []).find(b => b.billID === billId);
    if (!bill) return;

    bill.status = 'paid';
    bill.paid = true;
    restaurantRevenue += amount;
    localStorage.setItem('yukt_rest_rev', restaurantRevenue);

    try {
        await setDoc(doc(db, 'tables', tableId), table, { merge: true });
        await addDoc(collection(db, 'ledger'), {
            tableId, billId, amount,
            guestName: bill.guestName || 'Guest',
            closedAt: serverTimestamp(),
            logType: 'BILL_CHECKOUT'
        });
        showToast(`Bill ${billId} checked out`, 'success');
        selectDeskCheckout(tableId);
    } catch (e) {
        showToast('Checkout failed', 'error');
    }
}

async function printAndCloseTable() {
    const modal = document.getElementById('checkout-modal');
    const tableId = modal.dataset.tableId;
    const grandTotal = parseFloat(modal.dataset.grandTotal) || 0;
    const table = tables[tableId]; if (!table) return;

    restaurantRevenue += grandTotal;
    localStorage.setItem('yukt_rest_rev', restaurantRevenue);

    // Save to Firestore ledger
    try {
        await addDoc(collection(db, 'ledger'), {
            tableId, grandTotal,
            orders: table.orders || [],
            closedAt: serverTimestamp(),
            logType: 'TABLE_CHECKOUT'
        });
    } catch (e) { }

    // Reset table
    table.status = 'available'; table.guestName = null; table.pax = 0;
    table.activeBills = []; table.orders = []; table.total = 0;
    (table.chairs || []).forEach(c => c.status = 'available');
    await pushTableToCloud(table);
    await pushNotification('checkout', `Table ${tableId} closed — ₹${grandTotal} received`, 'desk');

    modal.style.display = 'none';
    updateRevDisplay();
    printBill(tableId, grandTotal);
    showToast(`Table ${tableId} closed.`, 'success');
}

function printBill(tableId, total) {
    const pa = document.getElementById('print-area');
    pa.innerHTML = `<div class="invoice-copy" style="font-family:monospace;font-size:1.1rem;">
        <div style="text-align:center;font-weight:bold;font-size:1.5rem;border-bottom:2px solid black;padding-bottom:1rem;margin-bottom:1rem;">BARAK RESIDENCY</div>
        <div style="margin-bottom:1rem;"><strong>Table:</strong> ${tableId}<br>
        <strong>Date:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
        <div style="font-size:1.3rem;font-weight:bold;border-top:2px solid black;padding-top:1rem;margin-top:1rem;">Grand Total: ₹${total}</div>
        <div style="text-align:center;margin-top:1rem;font-size:0.9rem;">Thank you for dining with us!</div>
    </div>`;
    window.print();
}

//  Pickup Orders 

async function generatePickupOrder() {
    pickupCart = [];
    renderPickupCart();
    renderPickupMenu('');
    document.getElementById('pickup-modal').style.display = 'flex';
}

function renderPickupMenu(search = '') {
    const grid = document.getElementById('pickup-menu-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const filtered = menu.filter(i => {
        const name = (i.name || i.Name || '').toLowerCase();
        const cat = (i.category || i.Category || '').toLowerCase();
        const s = search.toLowerCase();
        return (name.includes(s) || cat.includes(s)) && (i.isAvailable !== false && !unavailableItems.includes(i.id));
    });

    filtered.forEach(item => {
        const el = document.createElement('div');
        el.className = 'waiter-menu-card'; // Reuse waiter card styles
        el.style.cssText = 'background:rgba(255,255,255,0.05); border:1px solid var(--glass-border); border-radius:12px; padding:1rem; cursor:pointer; text-align:center;';

        const name = item.name || item.Name || item.itemName || 'Item';
        const price = item.price || item.PriceFull || item.Price || item.priceFull || 0;
        const img = item.imageUrl || item.ImageURL || item.image || 'br.png';

        el.innerHTML = `
            <img src="${img}" onerror="this.src='br.png'" style="width:100%; height:80px; object-fit:cover; border-radius:8px; margin-bottom:0.5rem;">
            <div style="font-weight:bold; font-size:0.9rem; margin-bottom:0.3rem; height:2.4rem; overflow:hidden;">${name}</div>
            <div style="color:var(--gold-primary); font-weight:800;">₹${price}</div>
        `;
        el.onclick = () => window.deskApp.promptPickupItem(item);
        grid.appendChild(el);
    });
}

function filterPickupMenu(val) {
    renderPickupMenu(val);
}

function addVariantToPickupCart(item) {
    promptPickupItem(item);
}

let pendingPickupItem = null;
let pendingPickupVariant = null;
let pendingPickupQty = 1;

function promptPickupItem(item) {
    pendingPickupItem = item;
    const modal = document.getElementById('pickup-item-modal');
    const container = document.getElementById('pim-options-container');
    const name = item.name || item.itemName || 'Item';
    const price = item.price || 0;

    document.getElementById('pim-item-name').innerText = name;
    container.innerHTML = '';

    const type = item.portionType || 'Plate';

    if (type === 'Plate' || type === 'Portion') {
        const priceHalf = item.priceHalf || 0;
        const options = [{ label: 'Full Plate', val: 'Full', price: price }];
        if (priceHalf > 0) options.push({ label: 'Half Plate', val: 'Half', price: priceHalf });

        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-outline';
            btn.style.width = '100%';
            btn.innerHTML = `<span>${opt.label}</span> <span style="margin-left:auto; font-weight:bold;">₹${opt.price}</span>`;
            btn.onclick = () => promptPickupQuantity(opt.val, opt.label, opt.price);
            container.appendChild(btn);
        });
    } else {
        promptPickupQuantity('Regular', 'Standard', price);
    }
    modal.style.display = 'flex';
}

function promptPickupQuantity(variant, label, price) {
    pendingPickupVariant = { variant, label, price };
    pendingPickupQty = 1;

    const modal = document.getElementById('pickup-item-modal');
    const container = document.getElementById('pim-options-container');
    const name = pendingPickupItem.name || 'Item';

    document.getElementById('pim-item-name').innerText = `${name} (${label})`;
    container.innerHTML = `
        <div style="display:flex;align-items:center;gap:1.5rem;justify-content:center;background:rgba(0,0,0,0.3);border-radius:12px;padding:1.5rem;margin:1rem 0;">
            <button class="btn btn-outline" style="width:45px;height:45px;border-radius:50%;padding:0;font-size:1.5rem;" onclick="window.deskApp.updatePickupQty(-1)">-</button>
            <div id="pim-qty-val" style="font-size:2.5rem;font-weight:900;color:white;width:60px;text-align:center;">1</div>
            <button class="btn btn-outline" style="width:45px;height:45px;border-radius:50%;padding:0;font-size:1.5rem;" onclick="window.deskApp.updatePickupQty(1)">+</button>
        </div>
        <button class="btn btn-primary" style="width:100%;padding:1.2rem;font-size:1.1rem;" onclick="window.deskApp.executeAddPickupToCart()">ADD TO CART — ₹${price}</button>
    `;
}

function updatePickupQty(delta) {
    pendingPickupQty = Math.max(1, pendingPickupQty + delta);
    document.getElementById('pim-qty-val').innerText = pendingPickupQty;
    const price = pendingPickupVariant.price * pendingPickupQty;
    const btn = document.querySelector('#pim-options-container button.btn-primary');
    if (btn) btn.innerText = `ADD TO CART — ₹${price}`;
}

function executeAddPickupToCart() {
    addToPickupCart(pendingPickupItem, pendingPickupVariant.variant, pendingPickupVariant.label, pendingPickupVariant.price, pendingPickupQty);
    document.getElementById('pickup-item-modal').style.display = 'none';
    renderPickupCart(); // Mission: Ensure cart UI refreshes
}


function addToPickupCart(item, variant, label, price, qty) {
    const id = `${item.id}_${variant}`;
    const existing = pickupCart.find(i => i.id === id);
    if (existing) {
        existing.qty += qty;
    } else {
        const name = item.name || item.Name || item.itemName || 'Item';
        pickupCart.push({
            id: id,
            itemId: item.id,
            name: name,
            variant: variant,
            label: label,
            price: price,
            qty: qty
        });
    }
    renderPickupCart();
}

function removeFromPickupCart(idx) {
    pickupCart.splice(idx, 1);
    renderPickupCart();
}

function renderPickupCart() {
    const container = document.getElementById('pickup-cart-items');
    const totalEl = document.getElementById('pickup-cart-total');
    if (!container) return;

    container.innerHTML = '';
    let total = 0;

    pickupCart.forEach((item, idx) => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;

        const row = document.createElement('div');
        row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem; background:rgba(255,255,255,0.03); padding:0.6rem; border-radius:8px;';
        row.innerHTML = `
            <div style="flex:1;">
                <div style="font-weight:bold; font-size:0.85rem;">${item.name} (${item.label})</div>
                <div style="font-size:0.75rem; color:var(--color-slate-400);">${item.qty} x ₹${item.price}</div>
            </div>
            <div style="font-weight:bold; margin-right:1rem;">₹${itemTotal}</div>
            <button onclick="window.deskApp.removeFromPickupCart(${idx})" style="background:transparent; border:none; color:#F43F5E; cursor:pointer; font-size:1.2rem;">&times;</button>
        `;
        container.appendChild(row);
    });

    totalEl.innerText = total.toLocaleString();
}

async function submitPickupOrder() {
    if (pickupCart.length === 0) { showToast('Cart is empty', 'warning'); return; }

    pickupCounter++;
    localStorage.setItem('br_pickup_counter', pickupCounter);
    const pid = `P${pickupCounter}`;
    const total = pickupCart.reduce((s, i) => s + (i.price * i.qty), 0);

    const orderObj = {
        order_id: pid,
        id: pid,
        items: pickupCart,
        total_price: total,
        total: total,
        status: 'preparing',
        orderType: 'Pickup',
        timestamp: Date.now(),
        paymentStatus: 'pending'
    };

    try {
        await setDoc(doc(db, 'orders', pid), orderObj);

        // Also update the desk UI's activePickups
        activePickups.push(orderObj);
        localStorage.setItem('yukt_active_pickups', JSON.stringify(activePickups));

        await pushNotification('order', `New Pickup Order ${pid} — ₹${total}`, 'desk', { 
            orderId: pid, 
            type: 'pickup' 
        });

        document.getElementById('pickup-modal').style.display = 'none';
        renderPickupList();
        showToast(`Pickup Order ${pid} placed!`, 'success');
    } catch (e) {
        console.error('Pickup failed', e);
        showToast('Failed to place pickup order', 'error');
    }
}

function renderPickupList() {
    const container = document.getElementById('rest-desk-pickup-list');
    if (!container) return;
    
    // Global filter: Show all active pickups from the cloud (shared state)
    const cloudPickups = kitchenOrders.filter(o => o.orderType === 'Pickup' && o.status !== 'archived');
    
    if (cloudPickups.length === 0) {
        container.innerHTML = `<div class="text-center text-gray" style="padding:1rem; background:rgba(255,255,255,0.02); border-radius:8px;">No active pickups</div>`;
        return;
    }
    
    container.innerHTML = '';
    cloudPickups.forEach(p => {
        const isPaid = p.paymentStatus === 'paid';
        const isReady = p.status === 'ready';
        const row = document.createElement('div');
        row.style.cssText = `display:flex;justify-content:space-between;align-items:center;padding:0.8rem 1rem;background:rgba(255,255,255,0.05);border-radius:12px;border-left:4px solid ${isPaid ? '#39FF14' : (isReady ? '#FFF01F' : '#A020F0')};margin-bottom:0.6rem; transition: transform 0.2s;`;
        row.innerHTML = `
            <div style="flex:1;">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="font-weight:900; color:${isPaid ? '#39FF14' : (isReady ? '#FFF01F' : '#A020F0')}; font-size:1.1rem;">#${p.id}</span>
                    ${isReady ? '<span class="badge-ready" style="background:#FFF01F; color:black; font-size:0.6rem; padding:1px 4px; border-radius:3px; font-weight:800;">READY</span>' : ''}
                </div>
                <div style="font-size:0.8rem; color:white;">${p.items?.length || 0} Items${isPaid ? ' [PAID]' : ''}</div>
                <div class="text-gray" style="font-size:0.7rem;">${timeOnlyIST(p.timestamp)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:0.75rem;">
                <div style="text-align:right; margin-right:0.5rem;">
                    <div style="font-weight:900; color:#4ADE80; font-size:1rem;">₹${p.total_price || p.total || 0}</div>
                </div>
                ${!isPaid ? `<button class="btn btn-success" style="padding:0.4rem 0.8rem; font-size:0.75rem; font-weight:800;" onclick="window.deskApp.markPickupPaid('${p.id}')">PAY</button>` : ''}
                ${isPaid ? `<button class="btn btn-primary" style="padding:0.4rem 0.8rem; font-size:0.75rem; font-weight:800; background:#1F51FF;" onclick="window.deskApp.markPickupDelivered('${p.id}')">DONE</button>` : ''}
            </div>`;
        container.appendChild(row);
    });
}


async function markPickupPaid(id) {
    try {
        await updateDoc(doc(db, 'orders', id), { paymentStatus: 'paid' });
        await pushNotification('payment', `${id} PAYMENT RECEIVED`, 'desk', { orderId: id });
        showToast(`${id} marked as paid`, 'success');
    } catch (e) { showToast('Sync failed', 'error'); }
}

async function markPickupDelivered(id) {
    try {
        await updateDoc(doc(db, 'orders', id), { status: 'archived' });
        await pushNotification('delivery', `${id} DELIVERED & ARCHIVED`, 'desk', { orderId: id });
        showToast(`${id} archived`, 'success');
    } catch (e) { showToast('Sync failed', 'error'); }
}


//  Notifications Sidebar 

function renderNotificationSidebar() {
    const container = document.getElementById('desk-notifications-list');
    if (!container) return;
    container.innerHTML = '';
    const filtered = notifications
        .filter(n => n.target === 'desk' || n.target === 'both')
        .slice(0, 20);

    if (filtered.length === 0) {
        container.innerHTML = '<div class="text-gray" style="text-align:center;padding:2rem;">No recent notifications</div>';
        return;
    }

    filtered.forEach(n => {
        const isPurple = n.data && n.data.style === 'purple';
        const div = document.createElement('div');
        div.className = `notification-card ${n.status || ''}`;
        if (isPurple) div.style.borderLeft = '4px solid #A020F0';
        const ts = timeOnlyIST(n.timestamp);

        // KOT print button for dine-in and addon orders
        let actionHtml = '';
        if (n.data && (n.data.type === 'dinein' || n.data.type === 'addon' || n.data.type === 'pickup')) {
            const printed = JSON.parse(localStorage.getItem('br_printed_kots') || '{}');
            const isPrinted = printed[n.id];
            actionHtml = `<button class="btn ${isPrinted ? 'btn-outline' : 'btn-primary'} btn-block mt-2"
                style="font-size:0.75rem;padding:0.4rem;${isPrinted ? 'opacity:0.6;' : 'background:#F59E0B;border:none;color:#000;'}"
                onclick="window.deskApp.printKOT('${n.id}','${n.data.orderId}','${n.data.tableId}')">
                ${isPrinted ? 'PRINTED ' : 'PRINT 2 KOT'}</button>`;
        }

        div.innerHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;">
                <span class="note-type ${n.type || ''}" style="${isPurple ? 'background:rgba(160,32,240,0.1);color:#A020F0;' : ''}">${(n.type || '').toUpperCase()}</span>
                <span style="font-size:0.75rem;color:var(--color-slate-400);">${ts}</span>
            </div>
            <div style="font-size:0.9rem;${isPurple ? 'color:#d4a0f7;font-weight:bold;' : ''}">${n.message}</div>
            ${actionHtml}`;
        container.appendChild(div);
    });
}

function printKOT(noteId, orderId, tableId) {
    const pk = JSON.parse(localStorage.getItem('br_printed_kots') || '{}');
    pk[noteId] = true; localStorage.setItem('br_printed_kots', JSON.stringify(pk));
    const table = tables[tableId];
    const order = table && (table.orders || []).find(o => o.id === orderId || o.order_id === orderId);
    const pa = document.getElementById('print-area'); pa.innerHTML = '';
    for (let copy = 1; copy <= 2; copy++) {
        pa.innerHTML += `<div class="invoice-copy" style="font-family:monospace;padding:1rem;border:1px dashed #ccc;margin-bottom:1rem;">
            <div style="text-align:center;font-weight:bold;font-size:1.3rem;text-decoration:underline;">KOT COPY ${copy}</div>
            <div style="margin-top:0.5rem;"><strong>Table:</strong> ${tableId} | <strong>Order:</strong> ${orderId}<br>
            <strong>Time:</strong> ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}</div>
            <div style="margin-top:0.5rem;border-top:1px dashed black;padding-top:0.5rem;">
            ${order ? (order.items || []).map(i => `<div>• ${typeof i === 'object' ? `${i.qty}x ${i.name}` : i}</div>`).join('') : '<div>Items not found</div>'}
            </div></div>`;
    }
    window.print();
    renderNotificationSidebar();
}

async function clearNotifications() {
    // Remove from Firestore
    try {
        const snap = await getDocs(collection(db, 'notifications'));
        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    } catch (e) { }
    notifications = [];
    renderNotificationSidebar();
    showToast('Notifications cleared', 'success');
}

//  Revenue 

function toggleRevVisibility(btn) {
    const display = document.getElementById('desk-revenue-display');
    if (!display) return;
    display.style.display = 'inline-block';
    if (display.classList.contains('revealed')) {
        display.classList.remove('revealed');
        display.style.filter = 'blur(4px)';
        display.textContent = '₹ ****';
    } else {
        display.classList.add('revealed');
        display.style.filter = 'none';
        display.textContent = `₹ ${restaurantRevenue.toLocaleString('en-IN')}`;
    }
}

function updateRevDisplay() {
    const el = document.getElementById('desk-revenue-display');
    if (el && el.classList.contains('revealed')) el.textContent = `₹ ${restaurantRevenue.toLocaleString('en-IN')}`;
}

//  Food Availability 

function openAvailabilityModal() {
    renderAvailabilityTool();
    document.getElementById('availability-modal').style.display = 'flex';
}

function renderAvailabilityTool() {
    const container = document.getElementById('availability-list');
    if (!container) return;
    container.innerHTML = '';
    menu.forEach(item => {
        const isUnavail = unavailableItems.includes(item.id);
        const itemName = item.name || item.itemName || 'Unnamed Item';
        const itemPrice = item.price || 0;
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:1rem;background:rgba(255,255,255,0.03);border-radius:12px;margin-bottom:0.75rem;border:1px solid var(--glass-border);';
        row.innerHTML = `
            <div style="display:flex;align-items:center;gap:1rem;">
                <div style="width:40px;height:40px;background:var(--glass);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;">${item.icon || ''}</div>
                <div>
                    <div style="font-weight:700;color:white;">${itemName}</div>
                    <div style="font-size:0.8rem;color:var(--gold-primary);">₹${itemPrice}</div>
                </div>
            </div>
            <label class="switch">
                <input type="checkbox" ${!isUnavail ? 'checked' : ''} onchange="window.deskApp.toggleItemAvailability('${item.id}',this.checked)">
                <span class="slider"></span>
            </label>`;
        container.appendChild(row);
    });
}

async function toggleItemAvailability(id, available) {
    if (!available && !unavailableItems.includes(id)) unavailableItems.push(id);
    else if (available) unavailableItems = unavailableItems.filter(x => x !== id);
    localStorage.setItem('br_unavailable_items', JSON.stringify(unavailableItems));
    // Push to Firestore so all portals (waiter, guest) see it
    try {
        await setDoc(doc(db, 'settings', 'availability'), { unavailableItems }, { merge: true });
    } catch (e) { console.warn('[Availability] Update failed', e); }
}

async function handleLogout() {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (e) {
        window.location.href = 'index.html';
    }
}

//  Expose to window 
async function submitPickupQuick() {
    if (pickupCart.length === 0) { showToast('Cart is empty', 'warning'); return; }
    await submitPickupOrder();
}

window.deskApp = {
    selectDeskCheckout, checkoutBill, printAndCloseTable, printBill,
    generatePickupOrder, markPickupPaid, markPickupDelivered,
    renderNotificationSidebar, printKOT, clearNotifications,
    toggleRevVisibility, openAvailabilityModal, renderAvailabilityTool,
    toggleItemAvailability, handleLogout,
    filterPickupMenu, removeFromPickupCart, submitPickupOrder,
    addVariantToPickupCart, promptPickupItem, updatePickupQty,
    executeAddPickupToCart, promptPickupQuantity,
    showCheckInForm, openReserveModal, sciNext, captureLivePhoto,
    handleMultiIdUpload, submitCheckIn, submitReservation, verifyPasscode
};

// Legacy onclick compatibility
window.printAndCloseTable = printAndCloseTable;
window.generatePickupOrder = generatePickupOrder;
window.clearNotifications = clearNotifications;
window.toggleRevVisibility = toggleRevVisibility;
window.openAvailabilityModal = openAvailabilityModal;
window.executeAddPickupToCart = executeAddPickupToCart; // Added for pickup modal
window.updatePickupQty = updatePickupQty; // Added for pickup modal

//  Boot 
init().catch(e => console.error('[Desk Boot] Failed:', e));
