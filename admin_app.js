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
let staffAttendanceRecords = []; // NEW

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

    // 4. Staff Attendance (Live)
    onSnapshot(query(collection(db, 'staffAttendance'), orderBy('updatedAt', 'desc'), limit(100)), snap => {
        staffAttendanceRecords = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Re-render only if the tab is visible
        const view = document.getElementById('attendance-view');
        if (view && view.style.display !== 'none') renderAttendanceView();
        // Update dashboard stat
        const todayPresent = staffAttendanceRecords.filter(r => {
            const today = new Date().toISOString().slice(0, 10);
            return r.date === today && r.inTime;
        }).length;
        const statStaff = document.getElementById('stat-staff');
        if (statStaff) statStaff.innerText = todayPresent;
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

    if (tabId === 'dashboard-view')  title.innerText = "OWNER'S CONSOLE";
    if (tabId === 'hotel-view')      { title.innerText = "HOTEL OPERATIONS"; renderHotelView(); }
    if (tabId === 'rest-view')       { title.innerText = "RESTAURANT ANALYTICS"; renderRestView(); }
    if (tabId === 'finance-view')    { title.innerText = "FINANCIAL INTELLIGENCE"; renderFinanceView(); }
    if (tabId === 'attendance-view') { title.innerText = "STAFF ATTENDANCE REPORTS"; renderAttendanceView(); }
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

// --- Attendance View ---
function shiftPillHtml(shiftLabel) {
    const map = {
        'Morning':   'background:rgba(251,191,36,0.15); color:#FBBF24; border:1px solid rgba(251,191,36,0.3);',
        'Afternoon': 'background:rgba(245,158,11,0.15); color:#F59E0B; border:1px solid rgba(245,158,11,0.3);',
        'Evening':   'background:rgba(139,92,246,0.15); color:#A78BFA; border:1px solid rgba(139,92,246,0.3);',
        'Night':     'background:rgba(59,130,246,0.15);  color:#93C5FD; border:1px solid rgba(59,130,246,0.3);',
    };
    const style = map[shiftLabel] || 'background:rgba(255,255,255,0.05); color:rgba(255,255,255,0.4);';
    return `<span style="${style} padding:2px 10px; border-radius:20px; font-size:0.65rem; font-weight:700; letter-spacing:1px; text-transform:uppercase;">${shiftLabel || '—'}</span>`;
}

function renderAttendanceView() {
    const container = document.getElementById('attendance-view');
    if (!container) return;

    const today = new Date().toISOString().slice(0, 10);
    const todayRecords  = staffAttendanceRecords.filter(r => r.date === today);
    const presentCount  = todayRecords.filter(r => r.inTime).length;
    const outCount      = todayRecords.filter(r => r.outTime).length;
    const inOnlyCount   = presentCount - outCount;

    container.innerHTML = `
    <style>
        .att-stat { background:var(--bg-card); border:1px solid var(--glass-border); border-radius:16px; padding:1.4rem 1.8rem; }
        .att-stat h4 { font-size:0.65rem; letter-spacing:2px; text-transform:uppercase; opacity:0.4; margin-bottom:0.6rem; }
        .att-stat .av { font-size:2rem; font-weight:100; color:var(--gold); }
        .att-table { width:100%; border-collapse:collapse; font-size:0.82rem; }
        .att-table th { padding:0.9rem 1rem; text-align:left; font-size:0.65rem; letter-spacing:2px; text-transform:uppercase; opacity:0.4; border-bottom:1px solid var(--glass-border); }
        .att-table td { padding:0.9rem 1rem; border-bottom:1px solid rgba(255,255,255,0.02); }
        .att-table tr:hover td { background:rgba(255,255,255,0.02); }
        .btn-export { padding:0.55rem 1.2rem; background:rgba(212,175,55,0.12); color:var(--gold); border:1px solid rgba(212,175,55,0.3); border-radius:10px; cursor:pointer; font-size:0.75rem; font-weight:600; letter-spacing:1px; }
        .btn-export:hover { background:rgba(212,175,55,0.25); }
    </style>

    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; margin-bottom:2rem;">
        <div class="att-stat">
            <h4>Present Today</h4>
            <div class="av">${presentCount}</div>
        </div>
        <div class="att-stat">
            <h4>Still on Duty</h4>
            <div class="av" style="color:#22C55E">${inOnlyCount}</div>
        </div>
        <div class="att-stat">
            <h4>Clocked Out</h4>
            <div class="av" style="color:#EF4444">${outCount}</div>
        </div>
    </div>

    <div class="body-section">
        <div class="section-header">
            <h3>Attendance Log</h3>
            <button class="btn-export" onclick="window.exportAttendanceCSV()">⬇ Export CSV</button>
        </div>

        <div style="overflow-x:auto;">
            <table class="att-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Staff</th>
                        <th>Department</th>
                        <th>Shift</th>
                        <th>In Time</th>
                        <th>Out Time</th>
                        <th>Duration</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${staffAttendanceRecords.length === 0 ? '<tr><td colspan="8" style="text-align:center;opacity:0.3;padding:2rem;">No attendance records yet</td></tr>' :
                    staffAttendanceRecords.map(r => {
                        const inT  = r.inTime  ? (r.inTime.toDate  ? r.inTime.toDate()  : new Date(r.inTime))  : null;
                        const outT = r.outTime ? (r.outTime.toDate ? r.outTime.toDate() : new Date(r.outTime)) : null;
                        const inStr  = inT  ? inT.toLocaleTimeString('en-IN',  { hour:'2-digit', minute:'2-digit' }) : '—';
                        const outStr = outT ? outT.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) : '—';
                        const dur    = r.durationMins != null ? `${Math.floor(r.durationMins/60)}h ${r.durationMins%60}m` : (inT && outT ? '—' : '—');
                        const statusColor = r.outTime ? '#EF4444' : (r.inTime ? '#22C55E' : 'rgba(255,255,255,0.3)');
                        const statusLabel = r.outTime ? 'Signed Out' : (r.inTime ? 'On Duty' : 'Absent');
                        return `
                        <tr>
                            <td style="opacity:0.5;">${r.date || '—'}</td>
                            <td style="font-weight:700;">${r.name || '—'}</td>
                            <td style="opacity:0.7;">${r.department || '—'}</td>
                            <td>${shiftPillHtml(r.shiftLabel)}</td>
                            <td style="color:#22C55E; font-weight:500;">${inStr}</td>
                            <td style="color:#EF4444; font-weight:500;">${outStr}</td>
                            <td style="opacity:0.7;">${dur}</td>
                            <td><span style="color:${statusColor}; font-size:0.7rem; font-weight:700;">${statusLabel}</span></td>
                        </tr>`;
                    }).join('')
                    }
                </tbody>
            </table>
        </div>
    </div>`;
}

// --- Export Attendance as CSV ---
window.exportAttendanceCSV = function () {
    const headers = ['Date','Name','Department','Shift','In Time','Out Time','Duration (mins)','Status'];
    const rows = staffAttendanceRecords.map(r => {
        const inT  = r.inTime  ? (r.inTime.toDate  ? r.inTime.toDate()  : new Date(r.inTime))  : null;
        const outT = r.outTime ? (r.outTime.toDate ? r.outTime.toDate() : new Date(r.outTime)) : null;
        return [
            r.date || '',
            r.name || '',
            r.department || '',
            r.shiftLabel || '',
            inT  ? inT.toLocaleTimeString('en-IN')  : '',
            outT ? outT.toLocaleTimeString('en-IN') : '',
            r.durationMins ?? '',
            r.outTime ? 'Out' : (r.inTime ? 'In' : 'Absent')
        ].map(v => `"${v}"`).join(',');
    });
    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `barak_attendance_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

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
