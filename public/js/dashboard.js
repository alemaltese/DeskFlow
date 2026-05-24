let currentUser = null;

// Escape HTML entities to prevent XSS when inserting user data into innerHTML
function esc(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) { window.location.href = '/login.html'; return; }
        currentUser = await res.json();

        if (window.renderSidebarProfile) renderSidebarProfile(currentUser);

        if (currentUser.role === 'admin') {
            document.getElementById('nav-analytics').classList.remove('hidden');
            document.getElementById('nav-users').classList.remove('hidden');
            document.getElementById('colCreator').classList.remove('hidden');
            document.getElementById('filterOperatorBlock').classList.remove('hidden');
            const adminStats = document.getElementById('adminStats');
            adminStats.classList.remove('hidden');
            adminStats.style.display = 'grid';
            loadOperatorsFilter();
            fetchStats();
        } else if (currentUser.role === 'operatore') {
            document.getElementById('nav-analytics').classList.remove('hidden');
            document.getElementById('colCreator').classList.remove('hidden');
            const opStats = document.getElementById('operatorStats');
            opStats.classList.remove('hidden');
            opStats.style.display = 'grid';
            fetchStats();
        } else {
            const uStats = document.getElementById('userStats');
            uStats.classList.remove('hidden');
            uStats.style.display = 'grid';
            fetchStats();
        }

        if (currentUser.role !== 'utente') {
            document.getElementById('btnNewTicket').classList.add('hidden');
        }

        fetchTickets();
    } catch (err) {
        console.error(err);
    }

    document.getElementById('btnApplyFilters').addEventListener('click', fetchTickets);

    const modal = document.getElementById('newTicketModal');
    document.getElementById('btnNewTicket').addEventListener('click', () => modal.classList.remove('hidden'));
    document.getElementById('btnCancelModal').addEventListener('click', () => modal.classList.add('hidden'));

    document.getElementById('newTicketForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('ntAttachments');
        if (fileInput.files.length > 3) { alert('È consentito un massimo di 3 file.'); return; }

        const formData = new FormData();
        formData.append('title',       document.getElementById('ntTitle').value);
        formData.append('category',    document.getElementById('ntCategory').value);
        formData.append('priority',    document.getElementById('ntPriority').value);
        formData.append('description', document.getElementById('ntDescription').value);
        for (const file of fileInput.files) formData.append('attachments', file);

        try {
            const res  = await fetch('/api/tickets', { method: 'POST', body: formData });
            const data = await res.json();
            if (res.ok) {
                modal.classList.add('hidden');
                document.getElementById('newTicketForm').reset();
                fetchTickets();
                if (currentUser.role === 'admin') fetchStats();
                if (window.showToast) showToast('Ticket creato con successo!');
            } else {
                if (window.showToast) showToast(data.error || 'Impossibile creare il ticket', 'error');
            }
        } catch {
            if (window.showToast) showToast('Errore di rete', 'error');
        }
    });
});

async function fetchTickets() {
    const status      = document.getElementById('filterStatus').value;
    const priority    = document.getElementById('filterPriority').value;
    const sort        = document.getElementById('filterSort').value;
    const category    = document.getElementById('filterCategory').value;
    const operator_id = document.getElementById('filterOperator').value;

    let url = `/api/tickets?sort=${encodeURIComponent(sort)}`;
    if (status)      url += `&status=${encodeURIComponent(status)}`;
    if (priority)    url += `&priority=${encodeURIComponent(priority)}`;
    if (category)    url += `&category=${encodeURIComponent(category)}`;
    if (operator_id === 'null') url += `&operator_id=null`;
    else if (operator_id)       url += `&operator_id=${encodeURIComponent(operator_id)}`;

    try {
        const tickets = await fetch(url).then(r => r.json());
        renderTickets(tickets);
    } catch {
        console.error('Impossibile caricare i ticket');
    }
}

let operatorsList = [];

function renderTickets(tickets) {
    const tbody = document.querySelector('#ticketsTable tbody');
    tbody.innerHTML = '';

    let emptyState = document.getElementById('mainEmptyState');
    if (!emptyState) {
        emptyState = document.createElement('div');
        emptyState.id = 'mainEmptyState';
        emptyState.className = 'empty-state hidden';
        emptyState.innerHTML = `<div class="empty-state-icon"><i class="fa-solid fa-check"></i></div><h3>Ottimo lavoro!</h3><p>Non hai nessun ticket in questa visualizzazione.</p>`;
        document.getElementById('ticketsTable').parentElement.appendChild(emptyState);
    }

    const hasTickets = tickets.length > 0;
    document.getElementById('ticketsTable').classList.toggle('hidden', !hasTickets);
    emptyState.classList.toggle('hidden', hasTickets);
    if (!hasTickets) return;

    tickets.forEach(t => {
        const tr = document.createElement('tr');
        const dateStr = t.created_at
            ? new Date(t.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—';
        const creatorCol = (currentUser.role === 'operatore' || currentUser.role === 'admin')
            ? `<td>${esc(t.creator_name)}</td>` : '';

        tr.innerHTML = `
            <td class="mono">#${esc(t.id)}</td>
            <td style="font-weight:500;">${esc(t.title)}</td>
            <td>${esc(t.category)}</td>
            <td><span class="badge priority-${esc(t.priority)}">${esc(t.priority)}</span></td>
            <td><span class="badge status-${esc(t.status)}">${esc(t.status).replace('_', ' ')}</span></td>
            ${creatorCol}
            <td>${esc(t.operator_name || 'Non assegnato')}</td>
            <td style="font-size:13px;color:var(--text-muted);white-space:nowrap;">${esc(dateStr)}</td>
            <td><a href="/ticket.html?id=${encodeURIComponent(t.id)}" class="btn btn-secondary" style="padding:.25rem .75rem;font-size:.875rem;">Visualizza</a></td>
        `;
        tbody.appendChild(tr);
    });
}

async function fetchStats() {
    try {
        const data   = await fetch('/api/analytics/summary').then(r => r.json());
        const prefix = { admin: 'stat', operatore: 'opStat', utente: 'uStat' }[currentUser.role];
        if (!prefix) return;
        [['Open','open'],['Progress','in_progress'],['Resolved','resolved'],['Closed','closed']].forEach(([s, k]) => {
            const el = document.getElementById(`${prefix}${s}`);
            if (el) el.textContent = data[k];
        });
    } catch (err) {
        console.error(err);
    }
}

async function loadOperatorsFilter() {
    try {
        const res = await fetch('/api/admin/operators');
        if (!res.ok) return;
        operatorsList = await res.json();
        const select  = document.getElementById('filterOperator');
        operatorsList.forEach(op => {
            const opt = document.createElement('option');
            opt.value       = op.id;
            opt.textContent = op.username; // textContent is safe
            select.appendChild(opt);
        });
        loadUnassignedTickets();
    } catch (err) {
        console.error(err);
    }
}

async function loadUnassignedTickets() {
    try {
        const tickets = await fetch('/api/tickets?operator_id=null').then(r => r.json());
        const block   = document.getElementById('unassignedTicketsBlock');
        if (tickets.length === 0) { block.classList.add('hidden'); return; }
        block.classList.remove('hidden');

        const tbody = document.querySelector('#unassignedTable tbody');
        tbody.innerHTML = '';
        tickets.forEach(t => {
            const opOptions = [
                '<option value="">Assegna...</option>',
                ...operatorsList.map(op => {
                    const opt = document.createElement('option');
                    opt.value       = op.id;
                    opt.textContent = op.username;
                    return opt.outerHTML;
                })
            ].join('');

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="mono">#${esc(t.id)}</td>
                <td style="font-weight:500;">${esc(t.title)}</td>
                <td><span class="badge priority-${esc(t.priority)}">${esc(t.priority)}</span></td>
                <td>${esc(t.creator_name)}</td>
                <td><select id="quickAssign_${esc(t.id)}" class="form-control" style="padding:.25rem .5rem;">${opOptions}</select></td>
                <td><button class="btn btn-primary assign-btn" style="padding:.25rem .75rem;font-size:.875rem;">Ok</button></td>
            `;
            // Use addEventListener instead of inline onclick to support Content Security Policy
            tr.querySelector('.assign-btn').addEventListener('click', () => quickAssign(t.id));
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
    }
}

window.quickAssign = async function(ticketId) {
    const select = document.getElementById(`quickAssign_${ticketId}`);
    if (!select?.value) return;
    try {
        const res = await fetch(`/api/admin/tickets/${ticketId}/reassign`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operator_id: select.value })
        });
        if (res.ok) {
            if (window.showToast) showToast('Ticket assegnato con successo!');
            loadUnassignedTickets();
            fetchTickets();
            fetchStats();
        } else {
            if (window.showToast) showToast("Errore durante l'assegnazione", 'error');
        }
    } catch {
        if (window.showToast) showToast('Errore di rete', 'error');
    }
};
