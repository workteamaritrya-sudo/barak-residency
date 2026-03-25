/**
 * BARAK RESIDENCY — Restaurant Pickup & Table Add-on
 * Independent Standalone POS Module
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs, onSnapshot, updateDoc, setDoc, addDoc, query, where, arrayUnion, serverTimestamp, increment, runTransaction } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getDatabase, ref, push, set } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyANudXFm6QK4jJXKtXtAaDe9hWFDcBF8Vo",
    authDomain: "barak-residency-59405.firebaseapp.com",
    projectId: "barak-residency-59405",
    databaseURL: "https://barak-residency-59405-default-rtdb.firebaseio.com",
    storageBucket: "barak-residency-59405.firebasestorage.app",
    messagingSenderId: "3871550492",
    appId: "1:3871550492:web:2cf49bc0a963b4888f43d9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let menu = [];
let tables = [];
let cart = [];
let orderType = 'Pickup'; // 'Pickup' or 'Table'
let unavailableItems = [];
let activeCategory = 'All';

// Listen for Auth
onAuthStateChanged(auth, u => {
    if (!u && window.self === window.top) window.location.href = 'index.html';
});

// ─── Reset UI state — called on reopen or after successful order ───
function resetState() {
    const ss = document.getElementById('success-screen');
    if (ss) ss.style.display = 'none';
    cart = [];
    orderType = 'Pickup';
    renderCart();
    window.setOrderType && window.setOrderType('Pickup');
    const btn = document.getElementById('place-btn') || document.getElementById('btn-mob-order');
    if (btn) { btn.disabled = true; btn.textContent = 'PLACE ORDER'; }
    const cartOverlay = document.getElementById('cart-overlay-mob');
    if (cartOverlay) cartOverlay.classList.remove('active');
}

// Listen for parent 'reset' message (called when overlay is reopened from cache)
window.addEventListener('message', (e) => {
    if (e.data?.action === 'reset') resetState();
});

window.backToHome = () => {
    resetState();
    window.location.href = 'staff_home.html';
};

// Real-time Listeners
onSnapshot(collection(db, 'menuItems'), snap => {
    menu = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMenu();
}, err => console.warn('[Menu] Listen failed', err));

onSnapshot(doc(db, 'settings', 'availability'), snap => {
    if (snap.exists()) unavailableItems = snap.data().unavailableItems || [];
    renderMenu();
});

onSnapshot(collection(db, 'tables'), snap => {
    tables = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => (t.status || '').toLowerCase() === 'occupied');
    renderTables();
}, err => console.warn('[Tables] Listen failed', err));

function renderTables() {
    const sel = document.getElementById('table-select');
    if (!sel) return;
    sel.innerHTML = tables.map(t => `<option value="${t.id}">Table ${t.id} - ${t.guestName || 'Active Bill'}</option>`).join('');
    if (tables.length === 0) sel.innerHTML = '<option value="">No active tables found</option>';
}

// --- Global order ID using system_counters ---
async function getNextOrderId() {
    const counterRef = doc(db, 'system_counters', 'orders');
    let newId;
    try {
        await runTransaction(db, async (tx) => {
            const snap = await tx.get(counterRef);
            const current = snap.exists() ? (snap.data().currentId || 100) : 100;
            newId = current + 1;
            tx.set(counterRef, { currentId: newId }, { merge: true });
        });
        return `BR-${newId}`;
    } catch (e) {
        return `BR-${Date.now().toString().slice(-6)}`;
    }
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

// --- Add to Table flow (Pickup items pushed to active table with isAddOn:true) ---
window.showAddToTable = function() {
    const activeTables = tables; // already filtered to occupied tables from the listener
    if (activeTables.length === 0) {
        showToastLocal('No active tables found', 'error');
        return;
    }
    const modal = document.getElementById('add-to-table-modal');
    if (!modal) {
        // Build modal on-the-fly if not in HTML
        const m = document.createElement('div');
        m.id = 'add-to-table-modal';
        m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;';
        m.innerHTML = `
            <div style="background:#0D1B2A;border:1px solid #D4AF37;border-radius:16px;padding:2rem;max-width:360px;width:90%;">
                <h3 style="color:#D4AF37;margin-bottom:1rem;">Add Cart to Table</h3>
                <p style="color:rgba(255,255,255,0.5);font-size:0.85rem;margin-bottom:1rem;">Select an active table to add these items as urgent add-ons.</p>
                <select id="addon-table-select" style="width:100%;padding:0.8rem;background:#050B1A;border:1px solid rgba(255,255,255,0.1);color:white;border-radius:10px;margin-bottom:1rem;">
                    ${activeTables.map(t => `<option value="${t.id}">Table ${t.id} ${t.guestName ? '— '+t.guestName : ''}</option>`).join('')}
                </select>
                <div style="display:flex;gap:1rem;">
                    <button onclick="window.confirmAddToTable()" style="flex:1;padding:0.9rem;background:linear-gradient(135deg,#C9A227,#D4AF37);color:#000;font-weight:700;border:none;border-radius:10px;cursor:pointer;">CONFIRM ADD</button>
                    <button onclick="document.getElementById('add-to-table-modal').remove()" style="flex:1;padding:0.9rem;background:rgba(255,255,255,0.05);color:white;border:1px solid rgba(255,255,255,0.1);border-radius:10px;cursor:pointer;">CANCEL</button>
                </div>
            </div>`;
        document.body.appendChild(m);
    } else {
        modal.style.display = 'flex';
    }
};

function showToastLocal(msg, type = 'info') {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;bottom:5rem;right:1.5rem;padding:0.75rem 1.25rem;border-radius:8px;font-weight:600;font-size:0.9rem;z-index:99999;background:${type==='success'?'#4ADE80':type==='error'?'#EF4444':'#E5C366'};color:#050B1A;`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

window.confirmAddToTable = async function() {
    const sel = document.getElementById('addon-table-select');
    if (!sel || cart.length === 0) return;
    const tId = sel.value;
    if (!tId) return;
    try {
        const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
        const addOnItems = cart.map(i => ({ ...i, isAddOn: true, urgent: true }));
        const orderId = await getNextOrderId();
        const orderObj = {
            id: orderId,
            order_id: orderId,
            tableId: String(tId),
            items: addOnItems,
            total,
            total_price: total,
            status: 'Pending',
            orderType: 'table_addon',
            isAddOn: true,
            timestamp: Date.now()
        };
        await setDoc(doc(db, 'orders', orderId), orderObj);
        await updateDoc(doc(db, 'tables', tId), {
            orders: arrayUnion(orderObj),
            total: increment(total),
            updatedAt: serverTimestamp()
        });
        // Notify desk and kitchen
        await pushNotification('addon', `ADD-ON: Table ${tId} — ${addOnItems.length} items from Pickup`, 'desk', { tableId: tId, items: addOnItems, isAddOn: true });
        await pushNotification('kot', `URGENT KOT (Add-on): Table ${tId} — ${addOnItems.map(i=>i.qty+'x '+i.name).join(', ')}`, 'kitchen', { tableId: tId, items: addOnItems, isAddOn: true });
        const m = document.getElementById('add-to-table-modal');
        if (m) m.remove();
        cart = [];
        renderCart();
        showToastLocal(`Items added to Table ${tId} as urgent add-ons!`, 'success');
    } catch (e) {
        showToastLocal('Add to table failed: ' + e.message, 'error');
    }
};

window.setOrderType = (type) => {
    orderType = type;
    document.getElementById('toggle-pickup').className = (type === 'Pickup' ? 'active' : '');
    document.getElementById('toggle-table').className = (type === 'Table' ? 'active' : '');
    document.getElementById('table-selector-wrap').style.display = (type === 'Table' ? 'block' : 'none');
};

window.renderMenu = () => {
    const grid = document.getElementById('menu-grid');
    const pills = document.getElementById('menu-categories');
    const search = document.getElementById('menu-search').value.toLowerCase();
    
    if (!grid) return;

    const filtered = menu.filter(i => {
        const name = (i.name || i.Name || i.itemName || '').toLowerCase();
        const cat = (i.category || i.Category || 'General');
        const available = i.isAvailable !== false && !unavailableItems.includes(i.id);
        const matchSearch = (name.includes(search) || cat.toLowerCase().includes(search));
        const matchCat = (activeCategory === 'All' || cat === activeCategory);
        return available && matchSearch && matchCat;
    });

    const cats = ['All', ...new Set(menu.filter(i => i.isAvailable !== false).map(i => i.category || 'General'))];
    if (pills) {
        pills.innerHTML = cats.map(c => `
            <button class="cat-pill ${c === activeCategory ? 'active' : ''}" 
                    style="min-width:110px;" 
                    onclick="window.setCategory('${c}')">${c}</button>
        `).join('');
    }

    grid.innerHTML = filtered.map(i => `
        <div class="waiter-menu-card" onclick="window.promptPortion('${i.id}')">
            <img src="${i.imageUrl || 'br.png'}" style="width:100%; height:80px; object-fit:cover; border-radius:12px;" onerror="this.src='br.png'">
            <div style="font-weight:700; color:white; font-size:0.9rem; margin:0.5rem 0;">${i.name || i.itemName}</div>
            <div style="font-weight:900; color:var(--gold-primary);">₹${i.price}</div>
        </div>
    `).join('');
};

window.setCategory = (c) => {
    activeCategory = c;
    window.renderMenu();
};

window.promptPortion = (id) => {
    const item = menu.find(i => i.id === id);
    if (!item) return;

    const modal = document.getElementById('portion-modal');
    const ctn = document.getElementById('pm-options');
    document.getElementById('pm-item-name').innerText = item.name || item.itemName;
    
    ctn.innerHTML = `
        <button class="wpm-opt-btn" onclick="window.addToCart('${id}', 'Full', ${item.price})"><span>Full Plate</span> <span>₹${item.price}</span></button>
    `;
    if (item.priceHalf > 0) {
        ctn.innerHTML += `
            <button class="wpm-opt-btn" onclick="window.addToCart('${id}', 'Half', ${item.priceHalf})"><span>Half Plate</span> <span>₹${item.priceHalf}</span></button>
        `;
    }
    modal.style.display = 'flex';
};

window.addToCart = (id, flavor, price) => {
    const item = menu.find(i => i.id === id);
    const cartId = `${id}_${flavor}`;
    const existing = cart.find(c => c.cartId === cartId);
    if (existing) {
        existing.qty++;
    } else {
        cart.push({ cartId, id, name: (flavor === 'Full' ? item.name : `${item.name} (${flavor})`), price, qty: 1 });
    }
    document.getElementById('portion-modal').style.display = 'none';
    renderCart();
};

function renderCart() {
    const ctnCommon = document.getElementById('cart-content-common');
    const placeholderMob = document.getElementById('cart-placeholder-mob');
    const badge = document.getElementById('cart-badge-val');
    const totalEl = document.getElementById('total-amt');
    const placeBtn = document.getElementById('place-btn');
    
    // Total Items for Badge
    const totalQty = cart.reduce((s, i) => s + i.qty, 0);
    if (badge) {
        badge.innerText = totalQty;
        badge.style.display = totalQty > 0 ? 'flex' : 'none';
    }

    if (cart.length === 0) {
        const emptyHtml = '<div style="color:gray;text-align:center;padding:2rem;">Cart is empty</div>';
        document.getElementById('cart-items').innerHTML = emptyHtml;
        if (placeholderMob) placeholderMob.innerHTML = emptyHtml;
        totalEl.innerText = '0';
        placeBtn.disabled = true;
        return;
    }

    const itemsHtml = cart.map((c, idx) => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:0.8rem; border-radius:12px; margin-bottom:0.8rem; border:1px solid rgba(255,255,255,0.05);">
            <div style="flex:1;">
                <div style="font-weight:700; font-size:0.9rem; color:white;">${c.name}</div>
                <div style="color:var(--gold-primary); font-size:0.8rem;">₹${c.price}</div>
            </div>
            <div style="display:flex; align-items:center; gap:0.8rem;">
                <button onclick="window.updateCartQty(${idx}, -1)" style="width:28px; height:28px; border-radius:8px; border:none; background:rgba(255,255,255,0.1); color:white;">-</button>
                <div style="font-weight:900; min-width:20px; text-align:center; color:white;">${c.qty}</div>
                <button onclick="window.updateCartQty(${idx}, 1)" style="width:28px; height:28px; border-radius:8px; border:none; background:rgba(212,175,55,0.2); color:var(--gold-primary);">+</button>
            </div>
        </div>
    `).join('');

    document.getElementById('cart-items').innerHTML = itemsHtml;
    if (placeholderMob) {
        // For mobile, we clone the common controls but keep them functional
        placeholderMob.innerHTML = ctnCommon.innerHTML;
        // Re-inject items specifically into the mobile placeholder's cart-items div
        placeholderMob.querySelector('#cart-items').innerHTML = itemsHtml;
    }

    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    totalEl.innerText = total.toLocaleString();
    if (placeholderMob) placeholderMob.querySelector('#total-amt').innerText = total.toLocaleString();
    
    placeBtn.disabled = false;
    if (placeholderMob) placeholderMob.querySelector('#place-btn').disabled = false;
}

window.toggleCart = () => {
    document.getElementById('cart-overlay-mob').classList.toggle('active');
};

window.updateCartQty = (idx, delta) => {
    cart[idx].qty += delta;
    if (cart[idx].qty <= 0) cart.splice(idx, 1);
    renderCart();
};

window.submitOrder = async () => {
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    const btn = document.getElementById('place-btn');
    btn.disabled = true;
    btn.innerText = 'PLACING...';

    let orderIdStr = await getNextOrderId();
    let orderObj = null;

    if (orderType === 'Table') {
        const tId = document.getElementById('table-select').value;
        const targetTable = tables.find(t => String(t.id) === String(tId));
        
        if (targetTable && targetTable.activeBills && targetTable.activeBills.length > 0) {
            orderIdStr = targetTable.activeBills[0].billID;
        } else {
            orderIdStr = targetTable ? `${targetTable.id}-1` : `T-${Date.now().toString().slice(-4)}`;
        }

        const existingItemArray = targetTable?.orders?.find(o => o.id === orderIdStr)?.items || [];
        const existingTotal = targetTable?.orders?.find(o => o.id === orderIdStr)?.total || 0;

        orderObj = {
            id: orderIdStr,
            order_id: orderIdStr,
            tableId: String(tId),
            roomNumber: null,
            items: [...existingItemArray, ...cart],
            total: existingTotal + total,
            total_price: existingTotal + total,
            status: 'Pending',
            orderType: 'table',
            guestName: targetTable?.activeBills?.[0]?.guestName || 'Add-on Guest',
            pax: targetTable?.activeBills?.[0]?.pax || 1,
            timestamp: Date.now()
        };
    } else {
        orderObj = {
            orderId: orderIdStr, id: orderIdStr, items: cart, 
            total, total_price: total,
            timestamp: Date.now(), status: 'Kitchen',
            orderType: 'Pickup',
            tableId: null
        };
    }

    try {
        await setDoc(doc(db, 'orders', orderIdStr), orderObj);
        
        if (orderType === 'Table') {
            const tId = document.getElementById('table-select').value;
            await updateDoc(doc(db, 'tables', tId), {
                orders: arrayUnion(...cart),
                total: increment(total),
                updatedAt: serverTimestamp()
            });
        }

        // --- Route notifications: Pickup/Table add-ons → Desk + Kitchen ---
        const pid = orderIdStr;
        await pushNotification('order', `PICKUP ORDER ${pid} — ₹${total}`, 'desk', { orderId: pid, items: cart, orderType });
        await pushNotification('kot', `KOT: ${orderType === 'Table' ? 'Table add-on from Pickup' : 'Pickup'} — ${cart.map(i=>i.qty+'x '+i.name).join(', ')}`, 'kitchen', { orderId: pid, items: cart, orderType });

        // --- SUCCESS SEQUENCE ---
        new Audio('orderconfirm.mp3').play().catch(e => console.log("Audio play failed"));
        document.getElementById('success-screen').style.display = 'flex';
        
        cart = [];
        renderCart();
        
        // Stay visible — waiter presses close when ready

    } catch (e) {
        alert('Order Failed: ' + e.message);
        btn.disabled = false;
        btn.innerText = 'PLACE ORDER';
    }
};

onSnapshot(collection(db, 'menuItems'), window.renderMenu);
document.getElementById('menu-search').oninput = window.renderMenu;
