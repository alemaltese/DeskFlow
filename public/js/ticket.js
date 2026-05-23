let currentUser = null;
let currentTicketId = null;
let ticketData = null;

document.addEventListener('DOMContentLoaded', async () => {
    currentTicketId = new URLSearchParams(window.location.search).get('id');
    if (!currentTicketId) { window.location.href = '/dashboard.html'; return; }

    try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) { window.location.href = '/login.html'; return; }
        currentUser = await res.json();

        if (window.renderSidebarProfile) renderSidebarProfile(currentUser);

        if (currentUser.role === 'admin') {
            ['nav-analytics','nav-users','operatorControls','adminReassignBlock','internalNoteGroup'].forEach(id => {
                document.getElementById(id).classList.remove('hidden');
            });
            document.getElementById('adminReassignBlock').style.display = 'flex';
            loadOperatorsForReassign();
        } else if (currentUser.role === 'operatore') {
            ['nav-analytics','operatorControls','internalNoteGroup'].forEach(id => {
                document.getElementById(id).classList.remove('hidden');
            });
        } else {
            document.getElementById('userControls').classList.remove('hidden');
        }

        await fetchTicketDetails();
    } catch (err) {
        console.error(err);
    }

    document.getElementById('commentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = document.getElementById('commentContent').value;
        const isInternalEl = document.getElementById('isInternal');
        if (!content.trim()) return;

        try {
            const res = await fetch(`/api/tickets/${currentTicketId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, is_internal: isInternalEl ? isInternalEl.checked : false })
            });
            if (res.ok) {
                document.getElementById('commentContent').value = '';
                if (isInternalEl) isInternalEl.checked = false;
                if (window.showToast) showToast('Commento inviato con successo');
                await fetchTicketDetails();
            } else {
                const err = await res.json();
                if (window.showToast) showToast(err.error || 'Impossibile inviare il commento', 'error');
            }
        } catch {
            if (window.showToast) showToast('Errore di rete', 'error');
        }
    });

    document.getElementById('btnUpdateStatus')?.addEventListener('click', () => {
        updateStatus(document.getElementById('updateStatusSelect').value);
    });

    document.getElementById('btnReassign')?.addEventListener('click', async () => {
        const operatorId = document.getElementById('reassignSelect').value;
        if (!operatorId) return;
        try {
            const res = await fetch(`/api/admin/tickets/${currentTicketId}/reassign`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ operator_id: operatorId })
            });
            if (res.ok) {
                if (window.showToast) showToast('Ticket riassegnato con successo');
                await fetchTicketDetails();
            } else {
                const err = await res.json();
                if (window.showToast) showToast(err.error || 'Impossibile riassegnare', 'error');
            }
        } catch {
            if (window.showToast) showToast('Errore di rete', 'error');
        }
    });

    document.getElementById('btnCloseTicket')?.addEventListener('click', () => updateStatus('closed'));
    document.getElementById('btnReopenTicket')?.addEventListener('click', () => updateStatus('open'));
});

async function fetchTicketDetails() {
    try {
        const res = await fetch(`/api/tickets/${currentTicketId}`);
        if (!res.ok) { alert('Impossibile caricare il ticket.'); window.location.href = '/dashboard.html'; return; }
        const data = await res.json();
        ticketData = data.ticket;
        renderTicket(data);
    } catch (err) {
        console.error(err);
    }
}

function renderTicket(data) {
    const t = data.ticket;

    document.getElementById('tTitle').textContent    = t.title;
    document.getElementById('tId').textContent       = `#${t.id}`;
    document.getElementById('tCategory').textContent = t.category;
    document.getElementById('tCreator').textContent  = t.creator_name;
    document.getElementById('tDescription').textContent = t.description;

    if (t.created_at) {
        document.getElementById('tCreatedAt').textContent = new Date(t.created_at).toLocaleString('it-IT', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }

    document.getElementById('tPriority').innerHTML = `<span class="badge priority-${t.priority}">${t.priority}</span>`;
    document.getElementById('tStatus').innerHTML   = `<span class="badge status-${t.status}">${t.status.replace('_', ' ')}</span>`;

    if (t.rating) {
        const stars = '★'.repeat(t.rating) + '☆'.repeat(5 - t.rating);
        document.getElementById('tRatingBlock').innerHTML = `
            <div style="margin-top:1rem;padding:.75rem;background:#f8fafc;border-radius:.5rem;border:1px solid #e2e8f0;">
                <strong>Valutazione utente:</strong>
                <span style="color:#fbbf24;font-size:1.25rem;letter-spacing:2px;">${stars}</span>
            </div>`;
    } else {
        document.getElementById('tRatingBlock').innerHTML = '';
    }

    if (currentUser.role === 'operatore' || currentUser.role === 'admin') {
        document.getElementById('updateStatusSelect').value = t.status;
        if (t.operator_id && currentUser.role === 'admin') {
            document.getElementById('reassignSelect').value = t.operator_id;
        }
    }

    if (currentUser.role === 'utente') {
        const actionsEl = document.getElementById('userActionButtons');
        if (t.status === 'risolto') {
            actionsEl.innerHTML = `
                <div style="display:flex;flex-direction:column;gap:1rem;width:100%;">
                    <div><strong>L'operatore ha segnato il ticket come risolto.</strong> Se il problema è sistemato, puoi chiudere il ticket e valutare il supporto.</div>
                    <div style="display:flex;gap:1rem;align-items:center;">
                        <label>Valutazione:</label>
                        <select id="ticketRating" class="form-control" style="width:auto;">
                            <option value="5">5 ★ - Eccellente</option>
                            <option value="4">4 ★ - Molto Buono</option>
                            <option value="3" selected>3 ★ - Buono</option>
                            <option value="2">2 ★ - Scarso</option>
                            <option value="1">1 ★ - Pessimo</option>
                        </select>
                        <button onclick="closeWithRating()" class="btn btn-primary" style="background-color:#10b981;">Conferma Risoluzione (Chiudi)</button>
                    </div>
                    <hr style="width:100%;border:0;border-top:1px solid #e2e8f0;margin:1rem 0;">
                    <div><button onclick="updateStatus('aperto')" class="btn btn-secondary" style="border-color:#ef4444;color:#ef4444;">Non Risolto (Riapri)</button></div>
                </div>`;
        } else if (t.status === 'chiuso') {
            actionsEl.innerHTML = `<p class="text-muted">Il ticket è stato chiuso definitivamente.</p>`;
        } else {
            actionsEl.innerHTML = `<p class="text-muted">Nessuna azione disponibile. Attendi la risoluzione dell'operatore.</p>`;
        }
    }

    const commentsList = document.getElementById('commentsList');
    if (data.comments.length === 0) {
        commentsList.innerHTML = '<p class="text-muted">Nessun commento.</p>';
    } else {
        commentsList.innerHTML = '';
        data.comments.forEach(c => {
            const div = document.createElement('div');
            div.className = 'comment';
            if (c.is_internal) {
                div.style.backgroundColor = '#fee2e2';
                div.style.borderColor     = '#fca5a5';
            }
            div.innerHTML = `
                <div class="comment-header">
                    <strong>${c.username} (${c.role})</strong>
                    ${c.is_internal ? '<span class="badge" style="background:#ef4444;color:white;">Nota Interna</span>' : ''}
                    <span class="text-muted">${new Date(c.created_at).toLocaleString()}</span>
                </div>
                <div style="white-space:pre-wrap;">${c.content}</div>`;
            commentsList.appendChild(div);
        });
    }

    const historyList = document.getElementById('historyTimeline');
    historyList.innerHTML = '';
    data.history.forEach(h => {
        const div = document.createElement('div');
        div.className = 'timeline-item';
        div.innerHTML = `
            <div style="font-size:.875rem;">
                <strong>${h.username}</strong> ha cambiato lo stato in
                <span class="badge status-${h.new_status}">${h.new_status.replace('_', ' ')}</span>
            </div>
            <div class="text-muted" style="font-size:.75rem;margin-top:.25rem;">${new Date(h.changed_at).toLocaleString()}</div>`;
        historyList.appendChild(div);
    });

    const attachmentsContainer = document.getElementById('attachmentsContainer');
    if (data.attachments?.length > 0) {
        attachmentsContainer.classList.remove('hidden');
        document.getElementById('attachmentsList').innerHTML = data.attachments.map(att => {
            const url = `/uploads/${att.filename}`;
            if (att.original_name.match(/\.(jpg|jpeg|png|gif)$/i)) {
                return `<a href="${url}" target="_blank" style="display:block;border:1px solid #cbd5e1;border-radius:var(--r);padding:.25rem;">
                    <img src="${url}" alt="${att.original_name}" style="height:60px;width:auto;border-radius:var(--r-sm);">
                </a>`;
            }
            return `<a href="${url}" target="_blank" class="btn btn-secondary" style="font-size:.875rem;">📎 ${att.original_name}</a>`;
        }).join('');
    } else {
        attachmentsContainer.classList.add('hidden');
    }
}

async function updateStatus(newStatus) {
    try {
        const res = await fetch(`/api/tickets/${currentTicketId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (res.ok) {
            if (window.showToast) showToast('Stato aggiornato con successo');
            await fetchTicketDetails();
        } else {
            const err = await res.json();
            if (window.showToast) showToast(err.error || 'Impossibile aggiornare lo stato', 'error');
        }
    } catch {
        if (window.showToast) showToast('Errore di rete', 'error');
    }
}

window.closeWithRating = async function() {
    const rating = document.getElementById('ticketRating').value;
    try {
        const res = await fetch(`/api/tickets/${currentTicketId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'chiuso', rating: parseInt(rating) })
        });
        if (res.ok) {
            if (window.showToast) showToast('Ticket chiuso, grazie per la valutazione!');
            await fetchTicketDetails();
        } else {
            const err = await res.json();
            if (window.showToast) showToast(err.error || 'Errore', 'error');
        }
    } catch (err) {
        console.error(err);
    }
};

async function loadOperatorsForReassign() {
    try {
        const operators = await fetch('/api/admin/operators').then(r => r.json());
        const select = document.getElementById('reassignSelect');
        select.innerHTML = '<option value="">Seleziona Operatore...</option>' +
            operators.map(op => `<option value="${op.id}">${op.username}</option>`).join('');
    } catch (err) {
        console.error(err);
    }
}
