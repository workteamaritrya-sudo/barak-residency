/**
 * ══════════════════════════════════════════════════════════════════════════
 * BARAK RESIDENCY — Stock / Inventory Management
 * Collections: stock
 * • Admin: can add items, set thresholds, delete items
 * • Staff: can only "Mark Used" (decrement qty) — cannot add new items
 * • All users: real-time list, filter by category/status, search
 * ══════════════════════════════════════════════════════════════════════════
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import {
    getFirestore, collection, doc, addDoc, updateDoc, deleteDoc,
    onSnapshot, query, orderBy, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import {
    getAuth, signInWithEmailAndPassword, signOut,
    onAuthStateChanged, browserLocalPersistence, setPersistence
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { firebaseConfig, app } from "./firebase-config.js";

const db   = getFirestore(app);
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(console.warn);

// ── State ────────────────────────────────────────────────────────────────────
let stockItems = [];
let currentUser = null;
let isAdmin = false;

// ── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// ── Auth ──────────────────────────────────────────────────────────────────────
window.doLogin = async function () {
    const email = document.getElementById('auth-email').value.trim();
    const pass  = document.getElementById('auth-pass').value;
    const msg   = document.getElementById('auth-msg');
    msg.textContent = '';
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) {
        msg.textContent = 'Invalid credentials. Try again.';
    }
};

window.doLogout = async function () {
    await signOut(auth);
};

// Check if user is admin by reading staffProfiles or a simple email whitelist
async function checkAdmin(user) {
    try {
        // Try staffProfiles first
        const snap = await getDoc(doc(db, 'staffProfiles', user.uid));
        if (snap.exists()) {
            const role = (snap.data().role || '').toLowerCase();
            return role === 'admin' || role === 'manager';
        }
        // Fallback: check admin email list in settings
        return false;
    } catch (e) {
        return false;
    }
}

onAuthStateChanged(auth, async user => {
    if (user) {
        currentUser = user;
        isAdmin = await checkAdmin(user);

        document.getElementById('auth-overlay').style.display = 'none';
        document.getElementById('user-badge').textContent = user.email + (isAdmin ? ' · Admin' : ' · Staff');
        if (isAdmin) {
            document.getElementById('add-section').style.display = 'block';
        }
        startStockListener();
    } else {
        currentUser = null;
        isAdmin = false;
        document.getElementById('auth-overlay').style.display = 'flex';
        stockItems = [];
        renderStock();
    }
});

// ── Real-time Stock Listener ──────────────────────────────────────────────────
function startStockListener() {
    const q = query(collection(db, 'stock'), orderBy('name', 'asc'));
    onSnapshot(q, snap => {
        stockItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderStock();
        updateStats();
    }, err => {
        // If ordering index not created, fallback
        console.warn('[Stock] Ordering fallback:', err.message);
        onSnapshot(collection(db, 'stock'), snap2 => {
            stockItems = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
            stockItems.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            renderStock();
            updateStats();
        });
    });
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function updateStats() {
    const total    = stockItems.length;
    const low      = stockItems.filter(i => getStatus(i) === 'low').length;
    const critical = stockItems.filter(i => getStatus(i) === 'critical').length;
    document.getElementById('stat-total').textContent    = total;
    document.getElementById('stat-low').textContent      = low;
    document.getElementById('stat-critical').textContent = critical;
}

function getStatus(item) {
    const qty   = Number(item.qty) || 0;
    const low   = Number(item.lowThresh) || 5;
    if (qty <= 0)            return 'critical';
    if (qty <= low)          return 'low';
    return 'ok';
}

// ── Render Table ──────────────────────────────────────────────────────────────
window.renderStock = function () {
    const search   = (document.getElementById('stock-search')?.value || '').toLowerCase();
    const catF     = document.getElementById('stock-cat-filter')?.value || '';
    const statusF  = document.getElementById('stock-status-filter')?.value || '';

    const filtered = stockItems.filter(i => {
        const nameMatch = (i.name || '').toLowerCase().includes(search);
        const catMatch  = !catF     || i.category === catF;
        const statMatch = !statusF  || getStatus(i) === statusF;
        return nameMatch && catMatch && statMatch;
    });

    const tbody = document.getElementById('stock-tbody');
    if (!tbody) return;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:3rem;color:rgba(255,255,255,0.3);">No items found</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(item => {
        const status = getStatus(item);
        const pillClass = status === 'ok' ? 'pill-ok' : (status === 'low' ? 'pill-low' : 'pill-critical');
        const statusLabel = status === 'ok' ? 'OK' : (status === 'low' ? 'Low' : 'Critical / Out');
        const qty = Number(item.qty) || 0;

        const ts = item.updatedAt?.seconds
            ? new Date(item.updatedAt.seconds * 1000).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
            : '—';

        const deleteBtn = isAdmin
            ? `<button class="btn-del" onclick="deleteItem('${item.id}', '${(item.name||'').replace(/'/g,'')}')">🗑 Delete</button>`
            : '';

        return `<tr>
            <td style="font-weight:700;">${item.name || '—'}</td>
            <td style="color:var(--text-mute);">${item.category || '—'}</td>
            <td style="font-size:1rem;font-weight:700;color:${status === 'critical' ? 'var(--red)' : (status === 'low' ? 'var(--amber)' : 'var(--green)') };">${qty}</td>
            <td style="color:var(--text-mute);font-size:0.78rem;">${item.unit || 'pcs'}</td>
            <td><span class="pill ${pillClass}">${statusLabel}</span></td>
            <td style="color:var(--text-mute);font-size:0.75rem;">${ts}</td>
            <td style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                <button class="btn-use" onclick="markUsed('${item.id}', ${qty}, '${(item.name||'').replace(/'/g,'')}')">➖ Use 1</button>
                ${deleteBtn}
            </td>
        </tr>`;
    }).join('');
};

// ── Add Stock Item (Admin Only) ───────────────────────────────────────────────
window.addStockItem = async function () {
    if (!isAdmin) { showToast('Only admin can add items', 'error'); return; }

    const name     = document.getElementById('add-name').value.trim();
    const category = document.getElementById('add-category').value;
    const qty      = parseFloat(document.getElementById('add-qty').value) || 0;
    const unit     = document.getElementById('add-unit').value.trim() || 'pcs';
    const lowThresh= parseFloat(document.getElementById('add-low-thresh').value) || 5;

    if (!name || !category) { showToast('Please fill name and category', 'error'); return; }

    try {
        await addDoc(collection(db, 'stock'), {
            name, category, qty, unit, lowThresh,
            addedBy:   currentUser?.email || 'Admin',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        showToast(`✅ ${name} added to inventory`, 'success');
        // Clear form
        ['add-name','add-qty','add-unit','add-low-thresh'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        document.getElementById('add-category').value = '';
    } catch (e) {
        showToast('Failed: ' + e.message, 'error');
    }
};

// ── Mark Used (Staff & Admin) ─────────────────────────────────────────────────
window.markUsed = async function (id, currentQty, name) {
    if (!currentUser) { showToast('Please sign in', 'error'); return; }
    if (currentQty <= 0) { showToast(`${name} is already out of stock`, 'error'); return; }

    const useQty = parseFloat(prompt(`How much of "${name}" was used? (Current: ${currentQty})`) || '1');
    if (isNaN(useQty) || useQty <= 0) return;

    const newQty = Math.max(0, currentQty - useQty);

    try {
        await updateDoc(doc(db, 'stock', id), {
            qty: newQty,
            updatedAt:  serverTimestamp(),
            lastUsedBy: currentUser?.email || 'Staff'
        });
        showToast(`✅ ${name} updated: ${currentQty} → ${newQty}`, 'success');
    } catch (e) {
        showToast('Update failed: ' + e.message, 'error');
    }
};

// ── Delete Item (Admin Only) ──────────────────────────────────────────────────
window.deleteItem = async function (id, name) {
    if (!isAdmin) { showToast('Only admin can delete items', 'error'); return; }
    if (!confirm(`Delete "${name}" from inventory?`)) return;

    try {
        await deleteDoc(doc(db, 'stock', id));
        showToast(`🗑 ${name} removed`, 'info');
    } catch (e) {
        showToast('Delete failed: ' + e.message, 'error');
    }
};
