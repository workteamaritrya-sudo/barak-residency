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
const GEMINI_API_KEY = "REPLACEME_GEMINI_KEY"; // User will provide this
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
    const rev = orders.reduce((s, o) => s + (o.total_price || 0), 0);
    document.getElementById('stat-revenue').innerText = `₹ ${rev.toLocaleString()}`;

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

    // Logic: If Gemini Key is present, call Gemini. 
    // If not, use simple local rule-based responses for fundamental commands.
    if (GEMINI_API_KEY === 'REPLACEME_GEMINI_KEY') {
        appendMsg("I'm ready to assist, but my advanced neural core needs the Gemini API key. For now, I'll use local processing.", 'ai');
        handleLocalAI(msg);
        return;
    }

    try {
        const response = await fetch(GEMINI_URL, {
            method: 'POST',
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Context: You are the AI Manager for Barak Residency. 
                        Current System State: ${occupiedRooms()} occupied rooms, ${activeOrders()} active orders, total revenue ₹${revenue}.
                        Goal: Help the owner manage the app. 
                        Owner's Request: ${msg}`
                    }]
                }]
            })
        });
        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;
        appendMsg(text, 'ai');
        handleAICommands(text); // Check if AI suggested an action
    } catch (e) {
        appendMsg("I encountered an error connecting to my neural center. Local processing is active.", 'ai');
        handleLocalAI(msg);
    }
};

function appendMsg(text, role) {
    const container = document.getElementById('ai-messages');
    const div = document.createElement('div');
    div.className = `msg msg-${role}`;
    div.innerText = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
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
