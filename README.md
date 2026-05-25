# DeskFlow — Sistema di Helpdesk e Ticketing

DeskFlow è un'applicazione web per la gestione del supporto tecnico. Permette agli utenti di aprire ticket di assistenza, agli operatori di gestirli e agli amministratori di coordinare tutto il sistema.

---

## Indice

1. [Avvio del progetto](#avvio-del-progetto)
2. [Variabili d'ambiente](#variabili-dambiente)
3. [Struttura del progetto](#struttura-del-progetto)
4. [Stack tecnologico](#stack-tecnologico)
5. [Database e schema](#database-e-schema)
6. [Sistema dei ruoli e permessi](#sistema-dei-ruoli-e-permessi)
7. [API — Endpoint completi](#api--endpoint-completi)
8. [Regole di validazione](#regole-di-validazione)
9. [Sessione](#sessione)
10. [Notifiche email](#notifiche-email)
11. [Sicurezza](#sicurezza)
12. [Limitazioni note](#limitazioni-note)

---

## Avvio del progetto

**Requisiti:** Node.js 18+

```bash
# 1. Installa le dipendenze (copia anche Chart.js in public/js/vendor automaticamente)
npm install

# 2. Crea il file di configurazione
cp .env.example .env
# Apri .env e compila i valori (vedi sezione variabili d'ambiente)

# 3. Avvia il server
node server.js
```

Il server si avvia su `http://localhost:3000` (o la porta definita in `PORT`).

> **Il database viene ricreato ad ogni avvio** con dati di esempio. Questa è una scelta intenzionale per lo sviluppo/esame. Ogni riavvio azzera tutti i dati e reinserisce il seed.

### Credenziali di test (seed automatico)

| Ruolo      | Email                | Password  |
|------------|----------------------|-----------|
| Admin      | admin@test.com       | password  |
| Operatore  | operatore1@test.com  | password  |
| Operatore  | operatore2@test.com  | password  |
| Operatore  | operatore3@test.com  | password  |
| Operatore  | operatore4@test.com  | password  |
| Operatore  | operatore5@test.com  | password  |
| Utente     | utente1@test.com     | password  |
| Utente     | utente2@test.com     | password  |
| Utente     | utente3@test.com     | password  |
| Utente     | utente4@test.com     | password  |
| Utente     | utente5@test.com     | password  |

---

## Variabili d'ambiente

Il file `.env` è opzionale. Il server si avvia anche senza — la sessione usa il secret hardcodato `'esame-tiw'`. Le variabili email sono necessarie solo se si vuole che le notifiche vengano effettivamente inviate.

```env
EMAIL_USER=tua_email@gmail.com   # Account Gmail per l'invio email
EMAIL_PASS=app_password_gmail    # App Password Gmail (non la password normale)
PORT=3000                        # Porta del server (default 3000)
```

### Come ottenere l'App Password Gmail

1. Vai su [myaccount.google.com](https://myaccount.google.com) → Sicurezza → Verifica in due passaggi (deve essere attiva)
2. Cerca "Password per le app" → crea una nuova password per "Posta"
3. Usa quella stringa come `EMAIL_PASS`

---

## Struttura del progetto

```
TIW_ESAME/
├── server.js                  # Entry point — Express app, middleware, route mounting
├── db.js                      # Inizializzazione SQLite, schema tabelle, seeding dati
├── package.json               # Dipendenze e script npm
├── .env                       # Variabili d'ambiente (non versionare in produzione)
├── routes/
│   ├── auth.js                # Registrazione, login, logout, profilo
│   ├── tickets.js             # CRUD ticket, commenti, status, allegati
│   ├── admin.js               # Gestione utenti e riassegnazione ticket
│   └── analytics.js           # Statistiche, KPI, grafici
├── middleware/
│   └── auth.js                # requireAuth, requireOperator, requireAdmin
├── utils/
│   └── email.js               # Template email HTML, transporter Nodemailer
├── public/
│   ├── css/
│   │   └── style.css          # Foglio di stile principale
│   ├── js/
│   │   ├── auth.js            # Form login/registrazione, logout, toggle password
│   │   ├── dashboard.js       # Lista ticket, filtri, modale nuovo ticket, KPI
│   │   ├── ticket.js          # Dettaglio ticket, commenti, timeline, status
│   │   ├── profile.js         # Modifica profilo e password
│   │   ├── users.js           # Gestione utenti admin (CRUD con modali)
│   │   ├── analytics.js       # Fetch statistiche e rendering Chart.js
│   │   ├── toast.js           # Sistema notifiche toast (success/error)
│   │   └── vendor/
│   │       └── chart.umd.min.js  # Chart.js (copiato da node_modules via postinstall)
│   └── uploads/               # Cartella presente ma non più usata (allegati rimossi)
└── views/
    ├── index.html             # Landing page pubblica
    ├── login.html             # Pagina di accesso
    ├── register.html          # Registrazione (solo utenti)
    ├── dashboard.html         # Dashboard principale con lista ticket
    ├── ticket.html            # Dettaglio ticket (?id=X come query param)
    ├── profile.html           # Profilo utente
    ├── users.html             # Gestione utenti (solo admin)
    └── analytics.html         # Statistiche e grafici (solo admin)
```

---

## Stack tecnologico

| Componente       | Tecnologia                        | Versione |
|-----------------|-----------------------------------|----------|
| Runtime          | Node.js                           | 18+      |
| Framework        | Express                           | 5.2.1    |
| Database         | SQLite tramite better-sqlite3     | —        |
| Sessioni         | express-session                   | —        |
| Hashing password | bcryptjs (salt round 10)          | —        |
| Email            | Nodemailer (Gmail SMTP, porta 587)| —        |
| Grafici          | Chart.js                          | —        |
| Frontend         | HTML, CSS, Vanilla JS             | —        |

---

## Database e schema

Il database SQLite viene inizializzato e popolato ad ogni avvio tramite `db.js`.

### Tabelle

#### `users`
| Colonna        | Tipo     | Vincoli                                      |
|----------------|----------|----------------------------------------------|
| id             | INTEGER  | PRIMARY KEY AUTOINCREMENT                    |
| first_name     | TEXT     | NOT NULL                                     |
| last_name      | TEXT     | NOT NULL                                     |
| email          | TEXT     | NOT NULL, UNIQUE                             |
| password_hash  | TEXT     | NOT NULL                                     |
| role           | TEXT     | NOT NULL — valori: `utente`, `operatore`, `admin` |
| created_at     | DATETIME | DEFAULT CURRENT_TIMESTAMP                    |

#### `tickets`
| Colonna     | Tipo     | Vincoli                                                         |
|-------------|----------|-----------------------------------------------------------------|
| id          | INTEGER  | PRIMARY KEY AUTOINCREMENT                                       |
| title       | TEXT     | NOT NULL                                                        |
| description | TEXT     | NOT NULL                                                        |
| category    | TEXT     | NOT NULL                                                        |
| status      | TEXT     | NOT NULL — valori: `aperto`, `in_corso`, `risolto`, `chiuso`    |
| priority    | TEXT     | NOT NULL — valori: `bassa`, `media`, `alta`, `urgente`          |
| user_id     | INTEGER  | REFERENCES users(id) ON DELETE CASCADE                          |
| operator_id | INTEGER  | REFERENCES users(id) ON DELETE SET NULL (nullable)              |
| rating      | INTEGER  | nullable — valori: 1–5 (inserito solo alla chiusura)            |
| created_at  | DATETIME | DEFAULT CURRENT_TIMESTAMP                                       |
| updated_at  | DATETIME | DEFAULT CURRENT_TIMESTAMP                                       |

#### `comments`
| Colonna     | Tipo     | Vincoli                                           |
|-------------|----------|---------------------------------------------------|
| id          | INTEGER  | PRIMARY KEY AUTOINCREMENT                         |
| ticket_id   | INTEGER  | REFERENCES tickets(id) ON DELETE CASCADE          |
| user_id     | INTEGER  | REFERENCES users(id) ON DELETE CASCADE            |
| content     | TEXT     | NOT NULL                                          |
| is_internal | INTEGER  | DEFAULT 0 (0 = pubblico, 1 = nota interna)        |
| created_at  | DATETIME | DEFAULT CURRENT_TIMESTAMP                         |

#### `status_history`
| Colonna    | Tipo     | Vincoli                                           |
|------------|----------|---------------------------------------------------|
| id         | INTEGER  | PRIMARY KEY AUTOINCREMENT                         |
| ticket_id  | INTEGER  | REFERENCES tickets(id) ON DELETE CASCADE          |
| old_status | TEXT     | —                                                 |
| new_status | TEXT     | NOT NULL                                          |
| changed_by | INTEGER  | REFERENCES users(id) ON DELETE SET NULL           |
| changed_at | DATETIME | DEFAULT CURRENT_TIMESTAMP                         |

### Indici

```sql
CREATE INDEX idx_tickets_status       ON tickets(status);
CREATE INDEX idx_tickets_operator_id  ON tickets(operator_id);
CREATE INDEX idx_tickets_user_id      ON tickets(user_id);
CREATE INDEX idx_tickets_created_at   ON tickets(created_at DESC);
CREATE INDEX idx_comments_ticket_id   ON comments(ticket_id);
CREATE INDEX idx_history_ticket_id    ON status_history(ticket_id);
```

### Pragma

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
```

---

## Sistema dei ruoli e permessi

### Utente

- Può **registrarsi** autonomamente dalla pagina `/register.html`
- Può **aprire ticket** (con categoria, priorità e descrizione)
- Vede **solo i propri ticket** nella dashboard
- Può **aggiungere commenti pubblici** ai propri ticket
- Non può aggiungere note interne
- Può **chiudere** (`chiuso`) un ticket risolto, con valutazione opzionale 1–5
- Può **riaprire** (`aperto`) un ticket già chiuso
- Non può cambiare status in `in_corso` o `risolto`
- Può **modificare** il proprio profilo (nome, email, password)
- **Non ha accesso** ad analytics, gestione utenti, o ticket altrui
- Riceve email per: registrazione, apertura ticket, risposta operatore, risoluzione, riapertura

### Operatore

- **Non può registrarsi** — l'account viene creato dall'admin
- **Non può aprire ticket**
- Vede **solo i ticket assegnati a lui**
- Può aggiungere **commenti pubblici e note interne** (visibili solo a staff)
- Può cambiare status solo in `in_corso` o `risolto`
- Non può chiudere o riaprire ticket (è l'utente a farlo)
- Può **modificare** il proprio profilo
- Non ha accesso alla gestione utenti
- Vede analytics limitata ai propri ticket (KPI e priorità)
- Riceve email per: nuovo ticket assegnato, commento dell'utente

### Admin

- **Non può aprire ticket**
- Vede **tutti i ticket** del sistema
- Vede la **coda dei ticket non assegnati**
- Può **riassegnare** qualsiasi ticket a qualsiasi operatore
- Può aggiungere commenti pubblici e note interne
- Può cambiare status a qualsiasi valore (`aperto`, `in_corso`, `risolto`, `chiuso`)
- Ha accesso completo alle **analytics**: KPI totali, grafici per priorità, metriche per operatore, workload
- Ha accesso alla **gestione utenti**: crea, modifica utenti con ruolo `utente` o `operatore`
- Non può creare altri admin tramite interfaccia (il ruolo `admin` è assegnabile solo via DB)
- Riceve email per: ticket riaperto dall'utente

---

## API — Endpoint completi

### Autenticazione — `/api/auth`

| Metodo | Path        | Auth richiesta | Descrizione                                    |
|--------|-------------|----------------|------------------------------------------------|
| POST   | `/register` | No             | Crea un account utente                         |
| POST   | `/login`    | No             | Login, crea la sessione                        |
| POST   | `/logout`   | Sì             | Distrugge la sessione e cancella il cookie     |
| GET    | `/me`       | Sì             | Restituisce i dati dell'utente corrente        |
| PUT    | `/profile`  | Sì             | Aggiorna nome, email e/o password              |

**POST /register** — Body JSON:
```json
{
  "first_name": "Marco",
  "last_name": "Bianchi",
  "email": "marco@example.com",
  "password": "password123",
  "confirm_password": "password123"
}
```
Risposte: `200 { success: true }` | `400 { error: "..." }` | `500 { error: "..." }`

**POST /login** — Body JSON:
```json
{ "email": "...", "password": "..." }
```
Risposte: `200 { success: true, redirect: "/dashboard.html" }` | `401 { error: "Credenziali non valide." }`

**PUT /profile** — Body JSON (password opzionale):
```json
{
  "first_name": "Marco",
  "last_name": "Bianchi",
  "email": "marco@example.com",
  "password": "nuova_password"
}
```

---

### Ticket — `/api/tickets`

| Metodo | Path               | Auth richiesta         | Descrizione                                          |
|--------|--------------------|------------------------|------------------------------------------------------|
| POST   | `/`                | Sì (solo utente)       | Crea ticket (solo testo), assegna operatore          |
| GET    | `/`                | Sì                     | Lista ticket (filtri + paginazione, scoped per ruolo)|
| GET    | `/:id`             | Sì                     | Dettaglio ticket con commenti e history              |
| POST   | `/:id/comments`    | Sì                     | Aggiunge commento o nota interna                     |
| PUT    | `/:id/status`      | Sì                     | Cambia status, registra history, invia email         |

**POST /** — Body JSON:
```json
{
  "title": "Problema con il PC",
  "description": "Il monitor non si accende.",
  "category": "Hardware",
  "priority": "alta"
}
```

**GET /** — Query params supportati:
```
status     = aperto|in_corso|risolto|chiuso
category   = testo libero
priority   = bassa|media|alta|urgente
operator   = id operatore (solo admin)
limit      = numero (max 200, default 50)
offset     = numero (default 0)
```

**POST /:id/comments** — Body JSON:
```json
{
  "content": "Testo del commento",
  "is_internal": false
}
```
> `is_internal: true` è accettato solo da operatori e admin.

**PUT /:id/status** — Body JSON:
```json
{
  "status": "risolto",
  "rating": 5
}
```
> `rating` (1–5) è opzionale, valido solo quando `status = "chiuso"`, inseribile solo dall'utente proprietario.

---

### Admin — `/api/admin`

| Metodo | Path                  | Auth richiesta | Descrizione                             |
|--------|-----------------------|----------------|-----------------------------------------|
| GET    | `/operators`          | Admin          | Lista operatori (per dropdown)          |
| GET    | `/users`              | Admin          | Lista tutti gli utenti                  |
| POST   | `/users`              | Admin          | Crea nuovo utente (utente o operatore)  |
| PUT    | `/users/:id`          | Admin          | Modifica utente esistente               |
| PUT    | `/tickets/:id/reassign` | Admin        | Riassegna ticket a un operatore         |

**POST /users** — Body JSON:
```json
{
  "first_name": "Luca",
  "last_name": "Rossi",
  "email": "luca@example.com",
  "password": "password123",
  "role": "operatore"
}
```

**PUT /tickets/:id/reassign** — Body JSON:
```json
{ "operator_id": 3 }
```

---

### Analytics — `/api/analytics`

| Metodo | Path           | Auth richiesta | Descrizione                                              |
|--------|----------------|----------------|----------------------------------------------------------|
| GET    | `/summary`     | Sì             | Conteggi per status + tempi medi (scoped per ruolo)      |
| GET    | `/by-priority` | Sì             | Conteggio ticket per priorità (operatore: solo i suoi)   |
| GET    | `/by-operator` | Admin          | Ticket risolti per operatore (ultimi 30 giorni)          |
| GET    | `/workload`    | Admin          | Ticket attivi (aperto + in_corso) per operatore          |

**GET /summary** — Risposta esempio:
```json
{
  "open": 5,
  "in_progress": 3,
  "resolved": 12,
  "closed": 8,
  "avg_first_response_hours": 2.4,
  "avg_resolution_hours": 18.7
}
```

---

### Health Check

| Metodo | Path          | Auth | Descrizione                    |
|--------|---------------|------|--------------------------------|
| GET    | `/api/health` | No   | Stato del server e del database|

---

## Regole di validazione

### Registrazione e profilo

| Campo            | Regola                                                         |
|------------------|----------------------------------------------------------------|
| `first_name`     | Obbligatorio, non vuoto                                        |
| `last_name`      | Obbligatorio, non vuoto                                        |
| `email`          | Obbligatorio, formato `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, UNIQUE  |
| `password`       | Obbligatorio, minimo 8 caratteri                               |
| `confirm_password` | Deve coincidere con `password`                               |

### Creazione ticket

| Campo        | Regola                                                      |
|--------------|-------------------------------------------------------------|
| `title`      | Obbligatorio, non vuoto                                     |
| `description`| Obbligatorio, non vuoto                                     |
| `category`   | Obbligatorio, non vuoto                                     |
| `priority`   | Obbligatorio — uno tra: `bassa`, `media`, `alta`, `urgente` |

### Status ticket

| Ruolo      | Status consentiti                    |
|------------|--------------------------------------|
| Utente     | `aperto` (riapertura), `chiuso`      |
| Operatore  | `in_corso`, `risolto`                |
| Admin      | Tutti (`aperto`, `in_corso`, `risolto`, `chiuso`) |

### Valutazione

| Campo    | Regola                                                                         |
|----------|--------------------------------------------------------------------------------|
| `rating` | Intero tra 1 e 5, opzionale, accettato solo se `status = "chiuso"`, solo dall'utente proprietario |

### Commenti

| Campo         | Regola                                                              |
|---------------|---------------------------------------------------------------------|
| `content`     | Obbligatorio, non può essere solo spazi bianchi                     |
| `is_internal` | Solo operatori e admin possono impostarlo a `true`                  |

### Creazione utente (admin)

| Campo        | Regola                                                    |
|--------------|-----------------------------------------------------------|
| `role`       | Solo `utente` o `operatore` — non è possibile creare admin|
| `email`      | Formato valido, UNIQUE                                    |
| `password`   | Minimo 8 caratteri                                        |
| Tutti i campi | Obbligatori                                              |

---

## Sessione

| Parametro  | Valore                                                         |
|------------|----------------------------------------------------------------|
| Store      | Memoria del processo (si azzera al riavvio del server)         |
| Secret     | `'esame-tiw'` hardcodato in `server.js`                        |
| `resave`   | `false`                                                        |
| `saveUninitialized` | `false`                                               |

Dati salvati nella sessione:
```json
{
  "userId": 1,
  "role": "utente",
  "username": "Mario Rossi"
}
```

---

## Notifiche email

Tutte le email vengono inviate tramite Gmail SMTP (porta 587) con Nodemailer. Il template base ha header viola/indaco con il logo DeskFlow, tabella dettagli a righe alternate e footer.

| Evento                            | Destinatario                            | Oggetto                                        |
|-----------------------------------|-----------------------------------------|------------------------------------------------|
| Registrazione completata          | Utente registrato                       | "Benvenuto su DeskFlow!"                       |
| Ticket aperto                     | Utente che ha aperto il ticket          | "Ticket #X aperto — [titolo]"                  |
| Ticket aperto                     | Operatore assegnato automaticamente     | "Nuovo ticket assegnato: #X — [titolo]"        |
| Operatore/admin risponde          | Utente proprietario del ticket          | "Nuova risposta al Ticket #X"                  |
| Utente risponde                   | Operatore assegnato                     | "Nuovo commento sul Ticket #X"                 |
| Ticket risolto                    | Utente proprietario del ticket          | "Ticket #X risolto"                            |
| Ticket riaperto dall'utente       | Tutti gli admin + operatore assegnato   | "Ticket #X riaperto dall'utente"               |
| Account creato dall'admin         | Nuovo utente                            | "Il tuo account DeskFlow è pronto"             |

> Le email vengono inviate **dopo** che la risposta è già stata inviata al client, quindi eventuali errori SMTP non bloccano l'operazione. Gli errori vengono loggati in console.

> **La password non viene mai inclusa nelle email**, nemmeno in quella di benvenuto per account creati dall'admin.

---

## Sicurezza

### Hashing password

bcryptjs con **salt round 10**. Le password non vengono mai salvate in chiaro né incluse in risposte API o email.

### Protezione SQL injection

Tutte le query usano **prepared statements** con parametri (`?`). Non viene mai concatenato input utente nelle query SQL.

### Protezione XSS

Tutti i dati provenienti dall'API vengono passati attraverso una funzione `esc()` prima di essere inseriti nel DOM via `innerHTML`. La funzione sostituisce `&`, `<`, `>`, `"`, `'` con le corrispondenti entità HTML. I messaggi di sistema usano `textContent`.

### Protezione open redirect

La funzione `safeRedirect()` accetta solo URL che iniziano con `/` e non con `//`. Qualsiasi altro URL viene sostituito con `/dashboard.html`.

### Integrità referenziale database

`PRAGMA foreign_keys = ON` attivato. Le relazioni usano `ON DELETE CASCADE` e `ON DELETE SET NULL` per evitare dati orfani.

---

## Limitazioni note

| Limitazione                  | Dettaglio                                                                                              |
|------------------------------|--------------------------------------------------------------------------------------------------------|
| **Session store in-memory**  | Le sessioni si perdono al riavvio del server.                                                          |
| **Database ricostruito all'avvio** | `db.js` ricrea tutte le tabelle e inserisce i dati di seed ad ogni `node server.js`. Ogni riavvio azzera tutti i dati. |
| **SQLite single-file**       | Non adatto ad alta concorrenza.                                                                        |
| **Email post-risposta**       | Gli errori SMTP vengono solo loggati in console, mai segnalati all'utente.                            |
| **Nessun rate limiting**      | `express-rate-limit` è installato come dipendenza ma non attivo su nessun endpoint.                   |
| **Nessun test automatico**    | Non è presente una test suite.                                                                        |
| **CORS non configurato**      | Funziona solo se frontend e backend sono serviti dalla stessa origine.                                |
| **Admin non creabile via UI** | Il ruolo `admin` non può essere assegnato tramite interfaccia — solo nel seed o direttamente nel DB.  |
