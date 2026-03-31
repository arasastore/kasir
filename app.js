const { createClient } = supabase;
const supabaseClient = createClient('https://xlfbiavdodyxnmgnsvls.supabase.co', 'sb_publishable_wAvlgdaWcmevkDxOSTALwQ_wpUP5byQ');

// ================= PENGATURAN IDENTITAS & PROTEKSI 15 JAM =================
const myRole = localStorage.getItem('userRole');
const myBranch = localStorage.getItem('userBranch') || 'Pusat';
const myName = localStorage.getItem('userName') || 'Admin';
const loginTime = localStorage.getItem('loginTime');

// Batas maksimal login = 15 Jam (15 * 60 menit * 60 detik * 1000 milidetik)
const MAX_SESSION_MS = 15 * 60 * 60 * 1000; 

if (!myRole || !loginTime || (Date.now() - parseInt(loginTime)) > MAX_SESSION_MS) {
    alert("Sesi login Anda telah habis atau tidak valid. Silakan login kembali untuk keamanan.");
    localStorage.clear();
    window.location.href = 'login.html';
}

// Tampilkan nama di Header Kasir (Hanya jika elemennya ada)
const elKasirInfo = document.getElementById('txt-kasir-info');
if (elKasirInfo) {
    elKasirInfo.innerText = `Kasir: ${myName} | Cabang: Arasa ${myBranch}`;
}

// Fungsi Logout Manual
function logoutKasir() {
    if(confirm("Yakin ingin mengakhiri shift dan Logout?")) {
        localStorage.clear();
        window.location.href = 'login.html';
    }
}
// ==========================================================================

let productsData = [];
let cart = [];
let totalTagihanGlobal = 0;
let isBookingMode = false;
let tempSelectedProduct = null;

let storeConfig = {
    store_name: 'ARASA STORE',
    store_address: 'Pusat Oleh-Oleh',
    footer_message: 'Terima Kasih Atas Kunjungan Anda!',
    paper_size: '58mm',
    logo_base64: ''
};

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

// Konverter Pack/Pcs Pintar
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
        cartItems.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:15px; align-items:center;"><div style="flex:2; padding-right:10px;"><strong style="font-size: 15px; color:#333;">${item.name}</strong><br><small style="color:#666; font-size: 13px;">Rp ${item.price.toLocaleString('id-ID')}</small>${cbDapur}</div><div style="flex:1; display:flex; gap:5px; align-items:center; justify-content:center;"><button onclick="updateQty(${index}, -1)" style="width:30px; height:30px; padding:0; background:#e0e0e0; border-radius:4px; font-weight:bold; border:none; cursor:pointer;">-</button><input type="number" value="${item.qty}" min="1" onchange="setQty(${index}, this.value)" style="width:45px; height:30px; text-align:center; font-weight:bold; border:1px solid #ccc; border-radius:4px;"><button onclick="updateQty(${index}, 1)" style="width:30px; height:30px; padding:0; background:#e0e0e0; border-radius:4px; font-weight:bold; border:none; cursor:pointer;">+</button></div><div style="flex:1; text-align:right;"><div style="font-weight:bold; font-size:14px; margin-bottom:8px; color:#222;">Rp ${subtotal.toLocaleString('id-ID')}</div><button onclick="updateQty(${index}, -${item.qty})" style="background:#dc3545; color:white; padding:5px 10px; font-size:12px; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Hapus</button></div></div>`;
    });
    totalTagihanGlobal = total; document.getElementById('total-price').innerText = total.toLocaleString('id-ID');
    const nmInput = document.getElementById('customer-name');
    if (adaDadakan || isBookingMode) { nmInput.disabled = false; nmInput.style.background = 'white'; nmInput.placeholder = "👤 Nama Pelanggan (Wajib)"; } 
    else { nmInput.disabled = true; nmInput.style.background = '#eee'; nmInput.value = ''; nmInput.placeholder = "👤 Nama Pelanggan (Tidak Perlu)"; }
}

// ================= MODAL & PEMBAYARAN =================
function tutupModal(id) { document.getElementById(id).style.display = 'none'; }
function bukaModalBooking() {
    if (cart.length === 0) return alert("Keranjang kosong!");
    if (!document.getElementById('customer-name').value.trim()) { document.getElementById('customer-name').disabled = false; document.getElementById('customer-name').style.background = 'white'; return alert("Nama pelanggan WAJIB diisi untuk Booking!"); }
    isBookingMode = true; document.getElementById('book-total').innerText = totalTagihanGlobal.toLocaleString('id-ID');
    let besok = new Date(); besok.setDate(besok.getDate() + 1); document.getElementById('book-date').value = besok.toISOString().split('T')[0];
    document.getElementById('modalBooking').style.display = 'flex';
}
function lanjutBayarBooking() { tutupModal('modalBooking'); bukaModalTipeBayar(); }
function bukaModalTipeBayar() {
    if (cart.length === 0) return alert("Keranjang kosong!");
    if (!document.getElementById('customer-name').disabled && !document.getElementById('customer-name').value.trim()) return alert("Nama pelanggan Wajib diisi!");
    document.getElementById('teks-total-modal').innerText = `Rp ${totalTagihanGlobal.toLocaleString('id-ID')}`; document.getElementById('modalTipeBayar').style.display = 'flex';
}
function bukaModalCash() {
    tutupModal('modalTipeBayar'); document.getElementById('teks-total-cash').innerText = `Rp ${totalTagihanGlobal.toLocaleString('id-ID')}`;
    document.getElementById('input-uang-pas').value = ''; document.getElementById('teks-kembalian').innerText = 'Kembalian: Rp 0';
    document.getElementById('btn-konfirm-cash').disabled = true; document.getElementById('modalCash').style.display = 'flex';
}
function hitungKembalian() {
    let uang = Number(document.getElementById('input-uang-pas').value); let sisa = uang - totalTagihanGlobal; let btn = document.getElementById('btn-konfirm-cash');
    if (uang >= totalTagihanGlobal) { document.getElementById('teks-kembalian').innerText = `Kembalian: Rp ${sisa.toLocaleString('id-ID')}`; document.getElementById('teks-kembalian').style.color = '#28a745'; btn.disabled = false; } 
    else { document.getElementById('teks-kembalian').innerText = `Uang Kurang!`; document.getElementById('teks-kembalian').style.color = 'red'; btn.disabled = true; }
}
function tampilkanSukses(judul, pesan) {
    tutupModal('modalTipeBayar'); tutupModal('modalCash');
    document.getElementById('judul-sukses').innerText = judul; document.getElementById('pesan-sukses').innerText = pesan; document.getElementById('modalSukses').style.display = 'flex';
}
function tutupSemuaDanReset() {
    tutupModal('modalSukses'); tutupModal('modalBooking'); tutupModal('modalInputQty'); isBookingMode = false; cart = []; 
    document.getElementById('customer-name').value = ''; document.getElementById('search-menu').value = ''; renderCart(); fetchProducts();
}

// ================= CETAK STRUK MULTI-CABANG =================
function cetakStruk(noNota, custName, tipeBayar, uangCash = 0) {
    const tgl = new Date().toLocaleString('id-ID');
    let logoHTML = storeConfig.logo_base64 ? `<img src="${storeConfig.logo_base64}" style="max-width: 80%; max-height: 80px; margin-bottom: 5px; display: block; margin-left: auto; margin-right: auto;">` : '';
    let alamatHTML = storeConfig.store_address.replace(/\n/g, '<br>'); let footerHTML = storeConfig.footer_message.replace(/\n/g, '<br>');
    
    let strukHTML = `
        <div style="width: ${storeConfig.paper_size}; margin: 0 auto; font-family: 'Courier New', Courier, monospace; font-size: 12px; color: black; padding: 5px;">
            <div style="text-align: center; margin-bottom: 10px;">
                ${logoHTML}
                <h2 style="margin: 0; font-size: 16px;">${storeConfig.store_name}</h2>
                <h3 style="margin: 2px 0; font-size: 13px; color: #333;">CABANG ${myBranch.toUpperCase()}</h3>
                <p style="margin: 0; font-size: 10px;">${alamatHTML}</p>
                <hr style="border-top: 1px dashed black; margin: 5px 0;">
            </div>
            <div style="margin-bottom: 10px;">
                <p style="margin: 2px 0;">Nota : ${noNota}</p>
                <p style="margin: 2px 0;">Kasir: <span style="font-size: 11px;">${myName}</span></p>
                <p style="margin: 2px 0;">Waktu: ${tgl}</p>
                <p style="margin: 2px 0;">Cust : ${custName || 'Umum'}</p>
                <hr style="border-top: 1px dashed black; margin: 5px 0;">
            </div>
            <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 12px;">`;

    cart.forEach(item => { strukHTML += `<tr><td colspan="3" style="padding-bottom: 2px;">${item.name}</td></tr><tr><td style="width: 20%; padding-bottom: 5px;">${item.qty}x</td><td style="width: 40%; padding-bottom: 5px;">${item.price.toLocaleString('id-ID')}</td><td style="width: 40%; text-align: right; padding-bottom: 5px;">${(item.price * item.qty).toLocaleString('id-ID')}</td></tr>`; });

    strukHTML += `
            </table>
            <hr style="border-top: 1px dashed black; margin: 5px 0;">
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px;"><span>TOTAL:</span><span>Rp ${totalTagihanGlobal.toLocaleString('id-ID')}</span></div>
            <div style="display: flex; justify-content: space-between; margin-top: 5px;"><span>Bayar (${tipeBayar}):</span><span>Rp ${tipeBayar === 'Cash' ? uangCash.toLocaleString('id-ID') : totalTagihanGlobal.toLocaleString('id-ID')}</span></div>`;
    
    if (tipeBayar === 'Cash') { strukHTML += `<div style="display: flex; justify-content: space-between;"><span>Kembali:</span><span>Rp ${(uangCash - totalTagihanGlobal).toLocaleString('id-ID')}</span></div>`; }
    
    strukHTML += `
            <hr style="border-top: 1px dashed black; margin: 10px 0;">
            <div style="text-align: center;"><p style="margin: 0; font-size: 11px;">${footerHTML}</p></div>
        </div>`;

    const printArea = document.getElementById('print-area'); printArea.innerHTML = strukHTML; printArea.style.display = 'block'; window.print(); printArea.style.display = 'none'; 
}

// ================= DATABASE INJECTION =================
async function prosesTransaksi(statusPembayaran, metodeBayar = 'Hold', dariTombolBookingHold = false) {
    if (cart.length === 0) return;
    const custName = document.getElementById('customer-name').value.trim();
    let bDate = new Date().toISOString().split('T')[0]; let bBranch = null; let bWa = null;
    if (isBookingMode || dariTombolBookingHold) { bDate = document.getElementById('book-date').value; bBranch = document.getElementById('book-branch').value; bWa = document.getElementById('book-wa').value; if(!bDate || !bBranch || !bWa) return alert("Lengkapi data!"); }
    try {
        const noNota = (bBranch ? 'BKG-' : 'INV-') + new Date().getTime();
        const { data: trxData, error: trxErr } = await supabaseClient.from('transactions').insert([{ receipt_no: noNota, total_amount: totalTagihanGlobal, status: statusPembayaran, customer_name: custName, booking_date: bDate, pickup_branch: bBranch, customer_wa: bWa, branch: myBranch }]).select().single();
        if (trxErr) throw trxErr;

        let butuhKDS = false;
        for (const item of cart) {
            await supabaseClient.from('transaction_items').insert([{ transaction_id: trxData.id, product_id: item.id, qty: item.qty, price: item.price, subtotal: item.price * item.qty }]);
            if (bDate === new Date().toISOString().split('T')[0]) {
                if (statusPembayaran === 'paid') { await supabaseClient.from('products').update({ stock: item.stock - item.qty }).eq('id', item.id); await supabaseClient.from('stock_logs').insert([{ product_id: item.id, change_qty: -item.qty, reason: `sales_${myBranch}` }]); }
                if (item.type === 'dadakan' && item.masukWaitingList) butuhKDS = true;
            }
        }
        if (butuhKDS) { await supabaseClient.from('kds_queue').insert([{ transaction_id: trxData.id, status: 'waiting', order_type: 'dadakan', branch: myBranch }]); }

        let uangCust = 0; let pesan = `Nota: ${noNota}\nKasir: ${myName}\nMetode: ${metodeBayar}`;
        if(bBranch) pesan += `\n[BOOKING: ${bDate} | ${bBranch}]`;
        if(metodeBayar === 'Cash') { uangCust = Number(document.getElementById('input-uang-pas').value); pesan += `\nUang Diterima: Rp ${uangCust.toLocaleString('id-ID')}\nKembalian: Rp ${(uangCust - totalTagihanGlobal).toLocaleString('id-ID')}`; }

        if (statusPembayaran === 'paid') { cetakStruk(noNota, custName, metodeBayar, uangCust); }
        tampilkanSukses(statusPembayaran === 'paid' ? "Lunas!" : "Tersimpan!", pesan);
    } catch (error) { console.error(error); alert("Terjadi kesalahan sistem!"); }
}

fetchStoreSettings().then(() => { fetchProducts(); });
