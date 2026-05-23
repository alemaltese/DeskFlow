const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { sendEmailNotification, detailTable } = require('../utils/email');

const router = express.Router();

// Apply admin auth to all admin routes
router.use(requireAdmin);

// Reassign ticket
router.put('/tickets/:id/reassign', (req, res) => {
    const ticketId = req.params.id;
    const { operator_id } = req.body;

    if (!operator_id) {
        return res.status(400).json({ error: 'ID operatore richiesto.' });
    }

    try {
        const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
        if (!ticket) return res.status(404).json({ error: 'Ticket non trovato.' });

        const op = db.prepare('SELECT id FROM users WHERE id = ? AND role = ?').get(operator_id, 'operatore');
        if (!op) return res.status(400).json({ error: 'ID operatore non valido.' });

        db.prepare('UPDATE tickets SET operator_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(operator_id, ticketId);

        // Could also log this to status_history, but the schema doesn't have an operator_changed column, 
        // so we'll skip for now or just log it as a comment if necessary.

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Impossibile riassegnare il ticket.' });
    }
});

// Get all operators (for the reassign dropdown)
router.get('/operators', (req, res) => {
    try {
        const operators = db.prepare("SELECT id, first_name || ' ' || last_name as username FROM users WHERE role = ?").all('operatore');
        res.json(operators);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Impossibile recuperare gli operatori.' });
    }
});

// Get all users (Admin Users Management)
router.get('/users', (req, res) => {
    try {
        const users = db.prepare(`
            SELECT id, first_name, last_name, email, role, created_at FROM users
            ORDER BY
                CASE role WHEN 'admin' THEN 0 WHEN 'operatore' THEN 1 ELSE 2 END ASC,
                created_at ASC
        `).all();
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Impossibile recuperare gli utenti.' });
    }
});

// Create User (Admin Users Management)
router.post('/users', (req, res) => {
    const { first_name, last_name, email, role, password } = req.body;

    if (!first_name || !last_name || !email || !role || !password) {
        return res.status(400).json({ error: 'Tutti i campi sono obbligatori.' });
    }
    if (!['utente', 'operatore'].includes(role)) {
        return res.status(400).json({ error: 'Ruolo non valido. Scegli utente o operatore.' });
    }

    try {
        const bcrypt = require('bcryptjs');
        const hashedPassword = bcrypt.hashSync(password, 10);
        const result = db.prepare(
            'INSERT INTO users (first_name, last_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)'
        ).run(first_name, last_name, email, hashedPassword, role);

        const roleLabel = role === 'operatore' ? 'Operatore' : 'Utente';
        sendEmailNotification(
            email,
            `Il tuo account DeskFlow è pronto`,
            `<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111827;">Account creato</h2>
             <p style="margin:0 0 18px;font-size:14px;color:#6b7280;">Ciao <strong style="color:#374151;">${first_name}</strong>, il tuo account DeskFlow è stato creato dall'amministratore. Di seguito le tue credenziali di accesso.</p>
             ${detailTable([['Email', email], ['Password', password], ['Ruolo', roleLabel]])}
             <p style="margin:0;font-size:13.5px;color:#6b7280;line-height:1.6;">Accedi e cambia la password non appena possibile per mantenere il tuo account al sicuro.</p>`
        );

        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email già in uso.' });
        }
        res.status(500).json({ error: 'Impossibile creare l\'utente.' });
    }
});

// Update User (Admin Users Management)
router.put('/users/:id', (req, res) => {
    const userId = req.params.id;
    const { first_name, last_name, email, role, password } = req.body;

    if (!first_name || !last_name || !email || !role) {
        return res.status(400).json({ error: 'Tutti i campi (tranne password) sono obbligatori.' });
    }

    try {
        if (password) {
            const bcrypt = require('bcryptjs');
            const hashedPassword = bcrypt.hashSync(password, 10);
            db.prepare('UPDATE users SET first_name = ?, last_name = ?, email = ?, role = ?, password_hash = ? WHERE id = ?')
              .run(first_name, last_name, email, role, hashedPassword, userId);
        } else {
            db.prepare('UPDATE users SET first_name = ?, last_name = ?, email = ?, role = ? WHERE id = ?')
              .run(first_name, last_name, email, role, userId);
        }
        res.json({ success: true });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email già in uso da un altro utente.' });
        }
        console.error(err);
        res.status(500).json({ error: 'Impossibile aggiornare l\'utente.' });
    }
});

module.exports = router;
