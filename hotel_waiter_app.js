/**
 * ══════════════════════════════════════════════════════════════════════════════
 * BARAK RESIDENCY — Hotel Waiter App
 * Standalone · Firebase Firestore · Order for Hotel Rooms
 * ══════════════════════════════════════════════════════════════════════════════
 */

// ── Global References (Late-bound) ───────────────────────────
let db, auth, hooks;

function refreshFirebaseRefs() {
    db = window.firebaseFS;
    auth = window.firebaseAuth;
    hooks = window.firebaseHooks;
}

async function pushNotification(type, message, target, data = null) {
    const { collection, addDoc } = hooks;
    try {
        const nRef = collection(db, 'notifications');
        await addDoc(nRef, {
            id: Date.now().toString(),
            type, message, target,
            timestamp: Date.now(),
            status: 'new',
            data
        });
    } catch (e) { console.warn('[Notification] Push failed', e); }
}

// ── Master Menu Fallback ──────────────────────────────────
const BARAK_MENU = [
    {id:'m1-basmat',name:'Basmati Rice',category:'Main Course',price:80,priceHalf:50,description:'Premium long grain steamed rice',imageUrl:'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400',portionType:'Plate',isAvailable:true},
    {id:'m2-bhunak',name:'Bhuna Khichuri',category:'Main Course',price:180,priceHalf:100,description:'Ghee-laden yellow lentil rice',imageUrl:'https://images.unsplash.com/photo-1645177639578-56e89d924bb1?w=400',portionType:'Plate',isAvailable:true},
    {id:'m3-luchi',name:'Luchi (4 pcs)',category:'Starters',price:60,priceHalf:0,description:'Deep-fried puffed bread',imageUrl:'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400',portionType:'Quantity',isAvailable:true},
    {id:'m4-chola',name:'Cholar Dal',category:'Main Course',price:90,priceHalf:0,description:'Bengal gram dal with coconut',imageUrl:'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400',portionType:'Plate',isAvailable:true},
    {id:'m5-begun',name:'Begun Bhaja',category:'Starters',price:40,priceHalf:0,description:'Fried eggplant slices',imageUrl:'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400',portionType:'Quantity',isAvailable:true},
    {id:'m6-aloop',name:'Aloo Posto',category:'Main Course',price:150,priceHalf:80,description:'Potatoes in poppy seed paste',imageUrl:'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400',portionType:'Plate',isAvailable:true},
    {id:'m7-shukto',name:'Shukto',category:'Main Course',price:120,priceHalf:70,description:'Traditional bitter-sweet mixed veg',imageUrl:'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=400',portionType:'Plate',isAvailable:true},
    {id:'m8-mocha',name:'Mochar Ghonto',category:'Main Course',price:160,priceHalf:0,description:'Banana flower dry curry',imageUrl:'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400',portionType:'Plate',isAvailable:true},
    {id:'m9-dhoka',name:'Dhokar Dalna',category:'Main Course',price:140,priceHalf:80,description:'Lentil cakes in spicy gravy',imageUrl:'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400',portionType:'Plate',isAvailable:true},
    {id:'m10-chick',name:'Chicken Kosha',category:'Main Course',price:280,priceHalf:160,description:'Slow-cooked spicy chicken',imageUrl:'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400',portionType:'Plate',isAvailable:true},
    {id:'m11-mutt',name:'Mutton Kosha',category:'Main Course',price:450,priceHalf:250,description:'Traditional spicy mutton curry',imageUrl:'https://images.unsplash.com/photo-1545247181-516773cae754?w=400',portionType:'Plate',isAvailable:true},
    {id:'m12-ilish',name:'Ilish Bhapa',category:'Main Course',price:450,priceHalf:0,description:'Hilsa steamed in mustard paste',imageUrl:'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=400',portionType:'Plate',isAvailable:true},
    {id:'m13-ruim',name:'Rui Macher Jhol',category:'Main Course',price:180,priceHalf:0,description:'Rohu fish in light cumin gravy',imageUrl:'https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=400',portionType:'Plate',isAvailable:true},
    {id:'m14-pabda',name:'Pabda Jhal',category:'Main Course',price:250,priceHalf:0,description:'Pabda fish in spicy mustard',imageUrl:'https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=400',portionType:'Plate',isAvailable:true},
    {id:'m15-ching',name:'Chingri Malaikari',category:'Main Course',price:380,priceHalf:0,description:'Prawns in coconut milk gravy',imageUrl:'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400',portionType:'Plate',isAvailable:true},
    {id:'m16-bhet',name:'Bhetki Paturi',category:'Main Course',price:320,priceHalf:0,description:'Fish steamed in banana leaf',imageUrl:'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=400',portionType:'Plate',isAvailable:true},
    {id:'m17-sorsh',name:'Sorshe Ilish',category:'Main Course',price:480,priceHalf:0,description:'Hilsa in pungent mustard gravy',imageUrl:'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=400',portionType:'Plate',isAvailable:true},
    {id:'m18-katla',name:'Katla Kalia',category:'Main Course',price:220,priceHalf:0,description:'Rich Katla fish gravy',imageUrl:'https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=400',portionType:'Plate',isAvailable:true},
    {id:'m19-pomf',name:'Pomfret Masala',category:'Main Course',price:300,priceHalf:0,description:'Whole fried pomfret masala',imageUrl:'https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=400',portionType:'Plate',isAvailable:true},
    {id:'m20-chikb',name:'Chicken Biryani',category:'Main Course',price:320,priceHalf:180,description:'Kolkata style with potato',imageUrl:'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400',portionType:'Plate',isAvailable:true},
    {id:'m21-mutb',name:'Mutton Biryani',category:'Main Course',price:420,priceHalf:220,description:'Rich aromatic mutton rice',imageUrl:'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400',portionType:'Plate',isAvailable:true},
    {id:'m22-fishf',name:'Fish Finger (6pcs)',category:'Starters',price:220,priceHalf:0,description:'Crispy breaded fish strips',imageUrl:'https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=400',portionType:'Quantity',isAvailable:true},
    {id:'m23-chikc',name:'Chicken Cutlet',category:'Starters',price:150,priceHalf:0,description:'Minced chicken deep fried',imageUrl:'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400',portionType:'Quantity',isAvailable:true},
    {id:'m24-vegc',name:'Veg Chop (2pcs)',category:'Starters',price:40,priceHalf:0,description:'Beetroot and peanut croquettes',imageUrl:'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400',portionType:'Quantity',isAvailable:true},
    {id:'m25-alood',name:'Aloo Dum',category:'Main Course',price:110,priceHalf:60,description:'Spicy baby potato curry',imageUrl:'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400',portionType:'Plate',isAvailable:true},
    {id:'m26-chann',name:'Channar Dalna',category:'Main Course',price:180,priceHalf:100,description:'Cottage cheese balls in gravy',imageUrl:'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400',portionType:'Plate',isAvailable:true},
    {id:'m27-murig',name:'Muri Ghonto',category:'Main Course',price:200,priceHalf:0,description:'Fish head cooked with rice',imageUrl:'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400',portionType:'Plate',isAvailable:true},
    {id:'m28-lauch',name:'Lau Chingri',category:'Main Course',price:190,priceHalf:0,description:'Bottle gourd with small prawns',imageUrl:'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400',portionType:'Plate',isAvailable:true},
    {id:'m29-papad',name:'Papad Bhaja',category:'Starters',price:15,priceHalf:0,description:'Crispy fried papadum',imageUrl:'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400',portionType:'Quantity',isAvailable:true},
    {id:'m30-tomat',name:'Tomato Chutney',category:'Starters',price:40,priceHalf:0,description:'Sweet and tangy tomato relish',imageUrl:'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=400',portionType:'Quantity',isAvailable:true},
    {id:'m31-mishti',name:'Mishti Doi',category:'Dessert',price:60,priceHalf:0,description:'Sweet fermented yogurt',imageUrl:'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400',portionType:'Quantity',isAvailable:true},
    {id:'m32-roso',name:'Rosogolla (2pcs)',category:'Dessert',price:40,priceHalf:0,description:'Sponge syrupy balls',imageUrl:'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400',portionType:'Quantity',isAvailable:true},
    {id:'m33-gulab',name:'Gulab Jamun (2pcs)',category:'Dessert',price:50,priceHalf:0,description:'Fried milk solid balls',imageUrl:'https://images.unsplash.com/photo-1620660998677-f5a6c07db9bb?w=400',portionType:'Quantity',isAvailable:true},
    {id:'m34-payesh',name:'Payesh',category:'Dessert',price:100,priceHalf:0,description:'Rice pudding with jaggery',imageUrl:'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400',portionType:'Quantity',isAvailable:true},
    {id:'m35-sand',name:'Sandesh (2pcs)',category:'Dessert',price:60,priceHalf:0,description:'Traditional dry milk sweet',imageUrl:'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400',portionType:'Quantity',isAvailable:true},
    {id:'m36-mw1l',name:'Mineral Water 1L',category:'Drinks',price:20,priceHalf:0,description:'Chilled Bisleri',imageUrl:'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400',portionType:'Bottle',isAvailable:true},
    {id:'m37-mw500',name:'Mineral Water 500ml',category:'Drinks',price:10,priceHalf:0,description:'Travel size water',imageUrl:'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400',portionType:'Bottle',isAvailable:true},
    {id:'m38-milkt',name:'Milk Tea',category:'Drinks',price:25,priceHalf:0,description:'Strong Assam CTC Tea',imageUrl:'https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?w=400',portionType:'Cup',isAvailable:true},
    {id:'m39-blkt',name:'Black Tea',category:'Drinks',price:15,priceHalf:0,description:'Lemon and ginger tea',imageUrl:'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400',portionType:'Cup',isAvailable:true},
    {id:'m40-coffee',name:'Coffee',category:'Drinks',price:40,priceHalf:0,description:'Instant milk coffee',imageUrl:'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400',portionType:'Cup',isAvailable:true},
    {id:'m41-lassi',name:'Sweet Lassi',category:'Drinks',price:80,priceHalf:0,description:'Thick yogurt drink',imageUrl:'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=400',portionType:'Cup',isAvailable:true},
    {id:'m42-limsod',name:'Fresh Lime Soda',category:'Drinks',price:60,priceHalf:0,description:'Sweet or Salted',imageUrl:'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400',portionType:'Cup',isAvailable:true},
    {id:'m43-cola',name:'Coca Cola 500ml',category:'Drinks',price:45,priceHalf:0,description:'Pet bottle chilled',imageUrl:'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400',portionType:'Bottle',isAvailable:true},
    {id:'m44-sprite',name:'Sprite 500ml',category:'Drinks',price:45,priceHalf:0,description:'Pet bottle chilled',imageUrl:'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400',portionType:'Bottle',isAvailable:true},
    {id:'m45-eggc',name:'Egg Curry (2pcs)',category:'Main Course',price:120,priceHalf:0,description:'Boiled eggs in spicy gravy',imageUrl:'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400',portionType:'Plate',isAvailable:true},
    {id:'m46-dakb',name:'Chicken Dak Bunglow',category:'Main Course',price:300,priceHalf:180,description:'Heritage chicken curry with egg',imageUrl:'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400',portionType:'Plate',isAvailable:true},
    {id:'m47-posto',name:'Posto Bora (4pcs)',category:'Starters',price:120,priceHalf:0,description:'Poppy seed fried fritters',imageUrl:'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400',portionType:'Quantity',isAvailable:true},
    {id:'m48-dachr',name:'Macher Matha Diye Dal',category:'Main Course',price:130,priceHalf:0,description:'Roasted Moong dal with fish head',imageUrl:'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400',portionType:'Plate',isAvailable:true},
    {id:'m49-kanka',name:'Kancha Lanka Murgi',category:'Main Course',price:290,priceHalf:160,description:'Green chili chicken (spicy)',imageUrl:'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400',portionType:'Plate',isAvailable:true},
    {id:'m50-bhetf',name:'Bhetki Fry',category:'Starters',price:180,priceHalf:0,description:'Pure Bhetki fillet fry',imageUrl:'https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=400',portionType:'Quantity',isAvailable:true}
];

// ── State ──────────────────────────────────────────────────
let rooms = {};
let menu = BARAK_MENU; 
let waiterCart = [];
let selectedRoom = null;
let addonOrderId = null;
let unavailableItems = [];
let kitchenOrders = [];

// ── Listeners ──────────────────────────────────────────
function startListeners() {
    const { collection, onSnapshot, query, orderBy, limit, doc } = hooks;

    // Listen to Rooms (for status updates)
    onSnapshot(collection(db, 'rooms'), (snap) => {
        rooms = {};
        snap.forEach(d => {
            rooms[d.id] = { id: d.id, ...d.data() };
        });
        populateRoomSelect();
        if (selectedRoom) window.selectRoom(selectedRoom);
    });

    // Listen to Menu (Ground Truth Sync with Fallback)
    onSnapshot(collection(db, 'menuItems'), async (snap) => {
        if (!snap.empty) {
            const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Merge cloud menu items with BARAK_MENU fallback strategy
            const updatedMenu = BARAK_MENU.map(baseItem => {
                const cloudItem = raw.find(d => d.id === baseItem.id) || {};
                const name = cloudItem.name || cloudItem.Name || cloudItem.itemName || baseItem.name;
                const price = cloudItem.price || cloudItem.PriceFull || cloudItem.Price || baseItem.price;
                const priceHalf = cloudItem.priceHalf || cloudItem.PriceHalf || baseItem.priceHalf;
                
                return {
                    ...baseItem,
                    ...cloudItem,
                    name: name,
                    price: Number(price),
                    priceHalf: Number(priceHalf),
                    imageUrl: cloudItem.imageUrl || cloudItem.ImageURL || cloudItem.image || baseItem.imageUrl,
                    isAvailable: cloudItem.isAvailable !== false
                };
            });

            menu = updatedMenu;
            renderMenu();
        }
    });

    // Listen to Availability
    onSnapshot(doc(db, 'settings', 'availability'), (snap) => {
        if (snap.exists()) {
            unavailableItems = snap.data().unavailableItems || [];
            renderMenu();
        }
    });

    // Listen to Orders for Live View
    onSnapshot(query(collection(db, 'orders'), orderBy('timestamp', 'desc'), limit(50)), (snap) => {
        const orders = [];
        snap.forEach(d => orders.push({ id: d.id, ...d.data() }));
        kitchenOrders = orders;
        renderLiveOrders();
    });
}

// ── UI Logic ──────────────────────────────────────────

function populateRoomSelect() {
    const select = document.getElementById('waiter-room-select');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">📋 Select Room...</option>';
    
    // Sort room numbers naturally
    const sortedRooms = Object.values(rooms).sort((a,b) => Number(a.number) - Number(b.number));
    
    sortedRooms.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.number;
        opt.innerText = `Room ${r.number} ${r.status === 'occupied' ? `— ${r.guestName || 'Occupied'}` : '(Vacant)'}`;
        if (r.status !== 'occupied') opt.style.color = '#9CA3AF';
        select.appendChild(opt);
    });
    if (currentVal) select.value = currentVal;
}

window.selectRoom = function(roomNum) {
    selectedRoom = roomNum;
    addonOrderId = null;
    const room = rooms[roomNum] || {};
    
    const display = document.getElementById('ordering-room-display');
    if (display) display.innerText = roomNum ? `ROOM ${roomNum} — NEW ORDER` : 'SELECT A ROOM TO BEGIN';
    
    const badge = document.getElementById('waiter-addon-badge');
    if (badge) badge.style.display = 'none';
    
    const summary = document.getElementById('room-summary');
    if (roomNum && room.status === 'occupied') {
        if (summary) summary.style.display = 'block';
        const gName = document.getElementById('summary-guest-name');
        if (gName) gName.innerText = room.guestName || 'Active Guest';
        
        const roomTotal = kitchenOrders
            .filter(o => String(o.roomNumber) === String(roomNum))
            .reduce((sum, o) => sum + (o.total_price || o.total || 0), 0);
        
        const sTotal = document.getElementById('summary-total');
        if (sTotal) sTotal.innerText = `₹${roomTotal}`;
    } else {
        if (summary) summary.style.display = 'none';
    }

    waiterCart = [];
    updateCartUI();
    renderLiveOrders();
};

function renderMenu(categoryFilter = 'All') {
    const grid = document.getElementById('order-menu-grid');
    const pills = document.getElementById('order-categories');
    if (!grid) return;

    const filteredMenu = menu.filter(i => i.isAvailable !== false && !unavailableItems.includes(i.id));
    const cats = ['All', ...new Set(filteredMenu.map(i => i.category || 'General'))];
    
    if (pills) {
        pills.innerHTML = cats.map(c => `<button class="waiter-cat-pill ${categoryFilter === c ? 'active' : ''}" onclick="window.renderMenu('${c}')">${c}</button>`).join('');
    }

    const items = categoryFilter === 'All' ? filteredMenu : filteredMenu.filter(i => (i.category || 'General') === categoryFilter);

    grid.innerHTML = items.map(i => {
        const name = i.name || 'Unnamed Item';
        const price = i.price || 0;
        const priceH = i.priceHalf || 0;
        const imgUrl = i.imageUrl || 'br.png';
        const halfLine = priceH ? `<div class="item-half-price">Half: ₹${priceH}</div>` : '';
        return `
            <div class="waiter-menu-card" onclick="window.promptPortion('${i.id}')">
                <img src="${imgUrl}" onerror="this.src='br.png'" style="width:100%; height:80px; object-fit:cover; border-radius:8px;" />
                <div class="item-name">${name}</div>
                <div class="item-price">₹${price}</div>
                ${halfLine}
            </div>`;
    }).join('');
}
window.renderMenu = renderMenu;

window.promptPortion = function(itemId) {
    if (!selectedRoom) { showToast('Please select a room first!', 'warning'); return; }
    const item = menu.find(i => i.id === itemId);
    if (!item) return;

    const modal = document.getElementById('waiter-portion-modal');
    const name = item.name || 'Item';
    const desc = item.description || 'Select preference';
    document.getElementById('wpm-item-name').innerText = name;
    document.getElementById('wpm-item-desc').innerText = desc;
    const ctn = document.getElementById('wpm-options-container');
    ctn.innerHTML = '';

    const price = item.price || 0;
    const type = item.portionType || 'Plate';

    if (type === 'Plate' || type === 'Portion') {
        const halfPrice = item.priceHalf || 0;
        const opts = [{ label: 'Full', val: 'Full', price: price }];
        if (halfPrice > 0) opts.push({ label: 'Half', val: 'Half', price: halfPrice });
        opts.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'wpm-opt-btn';
            btn.innerHTML = `<span>${opt.label}</span> <span>₹${opt.price}</span>`;
            btn.onclick = () => promptQuantity(item, opt.val, opt.label, opt.price);
            ctn.appendChild(btn);
        });
    } else {
        promptQuantity(item, 'Regular', 'Standard', price);
    }
    modal.style.display = 'flex';
};

function promptQuantity(item, variant, label, price) {
    const ctn = document.getElementById('wpm-options-container');
    const name = item.name || 'Item';
    document.getElementById('wpm-item-name').innerText = `${name} (${label})`;
    ctn.innerHTML = '';
    let qty = 1;

    const counter = document.createElement('div');
    counter.className = 'wpm-counter';
    counter.innerHTML = `
        <button onclick="window.updateQty(-1)">-</button>
        <div id="wpm-qty-val">1</div>
        <button onclick="window.updateQty(1)">+</button>
    `;
    ctn.appendChild(counter);

    const addBtn = document.createElement('button');
    addBtn.className = 'wpm-add-btn';
    addBtn.innerText = `ADD TO CART — ₹${price}`;
    addBtn.onclick = () => {
        const nameFallback = item.name || 'Item';
        const finalName = variant === 'Full' || variant === 'Regular' ? nameFallback : `${nameFallback} (${label})`;
        const cartItem = {
            id: `${item.id}_${variant}`,
            name: finalName,
            price: price,
            qty: qty,
            variant: variant,
            timestamp: Date.now()
        };
        const existing = waiterCart.find(c => c.id === cartItem.id);
        if (existing) existing.qty += qty;
        else waiterCart.push(cartItem);
        updateCartUI();
        document.getElementById('waiter-portion-modal').style.display = 'none';
        showToast('Added to cart', 'success');
    };
    ctn.appendChild(addBtn);

    window.updateQty = (delta) => {
        qty = Math.max(1, qty + delta);
        const qtyVal = document.getElementById('wpm-qty-val');
        if (qtyVal) qtyVal.innerText = qty;
        addBtn.innerText = `ADD TO CART — ₹${price * qty}`;
    };
}

function updateCartUI() {
    const container = document.getElementById('waiter-cart-items');
    const totalAmt = document.getElementById('waiter-total-amt');
    const placeBtn = document.getElementById('waiter-place-btn');
    
    let total = 0;
    if (waiterCart.length === 0) {
        container.innerHTML = '<div class="empty-msg">Cart is empty</div>';
    } else {
        container.innerHTML = waiterCart.map((item, idx) => {
            total += item.price * item.qty;
            return `
                <div class="cart-row">
                    <div class="cart-info">
                        <div class="cart-name">${item.name}</div>
                        <div class="cart-sub">₹${item.price} × ${item.qty}</div>
                    </div>
                    <div class="cart-controls">
                        <button onclick="window.changeCartQty(${idx}, -1)">-</button>
                        <span>${item.qty}</span>
                        <button onclick="window.changeCartQty(${idx}, 1)">+</button>
                    </div>
                </div>`;
        }).join('');
    }
    if (totalAmt) totalAmt.innerText = total;
    if (placeBtn) placeBtn.disabled = !(selectedRoom && waiterCart.length > 0);
}

window.changeCartQty = (idx, delta) => {
    waiterCart[idx].qty += delta;
    if (waiterCart[idx].qty <= 0) waiterCart.splice(idx, 1);
    updateCartUI();
};

function renderLiveOrders() {
    const container = document.getElementById('waiter-live-orders');
    if (!container || !selectedRoom) {
        if (container) container.innerHTML = '<div class="empty-msg">Select a room to see orders</div>';
        return;
    }

    const roomOrders = kitchenOrders.filter(o => String(o.roomNumber) === String(selectedRoom));
    
    if (roomOrders.length === 0) {
        container.innerHTML = '<div class="empty-msg">No recent orders</div>';
    } else {
        container.innerHTML = roomOrders.map(o => {
            const status = o.status || 'Pending';
            const statusColor = status === 'Delivered' ? '#22C55E' : (status === 'Pending' ? '#EAB308' : '#3B82F6');
            return `
                <div class="live-order-card" onclick="window.enterAddonMode('${o.id}')" style="background:rgba(255,255,255,0.03); border:1px solid rgba(212,175,55,0.2); padding:0.8rem; border-radius:10px; margin-bottom:0.5rem; cursor:pointer;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
                        <span style="font-weight:700; font-size:0.8rem;">#${o.id}</span>
                        <span style="color:${statusColor}; font-weight:800; font-size:0.7rem;">${status.toUpperCase()}</span>
                    </div>
                    <div style="font-size:0.75rem; opacity:0.6; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${(o.items || []).map(i => i.name).join(', ')}
                    </div>
                    <div style="margin-top:0.4rem; font-weight:800; color:var(--gold-primary); font-size:0.85rem;">₹${o.total_price || o.total || 0}</div>
                </div>
            `;
        }).join('');
    }
}

window.enterAddonMode = function(orderId) {
    addonOrderId = orderId;
    document.getElementById('ordering-room-display').innerText = `ROOM ${selectedRoom} — ADD-ON TO ${orderId}`;
    document.getElementById('waiter-addon-badge').style.display = 'block';
    showToast('Add-on Mode Active', 'info');
};

// ── Actions ──────────────────────────────────────────

async function getNextGlobalSerial(roomNum) {
    const { doc, runTransaction } = hooks;
    try {
        const roomRef = doc(db, 'rooms', String(roomNum));
        let nextSerial = 1;
        await runTransaction(db, async (tx) => {
            const snap = await tx.get(roomRef);
            const current = snap.exists() ? (snap.data().lifetimeOrderCount || 0) : 0;
            nextSerial = current + 1;
            tx.update(roomRef, { lifetimeOrderCount: nextSerial });
        });
        return `${roomNum}-${nextSerial}`;
    } catch (e) {
        return `R${roomNum}-${Date.now().toString().slice(-4)}`;
    }
}

window.placeOrder = async function() {
    if (!selectedRoom || waiterCart.length === 0) return;
    const { doc, updateDoc, setDoc, serverTimestamp, increment, arrayUnion } = hooks;
    
    const btn = document.getElementById('waiter-place-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerText = '⌛ PLACING...';
    }

    const roomNum = selectedRoom;
    const room = rooms[roomNum] || {};
    const total = waiterCart.reduce((s, i) => s + (i.price * i.qty), 0);

    try {
        if (addonOrderId) {
            const orderRef = doc(db, 'orders', addonOrderId);
            await updateDoc(orderRef, {
                items: arrayUnion(...waiterCart),
                total_price: increment(total),
                isAddon: true,
                status: 'Pending'
            });
            showToast('Add-on items added!', 'success');
        } else {
            const orderId = await getNextGlobalSerial(roomNum);
            const orderObj = {
                order_id: orderId,
                id: orderId,
                roomNumber: String(roomNum),
                guestName: room.guestName || 'Guest',
                stayID: room.currentStayId || "",
                items: waiterCart,
                total_price: total,
                status: 'Pending',
                timestamp: serverTimestamp(),
                orderType: 'Room'
            };
            await setDoc(doc(db, 'orders', orderId), orderObj);
            showToast(`Order ${orderId} placed!`, 'success');
        }
        
        if (room.currentGuestId) {
            const guestRef = doc(db, 'guests', room.currentGuestId);
            const itemsToAppend = waiterCart.map(i => ({
                name: i.name,
                qty: i.qty,
                price: i.price,
                timestamp: Date.now()
            }));
            await updateDoc(guestRef, {
                foodTotal: increment(total),
                billItems: arrayUnion(...itemsToAppend)
            });
        }

        waiterCart = [];
        updateCartUI();
        addonOrderId = null;
        if (document.getElementById('waiter-addon-badge')) document.getElementById('waiter-addon-badge').style.display = 'none';
        if (document.getElementById('ordering-room-display')) document.getElementById('ordering-room-display').innerText = `ROOM ${selectedRoom} — NEW ORDER`;

        await pushNotification(
            'order',
            `ROOM ORDER: Room ${roomNum} — ${room.guestName || 'Guest'}`,
            'desk',
            { type: 'room', roomNumber: roomNum, orderId: addonOrderId || 'New' }
        );
        
    } catch (e) {
        console.error(e);
        showToast('Operation failed', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = '🚀 PLACE ORDER';
        }
    }
};

window.handleLogout = async () => {
    if (confirm('Logout from Waiter Portal?')) {
        await window.firebaseHooks.signOut(window.firebaseAuth);
        window.location.href = 'login.html';
    }
};

function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 500);
    }, 3000);
}

async function boot() {
    if (!window.firebaseHooks) {
        setTimeout(boot, 500);
        return;
    }
    refreshFirebaseRefs();
    const { onAuthStateChanged } = hooks;
    onAuthStateChanged(auth, user => {
        if (!user) {
            window.location.href = 'login.html';
        } else {
            startListeners();
            renderMenu(); 
        }
    });
}
boot();
