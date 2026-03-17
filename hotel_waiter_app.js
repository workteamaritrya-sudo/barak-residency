/**
 * ════════════════════════════════════════════════════════════
 * BARAK RESIDENCY — Hotel Waiter App
 * Standalone · Firebase Firestore · Order for Hotel Rooms
 * ════════════════════════════════════════════════════════════
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import {
    getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc,
    onSnapshot, query, orderBy, limit, updateDoc, serverTimestamp,
    runTransaction, increment, arrayUnion
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
let rooms = {};
let menu = [];
let waiterCart = [];
let selectedRoom = null;
let addonOrderId = null;
let unavailableItems = [];

// ── Listeners ─────────────────────────────────────────────

function startListeners() {
    // Listen to Rooms
    onSnapshot(collection(db, 'rooms'), (snap) => {
        snap.forEach(d => { rooms[d.id] = d.data(); });
        populateRoomSelect();
    });

    // Listen to Menu
    onSnapshot(collection(db, 'menuItems'), (snap) => {
        const newMenu = [];
        snap.forEach(d => {
            const data = d.data();
            newMenu.push({ id: d.id, ...data });
        });
        menu = newMenu;
        renderMenu();
    });

    // Listen to Availability
    onSnapshot(doc(db, 'settings', 'availability'), (snap) => {
        if (snap.exists()) {
            unavailableItems = snap.data().unavailableItems || [];
            renderMenu();
        }
    });

    // Listen to all orders for live view (filtering for selected room)
    onSnapshot(collection(db, 'orders'), (snap) => {
        renderLiveOrders();
    });
}

// ── UI Logic ──────────────────────────────────────────────

function populateRoomSelect() {
    const select = document.getElementById('waiter-room-select');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">📋 Choose Room...</option>';
    Object.values(rooms).filter(r => r.status === 'occupied').forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.number;
        opt.innerText = `Room ${r.number} — ${r.guestName || 'Active Guest'}`;
        select.appendChild(opt);
    });
    if (currentVal) select.value = currentVal;
}

window.selectRoom = function(roomNum) {
    selectedRoom = roomNum;
    addonOrderId = null;
    document.getElementById('ordering-room-display').innerText = roomNum ? `ROOM ${roomNum} — NEW ORDER` : 'SELECT A ROOM TO BEGIN';
    document.getElementById('waiter-addon-badge').style.display = 'none';
    waiterCart = [];
    updateCartUI();
    renderLiveOrders();
};

function renderMenu(categoryFilter = 'All') {
    const grid = document.getElementById('order-menu-grid');
    const pills = document.getElementById('order-categories');
    if (!grid) return;

    const filteredMenu = menu.filter(i => i.isAvailable !== false && !unavailableItems.includes(i.id));
    
    // Categories
    const cats = ['All', ...new Set(filteredMenu.map(i => i.category || i.Category || 'General'))];
    if (pills) {
        pills.innerHTML = cats.map(c => `<button class="waiter-cat-pill ${categoryFilter === c ? 'active' : ''}" onclick="window.renderMenu('${c}')">${c}</button>`).join('');
    }

    const items = categoryFilter === 'All' ? filteredMenu : filteredMenu.filter(i => (i.category || i.Category) === categoryFilter);

    grid.innerHTML = items.map(i => {
        const name = i.name || i.Name || 'Item';
        const price = i.price || i.PriceFull || 0;
        const priceH = i.priceHalf || 0;
        const imgUrl = i.imageUrl || 'br.png';
        const halfLine = priceH ? `<div class="item-half-price">Half: ₹${priceH}</div>` : '';
        return `
            <div class="waiter-menu-card" onclick="window.promptPortion('${i.id}')">
                <img src="${imgUrl}" onerror="this.src='br.png'" style="width:100%; height:80px; object-fit:cover; border-radius:8px;" />
                <div class="item-name">${name}</div>
                <div class="item-price">₹${price}</div>
                ${halfLine}
            </div>`;
    }).join('');
}
window.renderMenu = renderMenu;

window.promptPortion = function(itemId) {
    if (!selectedRoom) { showToast('Please select a room first!', 'warning'); return; }
    const item = menu.find(i => i.id === itemId);
    if (!item) return;

    const modal = document.getElementById('waiter-portion-modal');
    document.getElementById('wpm-item-name').innerText = item.name || item.Name;
    document.getElementById('wpm-item-desc').innerText = item.description || 'Select preference';
    const ctn = document.getElementById('wpm-options-container');
    ctn.innerHTML = '';

    const price = item.price || item.PriceFull || 0;
    const type = item.portionType || 'Plate';

    if (type === 'Plate') {
        const halfPrice = item.priceHalf || Math.floor(price * 0.6);
        const opts = [{ label: 'Full Plate', val: 'Full', price: price }];
        if (halfPrice > 0) opts.push({ label: 'Half Plate', val: 'Half', price: halfPrice });
        opts.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'wpm-opt-btn';
            btn.innerHTML = `<span>${opt.label}</span> <span>₹${opt.price}</span>`;
            btn.onclick = () => promptQuantity(item, opt.val, opt.label, opt.price);
            ctn.appendChild(btn);
        });
    } else {
        promptQuantity(item, 'Regular', 'Standard', price);
    }
    modal.style.display = 'flex';
};

function promptQuantity(item, variant, label, price) {
    const ctn = document.getElementById('wpm-options-container');
    document.getElementById('wpm-item-name').innerText = `${item.name || item.Name} (${label})`;
    ctn.innerHTML = '';
    let qty = 1;

    const counter = document.createElement('div');
    counter.className = 'wpm-counter';
    counter.innerHTML = `
        <button onclick="window.updateQty(-1)">-</button>
        <div id="wpm-qty-val">1</div>
        <button onclick="window.updateQty(1)">+</button>
    `;
    ctn.appendChild(counter);

    const addBtn = document.createElement('button');
    addBtn.className = 'wpm-add-btn';
    addBtn.innerText = `ADD TO CART — ₹${price}`;
    addBtn.onclick = () => {
        const cartItem = {
            id: `${item.id}_${variant}`,
            name: variant === 'Full' || variant === 'Regular' ? (item.name || item.Name) : `${item.name || item.Name} (${label})`,
            price: price,
            qty: qty,
            variant: variant
        };
        const existing = waiterCart.find(c => c.id === cartItem.id);
        if (existing) existing.qty += qty;
        else waiterCart.push(cartItem);
        updateCartUI();
        document.getElementById('waiter-portion-modal').style.display = 'none';
        showToast('Added to cart', 'success');
    };
    ctn.appendChild(addBtn);

    window.updateQty = (delta) => {
        qty = Math.max(1, qty + delta);
        document.getElementById('wpm-qty-val').innerText = qty;
        addBtn.innerText = `ADD TO CART — ₹${price * qty}`;
    };
}

function updateCartUI() {
    const container = document.getElementById('waiter-cart-items');
    let total = 0;
    if (waiterCart.length === 0) {
        container.innerHTML = '<div class="empty-msg">Cart is empty</div>';
    } else {
        container.innerHTML = waiterCart.map((item, idx) => {
            total += item.price * item.qty;
            return `
                <div class="cart-row">
                    <div class="cart-info">
                        <div class="cart-name">${item.name}</div>
                        <div class="cart-sub">₹${item.price} × ${item.qty}</div>
                    </div>
                    <div class="cart-controls">
                        <button onclick="window.changeCartQty(${idx}, -1)">-</button>
                        <span>${item.qty}</span>
                        <button onclick="window.changeCartQty(${idx}, 1)">+</button>
                    </div>
                </div>`;
        }).join('');
    }
    document.getElementById('waiter-total-amt').innerText = total;
    document.getElementById('waiter-place-btn').disabled = !(selectedRoom && waiterCart.length > 0);
}

window.changeCartQty = (idx, delta) => {
    waiterCart[idx].qty += delta;
    if (waiterCart[idx].qty <= 0) waiterCart.splice(idx, 1);
    updateCartUI();
};

function renderLiveOrders() {
    const container = document.getElementById('waiter-live-orders');
    if (!container || !selectedRoom) return;

    const roomOrders = Object.values(rooms).find(r => r.number === String(selectedRoom))?.orders || [];
    // Or better, fetch from orders collection
    const filtered = Object.values(rooms).find(r => r.number === String(selectedRoom)) ? 
        // We'll use the rooms collection's orders if synced, or listen to orders collection
        [] : [];
        
    // Let's use a simpler way: the real-time listener updates a local orders list
    // For now, I'll filter the global kitchenOrders (I need to fetch them)
}

// ── Actions ───────────────────────────────────────────────

window.placeOrder = async function() {
    if (!selectedRoom || waiterCart.length === 0) return;
    const btn = document.getElementById('waiter-place-btn');
    btn.disabled = true;
    btn.innerText = '⌛ PLACING...';

    const roomNum = selectedRoom;
    const room = rooms[roomNum] || {};
    const total = waiterCart.reduce((s, i) => s + (i.price * i.qty), 0);

    try {
        if (addonOrderId) {
            // Add-on logic
            const orderRef = doc(db, 'orders', addonOrderId);
            await updateDoc(orderRef, {
                items: arrayUnion(...waiterCart),
                total_price: increment(total),
                isAddon: true,
                status: 'Pending'
            });
            showToast('Add-on placed!', 'success');
        } else {
            // New order logic
            const orderId = `R${roomNum}-${Date.now().toString().slice(-4)}`;
            const orderObj = {
                order_id: orderId,
                roomNumber: String(roomNum),
                guestName: room.guestName || 'Guest',
                items: waiterCart,
                total_price: total,
                status: 'Pending',
                timestamp: serverTimestamp(),
                orderType: 'Room'
            };
            await setDoc(doc(db, 'orders', orderId), orderObj);
            showToast('Order placed!', 'success');
        }
        waiterCart = [];
        updateCartUI();
    } catch (e) {
        console.error(e);
        showToast('Order failed', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = '🚀 PLACE ORDER';
    }
};

window.handleLogout = async () => {
    await signOut(auth);
    window.location.href = 'login.html';
};

function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// ── Bootstrap ──────────────────────────────────────────────
init();

async function init() {
    onAuthStateChanged(auth, user => {
        if (!user) window.location.href = 'login.html';
        else startListeners();
    });
}
