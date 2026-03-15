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

class GuestPortal {
    constructor() {
        this.roomNumber = null;
        this.guestName = "Guest";
        this.cart = [];
        this.sessionHistory = []; 
        this.activeOrderId = null;
        this.menu = BARAK_MENU;  // Set immediately — no waiting for Firebase
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

            // Clear stale cached menu (might have old broken 'Dish/₹0' data)
            const cachedRaw = localStorage.getItem('br_menu');
            if (cachedRaw) {
                try {
                    const parsed = JSON.parse(cachedRaw);
                    const isGood = parsed.length > 0 && parsed[0].price > 0 && parsed[0].name !== 'Dish';
                    if (isGood) { this.menu = parsed; }
                    else { localStorage.removeItem('br_menu'); }
                } catch(e) { localStorage.removeItem('br_menu'); }
            }

            // Render immediately with best available menu
            this.renderMenu();

            this.initDB().then(() => {
                this.fetchGuestData();
                this.setupTracking();
            });

            this.updateActivePreview();

            window.addEventListener('storage', (e) => {
                if (e.key === 'br_unavailable_items') this.renderMenu();
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

        // 1. Menu Listener — with hardcoded fallback
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
            {id:'m31-mishti',name:'Mishti Doi',category:'Dessert',price:60,priceHalf:0,description:'Sweet fermented yogurt',imageUrl:'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400',portionType:'Plate',isAvailable:true},
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

        // Push hardcoded menu to Firestore if collection is empty OR has stale/broken data
        const pushMenuToFirestore = async (items) => {
            try {
                const { collection, getDocs, doc, setDoc, deleteDoc } = window.firebaseHooks;
                const col = collection(window.firebaseFS, 'menuItems');
                const snap = await getDocs(col);
                
                // Check if Firestore has stale data (items with Name/PriceFull fields or missing price)
                const docs = snap.docs.map(d => d.data());
                const hasStale = snap.size === 0 || 
                    docs.some(d => (!d.name && d.Name) || (d.price == null && d.PriceFull) || d.price === 0);
                
                if (hasStale) {
                    console.log('[Menu] Stale/empty Firestore data detected — re-seeding all 50 items...');
                    // Delete old records
                    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
                    // Write fresh hardcoded records
                    const writes = items.map(item => setDoc(doc(window.firebaseFS, 'menuItems', item.id), item));
                    await Promise.all(writes);
                    console.log(`[Menu] Seeded ${items.length} items to Firestore successfully.`);
                }
            } catch (e) { console.warn('[Menu] Auto-seed failed:', e); }
        };

        // Use hardcoded menu immediately & seed Firestore in background
        this.menu = BARAK_MENU;
        this.renderMenu();
        pushMenuToFirestore(BARAK_MENU);

        // Helper: normalize field names from CSV legacy format to standard
        const normalizeItem = (raw) => ({
            id:          raw.id || `m-${Math.random().toString(36).slice(2,8)}`,
            name:        raw.name || raw.Name || 'Dish',
            category:    raw.category || raw.Category || 'General',
            price:       parseFloat(raw.price || raw.PriceFull || raw.pricefull || 0),
            priceHalf:   parseFloat(raw.priceHalf || raw.PriceHalf || raw.pricehalf || 0),
            description: raw.description || raw.Description || 'Barak Residency Special',
            imageUrl:    raw.imageUrl || raw.ImageURL || raw.image || raw.img || 'br.png',
            portionType: raw.portionType || raw.PortionType || 'Plate',
            isAvailable: raw.isAvailable !== false
        });

        onSnapshot(collection(window.firebaseFS, 'menuItems'), (snap) => {
            const items = [];
            snap.forEach(d => items.push(normalizeItem(d.data())));
            if (items.length > 0 && items.some(i => i.name !== 'Dish' && i.price > 0)) {
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

        // 3. Active Order Tracking — listen to this room's orders in real-time
        const { query: qFn, where: wFn } = window.firebaseHooks;
        const roomOrdersQuery = qFn(
            collection(window.firebaseFS, 'orders'),
            wFn('roomNumber', '==', String(this.roomNumber))
        );
        onSnapshot(roomOrdersQuery, (snap) => {
            if (snap.empty) return;
            // Pick the most recent non-delivered order
            const active = snap.docs
                .map(d => d.data())
                .filter(o => o.status !== 'Delivered' && o.status !== 'delivered')
                .sort((a, b) => {
                    const ta = a.timestamp?.seconds ? a.timestamp.seconds*1000 : (a.timestamp || 0);
                    const tb = b.timestamp?.seconds ? b.timestamp.seconds*1000 : (b.timestamp || 0);
                    return tb - ta;
                });

            if (active.length > 0) {
                const latest = active[0];
                this.activeOrderId = latest.order_id || latest.id;
                localStorage.setItem(`br_active_order_${this.roomNumber}`, this.activeOrderId);
                this.updateTrackingUI(latest.status);
                this.updateActivePreview(true);
            } else {
                // All orders delivered — clear tracker after delay
                setTimeout(() => {
                    this.activeOrderId = null;
                    localStorage.removeItem(`br_active_order_${this.roomNumber}`);
                    this.updateActivePreview(false);
                }, 5000);
            }
        });
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
        const q = document.getElementById('menu-search')?.value?.toLowerCase() || '';
        if (!q) { this.renderMenu(); return; }
        const filtered = this.menu.filter(item => {
            const n = (item.name || item.Name || '').toLowerCase();
            const d = (item.description || item.Description || '').toLowerCase();
            const c = (item.category || item.Category || '').toLowerCase();
            return n.includes(q) || d.includes(q) || c.includes(q);
        });
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
        const raw = this.menu.find(m => m.id === itemId);
        if (!raw) return;

        // Normalize item fields
        const item = {
            ...raw,
            name:        raw.name || raw.Name || 'Dish',
            price:       parseFloat(raw.price || raw.PriceFull || 0),
            priceHalf:   parseFloat(raw.priceHalf || raw.PriceHalf || 0),
            description: raw.description || raw.Description || '',
            imageUrl:    raw.imageUrl || raw.ImageURL || 'br.png',
            portionType: raw.portionType || raw.PortionType || 'Plate',
        };
        this.pendingItem = item;

        const type = item.portionType;

        // For Quantity/Cup — add directly, no modal
        if (type === 'Quantity' || type === 'Cup' || !type) {
            this.promptQuantity(item, 'Regular', 'Standard', item.price);
            return;
        }

        document.getElementById('pm-item-name').innerText = item.name;
        document.getElementById('pm-item-desc').innerText = 'Select preferred size';
        const container = document.getElementById('pm-options-container');
        container.innerHTML = '';

        if (type === 'Plate') {
            // Full Plate always available; Half only if priceHalf > 0
            const halfPrice = item.priceHalf > 0 ? item.priceHalf : Math.floor(item.price * 0.6);
            const opts = [
                { label: 'Full Plate', val: 'Full', price: item.price }
            ];
            if (halfPrice > 0) opts.push({ label: 'Half Plate', val: 'Half', price: halfPrice });

            opts.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'reorder-btn tint-blur';
                btn.style.marginBottom = '0.5rem';
                btn.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><span>${opt.label}</span><span style="color:var(--gold-primary);font-weight:800">₹${opt.price}</span></div>`;
                btn.onclick = () => this.promptQuantity(item, opt.val, opt.label, opt.price);
                container.appendChild(btn);
            });
        } else if (type === 'Bottle') {
            const sizes = [
                { label: '1L Bottle', val: '1L', price: item.price },
                { label: '750ml', val: '750ml', price: Math.floor(item.price * 0.8) },
                { label: '500ml', val: '500ml', price: Math.floor(item.price * 0.6) }
            ];
            sizes.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'reorder-btn tint-blur';
                btn.style.marginBottom = '0.5rem';
                btn.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><span>${opt.label}</span><span style="color:var(--gold-primary);font-weight:800">₹${opt.price}</span></div>`;
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

        const orderId = await window.FirebaseSync.getNextOrderSerial(this.roomNumber);
        this.activeOrderId = orderId;
        localStorage.setItem(`br_active_order_${this.roomNumber}`, orderId);

        const total = this.cart.reduce((s, i) => s + (i.price * i.qty), 0);
        const orderObj = {
            order_id: orderId,
            id: orderId,
            roomNumber: String(this.roomNumber),
            roomId: String(this.roomNumber),
            guestName: this.guestName || 'Guest',
            salutation: this.salutation || '',
            items: this.cart,
            total_price: total,
            status: 'Pending',
            timestamp: Date.now(),
            orderType: 'Room'
        };

        if (window.FirebaseSync) {
            await window.FirebaseSync.pushOrderToCloud(orderObj);
            console.log('[Order] Placed:', orderId, 'for Room', this.roomNumber);
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
            'Served': { p: '66%', n: 3, text: 'Order Ready' },
            'ready': { p: '66%', n: 3, text: 'Order Ready' },
            'On the Way': { p: '66%', n: 3, text: 'On the Way' },
            'ontheway': { p: '66%', n: 3, text: 'On the Way' },
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
