class GuestPortal {
    constructor() {
        this.roomNumber = null;
        this.guestName = "Guest";
        this.cart = [];
        this.sessionHistory = []; 
        this.activeOrderId = null;
        this.menu = [];
        this.roomStatus = 'available';
        this.salutation = '';
        this.currentView = 'dashboard';
        
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

            document.getElementById('room-display').innerText = `Room ${this.roomNumber}`;
            
            this.activeOrderId = localStorage.getItem(`br_active_order_${this.roomNumber}`);
            
            // Load from cache first
            const cachedMenu = localStorage.getItem('br_menu');
            if (cachedMenu) {
                this.menu = JSON.parse(cachedMenu);
                this.renderMenu();
            }

            this.initDB().then(() => {
                this.fetchGuestData();
                this.setupTracking();
            });

            this.updateActivePreview();
            
            // Listen for availability changes
            window.addEventListener('storage', (e) => {
                if (e.key === 'br_unavailable_items') {
                    this.renderMenu();
                }
            });
        } catch (err) {
            console.error("[Guest Portal] Init Crash:", err);
        }
    }

    showError(title, msg) {
        document.body.innerHTML = `
            <div style='padding: 3rem; text-align:center; height: 100vh; display: flex; flex-direction: column; justify-content: center; background: #050B1A; color: white;'>
                <h1 style='color: #D4AF37; margin-bottom: 1rem; font-family: Outfit;'>${title}</h1>
                <p style='color: #94A3B8;'>${msg}</p>
            </div>`;
    }

    initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('br-pro-db', 5);
            request.onsuccess = (e) => { this.db = e.target.result; resolve(); };
            request.onerror = (e) => reject(e);
        });
    }

    async fetchGuestData() {
        if (!window.firebaseFS) {
            setTimeout(() => this.fetchGuestData(), 1000);
            return;
        }
        
        const { collection, onSnapshot, doc, query, where, or } = window.firebaseHooks;

        // 1. Menu Listener
        onSnapshot(collection(window.firebaseFS, 'menuItems'), (snap) => {
            const items = [];
            snap.forEach(d => items.push(d.data()));
            if (items.length > 0) {
                this.menu = items;
                localStorage.setItem('br_menu', JSON.stringify(items));
                this.renderMenu();
            }
        });

        // 2. Room & Guest Listener
        onSnapshot(doc(window.firebaseFS, 'rooms', this.roomNumber.toString()), (d) => {
            if (d.exists()) {
                const data = d.data();
                this.roomStatus = data.status || 'available';
                this.guestName = data.guestName || 'Guest';
                this.salutation = data.salutation || '';
                this.updateBranding();
            }
        });

        // 3. Active Order Tracking
        if (this.activeOrderId) {
            const q = query(collection(window.firebaseFS, 'orders'), where('order_id', '==', this.activeOrderId));
            onSnapshot(q, (snap) => {
                if (!snap.empty) {
                    const order = snap.docs[0].data();
                    this.updateTrackingUI(order.status);
                    this.updateActivePreview(true);
                }
            });
        }
    }

    updateBranding() {
        const greetEl = document.getElementById('greeting');
        if (!greetEl) return;

        if (this.roomStatus === 'available') {
            greetEl.innerHTML = `Welcome House!`;
            return;
        }

        const hour = new Date().getHours();
        let intro = "Good Evening";
        if (hour < 12) intro = "Good Morning";
        else if (hour < 17) intro = "Good Afternoon";

        greetEl.innerText = `${intro}, ${this.salutation} ${this.guestName.split(' ')[0]}`;
    }

    renderMenu() {
        const grid = document.getElementById('menu-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const unavailableList = JSON.parse(localStorage.getItem('br_unavailable_items') || '[]');

        const categories = {};
        this.menu.forEach(item => {
            if (item.isAvailable === false || unavailableList.includes(item.id)) return;
            const cat = item.category || 'Dishes';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(item);
        });

        Object.entries(categories).forEach(([name, items]) => {
            const title = document.createElement('div');
            title.className = 'menu-title';
            title.innerText = name;
            grid.appendChild(title);

            items.forEach(item => {
                const card = document.createElement('div');
                card.className = 'food-card';
                const img = item.imageUrl || item.ImageURL || 'br.png';
                const name = item.name || item.Name || 'Dish';
                const price = item.price || item.PriceFull || 0;
                const desc = item.description || item.Description || 'Barak Residency Special';
                
                card.innerHTML = `
                    <img src="${img}" class="food-icon" onerror="this.src='br.png'">
                    <div class="food-info">
                        <div class="food-name">${name}</div>
                        <div class="food-desc">${desc}</div>
                        <div class="food-price">₹${price}</div>
                    </div>
                    <button class="add-btn" onclick="portal.promptPortion('${item.id}')">ADD</button>
                `;
                grid.appendChild(card);
            });
        });
    }

    filterMenu() {
        const query = document.getElementById('menu-search')?.value?.toLowerCase();
        if (!query) {
            this.renderMenu();
            return;
        }

        const filtered = this.menu.filter(item => 
            item.name.toLowerCase().includes(query) || 
            (item.description && item.description.toLowerCase().includes(query)) ||
            (item.category && item.category.toLowerCase().includes(query))
        );

        this.renderFilteredMenu(filtered);
    }

    renderFilteredMenu(items) {
        const grid = document.getElementById('menu-grid');
        if (!grid) return;
        grid.innerHTML = '';
        
        if (items.length === 0) {
            grid.innerHTML = '<div style="text-align:center; padding: 2rem; opacity:0.5;">No items found matching your search.</div>';
            return;
        }

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'food-card';
            const img = item.imageUrl || item.ImageURL || 'br.png';
            const name = item.name || item.Name || 'Dish';
            const price = item.price || item.PriceFull || 0;
            const desc = item.description || item.Description || 'Special';

            card.innerHTML = `
                <img src="${img}" class="food-icon" onerror="this.src='br.png'">
                <div class="food-info">
                    <div class="food-name">${name}</div>
                    <div class="food-desc">${desc}</div>
                    <div class="food-price">₹${price}</div>
                </div>
                <button class="add-btn" onclick="portal.promptPortion('${item.id}')">ADD</button>
            `;
            grid.appendChild(card);
        });
    }

    promptPortion(itemId) {
        const item = this.menu.find(m => m.id === itemId);
        if (!item) return;

        this.pendingItem = item;
        
        // If no special portion types, go straight to quantity
        if (!item.portionType || item.portionType === 'None') {
            this.promptQuantity(item, 'Regular', 'Standard', item.price);
            return;
        }

        document.getElementById('pm-item-name').innerText = item.name;
        document.getElementById('pm-item-desc').innerText = "Select preferred size";
        const container = document.getElementById('pm-options-container');
        container.innerHTML = '';

        if (item.portionType === 'Plate') {
            const opts = [
                { label: 'Full Plate', val: 'Full', price: item.price },
                { label: 'Half Plate', val: 'Half', price: item.basePrice_Half || Math.floor(item.price * 0.6) }
            ];
            opts.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'reorder-btn tint-blur';
                btn.style.marginBottom = '0.5rem';
                btn.innerHTML = `<div style="display:flex; justify-content:space-between"><span>${opt.label}</span><span>₹${opt.price}</span></div>`;
                btn.onclick = () => this.promptQuantity(item, opt.val, opt.label, opt.price);
                container.appendChild(btn);
            });
        } else if (item.portionType === 'Bottle') {
            const sizes = [
                { label: '1L Bottle', val: '1L', price: item.price },
                { label: '750ml', val: '750ml', price: Math.floor(item.price * 0.8) },
                { label: '500ml', val: '500ml', price: Math.floor(item.price * 0.6) }
            ];
            sizes.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'reorder-btn tint-blur';
                btn.style.marginBottom = '0.5rem';
                btn.innerHTML = `<div style="display:flex; justify-content:space-between"><span>${opt.label}</span><span>₹${opt.price}</span></div>`;
                btn.onclick = () => this.promptQuantity(item, opt.val, opt.label, opt.price);
                container.appendChild(btn);
            });
        } else {
            this.promptQuantity(item, 'Regular', 'Standard', item.price);
            return;
        }

        document.getElementById('portion-modal').style.display = 'flex';
    }

    promptQuantity(item, variant, label, price) {
        const container = document.getElementById('pm-options-container');
        document.getElementById('pm-item-name').innerText = `${item.name} (${label})`;
        document.getElementById('pm-item-desc').innerText = "How many portions?";
        container.innerHTML = '';

        let qty = 1;

        const counter = document.createElement('div');
        counter.style.cssText = 'display:flex; align-items:center; justify-content:center; gap:30px; margin: 2rem 0;';
        counter.innerHTML = `
            <button class="add-btn" style="width:50px; height:50px; font-size:1.5rem" id="q-dec">-</button>
            <div style="font-size:2.5rem; font-weight:900" id="q-val">1</div>
            <button class="add-btn" style="width:50px; height:50px; font-size:1.5rem" id="q-inc">+</button>
        `;
        container.appendChild(counter);

        const addBtn = document.createElement('button');
        addBtn.className = 'reorder-btn';
        addBtn.style.background = 'var(--gold-primary)';
        addBtn.style.color = '#000';
        addBtn.innerText = `CONFIRM - ₹${price}`;
        container.appendChild(addBtn);

        counter.querySelector('#q-dec').onclick = () => { qty = Math.max(1, qty-1); counter.querySelector('#q-val').innerText = qty; addBtn.innerText = `CONFIRM - ₹${price * qty}`; };
        counter.querySelector('#q-inc').onclick = () => { qty++; counter.querySelector('#q-val').innerText = qty; addBtn.innerText = `CONFIRM - ₹${price * qty}`; };

        addBtn.onclick = () => {
            this.executeAddToCart(item, variant, label, price, qty);
            document.getElementById('portion-modal').style.display = 'none';
        };

        document.getElementById('portion-modal').style.display = 'flex';
    }

    executeAddToCart(item, variant, label, price, qty) {
        const id = `${item.id}-${variant}`;
        const existing = this.cart.find(c => c.id === id);
        if (existing) {
            existing.qty += qty;
        } else {
            const name = item.name || item.Name || 'Dish';
            this.cart.push({
                ...item,
                id: id,
                name: variant !== 'Regular' ? `${name} (${label})` : name,
                variant: label,
                price: price,
                qty: qty
            });
        }
        this.updateCartBar();
        this.hapticFeedback();
    }

    updateCartBar() {
        const bar = document.getElementById('cart-bar');
        const info = document.getElementById('cart-info');
        if (!bar) return;

        if (this.cart.length > 0) {
            const total = this.cart.reduce((s, i) => s + (i.price * i.qty), 0);
            info.innerText = `${this.cart.length} Items | ₹${total}`;
            bar.style.display = 'flex';
            bar.classList.add('active');
        } else {
            bar.style.display = 'none';
        }
    }

    async placeOrder() {
        if (this.cart.length === 0) return;

        const orderId = this.activeOrderId || await window.FirebaseSync.getNextOrderSerial(this.roomNumber);
        this.activeOrderId = orderId;
        localStorage.setItem(`br_active_order_${this.roomNumber}`, orderId);

        const total = this.cart.reduce((s, i) => s + (i.price * i.qty), 0);
        const orderObj = {
            order_id: orderId,
            roomNumber: this.roomNumber,
            items: this.cart,
            total_price: total,
            status: 'Pending',
            timestamp: Date.now(),
            orderType: 'Room'
        };

        if (window.FirebaseSync) {
            await window.FirebaseSync.pushOrderToCloud(orderObj);
        }

        this.cart = [];
        this.updateCartBar();
        
        // Show success screen
        const success = document.getElementById('success-screen');
        if (success) success.style.display = 'flex';
        
        // Auto-redirect to Home (Dashboard) after 2 seconds
        setTimeout(() => {
            if (success) success.style.display = 'none';
            this.switchView('dashboard');
        }, 2500);

        this.updateActivePreview(true);
        this.fetchGuestData(); // Refresh tracking
    }

    updateTrackingUI(status) {
        const tracker = document.getElementById('tracker');
        if (!tracker) return;

        const label = document.getElementById('status-label');
        const progress = document.getElementById('timeline-progress');
        
        const steps = {
            'Pending': { p: '0% ghost', n: 1, text: 'Order Placed' },
            'Kitchen': { p: '33%', n: 2, text: 'Being Prepared' },
            'preparing': { p: '33%', n: 2, text: 'Being Prepared' },
            'Served': { p: '66%', n: 3, text: 'On the Way' },
            'ready': { p: '66%', n: 3, text: 'On the Way' },
            'delivered': { p: '100%', n: 4, text: 'Delivered' },
            'Delivered': { p: '100%', n: 4, text: 'Delivered' }
        };

        const current = steps[status] || steps['Pending'];
        if (label) label.innerText = current.text;
        if (progress) progress.style.height = current.p;

        for (let i = 1; i <= 4; i++) {
            const s = document.getElementById(`step-${i}`);
            if (s) {
                s.classList.remove('active', 'done');
                if (i < current.n) s.classList.add('done');
                if (i === current.n) s.classList.add('active');
            }
        }

        if (status.toLowerCase() === 'delivered') {
            localStorage.removeItem(`br_active_order_${this.roomNumber}`);
            this.activeOrderId = null;
            setTimeout(() => this.updateActivePreview(false), 5000);
        }
    }

    updateActivePreview(show = false) {
        const preview = document.getElementById('active-order-preview');
        const orderBtn = document.getElementById('f-card-order');
        if (!preview) return;

        if (this.activeOrderId || show) {
            preview.style.display = 'flex';
            if (orderBtn) orderBtn.style.display = 'none'; // Hide "Order Food" card on home
        } else {
            preview.style.display = 'none';
            if (orderBtn) orderBtn.style.display = 'flex'; // Show "Order Food" card on home
        }
    }

    switchView(view) {
        const views = ['dashboard', 'menu', 'service'];
        views.forEach(v => {
            const el = document.getElementById(`view-${v}`);
            if (el) el.style.display = 'none';
            const nav = document.getElementById(`nav-${v}`);
            if (nav) nav.classList.remove('active');
        });

        const target = document.getElementById(`view-${view}`);
        if (target) target.style.display = 'block';
        const navTarget = document.getElementById(`nav-${view}`);
        if (navTarget) navTarget.classList.add('active');

        this.currentView = view;
        this.updateCartBar();
    }

    showTracker() {
        const tracker = document.getElementById('tracker');
        if (tracker) {
            tracker.style.display = 'flex';
            const roomNums = tracker.querySelectorAll('.room-num');
            roomNums.forEach(el => el.innerText = this.roomNumber);
        }
    }

    switchSubTab(tab) {
        if (tab === 'wifi') {
            document.getElementById('view-wifi').style.display = 'flex';
        } else if (tab === 'laundry') {
            document.getElementById('view-laundry').style.display = 'flex';
        }
    }

    async sendQuickRequest(type) {
        if (!window.firebaseFS) return;
        const { collection, addDoc, serverTimestamp } = window.firebaseHooks;
        try {
            await addDoc(collection(window.firebaseFS, 'serviceRequests'), {
                roomNumber: this.roomNumber,
                type: type,
                status: 'pending',
                timestamp: Date.now(),
                serverTimestamp: serverTimestamp()
            });
            
            // Show Luxury Confirmation
            const modal = document.getElementById('service-confirm-modal');
            const marketingText = document.getElementById('service-marketing-txt');
            if (modal) {
                if (marketingText) {
                    marketingText.innerText = `Your request for ${type} has been received. Our team at Barak Residency is dedicated to providing you with world-class hospitality. Please relax while we handle the rest.`;
                }
                modal.style.display = 'flex';
            }
        } catch (e) {
            console.error("Service request failed", e);
            alert("Connection error. Please try again.");
        }
    }

    async sendCustomRequest() {
        const msg = document.getElementById('service-message').value;
        if (!msg) return;
        
        await this.sendQuickRequest(`Message: ${msg}`);
        document.getElementById('service-message').value = '';
    }

    hapticFeedback() {
        if (navigator.vibrate) navigator.vibrate(10);
    }

    setupTracking() {
        // Polling as ultimate fallback
        setInterval(() => {
            if (this.activeOrderId) this.fetchGuestData();
        }, 10000);
    }
}

const portal = new GuestPortal();
window.portal = portal;
window.placeGuestOrder = () => portal.placeOrder();
window.showTracker = () => portal.showTracker();
window.activateReorder = () => {
    document.getElementById('tracker').style.display = 'none';
    portal.switchView('menu');
};
