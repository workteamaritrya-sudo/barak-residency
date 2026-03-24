/**
 * BARAK RESIDENCY — Restaurant Pickup & Table Add-on
 * Independent Standalone POS Module
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getFirestore, collection, doc, onSnapshot, updateDoc, setDoc, query, where, arrayUnion, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getDatabase, ref, push, set } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyANudXFm6QK4jJXKtXtAaDe9hWFDcBF8Vo",
    authDomain: "barak-residency-59405.firebaseapp.com",
    projectId: "barak-residency-59405",
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
    resetState(); // Always clean up before closing
    if (window.parent && window.parent !== window && window.parent.closePickupOverlay) {
        window.parent.closePickupOverlay();
    } else if (window.parent && window.parent !== window && window.parent.closeRestWaiter) {
        window.parent.closeRestWaiter();
    } else if (window.parent && window.parent !== window) {
        window.parent.postMessage({ action: 'closeOverlay', overlay: 'pickup' }, '*');
    }
    // Removed unconditional fallback redirect to index.html
};

// Real-time Listeners
onSnapshot(collection(db, 'menuItems'), snap => {
    menu = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMenu();
});

onSnapshot(doc(db, 'settings', 'availability'), snap => {
    if (snap.exists()) unavailableItems = snap.data().unavailableItems || [];
    renderMenu();
});

onSnapshot(collection(db, 'tables'), snap => {
    tables = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => (t.status || '').toLowerCase() === 'occupied');
    renderTables();
});

function renderTables() {
    const sel = document.getElementById('table-select');
    if (!sel) return;
    sel.innerHTML = tables.map(t => `<option value="${t.id}">Table ${t.id} - ${t.guestName || 'Active Bill'}</option>`).join('');
    if (tables.length === 0) sel.innerHTML = '<option value="">No active tables found</option>';
}

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
        const cat = (i.category || i.Category || '').toLowerCase();
        const available = i.isAvailable !== false && !unavailableItems.includes(i.id);
        return available && (name.includes(search) || cat.includes(search));
    });

    const cats = ['All', ...new Set(filtered.map(i => i.category || 'General'))];
    if (pills) {
        pills.innerHTML = cats.map(c => `<button class="cat-pill" style="min-width:110px;">${c}</button>`).join('');
    }

    grid.innerHTML = filtered.map(i => `
        <div class="waiter-menu-card" onclick="window.promptPortion('${i.id}')">
            <img src="${i.imageUrl || 'br.png'}" style="width:100%; height:80px; object-fit:cover; border-radius:12px;" onerror="this.src='br.png'">
            <div style="font-weight:700; color:white; font-size:0.9rem; margin:0.5rem 0;">${i.name || i.itemName}</div>
            <div style="font-weight:900; color:var(--gold-primary);">₹${i.price}</div>
        </div>
    `).join('');
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

    let orderIdStr = `P${Date.now().toString().slice(-4)}`;
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

        // --- SUCCESS SEQUENCE ---
        new Audio('orderconfirm.mp3').play().catch(e => console.log("Audio play failed"));
        document.getElementById('success-screen').style.display = 'flex';
        
        cart = [];
        renderCart();
        
        // Return to Home after delay
        setTimeout(() => window.backToHome(), 2500);

    } catch (e) {
        alert('Order Failed: ' + e.message);
        btn.disabled = false;
        btn.innerText = 'PLACE ORDER';
    }
};

onSnapshot(collection(db, 'menuItems'), window.renderMenu);
document.getElementById('menu-search').oninput = window.renderMenu;
