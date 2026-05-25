const express = require('express');
const db      = require('../db');
const { requireAuth } = require('../middleware/auth');
const { sendEmailNotification, detailTable } = require('../utils/email');

const router = express.Router();

// Create Ticket
router.post('/', requireAuth, async (req, res) => {
    if (req.session.role !== 'utente') {
        return res.status(403).json({ error: 'Accesso negato. Solo gli utenti possono creare ticket.' });
    }

    const { title, description, category, priority } = req.body;
    const userId = req.session.userId;

    if (!title || !description || !category || !priority) {
        return res.status(400).json({ error: 'Tutti i campi sono obbligatori.' });
    }

    try {
        const operator = db.prepare(`
            SELECT u.id FROM users u
            LEFT JOIN tickets t ON u.id = t.operator_id AND t.status IN ('aperto', 'in_corso')
            WHERE u.role = 'operatore'
            GROUP BY u.id
            ORDER BY COUNT(t.id) ASC, RANDOM()
            LIMIT 1
        `).get();
        const operatorId = operator?.id ?? null;

        const result = db.prepare(`
            INSERT INTO tickets (title, description, category, status, priority, user_id, operator_id)
            VALUES (?, ?, ?, 'aperto', ?, ?, ?)
        `).run(title, description, category, priority, userId, operatorId);
        const ticketId = result.lastInsertRowid;

        db.prepare('INSERT INTO status_history (ticket_id, new_status, changed_by) VALUES (?, ?, ?)')
          .run(ticketId, 'aperto', userId);

        res.json({ success: true, ticketId });

        const creator = db.prepare('SELECT email, first_name FROM users WHERE id = ?').get(userId);
        if (creator) {
            await sendEmailNotification(
                creator.email,
                `Ticket #${ticketId} aperto — ${title}`,
                `<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111827;">Ticket aperto con successo</h2>
                 <p style="margin:0 0 18px;font-size:14px;color:#6b7280;">Ciao <strong style="color:#374151;">${creator.first_name}</strong>, il tuo ticket è stato ricevuto e sarà preso in carico dal nostro team a breve.</p>
                 ${detailTable([['Ticket', `#${ticketId}`], ['Titolo', title], ['Categoria', category], ['Priorità', priority]])}
                 <p style="margin:0;font-size:13.5px;color:#6b7280;line-height:1.6;">Ti invieremo una notifica non appena un operatore inizierà a lavorare sulla tua richiesta.</p>`
            );
        }
        if (operatorId) {
            const op = db.prepare('SELECT email, first_name FROM users WHERE id = ?').get(operatorId);
            if (op) {
                await sendEmailNotification(
                    op.email,
                    `Nuovo ticket assegnato: #${ticketId} — ${title}`,
                    `<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111827;">Nuovo ticket assegnato</h2>
                     <p style="margin:0 0 18px;font-size:14px;color:#6b7280;">Ciao <strong style="color:#374151;">${op.first_name}</strong>, ti è stato assegnato un nuovo ticket da gestire.</p>
                     ${detailTable([['Ticket', `#${ticketId}`], ['Titolo', title], ['Categoria', category], ['Priorità', priority]])}
                     <p style="margin:0;font-size:13.5px;color:#6b7280;line-height:1.6;">Accedi alla dashboard per visualizzare il ticket e iniziare a lavorarci.</p>`
                );
            }
        }
    } catch (err) {
        if (!res.headersSent) res.status(500).json({ error: 'Errore durante la creazione del ticket.' });
    }
});

// Get Tickets (Dashboard)
router.get('/', requireAuth, (req, res) => {
    const userId = req.session.userId;
    const role   = req.session.role;

    const { category, status, priority, sort } = req.query;
    const operator_id = req.query.operator_id;
    const limit  = Math.min(parseInt(req.query.limit)  || 50, 200);
    const offset = Math.max(parseInt(req.query.offset) || 0,  0);

    let queryStr = `
        SELECT t.*, u.first_name || ' ' || u.last_name as creator_name,
               op.first_name || ' ' || op.last_name as operator_name
        FROM tickets t
        JOIN users u ON t.user_id = u.id
        LEFT JOIN users op ON t.operator_id = op.id
        WHERE 1=1
    `;
    const params = [];

    if (role === 'utente') {
        queryStr += ' AND t.user_id = ?';
        params.push(userId);
    } else if (role === 'operatore') {
        queryStr += ' AND t.operator_id = ?';
        params.push(userId);
    }

    if (category) { queryStr += ' AND t.category = ?'; params.push(category); }
    if (status)   { queryStr += ' AND t.status = ?';   params.push(status); }
    if (priority) { queryStr += ' AND t.priority = ?'; params.push(priority); }

    if (operator_id && role === 'admin') {
        if (operator_id === 'null') {
            queryStr += ' AND t.operator_id IS NULL';
        } else {
            queryStr += ' AND t.operator_id = ?';
            params.push(operator_id);
        }
    }

    queryStr += sort === 'oldest' ? ' ORDER BY t.created_at ASC' : ' ORDER BY t.created_at DESC';
    queryStr += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    try {
        const tickets = db.prepare(queryStr).all(...params);
        res.json(tickets);
    } catch (err) {
        res.status(500).json({ error: 'Impossibile caricare i ticket.' });
    }
});

// Get Single Ticket Details
router.get('/:id', requireAuth, (req, res) => {
    const ticketId = req.params.id;
    const userId   = req.session.userId;
    const role     = req.session.role;

    try {
        const ticket = db.prepare(`
            SELECT t.*, u.first_name || ' ' || u.last_name as creator_name,
                   op.first_name || ' ' || op.last_name as operator_name
            FROM tickets t
            JOIN users u ON t.user_id = u.id
            LEFT JOIN users op ON t.operator_id = op.id
            WHERE t.id = ?
        `).get(ticketId);

        if (!ticket) return res.status(404).json({ error: 'Ticket non trovato.' });

        if (role === 'utente'    && ticket.user_id     !== userId) return res.status(403).json({ error: 'Accesso negato.' });
        if (role === 'operatore' && ticket.operator_id !== userId) return res.status(403).json({ error: 'Accesso negato. Il ticket non ti è assegnato.' });

        let commentsQuery = `
            SELECT c.*, u.first_name || ' ' || u.last_name as username, u.role
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.ticket_id = ?
        `;
        if (role === 'utente') commentsQuery += ' AND c.is_internal = 0';
        commentsQuery += ' ORDER BY c.created_at ASC';

        const comments = db.prepare(commentsQuery).all(ticketId);
        const history  = db.prepare(`
            SELECT h.*, u.first_name || ' ' || u.last_name as username
            FROM status_history h
            JOIN users u ON h.changed_by = u.id
            WHERE h.ticket_id = ?
            ORDER BY h.changed_at ASC
        `).all(ticketId);

        res.json({ ticket, comments, history });
    } catch (err) {
        res.status(500).json({ error: 'Impossibile recuperare i dettagli del ticket.' });
    }
});

// Add Comment
router.post('/:id/comments', requireAuth, async (req, res) => {
    const ticketId = req.params.id;
    const userId   = req.session.userId;
    const role     = req.session.role;
    const { content, is_internal } = req.body;

    if (!content?.trim()) return res.status(400).json({ error: 'Il contenuto è obbligatorio.' });

    try {
        const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
        if (!ticket) return res.status(404).json({ error: 'Ticket non trovato.' });

        if (role === 'utente'    && ticket.user_id     !== userId) return res.status(403).json({ error: 'Accesso negato.' });
        if (role === 'operatore' && ticket.operator_id !== userId) return res.status(403).json({ error: 'Accesso negato. Il ticket non ti è assegnato.' });

        const internalFlag = (is_internal && role !== 'utente') ? 1 : 0;

        db.prepare('INSERT INTO comments (ticket_id, user_id, content, is_internal) VALUES (?, ?, ?, ?)')
          .run(ticketId, userId, content, internalFlag);
        db.prepare('UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(ticketId);

        res.json({ success: true });

        if ((role === 'operatore' || role === 'admin') && internalFlag === 0) {
            const creator = db.prepare('SELECT email FROM users WHERE id = ?').get(ticket.user_id);
            if (creator) {
                await sendEmailNotification(
                    creator.email,
                    `Nuova risposta al Ticket #${ticket.id}`,
                    `<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111827;">Hai una nuova risposta</h2>
                     <p style="margin:0 0 18px;font-size:14px;color:#6b7280;">Il team di supporto ha risposto al tuo ticket <strong style="color:#374151;">"${ticket.title}"</strong>.</p>
                     <p style="margin:0;font-size:13.5px;color:#6b7280;line-height:1.6;">Accedi alla dashboard per visualizzare la risposta e continuare la conversazione.</p>`
                );
            }
        } else if (role === 'utente' && ticket.operator_id) {
            const op = db.prepare('SELECT email FROM users WHERE id = ?').get(ticket.operator_id);
            if (op) {
                await sendEmailNotification(
                    op.email,
                    `Nuovo commento sul Ticket #${ticket.id}`,
                    `<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111827;">Nuovo commento dall'utente</h2>
                     <p style="margin:0 0 18px;font-size:14px;color:#6b7280;">L'utente ha aggiunto un messaggio al ticket <strong style="color:#374151;">"${ticket.title}"</strong>.</p>
                     <p style="margin:0;font-size:13.5px;color:#6b7280;line-height:1.6;">Accedi alla dashboard per visualizzare il messaggio e rispondere.</p>`
                );
            }
        }
    } catch (err) {
        if (!res.headersSent) res.status(500).json({ error: 'Impossibile aggiungere il commento.' });
    }
});

// Change Ticket Status
router.put('/:id/status', requireAuth, async (req, res) => {
    const ticketId = req.params.id;
    const userId   = req.session.userId;
    const role     = req.session.role;
    const { status, rating } = req.body;

    const validStatuses = ['aperto', 'in_corso', 'risolto', 'chiuso'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Stato non valido.' });

    try {
        const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
        if (!ticket) return res.status(404).json({ error: 'Ticket non trovato.' });

        if (role === 'utente'    && ticket.user_id     !== userId) return res.status(403).json({ error: 'Accesso negato.' });
        if (role === 'operatore' && ticket.operator_id !== userId) return res.status(403).json({ error: 'Accesso negato. Il ticket non ti è assegnato.' });

        if (role === 'utente' && !['chiuso', 'aperto'].includes(status)) {
            return res.status(403).json({ error: 'Gli utenti possono solo chiudere o riaprire un ticket risolto.' });
        }
        if (role === 'operatore' && !['in_corso', 'risolto'].includes(status)) {
            return res.status(403).json({ error: 'Gli operatori non possono forzare stati di chiusura/riapertura.' });
        }

        db.prepare('UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, ticketId);

        if (status === 'chiuso' && rating != null && role === 'utente') {
            const r = Number(rating);
            if (![1, 2, 3, 4, 5].includes(r)) return res.status(400).json({ error: 'Valutazione non valida (1–5).' });
            db.prepare('UPDATE tickets SET rating = ? WHERE id = ?').run(r, ticketId);
        }

        db.prepare('INSERT INTO status_history (ticket_id, old_status, new_status, changed_by) VALUES (?, ?, ?, ?)')
          .run(ticketId, ticket.status, status, userId);

        res.json({ success: true });

        if (status === 'risolto' && (role === 'operatore' || role === 'admin')) {
            const creator = db.prepare('SELECT email FROM users WHERE id = ?').get(ticket.user_id);
            if (creator) {
                await sendEmailNotification(
                    creator.email,
                    `Ticket #${ticket.id} risolto`,
                    `<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111827;">Il tuo ticket è stato risolto</h2>
                     <p style="margin:0 0 18px;font-size:14px;color:#6b7280;">Il ticket <strong style="color:#374151;">"${ticket.title}"</strong> è stato segnato come <strong>Risolto</strong>.</p>
                     <p style="margin:0;font-size:13.5px;color:#6b7280;line-height:1.6;">Se il problema è stato risolto, puoi chiudere il ticket dalla dashboard e lasciare una valutazione. In caso contrario, puoi riaprirlo.</p>`
                );
            }
        }

        if (status === 'aperto' && role === 'utente' && ticket.status !== 'aperto') {
            const subject = `Ticket #${ticket.id} riaperto dall'utente`;
            const html    = `<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111827;">Ticket riaperto</h2>
                             <p style="margin:0 0 18px;font-size:14px;color:#6b7280;">Il ticket <strong style="color:#374151;">"${ticket.title}"</strong> è stato riaperto dall'utente.</p>
                             <p style="margin:0;font-size:13.5px;color:#6b7280;line-height:1.6;">Verifica il ticket nella dashboard e riassegnalo se necessario.</p>`;

            const admins = db.prepare('SELECT email FROM users WHERE role = ?').all('admin');
            for (const a of admins) await sendEmailNotification(a.email, subject, html);

            if (ticket.operator_id) {
                const op = db.prepare('SELECT email FROM users WHERE id = ?').get(ticket.operator_id);
                if (op) await sendEmailNotification(op.email, subject, html);
            }
        }
    } catch (err) {
        if (!res.headersSent) res.status(500).json({ error: 'Impossibile aggiornare lo stato.' });
    }
});

module.exports = router;
