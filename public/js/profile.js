let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) { window.location.href = '/login.html'; return; }
        currentUser = await res.json();

        if (window.renderSidebarProfile) renderSidebarProfile(currentUser);

        if (currentUser.role === 'operatore') {
            document.getElementById('nav-analytics').classList.remove('hidden');
        } else if (currentUser.role === 'admin') {
            document.getElementById('nav-analytics').classList.remove('hidden');
            document.getElementById('nav-users').classList.remove('hidden');
            ['prof_first_name', 'prof_last_name', 'prof_email', 'prof_password'].forEach(id => {
                document.getElementById(id).disabled = true;
            });
            const btn = document.querySelector('#profileForm button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Modifica riservata (Solo da DB)';
            btn.style.cssText = 'background:#94a3b8;cursor:not-allowed;';
        }

        document.getElementById('prof_first_name').value = currentUser.first_name;
        document.getElementById('prof_last_name').value = currentUser.last_name;
        document.getElementById('prof_email').value = currentUser.email;
    } catch (err) {
        console.error(err);
    }

    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const first_name = document.getElementById('prof_first_name').value;
        const last_name  = document.getElementById('prof_last_name').value;
        const email      = document.getElementById('prof_email').value;
        const password   = document.getElementById('prof_password').value;

        try {
            const res = await fetch('/api/auth/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ first_name, last_name, email, password: password || undefined })
            });
            if (res.ok) {
                if (window.showToast) showToast('Profilo aggiornato con successo');
                document.getElementById('prof_password').value = '';
                currentUser.first_name = first_name;
                currentUser.last_name = last_name;
                if (window.renderSidebarProfile) renderSidebarProfile(currentUser);
            } else {
                const data = await res.json();
                if (window.showToast) showToast(data.error || 'Impossibile aggiornare', 'error');
            }
        } catch {
            if (window.showToast) showToast('Errore di connessione', 'error');
        }
    });
});
