const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { sendEmailNotification, detailTable } = require('../utils/email');

const router = express.Router();

// Configure Multer for attachments (Level 3)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../public/uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        // Allow images and pdfs
        const allowedTypes = /jpeg|jpg|png|gif|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Sono ammessi solo immagini e PDF'));
    }
});

// Create Ticket
router.post('/', requireAuth, upload.array('attachments', 3), (req, res) => {
    if (req.session.role !== 'utente') {
        return res.status(403).json({ error: 'Accesso negato. Solo gli utenti possono creare ticket.' });
    }

    const { title, description, category, priority } = req.body;
    const userId = req.session.userId;

    if (!title || !description || !category || !priority) {
        return res.status(400).json({ error: 'Tutti i campi sono obbligatori.' });
    }

    try {
        // Assegnamento bilanciato (chiesto dal Livello 2)
        const assignQuery = db.prepare(`
            SELECT u.id, COUNT(t.id) as open_tickets 
            FROM users u
            LEFT JOIN tickets t ON u.id = t.operator_id AND t.status IN ('aperto', 'in_corso')
            WHERE u.role = 'operatore'
            GROUP BY u.id
            ORDER BY open_tickets ASC, RANDOM()
            LIMIT 1
        `);
        const operator = assignQuery.get();
        const operatorId = operator ? operator.id : null;

        const insert = db.prepare(`
            INSERT INTO tickets (title, description, category, status, priority, user_id, operator_id) 
            VALUES (?, ?, ?, 'aperto', ?, ?, ?)
        `);
        
        const result = insert.run(title, description, category, priority, userId, operatorId);
        const ticketId = result.lastInsertRowid;

        // Log status history
        db.prepare('INSERT INTO status_history (ticket_id, new_status, changed_by) VALUES (?, ?, ?)')
          .run(ticketId, 'aperto', userId);

        // Handle attachments
        if (req.files && req.files.length > 0) {
            const insertAttachment = db.prepare('INSERT INTO attachments (ticket_id, filename, original_name) VALUES (?, ?, ?)');
            req.files.forEach(file => {
                insertAttachment.run(ticketId, file.filename, file.originalname);
            });
        }

        // Email all'utente: conferma apertura ticket
        const creator = db.prepare('SELECT email, first_name FROM users WHERE id = ?').get(userId);
        if (creator) {
            sendEmailNotification(
                creator.email,
                `Ticket #${ticketId} aperto — ${title}`,
                `<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111827;">Ticket aperto con successo</h2>
                 <p style="margin:0 0 18px;font-size:14px;color:#6b7280;">Ciao <strong style="color:#374151;">${creator.first_name}</strong>, il tuo ticket è stato ricevuto e sarà preso in carico dal nostro team a breve.</p>
                 ${detailTable([['Ticket', `#${ticketId}`], ['Titolo', title], ['Categoria', category], ['Priorità', priority]])}
                 <p style="margin:0;font-size:13.5px;color:#6b7280;line-height:1.6;">Ti invieremo una notifica non appena un operatore inizierà a lavorare sulla tua richiesta.</p>`
            );
        }

        // Email all'operatore assegnato: nuovo ticket assegnato
        if (operatorId) {
            const op = db.prepare('SELECT email, first_name FROM users WHERE id = ?').get(operatorId);
            if (op) {
                sendEmailNotification(
                    op.email,
                    `Nuovo ticket assegnato: #${ticketId} — ${title}`,
                    `<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111827;">Nuovo ticket assegnato</h2>
                     <p style="margin:0 0 18px;font-size:14px;color:#6b7280;">Ciao <strong style="color:#374151;">${op.first_name}</strong>, ti è stato assegnato un nuovo ticket da gestire.</p>
                     ${detailTable([['Ticket', `#${ticketId}`], ['Titolo', title], ['Categoria', category], ['Priorità', priority]])}
                     <p style="margin:0;font-size:13.5px;color:#6b7280;line-height:1.6;">Accedi alla dashboard per visualizzare il ticket e iniziare a lavorarci.</p>`
                );
            }
        }

        res.json({ success: true, ticketId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore del database durante la creazione del ticket.' });
    }
});

// Get Tickets (Dashboard)
router.get('/', requireAuth, (req, res) => {
    const userId = req.session.userId;
    const role = req.session.role;
    
    // Filters
    const { category, status, priority, operator_id, sort } = req.query;

    let queryStr = `
        SELECT t.*, u.first_name || ' ' || u.last_name as creator_name, op.first_name || ' ' || op.last_name as operator_name 
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
        // L'operatore vede solo i ticket a lui assegnati
        queryStr += ' AND t.operator_id = ?';
        params.push(userId);
    }
    // admin non ha restrizioni e vede tutto

    if (category) {
        queryStr += ' AND t.category = ?';
        params.push(category);
    }
    if (status) {
        queryStr += ' AND t.status = ?';
        params.push(status);
    }
    if (priority) {
        queryStr += ' AND t.priority = ?';
        params.push(priority);
    }
    // non ci serve più questo filtro specifico per operatore se non per admin
    if (operator_id && role === 'admin') {
        queryStr += ' AND t.operator_id = ?';
        params.push(operator_id);
    }

    // Default sorting (newest first)
    if (sort === 'oldest') {
        queryStr += ' ORDER BY t.created_at ASC';
    } else {
        queryStr += ' ORDER BY t.created_at DESC';
    }

    try {
        const tickets = db.prepare(queryStr).all(...params);
        res.json(tickets);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Impossibile caricare i ticket.' });
    }
});

// Get Single Ticket Details
router.get('/:id', requireAuth, (req, res) => {
    const ticketId = req.params.id;
    const userId = req.session.userId;
    const role = req.session.role;

    try {
        const ticket = db.prepare(`
            SELECT t.*, u.first_name || ' ' || u.last_name as creator_name, op.first_name || ' ' || op.last_name as operator_name 
            FROM tickets t
            JOIN users u ON t.user_id = u.id
            LEFT JOIN users op ON t.operator_id = op.id
            WHERE t.id = ?
        `).get(ticketId);

        if (!ticket) {
            return res.status(404).json({ error: 'Ticket non trovato.' });
        }

        // Authorization check
        if (role === 'utente' && ticket.user_id !== userId) {
            return res.status(403).json({ error: 'Accesso negato.' });
        }
        if (role === 'operatore' && ticket.operator_id !== userId) {
            return res.status(403).json({ error: 'Accesso negato. Il ticket non ti è assegnato.' });
        }

        // Gli utenti non possono vedere i commenti interni
        let commentsQuery = `
            SELECT c.*, u.first_name || ' ' || u.last_name as username, u.role
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.ticket_id = ?
        `;
        if (role === 'utente') {
            commentsQuery += ' AND c.is_internal = 0';
        }
        commentsQuery += ' ORDER BY c.created_at ASC';

        const comments = db.prepare(commentsQuery).all(ticketId);

        const history = db.prepare(`
            SELECT h.*, u.first_name || ' ' || u.last_name as username
            FROM status_history h
            JOIN users u ON h.changed_by = u.id
            WHERE h.ticket_id = ?
            ORDER BY h.changed_at ASC
        `).all(ticketId);

        const attachments = db.prepare('SELECT * FROM attachments WHERE ticket_id = ?').all(ticketId);

        res.json({ ticket, comments, history, attachments });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Impossibile recuperare i dettagli del ticket.' });
    }
});

// Add Comment
router.post('/:id/comments', requireAuth, (req, res) => {
    const ticketId = req.params.id;
    const userId = req.session.userId;
    const role = req.session.role;
    const { content, is_internal } = req.body;

    if (!content) return res.status(400).json({ error: 'Il contenuto è obbligatorio.' });

    try {
        const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
        if (!ticket) return res.status(404).json({ error: 'Ticket non trovato.' });

        if (role === 'utente' && ticket.user_id !== userId) {
            return res.status(403).json({ error: 'Accesso negato.' });
        }
        if (role === 'operatore' && ticket.operator_id !== userId) {
            return res.status(403).json({ error: 'Accesso negato. Il ticket non ti è assegnato.' });
        }

        const internalFlag = (is_internal && role !== 'utente') ? 1 : 0;

        db.prepare('INSERT INTO comments (ticket_id, user_id, content, is_internal) VALUES (?, ?, ?, ?)')
          .run(ticketId, userId, content, internalFlag);

        db.prepare('UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(ticketId);

        // Send Email Notifications
        if ((role === 'operatore' || role === 'admin') && internalFlag === 0) {
            // Operatore/admin risponde all'utente (non nota interna)
            const ticketCreator = db.prepare('SELECT email FROM users WHERE id = ?').get(ticket.user_id);
            if (ticketCreator) {
                const subject = `Nuova risposta al Ticket #${ticket.id}`;
                const html = `<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111827;">Hai una nuova risposta</h2>
                              <p style="margin:0 0 18px;font-size:14px;color:#6b7280;">Il team di supporto ha risposto al tuo ticket <strong style="color:#374151;">"${ticket.title}"</strong>.</p>
                              <p style="margin:0;font-size:13.5px;color:#6b7280;line-height:1.6;">Accedi alla dashboard per visualizzare la risposta e continuare la conversazione.</p>`;
                sendEmailNotification(ticketCreator.email, subject, html);
            }
        } else if (role === 'utente') {
            // Utente commenta -> notifica operatore assegnato
            if (ticket.operator_id) {
                const op = db.prepare('SELECT email FROM users WHERE id = ?').get(ticket.operator_id);
                if (op) {
                    const subject = `Nuovo commento sul Ticket #${ticket.id}`;
                    const html = `<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111827;">Nuovo commento dall'utente</h2>
                                  <p style="margin:0 0 18px;font-size:14px;color:#6b7280;">L'utente ha aggiunto un messaggio al ticket <strong style="color:#374151;">"${ticket.title}"</strong>.</p>
                                  <p style="margin:0;font-size:13.5px;color:#6b7280;line-height:1.6;">Accedi alla dashboard per visualizzare il messaggio e rispondere.</p>`;
                    sendEmailNotification(op.email, subject, html);
                }
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Impossibile aggiungere il commento.' });
    }
});

// Change Ticket Status
router.put('/:id/status', requireAuth, (req, res) => {
    const ticketId = req.params.id;
    const userId = req.session.userId;
    const role = req.session.role;
    const { status, rating } = req.body;

    const validStatuses = ['aperto', 'in_corso', 'risolto', 'chiuso'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Stato non valido.' });
    }

    try {
        const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
        if (!ticket) return res.status(404).json({ error: 'Ticket non trovato.' });

        if (role === 'utente' && ticket.user_id !== userId) {
            return res.status(403).json({ error: 'Accesso negato.' });
        }
        if (role === 'operatore' && ticket.operator_id !== userId) {
            return res.status(403).json({ error: 'Accesso negato. Il ticket non ti è assegnato.' });
        }

        // Users can only change to 'closed' or 'open' (reopen) from 'resolved'
        if (role === 'utente' && !['chiuso', 'aperto'].includes(status)) {
             return res.status(403).json({ error: 'Gli utenti possono solo chiudere o riaprire un ticket risolto.' });
        }
        
        // Operatori possono passare in_corso e risolto
        if (role === 'operatore' && !['in_corso', 'risolto'].includes(status)) {
            return res.status(403).json({ error: 'Gli operatori non possono forzare stati di chiusura/riapertura.' });
        }

        db.prepare('UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(status, ticketId);
          
        if (status === 'chiuso' && rating && role === 'utente') {
            db.prepare('UPDATE tickets SET rating = ? WHERE id = ?').run(rating, ticketId);
        }
          
        db.prepare('INSERT INTO status_history (ticket_id, old_status, new_status, changed_by) VALUES (?, ?, ?, ?)')
          .run(ticketId, ticket.status, status, userId);

        // Email Notification for 'resolved' status
        if (status === 'risolto' && (role === 'operatore' || role === 'admin')) {
            const ticketCreator = db.prepare('SELECT email FROM users WHERE id = ?').get(ticket.user_id);
            if (ticketCreator) {
                const subject = `Ticket #${ticket.id} risolto`;
                const html = `<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111827;">Il tuo ticket è stato risolto</h2>
                              <p style="margin:0 0 18px;font-size:14px;color:#6b7280;">Il ticket <strong style="color:#374151;">"${ticket.title}"</strong> è stato segnato come <strong>Risolto</strong>.</p>
                              <p style="margin:0;font-size:13.5px;color:#6b7280;line-height:1.6;">Se il problema è stato risolto, puoi chiudere il ticket dalla dashboard e lasciare una valutazione. In caso contrario, puoi riaprirlo.</p>`;
                sendEmailNotification(ticketCreator.email, subject, html);
            }
        }
        
        // Email Notification if ticket reopened
        if (status === 'aperto' && role === 'utente' && ticket.status !== 'aperto') {
            const reopenSubject = `Ticket #${ticket.id} riaperto dall'utente`;
            const reopenHtml = `<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111827;">Ticket riaperto</h2>
                              <p style="margin:0 0 18px;font-size:14px;color:#6b7280;">Il ticket <strong style="color:#374151;">"${ticket.title}"</strong> è stato riaperto dall'utente.</p>
                              <p style="margin:0;font-size:13.5px;color:#6b7280;line-height:1.6;">Verifica il ticket nella dashboard e riassegnalo se necessario.</p>`;

            const admins = db.prepare('SELECT email FROM users WHERE role = ?').all('admin');
            admins.forEach(a => sendEmailNotification(a.email, reopenSubject, reopenHtml));

            if (ticket.operator_id) {
                const op = db.prepare('SELECT email FROM users WHERE id = ?').get(ticket.operator_id);
                if (op) sendEmailNotification(op.email, reopenSubject, reopenHtml);
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Impossibile aggiornare lo stato.' });
    }
});

module.exports = router;
