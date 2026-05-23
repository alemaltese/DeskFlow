const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Summary KPI cards
router.get('/summary', requireAuth, (req, res) => {
    const role = req.session.role;
    const userId = req.session.userId;

    try {
        let open, in_progress, resolved, closed;
        
        if (role === 'utente') {
            open = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'aperto' AND user_id = ?").get(userId).count;
            in_progress = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'in_corso' AND user_id = ?").get(userId).count;
            resolved = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'risolto' AND user_id = ?").get(userId).count;
            closed = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'chiuso' AND user_id = ?").get(userId).count;
        } else if (role === 'operatore') {
            open = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'aperto' AND operator_id = ?").get(userId).count;
            in_progress = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'in_corso' AND operator_id = ?").get(userId).count;
            resolved = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'risolto' AND operator_id = ?").get(userId).count;
            closed = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'chiuso' AND operator_id = ?").get(userId).count;
        } else {
            open = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'aperto'").get().count;
            in_progress = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'in_corso'").get().count;
            resolved = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'risolto'").get().count;
            closed = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'chiuso'").get().count;
        }
        
        const firstResponseRow = db.prepare(`
            SELECT ROUND(AVG((julianday(sh.changed_at) - julianday(t.created_at)) * 24), 1) AS val
            FROM tickets t
            INNER JOIN (
                SELECT ticket_id, MIN(changed_at) AS changed_at
                FROM status_history WHERE new_status = 'in_corso'
                GROUP BY ticket_id
            ) sh ON sh.ticket_id = t.id
        `).get();

        const resolutionRow = db.prepare(`
            SELECT ROUND(AVG((julianday(sh.changed_at) - julianday(t.created_at)) * 24), 1) AS val
            FROM tickets t
            INNER JOIN (
                SELECT ticket_id, MIN(changed_at) AS changed_at
                FROM status_history WHERE new_status = 'risolto'
                GROUP BY ticket_id
            ) sh ON sh.ticket_id = t.id
        `).get();

        const avgFirstResponse = firstResponseRow?.val ?? 0;
        const avgResolutionTime = resolutionRow?.val ?? 0;

        res.json({ open, in_progress, resolved, closed, avgFirstResponse, avgResolutionTime });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore nel recupero statistiche' });
    }
});

// Tickets by priority — accessibile anche agli operatori (filtrato per i loro ticket)
router.get('/by-priority', requireAuth, (req, res) => {
    const role = req.session.role;
    const userId = req.session.userId;
    try {
        let rows;
        if (role === 'operatore') {
            rows = db.prepare(`
                SELECT priority, COUNT(*) as count
                FROM tickets
                WHERE operator_id = ?
                GROUP BY priority
            `).all(userId);
        } else {
            rows = db.prepare(`
                SELECT priority, COUNT(*) as count
                FROM tickets
                GROUP BY priority
            `).all();
        }
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Errore nelle statistiche' });
    }
});

// Le rotte avanzate rimangono solo per admin
router.use(requireAdmin);

// Tickets resolved per operator in last 30 days (Bar chart)
router.get('/by-operator', (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT u.first_name || ' ' || u.last_name as username, COUNT(t.id) as resolved_count
            FROM users u
            LEFT JOIN tickets t ON u.id = t.operator_id 
                AND t.status IN ('risolto', 'chiuso')
                AND t.updated_at >= date('now', '-30 days')
            WHERE u.role = 'operatore'
            GROUP BY u.id
        `).all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Errore nelle statistiche' });
    }
});

// Operator Workload (Admin solo)
router.get('/workload', (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT u.id, u.first_name || ' ' || u.last_name as username, COUNT(t.id) as active_tickets
            FROM users u
            LEFT JOIN tickets t ON u.id = t.operator_id AND t.status IN ('aperto', 'in_corso')
            WHERE u.role = 'operatore'
            GROUP BY u.id
            ORDER BY active_tickets ASC
        `).all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Errore workload' });
    }
});

module.exports = router;
