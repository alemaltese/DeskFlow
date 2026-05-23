function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }
    return res.status(401).json({ error: 'Non autorizzato. Effettua il login.' });
}

function requireOperator(req, res, next) {
    if (req.session && req.session.userId && req.session.role === 'operatore') {
        return next();
    }
    return res.status(403).json({ error: 'Accesso negato. Richiesti privilegi di operatore.' });
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.userId && req.session.role === 'admin') {
        return next();
    }
    return res.status(403).json({ error: 'Accesso negato. Richiesti privilegi di amministratore.' });
}

module.exports = {
    requireAuth,
    requireOperator,
    requireAdmin
};
