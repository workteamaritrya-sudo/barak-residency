/**
 * BARAK RESIDENCY — Owner's Admin App
 * Focus: High-Precision Real-time Operations Data & Financial Ledger
 */

// --- Imports ---
import {
    getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc,
    onSnapshot, query, orderBy, limit, serverTimestamp, deleteDoc, where, addDoc
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";
import { firebaseConfig, app } from './firebase-config.js';

let db, auth, storage;
try {
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
} catch (e) {
    console.error("[Firebase] Init failure:", e);
}

// --- State ---
let rooms = [];
let activeOrders = [];
let ledgerEntries = [];
let totalRevenue = 0;
let menu = [];
let staffAttendanceRecords = [];
let staffProfiles = [];
let stockItems = [];

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
        const mv = document.getElementById('menu-view');
        if (mv && mv.style.display !== 'none') renderMenuView();
    });

    // 5. Staff Profiles (for Staff Management tab)
    onSnapshot(collection(db, 'staffProfiles'), snap => {
        staffProfiles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const view = document.getElementById('staff-mgmt-view');
        if (view && view.style.display !== 'none') renderStaffMgmtView();
    });

    // 6. Stock (live inventory)
    onSnapshot(collection(db, 'stock'), snap => {
        stockItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const view = document.getElementById('stock-view');
        if (view && view.style.display !== 'none') renderStockAdminView();
    });
}

function calculateRevenue() {
    // Sum all settled transactions in the ledger
    totalRevenue = ledgerEntries.reduce((s, entry) => {
        const amount = Number(entry.amount) || Number(entry.grandTotal) || Number(entry.finalSettlement) || 0;
        return s + amount;
    }, 0);
}

// --- Legal Records Export (CSV/Excel) ---
window.exportAttendanceToExcel = () => {
    if (!staffAttendanceRecords || staffAttendanceRecords.length === 0) {
        alert("No attendance records to export.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,Staff Name,Date,In Time,Out Time,Status,Lat,Lng\n";
    staffAttendanceRecords.forEach(r => {
        const inT = r.inTime ? (r.inTime.toDate ? r.inTime.toDate() : new Date(r.inTime)).toLocaleTimeString() : '--:--';
        const outT = r.outTime ? (r.outTime.toDate ? r.outTime.toDate() : new Date(r.outTime)).toLocaleTimeString() : '--:--';
        const lat = r.latIn || r.lat || '--';
        const lng = r.lngIn || r.lng || '--';
        csvContent += `"${r.name}","${r.date}","${inT}","${outT}","${r.status}","${lat}","${lng}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Barak_Attendance_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

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
    if (tabId === 'staff-mgmt-view') { title.innerText = "STAFF MANAGEMENT"; renderStaffMgmtView(); }
    if (tabId === 'stock-view')      { title.innerText = "STOCK & INVENTORY"; renderStockAdminView(); }
    if (tabId === 'menu-view')       { title.innerText = "MENU MANAGER"; renderMenuView(); }
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
            <button class="btn-export" onclick="window.exportAttendanceCSV()"> Export CSV</button>
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

//  Staff Management View 
function renderStaffMgmtView() {
    const container = document.getElementById('staff-mgmt-view');
    if (!container) return;

    const teamColor = { hotel: '#D4AF37', restaurant: '#22C55E', both: '#A78BFA' };
    const sortedProfiles = [...staffProfiles].sort((a,b) => (a.name||'').localeCompare(b.name||''));

    container.innerHTML = `
    <style>
        .staff-card { background:var(--bg-card); border:1px solid var(--glass-border); border-radius:16px; padding:1.2rem 1.5rem; display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem; transition:0.2s; }
        .staff-card:hover { background:rgba(255,255,255,0.03); }
        .staff-avatar { width:42px; height:42px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:1rem; flex-shrink:0; }
        .btn-remove { padding:0.4rem 0.9rem; border-radius:8px; font-size:0.7rem; font-weight:700; letter-spacing:1px; cursor:pointer; background:rgba(239,68,68,0.1); color:#EF4444; border:1px solid rgba(239,68,68,0.3); transition:0.2s; }
        .btn-remove:hover { background:rgba(239,68,68,0.25); }
        .team-pill { padding:2px 10px; border-radius:20px; font-size:0.62rem; font-weight:700; letter-spacing:1px; text-transform:uppercase; }
    </style>

    <div class="analytics-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
            <h3>Staff Roster (${sortedProfiles.length} staff)</h3>
            <a href="staff_attendance.html" target="_blank" style="font-size:0.75rem;color:var(--gold);opacity:0.7;text-decoration:none;"> Register New Staff →</a>
        </div>
        ${sortedProfiles.length === 0 ? '<div style="text-align:center;opacity:0.3;padding:3rem;">No staff registered yet</div>' :
        sortedProfiles.map(s => {
            const initial = (s.name || '?').charAt(0).toUpperCase();
            const team = s.team || 'hotel';
            const col = teamColor[team] || '#D4AF37';
            const regDate = s.registeredAt?.seconds
                ? new Date(s.registeredAt.seconds * 1000).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
                : '—';
            return `<div class="staff-card">
                <div style="display:flex;gap:1rem;align-items:center;">
                    <div class="staff-avatar" style="background:${col}20;color:${col};border:2px solid ${col}40;">${initial}</div>
                    <div>
                        <div style="font-weight:700;font-size:0.95rem;">${s.name || '—'}</div>
                        <div style="font-size:0.72rem;color:rgba(255,255,255,0.4);margin-top:0.15rem;">${s.email || ''} · ${s.department || '—'}</div>
                        <div style="margin-top:0.4rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
                            <span class="team-pill" style="background:${col}18;color:${col};border:1px solid ${col}35;">${team.toUpperCase()}</span>
                            <span style="font-size:0.62rem;color:rgba(255,255,255,0.3);">Since ${regDate}</span>
                        </div>
                    </div>
                </div>
                <button class="btn-remove" onclick="window.removeStaff('${s.id}', '${(s.name||'').replace(/'/g,'')}')"> Remove</button>
            </div>`;
        }).join('')}
    </div>`;
}

window.removeStaff = async function(uid, name) {
    if (!confirm(`Remove staff member "${name}"?\nThis will delete their profile. Attendance records will be kept.`)) return;
    try {
        await deleteDoc(doc(db, 'staffProfiles', uid));
        // Optionally: also disable Auth — but we can't do that from client-side without Admin SDK
        // So we just remove the profile. The account still exists but portal won't load without a profile.
        console.log(`[Admin] Removed staff: ${name} (${uid})`);
    } catch (e) {
        alert('Failed to remove staff: ' + e.message);
    }
};

//  Menu Manager Admin View 
function renderMenuView() {
    const container = document.getElementById('menu-view');
    if (!container) return;

    const categories = [...new Set(menu.map(i => i.category))].sort();

    container.innerHTML = `
    <style>
        .menu-admin-card { background:var(--bg-card); border:1px solid var(--glass-border); border-radius:16px; padding:1.5rem; margin-bottom:2rem; }
        .menu-item-row { display:flex; align-items:center; gap:1rem; padding:0.8rem 0; border-bottom:1px solid rgba(255,255,255,0.04); }
        .menu-item-row:last-child { border-bottom:none; }
        .menu-item-img { width:52px; height:52px; border-radius:10px; object-fit:cover; background:#111; flex-shrink:0; }
        .menu-item-name { font-weight:700; font-size:0.9rem; }
        .menu-item-meta { font-size:0.7rem; color:rgba(255,255,255,0.4); margin-top:2px; }
        .menu-avail-pill { padding:2px 8px; border-radius:10px; font-size:0.6rem; font-weight:700; letter-spacing:1px; }
        .avail-yes { background:rgba(34,197,94,0.12); color:#22C55E; border:1px solid rgba(34,197,94,0.3); }
        .avail-no  { background:rgba(239,68,68,0.12);  color:#EF4444; border:1px solid rgba(239,68,68,0.3); }
        .btn-menu-del { padding:0.35rem 0.8rem; border-radius:8px; font-size:0.68rem; font-weight:700; cursor:pointer; background:rgba(239,68,68,0.1); color:#EF4444; border:1px solid rgba(239,68,68,0.3); transition:0.2s; }
        .btn-menu-del:hover { background:rgba(239,68,68,0.3); }
        .btn-menu-toggle { padding:0.35rem 0.8rem; border-radius:8px; font-size:0.68rem; font-weight:700; cursor:pointer; background:rgba(245,158,11,0.1); color:#F59E0B; border:1px solid rgba(245,158,11,0.3); transition:0.2s; }
        .btn-menu-toggle:hover { background:rgba(245,158,11,0.3); }
        .menu-add-form { display:grid; gap:0.8rem; }
        .menu-form-row { display:grid; grid-template-columns:1fr 1fr; gap:0.8rem; }
        select.mf, input.mf, textarea.mf { background:#050B1A; border:1px solid rgba(255,255,255,0.1); border-radius:10px; color:#fff; padding:0.7rem 1rem; font-family:'Inter',sans-serif; font-size:0.85rem; width:100%; outline:none; transition:border-color 0.2s; }
        select.mf:focus, input.mf:focus, textarea.mf:focus { border-color:var(--gold); }
        .btn-add-menu { padding:0.85rem; border:none; border-radius:10px; background:linear-gradient(135deg,#C9A227,#D4AF37); color:#000; font-weight:700; font-size:0.85rem; letter-spacing:2px; text-transform:uppercase; cursor:pointer; width:100%; transition:0.2s; }
        .btn-add-menu:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(212,175,55,0.3); }
        .cat-heading { font-family:'Cormorant Garamond',serif; font-size:1.1rem; letter-spacing:2px; color:var(--gold); margin-bottom:1rem; padding-bottom:0.5rem; border-bottom:1px solid rgba(212,175,55,0.2); }
        .portion-toggle { display:flex; gap:0.6rem; margin-top:0.2rem; }
        .portion-toggle label { display:flex; align-items:center; gap:0.4rem; font-size:0.8rem; color:rgba(255,255,255,0.6); cursor:pointer; }
        #menu-form-msg { font-size:0.8rem; text-align:center; margin-top:0.5rem; padding:0.5rem; border-radius:8px; display:none; }
    </style>

    <div class="menu-admin-card">
        <h3 style="font-family:'Cormorant Garamond',serif;font-size:1.3rem;letter-spacing:2px;margin-bottom:1.5rem;">Add New Menu Item</h3>
        <div class="menu-add-form">
            <div class="menu-form-row">
                <div>
                    <label style="font-size:0.65rem;letter-spacing:2px;color:rgba(255,255,255,0.4);text-transform:uppercase;display:block;margin-bottom:0.4rem;">Item Name</label>
                    <input class="mf" id="mf-name" type="text" placeholder="e.g. Chicken Kosha">
                </div>
                <div>
                    <label style="font-size:0.65rem;letter-spacing:2px;color:rgba(255,255,255,0.4);text-transform:uppercase;display:block;margin-bottom:0.4rem;">Category</label>
                    <select class="mf" id="mf-category">
                        <option value="">Select category</option>
                        <option>Starters</option><option>Main Course</option>
                        <option>Dessert</option><option>Drinks</option><option>Other</option>
                    </select>
                </div>
            </div>
            <div>
                <label style="font-size:0.65rem;letter-spacing:2px;color:rgba(255,255,255,0.4);text-transform:uppercase;display:block;margin-bottom:0.4rem;">Description</label>
                <textarea class="mf" id="mf-desc" rows="2" placeholder="Short item description"></textarea>
            </div>
            <div class="menu-form-row">
                <div>
                    <label style="font-size:0.65rem;letter-spacing:2px;color:rgba(255,255,255,0.4);text-transform:uppercase;display:block;margin-bottom:0.4rem;">Full Price (Rs.)</label>
                    <input class="mf" id="mf-price" type="number" min="0" placeholder="e.g. 280">
                </div>
                <div>
                    <label style="font-size:0.65rem;letter-spacing:2px;color:rgba(255,255,255,0.4);text-transform:uppercase;display:block;margin-bottom:0.4rem;">Portion System</label>
                    <select class="mf" id="mf-portion" onchange="window.adminMenuPortionChange()">
                        <option value="no">No Half Plate (Single price)</option>
                        <option value="yes">Has Full & Half Plate</option>
                    </select>
                </div>
            </div>
            <div id="mf-halfprice-wrap" style="display:none;">
                <label style="font-size:0.65rem;letter-spacing:2px;color:rgba(255,255,255,0.4);text-transform:uppercase;display:block;margin-bottom:0.4rem;">Half Plate Price (Rs.)</label>
                <input class="mf" id="mf-priceHalf" type="number" min="0" placeholder="e.g. 160">
            </div>
            <div>
                <label style="font-size:0.65rem;letter-spacing:2px;color:rgba(255,255,255,0.4);text-transform:uppercase;display:block;margin-bottom:0.4rem;">Food Image (upload from device)</label>
                <input class="mf" id="mf-image" type="file" accept="image/*" style="padding:0.5rem;">
                <div style="margin-top:0.4rem;font-size:0.7rem;color:rgba(255,255,255,0.3);">Or paste an image URL below (optional):</div>
                <input class="mf" id="mf-imageUrl" type="text" placeholder="https://..." style="margin-top:0.4rem;">
            </div>
            <button class="btn-add-menu" onclick="window.adminAddMenuItem()">+ Add to Menu</button>
            <div id="menu-form-msg"></div>
        </div>
    </div>

    <div class="menu-admin-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
            <h3 style="font-family:'Cormorant Garamond',serif;font-size:1.3rem;letter-spacing:2px;">Current Menu (${menu.length} items)</h3>
            <button onclick="window.adminDownloadMenuCSV()" style="padding:0.5rem 1rem;border:1px solid rgba(212,175,55,0.3);background:rgba(212,175,55,0.08);color:var(--gold);border-radius:8px;font-size:0.72rem;font-weight:700;letter-spacing:1px;cursor:pointer;">Download Menu CSV</button>
        </div>
        ${categories.map(cat => {
            const catItems = menu.filter(i => i.category === cat);
            return `<div class="cat-heading">${cat} (${catItems.length})</div>
            ${
                catItems.map(item => {
                    const avail = item.isAvailable !== false;
                    const halfInfo = item.priceHalf > 0 ? ` / Half: Rs.${item.priceHalf}` : '';
                    return `
                    <div class="menu-item-row" id="mrow-${item.id}">
                        <img class="menu-item-img" src="${item.imageUrl || 'https://placehold.co/52x52/0A1229/D4AF37?text=' + encodeURIComponent(item.name?.charAt(0)||'?')}" onerror="this.src='https://placehold.co/52x52/0A1229/D4AF37?text=?'">
                        <div style="flex:1;">
                            <div class="menu-item-name">${item.name || '—'}</div>
                            <div class="menu-item-meta">Rs.${item.price || 0}${halfInfo} · ${item.category} · ${item.portionType || ''}</div>
                        </div>
                        <span class="menu-avail-pill ${avail ? 'avail-yes' : 'avail-no'}">${avail ? 'AVAIL' : 'UNAVAIL'}</span>
                        <button class="btn-menu-toggle" onclick="window.adminToggleAvailability('${item.id}', ${avail})">${avail ? 'Mark Unavail' : 'Mark Avail'}</button>
                        <button class="btn-menu-del" onclick="window.adminDeleteMenuItem('${item.id}','${(item.name||'').replace(/'/g,'')}')">Delete</button>
                    </div>`;
                }).join('')
            }`;
        }).join('<br>')}
        ${menu.length === 0 ? '<div style="text-align:center;opacity:0.3;padding:3rem;">No menu items yet</div>' : ''}
    </div>`;
}

// Toggle menu portion field
window.adminMenuPortionChange = function() {
    const v = document.getElementById('mf-portion')?.value;
    const wrap = document.getElementById('mf-halfprice-wrap');
    if (wrap) wrap.style.display = v === 'yes' ? 'block' : 'none';
};

// Add menu item
window.adminAddMenuItem = async function() {
    const name      = document.getElementById('mf-name')?.value.trim();
    const category  = document.getElementById('mf-category')?.value;
    const desc      = document.getElementById('mf-desc')?.value.trim();
    const price     = parseFloat(document.getElementById('mf-price')?.value) || 0;
    const portionV  = document.getElementById('mf-portion')?.value;
    const priceHalf = portionV === 'yes' ? (parseFloat(document.getElementById('mf-priceHalf')?.value) || 0) : 0;
    const imageFile = document.getElementById('mf-image')?.files?.[0];
    const imageUrl  = document.getElementById('mf-imageUrl')?.value.trim();
    const msgEl     = document.getElementById('menu-form-msg');

    if (!name || !category || price <= 0) {
        if (msgEl) { msgEl.style.display='block'; msgEl.style.color='#EF4444'; msgEl.textContent='Please fill Name, Category and Price.'; }
        return;
    }

    if (msgEl) { msgEl.style.display='block'; msgEl.style.color='#F59E0B'; msgEl.textContent='Saving...'; }

    try {
        let finalImageUrl = imageUrl;

        // Upload image to Firebase Storage if a file was chosen
        if (imageFile) {
            const storageRef = ref(storage, `menuImages/${Date.now()}_${imageFile.name}`);
            await uploadBytes(storageRef, imageFile);
            finalImageUrl = await getDownloadURL(storageRef);
        }

        const portionType = portionV === 'yes' ? 'Plate' : (category === 'Drinks' ? 'Bottle' : 'Quantity');
        const newId = 'custom_' + Date.now();

        await setDoc(doc(db, 'menuItems', newId), {
            id: newId, name, category,
            description: desc,
            price, priceHalf,
            portionType,
            imageUrl: finalImageUrl || '',
            isAvailable: true,
            addedAt: serverTimestamp()
        });

        if (msgEl) { msgEl.style.display='block'; msgEl.style.color='#22C55E'; msgEl.textContent=`"${name}" added to menu!`; }
        // Reset form
        ['mf-name','mf-price','mf-priceHalf','mf-imageUrl','mf-desc'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
        const fi = document.getElementById('mf-image'); if(fi) fi.value='';
        renderMenuView();
    } catch (e) {
        if (msgEl) { msgEl.style.display='block'; msgEl.style.color='#EF4444'; msgEl.textContent='Failed: ' + e.message; }
    }
};

// Toggle availability
window.adminToggleAvailability = async function(id, currentlyAvail) {
    try {
        await updateDoc(doc(db, 'menuItems', id), { isAvailable: !currentlyAvail });
        // Reflect in local state & re-render without full page refresh
        const item = menu.find(i => i.id === id);
        if (item) item.isAvailable = !currentlyAvail;
        renderMenuView();
    } catch(e) { alert('Failed: ' + e.message); }
};

// Delete menu item
window.adminDeleteMenuItem = async function(id, name) {
    if (!confirm(`Remove "${name}" from the menu?`)) return;
    try {
        await deleteDoc(doc(db, 'menuItems', id));
        menu = menu.filter(i => i.id !== id);
        renderMenuView();
    } catch(e) { alert('Failed: ' + e.message); }
};

// Download menu as CSV
window.adminDownloadMenuCSV = function() {
    const headers = ['ID','Name','Category','Description','Price (Full)','Price (Half)','Portion Type','Available','Image URL'];
    const rows = menu.map(i => [
        i.id, i.name, i.category, i.description||'',
        i.price, i.priceHalf||0, i.portionType||'',
        i.isAvailable !== false ? 'Yes' : 'No', i.imageUrl||''
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `barak_menu_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
};

//  Stock Admin View 
function renderStockAdminView() {
    const container = document.getElementById('stock-view');
    if (!container) return;

    const total    = stockItems.length;
    const low      = stockItems.filter(i => (Number(i.qty)||0) <= (Number(i.lowThresh)||5) && (Number(i.qty)||0) > 0).length;
    const critical = stockItems.filter(i => (Number(i.qty)||0) <= 0).length;
    const ok       = total - low - critical;

    const sorted = [...stockItems].sort((a,b) => (a.name||'').localeCompare(b.name||''));

    container.innerHTML = `
    <style>
        .stock-stat { background:var(--bg-card); border:1px solid var(--glass-border); border-radius:14px; padding:1.2rem 1.5rem; text-align:center; }
        .stock-stat h4 { font-size:0.6rem;letter-spacing:2px;text-transform:uppercase;opacity:0.4;margin-bottom:0.5rem; }
        .stock-stat .sv { font-size:1.8rem;font-weight:100; }
        .spill { display:inline-block;padding:2px 10px;border-radius:20px;font-size:0.6rem;font-weight:700;letter-spacing:1px;text-transform:uppercase; }
        .spill-ok       { background:rgba(34,197,94,0.12);color:#22C55E;border:1px solid rgba(34,197,94,0.3); }
        .spill-low      { background:rgba(245,158,11,0.12);color:#F59E0B;border:1px solid rgba(245,158,11,0.3); }
        .spill-critical { background:rgba(239,68,68,0.12);color:#EF4444;border:1px solid rgba(239,68,68,0.3); }
    </style>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:1.5rem;">
        <div class="stock-stat"><h4>Total Items</h4><div class="sv" style="color:var(--gold);">${total}</div></div>
        <div class="stock-stat"><h4>Low Stock</h4><div class="sv" style="color:#F59E0B;">${low}</div></div>
        <div class="stock-stat"><h4>Out of Stock</h4><div class="sv" style="color:#EF4444;">${critical}</div></div>
    </div>

    <div class="analytics-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
            <h3>Live Inventory</h3>
            <a href="stock.html" target="_blank"
                style="padding:0.5rem 1.1rem;background:rgba(212,175,55,0.12);color:var(--gold);border:1px solid rgba(212,175,55,0.3);border-radius:10px;font-size:0.75rem;font-weight:700;text-decoration:none;letter-spacing:1px;">
                 Manage Stock
            </a>
        </div>
        <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                <thead>
                    <tr style="border-bottom:1px solid var(--glass-border);color:var(--gold-primary);">
                        <th style="padding:0.8rem 1rem;text-align:left;font-size:0.6rem;letter-spacing:2px;text-transform:uppercase;opacity:0.5;">Item</th>
                        <th style="padding:0.8rem 1rem;text-align:left;font-size:0.6rem;letter-spacing:2px;text-transform:uppercase;opacity:0.5;">Category</th>
                        <th style="padding:0.8rem 1rem;text-align:left;font-size:0.6rem;letter-spacing:2px;text-transform:uppercase;opacity:0.5;">Qty</th>
                        <th style="padding:0.8rem 1rem;text-align:left;font-size:0.6rem;letter-spacing:2px;text-transform:uppercase;opacity:0.5;">Status</th>
                        <th style="padding:0.8rem 1rem;text-align:left;font-size:0.6rem;letter-spacing:2px;text-transform:uppercase;opacity:0.5;">Last Updated</th>
                    </tr>
                </thead>
                <tbody>
                    ${sorted.length === 0
                        ? `<tr><td colspan="5" style="text-align:center;padding:3rem;opacity:0.3;">No stock items yet — <a href="stock.html" target="_blank" style="color:var(--gold);">Add from Stock Manager</a></td></tr>`
                        : sorted.map(item => {
                            const qty = Number(item.qty)||0;
                            const thresh = Number(item.lowThresh)||5;
                            const status = qty <= 0 ? 'critical' : qty <= thresh ? 'low' : 'ok';
                            const pillLabel = status === 'ok' ? 'OK' : status === 'low' ? 'Low' : 'Out';
                            const qtyColor = status === 'critical' ? '#EF4444' : status === 'low' ? '#F59E0B' : '#22C55E';
                            const ts = item.updatedAt?.seconds
                                ? new Date(item.updatedAt.seconds*1000).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})
                                : '—';
                            return `<tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
                                <td style="padding:0.8rem 1rem;font-weight:700;">${item.name||'—'}</td>
                                <td style="padding:0.8rem 1rem;opacity:0.5;">${item.category||'—'}</td>
                                <td style="padding:0.8rem 1rem;color:${qtyColor};font-weight:800;font-size:1rem;">${qty} <span style="font-size:0.7rem;opacity:0.5;">${item.unit||'pcs'}</span></td>
                                <td style="padding:0.8rem 1rem;"><span class="spill spill-${status}">${pillLabel}</span></td>
                                <td style="padding:0.8rem 1rem;opacity:0.4;font-size:0.75rem;">${ts}</td>
                            </tr>`;
                        }).join('')
                    }
                </tbody>
            </table>
        </div>
    </div>`;
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
