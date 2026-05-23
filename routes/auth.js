const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { sendEmailNotification, detailTable } = require('../utils/email');

const router = express.Router();

// Register User
router.post('/register', (req, res) => {
    const { first_name, last_name, email, password, confirm_password } = req.body;

    if (!first_name || !last_name || !email || !password || !confirm_password) {
        return res.status(400).json({ error: 'Tutti i campi sono obbligatori.' });
    }
    
    if (password !== confirm_password) {
        return res.status(400).json({ error: 'Le password non coincidono.' });
    }

    const role = 'utente'; // Hardcode role to 'utente' for public registration

    try {
        const hashedPassword = bcrypt.hashSync(password, 10);
        const insert = db.prepare('INSERT INTO users (first_name, last_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)');
        insert.run(first_name, last_name, email, hashedPassword, role);

        sendEmailNotification(
            email,
            'Benvenuto su DeskFlow!',
            `<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111827;">Benvenuto/a su DeskFlow!</h2>
             <p style="margin:0 0 18px;font-size:14px;color:#6b7280;">Ciao <strong style="color:#374151;">${first_name}</strong>, il tuo account è stato creato con successo. Puoi ora accedere e aprire il tuo primo ticket.</p>
             ${detailTable([['Email', email], ['Ruolo', 'Utente']])}
             <p style="margin:0;font-size:13.5px;color:#6b7280;line-height:1.6;">Siamo felici di averti a bordo. Accedi alla dashboard quando sei pronto/a.</p>`
        );

        return res.json({ success: true });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email già esistente.' });
        }
        return res.status(500).json({ error: 'Errore del database.' });
    }
});

// Login User
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email e password sono obbligatorie.' });
    }

    try {
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

        if (!user || !bcrypt.compareSync(password, user.password_hash)) {
            return res.status(401).json({ error: 'Credenziali non valide.' });
        }

        req.session.userId = user.id;
        req.session.role = user.role;
        req.session.username = `${user.first_name} ${user.last_name}`;

        return res.json({ success: true, redirect: '/dashboard.html' });
    } catch (err) {
        return res.status(500).json({ error: 'Errore del database.' });
    }
});

// Logout User
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Impossibile effettuare il logout.' });
        }
        res.clearCookie('connect.sid');
        return res.json({ success: true, redirect: '/login.html' });
    });
});

// Get Current User
router.get('/me', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Non connesso' });
    }
    
    // Fetch fresh data from DB to support profile updates dynamically
    try {
        const user = db.prepare('SELECT first_name, last_name, email, role FROM users WHERE id = ?').get(req.session.userId);
        if (!user) return res.status(401).json({ error: 'Utente non trovato' });
        
        return res.json({
            id: req.session.userId,
            username: `${user.first_name} ${user.last_name}`,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            role: user.role
        });
    } catch (err) {
        return res.status(500).json({ error: 'Errore interno' });
    }
});

// Update Profile
router.put('/profile', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Non connesso' });
    
    const { first_name, last_name, email, password } = req.body;
    if (!first_name || !last_name || !email) {
        return res.status(400).json({ error: 'Nome, Cognome e Email sono obbligatori' });
    }

    try {
        if (password) {
            const hashedPassword = bcrypt.hashSync(password, 10);
            db.prepare('UPDATE users SET first_name = ?, last_name = ?, email = ?, password_hash = ? WHERE id = ?')
              .run(first_name, last_name, email, hashedPassword, req.session.userId);
        } else {
            db.prepare('UPDATE users SET first_name = ?, last_name = ?, email = ? WHERE id = ?')
              .run(first_name, last_name, email, req.session.userId);
        }
        
        req.session.username = `${first_name} ${last_name}`;
        res.json({ success: true });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email già in uso.' });
        }
        res.status(500).json({ error: 'Errore durante l\'aggiornamento.' });
    }
});

module.exports = router;
