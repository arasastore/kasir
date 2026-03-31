const { createClient } = supabase;
const supabaseClient = createClient('https://xlfbiavdodyxnmgnsvls.supabase.co', 'sb_publishable_wAvlgdaWcmevkDxOSTALwQ_wpUP5byQ');

// ================= PENGATURAN IDENTITAS & PROTEKSI 15 JAM =================
const myRole = localStorage.getItem('userRole');
const myBranch = localStorage.getItem('userBranch') || 'Pusat';
const myName = localStorage.getItem('userName') || 'Admin';
const loginTime = localStorage.getItem('loginTime');

const MAX_SESSION_MS = 15 * 60 * 60 * 1000; 

if (!myRole || !loginTime || (Date.now() - parseInt(loginTime)) > MAX_SESSION_MS) {
    alert("Sesi login Anda telah habis atau tidak valid. Silakan login kembali untuk keamanan.");
    localStorage.clear();
    window.location.href = 'login.html';
}

const elKasirInfo = document.getElementById('txt-kasir-info');
if (elKasirInfo) { elKasirInfo.innerText = `Kasir: ${myName} | Cabang: Arasa ${myBranch}`; }

function logoutKasir() {
    if(confirm("Yakin ingin mengakhiri shift dan Logout?")) {
        localStorage.clear(); window.location.href = 'login.html';
    }
}
// ==========================================================================

let productsData = [];
let cart = [];
let totalTagihanGlobal = 0;
let isBookingMode = false;
let tempSelectedProduct = null;

let storeConfig = { store_name: 'ARASA STORE', store_address: 'Pusat Oleh-Oleh', footer_message: 'Terima Kasih Atas Kunjungan Anda!', paper_size: '58mm', logo_base64: '' };

async function fetchStoreSettings() {
    try {
        const { data } = await supabaseClient.from('store_settings').select('*').eq('id', 1).single();
        if (data) { storeConfig.store_name = data.store_name || storeConfig.store_name; storeConfig.store_address = data.store_address || storeConfig.store_address; storeConfig.footer_message = data.footer_message || storeConfig.footer_message; storeConfig.paper_size = data.paper_size || storeConfig.paper_size; storeConfig.logo_base64 = data.logo_base64 || ''; }
    } catch (e) { console.log("Gagal memuat setting toko."); }
}

async function fetchProducts() {
    try {
        const { data, error } = await supabaseClient.from('products').select('*').order('name');
        if (error) throw error; productsData = data; renderProducts(productsData);
    } catch (err) { console.error(err); }
}

function renderProducts(dataToRender) {
    const list = document.getElementById('product-list'); list.innerHTML = ''; 
    dataToRender.forEach(p => {
        list.innerHTML += `<div class="card" onclick='bukaModalQty(${JSON.stringify(p)})'><h4>${p.name}</h4><p>Rp ${p.price.toLocaleString('id-ID')}</p><small style="color:#888;">Stok: ${p.stock} | ${p.type.toUpperCase()}</small></div>`;
    });
}

// ================= LOGIKA KLIK MENU (EKSKLUSIF OTE-OTE) =================
function bukaModalQty(p) {
    tempSelectedProduct = p;
    
    // DETEKSI OTOMATIS: Jika nama mengandung "ote" (huruf besar/kecil bebas)
    if (p.name.toLowerCase().includes('ote')) {
        // MUNCULKAN POPUP PACK/BIJI
        document.getElementById('nama-menu-qty').innerText = p.name.toUpperCase();
        document.getElementById('input-qty-pack').value = 0;
        document.getElementById('input-qty-biji').value = 1; 
        hitungTotalPcs();
        document.getElementById('modalInputQty').style.display = 'flex';
    } else {
        // JIKA BUKAN OTE-OTE: Langsung lempar 1 Pcs ke keranjang tanpa tanya
        const ada = cart.find(i => i.id === p.id);
        if (ada) { 
            ada.qty += 1; 
        } else { 
            cart.push({ ...p, qty: 1, masukWaitingList: p.type === 'dadakan' }); 
        }
        renderCart();
    }
}

function hitungTotalPcs() {
    let pack = parseInt(document.getElementById('input-qty-pack').value) || 0;
    let biji = parseInt(document.getElementById('input-qty-biji').value) || 0;
    let total = (pack * 6) + biji;
    document.getElementById('teks-total-pcs').innerText = total;
}

function masukkanKeKeranjang() {
    let pack = parseInt(document.getElementById('input-qty-pack').value) || 0;
    let biji = parseInt(document.getElementById('input-qty-biji').value) || 0;
    let totalQty = (pack * 6) + biji;
    if (totalQty <= 0) return alert("Jumlah tidak boleh kosong!");
    const p = tempSelectedProduct;
    const ada = cart.find(i => i.id === p.id);
    if (ada) { ada.qty += totalQty; } else { cart.push({ ...p, qty: totalQty, masukWaitingList: p.type === 'dadakan' }); }
    tutupModal('modalInputQty'); renderCart();
}

function updateQty(idx, change) { cart[idx].qty += change; if (cart[idx].qty <= 0) cart.splice(idx, 1); renderCart(); }
function setQty(idx, val) { let newVal = parseInt(val); if (isNaN(newVal) || newVal < 1) newVal = 1; cart[idx].qty = newVal; renderCart(); }
function ubahStatusWaitingList(idx, checked) { cart[idx].masukWaitingList = checked; }

function renderCart() {
    const cartItems = document.getElementById('cart-items'); cartItems.innerHTML = '';
    let total = 0; let adaDadakan = false;
    if (cart.length === 0) { document.getElementById('total-price').innerText = '0'; return cartItems.innerHTML = '<p>Belum ada pesanan.</p>'; }
    cart.forEach((item, index) => {
        const subtotal = item.price * item.qty; total += subtotal;
        if (item.type === 'dadakan') adaDadakan = true;
        let cbDapur = item.type === 'dadakan' ? `<label style="font-size:12px; color:#d35400; font-weight:bold; display:block; margin-top:8px; cursor:pointer;"><input type="checkbox" ${item.masukWaitingList ? 'checked' : ''} onchange="ubahStatusWaitingList(${index}, this.checked)"> Masuk Waiting List (KDS)</label>` : '';
        cartItems.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:15px; align-items:center;"><div style="flex:2; padding-right:10px;"><strong style="font-size: 15px; color:#333;">${item.name}</strong><br><small style="color:#666; font-size: 13px;">Rp ${item.price.toLocaleString('id-ID')}</small>${cbDapur}</div><div style="flex:1; display:flex; gap:5px; align-items:center; justify-content:center;"><button onclick="updateQty(${index}, -1)" style="width:30px; height:30px; padding:0; background:#e0e0e0; border-radius:4px; font-weight:bold; border:none; cursor:pointer
