/**
 * 
 * BARAK RESIDENCY — Staff Unified Portal v2.0
 * Collections:  staffProfiles, staffAttendance, serviceRequests,
 *               checkoutClearance, orders, notifications
 * 
 *
 * HOTEL STAFF  : Housekeeping alerts, Checkout-clearance gate, Service requests
 * REST STAFF   : Food-ready alerts, kitchen-order pickup notifications
 * BOTH PORTALS : Punch-in/out, 7-day attendance history, Login persist
 *
 * NOTIFICATION SOUND: Uses Web Audio API for screen-off playback.
 * All actions by staff auto-update Firestore so Reception/Admin portals
 * refresh immediately without any manual input by receptionist.
 */

import { initializeApp }       from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import {
    getFirestore, collection, doc, setDoc, getDoc, getDocs,
    onSnapshot, query, where, orderBy, limit, serverTimestamp,
    Timestamp, updateDoc, addDoc, deleteDoc
}                              from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signOut, onAuthStateChanged, browserLocalPersistence, setPersistence
}                              from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { firebaseConfig, app } from "./firebase-config.js";

//  Firebase Setup 
const db   = getFirestore(app);
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(console.warn);

//  State 
let currentProfile   = null;
let attendanceUnsub  = null;
let hotelNotifUnsub  = null;
let restNotifUnsub   = null;
let clockInterval    = null;
let seenNotifIds     = new Set(JSON.parse(localStorage.getItem('sr_seen_ids') || '[]'));

//  Shift Detection 
function detectShift(d = new Date()) {
    const h = d.getHours();
    if (h >= 5  && h < 12) return { label:"Morning Shift",   emoji:"", cls:"pill-morning",   badgeStyle:"background:rgba(251,191,36,0.15);color:#FBBF24;border:1px solid rgba(251,191,36,0.3);" };
    if (h >= 12 && h < 17) return { label:"Afternoon Shift", emoji:"️",  cls:"pill-afternoon", badgeStyle:"background:rgba(245,158,11,0.15);color:#F59E0B;border:1px solid rgba(245,158,11,0.3);" };
    if (h >= 17 && h < 21) return { label:"Evening Shift",   emoji:"", cls:"pill-evening",   badgeStyle:"background:rgba(139,92,246,0.15);color:#A78BFA;border:1px solid rgba(139,92,246,0.3);" };
    return                         { label:"Night Shift",    emoji:"", cls:"pill-night",     badgeStyle:"background:rgba(59,130,246,0.15);color:#93C5FD;border:1px solid rgba(59,130,246,0.3);" };
}

function greeting(name) {
    const f = (name || 'Friend').split(' ')[0];
    return `${f}! `;
}

function todayStr() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}
function todayDocId(uid) { return `${uid}_${todayStr()}`; }

// --- GPS Geofencing Configuration (1KM BETA RADIUS) ---
const HOTEL_LOCATION = { lat: 24.8152692, lng: 92.799027 }; 
const MAX_DISTANCE_METERS = 1000; 

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const rad = Math.PI/180;
    const φ1 = lat1 * rad;
    const φ2 = lat2 * rad;
    const Δφ = (lat2-lat1) * rad;
    const Δλ = (lon2-lon1) * rad;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; 
}

function verifyLocationAndPunch(type) {
    if (!navigator.geolocation) { alert("GPS not supported on this device."); return; }
    
    setStatus('punch-status', '🛰️ Verifying GPS…', 'warning');
    
    navigator.geolocation.getCurrentPosition((pos) => {
        const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, HOTEL_LOCATION.lat, HOTEL_LOCATION.lng);
        if (dist > MAX_DISTANCE_METERS) {
            const km = (dist / 1000).toFixed(2);
            alert(`ACCESS DENIED: You are ${km}km away from Barak Residency. Please be on-site to mark attendance.`);
            setStatus('punch-status', `Out of range (${km}km)`, 'error');
        } else {
            if (type === 'in') doProcessPunchIn(pos.coords.latitude, pos.coords.longitude);
            else doProcessPunchOut(pos.coords.latitude, pos.coords.longitude);
        }
    }, (err) => {
        alert("Location Error: Please turn on High Accuracy GPS in your phone settings.");
        setStatus('punch-status', 'Location Error', 'error');
    }, { enableHighAccuracy: true, timeout: 5000 });
}

//  Audio Notification (works even with screen off via AudioContext) 
let audioCtx = null;
function playAlertSound() {
    // Try real audio first (best quality)
    const audio = document.getElementById('notif-audio');
    if (audio) {
        audio.play().catch(() => {
            // Fallback: synthesize a beep via AudioContext
            try {
                if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.frequency.value = 880;
                gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
                osc.start(audioCtx.currentTime);
                osc.stop(audioCtx.currentTime + 0.6);
            } catch (_) {}
        });
    }
}

// Unlock audio context and request native push notifications on first interaction
document.addEventListener('touchstart', () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    requestPushPermission();
}, { once: true });
document.addEventListener('click', () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    requestPushPermission();
}, { once: true });

//  Web Push Notification (for background/Screen-Off alerts) 
async function requestPushPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        await Notification.requestPermission();
    }
}

function showSystemNotification(title, body) {
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: 'br.png',
            badge: 'br.png',
            vibrate: [200, 100, 200],
            requireInteraction: true
        });
    }
}

//  Clock 
function startClock() {
    const tick = () => {
        const now  = new Date();
        const tEl  = document.getElementById('live-time');
        const dEl  = document.getElementById('live-date');
        const bEl  = document.getElementById('shift-badge');
        const s = detectShift(now);

        const timeStr = now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
        if (tEl) tEl.textContent = timeStr;
        if (dEl) dEl.textContent = now.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
        if (bEl) {
            bEl.textContent = `${s.emoji}  ${s.label}`;
            bEl.setAttribute('style', `${s.badgeStyle} padding:0.3rem 1rem; border-radius:30px; font-size:0.68rem; font-weight:700; letter-spacing:2px; text-transform:uppercase; display:inline-block; margin-top:0.8rem;`);
        }

        // Sticky Header Update
        const stbClock = document.getElementById('stb-clock');
        const stbShift = document.getElementById('stb-shift');
        if (stbClock) stbClock.textContent = timeStr;
        if (stbShift) stbShift.textContent = s.label;

        const sticky = document.getElementById('sticky-header');
        if (sticky) sticky.style.display = 'flex';
    };
    tick();
    clockInterval = setInterval(tick, 1000);
}

//  UI Helpers 
function setMsg(id, text, type = 'error') {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text; el.className = `msg ${type}`; el.style.display = 'block';
}
function clearMsg(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
function setStatus(elId, text, type = '') {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = text ? `<div class="status-msg ${type}">${text}</div>` : '';
}
function hideLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) { loader.style.opacity = '0'; setTimeout(() => loader.style.display = 'none', 500); }
}
function showAuthPanel() {
    if (clockInterval) { clearInterval(clockInterval); clockInterval = null; }
    if (attendanceUnsub) { attendanceUnsub(); attendanceUnsub = null; }
    if (hotelNotifUnsub) { hotelNotifUnsub(); hotelNotifUnsub = null; }
    if (restNotifUnsub)  { restNotifUnsub();  restNotifUnsub  = null; }
    window.location.href = 'index.html';
}

//  Profile Loading 
async function loadProfile(uid) {
    const snap = await getDoc(doc(db, 'staffProfiles', uid));
    return snap.exists() ? snap.data() : null;
}

function populateDashboard(profile) {
    const el = id => document.getElementById(id);
    if (el('welcome-name'))  el('welcome-name').textContent  = greeting(profile.name);
    if (el('welcome-dept'))  el('welcome-dept').textContent  = `${profile.department || 'Staff'} · ${profile.email}`;
    if (el('avatar-initials')) el('avatar-initials').textContent = (profile.name || '?').charAt(0).toUpperCase();

    // Show/hide portal switcher
    const team = profile.team || 'hotel';
    const dept = (profile.department || '').toLowerCase();
    const switcher = el('portal-switcher');
    if (team === 'both' && switcher) {
        switcher.style.display = 'flex';
    } else if (switcher) {
        switcher.style.display = 'none';
    }

    // Manager vs Staff tools
    const inventoryBtn = el('btn-adm-inventory');
    if (inventoryBtn) {
        if (dept.includes('admin') || dept.includes('manager') || dept.includes('owner')) {
            inventoryBtn.style.display = 'block';
        } else {
            inventoryBtn.style.display = 'none';
        }
    }

    // Default to the right portal
    if (team === 'restaurant') {
        window.switchPortal('restaurant');
    } else {
        window.switchPortal('hotel');
    }
}

//  Attendance Listener 
function listenToday(uid) {
    const docRef = doc(db, 'staffAttendance', todayDocId(uid));
    if (attendanceUnsub) attendanceUnsub();
    attendanceUnsub = onSnapshot(docRef, snap => {
        const data = snap.exists() ? snap.data() : {};
        const to = ts => ts ? (ts.toDate ? ts.toDate() : new Date(ts)) : null;
        const inT  = to(data.inTime);
        const outT = to(data.outTime);

        const inEl  = document.getElementById('display-in');
        const outEl = document.getElementById('display-out');
        const btnIn  = document.getElementById('btn-punch-in');
        const btnOut = document.getElementById('btn-punch-out');

        if (inT) {
            if (inEl) inEl.innerHTML = `<span class="ps-time">${inT.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}</span>`;
        } else {
            if (inEl) inEl.innerHTML  = `<span class="ps-empty">Not punched</span>`;
        }

        if (outT) {
            if (outEl) outEl.innerHTML = `<span class="ps-time">${outT.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}</span>`;
        } else {
            if (outEl) outEl.innerHTML = `<span class="ps-empty">Not punched</span>`;
        }
    });
}

//  Punch In / Out 
window.punchIn = () => verifyLocationAndPunch('in');
window.punchOut = () => verifyLocationAndPunch('out');

async function doProcessPunchIn(lat, lng) {
    const elIn = document.getElementById('display-in');
    const elOut = document.getElementById('display-out');
    if (elIn) elIn.textContent = 'Recording…';
    if (elOut) { elOut.textContent = '--:--'; elOut.className = 'ps-empty'; }
    const user = auth.currentUser;
    if (!user || !currentProfile) return;
    const now = new Date();
    const shift = detectShift(now);
    try {
        await setDoc(doc(db, 'staffAttendance', todayDocId(user.uid)), {
            uid: user.uid, email: currentProfile.email, name: currentProfile.name,
            department: currentProfile.department, team: currentProfile.team || 'hotel',
            date: todayStr(), inTime: Timestamp.fromDate(now),
            shift: shift.label, status: 'In', 
            latIn: lat, lngIn: lng,
            updatedAt: serverTimestamp()
        }, { merge: true });
        setStatus('punch-status', ' Punched in!', 'success');
        loadHistory(user.uid);
    } catch (e) {
        setStatus('punch-status', ' ' + e.message, 'error');
    }
}

async function doProcessPunchOut(lat, lng) {
    const user = auth.currentUser;
    if (!user) return;
    const now = new Date();
    try {
        const existing = await getDoc(doc(db, 'staffAttendance', todayDocId(user.uid)));
        let durationMins = null;
        if (existing.exists() && existing.data().inTime) {
            const inDate = existing.data().inTime.toDate();
            durationMins = Math.round((now - inDate) / 60000);
        }
        await setDoc(doc(db, 'staffAttendance', todayDocId(user.uid)), {
            outTime: Timestamp.fromDate(now), status: 'Out',
            durationMins, latOut: lat, lngOut: lng,
            updatedAt: serverTimestamp()
        }, { merge: true });

        const elOut = document.getElementById('display-out');
        if (elOut) { elOut.textContent = '--:--'; elOut.className = 'ps-empty'; }

        setStatus('punch-status', ' Punched out!', 'success');
        loadHistory(user.uid);
    } catch (e) {
        setStatus('punch-status', ' ' + e.message, 'error');
    }
}

//  7-Day History 
async function loadHistory(uid) {
    const days = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        days.push({ key: `${uid}_${y}-${m}-${dd}`, date: d });
    }

    const rows = await Promise.all(days.map(async ({ key, date }) => {
        let data = {};
        try {
            const s = await getDoc(doc(db, 'staffAttendance', key));
            if (s.exists()) data = s.data();
        } catch (_) {}
        const toDate = ts => ts ? (ts.toDate ? ts.toDate() : new Date(ts)) : null;
        const inT  = toDate(data.inTime);
        const outT = toDate(data.outTime);
        const s = detectShift(inT || date);
        const dateLabel = date.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' });
        const inStr  = inT  ? inT.toLocaleTimeString('en-IN',  { hour:'2-digit', minute:'2-digit' }) : '—';
        const outStr = outT ? outT.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) : '—';
        let durStr = '—';
        if (inT && outT) { const m = Math.round((outT-inT)/60000); durStr = `${Math.floor(m/60)}h ${m%60}m`; }
        const pillClass = inT ? s.cls : 'pill-unknown';
        const pillLabel = inT ? (data.shiftLabel || s.label.split(' ')[0]) : 'Absent';
        return `<div class="history-row">
            <div><div style="font-weight:600;margin-bottom:0.2rem;">${dateLabel}</div>
                <div class="history-date">${inStr} → ${outStr} · ${durStr}</div></div>
            <span class="shift-pill ${pillClass}">${pillLabel}</span>
        </div>`;
    }));

    const html = rows.join('');
    const hEl = document.getElementById('hotel-history-list');
    const rEl = document.getElementById('rest-history-list');
    if (hEl) hEl.innerHTML = html;
    if (rEl) rEl.innerHTML = html;
}

// 
// HOTEL STAFF NOTIFICATIONS
// Listens to: serviceRequests + checkoutClearance
// Staff marks tasks done → auto-updates reception desk
// 
function startHotelNotifListener() {
    if (hotelNotifUnsub) hotelNotifUnsub();

    // Hotel: service requests (pending housekeep, etc.)
    const serviceUnsub = onSnapshot(
        query(collection(db, 'serviceRequests'), where('status', '==', 'pending'), orderBy('timestamp', 'desc'), limit(30)),
        snap => {
            const tasks = snap.docs.map(d => ({ id: d.id, ...d.data(), _col: 'serviceRequests' }));
            _hotelServiceTasks = tasks;
            _renderHotelCombined();
        }, err => console.warn('[HotelNotif]', err)
    );

    // Hotel: checkout clearance requests
    const checkoutUnsub = onSnapshot(
        query(collection(db, 'checkoutClearance'), where('staffStatus', '==', 'pending'), orderBy('timestamp', 'desc'), limit(20)),
        snap => {
            const tasks = snap.docs.map(d => ({ id: d.id, ...d.data(), _col: 'checkoutClearance' }));
            _hotelCheckoutTasks = tasks;
            _renderHotelCombined();
        }, err => console.warn('[CheckoutNotif]', err)
    );

    // Hotel: ROOM food orders that are 'Ready' — hotel staff picks up and delivers to room
    const roomOrderUnsub = onSnapshot(
        query(collection(db, 'orders'),
            where('orderType', '==', 'room'),
            where('status', 'in', ['Ready', 'Pending', 'Kitchen']),
            orderBy('timestamp', 'desc'), limit(30)),
        snap => {
            _hotelRoomOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Alert on newly ready room orders
            _hotelRoomOrders.filter(o => o.status === 'Ready').forEach(o => {
                if (!seenNotifIds.has(o.id + '_room_ready')) {
                    seenNotifIds.add(o.id + '_room_ready');
                    localStorage.setItem('sr_seen_ids', JSON.stringify([...seenNotifIds]));
                    playAlertSound();
                    showSystemNotification('️ Room Food Ready!',
                        `Order for Room ${o.roomNumber || '?'} — ${(o.items||[]).map(i=>i.name).slice(0,2).join(', ')}`);
                }
            });

            _renderHotelCombined();
        }, err => console.warn('[HotelRoomOrder]', err)
    );

    hotelNotifUnsub = () => { serviceUnsub(); checkoutUnsub(); roomOrderUnsub(); };
}

// Combined render for hotel (service tasks + checkout + room food orders)
let _hotelServiceTasks  = [];
let _hotelCheckoutTasks = [];
let _hotelRoomOrders    = [];

function _renderHotelCombined() {
    const combined = [..._hotelCheckoutTasks, ..._hotelServiceTasks];
    renderHotelTasks(combined, 'all');

    // Render room food orders in hotel task inbox as a separate block
    const container = document.getElementById('hotel-notif-list');
    if (!container) return;

    const roomOrderHtml = _hotelRoomOrders.map(o => {
        const isReady = o.status === 'Ready';
        const time = o.timestamp ? new Date(o.timestamp?.seconds ? o.timestamp.seconds*1000 : o.timestamp).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) : '—';
        const items = (o.items||[]).slice(0,3).map(i=>i.name).join(', ');
        const typeClass = isReady ? 'type-ready' : 'type-order';
        return `<div class="notif-item ${typeClass}" id="hro-${o.id}">
            <div class="notif-header">
                <span class="notif-title">️ Room ${o.roomNumber || '?'} Order</span>
                <span class="notif-time">${time}</span>
            </div>
            <div class="notif-msg">${items || 'Food order'}</div>
            <div style="font-size:0.72rem;font-weight:700;color:${isReady ? 'var(--green)' : '#FBBF24'};margin-bottom:0.6rem;">${isReady ? 'READY — Pick up from Kitchen' : (o.status||'PENDING').toUpperCase()}</div>
            <div class="notif-actions">
                ${isReady ? `<button class="btn-notif btn-done" onclick="markOrderDelivered('${o.id}')"> Delivered to Room</button>` : '<span style="font-size:0.7rem;color:var(--text-mute);">Kitchen preparing…</span>'}
            </div>
        </div>`;
    }).join('');

    if (roomOrderHtml) {
        container.innerHTML += roomOrderHtml;
    }
}

// 
// RESTAURANT STAFF NOTIFICATIONS — TABLE orders only (NOT room orders)
// Listens to: orders with orderType='table'|'pickup'|'guest' that are Kitchen/Ready
// 
let _seenOrderIds = new Set(JSON.parse(localStorage.getItem('order_seen_ids') || '[]'));

function startRestNotifListener() {
    if (restNotifUnsub) restNotifUnsub();

    // Restaurant: TABLE food orders only (not room orders)
    const tableOrderSub = onSnapshot(
        query(collection(db, 'orders'),
            where('orderType', 'in', ['table', 'pickup', 'guest']),
            where('status', 'in', ['Ready', 'Pending', 'Kitchen']),
            orderBy('timestamp', 'desc'), limit(40)),
        snap => {
            const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Alert on newly ready table orders
            orders.filter(o => o.status === 'Ready').forEach(o => {
                if (!_seenOrderIds.has(o.id + '_ready')) {
                    _seenOrderIds.add(o.id + '_ready');
                    localStorage.setItem('order_seen_ids', JSON.stringify([..._seenOrderIds]));
                    playAlertSound();
                    showSystemNotification('️ Food Ready for Pickup!',
                        `Order #${o.id.slice(-6)} for Table ${o.tableId || '?'} — ${(o.items||[]).map(i=>i.name).slice(0,2).join(', ')}`);
                }
            });

            renderRestTasks(orders);
        },
        err => {
            // Fallback: if compound query fails (index not yet created), fetch all active orders and filter client-side
            console.warn('[RestNotif] Index may be missing, falling back to all orders:', err.message);
            const allSub = onSnapshot(
                query(collection(db, 'orders'), where('status', 'in', ['Ready', 'Pending', 'Kitchen']), orderBy('timestamp', 'desc'), limit(60)),
                snap2 => {
                    const allOrders = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
                    // Client-side filter: exclude room orders for restaurant staff
                    const restOrders = allOrders.filter(o => o.orderType !== 'room');
                    renderRestTasks(restOrders);
                }
            );
            restNotifUnsub = () => allSub();
        }
    );

    restNotifUnsub = () => tableOrderSub();
}



//  Hotel Task Actions 

/** Staff marks a service request (cleaning, etc.) as done — auto-updates reception */
window.markServiceDone = async function (id) {
    try {
        await updateDoc(doc(db, 'serviceRequests', id), {
            status:      'completed',
            completedAt: serverTimestamp(),
            completedBy: currentProfile?.name || 'Staff'
        });
        // Remove from local seen set so it doesn't re-alert
        seenNotifIds.delete(id);
        localStorage.setItem('sr_seen_ids', JSON.stringify([...seenNotifIds]));
    } catch (e) { alert('Failed: ' + e.message); }
};

/** Staff marks checkout room as CLEAR — reception checkout button unblocks */
window.markCheckoutClear = async function (clearId, roomNumber) {
    try {
        await updateDoc(doc(db, 'checkoutClearance', clearId), {
            staffStatus:  'cleared',
            clearedAt:    serverTimestamp(),
            clearedBy:    currentProfile?.name || 'Staff',
            issueFound:   false,
            note:         'Room inspected and cleared'
        });
        // Add a positive service request so reception sees it
        await addDoc(collection(db, 'serviceRequests'), {
            type:       'checkout_clear',
            roomNumber: roomNumber,
            message:    `Room ${roomNumber} cleared by ${currentProfile?.name || 'Staff'}`,
            status:     'completed',
            timestamp:  serverTimestamp()
        });
    } catch (e) { alert('Failed: ' + e.message); }
};

/** Staff marks checkout room as having an ISSUE — reception checkout stays blocked */
window.markCheckoutIssue = async function (clearId, roomNumber) {
    const note = prompt(`Describe the issue found in Room ${roomNumber}:`) || 'Issue found — needs attention';
    try {
        await updateDoc(doc(db, 'checkoutClearance', clearId), {
            staffStatus: 'issue',
            issueNote:   note,
            issueAt:     serverTimestamp(),
            issueBy:     currentProfile?.name || 'Staff',
            issueFound:  true
        });
        // Add a service request so reception desk is aware
        await addDoc(collection(db, 'serviceRequests'), {
            type:       'checkout_issue',
            roomNumber: roomNumber,
            message:    `Issue in Room ${roomNumber}: ${note}. Please resolve before checkout.`,
            status:     'pending',
            timestamp:  serverTimestamp()
        });
    } catch (e) { alert('Failed: ' + e.message); }
};

window.dismissTask = async function (id, col) {
    try {
        await updateDoc(doc(db, col, id), { status: 'dismissed' });
        seenNotifIds.delete(id);
    } catch (e) { console.warn(e); }
};


//  renderHotelTasks — renders the combined hotel task inbox 
function renderHotelTasks(combined) {
    const container = document.getElementById('hotel-notif-list');
    const badge = document.getElementById('hotel-notif-count');
    const pulse = document.getElementById('hotel-pulse');

    // Check for NEW tasks and play sound
    let hasNew = false;
    combined.forEach(t => {
        if (!seenNotifIds.has(t.id)) {
            hasNew = true;
            seenNotifIds.add(t.id);
            showSystemNotification(
                t._col === 'checkoutClearance' ? ' Checkout Clearance Required' : ' Task Alert',
                t.message || t.type || 'New task from reception'
            );
        }
    });
    if (hasNew) {
        playAlertSound();
        localStorage.setItem('sr_seen_ids', JSON.stringify([...seenNotifIds]));
    }

    const count = combined.length;
    if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'flex' : 'none'; }
    if (pulse) pulse.style.display = count > 0 ? 'inline-block' : 'none';

    if (!container) return;
    if (count === 0) {
        container.innerHTML = '<div class="empty-state">No pending tasks. All clear </div>';
        return;
    }

    container.innerHTML = combined.map(t => {
        const isCheckout = t._col === 'checkoutClearance';
        const time = t.timestamp ? new Date(t.timestamp?.seconds ? t.timestamp.seconds*1000 : t.timestamp).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) : '—';
        const typeClass = isCheckout ? 'type-checkout' : (t.type === 'housekeeping' ? 'type-housekeep' : 'type-service');
        const icon = isCheckout ? '' : (t.type === 'housekeeping' ? '' : '️');
        const title = isCheckout ? `CHECKOUT CLEARANCE — Room ${t.roomNumber}` : `${icon} ${(t.type || 'Service').toUpperCase()} — Room ${t.roomNumber}`;
        const actions = isCheckout
            ? `<button class="btn-notif btn-done"  onclick="markCheckoutClear('${t.id}','${t.roomNumber}')"> Room Clear</button>
               <button class="btn-notif btn-issue" onclick="markCheckoutIssue('${t.id}','${t.roomNumber}')">️ Issue Found</button>`
            : `<button class="btn-notif btn-done"  onclick="markServiceDone('${t.id}')"> Mark Done</button>
               <button class="btn-notif btn-dismiss" onclick="dismissTask('${t.id}','serviceRequests')">Dismiss</button>`;
        return `<div class="notif-item ${typeClass}" id="ntask-${t.id}">
            <div class="notif-header"><span class="notif-title">${title}</span><span class="notif-time">${time}</span></div>
            <div class="notif-msg">${t.message || t.note || 'New task from reception desk'}</div>
            <div class="notif-actions">${actions}</div>
        </div>`;
    }).join('');
}



function renderRestTasks(orders) {
    const container = document.getElementById('rest-notif-list');
    const badge    = document.getElementById('rest-notif-count');
    const pulse    = document.getElementById('rest-pulse');

    const active = orders.filter(o => o.status !== 'Delivered' && o.status !== 'cancelled' && o.status !== 'Cancelled');
    const count  = active.length;

    if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'flex' : 'none'; }
    if (pulse) pulse.style.display  = count > 0 ? 'inline-block' : 'none';

    if (!container) return;
    if (count === 0) {
        container.innerHTML = '<div class="empty-state">No active food tasks</div>';
        return;
    }

    container.innerHTML = active.map(o => {
        const isReady   = o.status === 'Ready';
        const isPending = o.status === 'Pending' || o.status === 'Kitchen';
        const time      = o.timestamp ? new Date(o.timestamp?.seconds ? o.timestamp.seconds*1000 : o.timestamp).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) : '—';
        const target    = o.roomNumber ? `Room ${o.roomNumber}` : (o.tableId ? `Table ${o.tableId}` : 'Guest');
        const statusColor = isReady ? 'var(--green)' : (isPending ? '#FBBF24' : '#93C5FD');
        const statusLabel = isReady ? 'READY FOR PICKUP' : (o.status || 'PENDING').toUpperCase();
        const typeClass   = isReady ? 'type-ready' : 'type-order';

        const items = (o.items || []).slice(0, 3).map(i => i.name).join(', ');
        const moreCount = (o.items || []).length - 3;
        const itemStr = items + (moreCount > 0 ? ` +${moreCount} more` : '');

        const actions = isReady
            ? `<button class="btn-notif btn-done" onclick="markOrderDelivered('${o.id}')"> Picked Up from Kitchen</button>`
            : `<span style="font-size:0.7rem;color:var(--text-mute);">Waiting for kitchen...</span>`;

        return `<div class="notif-item ${typeClass}" id="order-${o.id}">
            <div class="notif-header">
                <span class="notif-title">${target} — #${String(o.id).slice(-6)}</span>
                <span class="notif-time">${time}</span>
            </div>
            <div class="notif-msg" style="margin-bottom:0.4rem;">${itemStr}</div>
            <div style="font-size:0.72rem;font-weight:700;color:${statusColor};margin-bottom:0.6rem;">${statusLabel}</div>
            <div class="notif-actions">${actions}
                ${isReady ? `<button class="btn-notif btn-dismiss" onclick="markOrderDelivered('${o.id}')">Serve Guest</button>` : ''}
            </div>
        </div>`;
    }).join('');
}

/** Staff picks up food from kitchen → marks Delivered (updates reception bill too) */
window.markOrderDelivered = async function (orderId) {
    try {
        await updateDoc(doc(db, 'orders', orderId), {
            status:      'Delivered',
            deliveredAt: serverTimestamp(),
            deliveredBy: currentProfile?.name || 'Staff'
        });
        _seenOrderIds.delete(orderId + '_ready');
        localStorage.setItem('order_seen_ids', JSON.stringify([..._seenOrderIds]));
    } catch (e) { alert('Failed: ' + e.message); }
};

//  Logout 
window.staffLogout = async function () {
    if (attendanceUnsub) attendanceUnsub();
    if (hotelNotifUnsub) hotelNotifUnsub();
    if (restNotifUnsub)  restNotifUnsub();
    await signOut(auth);
    currentProfile = null;
    window.location.href = 'index.html';
};

//  Auth State Observer 
onAuthStateChanged(auth, async user => {
    hideLoader();
    if (user) {
        try {
            const profile = await loadProfile(user.uid);
            if (!profile) { window.location.href = 'index.html'; return; }
            currentProfile = profile;
            populateDashboard(profile);
            startClock();
            listenToday(user.uid);
            loadHistory(user.uid);

            // Request notification permission for screen-off alerts
            await requestPushPermission();
            
            // --- NATIVE PUSH REGISTRATION (Capacitor) ---
            if (window.Capacitor && window.Capacitor.isPluginAvailable('PushNotifications')) {
                const PushNotifications = window.Capacitor.Plugins.PushNotifications;
                const perm = await PushNotifications.requestPermissions();
                if (perm.receive === 'granted') {
                    await PushNotifications.register();
                    console.log("[NativePush] Registered successfully.");
                    
                    // Handle notification arrival while app is background/lockscreen
                    PushNotifications.addListener('pushNotificationReceived', (notification) => {
                        console.log('[NativePush] Received:', notification);
                    });
                }
            }

            // Start the right notification listeners
            if (profile) {
                const team = profile.team || 'hotel';
                if (team === 'hotel' || team === 'both') startHotelNotifListener();
                if (team === 'restaurant' || team === 'both') startRestNotifListener();
            }

        } catch (err) {
            console.error('[Auth]', err);
            window.location.href = 'index.html';
        }
    } else {
        window.location.href = 'index.html';
    }
});

// Stock Hub (Staff update wrapper)
window.openStockApp = function() {
    const frame = document.getElementById('stock-iframe');
    if (frame && !frame.src) frame.src = 'stock.html?embedded=1';
    const overlay = document.getElementById('stock-app-overlay');
    if (overlay) overlay.style.display = 'flex';
};
window.closeStockApp = function() {
    const overlay = document.getElementById('stock-app-overlay');
    if (overlay) overlay.style.display = 'none';
};

// Use Stock Popup (Staff Remove Only)
let _useStockSelectedId   = null;
let _useStockSelectedName = '';
let _useStockCurrentQty   = 0;

window.openUseStockPopup = async function() {
    _useStockSelectedId = null;
    const modal = document.getElementById('use-stock-modal');
    const list  = document.getElementById('use-stock-list');
    const msg   = document.getElementById('use-stock-msg');
    const selEl = document.getElementById('use-stock-selected');
    if (!modal) return;
    if (selEl) selEl.textContent = '\u2014 tap an item above \u2014';
    if (msg)   msg.style.display = 'none';
    modal.style.display = 'flex';
    list.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.3);padding:2rem;">Loading stock...</div>';
    try {
        const snap  = await getDocs(collection(db, 'stock'));
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .filter(i => (i.category || '').toLowerCase().includes('drink')) // Drink filter requested
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        if (!items.length) {
            list.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.3);padding:2rem;">No drink items in stock.</div>';
            return;
        }
        list.innerHTML = items.map(item => {
            const qty = Number(item.qty) || 0;
            const col = qty <= 0 ? '#EF4444' : qty <= 5 ? '#F59E0B' : '#22C55E';
            const safeName = (item.name || '').replace(/'/g, "\\'");
            return `<div onclick="selectUseStockItem('${item.id}','${safeName}',${qty})"
                id="usestk-row-${item.id}"
                style="display:flex;justify-content:space-between;align-items:center;
                       background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);
                       border-radius:10px;padding:0.7rem 1rem;cursor:pointer;transition:0.15s;">
                <div>
                    <div style="font-weight:700;font-size:0.85rem;">${item.name || '\u2014'}</div>
                    <div style="font-size:0.68rem;color:rgba(255,255,255,0.35);">${item.category || ''}</div>
                </div>
                <div style="font-size:0.9rem;font-weight:800;color:${col};">${qty} <span style="font-size:0.65rem;opacity:0.6;">${item.unit || 'pcs'}</span></div>
            </div>`;
        }).join('');
    } catch(e) {
        list.innerHTML = '<div style="color:#EF4444;text-align:center;padding:2rem;">Error loading stock</div>';
    }
};

window.selectUseStockItem = function(id, name, qty) {
    _useStockSelectedId   = id;
    _useStockSelectedName = name;
    _useStockCurrentQty   = qty;
    document.querySelectorAll('[id^="usestk-row-"]').forEach(el => {
        el.style.background  = 'rgba(255,255,255,0.03)';
        el.style.borderColor = 'rgba(255,255,255,0.07)';
    });
    const row = document.getElementById('usestk-row-' + id);
    if (row) { row.style.background = 'rgba(239,68,68,0.12)'; row.style.borderColor = 'rgba(239,68,68,0.5)'; }
    const selEl = document.getElementById('use-stock-selected');
    if (selEl) selEl.textContent = name + '  (current qty: ' + qty + ')';
    const qtyEl = document.getElementById('use-stock-qty');
    if (qtyEl) { qtyEl.value = 1; qtyEl.max = qty; }
};

window.closeUseStockPopup = function() {
    const modal = document.getElementById('use-stock-modal');
    if (modal) modal.style.display = 'none';
};

window.confirmUseStock = async function() {
    const msg = document.getElementById('use-stock-msg');
    if (!_useStockSelectedId) {
        if (msg) { msg.style.display='block'; msg.style.color='#EF4444'; msg.textContent='Select an item first.'; }
        return;
    }
    const qty    = parseInt(document.getElementById('use-stock-qty')?.value) || 1;
    const newQty = Math.max(0, _useStockCurrentQty - qty);
    try {
        await updateDoc(doc(db, 'stock', _useStockSelectedId), { qty: newQty, updatedAt: serverTimestamp() });
        updateDoc(doc(db, 'menuItems', _useStockSelectedId), { isAvailable: newQty > 0 }).catch(e=>{});
        if (msg) { msg.style.display='block'; msg.style.color='#22C55E'; msg.textContent='Removed ' + qty + ' from "' + _useStockSelectedName + '". New qty: ' + newQty; }
        _useStockSelectedId = null;
        setTimeout(() => window.openUseStockPopup(), 1300);
    } catch(e) {
        if (msg) { msg.style.display='block'; msg.style.color='#EF4444'; msg.textContent='Failed: ' + e.message; }
    }
};

// ─── Overlay helpers ───────────────────────────────────────────────────────

function _sendReset(iframe) {
    try { if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage({ action: 'reset' }, '*'); } catch(e) {}
}

window.openPickupOverlay = function() {
    const overlay = document.getElementById('pickup-overlay');
    const iframe  = document.getElementById('pickup-iframe');
    if (!overlay || !iframe) return;
    const src = iframe.getAttribute('src');
    if (!src || src === 'about:blank') {
        iframe.setAttribute('src', 'restaurant_pickup.html');
    } else {
        _sendReset(iframe); // cached — reset UI before showing
    }
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (window.pushOverlayState) window.pushOverlayState('pickup');
};

window.closePickupOverlay = function() {
    const overlay = document.getElementById('pickup-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = 'auto';
};

window.openRestWaiter = function() {
    const overlay = document.getElementById('rest-waiter-overlay');
    const iframe  = document.getElementById('rest-waiter-iframe');
    if (!overlay || !iframe) return;
    const src = iframe.getAttribute('src');
    if (!src || src === 'about:blank') {
        iframe.setAttribute('src', 'restaurant_waiter.html');
    } else {
        _sendReset(iframe); // cached — reset UI before showing
    }
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (window.pushOverlayState) window.pushOverlayState('rest-waiter');
};

window.closeRestWaiter = function() {
    const overlay = document.getElementById('rest-waiter-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = 'auto';
};

window.openHotelWaiter = function() {
    const overlay = document.getElementById('waiter-overlay');
    const iframe  = document.getElementById('waiter-iframe');
    if (!overlay || !iframe) return;
    const src = iframe.getAttribute('src');
    if (!src || src === 'about:blank') {
        iframe.setAttribute('src', 'hotel_waiter.html');
    } else {
        _sendReset(iframe); // cached — reset UI before showing
    }
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (window.pushOverlayState) window.pushOverlayState('hotel-waiter');
};

window.closeHotelWaiter = function() {
    const overlay = document.getElementById('waiter-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = 'auto';
};

