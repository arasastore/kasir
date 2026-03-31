const { createClient } = supabase;

// ⚠️ WAJIB DIISI: Samakan URL dan Key dengan yang ada di app.js sebelumnya
const supabaseUrl = 'https://xlfbiavdodyxnmgnsvls.supabase.co';
const supabaseKey = 'sb_publishable_wAvlgdaWcmevkDxOSTALwQ_wpUP5byQ'

const supabaseClient = createClient(supabaseUrl, supabaseKey);

document.getElementById('btn-login').addEventListener('click', async () => {
    const pin = document.getElementById('pin-input').value;
    const errorMsg = document.getElementById('error-msg');

    if (pin.length !== 6) {
        errorMsg.innerText = "PIN harus 6 angka!";
        errorMsg.style.display = "block";
        return;
    }

    errorMsg.style.display = "none";
    document.getElementById('btn-login').innerText = "Mengecek..."; // Efek loading

    try {
        // Cek PIN ke tabel users di Supabase
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('pin', pin)
            .single(); // Ambil 1 data saja

        if (error || !data) {
            throw new Error("PIN Salah");
        }

        // Simpan sesi login ke Local Storage biar browser ingat siapa yang login
        localStorage.setItem('userRole', data.role);
        localStorage.setItem('userName', data.name);

        // Arahkan ke halaman sesuai Role
        if (data.role === 'admin') {
            window.location.href = 'admin.html';
        } else if (data.role === 'kasir') {
            window.location.href = 'index.html'; // Tadi kita buat kasir di index.html
        } else if (data.role === 'produksi') {
            window.location.href = 'produksi.html';
        }

    } catch (err) {
        document.getElementById('btn-login').innerText = "Masuk";
        errorMsg.innerText = "PIN Salah atau Tidak Ditemukan!";
        errorMsg.style.display = "block";
    }
});