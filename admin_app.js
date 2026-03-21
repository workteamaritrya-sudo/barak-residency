/**
 * BARAK RESIDENCY — Owner's Admin App
 * Focus: High-Precision Real-time Operations Data & Financial Ledger
 */

// --- Imports ---
import {
    getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc,
    onSnapshot, query, orderBy, limit, serverTimestamp, deleteDoc, where
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { firebaseConfig, app } from './firebase-config.js';

let db, auth;
try {
    db = getFirestore(app);
    auth = getAuth(app);
} catch (e) {
    console.error("[Firebase] Init failure:", e);
}

// --- State ---
let rooms = [];
let activeOrders = [];
let ledgerEntries = [];
let totalRevenue = 0;
let menu = [];

// --- Real-time Listeners ---
function startListeners() {
    // 1. Rooms (Live Occupancy)
    onSnapshot(collection(db, 'rooms'), snap => {
        rooms = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateDashboard();
    });

    // 2. Active Orders (KDS View)
    onSnapshot(collection(db, 'orders'), snap => {
        activeOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateDashboard();
    });

    // 3. Ledger (The Financial Source of Truth)
    // We listen to transactions from the last 24 hours or a large set for the dashboard
    onSnapshot(query(collection(db, 'ledger'), orderBy('closedAt', 'desc'), limit(50)), snap => {
        ledgerEntries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        calculateRevenue();
        updateDashboard();
        if (document.getElementById('finance-view').style.display === 'block') renderFinanceView();
    });

    onSnapshot(collection(db, 'menuItems'), snap => {
        menu = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    });
}

function calculateRevenue() {
    // Sum all settled transactions in the ledger
    totalRevenue = ledgerEntries.reduce((s, entry) => {
        const amount = Number(entry.amount) || Number(entry.grandTotal) || Number(entry.finalSettlement) || 0;
        return s + amount;
    }, 0);
}

function updateDashboard() {
    // Stat: Rooms
    const occupied = rooms.filter(r => r.status === 'occupied').length;
    const statRooms = document.getElementById('stat-rooms');
    if (statRooms) statRooms.innerText = `${occupied} / ${rooms.length}`;

    // Stat: Revenue (Settled)
    const statRev = document.getElementById('stat-revenue');
    if (statRev) statRev.innerText = `₹ ${totalRevenue.toLocaleString()}`;

    // Stat: Orders (Active)
    const active = activeOrders.filter(o => o.status !== 'Delivered' && o.status !== 'cancelled' && o.status !== 'Cancelled').length;
    const statOrders = document.getElementById('stat-orders');
    if (statOrders) statOrders.innerText = active;

    // Turnaround Preview (Recent Activity from Ledger)
    const tList = document.getElementById('turnaround-list');
    if (tList) {
        tList.innerHTML = ledgerEntries.slice(0, 5).map(entry => {
            const label = entry.logType === 'BILL_CHECKOUT' ? 'Rest' : (entry.logType === 'ROOM_CHECKOUT_TRANSACTION' ? 'Room' : 'Tx');
            const amt = Number(entry.amount) || Number(entry.grandTotal) || Number(entry.finalSettlement) || 0;
            const target = entry.tableId ? `Table ${entry.tableId}` : (entry.room ? `Room ${entry.room}` : 'Barak');
            
            return `
                <div class="turnaround-item">
                    <div style="display:flex;gap:1rem;align-items:center;">
                        <div class="table-badge" style="background:rgba(34,197,94,0.1); border-color:#22C55E; color:#22C55E;">${label}</div>
                        <div>
                            <div style="font-weight:700;">${target}</div>
                            <div style="font-size:0.7rem;opacity:0.5;">Settled</div>
                        </div>
                    </div>
                    <div style="font-weight:700; color:#22C55E;">₹${amt.toLocaleString()}</div>
                </div>
            `;
        }).join('') || '<div style="text-align:center; opacity:0.3; padding:2rem;">No recent transactions</div>';
    }
}

// --- Navigation & View Logic ---
window.switchAdminTab = function(tabId, el) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    if (el) el.classList.add('active');

    const title = document.querySelector('.header-title h2');
    document.querySelectorAll('.admin-view').forEach(v => v.style.display = 'none');
    const target = document.getElementById(tabId);
    if (target) target.style.display = 'block';

    if (tabId === 'dashboard-view') title.innerText = "OWNER'S CONSOLE";
    if (tabId === 'hotel-view') { title.innerText = "HOTEL OPERATIONS"; renderHotelView(); }
    if (tabId === 'rest-view') { title.innerText = "RESTAURANT ANALYTICS"; renderRestView(); }
    if (tabId === 'finance-view') { title.innerText = "FINANCIAL INTELLIGENCE"; renderFinanceView(); }
};

function renderHotelView() {
    const container = document.getElementById('hotel-view');
    if (!container) return;
    container.innerHTML = `
        <div class="analytics-card">
            <h3>Live Room Status</h3>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(140px,1fr)); gap:1rem; margin-top:1.5rem;">
                ${rooms.map(r => `
                    <div class="room-box status-${r.status || 'available'}">
                        <div style="font-size:0.6rem; opacity:0.6;">ROOM</div>
                        <div style="font-size:1.1rem; font-weight:800;">${r.id}</div>
                        <div style="margin-top:0.5rem; font-size:0.65rem; font-weight:700; text-transform:uppercase;">${r.status || 'Available'}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderRestView() {
    document.getElementById('rest-view').innerHTML = `
        <div class="analytics-card">
            <h3>Active KDS Stream</h3>
            <div style="display:flex; flex-direction:column; gap:1rem; margin-top:1.5rem;">
                ${activeOrders.filter(o => o.status !== 'Delivered' && o.status !== 'cancelled').map(o => `
                    <div class="turnaround-item">
                        <div style="display:flex; gap:1rem; align-items:center;">
                            <div class="table-badge">${o.roomNumber || o.tableId || 'T'}</div>
                            <div>
                                <div style="font-weight:700;">${o.id.slice(-6)}</div>
                                <div style="font-size:0.7rem; color:var(--gold-primary);">${o.status}</div>
                            </div>
                        </div>
                        <div style="font-weight:700;">₹${o.total_price || o.total || 0}</div>
                    </div>
                `).join('') || '<p>No active kitchen orders</p>'}
            </div>
        </div>
    `;
}

function renderFinanceView() {
    const container = document.getElementById('finance-view');
    container.innerHTML = `
        <div class="analytics-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem;">
                <h3>Financial Transaction Ledger</h3>
                <div style="font-size:1.2rem; font-weight:900; color:#22C55E;">Total Vol: ₹${totalRevenue.toLocaleString()}</div>
            </div>
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.85rem;">
                    <thead>
                        <tr style="border-bottom:1px solid var(--glass-border); color:var(--gold-primary);">
                            <th style="padding:1rem;">TIME</th>
                            <th style="padding:1rem;">TARGET</th>
                            <th style="padding:1rem;">TYPE</th>
                            <th style="padding:1rem;">GUEST</th>
                            <th style="padding:1rem;">AMOUNT</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ledgerEntries.map(e => `
                            <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                                <td style="padding:1rem; opacity:0.5;">${e.closedAt ? new Date(e.closedAt.seconds * 1000).toLocaleTimeString() : '---'}</td>
                                <td style="padding:1rem; font-weight:700;">${e.room || e.tableId || 'Barak'}</td>
                                <td style="padding:1rem;"><span style="font-size:0.6rem; padding:2px 6px; border-radius:4px; border:1px solid var(--gold-primary);">${e.logType?.replace('_TRANSACTION','')}</span></td>
                                <td style="padding:1rem;">${e.guestName || e.name || '---'}</td>
                                <td style="padding:1rem; font-weight:900; color:#22C55E;">₹${(Number(e.amount) || Number(e.grandTotal) || Number(e.finalSettlement) || 0).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// --- Global Actions ---
window.handleLogout = async () => {
    await signOut(auth);
    window.location.href = 'index.html';
};

// --- Initialization ---
onAuthStateChanged(auth, user => {
    if (user) {
        const loader = document.getElementById('page-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 300);
        }
        startListeners();
    } else {
        console.log("[Auth] No session detected.");
    }
});
