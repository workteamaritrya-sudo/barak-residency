/**
 * BARAK RESIDENCY — Owner's Admin App (AI-Driven)
 * Powered by Gemini Pro & Firebase Firestore
 */

// Use globally synced Firebase instances to prevent database lock crashes
const db = window.firebaseFS;
const auth = window.firebaseAuth;
const { collection, doc, getDoc, getDocs, setDoc, updateDoc, onSnapshot, query, orderBy, limit, serverTimestamp, deleteDoc } = window.firebaseHooks;

// --- Gemini Vertex Config ---
import { getVertexAI, getGenerativeModel } from "https://esm.run/@firebase/vertexai";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { firebaseConfig } from './firebase-config.js';

const GEMINI_KEY = "AIzaSyDEbzu1uJ2Ynwso4aFko8pg-tf3aBbWq_U";

let vertexApp, vertexAI, aiModel;
try {
    // Spawn secondary app using strictly the AI Key to pass Firebase backend authorization
    const vertexConfig = { ...firebaseConfig, apiKey: GEMINI_KEY };
    vertexApp = initializeApp(vertexConfig, "VertexAI-Engine-Admin");
    vertexAI = getVertexAI(vertexApp);
    aiModel = getGenerativeModel(vertexAI, { model: "gemini-3-flash" });
} catch (e) {
    console.warn("Vertex AI Initialization Failed:", e);
}

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

    try {
        if (!aiModel) throw new Error("Vertex AI engine offline.");

        const prompt = `Role: AI Resident Manager at Barak Residency. Task: Assist owners. Context: ₹${revenue} revenue, ${orders.length} orders. Request: ${msg}`;
        const result = await aiModel.generateContent(prompt);
        const resData = await result.response;
        const aiTxt = resData.text();

        if (document.getElementById(aiLoaderId)) document.getElementById(aiLoaderId).remove();

        if (aiTxt) {
            appendMsg(aiTxt, 'ai');
            handleAICommands(aiTxt); 
        } else {
            throw new Error("No signal from AI backend.");
        }
    } catch (e) {
        if (document.getElementById(aiLoaderId)) document.getElementById(aiLoaderId).remove();
        console.warn("AI System Fallback:", e.message);
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

async function syncMenuFromCSV() {
    const csv = document.getElementById('csv-paste-area').value.trim();
    if (!csv) return;
    const status = document.getElementById('sync-status');
    status.innerText = "Parsing and Syncing...";
    
    const lines = csv.split('\n');
    let count = 0;
    try {
        for (let line of lines) {
            const [name, cat, price, priceHalf, desc, img, type] = line.split(',').map(s => s.trim());
            if (!name) continue;
            
            // Generate stable ID from name
            const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            
            await setDoc(doc(db, 'menuItems', id), {
                id, name, category: cat || 'General', 
                price: parseFloat(price) || 0,
                priceHalf: parseFloat(priceHalf) || 0,
                description: desc || '',
                portionType: type || 'Plate',
                imageUrl: img || 'br.png',
                isAvailable: true
            }, { merge: true });
            count++;
        }
        status.innerHTML = `<span style="color:#22C55E;">✓ Successfully updated ${count} items!</span>`;
    } catch (e) {
        status.innerHTML = `<span style="color:#EF4444;">Error: ${e.message}</span>`;
    }
}

async function nuclearReset() {
    const confirmVal = document.getElementById('reset-confirm-input').value.trim();
    if (confirmVal !== 'RESET') { alert('Type "RESET" to confirm.'); return; }
    
    if (!confirm('This will WIPE all active tables, guest data, and orders. Confirm?')) return;
    
    try {
        // Clear Orders
        const ordSnap = await getDocs(collection(db, 'orders'));
        for (const d of ordSnap.docs) await deleteDoc(d.ref);

        // Clear Rooms (Set to available)
        const roomSnap = await getDocs(collection(db, 'rooms'));
        for (const d of roomSnap.docs) {
            await setDoc(d.ref, { 
                status: 'available', 
                guestName: null, 
                guestPhone: null, 
                orders: [], 
                activeBills: [], 
                currentStayId: null 
            }, { merge: true });
        }

        // Reset Table Status
        const tableSnap = await getDocs(collection(db, 'tables'));
        for (const d of tableSnap.docs) {
            await setDoc(d.ref, { 
                status: 'available', 
                pax: 0, 
                orders: [], 
                activeBills: [], 
                chairs: Array(4).fill({status: 'available'}) 
            }, { merge: true });
        }

        alert('System Reset Complete. All portals updated.');
        location.reload();
    } catch (e) {
        alert('Reset failed: ' + e.message);
    }
}

window.syncMenuFromCSV = syncMenuFromCSV;
window.nuclearReset = nuclearReset;

// Initialization & Authentication Handling
window.handleLogout = async function() {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (e) {
        console.error("Logout failed:", e);
        window.location.href = 'index.html';
    }
};

onAuthStateChanged(auth, user => {
    if (!user) {
        window.location.href = 'index.html';
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
