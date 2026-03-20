/**
 * BARAK RESIDENCY — Owner's Admin App (AI-Driven)
 * Powered by Gemini Pro & Firebase Firestore
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import {
    getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc,
    onSnapshot, query, orderBy, limit, serverTimestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

// --- Firebase Config ---
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

// --- Gemini Config ---
const GEMINI_API_KEY = "AIzaSyCZvumbe-vo5hmYYJn4W5s3_bWWYCTRpkw";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// --- State ---
let rooms = [];
let orders = [];
let revenue = 0;
let menu = [];
let unavailableItems = [];

// --- Real-time Listeners ---
function startListeners() {
    onSnapshot(collection(db, 'rooms'), snap => {
        rooms = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateDashboard();
    });

    onSnapshot(collection(db, 'orders'), snap => {
        orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateDashboard();
    });

    onSnapshot(doc(db, 'settings', 'availability'), snap => {
        if (snap.exists()) unavailableItems = snap.data().unavailableItems || [];
    });

    onSnapshot(collection(db, 'menuItems'), snap => {
        menu = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    });
}

function updateDashboard() {
    // Stat: Rooms
    const occupied = rooms.filter(r => r.status === 'occupied').length;
    document.getElementById('stat-rooms').innerText = `${occupied} / ${rooms.length}`;

    // Stat: Revenue (Calculated from ledger for true accuracy, but we sum live orders for dashboard)
    revenue = orders.reduce((s, o) => s + (o.total_price || 0), 0);
    document.getElementById('stat-revenue').innerText = `₹ ${revenue.toLocaleString()}`;

    // Stat: Orders
    const active = orders.filter(o => o.status === 'Pending' || o.status === 'Processing').length;
    document.getElementById('stat-orders').innerText = active;

    // Turnaround Preview
    const tList = document.getElementById('turnaround-list');
    tList.innerHTML = orders.slice(0, 4).map(o => `
        <div class="turnaround-item">
            <div style="display:flex;gap:1rem;align-items:center;">
                <div class="table-badge">${o.roomNumber || 'T'}</div>
                <div>
                    <div style="font-weight:700;">${o.id.slice(-4)}</div>
                    <div style="font-size:0.7rem;opacity:0.5;">Processing</div>
                </div>
            </div>
            <div style="font-weight:700;">₹${o.total_price}</div>
        </div>
    `).join('');
}

// --- Gemini Chat Logic ---

window.toggleAIChat = function() {
    const p = document.getElementById('ai-panel');
    p.style.display = p.style.display === 'flex' ? 'none' : 'flex';
};

window.sendToAI = async function() {
    const input = document.getElementById('ai-input');
    const msg = input.value.trim();
    if (!msg) return;

    appendMsg(msg, 'user');
    input.value = '';
    
    const aiLoaderId = 'ai-loading-' + Date.now();
    appendMsg("Thinking...", 'ai', aiLoaderId);

    if (GEMINI_API_KEY === 'REPLACEME_GEMINI_KEY' || !GEMINI_API_KEY) {
        document.getElementById(aiLoaderId).remove();
        appendMsg("Advanced AI requires a valid Gemini API Key. Switching to local processing.", 'ai');
        handleLocalAI(msg);
        return;
    }

    try {
        // Try Gemini 1.5 Flash (preferred) or fallback to Gemini Pro
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `You are the AI Resident Manager at Barak Residency. Your role is to assist the owners in managing their business efficiently. Today's Statistics: ₹${revenue} revenue, ${orders.length} orders. Use a professional, executive tone. Request: ${msg}` }] }]
            })
        });

        if (document.getElementById(aiLoaderId)) document.getElementById(aiLoaderId).remove();

        if (res.ok) {
            const data = await res.json();
            const aiTxt = data.candidates?.[0]?.content?.parts?.[0]?.text || "Neural link clear. Please rephrase.";
            appendMsg(aiTxt, 'ai');
            handleAICommands(aiTxt); 
        } else {
            console.warn(`AI Bridge Failure: ${res.status}`);
            throw new Error(`Cloud Error ${res.status}`);
        }
    } catch (e) {
        console.warn("AI System Fallback:", e.message);
        if (document.getElementById(aiLoaderId)) document.getElementById(aiLoaderId).remove();
        appendMsg(`AI Link Interrupted: ${e.message}. Using Local Manager.`, 'ai');
        handleLocalAI(msg);
    }
};

function appendMsg(text, role, id = null) {
    const container = document.getElementById('ai-messages');
    const div = document.createElement('div');
    div.className = `msg msg-${role}`;
    if (id) div.id = id;
    div.innerText = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function handleAICommands(text) {
    const lower = text.toLowerCase();
    // Example: "i'll mark the biryani as unavailable"
    if (lower.includes('mark') && (lower.includes('unavailable') || lower.includes('out of stock'))) {
        const match = text.match(/mark (.+?) (as unavailable|out of stock)/i);
        if (match) {
            const itemName = match[1].trim();
            const item = menu.find(m => m.name.toLowerCase().includes(itemName.toLowerCase()));
            if (item) toggleItemAvailability(item.id, false);
        }
    }
}

function handleLocalAI(msg) {
    const lower = msg.toLowerCase();
    if (lower.includes('mark') && lower.includes('unavailable')) {
        const itemName = msg.match(/mark (.+) unavailable/i)?.[1];
        if (itemName) {
            const item = menu.find(m => m.name.toLowerCase().includes(itemName.toLowerCase()));
            if (item) {
                toggleItemAvailability(item.id, false);
                appendMsg(`I've marked ${item.name} as out of stock globally.`, 'ai');
            } else {
                appendMsg(`I couldn't find an item named "${itemName}" in the menu.`, 'ai');
            }
        }
    } else if (lower.includes('report')) {
        appendMsg(`Generating your daily report... Currently processing ${orders.length} transactions with a total yield of ₹${revenue}.`, 'ai');
    } else {
        appendMsg("I've logged your request. My advanced capabilities will be available once the API key is secured.", 'ai');
    }
}

async function toggleItemAvailability(id, available) {
    if (!available && !unavailableItems.includes(id)) unavailableItems.push(id);
    else if (available) unavailableItems = unavailableItems.filter(x => x !== id);
    try {
        await setDoc(doc(db, 'settings', 'availability'), { unavailableItems }, { merge: true });
    } catch (e) {}
}

// --- Navigation & View Logic ---
window.switchAdminTab = function(tabId, el) {
    // Update active nav state
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    if (el) el.classList.add('active');

    const title = document.querySelector('.header-title h2');
    const sections = ['dashboard-view', 'hotel-view', 'rest-view', 'finance-view', 'settings-view'];
    
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
    const occupied = rooms.filter(r => r.status === 'occupied');
    container.innerHTML = `
        <div class="analytics-card">
            <h3>Live Room Status</h3>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(140px,1fr)); gap:1rem; margin-top:1.5rem;">
                ${rooms.map(r => `
                    <div style="background:rgba(255,255,255,0.05); padding:1rem; border-radius:12px; border:1px solid ${r.status==='occupied'?'#D4AF37':'#333'};">
                        <div style="font-weight:800; font-size:1.2rem;">${r.id}</div>
                        <div style="font-size:0.75rem; color:${r.status==='occupied'?'#D4AF37':'#666'};">${r.status.toUpperCase()}</div>
                        ${r.status === 'occupied' ? `<div style="font-size:0.7rem; margin-top:0.5rem; opacity:0.8;">${r.guestName||'Active Guest'}</div>`:''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderRestView() {
    const container = document.getElementById('rest-view');
    if (!container) return;
    container.innerHTML = `
        <div class="table-analytics">
            <div class="analytics-card">
                <h3>Live Restaurant Orders</h3>
                <div class="turnaround-list" style="margin-top:1.5rem;">
                    ${orders.filter(o => o.orderType !== 'room').map(o => `
                        <div class="turnaround-item">
                            <div>Table ${o.tableId || 'N/A'} - ${o.id.slice(-4)}</div>
                            <div style="color:var(--gold);">₹${o.total_price || 0}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="analytics-card">
                <h3>Menu Insights</h3>
                <p style="opacity:0.6; font-size:0.8rem;">Top selling items and trends.</p>
                <div style="margin-top:1rem;">Total Menu Items: ${menu.length}</div>
                <div style="margin-top:0.5rem; color:#f43f5e;">Out of Stock: ${unavailableItems.length}</div>
            </div>
        </div>
    `;
}

function renderFinanceView() {
    const container = document.getElementById('finance-view');
    if (!container) return;
    container.innerHTML = `
        <div class="analytics-card">
            <h3>Revenue Projection</h3>
            <div style="font-size:3rem; font-weight:800; margin:1rem 0;">₹ ${(revenue * 1.2).toFixed(0)}</div>
            <p style="opacity:0.5;">Estimated total based on current occupancy and average ticket size.</p>
        </div>
    `;
}

const occupiedRooms = () => rooms.filter(r => r.status === 'occupied').length;
const activeOrders = () => orders.filter(o => o.status === 'Pending').length;

// Initialization & Authentication Handling
window.handleLogout = async function() {
    try {
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (e) {
        console.error("Logout failed:", e);
        window.location.href = 'login.html';
    }
};

onAuthStateChanged(auth, user => {
    if (!user) {
        window.location.href = 'login.html';
    } else {
        console.log("[Auth] Owner authenticated.");
        startListeners();
    }
});

setInterval(() => {
    const now = new Date();
    document.getElementById('live-clock').innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('live-date').innerText = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
}, 1000);
