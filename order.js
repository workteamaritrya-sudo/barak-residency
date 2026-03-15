/**
 * Isolated Guest Portal Logic
 * Luxury QR Tracking & Ordering System
 * Strict Architectural Update: Room Isolation & Sequential Billing
 */

class GuestPortal {
    constructor() {
        this.roomNumber = null;
        this.guestName = "Guest";
        this.cart = [];
        this.sessionHistory = []; // Full history of items in this session
        this.activeOrderId = null;
        this.menu = [];
        this.db = null;
        this.sessionToken = null;

        this.init();
    }

    async init() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            this.roomNumber = urlParams.get('room') || urlParams.get('view');

            if (!this.roomNumber) {
                this.showError("Access Denied", "Invalid QR Code. Please scan the QR in your room.");
                return;
            }

            // --- INSTANT UI FEEDBACK & LOADING DISMISSAL ---
            document.getElementById('room-display').innerText = `Room ${this.roomNumber}`;
            this.setupGreeting(); // Changes "Loading..." to "Welcome, Guest!"

            // --- SESSION & PRIVACY CHECK ---
            const storedSession = JSON.parse(localStorage.getItem('br_guest_session') || '{}');
            if (storedSession.room && storedSession.room !== this.roomNumber) {
                localStorage.removeItem('br_guest_session');
                localStorage.removeItem(`br_active_order_${storedSession.room}`);
            }

            if (!storedSession.token) {
                this.sessionToken = 'G-' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('br_guest_session', JSON.stringify({ room: this.roomNumber, token: this.sessionToken }));
            } else {
                this.sessionToken = storedSession.token;
            }

            this.activeOrderId = localStorage.getItem(`br_active_order_${this.roomNumber}`);
            this.sessionHistory = JSON.parse(localStorage.getItem(`br_history_${this.roomNumber}`) || '[]');

            // Load menu from cache immediately for speed
            this.renderMenu();

            // Background Loading (Async)
            this.initDB().then(() => {
                this.fetchGuestData();
                this.setupTracking();
                this.startSyncListener();
            }).catch(dbErr => {
                console.warn("Offline/DB Restricted. Using cache only.", dbErr);
            });
            
        } catch (err) {
            console.error("[Guest Portal] Critical Crash:", err);
            document.getElementById('greeting').innerText = "Welcome!";
            document.getElementById('room-display').innerText = `Room ${this.roomNumber || '--'}`;
        }
    }

    showError(title, msg) {
        document.body.innerHTML = `
            <div style='padding: 3rem; text-align:center; height: 100vh; display: flex; flex-direction: column; justify-content: center; background: #0F172A; color: white;'>
                <h1 style='color: #D4AF37; margin-bottom: 1rem;'>${title}</h1>
                <p style='color: #94A3B8;'>${msg}</p>
            </div>`;
    }

    initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('br-pro-db', 5);
            request.onerror = (e) => reject("DB Failed: " + e.target.error);
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('rooms')) {
                    db.createObjectStore('rooms', { keyPath: 'number' });
                }
                if (!db.objectStoreNames.contains('kitchenOrders')) {
                    db.createObjectStore('kitchenOrders', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('salesHistory')) {
                    db.createObjectStore('salesHistory', { autoIncrement: true });
                }
            };
        });
    }

    async fetchGuestData() {
        if (!window.firebaseFS || !window.firebaseHooks) {
            console.warn("Firebase FS/Hooks not available yet, retrying...");
            setTimeout(() => this.fetchGuestData(), 1000);
            return;
        }
        
        const { collection, onSnapshot, doc, query, where, or } = window.firebaseHooks;

        // 1. Real-time Menu Listener (onSnapshot) - Mission 4
        const menuCol = collection(window.firebaseFS, 'menuItems');
        onSnapshot(menuCol, (snapshot) => {
            const newMenu = [];
            snapshot.forEach(docSnap => {
                const item = docSnap.data();
                if (item.id) newMenu.push(item);
            });
            if (newMenu.length > 0) {
                this.menu = newMenu;
                this.renderMenu();
                localStorage.setItem('br_menu', JSON.stringify(newMenu));
                console.log("[Guest Portal] Menu updated from 'menuItems'");
            }
        });

        // 3. Targeted Active Guest Listener (Mission Fix)
        const guestsCol = collection(window.firebaseFS, 'guests');
        const activeGuestQuery = query(
            guestsCol, 
            or(
                where('roomNumber', '==', this.roomNumber),
                where('roomNumber', '==', Number(this.roomNumber) || this.roomNumber)
            ),
            where('status', '==', 'active')
        );

        let activeOrderListener = null;

        onSnapshot(activeGuestQuery, (snapshot) => {
            if (!snapshot.empty) {
                const guestDoc = snapshot.docs[0];
                const guestData = guestDoc.data();
                
                this.guestName = guestData.guestName || guestData.fullName || guestData.name || "Guest";
                this.currentGuestId = guestDoc.id;
                
                document.getElementById('room-display').innerText = `Room ${this.roomNumber} • ${this.guestName}`;
                this.setupGreeting();

                // Fallback: If we were showing an error, force refresh to clear it
                if (document.body.innerHTML.includes("Session Expired")) {
                    console.log("[Guest Portal] Active guest found but showing expired. Refreshing...");
                    window.location.reload();
                    return;
                }

                // 4. Mission: Re-bind Order History listener to new Guest ID
                if (activeOrderListener) activeOrderListener(); // Unsubscribe old
                
                const ordersCol = collection(window.firebaseFS, 'orders');
                const sessionQuery = query(ordersCol, where('guestId', '==', this.currentGuestId), where('roomId', '==', this.roomNumber));
                
                activeOrderListener = onSnapshot(sessionQuery, (orderSnap) => {
                    const cloudHistory = [];
                    orderSnap.forEach(d => {
                        const order = d.data();
                        cloudHistory.push(order);
                        if (order.id === this.activeOrderId) {
                            this.updateTrackingUI(order.status);
                        }
                    });
                    this.sessionHistory = cloudHistory;
                    this.renderHistory();
                });

            } else {
                // No active guest found for this room
                this.guestName = "Guest";
                this.currentGuestId = null;
                document.getElementById('room-display').innerText = `Room ${this.roomNumber}`;
                this.setupGreeting();
            }
        });
    }

    setupGreeting() {
        const hour = new Date().getHours();
        let greeting = "Welcome";
        if (hour >= 5 && hour < 12) greeting = "Good Morning";
        else if (hour >= 12 && hour < 17) greeting = "Good Afternoon";
        else if (hour >= 17 || hour < 5) greeting = "Good Evening";

        const name = this.guestName ? this.guestName.split(' ')[0] : 'Guest';
        const greetEl = document.getElementById('greeting');
        if (greetEl) greetEl.innerText = `${greeting}, ${name}!`;
    }

    renderMenu() {
        const grid = document.getElementById('menu-grid');
        if (!grid) return;
        grid.innerHTML = '';
        this.menu.forEach(item => {
            if (item.isAvailable === false) return;

            const card = document.createElement('div');
            card.className = 'food-card';
            
            const itemImg = item.photo || item.image || "";
            const imageHtml = itemImg.trim() !== '' 
                ? `<img src="${itemImg}" class="food-icon" alt="${item.name}" onerror="this.src='placeholder_food.png'">` 
                : `<div class="food-icon">${item.icon || '🍽️'}</div>`;
                
            const price = item.price || "--";
            const desc = item.description || "No description available.";
            const descHtml = `<div class="food-desc">${desc}</div>`;
                
            card.innerHTML = `
                ${imageHtml}
                <div class="food-info">
                    <div class="food-name">${item.name || "Unknown Item"}</div>
                    ${descHtml}
                    <div class="food-price">₹${price}</div>
                </div>
                <button class="add-btn" onclick="portal.addToCart('${item.id}')">ADD</button>
            `;
            grid.appendChild(card);
        });
    }

    addToCart(itemId) {
        const item = this.menu.find(m => m.id === itemId);
        if (!item) return;
        const existing = this.cart.find(c => c.id === itemId);
        if (existing) existing.qty++;
        else this.cart.push({ ...item, qty: 1 });

        this.updateCartBar();
    }

    updateCartBar() {
        const bar = document.getElementById('cart-bar');
        const info = document.getElementById('cart-info');
        if (!bar || !info) return;

        if (this.cart.length > 0) {
            const count = this.cart.reduce((s, i) => s + i.qty, 0);
            const total = this.cart.reduce((s, i) => s + (i.price * i.qty), 0);
            info.innerText = `${count} Items | ₹${total}`;
            bar.classList.add('active');
        } else {
            bar.classList.remove('active');
        }
    }

    async placeOrder() {
        if (this.cart.length === 0) return;

        let orderIdStr = this.activeOrderId;
        let isUpdatingExisting = !!orderIdStr;

        // Mission 2: Smart Sequential ID Logic
        if (!isUpdatingExisting) {
            if (window.FirebaseSync) {
                orderIdStr = await window.FirebaseSync.getNextOrderSerial(this.roomNumber, this.currentGuestId);
            } else {
                orderIdStr = this.roomNumber + Date.now().toString(36);
            }
            this.activeOrderId = orderIdStr;
            localStorage.setItem(`br_active_order_${this.roomNumber}`, this.activeOrderId);
        }

        const total = this.cart.reduce((s, i) => s + (i.price * i.qty), 0);
        
        // Mission Sync: Clear cart immediately and let cloud handle history
        this.cart = [];
        this.updateCartBar();
        this.renderHistory();

        const orderObj = {
            id: orderIdStr,
            order_id: orderIdStr,
            roomId: this.roomNumber,
            tableId: null,
            guestId: this.currentGuestId,
            items: this.cart.map(i => ({ 
                id: i.id, 
                name: i.name, 
                qty: i.qty, 
                price: i.price,
                variant: i.variant || 'Full'
            })), 
            timestamp: Date.now(),
            status: 'Pending',
            total: total,
            total_price: total,
            orderType: 'Room',
            guestName: this.guestName
        };

        // Mission 3: Write directly to Cloud
        if (window.FirebaseSync) {
            await window.FirebaseSync.pushOrderToCloud(orderObj);
        }
        
        await this.updateRoomLedger(orderObj);

        // Reset UI triggers
        const successScreen = document.getElementById('success-screen');
        if (successScreen) successScreen.style.display = 'flex';
        this.updateTrackingUI('pending');
    }

    renderHistory() {
        const list = document.getElementById('session-items-list');
        if (!list) return;
        
        list.innerHTML = '';
        if (this.sessionHistory.length === 0) {
            list.innerHTML = '<div style="opacity:0.5;">No items in this session yet.</div>';
            return;
        }

        const summary = {};
        this.sessionHistory.forEach(order => {
            order.items.forEach(item => {
                const key = item.name + (item.variant !== 'Full' ? ` (${item.variant})` : '');
                summary[key] = (summary[key] || 0) + item.qty;
            });
        });

        Object.entries(summary).forEach(([name, qty]) => {
            const div = document.createElement('div');
            div.style.cssText = 'display:flex; justify-content:space-between; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.05);';
            div.innerHTML = `<span>${name}</span><span style="color:var(--gold-primary); font-weight:bold;">x${qty}</span>`;
            list.appendChild(div);
        });
        
        const totalAmount = this.sessionHistory.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0);
        const totalDiv = document.createElement('div');
        totalDiv.style.cssText = 'margin-top: 1rem; text-align: right; color: var(--gold-primary); font-weight: bold; font-size: 1.1rem;';
        totalDiv.innerHTML = `Total Bill: ₹${totalAmount}`;
        list.appendChild(totalDiv);
    }

    saveOrderToDB(order) {
        if (!this.db) return Promise.resolve();
        return new Promise((resolve) => {
            const tx = this.db.transaction(['kitchenOrders'], 'readwrite');
            const store = tx.objectStore('kitchenOrders');
            store.put(order);
            tx.oncomplete = () => resolve();
        });
    }

    async updateRoomLedger(order) {
        // Update the current_bill on the guest record in cloud
        if (this.currentGuestId && window.firebaseFS) {
            try {
                const { doc, getDoc, updateDoc } = window.firebaseHooks;
                const guestRef = doc(window.firebaseFS, 'guests', this.currentGuestId);
                const guestSnap = await getDoc(guestRef);
                if (guestSnap.exists()) {
                    const currentFoodTotal = Number(guestSnap.data().foodTotal || 0);
                    await updateDoc(guestRef, {
                        foodTotal: currentFoodTotal + order.total
                    });
                }
            } catch(e) { console.warn("Failed to update guest bill in cloud", e); }
        }

        // Mirror to room record if needed
        if (window.FirebaseSync) {
            await window.FirebaseSync.pushLedgerEntry({
                roomId: order.roomId,
                orderId: order.id,
                amount: order.total,
                type: 'order',
                guestName: this.guestName
            });
        }
    }

    setupTracking() {
        if (this.activeOrderId) {
            this.pollOrderStatus();
        }
    }

    async pollOrderStatus() {
        if (!this.activeOrderId) return;
        if (!this.db) return;

        const tx = this.db.transaction(['kitchenOrders'], 'readonly');
        const store = tx.objectStore('kitchenOrders');
        const req = store.get(this.activeOrderId);
        req.onsuccess = () => {
            const order = req.result;
            if (order) {
                this.updateTrackingUI(order.status);
            }
        };
        setTimeout(() => this.pollOrderStatus(), 5000);
    }

    updateTrackingUI(status) {
        const tracker = document.getElementById('tracker');
        if (!tracker) return;
        
        const progressBar = document.getElementById('timeline-progress');
        const statusLabel = document.getElementById('status-label');
        
        tracker.classList.add('active');
        const idDisplay = document.getElementById('order-id-display');
        if (idDisplay) idDisplay.innerText = `ID: #${this.activeOrderId}`;

        for(let i=1; i<=4; i++) {
            const step = document.getElementById(`step-${i}`);
            if (step) step.classList.remove('active', 'done');
        }

        if (status === 'preparing' || status === 'Kitchen') {
            if (progressBar) progressBar.style.height = '33%';
            document.getElementById('step-1')?.classList.add('done');
            document.getElementById('step-2')?.classList.add('active');
            if (statusLabel) statusLabel.innerText = "Food is Being Prepared";
        } else if (status === 'ready' || status === 'Served') {
            if (progressBar) progressBar.style.height = '66%';
            document.getElementById('step-1')?.classList.add('done');
            document.getElementById('step-2')?.classList.add('done');
            document.getElementById('step-3')?.classList.add('active');
            if (statusLabel) statusLabel.innerText = "Food is on the Way";
        } else if (status === 'delivered' || status === 'Delivered') {
            if (progressBar) progressBar.style.height = '100%';
            document.getElementById('step-1')?.classList.add('done');
            document.getElementById('step-2')?.classList.add('done');
            document.getElementById('step-3')?.classList.add('done');
            document.getElementById('step-4')?.classList.add('active');
            if (statusLabel) statusLabel.innerText = "Order Delivered. Enjoy!";
            
            // Mission 2: Allow New Order after delivery
            this.activeOrderId = null;
            localStorage.removeItem(`br_active_order_${this.roomNumber}`);
        } else {
            if (progressBar) progressBar.style.height = '0%';
            document.getElementById('step-1')?.classList.add('active');
            if (statusLabel) statusLabel.innerText = "Order Placed";
        }

        this.renderHistory();
    }

    startSyncListener() {
        window.addEventListener('storage', (e) => {
            if (e.key === 'kds_sync' || e.key === 'yukt_pms_sync') {
                this.pollOrderStatus();
            }
        });
    }

    activateReorder() {
        document.getElementById('tracker')?.classList.remove('active');
    }

    showTracker() {
        const success = document.getElementById('success-screen');
        if (success) success.style.display = 'none';
        document.getElementById('tracker')?.classList.add('active');
    }
}

const portal = new GuestPortal();
window.portal = portal;

window.placeGuestOrder = function() { portal.placeOrder(); };
window.activateReorder = function() { portal.activateReorder(); };
window.showTracker = function() { portal.showTracker(); };
