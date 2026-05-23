const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'deskflow.db');
const db = new Database(dbPath);

function initDb() {
    db.exec(`
        DROP TABLE IF EXISTS attachments;
        DROP TABLE IF EXISTS status_history;
        DROP TABLE IF EXISTS comments;
        DROP TABLE IF EXISTS tickets;
        DROP TABLE IF EXISTS users;

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT CHECK( role IN ('utente', 'operatore', 'admin') ) NOT NULL DEFAULT 'utente',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('aperto', 'in_corso', 'risolto', 'chiuso')),
            priority TEXT NOT NULL CHECK(priority IN ('bassa', 'media', 'alta', 'urgente')),
            user_id INTEGER NOT NULL,
            operator_id INTEGER,
            rating INTEGER CHECK(rating BETWEEN 1 AND 5),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (operator_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id INTEGER,
            user_id INTEGER,
            content TEXT NOT NULL,
            is_internal BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ticket_id) REFERENCES tickets(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS status_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id INTEGER NOT NULL,
            old_status TEXT,
            new_status TEXT NOT NULL,
            changed_by INTEGER NOT NULL,
            changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ticket_id) REFERENCES tickets(id),
            FOREIGN KEY (changed_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            original_name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ticket_id) REFERENCES tickets(id)
        );
    `);

    // In questa fase di sviluppo e test, forziamo sempre il seeding ad ogni avvio.
    console.log('Inserimento dati iniziali (seeding)...');
    const insertUser = db.prepare('INSERT INTO users (first_name, last_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)');
    const insertTicket = db.prepare('INSERT INTO tickets (title, description, category, status, priority, user_id, operator_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insertStatusHistory = db.prepare('INSERT INTO status_history (ticket_id, old_status, new_status, changed_by, changed_at) VALUES (?, ?, ?, ?, ?)');

    const toSqlite = (d) => d.toISOString().replace('T', ' ').substring(0, 19);
    const daysAgo  = (d) => new Date(Date.now() - d * 86400000);
    const addHours = (base, h) => toSqlite(new Date(base.getTime() + h * 3600000));

    // Per ogni ticket: quanti giorni fa è stato creato, ore al primo cambio in_corso, ore alla risoluzione, ore alla chiusura
    // L'indice corrisponde a ticket i (0-based = ticket 1-15)
    const timings = [
        { daysAgo: 25, inCorsoH: 3,    risoltoH: null, chiusoH: null }, // ticket 1  -> in_corso
        { daysAgo: 22, inCorsoH: 5,    risoltoH: 24,   chiusoH: null }, // ticket 2  -> risolto
        { daysAgo: 20, inCorsoH: null, risoltoH: null, chiusoH: null }, // ticket 3  -> aperto (no op)
        { daysAgo: 18, inCorsoH: null, risoltoH: null, chiusoH: null }, // ticket 4  -> aperto
        { daysAgo: 16, inCorsoH: 2,    risoltoH: null, chiusoH: null }, // ticket 5  -> in_corso
        { daysAgo: 14, inCorsoH: null, risoltoH: null, chiusoH: null }, // ticket 6  -> aperto (no op)
        { daysAgo: 12, inCorsoH: 8,    risoltoH: 36,   chiusoH: 48  }, // ticket 7  -> chiuso
        { daysAgo: 10, inCorsoH: null, risoltoH: null, chiusoH: null }, // ticket 8  -> aperto
        { daysAgo: 8,  inCorsoH: null, risoltoH: null, chiusoH: null }, // ticket 9  -> aperto (no op)
        { daysAgo: 6,  inCorsoH: 4,    risoltoH: 20,   chiusoH: null }, // ticket 10 -> risolto
        { daysAgo: 5,  inCorsoH: 6,    risoltoH: 30,   chiusoH: 44  }, // ticket 11 -> chiuso
        { daysAgo: 4,  inCorsoH: null, risoltoH: null, chiusoH: null }, // ticket 12 -> aperto (no op)
        { daysAgo: 3,  inCorsoH: 2,    risoltoH: null, chiusoH: null }, // ticket 13 -> in_corso
        { daysAgo: 2,  inCorsoH: 7,    risoltoH: 28,   chiusoH: null }, // ticket 14 -> risolto
        { daysAgo: 1,  inCorsoH: null, risoltoH: null, chiusoH: null }, // ticket 15 -> aperto (no op)
    ];

        // Passwords
        const defaultPassword = bcrypt.hashSync('password', 10);

        // Insert Admin
        const adminResult = insertUser.run('Mario', 'Rossi (Admin)', 'admin@test.com', defaultPassword, 'admin');
        const adminId = adminResult.lastInsertRowid;

        // Insert 5 Operators
        const opIds = [];
        for (let i = 1; i <= 5; i++) {
            const res = insertUser.run('Operatore', `Numero ${i}`, `operatore${i}@test.com`, defaultPassword, 'operatore');
            opIds.push(res.lastInsertRowid);
        }

        // Insert 5 Users
        const userIds = [];
        for (let i = 1; i <= 5; i++) {
            const res = insertUser.run('Utente', `Test ${i}`, `utente${i}@test.com`, defaultPassword, 'utente');
            userIds.push(res.lastInsertRowid);
        }

        // Insert 15 mixed tickets
        const categories = ['Rete', 'Software', 'Hardware', 'Account', 'Altro'];
        const priorities = ['bassa', 'media', 'alta', 'urgente'];
        const statuses = ['aperto', 'in_corso', 'risolto', 'chiuso'];

        for (let i = 1; i <= 15; i++) {
            const userId = userIds[i % 5];
            const opId = i % 3 === 0 ? null : opIds[i % 5];
            const category = categories[i % 5];
            const priority = priorities[i % 4];

            let status = statuses[i % 4];
            if (!opId) status = 'aperto';

            const tm = timings[i - 1];
            const createdDate = daysAgo(tm.daysAgo);
            const createdStr  = toSqlite(createdDate);
            const updatedStr  = tm.risoltoH ? addHours(createdDate, tm.risoltoH)
                              : tm.inCorsoH ? addHours(createdDate, tm.inCorsoH)
                              : createdStr;

            const t = insertTicket.run(
                `Ticket di test #${i} - Problema con ${category}`,
                `Descrizione del problema numero ${i} per testare il sistema. Questo ticket serve per verificare la dashboard.`,
                category,
                status,
                priority,
                userId,
                opId,
                createdStr,
                updatedStr
            );

            const tId = t.lastInsertRowid;

            insertStatusHistory.run(tId, null, 'aperto', userId, createdStr);

            if (status === 'in_corso') {
                insertStatusHistory.run(tId, 'aperto', 'in_corso', opId, addHours(createdDate, tm.inCorsoH));
            } else if (status === 'risolto') {
                insertStatusHistory.run(tId, 'aperto', 'in_corso', opId, addHours(createdDate, tm.inCorsoH));
                insertStatusHistory.run(tId, 'in_corso', 'risolto', opId, addHours(createdDate, tm.risoltoH));
            } else if (status === 'chiuso') {
                insertStatusHistory.run(tId, 'aperto', 'in_corso', opId, addHours(createdDate, tm.inCorsoH));
                insertStatusHistory.run(tId, 'in_corso', 'risolto', opId, addHours(createdDate, tm.risoltoH));
                insertStatusHistory.run(tId, 'risolto', 'chiuso', userId, addHours(createdDate, tm.chiusoH));
            }
        }

        console.log('Dati iniziali inseriti con successo.');
}

initDb();

module.exports = db;
