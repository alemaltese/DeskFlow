document.addEventListener('DOMContentLoaded', () => {
    const loginForm    = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const errorMsg     = document.getElementById('errorMsg');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorMsg.textContent = '';
            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email:    document.getElementById('email').value,
                        password: document.getElementById('password').value
                    })
                });
                const data = await res.json();
                if (res.ok && data.success) window.location.href = data.redirect;
                else errorMsg.textContent = data.error || 'Accesso fallito.';
            } catch {
                errorMsg.textContent = 'Errore di rete. Riprova.';
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password         = document.getElementById('password').value;
            const confirm_password = document.getElementById('confirm_password').value;

            if (password !== confirm_password) {
                errorMsg.textContent = 'Le password non coincidono.';
                return;
            }

            try {
                const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        first_name:       document.getElementById('first_name').value,
                        last_name:        document.getElementById('last_name').value,
                        email:            document.getElementById('email').value,
                        password,
                        confirm_password
                    })
                });
                const data = await res.json();
                if (data.success) {
                    registerForm.style.display = 'none';
                    document.getElementById('successPanel').style.display = 'block';
                    let secs = 3;
                    const countEl = document.getElementById('countdown');
                    const iv = setInterval(() => {
                        secs--;
                        if (countEl) countEl.textContent = secs;
                        if (secs <= 0) { clearInterval(iv); window.location.href = '/login.html'; }
                    }, 1000);
                } else {
                    errorMsg.textContent = data.error;
                }
            } catch {
                errorMsg.textContent = 'Errore di connessione.';
            }
        });
    }

    document.querySelectorAll('.toggle-password').forEach(icon => {
        icon.addEventListener('click', function() {
            const input = this.previousElementSibling;
            const isPass = input.type === 'password';
            input.type = isPass ? 'text' : 'password';
            this.classList.toggle('fa-eye', !isPass);
            this.classList.toggle('fa-eye-slash', isPass);
        });
    });

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) btnLogout.addEventListener('click', e => { e.preventDefault(); window.logout(); });
});

window.logout = async function() {
    try {
        const res = await fetch('/api/auth/logout', { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.success) window.location.href = data.redirect;
    } catch (err) {
        console.error('Logout fallito', err);
    }
};

window.renderSidebarProfile = function(user) {
    const fullName = `${user.first_name} ${user.last_name}`;
    const initials = (user.first_name[0] + user.last_name[0]).toUpperCase();
    document.querySelectorAll('#userNameDisplay').forEach(el => el.textContent = fullName);
    document.querySelectorAll('#userRoleDisplay').forEach(el => el.textContent = user.role);
    document.querySelectorAll('#userAvatar').forEach(el => el.textContent = initials);
};
