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
        this.roomStatus = 'available';
        this.salutation = '';
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
        
        // 2. Real-time Room Status Listener (New Requirement)
        const roomRef = doc(window.firebaseFS, 'rooms', this.roomNumber.toString());
        onSnapshot(roomRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                this.roomStatus = data.status || 'available';
                this.salutation = data.salutation || '';
                this.guestName = data.guestName || 'Guest';
                this.setupGreeting();
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
                this.salutation = guestData.salutation || "";
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
                const sessionQuery = query(ordersCol, where('guestId', '==', this.currentGuestId), where('roomNumber', '==', this.roomNumber));
                
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
        const greetEl = document.getElementById('greeting');
        if (!greetEl) return;

        if (this.roomStatus === 'available') {
            greetEl.innerHTML = `<span style="color: var(--color-red-500); font-size: 1rem; line-height: 1.4;">Welcome to Barak Residency!<br>Please complete your registration at the Reception first to enable room service.</span>`;
            document.getElementById('room-display').innerText = `Room ${this.roomNumber} (Unregistered)`;
            return;
        }

        const hour = new Date().getHours();
        let intro = "Welcome";
        if (hour >= 5 && hour < 12) intro = "Good Morning";
        else if (hour >= 12 && hour < 17) intro = "Good Afternoon";
        else if (hour >= 17 || hour < 5) intro = "Good Evening";

        const salutation = this.salutation ? this.salutation + " " : "";
        const name = this.guestName ? this.guestName.split(' ')[0] : 'Guest';
        
        greetEl.innerHTML = `${intro}, ${salutation}${name}!<br><span style="font-size: 0.9rem; opacity: 0.8;">How can we serve you today?</span>`;
        document.getElementById('room-display').innerText = `Room ${this.roomNumber} • ${salutation}${this.guestName}`;
    }

    renderMenu() {
        const grid = document.getElementById('menu-grid');
        if (!grid) return;
        grid.innerHTML = '';
        const categories = {};
        this.menu.forEach(item => {
            if (item.isAvailable === false) return;
            const cat = item.category || 'General';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(item);
        });

        Object.keys(categories).forEach(catName => {
            // Category Title
            const catHeader = document.createElement('div');
            catHeader.className = 'menu-title';
            catHeader.style.marginTop = '2rem';
            catHeader.innerText = catName;
            grid.appendChild(catHeader);

            categories[catName].forEach(item => {
                const card = document.createElement('div');
                card.className = 'food-card';
                
                const itemImg = item.imageUrl || item.photo || item.image || "";
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
                    <button class="add-btn" onclick="portal.promptPortion('${item.id}')">ADD</button>
                `;
                grid.appendChild(card);
            });
        });
    }

    promptPortion(itemId) {
        const item = this.menu.find(m => m.id === itemId);
        if (!item) return;

        // If no portion type, add directly
        if (!item.portionType || item.portionType === 'None') {
            this.executeAddToCart(item, 'Regular', 'Standard', item.price);
            return;
        }

        this.pendingItem = item;
        document.getElementById('pm-item-name').innerText = item.name;
        document.getElementById('pm-item-desc').innerText = item.description || "Select your portion size.";

        const container = document.getElementById('pm-options-container');
        container.innerHTML = '';

        let options = [];
        const type = item.portionType;

        if (type === 'Plate' || type === 'Plate (Half/Full)') {
            options = [
                { label: 'Full Plate', val: 'Full', price: item.price },
                { label: 'Half Plate', val: 'Half', price: item.basePrice_Half || Math.floor(item.price * 0.6) }
            ];
        } else if (type === 'Bottle') {
            options = [
                { label: '1L Bottle', val: '1L', price: item.price },
                { label: '750ml', val: '750ml', price: Math.floor(item.price * 0.75) },
                { label: '2L Bottle', val: '2L', price: Math.floor(item.price * 1.8) }
            ];
        } else if (type === 'Cup') {
            options = [
                { label: 'Standard Cup', val: 'Regular', price: item.price },
                { label: 'Large/Pot', val: 'Large', price: Math.floor(item.price * 1.5) }
            ];
        } else {
            options = [{ label: 'Standard', val: 'Regular', price: item.price }];
        }

        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'add-btn btn-block';
            btn.style.padding = '1.25rem';
            btn.innerHTML = `<div style="display:flex; justify-content:space-between;"><span>${opt.label}</span><span>₹${opt.price}</span></div>`;
            btn.onclick = () => {
                this.executeAddToCart(item, opt.val, opt.label, opt.price);
                document.getElementById('portion-modal').style.display = 'none';
            };
            container.appendChild(btn);
        });

        document.getElementById('portion-modal').style.display = 'flex';
    }

    executeAddToCart(item, variantVal, variantLabel, price) {
        const finalId = `${item.id}-${variantVal}`;
        const existing = this.cart.find(c => c.id === finalId);
        
        if (existing) {
            existing.qty++;
        } else {
            this.cart.push({
                ...item,
                id: finalId,
                name: variantVal !== 'Regular' ? `${item.name} [${variantLabel}]` : item.name,
                price: price,
                qty: 1,
                variant: variantLabel
            });
        }

        this.updateCartBar();
        
        // Visual feedback
        const btn = document.querySelector(`button[onclick*="${item.id}"]`);
        if (btn) {
            const originalText = btn.innerText;
            btn.innerText = "✓ ADDED";
            btn.style.background = "#22c55e";
            setTimeout(() => {
                btn.innerText = originalText;
                btn.style.background = "";
            }, 1000);
        }
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
        
        const orderObj = {
            id: orderIdStr,
            order_id: orderIdStr,
            roomNumber: this.roomNumber,
            tableId: null,
            guestId: this.currentGuestId,
            items: this.cart.map(i => ({ 
                id: i.id, 
                name: i.name, 
                qty: i.qty, 
                price: Number(i.price),
                variant: i.variant || 'Full'
            })), 
            timestamp: Date.now(),
            status: 'Pending',
            total: Number(total),
            total_price: Number(total),
            orderType: 'Room',
            guestName: this.guestName
        };

        // Mission Sync: Clear cart AFTER orderObj is created
        this.cart = [];
        this.updateCartBar();
        this.renderHistory();

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
        // Update the current_bill and itemized list on the guest record in cloud
        if (this.currentGuestId && window.firebaseFS) {
            try {
                const { doc, updateDoc, increment, arrayUnion } = window.firebaseHooks;
                const guestRef = doc(window.firebaseFS, 'guests', this.currentGuestId);
                
                // Mission: Ledger Detail Injection
                const detailedItems = order.items.map(i => ({
                    name: i.name,
                    qty: i.qty,
                    price: Number(i.price),
                    total: Number(i.price) * i.qty,
                    variant: i.variant || 'Full',
                    timestamp: Date.now()
                }));

                await updateDoc(guestRef, {
                    foodTotal: increment(order.total),
                    current_bill: increment(order.total),
                    billItems: arrayUnion(...detailedItems)
                });
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
        this.switchView('menu');
    }

    showTracker() {
        const success = document.getElementById('success-screen');
        if (success) success.style.display = 'none';
        document.getElementById('tracker')?.classList.add('active');
    }

    switchView(view) {
        const views = ['dashboard', 'menu', 'service'];
        views.forEach(v => {
            const el = document.getElementById(`view-${v}`);
            if (el) el.style.display = 'none';
        });
        const target = document.getElementById(`view-${view}`);
        if (target) target.style.display = 'block';

        // The cart bar only shows in menu view
        const cartBar = document.getElementById('cart-bar');
        if (cartBar) cartBar.style.display = (view === 'menu') ? '' : 'none';
    }

    async sendQuickRequest(type) {
        if (!this.roomNumber) return;

        const btn = event && event.target;
        if (btn) { btn.innerText = '⏳ Sending...'; btn.disabled = true; }

        try {
            const db = window.firebaseFS;
            const { collection, addDoc, serverTimestamp } = window.firebaseHooks;
            await addDoc(collection(db, 'serviceRequests'), {
                roomNumber: this.roomNumber,
                type: type,
                message: '',
                status: 'pending',
                timestamp: Date.now(),
                serverTimestamp: serverTimestamp()
            });

            if (btn) { btn.innerText = `✓ ${type} Sent!`; btn.style.color = '#4ade80'; }
            setTimeout(() => {
                if (btn) {
                    const icons = { Blanket: '🛏️', Bedsheet: '🧴', Water: '💧', Cleaning: '🧹' };
                    btn.innerText = `${icons[type] || '🔔'} ${type}`; 
                    btn.disabled = false; 
                    btn.style.color = ''; 
                }
            }, 3000);
        } catch (e) {
            console.error("Service request failed", e);
            if (btn) { btn.innerText = '❌ Failed'; btn.disabled = false; }
        }
    }

    async sendCustomRequest() {
        const msg = document.getElementById('service-message')?.value?.trim();
        if (!msg) {
            alert('Please enter a message');
            return;
        }

        try {
            const db = window.firebaseFS;
            const { collection, addDoc, serverTimestamp } = window.firebaseHooks;
            await addDoc(collection(db, 'serviceRequests'), {
                roomNumber: this.roomNumber,
                type: 'Custom Request',
                message: msg,
                status: 'pending',
                timestamp: Date.now(),
                serverTimestamp: serverTimestamp()
            });

            document.getElementById('service-message').value = '';
            alert('✓ Request sent! Our staff will attend to you shortly.');
        } catch (e) {
            console.error("Custom request failed", e);
            alert('Failed to send request. Please try again.');
        }
    }
}

const portal = new GuestPortal();
window.portal = portal;

window.placeGuestOrder = function() { portal.placeOrder(); };
window.activateReorder = function() { portal.activateReorder(); };
window.showTracker = function() { portal.showTracker(); };
