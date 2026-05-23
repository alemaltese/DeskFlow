document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) { window.location.href = '/login.html'; return; }
        const currentUser = await res.json();

        if (currentUser.role !== 'admin') { window.location.href = '/dashboard.html'; return; }

        if (window.renderSidebarProfile) renderSidebarProfile(currentUser);
        await loadUsers();
    } catch (err) {
        console.error(err);
    }

    document.getElementById('btnNewUser').addEventListener('click', () => {
        document.getElementById('newUserForm').reset();
        document.getElementById('newUserModal').classList.remove('hidden');
    });
    document.getElementById('btnCancelNew').addEventListener('click', () => {
        document.getElementById('newUserModal').classList.add('hidden');
    });

    document.getElementById('newUserForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    first_name: document.getElementById('new_first_name').value,
                    last_name:  document.getElementById('new_last_name').value,
                    email:      document.getElementById('new_email').value,
                    role:       document.getElementById('new_role').value,
                    password:   document.getElementById('new_password').value,
                })
            });
            if (res.ok) {
                if (window.showToast) showToast('Utente creato con successo');
                document.getElementById('newUserModal').classList.add('hidden');
                await loadUsers();
            } else {
                const data = await res.json();
                if (window.showToast) showToast(data.error || 'Errore', 'error');
            }
        } catch {
            if (window.showToast) showToast('Errore di rete', 'error');
        }
    });

    document.getElementById('btnCancelEdit').addEventListener('click', () => {
        document.getElementById('editUserModal').classList.add('hidden');
    });

    document.getElementById('editUserForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit_id').value;
        const password = document.getElementById('edit_password').value;
        try {
            const res = await fetch(`/api/admin/users/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    first_name: document.getElementById('edit_first_name').value,
                    last_name:  document.getElementById('edit_last_name').value,
                    email:      document.getElementById('edit_email').value,
                    role:       document.getElementById('edit_role').value,
                    password:   password || undefined
                })
            });
            if (res.ok) {
                if (window.showToast) showToast('Utente aggiornato con successo');
                document.getElementById('editUserModal').classList.add('hidden');
                await loadUsers();
            } else {
                const data = await res.json();
                if (window.showToast) showToast(data.error || 'Errore', 'error');
            }
        } catch {
            if (window.showToast) showToast('Errore di rete', 'error');
        }
    });
});

let allUsers = [];

const roleBadgeClass = { admin: 'role-admin', operatore: 'role-operator', utente: 'role-user' };
const roleLabel      = { admin: 'Admin', operatore: 'Operatore', utente: 'Utente' };

async function loadUsers() {
    try {
        const res = await fetch('/api/admin/users');
        allUsers = await res.json();
        const tbody = document.querySelector('#usersTable tbody');
        tbody.innerHTML = '';
        allUsers.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="mono">#${u.id}</td>
                <td><strong>${u.first_name} ${u.last_name}</strong></td>
                <td>${u.email}</td>
                <td><span class="badge ${roleBadgeClass[u.role] ?? 'neutral'}">${roleLabel[u.role] ?? u.role}</span></td>
                <td class="text-muted" style="font-size:0.875rem;">${new Date(u.created_at).toLocaleDateString('it-IT')}</td>
                <td><button class="btn btn-secondary" style="padding:.25rem .5rem;" onclick="openEdit(${u.id})"><i class="fa-solid fa-pen"></i> Modifica</button></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
    }
}

window.openEdit = function(id) {
    const u = allUsers.find(x => x.id === id);
    if (!u) return;

    document.getElementById('edit_id').value         = u.id;
    document.getElementById('edit_first_name').value = u.first_name;
    document.getElementById('edit_last_name').value  = u.last_name;
    document.getElementById('edit_email').value      = u.email;
    document.getElementById('edit_role').value       = u.role;
    document.getElementById('edit_password').value   = '';

    const isAdmin = u.role === 'admin';
    ['edit_first_name','edit_last_name','edit_email','edit_role','edit_password'].forEach(id => {
        document.getElementById(id).disabled = isAdmin;
    });
    const btn = document.querySelector('#editUserForm button[type="submit"]');
    btn.disabled = isAdmin;
    btn.textContent = isAdmin ? 'Modifica non consentita' : 'Salva';

    document.getElementById('editUserModal').classList.remove('hidden');
};
