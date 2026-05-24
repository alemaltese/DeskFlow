require('dotenv').config();

if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET env var non impostato. Aggiungilo al file .env');
}

const express = require('express');
const session = require('express-session');
const helmet  = require('helmet');
const path    = require('path');
const db      = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

// Security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, ecc.)
app.use(helmet());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'views')));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure:   process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true,
        sameSite: 'Strict', // protects against CSRF
        maxAge:   1000 * 60 * 60 * 24 // 1 day
    }
}));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', db: !!db });
});

const authRoutes      = require('./routes/auth');
const ticketsRoutes   = require('./routes/tickets');
const adminRoutes     = require('./routes/admin');
const analyticsRoutes = require('./routes/analytics');

app.use('/api/auth',      authRoutes);
app.use('/api/tickets',   ticketsRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/analytics', analyticsRoutes);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Global error handler — catches unhandled errors from route handlers
app.use((err, req, res, next) => {
    console.error(`[${new Date().toISOString()}] Unhandled error:`, err.message);
    res.status(err.status || 500).json({ error: err.message || 'Errore interno del server' });
});

app.listen(PORT, () => {
    console.log(`[${new Date().toISOString()}] Server in esecuzione su http://localhost:${PORT}`);
});
