<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Arasa Store</title>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <style>
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f4f4f9; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 20px; }
        .login-box { background: white; padding: 40px 30px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); text-align: center; width: 100%; max-width: 380px; }
        .login-box h2 { margin: 0 0 5px 0; font-size: 26px; color: #222; letter-spacing: 1px; }
        .login-box p { color: #666; font-size: 14px; margin-bottom: 30px; }
        input { width: 100%; padding: 15px; margin-bottom: 20px; border: 2px solid #eaeaea; border-radius: 8px; font-size: 24px; text-align: center; letter-spacing: 8px; font-weight: bold; transition: 0.3s; outline: none; color: #333; }
        input:focus { border-color: #007bff; box-shadow: 0 0 8px rgba(0,123,255,0.2); }
        button { width: 100%; padding: 16px; background: #007bff; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 16px; transition: 0.2s; }
        button:hover { background: #0056b3; transform: translateY(-2px); }
        button:active { transform: translateY(0); }
    </style>
</head>
<body>
    <div class="login-box">
        <h2>ARASA STORE</h2>
        <p>Masukkan PIN Keamanan</p>
        <input type="password" id="pin-input" placeholder="****" maxlength="6">
        <button onclick="prosesLogin()">Masuk ke Sistem</button>
    </div>

    <script>
        const supabaseClient = supabase.createClient('https://xlfbiavdodyxnmgnsvls.supabase.co', 'sb_publishable_wAvlgdaWcmevkDxOSTALwQ_wpUP5byQ');

        async function prosesLogin() {
            const pin = document.getElementById('pin-input').value;
            const { data, error } = await supabaseClient.from('users').select('*').eq('pin', pin).single();

            if (data) {
                localStorage.setItem('userName', data.name);
                localStorage.setItem('userRole', data.role);
                localStorage.setItem('userBranch', data.branch || 'Pusat');
                localStorage.setItem('loginTime', Date.now().toString()); // Gembok 15 Jam
                
                if (data.role === 'admin_pusat' || data.role === 'admin_cabang' || data.role === 'admin') {
                    window.location.href = 'admin.html';
                } else if (data.role === 'produksi') {
                    window.location.href = 'produksi.html';
                } else {
                    window.location.href = 'index.html'; 
                }
            } else {
                alert("PIN Salah atau Akun Tidak Ditemukan!");
            }
        }
        
        // Bisa tekan Enter untuk login
        document.getElementById('pin-input').addEventListener('keypress', function (e) {
            if (e.key === 'Enter') prosesLogin();
        });
    </script>
</body>
</html>
