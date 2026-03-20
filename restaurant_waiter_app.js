/**
 * ════════════════════════════════════════════════════════════
 * BARAK RESIDENCY — Restaurant Waiter App
 * Standalone · Firebase Firestore · No localStorage dependency
 * ════════════════════════════════════════════════════════════
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import {
    getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc,
    onSnapshot, query, orderBy, limit, updateDoc, serverTimestamp,
    runTransaction, increment
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

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

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

// ── State ─────────────────────────────────────────────────
let tables = {};
let menu = [];
let cart = [];
let activeTableId = null;
let currentGuestName = '';
let currentPax = 1;
let editingOrderId = null;
let preserveCart = false;
let pendingItem = null;
let pendingVariant = 'Full';
let currentLinkContext = null;
let unavailableItems = [];
let _isPlacingOrder = false;

// ── Firebase Helpers ──────────────────────────────────────

async function getNextOrderSerial(tableId) {
    try {
        const tableRef = doc(db, 'tables', String(tableId));
        let nextSerial = 1;
        await runTransaction(db, async (tx) => {
            const snap = await tx.get(tableRef);
            const curr = snap.exists() ? (snap.data().lifetimeOrderCount || 0) : 0;
            nextSerial = curr + 1;
            tx.update(tableRef, { lifetimeOrderCount: nextSerial });
        });
        return `${tableId}-${nextSerial}`;
    } catch (e) {
        return `${tableId}-${Date.now().toString().slice(-4)}`;
    }
}

async function pushTableToCloud(tableObj) {
    try {
        const ref = doc(db, 'tables', String(tableObj.id));
        await setDoc(ref, { ...tableObj, last_updated: serverTimestamp() });
    } catch (e) { console.warn('[Table] Cloud push failed', e); }
}

async function pushOrderToCloud(orderObj) {
    try {
        const oid = orderObj.order_id || orderObj.id;
        const orderRef = doc(db, 'orders', String(oid));
        let cloudStatus = orderObj.status || 'preparing';
        await setDoc(orderRef, {
            ...orderObj,
            order_id: oid,
            id: oid,
            status: cloudStatus,
            timestamp: serverTimestamp()
        });
        console.log('[Order] Written to Firestore:', oid);
    } catch (e) { console.error('[Order] Push failed', e); }
}

async function pushNotification(type, message, target, data = null) {
    try {
        const nRef = collection(db, 'notifications');
        await addDoc(nRef, {
            id: Date.now().toString(),
            type, message, target,
            timestamp: Date.now(),
            status: 'new',
            data
        });
    } catch (e) { console.warn('[Notification] Push failed', e); }
}

// ── Real-time Listeners ───────────────────────────────────

function startListeners() {
    onSnapshot(collection(db, 'tables'), (snap) => {
        snap.forEach(d => { tables[d.id] = d.data(); });
        renderTableSidebar();
    });

    onSnapshot(doc(db, 'settings', 'availability'), (snap) => {
        if (snap.exists() && snap.data().unavailableItems) {
            unavailableItems = snap.data().unavailableItems;
            renderMenu(document.getElementById('rest-waiter-menu-search')?.value || '');
        }
    });

    // Menu items — Merge Sync (Ground Truth Strategy)
    onSnapshot(collection(db, 'menuItems'), snap => {
        if (!snap.empty) {
            const cloudItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            const updatedMenu = getDefaultMenu().map(baseItem => {
                const cloudItem = cloudItems.find(c => c.id === baseItem.id);
                if (!cloudItem) return baseItem;
                return {
                    ...baseItem,
                    price: cloudItem.price || cloudItem.PriceFull || cloudItem.Price || baseItem.price,
                    priceHalf: cloudItem.priceHalf || cloudItem.PriceHalf || baseItem.priceHalf,
                    imageUrl: cloudItem.imageUrl || cloudItem.ImageURL || cloudItem.image || baseItem.imageUrl,
                    isAvailable: cloudItem.isAvailable !== false
                };
            });
            menu = updatedMenu;
            renderMenu(document.getElementById('rest-waiter-menu-search')?.value || '');
        }
    });
}

// ── Init ──────────────────────────────────────────────────

async function init() {
    startClock();
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'login.html';
        } else {
            await loadInitialData();
            startListeners();
            showToast('Connected to Cloud', 'success');
        }
    });
}

async function loadInitialData() {
    const tablesSnap = await getDocs(collection(db, 'tables'));
    if (!tablesSnap.empty) {
        tablesSnap.forEach(d => { tables[d.id] = d.data(); });
    } else {
        const defaultTables = generateDefaultTables();
        for (const [id, t] of Object.entries(defaultTables)) {
            await setDoc(doc(db, 'tables', id), t);
            tables[id] = t;
        }
    }

    if (!menuSnap.empty) {
        const cloudMenu = [];
        menuSnap.forEach(d => {
            const data = d.data();
            const name = data.name || data.Name || data.itemName || '';
            if (name.trim().length > 0) cloudMenu.push({ id: d.id, ...data });
        });
        menu = cloudMenu;
        console.log('[Menu] Loaded from Cloud:', menu.length);
    } 
    
    if (menu.length === 0) {
        console.log('[Menu] Using Default Fallback');
        menu = getDefaultMenu();
    }

    renderMenu('');

    try {
        const availSnap = await getDoc(doc(db, 'settings', 'availability'));
        if (availSnap.exists()) unavailableItems = availSnap.data().unavailableItems || [];
    } catch (e) {}

    renderTableSidebar();
}

function generateDefaultTables() {
    const t = {};
    ['A','B','C','D','E','F','G','H'].forEach(l => {
        t[l] = {
            id: l, status: 'available', pax: 0, guestName: null,
            lastSeqId: 0, lifetimeOrderCount: 0,
            chairs: [
                {id:`${l}-1`,status:'available'},{id:`${l}-2`,status:'available'},
                {id:`${l}-3`,status:'available'},{id:`${l}-4`,status:'available'}
            ],
            activeBills: [], orders: [], total: 0
        };
    });
    return t;
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
        const mm = String(now.getMinutes()).padStart(2,'0');
        const ss = String(now.getSeconds()).padStart(2,'0');
        const el = document.getElementById('clock');
        if (el) el.textContent = `${days[now.getDay()]}, ${String(now.getDate()).padStart(2,'0')} ${months[now.getMonth()]} | ${h}:${mm}:${ss} ${ampm}`;
    };
    update(); setInterval(update, 1000);
}

// ── Toast ─────────────────────────────────────────────────

function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:5rem;right:1.5rem;padding:0.75rem 1.25rem;border-radius:8px;font-weight:600;font-size:0.9rem;z-index:99999;animation:fadeIn 0.3s ease;`;
    t.style.background = type === 'success' ? '#4ADE80' : type === 'error' ? '#EF4444' : '#E5C366';
    t.style.color = '#050B1A';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// ── Table Sidebar ─────────────────────────────────────────

function renderTableSidebar() {
    const list = document.getElementById('rest-waiter-table-list');
    if (!list) return;
    list.innerHTML = '';
    const orderColors = {1:'#FF3131',2:'#39FF14',3:'#1F51FF',4:'#FFF01F',5:'#A020F0'};

    Object.values(tables).sort((a,b) => String(a.id).localeCompare(String(b.id))).forEach(table => {
        const btn = document.createElement('div');
        btn.className = `w-room-btn ${activeTableId === table.id ? 'active' : ''}`;

        const chars = table.chairs || [];
        const cHtml = chars.map((c, i) => {
            if (c.status === 'occupied') {
                let glowColor = '#D4AF37';
                const ab = table.activeBills || [];
                if (ab.length > 0) {
                    let acc = 0, sel = null;
                    for (let b of ab) { acc += (b.pax || 1); if (i < acc) { sel = b; break; } }
                    if (sel) glowColor = orderColors[sel.colorIndex] || '#D4AF37';
                }
                return `<div class="chair-circle occupied"><svg viewBox="0 0 24 24" class="person-icon" style="filter:drop-shadow(0 0 10px ${glowColor});"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" style="fill:${glowColor};"/></svg></div>`;
            }
            return `<div class="chair-circle"><svg viewBox="0 0 24 24" class="person-icon"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div>`;
        });

        btn.innerHTML = `
            <div class="restaurant-table-view"><div class="table-layout-wrapper">
                <div class="chair-row">${cHtml[0]||''}${cHtml[1]||''}</div>
                <div class="table-engine-box" style="border-color:${table.status==='occupied'?'var(--color-indigo-500)':'var(--color-slate-700)'};">${table.id}</div>
                <div class="chair-row">${cHtml[2]||''}${cHtml[3]||''}</div>
            </div></div>
            <div style="text-align:center;margin-top:0.5rem;" class="text-sm ${table.status==='occupied'?'color-success':'text-gray'}">
                ${table.status === 'occupied' ? `Occupied (${table.pax} Pax)` : 'Available'}
            </div>`;

        if (table.status === 'occupied') btn.style.borderColor = 'var(--color-green-400)';
        btn.onclick = () => handleTableClick(table);
        list.appendChild(btn);
    });
}

// ── Table Selection ───────────────────────────────────────

function handleTableClick(table) {
    document.getElementById('tci-tableid').value = table.id;

    if (table.status === 'available') {
        document.getElementById('tci-title').innerText = `Table ${table.id} Check-in`;
        document.getElementById('tci-name').value = '';
        document.getElementById('tci-pax').value = '2';
        document.getElementById('tci-inputs-wrapper').style.display = 'block';
        document.getElementById('tci-active-guests-list').style.display = 'none';
        document.getElementById('btn-confirm-tci').style.display = 'block';
        document.getElementById('btn-confirm-tci').innerText = 'Start Order';
        document.getElementById('btn-add-new-guest').style.display = 'none';
        document.getElementById('waiter-modal-overlay').style.display = 'flex';
        setTimeout(() => document.getElementById('tci-name').focus(), 100);
    } else {
        document.getElementById('tci-title').innerText = `Table ${table.id} Occupied`;
        document.getElementById('tci-inputs-wrapper').style.display = 'none';
        const listEl = document.getElementById('tci-active-guests-list');
        listEl.style.display = 'flex'; listEl.innerHTML = '';
        const colors = {1:'#FF3131',2:'#39FF14',3:'#1F51FF',4:'#FFF01F'};
        let activePax = 0;
        (table.activeBills || []).forEach(b => {
            activePax += b.pax || 1;
            const btn = document.createElement('button');
            btn.type = 'button'; btn.className = 'btn btn-success';
            const c = colors[b.colorIndex] || '#22C55E';
            btn.style.cssText = `width:100%;border-radius:8px;padding:1rem;text-align:left;font-weight:bold;font-size:1.1rem;border:none;background:${c};color:${b.colorIndex===4?'black':'white'};margin-bottom:0.5rem;`;
            btn.innerText = `${b.guestName} [${b.billID}]`;
            btn.onclick = () => reorderBill(b.billID);
            listEl.appendChild(btn);
        });
        const newGuestBtn = document.getElementById('btn-add-new-guest');
        if (activePax < 4) {
            newGuestBtn.style.display = 'block';
            newGuestBtn.innerText = `Add New Guest (${4 - activePax} seats left)`;
            newGuestBtn.onclick = () => addNewGuest(table.id);
        } else {
            newGuestBtn.style.display = 'none';
        }
        document.getElementById('btn-confirm-tci').style.display = 'none';
        document.getElementById('waiter-modal-overlay').style.display = 'flex';
    }
}

function cancelModal() {
    document.getElementById('waiter-modal-overlay').style.display = 'none';
}

function addNewGuest(tid) {
    const table = tables[tid]; if (!table) return;
    const activePax = (table.activeBills || []).reduce((a, b) => a + (b.pax || 1), 0);
    const maxAvail = 4 - activePax;
    document.getElementById('tci-inputs-wrapper').style.display = 'block';
    document.getElementById('tci-name').value = '';
    document.getElementById('tci-pax').value = Math.min(2, maxAvail);
    document.getElementById('tci-pax').max = maxAvail;
    document.getElementById('tci-active-guests-list').style.display = 'none';
    document.getElementById('btn-add-new-guest').style.display = 'none';
    document.getElementById('btn-confirm-tci').style.display = 'block';
    document.getElementById('btn-confirm-tci').innerText = 'Start Order';
    editingOrderId = null;
    document.getElementById('tci-name').focus();
}

function reorderBill(billId) {
    const tid = document.getElementById('tci-tableid').value;
    const table = tables[tid]; if (!table) return;
    const bill = (table.activeBills || []).find(b => b.billID === billId); if (!bill) return;
    editingOrderId = billId; currentGuestName = bill.guestName; currentPax = bill.pax;
    cart = [];
    const sess = (table.orders || []).find(o => o.id === billId);
    if (sess && Array.isArray(sess.items)) {
        sess.items.forEach(item => {
            const itemObj = typeof item === 'object' ? item : null;
            if (!itemObj) return;
            const ex = cart.find(c => c.item.id === itemObj.id);
            if (ex) ex.qty += itemObj.qty || 1;
            else cart.push({ item: { id: itemObj.id, name: itemObj.name, price: itemObj.price }, qty: itemObj.qty || 1 });
        });
    }
    preserveCart = true;
    cancelModal();
    selectTable(table, { guestName: currentGuestName, pax: currentPax, computedBillID: billId });
}

function submitTableCheckin(e) {
    e.preventDefault();
    const tid = document.getElementById('tci-tableid').value; if (!tid) return;
    const gName = document.getElementById('tci-name').value || 'Walk-in Guest';
    const pVal = parseInt(document.getElementById('tci-pax').value) || 1;
    const table = tables[tid]; if (!table) return;
    if (!table.activeBills) table.activeBills = [];
    const currPax = table.activeBills.reduce((a, b) => a + (b.pax || 1), 0);
    if (!editingOrderId && (currPax + pVal) > 4) { showToast(`Only ${4 - currPax} seats left.`, 'error'); return; }
    if (table.status !== 'occupied') { table.status = 'occupied'; table.guestName = gName; }
    currentGuestName = gName; currentPax = pVal;
    let billId = ''; let colorIdx = 1;
    if (!editingOrderId) {
        table.pax = (table.pax || 0) + pVal;
        if (table.lastSeqId === undefined) table.lastSeqId = 0;
        table.lastSeqId++;
        billId = `${table.id}${table.lastSeqId}`;
        const usedColors = table.activeBills.map(b => b.colorIndex);
        for (let i = 1; i <= 4; i++) { if (!usedColors.includes(i)) { colorIdx = i; break; } }
        table.activeBills.push({ guestName: gName, pax: pVal, billID: billId, colorIndex: colorIdx });
    } else { billId = editingOrderId; }
    if (table.chairs) {
        let a = 0;
        table.chairs.forEach(c => { if (c.status === 'available' && a < pVal) { c.status = 'occupied'; a++; } });
    }
    cart = [];
    pushTableToCloud(table);
    cancelModal();
    renderTableSidebar();
    selectTable(table, { guestName: gName, pax: pVal, computedBillID: billId });
}

function selectTable(table, ctx) {
    activeTableId = table.id;
    const billId = ctx.computedBillID || editingOrderId;
    document.getElementById('rest-waiter-pos-title').innerText = `Order for Table ${table.id}`;
    document.getElementById('rest-waiter-table-info').innerText = `Table ${table.id} | Bill ${billId} - ${ctx.guestName}`;
    const linkBtn = document.getElementById('btn-link-table');
    if (linkBtn) {
        const isMaster = (table.activeBills || []).some(b => b.billID === billId && b.colorIndex !== 5);
        linkBtn.style.display = isMaster ? 'inline-block' : 'none';
    }
    if (!preserveCart) cart = [];
    preserveCart = false;
    renderTableSidebar();
    renderMenu('');
    renderCart();
}

// ── Menu ──────────────────────────────────────────────────

function renderMenu(search = '') {
    const grid = document.getElementById('rest-waiter-menu-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const filtered = menu.filter(i => {
        const name = (i.name || i.Name || i.itemName || '').toLowerCase();
        const cat = (i.category || i.Category || '').toLowerCase();
        const s = search.toLowerCase();
        const matchesSearch = name.includes(s) || cat.includes(s);
        const available = i.isAvailable !== false && !unavailableItems.includes(i.id);
        return matchesSearch && available;
    });
    if (filtered.length === 0) {
        grid.innerHTML = '<div style="text-align:center;padding:2rem;color:gray;grid-column:1/-1;">No items found</div>';
        return;
    }
    const cats = {};
    filtered.forEach(item => { 
        const c = item.category || 'General'; 
        if (!cats[c]) cats[c] = []; 
        cats[c].push(item); 
    });
    
    // Sort categories (Main Course first, etc)
    const sortedCats = Object.keys(cats).sort((a,b) => {
        if (a === 'Main Course') return -1;
        if (b === 'Main Course') return 1;
        return a.localeCompare(b);
    });

    sortedCats.forEach(cat => {
        const h = document.createElement('div');
        h.className = 'menu-category-header'; h.innerText = cat.toUpperCase(); grid.appendChild(h);
        cats[cat].forEach(item => {
            const el = document.createElement('div'); el.className = 'menu-item';
            const img = item.imageUrl || item.ImageURL || item.image || 'br.png';
            const name = item.name || item.Name || item.itemName || 'Unnamed Item';
            const price = item.price || item.PriceFull || item.Price || item.priceFull || 0;
            const desc = item.description || item.Description || 'Special';

            el.innerHTML = `
                <img src="${img}" onerror="this.src='br.png'">
                <div class="menu-info">
                    <div class="menu-name">${name}</div>
                    <div class="menu-desc">${desc}</div>
                    <div class="menu-price">₹${price}</div>
                </div>
                <button class="menu-add-btn" 
                    onclick="window.waiterApp.promptVariant({id:'${item.id}',name:'${name.replace(/'/g,"\\'")}',price:${price}})">
                    ADD
                </button>`;
            grid.appendChild(el);
        });
    });
}

function filterMenu(val) { renderMenu(val); }

// ── Cart ──────────────────────────────────────────────────

let pendingPortionItem = null;
let pendingPortionVariant = null;
let pendingPortionQty = 1;

window.waiterApp = {
    promptVariant: function(item) {
        if (!activeTableId) { showToast('Select a table first', 'warning'); return; }
        pendingPortionItem = item;
        const modal = document.getElementById('quantity-prompt-modal');
        const name = item.name || 'Item';
        document.getElementById('qp-item-name').innerText = name;
        
        const type = item.portionType || 'Plate';
        const viewVar = document.getElementById('qp-view-variant');
        const viewQty = document.getElementById('qp-view-quantity');
        
        viewVar.style.display = 'flex';
        viewQty.style.display = 'none';

        if (type === 'Plate' || type === 'Portion') {
            const price = item.price || 0;
            const priceHalf = item.priceHalf || 0;
            viewVar.innerHTML = `
                <p class="text-sm text-gray">Select Portion Size</p>
                <div style="display:flex;flex-direction:column;gap:1.2rem;margin-top:1rem;">
                    <button class="btn btn-outline" style="padding:1.5rem;font-size:1.1rem;" onclick="qpSelectVariant('Full', 'Full Plate', ${price})">Full Plate — ₹${price}</button>
                    ${priceHalf > 0 ? `<button class="btn btn-outline" style="padding:1.5rem;font-size:1.1rem;border-color:var(--color-indigo-400);" onclick="qpSelectVariant('Half', 'Half Plate', ${priceHalf})">Half Plate — ₹${priceHalf}</button>` : ''}
                    <button class="btn btn-outline" style="border:none;text-decoration:underline;margin-top:1rem;" onclick="document.getElementById('quantity-prompt-modal').style.display='none'">Cancel</button>
                </div>
            `;
        } else {
            qpSelectVariant('Regular', 'Standard', item.price || 0);
        }
        modal.style.display = 'flex';
    }
};

window.qpSelectVariant = function(variant, label, price) {
    pendingPortionVariant = { variant, label, price };
    pendingPortionQty = 1;
    
    document.getElementById('qp-view-variant').style.display = 'none';
    const viewQty = document.getElementById('qp-view-quantity');
    viewQty.style.display = 'flex';
    
    document.getElementById('qp-selected-variant-text').innerText = label;
    document.getElementById('qp-qty').value = 1;
};

window.qpBack = function() {
    document.getElementById('qp-view-variant').style.display = 'flex';
    document.getElementById('qp-view-quantity').style.display = 'none';
};

window.addToCartFromModal = function() {
    const qty = parseInt(document.getElementById('qp-qty').value) || 1;
    const finalPrice = pendingPortionVariant.price;
    const finalName = pendingPortionVariant.variant === 'Full' || pendingPortionVariant.variant === 'Regular' ? pendingPortionItem.name : `${pendingPortionItem.name} (${pendingPortionVariant.label})`;

    const existing = cart.find(i => i.item.id === pendingPortionItem.id && i.variant === pendingPortionVariant.variant);
    if (existing) {
        existing.qty += qty;
    } else {
        cart.push({
            item: {
                id: pendingPortionItem.id,
                name: finalName,
                price: finalPrice
            },
            variant: pendingPortionVariant.variant,
            qty: qty
        });
    }
    
    renderCart();
    document.getElementById('quantity-prompt-modal').style.display = 'none';
    showToast('Added to cart', 'success');
};


function renderCart() {
    const el = document.getElementById('rest-waiter-cart-items');
    const tot = document.getElementById('rest-waiter-cart-total');
    const btn = document.getElementById('btn-rest-waiter-order');
    if (!el) return;
    if (cart.length === 0) {
        el.innerHTML = '<div class="empty-cart">Cart is empty</div>';
        tot.innerText = '0'; btn.disabled = true; return;
    }
    let total = 0; el.innerHTML = '';
    cart.forEach(c => {
        const it = c.qty * c.item.price; total += it;
        const d = document.createElement('div'); d.className = 'cart-item';
        d.innerHTML = `<div><span class="cart-item-qty">${c.qty}x</span><span>${c.item.name}</span></div><span>₹${it}</span>`;
        el.appendChild(d);
    });
    tot.innerText = total; btn.disabled = false;
    const info = document.getElementById('rest-waiter-table-info');
    if (info && info.innerText) {
        const base = info.innerText.split(' | Total:')[0];
        info.innerHTML = `${base} <span style="color:var(--color-green-400);font-weight:bold;margin-left:0.5rem;">| Total: ₹${total}</span>`;
    }
}

// ── Place Order ───────────────────────────────────────────

function showOrderConfirm() {
    if (!activeTableId || cart.length === 0) return;
    const table = tables[activeTableId]; if (!table) return;
    const total = cart.reduce((s, c) => s + (c.item.price * c.qty), 0);
    const info = document.getElementById('rest-waiter-table-info').innerText;
    const m = info.match(/Bill\s([A-Z0-9-]+)\s-/);
    const billId = m ? m[1] : (editingOrderId || `${activeTableId}${table.lastSeqId || 1}`);
    document.getElementById('confirm-order-id').innerText = billId;
    document.getElementById('confirm-order-items').innerHTML =
        cart.map(c => `<div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;"><span style="color:var(--color-slate-400)">${c.qty}x</span> <span>${c.item.name}</span> <span style="color:var(--color-indigo-400);">₹${c.qty * c.item.price}</span></div>`).join('') +
        `<div style="margin-top:1rem;padding-top:1rem;border-top:1px dashed var(--glass-border);display:flex;justify-content:space-between;font-weight:bold;font-size:1.2rem;"><span>Total</span><span style="color:var(--color-green-400);">₹${total}</span></div>`;
    document.getElementById('order-confirm-modal').style.display = 'flex';
}

async function confirmOrder() {
    document.getElementById('order-confirm-modal').style.display = 'none';
    await placeOrder();
}

async function placeOrder() {
    if (_isPlacingOrder) return;
    _isPlacingOrder = true;

    try {
        if (!activeTableId || cart.length === 0) { _isPlacingOrder = false; return; }
        const table = tables[activeTableId]; if (!table) { _isPlacingOrder = false; return; }

        const itemsList = cart.map(c => ({
            id: c.item.id, name: c.item.name,
            price: Number(c.item.price), qty: Number(c.qty),
            variant: c.variant || 'Full'
        }));
        const total = cart.reduce((s, c) => s + (c.item.price * c.qty), 0);

        showToast('Sending to Kitchen...', 'info');

        // Get order ID
        let orderIdStr = editingOrderId;
        let isUpdating = !!orderIdStr;
        if (!isUpdating) {
            orderIdStr = await getNextOrderSerial(activeTableId);
        }

        const orderObj = {
            id: orderIdStr,
            order_id: orderIdStr,
            tableId: String(activeTableId),
            roomNumber: null,
            items: isUpdating
                ? [...(table.orders?.find(o => o.id === orderIdStr)?.items || []), ...itemsList]
                : itemsList,
            total: isUpdating
                ? ((table.orders?.find(o => o.id === orderIdStr)?.total || 0) + total)
                : Number(total),
            total_price: Number(total),
            status: 'preparing',
            orderType: 'Table',
            guestName: currentGuestName || 'Walk-in',
            pax: currentPax || 1,
            timestamp: Date.now()
        };

        // Push to Firestore → KDS sees it instantly
        await pushOrderToCloud(orderObj);

        // Update table state locally + cloud
        if (!table.orders) table.orders = [];
        const existIdx = table.orders.findIndex(o => o.id === orderIdStr);
        if (existIdx !== -1) { table.orders[existIdx] = orderObj; }
        else { table.orders.push(orderObj); table.total = (table.total || 0) + total; }
        await pushTableToCloud(table);

        // Push notification to Firestore → Desk sees it
        await pushNotification(
            'order',
            `${isUpdating ? 'ADD-ON' : 'DINE-IN ORDER'}: Table ${activeTableId} — Bill ${orderIdStr}`,
            'desk',
            { type: isUpdating ? 'addon' : 'dinein', orderId: orderIdStr, tableId: String(activeTableId) }
        );

        // Clear cart and show success
        cart = []; editingOrderId = null;
        renderCart();
        renderTableSidebar();
        showSuccessOverlay(orderObj, isUpdating);

    } catch (e) {
        console.error('[placeOrder] Failed:', e);
        showToast('Order failed. Check connection.', 'error');
    } finally {
        _isPlacingOrder = false;
    }
}

function showSuccessOverlay(order, isAddon) {
    const ov = document.getElementById('success-overlay-pms'); if (!ov) return;
    const table = tables[order.tableId];
    const bill = (table?.activeBills || []).find(b => b.billID === order.id);
    const colors = {1:'#FF3131',2:'#39FF14',3:'#1F51FF',4:'#FFF01F',5:'#A020F0'};
    const col = (bill && colors[bill.colorIndex]) || '#F59E0B';
    const txt = isAddon ? `ADD-ON ${order.id}` : `ORDER ${order.id}`;
    ov.innerHTML = `
        <div style="margin-bottom:1.5rem;">
            <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none" style="stroke:${col}!important;"/>
                <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" style="stroke:${col}!important;"/>
            </svg>
        </div>
        <h2 style="color:${col};font-size:2.5rem;text-shadow:0 0 15px ${col}80;">${txt}</h2>
        <h3 style="color:white;font-weight:500;margin-top:0.5rem;">Table ${order.tableId}</h3>
        <div style="background:rgba(0,0,0,0.5);padding:1.5rem;border-radius:12px;max-width:400px;margin-top:1rem;font-family:monospace;max-height:200px;overflow-y:auto;">
            ${(order.items || []).map(i => `<div>• ${typeof i==='object'?`${i.qty}x ${i.name}`:i}</div>`).join('')}
        </div>
        <div style="color:${col};font-weight:bold;margin-top:1rem;font-size:1.2rem;">Total: ₹${order.total_price || order.total}</div>`;
    ov.style.display = 'flex';
    try { document.getElementById('success-chime')?.play().catch(() => {}); } catch(e) {}
    setTimeout(() => {
        ov.style.display = 'none';
        activeTableId = null;
        document.getElementById('rest-waiter-pos-title').innerText = 'Select a table';
        document.getElementById('rest-waiter-table-info').innerText = '';
        document.getElementById('rest-waiter-cart-items').innerHTML = '';
        document.getElementById('rest-waiter-cart-total').innerText = '0';
        const btn = document.getElementById('btn-rest-waiter-order');
        if (btn) btn.disabled = true;
        const linkBtn = document.getElementById('btn-link-table');
        if (linkBtn) linkBtn.style.display = 'none';
        renderTableSidebar();
    }, 1500);
}

// ── Link Table ────────────────────────────────────────────

function showLinkTableModal() {
    const info = document.getElementById('rest-waiter-table-info').innerText;
    const m = info.match(/Bill\s([A-Z0-9-]+)\s-\s(.+)/);
    if (!m) return;
    currentLinkContext = { billId: m[1], gName: m[2].split(' |')[0] };
    document.getElementById('link-table-subtitle').innerText = `Linking to Master Bill ${m[1]}`;
    const existEl = document.getElementById('link-existing-list');
    existEl.innerHTML = '';
    let hasEx = false;
    Object.values(tables).forEach(t => {
        (t.activeBills || []).forEach(b => {
            if (b.billID === m[1] && b.colorIndex === 5) {
                hasEx = true;
                existEl.innerHTML += `<div style="padding:1rem;border:1px solid #A020F0;border-radius:8px;margin-bottom:0.5rem;background:rgba(160,32,240,0.1);">
                    <div style="font-weight:bold;color:#A020F0;">Table ${t.id}</div>
                    <div class="text-sm text-gray">${b.pax} Guests</div></div>`;
            }
        });
    });
    if (!hasEx) existEl.innerHTML = '<div style="text-align:center;color:var(--color-slate-400);padding:2rem;">No linked tables yet</div>';
    document.getElementById('link-pax-input').value = 1;
    renderLinkDropdown();
    document.getElementById('link-table-modal').style.display = 'flex';
}

function renderLinkDropdown() {
    const dd = document.getElementById('link-table-dropdown'); dd.innerHTML = '';
    Object.values(tables).forEach(t => {
        const occ = (t.activeBills || []).reduce((a, b) => a + (b.pax || 0), 0);
        const avail = 4 - occ;
        if (avail > 0) {
            const opt = document.createElement('option');
            opt.value = t.id; opt.innerText = `Table ${t.id} (${avail} seats available)`;
            dd.appendChild(opt);
        }
    });
}

async function submitLinkTable() {
    const tid = document.getElementById('link-table-dropdown').value;
    const pax = parseInt(document.getElementById('link-pax-input').value) || 1;
    if (!tid || !currentLinkContext) return;
    const { billId, gName } = currentLinkContext;
    const target = tables[tid]; if (!target) return;
    let masterTable = null;
    Object.values(tables).forEach(t => {
        if ((t.activeBills || []).some(b => b.billID === billId && b.colorIndex !== 5)) masterTable = t;
    });
    if (!masterTable) return;
    const masterBill = masterTable.activeBills.find(b => b.billID === billId);
    let linkTag = '';
    if (masterBill.linkGroupId) { linkTag = masterBill.linkGroupId; }
    else {
        const tags = [];
        Object.values(tables).forEach(t => (t.activeBills || []).forEach(b => { if (b.linkGroupId) tags.push(b.linkGroupId); }));
        let n = 1; while (tags.includes(`L${n}`)) n++;
        linkTag = `L${n}`;
        masterBill.colorIndex = 5; masterBill.linkGroupId = linkTag;
    }
    target.status = 'occupied'; target.pax = (target.pax || 0) + pax;
    target.guestName = `Linked: ${gName}`;
    if (!target.activeBills) target.activeBills = [];
    target.activeBills.push({ guestName: `Linked: ${gName}`, pax, billID: billId, colorIndex: 5, linkGroupId: linkTag });
    if (target.chairs) { let r = pax; target.chairs.forEach(c => { if (c.status === 'available' && r > 0) { c.status = 'occupied'; r--; } }); }
    await pushTableToCloud(target);
    await pushTableToCloud(masterTable);
    await pushNotification('order', `${billId} LINKED TABLE ${tid}`, 'desk', { style: 'purple' });
    document.getElementById('link-table-modal').style.display = 'none';
    renderTableSidebar();
    showToast(`Table ${tid} linked to Bill ${billId}`, 'success');
}

async function handleLogout() {
    try {
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (e) {
        window.location.href = 'login.html';
    }
}

// ── Export to window ──────────────────────────────────────
// All functions exposed so inline HTML onclick handlers work
window.waiterApp = {
    promptVariant, qpSelectVariant, qpBack, addToCartFromModal,
    submitTableCheckin, cancelModal, showOrderConfirm, confirmOrder,
    showLinkTableModal, renderLinkDropdown, submitLinkTable, filterMenu,
    handleLogout
};

// Also expose directly for legacy onclick="..." handlers
window.submitTableCheckin = submitTableCheckin;
window.cancelModal = cancelModal;
window.showOrderConfirm = showOrderConfirm;
window.confirmOrder = confirmOrder;
window.showLinkTableModal = showLinkTableModal;
window.renderLinkDropdown = renderLinkDropdown;
window.submitLinkTable = submitLinkTable;
window.filterMenu = filterMenu;
window.qpSelectVariant = qpSelectVariant;
window.qpBack = qpBack;
window.addToCartFromModal = addToCartFromModal;
window.app = { promptVariant }; // For menu-add-btn onclick compatibility

// ── Boot ──────────────────────────────────────────────────
init().catch(e => console.error('[Boot] Failed:', e));
