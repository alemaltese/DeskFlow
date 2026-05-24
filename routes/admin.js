const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { sendEmailNotification, detailTable } = require('../utils/email');

const router = express.Router();

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.use(requireAdmin);

// Reassign ticket
router.put('/tickets/:id/reassign', (req, res) => {
    const ticketId    = req.params.id;
    const { operator_id } = req.body;

    if (!operator_id) return res.status(400).json({ error: 'ID operatore richiesto.' });

    try {
        const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
        if (!ticket) return res.status(404).json({ error: 'Ticket non trovato.' });

        const op = db.prepare('SELECT id FROM users WHERE id = ? AND role = ?').get(operator_id, 'operatore');
        if (!op) return res.status(400).json({ error: 'ID operatore non valido.' });

        db.prepare('UPDATE tickets SET operator_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(operator_id, ticketId);

        res.json({ success: true });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] reassign error:`, err.message);
        res.status(500).json({ error: 'Impossibile riassegnare il ticket.' });
    }
});

// Get all operators (for reassign dropdown)
router.get('/operators', (req, res) => {
    try {
        const operators = db.prepare("SELECT id, first_name || ' ' || last_name as username FROM users WHERE role = ?").all('operatore');
        res.json(operators);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] operators error:`, err.message);
        res.status(500).json({ error: 'Impossibile recuperare gli operatori.' });
    }
});

// Get all users
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
        console.error(`[${new Date().toISOString()}] users list error:`, err.message);
        res.status(500).json({ error: 'Impossibile recuperare gli utenti.' });
    }
});

// Create User
router.post('/users', async (req, res) => {
    const { first_name, last_name, email, role, password } = req.body;

    if (!first_name || !last_name || !email || !role || !password) {
        return res.status(400).json({ error: 'Tutti i campi sono obbligatori.' });
    }
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Indirizzo email non valido.' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'La password deve contenere almeno 8 caratteri.' });
    }
    if (!['utente', 'operatore'].includes(role)) {
        return res.status(400).json({ error: 'Ruolo non valido. Scegli utente o operatore.' });
    }

    try {
        const hashedPassword = bcrypt.hashSync(password, 10);
        const result = db.prepare(
            'INSERT INTO users (first_name, last_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)'
        ).run(first_name, last_name, email, hashedPassword, role);

        const roleLabel = role === 'operatore' ? 'Operatore' : 'Utente';
        // Do NOT include the password in the email — send only login instructions
        await sendEmailNotification(
            email,
            `Il tuo account DeskFlow è pronto`,
            `<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111827;">Account creato</h2>
             <p style="margin:0 0 18px;font-size:14px;color:#6b7280;">Ciao <strong style="color:#374151;">${first_name}</strong>, il tuo account DeskFlow è stato creato dall'amministratore.</p>
             ${detailTable([['Email', email], ['Ruolo', roleLabel]])}
             <p style="margin:0;font-size:13.5px;color:#6b7280;line-height:1.6;">Usa le credenziali fornite dall'amministratore per accedere e cambia la password al primo accesso.</p>`
        );

        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email già in uso.' });
        }
        console.error(`[${new Date().toISOString()}] create user error:`, err.message);
        res.status(500).json({ error: "Impossibile creare l'utente." });
    }
});

// Update User
router.put('/users/:id', (req, res) => {
    const userId = req.params.id;
    const { first_name, last_name, email, role, password } = req.body;

    if (!first_name || !last_name || !email || !role) {
        return res.status(400).json({ error: 'Tutti i campi (tranne password) sono obbligatori.' });
    }
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Indirizzo email non valido.' });
    }
    if (password && password.length < 8) {
        return res.status(400).json({ error: 'La password deve contenere almeno 8 caratteri.' });
    }

    try {
        if (password) {
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
        console.error(`[${new Date().toISOString()}] update user error:`, err.message);
        res.status(500).json({ error: "Impossibile aggiornare l'utente." });
    }
});

module.exports = router;
