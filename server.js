require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path    = require('path');
const db      = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'views')));

app.use(session({
    secret: 'esame-tiw',
    resave: false,
    saveUninitialized: false
}));

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

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', db: !!db });
});

app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message || 'Errore interno del server' });
});

app.listen(PORT, () => {
    console.log(`Server in esecuzione su http://localhost:${PORT}`);
});
