const { createClient } = supabase;
const supabaseClient = createClient('https://xlfbiavdodyxnmgnsvls.supabase.co', 'sb_publishable_wAvlgdaWcmevkDxOSTALwQ_wpUP5byQ');

let productsData = [];
let cart = [];
let totalTagihanGlobal = 0;
let isBookingMode = false;
let tempSelectedProduct = null;

// AMBIL DATA CABANG & ROLE DARI LOGIN
const myBranch = localStorage.getItem('userBranch') || 'Pusat';
const myRole = localStorage.getItem('userRole');

let storeConfig = {
    store_name: 'ARASA STORE',
    store_address: 'Pusat Oleh-Oleh',
    footer_message: 'Terima Kasih Atas Kunjungan Anda!',
    paper_size: '58mm',
    logo_base64: ''
};

if (myRole !== 'kasir' && myRole !== 'admin_pusat' && myRole !== 'admin_cabang') { 
    window.location.href = 'login.html'; 
}

async function fetchStoreSettings() {
    try {
        const { data } = await supabaseClient.from('store_settings').select('*').eq('id', 1).single();
        if (data) {
            storeConfig.store_name = data.store_name || storeConfig.store_name;
            storeConfig.store_address = data.store_address || storeConfig.store_address;
            storeConfig.footer_message = data.footer_message || storeConfig.footer_message;
            storeConfig.paper_size = data.paper_size || storeConfig.paper_size;
            storeConfig.logo_base64 = data.logo_base64 || '';
        }
    } catch (e) { console.log("Gagal memuat setting toko."); }
}

async function fetchProducts() {
    try {
        const { data, error } = await supabaseClient.from('products').select('*').order('name');
        if (error) throw error; 
        productsData = data; 
        renderProducts(productsData);
    } catch (err) { console.error(err); }
}

function renderProducts(dataToRender) {
    const list = document.getElementById('product-list'); list.innerHTML = ''; 
    dataToRender.forEach(p => {
        list.innerHTML += `<div class="card" onclick='bukaModalQty(${JSON.stringify(p)})'><h4>${p.name}</h4><p>Rp ${p.price.toLocaleString('id-ID')}</p><small style="color:#888;">Stok: ${p.stock} | ${p.type.toUpperCase()}</small></div>`;
    });
}

function bukaModalQty(p) {
    tempSelectedProduct = p;
    document.getElementById('nama-menu-qty').innerText = p.name.toUpperCase();
    document.getElementById('input-qty-pack').value = 0;
    document.getElementById('input-qty-biji').value = 1; 
    hitungTotalPcs();
    document.getElementById('modalInputQty').style.display = 'flex';
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

function renderCart() {
    const cartItems = document.getElementById('cart-items'); cartItems.innerHTML = '';
    let total = 0; let adaDadakan = false;
    if (cart.length === 0) { document.getElementById('total-price').innerText = '0'; return cartItems.innerHTML = '<p>Belum ada pesanan.</p>'; }
    cart.forEach((item, index) => {
        const subtotal = item.price * item.qty; total += subtotal;
        if (item.type === 'dadakan') adaDadakan = true;
        let cbDapur = item.type === 'dadakan' ? `<label style="font-size:12px; color:#d35400; font-weight:bold; display:block; margin-top:8px; cursor:pointer;"><input type="checkbox" ${item.masukWaitingList ? 'checked' : ''} onchange="ubahStatusWaitingList(${index}, this.checked)"> Masuk Waiting List (KDS)</label>` : '';
        cartItems.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:15px; align-items:center;"><div style="flex:2; padding-right:10px;"><strong style="font-size: 15px; color:#333;">${item.name}</strong><br><small style="color:#666; font-size: 13px;">Rp ${item.price.toLocaleString('id-ID')}</small>${cbDapur}</div><div style="flex:1; display:flex; gap:5px; align-items:center; justify-content:center;"><button onclick="updateQty(${index}, -1)">-</button><input type="number" value="${item.qty}" min="1" onchange="setQty(${index}, this.value)" style="width:45px; text-align:center;"><button onclick="updateQty(${index}, 1)">+</button></div><div style="flex:1; text-align:right;"><div style="font-weight:bold;">Rp ${subtotal.toLocaleString('id-ID')}</div><button onclick="updateQty(${index}, -${item.qty})" class="btn-danger">Hapus</button></div></div>`;
    });
    totalTagihanGlobal = total; document.getElementById('total-price').innerText = total.toLocaleString('id-ID');
}

async function prosesTransaksi(statusPembayaran, metodeBayar = 'Hold', dariTombolBookingHold = false) {
    if (cart.length === 0) return;
    const custName = document.getElementById('customer-name').value.trim();
    let bDate = new Date().toISOString().split('T')[0]; let bBranch = null; let bWa = null;
    if (isBookingMode || dariTombolBookingHold) {
        bDate = document.getElementById('book-date').value; bBranch = document.getElementById('book-branch').value; bWa = document.getElementById('book-wa').value;
    }
    try {
        const noNota = (bBranch ? 'BKG-' : 'INV-') + new Date().getTime();
        // INJEKSI CABANG DI SINI
        const { data: trxData, error: trxErr } = await supabaseClient.from('transactions').insert([{ 
            receipt_no: noNota, total_amount: totalTagihanGlobal, status: statusPembayaran, 
            customer_name: custName, booking_date: bDate, pickup_branch: bBranch, 
            customer_wa: bWa, branch: myBranch 
        }]).select().single();
        
        if (trxErr) throw trxErr;
        let butuhKDS = false;
        for (const item of cart) {
            await supabaseClient.from('transaction_items').insert([{ transaction_id: trxData.id, product_id: item.id, qty: item.qty, price: item.price, subtotal: item.price * item.qty }]);
            if (bDate === new Date().toISOString().split('T')[0]) {
                if (statusPembayaran === 'paid') { await supabaseClient.from('products').update({ stock: item.stock - item.qty }).eq('id', item.id); }
                if (item.type === 'dadakan' && item.masukWaitingList) butuhKDS = true;
            }
        }
        if (butuhKDS) { await supabaseClient.from('kds_queue').insert([{ transaction_id: trxData.id, status: 'waiting', order_type: 'dadakan', branch: myBranch }]); }
        if (statusPembayaran === 'paid') { cetakStruk(noNota, custName, metodeBayar); }
        tampilkanSukses(statusPembayaran === 'paid' ? "Lunas!" : "Tersimpan!", `Cabang: ${myBranch}`);
    } catch (error) { console.error(error); alert("Gagal!"); }
}

function tutupModal(id) { document.getElementById(id).style.display = 'none'; }
fetchStoreSettings().then(() => { fetchProducts(); });