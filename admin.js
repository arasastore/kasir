// ================= SISTEM POPUP GLOBAL =================
function tampilkanAlert(pesan) {
    document.getElementById('alertMessage').innerText = pesan;
    document.getElementById('customAlert').style.display = 'flex';
}
function tutupAlert() { document.getElementById('customAlert').style.display = 'none'; }

let confirmCallback = null;
function tampilkanConfirm(pesan, callback) {
    document.getElementById('confirmMessage').innerText = pesan;
    document.getElementById('customConfirm').style.display = 'flex';
    confirmCallback = callback;
}
function tutupConfirm() { document.getElementById('customConfirm').style.display = 'none'; }

const btnYes = document.getElementById('btnConfirmYes');
if(btnYes) {
    btnYes.addEventListener('click', () => {
        tutupConfirm();
        if (confirmCallback) confirmCallback();
    });
}

// ================= INISIALISASI & KEAMANAN =================
if (localStorage.getItem('userRole') !== 'admin') {
    alert("Akses Ditolak! Anda bukan Admin.");
    window.location.href = 'login.html';
}
function logout() { localStorage.clear(); window.location.href = 'login.html'; }

const { createClient } = supabase;
const supabaseUrl = 'https://xlfbiavdodyxnmgnsvls.supabase.co';
const supabaseKey = 'sb_publishable_wAvlgdaWcmevkDxOSTALwQ_wpUP5byQ'; 
const supabaseClient = createClient(supabaseUrl, supabaseKey);

// ================= GLOBAL VARIABLES =================
let chartInstansi = null;
let currentOmzetData = [];
let currentTipeOmzet = '';
let dataMenuAsli = [];
let idTransaksiDihapus = null;
let idAkunDiedit = null; 

// ================= AUTO LOAD DETEKTOR HALAMAN =================
window.onload = () => {
    if (document.getElementById('page-dashboard')) loadOmzet();
    if (document.getElementById('page-menu')) loadMenuAdmin();
    if (document.getElementById('page-akun')) loadUsers();
};

// ================= LOGIKA HALAMAN DASHBOARD =================
async function loadOmzet() {
    try {
        const { data, error } = await supabaseClient.from('transactions').select('total_amount, created_at');
        if (error) throw error;
        const now = new Date(); const today = now.toISOString().split('T')[0];
        let harian = 0, mingguan = 0, bulanan = 0;
        data.forEach(trx => {
            const trxDate = new Date(trx.created_at);
            const diffDays = Math.ceil(Math.abs(now - trxDate) / (1000 * 60 * 60 * 24));
            if (trxDate.toISOString().split('T')[0] === today) harian += trx.total_amount;
            if (diffDays <= 7) mingguan += trx.total_amount;
            if (diffDays <= 30) bulanan += trx.total_amount;
        });
        document.getElementById('omzet-harian').innerText = `Rp ${harian.toLocaleString('id-ID')}`;
        document.getElementById('omzet-mingguan').innerText = `Rp ${mingguan.toLocaleString('id-ID')}`;
        document.getElementById('omzet-bulanan').innerText = `Rp ${bulanan.toLocaleString('id-ID')}`;
    } catch (e) { console.error(e); }
}

window.tambahPengeluaran = async function() {
    const ket = document.getElementById('ketPengeluaran').value;
    const nominal = document.getElementById('nomPengeluaran').value;
    if (!ket || !nominal) return tampilkanAlert('Lengkapi data pengeluaran!');
    const { error } = await supabaseClient.from('expenses').insert([{ keterangan: ket, nominal: nominal }]);
    if (error) tampilkanAlert('Gagal mencatat pengeluaran! Pastikan tabel expenses sudah dibuat di Supabase.');
    else { tampilkanAlert('Pengeluaran dicatat!'); document.getElementById('ketPengeluaran').value = ''; document.getElementById('nomPengeluaran').value = ''; }
}

window.bukaHalamanOmzet = async function(tipe) {
    currentTipeOmzet = tipe;
    document.getElementById('halamanUtama').style.display = 'none';
    document.getElementById('halamanOmzet').style.display = 'block';
    document.getElementById('judulHalamanOmzet').innerText = `Laporan Performa ${tipe.toUpperCase()}`;
    
    const { data: trxData } = await supabaseClient.from('transactions').select(`*, transaction_items (qty, products ( name ))`).order('created_at', { ascending: false });
    const { data: expData } = await supabaseClient.from('expenses').select('*');
    const now = new Date(); const today = now.toISOString().split('T')[0];
    
    let totalOmzet = 0, totalPengeluaran = 0;
    let filteredTrx = trxData.filter(trx => {
        const trxDate = new Date(trx.created_at);
        const diffDays = Math.ceil(Math.abs(now - trxDate) / (1000 * 60 * 60 * 24));
        let masukFilter = (tipe === 'harian' && trxDate.toISOString().split('T')[0] === today) || (tipe === 'mingguan' && diffDays <= 7) || (tipe === 'bulanan' && diffDays <= 30);
        if (masukFilter) totalOmzet += trx.total_amount;
        return masukFilter;
    });

    if (expData) {
        expData.forEach(exp => {
            const expDate = new Date(exp.created_at);
            const diffDays = Math.ceil(Math.abs(now - expDate) / (1000 * 60 * 60 * 24));
            if ((tipe === 'harian' && expDate.toISOString().split('T')[0] === today) || (tipe === 'mingguan' && diffDays <= 7) || (tipe === 'bulanan' && diffDays <= 30)) {
                totalPengeluaran += Number(exp.nominal);
            }
        });
    }

    document.getElementById('detail-total-omzet').innerText = `Rp ${totalOmzet.toLocaleString('id-ID')}`;
    document.getElementById('detail-total-pengeluaran').innerText = `Rp ${totalPengeluaran.toLocaleString('id-ID')}`;
    document.getElementById('detail-kas-bersih').innerText = `Rp ${(totalOmzet - totalPengeluaran).toLocaleString('id-ID')}`;
    currentOmzetData = filteredTrx; 
    
    const tbody = document.getElementById('tabelDetailOmzet'); tbody.innerHTML = '';
    const labelGrafik = [], dataGrafik = []; let chartMap = {};

    filteredTrx.forEach(trx => {
        const dateObj = new Date(trx.created_at);
        let listPesanan = trx.transaction_items ? trx.transaction_items.map(item => `• ${item.qty}x ${item.products ? item.products.name : 'Item Terhapus'}`).join('<br>') : '-';
        let keyGrafik = (tipe === 'harian') ? `${dateObj.getHours()}:00` : dateObj.toLocaleDateString('id-ID'); 
        if (!chartMap[keyGrafik]) chartMap[keyGrafik] = 0; chartMap[keyGrafik] += trx.total_amount;
        
        // REVISI: Menampilkan trx.receipt_no alih-alih trx.id untuk tampilan, tapi trx.id tetap dipakai untuk fungsi Hapus
        let noNotaTampil = trx.receipt_no ? trx.receipt_no : '-';
        tbody.innerHTML += `<tr><td>${dateObj.toLocaleDateString('id-ID')} ${dateObj.toLocaleTimeString('id-ID')}</td><td style="font-family:monospace;font-size:13px; font-weight:bold; color:#007bff;">${noNotaTampil}</td><td style="font-size:13px;">${listPesanan}</td><td><strong>Rp ${trx.total_amount.toLocaleString('id-ID')}</strong></td><td><button onclick="mintaPinHapusTrx('${trx.id}')" class="btn btn-danger">Hapus</button></td></tr>`;
    });

    const sortedKeys = Object.keys(chartMap).sort((a,b) => (tipe==='harian') ? parseInt(a)-parseInt(b) : new Date(a.split('/').reverse().join('-')) - new Date(b.split('/').reverse().join('-')));
    sortedKeys.forEach(key => { labelGrafik.push(key); dataGrafik.push(chartMap[key]); });
    renderGrafik(labelGrafik, dataGrafik);
}

window.tutupHalamanOmzet = function() {
    document.getElementById('halamanOmzet').style.display = 'none';
    document.getElementById('halamanUtama').style.display = 'block';
    loadOmzet(); 
}

function renderGrafik(labels, data) {
    const ctx = document.getElementById('grafikOmzet').getContext('2d');
    if (chartInstansi) chartInstansi.destroy(); 
    chartInstansi = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [{ label: 'Omzet (Rp)', data: data, borderColor: '#28a745', backgroundColor: 'rgba(40, 167, 69, 0.1)', borderWidth: 2, fill: true, tension: 0.3 }]}, options: { responsive: true, maintainAspectRatio: false }});
}

window.mintaPinHapusTrx = function(idTrx) {
    idTransaksiDihapus = idTrx;
    document.getElementById('pinInputHapusTrx').value = '';
    document.getElementById('pinModalHapusTrx').style.display = 'flex';
}

window.eksekusiHapusTrx = async function() {
    const pinInput = document.getElementById('pinInputHapusTrx').value;
    const { data: userData } = await supabaseClient.from('users').select('*').eq('pin', pinInput);
    if (!userData || userData.length === 0 || userData[0].role !== 'admin') return tampilkanAlert('PIN Salah atau Anda bukan Admin!');

    try {
        const { data: items } = await supabaseClient.from('transaction_items').select('*, products(type, stock)').eq('transaction_id', idTransaksiDihapus);
        if (items) { for (let item of items) { if (item.products && item.products.type === 'ready') await supabaseClient.from('products').update({ stock: item.products.stock + item.qty }).eq('id', item.product_id); } }
        await supabaseClient.from('kds_queue').delete().eq('transaction_id', idTransaksiDihapus);
        await supabaseClient.from('transaction_items').delete().eq('transaction_id', idTransaksiDihapus);
        await supabaseClient.from('transactions').delete().eq('id', idTransaksiDihapus);
        document.getElementById('pinModalHapusTrx').style.display = 'none';
        tampilkanAlert('Transaksi dibatalkan. Stok dikembalikan!');
        bukaHalamanOmzet(currentTipeOmzet); 
    } catch (err) { document.getElementById('pinModalHapusTrx').style.display = 'none'; tampilkanAlert('Gagal Menghapus: ' + err.message); }
}

window.downloadLaporanCSV = function() {
    if (currentOmzetData.length === 0) return tampilkanAlert('Tidak ada data diunduh.');
    let csvContent = "data:text/csv;charset=utf-8,ID Transaksi,Waktu,Total (Rp)\n";
    currentOmzetData.forEach(row => { 
        let noNota = row.receipt_no ? row.receipt_no : row.id;
        csvContent += `${noNota},"${new Date(row.created_at).toLocaleString('id-ID')}",${row.total_amount}\n`; 
    });
    const link = document.createElement("a"); link.href = encodeURI(csvContent); link.download = `Laporan_Omzet_${currentTipeOmzet}.csv`; link.click();
}

// ================= LOGIKA HALAMAN MENU =================
const btnAddMenu = document.getElementById('btn-add-menu');
if(btnAddMenu) {
    btnAddMenu.addEventListener('click', async () => {
        const name = document.getElementById('new-name').value;
        const price = document.getElementById('new-price').value;
        const type = document.getElementById('new-type').value;
        const stock = document.getElementById('new-stock').value;
        if (!name || !price) return tampilkanAlert("Nama dan Harga wajib diisi!");
        try {
            const { error } = await supabaseClient.from('products').insert([{ name: name, price: Number(price), type: type, stock: Number(stock) }]);
            if (error) throw error;
            tampilkanAlert("Menu berhasil ditambahkan!");
            document.getElementById('new-name').value = ''; document.getElementById('new-price').value = ''; document.getElementById('new-stock').value = '0';
            loadMenuAdmin();
        } catch (error) { tampilkanAlert("Terjadi kesalahan sistem."); }
    });
}

async function loadMenuAdmin() {
    try {
        const { data, error } = await supabaseClient.from('products').select('*').order('name');
        if (error) throw error;
        dataMenuAsli = data; renderMenuTabel(data);
    } catch (error) { console.error("Gagal load menu:", error); }
}

function renderMenuTabel(data) {
    const tbody = document.getElementById('menu-list');
    tbody.innerHTML = '';
    if (data.length === 0) return tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Tidak ada data menu</td></tr>';
    data.forEach(p => {
        let formOpname = p.type === 'ready' ? `<input type="number" id="fisik-${p.id}" value="${p.stock}" style="width: 70px; padding: 5px; height: 35px; border: 1px solid #ccc; border-radius: 4px; text-align: center;"> <button class="btn btn-warning" onclick="syncStock('${p.id}', ${p.stock})">Perbarui</button>` : `<span style="color:#aaa;">- Dadakan -</span>`;
        tbody.innerHTML += `<tr><td><strong>${p.name}</strong><br><small>Rp ${p.price.toLocaleString('id-ID')}</small></td><td><span style="background:#eef; padding:3px 8px; border-radius:3px; font-size:12px;">${p.type}</span></td><td>${p.type === 'ready' ? p.stock : '-'}</td><td><div style="display:flex; gap:5px; align-items:center;">${formOpname}</div></td><td><button class="btn btn-danger" onclick="hapusMenu('${p.id}', '${p.name}')">Hapus</button></td></tr>`;
    });
}

window.filterMenuTabel = function() {
    const keyword = document.getElementById('searchMenuFilter').value.toLowerCase();
    const filtered = dataMenuAsli.filter(p => p.name.toLowerCase().includes(keyword));
    renderMenuTabel(filtered);
}

window.syncStock = function(productId, currentSystemStock) {
    const fisikInput = document.getElementById(`fisik-${productId}`).value;
    if (fisikInput === '') return tampilkanAlert("Masukkan jumlah stok fisik!");
    const physicalStock = Number(fisikInput);
    if (physicalStock - currentSystemStock === 0) return tampilkanAlert("Stok sudah sama.");
    tampilkanConfirm(`Sistem: ${currentSystemStock} | Fisik: ${physicalStock} \nLanjutkan penyesuaian?`, async () => {
        try {
            await supabaseClient.from('products').update({ stock: physicalStock }).eq('id', productId);
            await supabaseClient.from('stock_logs').insert([{ product_id: productId, change_qty: physicalStock - currentSystemStock, reason: 'opname_adjustment' }]);
            tampilkanAlert("Stok berhasil disesuaikan!"); loadMenuAdmin(); 
        } catch (error) { tampilkanAlert("Gagal menyesuaikan stok."); }
    });
}

window.hapusMenu = function(id, name) {
    tampilkanConfirm(`Yakin ingin MENGHAPUS menu "${name}" secara permanen?`, async () => {
        try {
            const { error } = await supabaseClient.from('products').delete().eq('id', id);
            if (error) throw error;
            tampilkanAlert(`Menu ${name} berhasil dihapus!`); loadMenuAdmin();
        } catch (err) { tampilkanAlert(`Gagal menghapus! Kemungkinan menu ini masih terikat di data riwayat transaksi lama.`); }
    });
}

// ================= LOGIKA HALAMAN AKUN =================
window.tambahAkun = async function() {
    const nama = document.getElementById('new-user-name').value;
    const pin = document.getElementById('new-user-pin').value;
    const role = document.getElementById('new-user-role').value;
    if (!nama || pin.length !== 6) return tampilkanAlert('Nama wajib diisi dan PIN harus 6 digit!');
    const { data: checkPin } = await supabaseClient.from('users').select('id').eq('pin', pin);
    if (checkPin && checkPin.length > 0) return tampilkanAlert('PIN sudah digunakan! Ganti PIN lain.');
    const { error } = await supabaseClient.from('users').insert([{ name: nama, pin: pin, role: role }]);
    if (error) tampilkanAlert('Gagal tambah akun! Pastikan RLS Users Disabled.');
    else { tampilkanAlert('Akun berhasil dibuat!'); document.getElementById('new-user-name').value = ''; document.getElementById('new-user-pin').value = ''; loadUsers(); }
}

async function loadUsers() {
    try {
        const { data, error } = await supabaseClient.from('users').select('*').order('role');
        if (error) throw error;
        const tbody = document.getElementById('user-list'); tbody.innerHTML = '';
        data.forEach(u => {
            let roleBadge = u.role === 'admin' ? '#dc3545' : (u.role === 'kasir' ? '#28a745' : '#ffc107');
            tbody.innerHTML += `<tr><td><strong>${u.name}</strong></td><td><span style="background:${roleBadge}; color:white; padding:3px 8px; border-radius:3px; font-size:12px;">${u.role.toUpperCase()}</span></td><td><div style="display:flex; gap:5px;"><button class="btn btn-primary" onclick="bukaModalEditPin('${u.id}', '${u.name}')">Edit PIN</button> <button class="btn btn-danger" onclick="hapusAkun('${u.id}', '${u.name}')">Hapus</button></div></td></tr>`;
        });
    } catch (error) { console.error("Gagal load user:", error); }
}

window.bukaModalEditPin = function(id, name) {
    idAkunDiedit = id;
    document.getElementById('teksNamaEditPin').innerText = `Masukkan PIN Baru untuk: ${name}`;
    document.getElementById('inputPinBaru').value = '';
    document.getElementById('modalEditPin').style.display = 'flex';
}

window.simpanPinBaru = async function() {
    const pinBaru = document.getElementById('inputPinBaru').value;
    if (pinBaru.length !== 6) return tampilkanAlert('PIN Baru harus tepat 6 digit angka!');
    const { data: checkPin } = await supabaseClient.from('users').select('id').eq('pin', pinBaru);
    if (checkPin && checkPin.length > 0) return tampilkanAlert('PIN ini sudah terpakai! Gunakan angka lain.');
    try {
        const { error } = await supabaseClient.from('users').update({ pin: pinBaru }).eq('id', idAkunDiedit);
        if (error) throw error;
        document.getElementById('modalEditPin').style.display = 'none';
        tampilkanAlert('PIN berhasil diubah!'); loadUsers();
    } catch (err) { tampilkanAlert('Gagal merubah PIN: ' + err.message); }
}

window.hapusAkun = function(id, name) {
    tampilkanConfirm(`Yakin ingin MENGHAPUS akun "${name}"?`, async () => {
        try {
            const { error } = await supabaseClient.from('users').delete().eq('id', id);
            if (error) throw error;
            tampilkanAlert(`Akun ${name} berhasil dihapus!`); loadUsers();
        } catch (err) { tampilkanAlert(`Gagal menghapus akun: ${err.message}`); }
    });
}