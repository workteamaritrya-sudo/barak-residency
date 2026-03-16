/**
 * ════════════════════════════════════════════════════════════
 * BARAK RESIDENCY — Restaurant Desk App
 * Standalone · Firebase Firestore · No localStorage dependency
 * KDS-connected via shared Firestore orders collection
 * ════════════════════════════════════════════════════════════
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import {
    getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc,
    onSnapshot, query, orderBy, limit, updateDoc, deleteDoc,
    serverTimestamp, where, increment, arrayUnion
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// ── Firebase Config ───────────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyANudXFm6QK4jJXKtXtAaDe9hWFDcBF8Vo",
    authDomain: "barak-residency-59405.firebaseapp.com",
    projectId: "barak-residency-59405",
    databaseURL: "https://barak-residency-59405-default-rtdb.firebaseio.com",
    storageBucket: "barak-residency-59405.firebasestorage.app",
    messagingSenderId: "3871550492",
    appId: "1:3871550492:web:2cf49bc0a963b4888f43d9"
};

const firebaseApp = initializeApp(firebaseConfig, 'desk-app');
const db = getFirestore(firebaseApp);

// ── State ─────────────────────────────────────────────────
let tables = {};
let menu = [];
let notifications = [];
let kitchenOrders = [];
let unavailableItems = [];
let restaurantRevenue = 0;
let activePickups = [];
let pickupCounter = 0;

// ── Firebase Helpers ──────────────────────────────────────

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
        } catch (e) {}
        // Fallback: query by order_id field
        const q = query(collection(db, 'orders'), where('order_id', '==', String(orderId)));
        const snap = await getDocs(q);
        if (!snap.empty) {
            await Promise.all(snap.docs.map(d => updateDoc(d.ref, { status: cloudStatus })));
        }
    } catch (e) { console.error('[Status] Update failed', e); }
}

// ── Real-time Listeners ───────────────────────────────────

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

    // Menu items
    onSnapshot(collection(db, 'menuItems'), snap => {
        const newMenu = [];
        snap.forEach(d => newMenu.push({ id: d.id, ...d.data() }));
        if (newMenu.length > 0) menu = newMenu;
        renderAvailabilityTool();
    });
}

// ── Init ──────────────────────────────────────────────────

async function init() {
    startClock();
    await loadInitialData();
    startListeners();
    showToast('Desk connected to Cloud', 'success');
}

async function loadInitialData() {
    // Tables
    const tablesSnap = await getDocs(collection(db, 'tables'));
    tablesSnap.forEach(d => { tables[d.id] = d.data(); });

    // Menu
    const menuSnap = await getDocs(collection(db, 'menuItems'));
    menuSnap.forEach(d => menu.push({ id: d.id, ...d.data() }));
    if (menu.length === 0) menu = getDefaultMenu();

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
    } catch (e) {}

    // Availability
    try {
        const avail = await getDoc(doc(db, 'settings', 'availability'));
        if (avail.exists()) unavailableItems = avail.data().unavailableItems || [];
    } catch (e) {}

    renderRestDesk();
    renderNotificationSidebar();
    renderAvailabilityTool();
}

function getDefaultMenu() {
    return [
            {id:'m1-basmat',name:'Basmati Rice',category:'Main Course',price:80,priceHalf:50,description:'Premium long grain steamed rice',imageUrl:'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400',portionType:'Plate',isAvailable:true},
            {id:'m2-bhunak',name:'Bhuna Khichuri',category:'Main Course',price:180,priceHalf:100,description:'Ghee-laden yellow lentil rice',imageUrl:'https://images.unsplash.com/photo-1645177639578-56e89d924bb1?w=400',portionType:'Plate',isAvailable:true},
            {id:'m3-luchi',name:'Luchi (4 pcs)',category:'Starters',price:60,priceHalf:0,description:'Deep-fried puffed bread',imageUrl:'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400',portionType:'Quantity',isAvailable:true},
            {id:'m4-chola',name:'Cholar Dal',category:'Main Course',price:90,priceHalf:0,description:'Bengal gram dal with coconut',imageUrl:'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400',portionType:'Plate',isAvailable:true},
            {id:'m5-begun',name:'Begun Bhaja',category:'Starters',price:40,priceHalf:0,description:'Fried eggplant slices',imageUrl:'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400',portionType:'Quantity',isAvailable:true},
            {id:'m6-aloop',name:'Aloo Posto',category:'Main Course',price:150,priceHalf:80,description:'Potatoes in poppy seed paste',imageUrl:'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400',portionType:'Plate',isAvailable:true},
            {id:'m7-shukto',name:'Shukto',category:'Main Course',price:120,priceHalf:70,description:'Traditional bitter-sweet mixed veg',imageUrl:'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=400',portionType:'Plate',isAvailable:true},
            {id:'m8-mocha',name:'Mochar Ghonto',category:'Main Course',price:160,priceHalf:0,description:'Banana flower dry curry',imageUrl:'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400',portionType:'Plate',isAvailable:true},
            {id:'m9-dhoka',name:'Dhokar Dalna',category:'Main Course',price:140,priceHalf:80,description:'Lentil cakes in spicy gravy',imageUrl:'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400',portionType:'Plate',isAvailable:true},
            {id:'m10-chick',name:'Chicken Kosha',category:'Main Course',price:280,priceHalf:160,description:'Slow-cooked spicy chicken',imageUrl:'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400',portionType:'Plate',isAvailable:true},
            {id:'m11-mutt',name:'Mutton Kosha',category:'Main Course',price:450,priceHalf:250,description:'Traditional spicy mutton curry',imageUrl:'https://images.unsplash.com/photo-1545247181-516773cae754?w=400',portionType:'Plate',isAvailable:true},
            {id:'m12-ilish',name:'Ilish Bhapa',category:'Main Course',price:450,priceHalf:0,description:'Hilsa steamed in mustard paste',imageUrl:'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=400',portionType:'Plate',isAvailable:true},
            {id:'m13-ruim',name:'Rui Macher Jhol',category:'Main Course',price:180,priceHalf:0,description:'Rohu fish in light cumin gravy',imageUrl:'https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=400',portionType:'Plate',isAvailable:true},
            {id:'m14-pabda',name:'Pabda Jhal',category:'Main Course',price:250,priceHalf:0,description:'Pabda fish in spicy mustard',imageUrl:'https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=400',portionType:'Plate',isAvailable:true},
            {id:'m15-ching',name:'Chingri Malaikari',category:'Main Course',price:380,priceHalf:0,description:'Prawns in coconut milk gravy',imageUrl:'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400',portionType:'Plate',isAvailable:true},
            {id:'m16-bhet',name:'Bhetki Paturi',category:'Main Course',price:320,priceHalf:0,description:'Fish steamed in banana leaf',imageUrl:'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=400',portionType:'Plate',isAvailable:true},
            {id:'m17-sorsh',name:'Sorshe Ilish',category:'Main Course',price:480,priceHalf:0,description:'Hilsa in pungent mustard gravy',imageUrl:'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=400',portionType:'Plate',isAvailable:true},
            {id:'m18-katla',name:'Katla Kalia',category:'Main Course',price:220,priceHalf:0,description:'Rich Katla fish gravy',imageUrl:'https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=400',portionType:'Plate',isAvailable:true},
            {id:'m19-pomf',name:'Pomfret Masala',category:'Main Course',price:300,priceHalf:0,description:'Whole fried pomfret masala',imageUrl:'https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=400',portionType:'Plate',isAvailable:true},
            {id:'m20-chikb',name:'Chicken Biryani',category:'Main Course',price:320,priceHalf:180,description:'Kolkata style with potato',imageUrl:'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400',portionType:'Plate',isAvailable:true},
            {id:'m21-mutb',name:'Mutton Biryani',category:'Main Course',price:420,priceHalf:220,description:'Rich aromatic mutton rice',imageUrl:'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400',portionType:'Plate',isAvailable:true},
            {id:'m22-fishf',name:'Fish Finger (6pcs)',category:'Starters',price:220,priceHalf:0,description:'Crispy breaded fish strips',imageUrl:'https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=400',portionType:'Quantity',isAvailable:true},
            {id:'m23-chikc',name:'Chicken Cutlet',category:'Starters',price:150,priceHalf:0,description:'Minced chicken deep fried',imageUrl:'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400',portionType:'Quantity',isAvailable:true},
            {id:'m24-vegc',name:'Veg Chop (2pcs)',category:'Starters',price:40,priceHalf:0,description:'Beetroot and peanut croquettes',imageUrl:'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400',portionType:'Quantity',isAvailable:true},
            {id:'m25-alood',name:'Aloo Dum',category:'Main Course',price:110,priceHalf:60,description:'Spicy baby potato curry',imageUrl:'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400',portionType:'Plate',isAvailable:true},
            {id:'m26-chann',name:'Channar Dalna',category:'Main Course',price:180,priceHalf:100,description:'Cottage cheese balls in gravy',imageUrl:'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400',portionType:'Plate',isAvailable:true},
            {id:'m27-murig',name:'Muri Ghonto',category:'Main Course',price:200,priceHalf:0,description:'Fish head cooked with rice',imageUrl:'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400',portionType:'Plate',isAvailable:true},
            {id:'m28-lauch',name:'Lau Chingri',category:'Main Course',price:190,priceHalf:0,description:'Bottle gourd with small prawns',imageUrl:'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400',portionType:'Plate',isAvailable:true},
            {id:'m29-papad',name:'Papad Bhaja',category:'Starters',price:15,priceHalf:0,description:'Crispy fried papadum',imageUrl:'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400',portionType:'Quantity',isAvailable:true},
            {id:'m30-tomat',name:'Tomato Chutney',category:'Starters',price:40,priceHalf:0,description:'Sweet and tangy tomato relish',imageUrl:'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=400',portionType:'Quantity',isAvailable:true},
            {id:'m31-mishti',name:'Mishti Doi',category:'Dessert',price:60,priceHalf:0,description:'Sweet fermented yogurt',imageUrl:'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400',portionType:'Plate',isAvailable:true},
            {id:'m32-roso',name:'Rosogolla (2pcs)',category:'Dessert',price:40,priceHalf:0,description:'Sponge syrupy balls',imageUrl:'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400',portionType:'Quantity',isAvailable:true},
            {id:'m33-gulab',name:'Gulab Jamun (2pcs)',category:'Dessert',price:50,priceHalf:0,description:'Fried milk solid balls',imageUrl:'https://images.unsplash.com/photo-1620660998677-f5a6c07db9bb?w=400',portionType:'Quantity',isAvailable:true},
            {id:'m34-payesh',name:'Payesh',category:'Dessert',price:100,priceHalf:0,description:'Rice pudding with jaggery',imageUrl:'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400',portionType:'Quantity',isAvailable:true},
            {id:'m35-sand',name:'Sandesh (2pcs)',category:'Dessert',price:60,priceHalf:0,description:'Traditional dry milk sweet',imageUrl:'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400',portionType:'Quantity',isAvailable:true},
            {id:'m36-mw1l',name:'Mineral Water 1L',category:'Drinks',price:20,priceHalf:0,description:'Chilled Bisleri',imageUrl:'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400',portionType:'Bottle',isAvailable:true},
            {id:'m37-mw500',name:'Mineral Water 500ml',category:'Drinks',price:10,priceHalf:0,description:'Travel size water',imageUrl:'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400',portionType:'Bottle',isAvailable:true},
            {id:'m38-milkt',name:'Milk Tea',category:'Drinks',price:25,priceHalf:0,description:'Strong Assam CTC Tea',imageUrl:'https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?w=400',portionType:'Cup',isAvailable:true},
            {id:'m39-blkt',name:'Black Tea',category:'Drinks',price:15,priceHalf:0,description:'Lemon and ginger tea',imageUrl:'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400',portionType:'Cup',isAvailable:true},
            {id:'m40-coffee',name:'Coffee',category:'Drinks',price:40,priceHalf:0,description:'Instant milk coffee',imageUrl:'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400',portionType:'Cup',isAvailable:true},
            {id:'m41-lassi',name:'Sweet Lassi',category:'Drinks',price:80,priceHalf:0,description:'Thick yogurt drink',imageUrl:'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=400',portionType:'Cup',isAvailable:true},
            {id:'m42-limsod',name:'Fresh Lime Soda',category:'Drinks',price:60,priceHalf:0,description:'Sweet or Salted',imageUrl:'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400',portionType:'Cup',isAvailable:true},
            {id:'m43-cola',name:'Coca Cola 500ml',category:'Drinks',price:45,priceHalf:0,description:'Pet bottle chilled',imageUrl:'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400',portionType:'Bottle',isAvailable:true},
            {id:'m44-sprite',name:'Sprite 500ml',category:'Drinks',price:45,priceHalf:0,description:'Pet bottle chilled',imageUrl:'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400',portionType:'Bottle',isAvailable:true},
            {id:'m45-eggc',name:'Egg Curry (2pcs)',category:'Main Course',price:120,priceHalf:0,description:'Boiled eggs in spicy gravy',imageUrl:'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400',portionType:'Plate',isAvailable:true},
            {id:'m46-dakb',name:'Chicken Dak Bunglow',category:'Main Course',price:300,priceHalf:180,description:'Heritage chicken curry with egg',imageUrl:'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400',portionType:'Plate',isAvailable:true},
            {id:'m47-posto',name:'Posto Bora (4pcs)',category:'Starters',price:120,priceHalf:0,description:'Poppy seed fried fritters',imageUrl:'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400',portionType:'Quantity',isAvailable:true},
            {id:'m48-dachr',name:'Macher Matha Diye Dal',category:'Main Course',price:130,priceHalf:0,description:'Roasted Moong dal with fish head',imageUrl:'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400',portionType:'Plate',isAvailable:true},
            {id:'m49-kanka',name:'Kancha Lanka Murgi',category:'Main Course',price:290,priceHalf:160,description:'Green chili chicken (spicy)',imageUrl:'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400',portionType:'Plate',isAvailable:true},
            {id:'m50-bhetf',name:'Bhetki Fry',category:'Starters',price:180,priceHalf:0,description:'Pure Bhetki fillet fry',imageUrl:'https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=400',portionType:'Quantity',isAvailable:true}
        ];
}

// ── Clock ─────────────────────────────────────────────────

function startClock() {
    const update = () => {
        const now = new Date();
        const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        let h = now.getHours(); const ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
        const mm = String(now.getMinutes()).padStart(2,'0'), ss = String(now.getSeconds()).padStart(2,'0');
        const el = document.getElementById('clock');
        if (el) el.textContent = `${days[now.getDay()]}, ${String(now.getDate()).padStart(2,'0')} ${months[now.getMonth()]} | ${h}:${mm}:${ss} ${ampm}`;
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

// ── Render Restaurant Desk ────────────────────────────────

function renderRestDesk() {
    const grid = document.getElementById('rest-desk-table-grid');
    if (!grid) return;
    grid.innerHTML = '';
    let totalPax = 0, activeTables = 0;
    const orderColors = {1:'#FF3131',2:'#39FF14',3:'#1F51FF',4:'#FFF01F',5:'#A020F0'};

    Object.values(tables).sort((a,b) => String(a.id).localeCompare(String(b.id))).forEach(table => {
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
                    const linkedTag = b.colorIndex === 5 ? `🔗 ${b.linkGroupId || 'L'}:` : '';
                    guestDivs += `<div onclick="event.stopPropagation();window.deskApp.selectDeskCheckout('${table.id}','${b.billID}')"
                        style="color:${c};font-weight:bold;margin-bottom:0.3rem;cursor:pointer;padding:0.2rem;border-radius:4px;border:1px solid ${b.colorIndex===5?'#A020F0':'transparent'};">
                        ${linkedTag} ${b.billID} | ${b.guestName} <span style="color:#4ADE80;">&#8377;${billTotal}</span></div>`;
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
                    <div class="chair-row">${cHtml[0]||''}${cHtml[1]||''}</div>
                    <div class="table-engine-box" style="border-color:#F59E0B;">${table.id}</div>
                    <div class="chair-row">${cHtml[2]||''}${cHtml[3]||''}</div>
                </div></div>
                <div class="text-sm mt-3 text-center text-gray">${table.pax || 0} / 4 Seats Occupied</div>
                <div class="text-xl font-bold mt-2 text-center color-primary">&#8377;${table.total || 0}</div>`;
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
                    <div class="chair-row">${cHtml[0]||''}${cHtml[1]||''}</div>
                    <div class="table-engine-box" style="border-color:var(--color-slate-700);color:var(--color-slate-400);">${table.id}</div>
                    <div class="chair-row">${cHtml[2]||''}${cHtml[3]||''}</div>
                </div></div>
                <div class="text-sm mt-3 text-center text-gray">0 / 4 Seats Occupied</div>`;
            grid.appendChild(card);
        }
    });

    const paxEl = document.getElementById('rest-desk-pax');
    const tabEl = document.getElementById('rest-desk-active-tables');
    if (paxEl) paxEl.innerText = totalPax;
    if (tabEl) tabEl.innerText = activeTables;

    renderPickupList();
    updateRevDisplay();
}

// ── Checkout ──────────────────────────────────────────────

function selectDeskCheckout(tableId, billId = null) {
    const table = tables[tableId]; if (!table || table.status !== 'occupied') return;
    const ab = table.activeBills || [];
    let billsHtml = '';

    if (billId) {
        const bill = ab.find(b => b.billID === billId);
        const orders = (table.orders || []).filter(o => o.id === billId || o.order_id === billId);
        const total = orders.reduce((s, o) => s + (o.total || o.total_price || 0), 0);
        billsHtml += `<div style="margin-bottom:1rem;">
            <strong style="color:var(--gold-primary);">Bill ${billId} — ${bill?.guestName || 'Guest'}</strong>`;
        orders.forEach(o => {
            billsHtml += `<div style="margin-top:0.5rem;padding:0.5rem;background:rgba(255,255,255,0.05);border-radius:4px;">`;
            (o.items || []).forEach(item => {
                const nm = typeof item === 'object' ? `${item.qty}x ${item.name}` : item;
                billsHtml += `<div>• ${nm}</div>`;
            });
            billsHtml += `</div>`;
        });
        billsHtml += `<div style="margin-top:0.75rem;font-weight:bold;font-size:1.1rem;color:#4ADE80;">Total: &#8377;${total}</div></div>`;
        document.getElementById('checkout-modal-title').innerText = `Bill ${billId} — ${bill?.guestName || 'Guest'}`;
    } else {
        ab.forEach(b => {
            const orders = (table.orders || []).filter(o => o.id === b.billID || o.order_id === b.billID);
            const total = orders.reduce((s, o) => s + (o.total || o.total_price || 0), 0);
            billsHtml += `<div style="margin-bottom:1.5rem;border-bottom:1px dashed rgba(255,255,255,0.1);padding-bottom:1rem;">
                <strong style="color:var(--gold-primary);">Bill ${b.billID} — ${b.guestName}</strong>`;
            orders.forEach(o => {
                billsHtml += `<div style="margin-top:0.5rem;padding:0.5rem;background:rgba(255,255,255,0.05);border-radius:4px;">`;
                (o.items || []).forEach(item => {
                    billsHtml += `<div>• ${typeof item === 'object' ? `${item.qty}x ${item.name}` : item}</div>`;
                });
                billsHtml += `</div>`;
            });
            billsHtml += `<div style="margin-top:0.5rem;font-weight:bold;color:#4ADE80;">Subtotal: &#8377;${total}</div></div>`;
        });
        document.getElementById('checkout-modal-title').innerText = `Table ${tableId} — Full Checkout`;
    }

    const grandTotal = (table.orders || []).reduce((s, o) => s + (o.total || o.total_price || 0), 0);
    billsHtml += `<div style="font-size:1.3rem;font-weight:bold;margin-top:1rem;padding-top:1rem;border-top:2px solid var(--gold-primary);display:flex;justify-content:space-between;">
        <span>Grand Total</span><span style="color:var(--gold-primary);">&#8377;${grandTotal}</span></div>`;

    document.getElementById('checkout-modal-content').innerHTML = billsHtml;
    // Store for print
    document.getElementById('checkout-modal').dataset.tableId = tableId;
    document.getElementById('checkout-modal').dataset.grandTotal = grandTotal;
    document.getElementById('checkout-modal').style.display = 'flex';
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
    } catch (e) {}

    // Reset table
    table.status = 'available'; table.guestName = null; table.pax = 0;
    table.activeBills = []; table.orders = []; table.total = 0;
    (table.chairs || []).forEach(c => c.status = 'available');
    await pushTableToCloud(table);
    await pushNotification('checkout', `Table ${tableId} closed — &#8377;${grandTotal} received`, 'desk');

    modal.style.display = 'none';
    updateRevDisplay();
    printBill(tableId, grandTotal);
    showToast(`Table ${tableId} closed. &#8377;${grandTotal} collected.`, 'success');
}

function printBill(tableId, total) {
    const pa = document.getElementById('print-area');
    pa.innerHTML = `<div class="invoice-copy" style="font-family:monospace;font-size:1.1rem;">
        <div style="text-align:center;font-weight:bold;font-size:1.5rem;border-bottom:2px solid black;padding-bottom:1rem;margin-bottom:1rem;">BARAK RESIDENCY</div>
        <div style="margin-bottom:1rem;"><strong>Table:</strong> ${tableId}<br>
        <strong>Date:</strong> ${new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}</div>
        <div style="font-size:1.3rem;font-weight:bold;border-top:2px solid black;padding-top:1rem;margin-top:1rem;">Grand Total: &#8377;${total}</div>
        <div style="text-align:center;margin-top:1rem;font-size:0.9rem;">Thank you for dining with us!</div>
    </div>`;
    window.print();
}

// ── Pickup Orders ─────────────────────────────────────────

async function generatePickupOrder() {
    pickupCounter++;
    localStorage.setItem('br_pickup_counter', pickupCounter);
    const id = `P${pickupCounter}`;
    showToast(`Pickup Order ${id} created. Open Waiter portal to add items.`, 'info');
    await pushNotification('order', `New Pickup Order ${id} initiated`, 'desk');
}

function renderPickupList() {
    const container = document.getElementById('rest-desk-pickup-list');
    if (!container) return;
    if (activePickups.length === 0) {
        container.innerHTML = '<div class="text-center text-gray" style="padding:1rem;">No active pickups</div>';
        return;
    }
    container.innerHTML = '';
    activePickups.forEach(p => {
        const isPaid = p.paymentStatus === 'paid';
        const row = document.createElement('div');
        row.style.cssText = `display:flex;justify-content:space-between;align-items:center;padding:0.75rem 1rem;background:rgba(255,255,255,0.05);border-radius:8px;border-left:4px solid ${isPaid?'#39FF14':'#A020F0'};margin-bottom:0.5rem;`;
        row.innerHTML = `
            <div style="flex:1;">
                <span style="font-weight:bold;color:${isPaid?'#39FF14':'#A020F0'};margin-right:1rem;">#${p.id}</span>
                <span style="color:white;">${p.items?.length || 0} Items${isPaid?' [PAID]':''}</span>
                <span class="text-gray" style="font-size:0.75rem;margin-left:0.5rem;">${timeOnlyIST(p.timestamp)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:0.75rem;">
                <span style="font-weight:bold;color:#4ADE80;">&#8377;${p.total}</span>
                ${!isPaid?`<button class="btn btn-success" style="padding:0.25rem 0.75rem;font-size:0.8rem;" onclick="window.deskApp.markPickupPaid('${p.id}')">PAY</button>`:''}
                ${isPaid?`<button class="btn btn-primary" style="padding:0.25rem 0.75rem;font-size:0.8rem;" onclick="window.deskApp.markPickupDelivered('${p.id}')">DELIVERED</button>`:''}
            </div>`;
        container.appendChild(row);
    });
}

async function markPickupPaid(id) {
    const p = activePickups.find(x => x.id === id); if (!p) return;
    p.paymentStatus = 'paid';
    localStorage.setItem('yukt_active_pickups', JSON.stringify(activePickups));
    await pushNotification('payment', `${id} PAYMENT RECEIVED`, 'desk');
    renderPickupList();
    showToast(`${id} marked as paid`, 'success');
}

async function markPickupDelivered(id) {
    const idx = activePickups.findIndex(x => x.id === id); if (idx === -1) return;
    activePickups.splice(idx, 1);
    localStorage.setItem('yukt_active_pickups', JSON.stringify(activePickups));
    await pushNotification('delivery', `${id} DELIVERED & ARCHIVED`, 'desk');
    renderPickupList();
    showToast(`${id} delivered and archived`, 'success');
}

// ── Notifications Sidebar ─────────────────────────────────

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
        if (n.data && (n.data.type === 'dinein' || n.data.type === 'addon')) {
            const printed = JSON.parse(localStorage.getItem('br_printed_kots') || '{}');
            const isPrinted = printed[n.id];
            actionHtml = `<button class="btn ${isPrinted?'btn-outline':'btn-primary'} btn-block mt-2"
                style="font-size:0.75rem;padding:0.4rem;${isPrinted?'opacity:0.6;':'background:#F59E0B;border:none;color:#000;'}"
                onclick="window.deskApp.printKOT('${n.id}','${n.data.orderId}','${n.data.tableId}')">
                ${isPrinted?'PRINTED ✓':'PRINT 2 KOT'}</button>`;
        }

        div.innerHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;">
                <span class="note-type ${n.type||''}" style="${isPurple?'background:rgba(160,32,240,0.1);color:#A020F0;':''}">${(n.type||'').toUpperCase()}</span>
                <span style="font-size:0.75rem;color:var(--color-slate-400);">${ts}</span>
            </div>
            <div style="font-size:0.9rem;${isPurple?'color:#d4a0f7;font-weight:bold;':''}">${n.message}</div>
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
            <strong>Time:</strong> ${new Date().toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour12:true})}</div>
            <div style="margin-top:0.5rem;border-top:1px dashed black;padding-top:0.5rem;">
            ${order ? (order.items || []).map(i => `<div>• ${typeof i==='object'?`${i.qty}x ${i.name}`:i}</div>`).join('') : '<div>Items not found</div>'}
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
    } catch (e) {}
    notifications = [];
    renderNotificationSidebar();
    showToast('Notifications cleared', 'success');
}

// ── Revenue ───────────────────────────────────────────────

function toggleRevVisibility(btn) {
    const display = document.getElementById('desk-revenue-display');
    if (!display) return;
    if (display.classList.contains('revealed')) {
        display.classList.remove('revealed');
        display.style.filter = 'blur(4px)';
        display.innerText = '&#8377; ****';
    } else {
        display.classList.add('revealed');
        display.style.filter = 'none';
        display.innerText = `&#8377; ${restaurantRevenue}`;
    }
}

function updateRevDisplay() {
    const el = document.getElementById('desk-revenue-display');
    if (el && el.classList.contains('revealed')) el.innerText = `&#8377; ${restaurantRevenue}`;
}

// ── Food Availability ─────────────────────────────────────

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
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:0.75rem;background:rgba(255,255,255,0.03);border-radius:8px;margin-bottom:0.5rem;border:1px solid var(--glass-border);';
        row.innerHTML = `
            <div><span style="font-size:1.2rem;margin-right:0.5rem;">${item.icon || '🍽'}</span>
            <span>${item.name}</span>
            <span style="color:var(--color-slate-400);margin-left:0.5rem;font-size:0.85rem;">&#8377;${item.price}</span></div>
            <label class="switch"><input type="checkbox" ${!isUnavail ? 'checked' : ''}
                onchange="window.deskApp.toggleItemAvailability('${item.id}',this.checked)">
            <span class="slider"></span></label>`;
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

// ── Expose to window ──────────────────────────────────────
window.deskApp = {
    selectDeskCheckout, printAndCloseTable, printBill,
    generatePickupOrder, markPickupPaid, markPickupDelivered,
    renderNotificationSidebar, printKOT, clearNotifications,
    toggleRevVisibility, openAvailabilityModal, renderAvailabilityTool,
    toggleItemAvailability
};

// Legacy onclick compatibility
window.printAndCloseTable = printAndCloseTable;
window.generatePickupOrder = generatePickupOrder;
window.clearNotifications = clearNotifications;
window.toggleRevVisibility = toggleRevVisibility;
window.openAvailabilityModal = openAvailabilityModal;

// ── Boot ──────────────────────────────────────────────────
init().catch(e => console.error('[Desk Boot] Failed:', e));
