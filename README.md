# DeskFlow — Helpdesk & Ticketing System

Sistema di ticketing completo realizzato con **Node.js, Express e SQLite**. Il frontend è in **HTML, CSS e JavaScript vanilla**, senza framework. Il sistema gestisce tre ruoli utente (utente, operatore, admin), assegnazione automatica dei ticket, notifiche email, allegati, note interne e statistiche avanzate.

---

## Indice

1. [Avvio rapido](#avvio-rapido)
2. [Credenziali di test](#credenziali-di-test)
3. [Stack tecnologico](#stack-tecnologico)
4. [Struttura del progetto](#struttura-del-progetto)
5. [Variabili d'ambiente](#variabili-dambiente)
6. [Schema del database](#schema-del-database)
7. [API — Endpoints](#api--endpoints)
8. [Logica di business](#logica-di-business)
9. [Statistiche e formule](#statistiche-e-formule)
10. [Notifiche email](#notifiche-email)
11. [Dati di seed](#dati-di-seed)
12. [Design system](#design-system)
13. [Pagine frontend](#pagine-frontend)

---

## Avvio rapido

```bash
npm install
node server.js
# → http://localhost:4000
```

> **Attenzione:** ad ogni avvio il database viene ricreato e riseminato da zero (`db.js` esegue DROP TABLE e ricrea tutto). Questo comportamento è intenzionale nella fase di sviluppo. Tutti gli utenti, ticket e dati creati durante una sessione vengono persi al riavvio.

---

## Credenziali di test

Tutte le password del seed sono `password` (bcrypt, cost factor 10).

| Ruolo       | Email                | Note                          |
|-------------|----------------------|-------------------------------|
| Admin       | admin@test.com       | Accesso completo              |
| Operatore 1 | operatore1@test.com  |                               |
| Operatore 2 | operatore2@test.com  |                               |
| Operatore 3 | operatore3@test.com  |                               |
| Operatore 4 | operatore4@test.com  |                               |
| Operatore 5 | operatore5@test.com  |                               |
| Utente 1    | utente1@test.com     |                               |
| Utente 2    | utente2@test.com     |                               |
| Utente 3    | utente3@test.com     |                               |
| Utente 4    | utente4@test.com     |                               |
| Utente 5    | utente5@test.com     |                               |

---

## Stack tecnologico

| Layer      | Tecnologia                                                   |
|------------|--------------------------------------------------------------|
| Runtime    | Node.js                                                      |
| Framework  | Express.js                                                   |
| Database   | SQLite tramite `better-sqlite3` (sincrono, file locale)      |
| Sessioni   | `express-session` con cookie httpOnly, durata 24h            |
| Password   | `bcryptjs` (hash + salt, cost factor 10)                     |
| Email      | `nodemailer` con Gmail SMTP (porta 587, STARTTLS)            |
| Upload     | `multer` (disk storage, max 5 MB, tipi: jpg/png/gif/pdf)     |
| Config     | `dotenv` (file `.env`)                                       |
| Frontend   | HTML5, CSS3 (custom design system), JavaScript vanilla       |
| Grafici    | Chart.js (CDN)                                               |
| Icone      | Font Awesome 6 (CDN)                                         |
| Font       | DM Sans + JetBrains Mono (Google Fonts)                      |

---

## Struttura del progetto

```
TIW_ESAME/
├── server.js                 # Entry point: configura Express, sessioni, monta le route
├── db.js                     # Schema SQLite, DROP/CREATE tabelle, seeding iniziale
├── .env                      # Variabili d'ambiente (non committare in produzione)
│
├── routes/
│   ├── auth.js               # POST /register, POST /login, POST /logout, GET /me, PUT /profile
│   ├── tickets.js            # CRUD ticket, commenti, cambio stato, allegati
│   ├── admin.js              # Gestione utenti e riassegnazione ticket (solo admin)
│   └── analytics.js          # KPI, grafici, workload (admin/operatore)
│
├── middleware/
│   └── auth.js               # requireAuth, requireOperator, requireAdmin
│
├── utils/
│   └── email.js              # sendEmailNotification(), detailTable(), template HTML branded
│
├── views/                    # Pagine HTML servite staticamente
│   ├── index.html            # Landing page pubblica
│   ├── login.html            # Login con split layout
│   ├── register.html         # Registrazione con split layout
│   ├── dashboard.html        # Elenco ticket con filtri, ordinamento e KPI cards
│   ├── ticket.html           # Dettaglio ticket, commenti, allegati, cronologia stati
│   ├── analytics.html        # Statistiche e grafici (admin: completo · operatore: vista ridotta)
│   ├── profile.html          # Modifica profilo e password
│   └── users.html            # Gestione utenti (solo admin)
│
└── public/
    ├── css/
    │   └── style.css         # Design system completo (variabili, componenti, layout)
    ├── js/
    │   ├── auth.js           # Login, registrazione, logout, renderSidebarProfile
    │   ├── dashboard.js      # Caricamento ticket, filtri, KPI, modal nuovo ticket
    │   ├── ticket.js         # Dettaglio ticket, commenti, cambio stato, allegati
    │   ├── analytics.js      # Grafici Chart.js, KPI statistiche
    │   ├── users.js          # Tabella utenti, modal crea/modifica utente
    │   ├── profile.js        # Form aggiornamento profilo
    │   └── toast.js          # Sistema notifiche toast (showToast)
    └── uploads/              # File allegati caricati dagli utenti
```

---

## Variabili d'ambiente

File `.env` nella root del progetto:

```env
PORT=4000
SESSION_SECRET=super_secret_deskflow_key_2026
EMAIL_USER=tua_email@gmail.com
EMAIL_PASS=tua_app_password
```

| Variabile        | Descrizione                                                              |
|------------------|--------------------------------------------------------------------------|
| `PORT`           | Porta su cui gira il server Express (default: 3000 se assente)           |
| `SESSION_SECRET` | Chiave segreta per firmare i cookie di sessione                          |
| `EMAIL_USER`     | Indirizzo Gmail da cui partono le email automatiche                      |
| `EMAIL_PASS`     | App Password Gmail (non la password normale — generata in Account Google)|

> **Gmail App Password:** vai su Account Google → Sicurezza → Verifica in due passaggi → App password. L'SMTP di Gmail su porta 587 può essere bloccato da reti universitarie o aziendali; usa un hotspot mobile se le email non partono.

---

## Schema del database

### Tabella `users`

```sql
CREATE TABLE users (
    id            INTEGER  PRIMARY KEY AUTOINCREMENT,
    first_name    TEXT     NOT NULL,
    last_name     TEXT     NOT NULL,
    email         TEXT     UNIQUE NOT NULL,
    password_hash TEXT     NOT NULL,
    role          TEXT     NOT NULL DEFAULT 'utente'
                           CHECK(role IN ('utente', 'operatore', 'admin')),
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

| Colonna        | Dettaglio                                                |
|----------------|----------------------------------------------------------|
| `role`         | Valori ammessi: `utente`, `operatore`, `admin`           |
| `password_hash`| Hash bcrypt con salt, cost factor 10                     |
| `email`        | Vincolo UNIQUE — nessun duplicato ammesso                |

---

### Tabella `tickets`

```sql
CREATE TABLE tickets (
    id          INTEGER  PRIMARY KEY AUTOINCREMENT,
    title       TEXT     NOT NULL,
    description TEXT     NOT NULL,
    category    TEXT     NOT NULL,
    status      TEXT     NOT NULL CHECK(status IN ('aperto','in_corso','risolto','chiuso')),
    priority    TEXT     NOT NULL CHECK(priority IN ('bassa','media','alta','urgente')),
    user_id     INTEGER  NOT NULL REFERENCES users(id),
    operator_id INTEGER  REFERENCES users(id),
    rating      INTEGER  CHECK(rating BETWEEN 1 AND 5),
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

| Colonna       | Dettaglio                                                        |
|---------------|------------------------------------------------------------------|
| `category`    | Valori liberi nel form: Hardware · Software · Rete · Account · Altro |
| `status`      | `aperto` → `in_corso` → `risolto` → `chiuso` (o riapertura)    |
| `priority`    | `bassa` · `media` · `alta` · `urgente`                          |
| `operator_id` | NULL se nessun operatore disponibile al momento della creazione  |
| `rating`      | Da 1 a 5, impostato dall'utente solo alla chiusura del ticket    |
| `updated_at`  | Aggiornato ad ogni commento o cambio di stato                    |

---

### Tabella `comments`

```sql
CREATE TABLE comments (
    id          INTEGER  PRIMARY KEY AUTOINCREMENT,
    ticket_id   INTEGER  REFERENCES tickets(id),
    user_id     INTEGER  REFERENCES users(id),
    content     TEXT     NOT NULL,
    is_internal BOOLEAN  DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

| Colonna       | Dettaglio                                                              |
|---------------|------------------------------------------------------------------------|
| `is_internal` | `0` = commento pubblico visibile a tutti · `1` = nota interna (solo staff) |

---

### Tabella `status_history`

```sql
CREATE TABLE status_history (
    id          INTEGER  PRIMARY KEY AUTOINCREMENT,
    ticket_id   INTEGER  NOT NULL REFERENCES tickets(id),
    old_status  TEXT,
    new_status  TEXT     NOT NULL,
    changed_by  INTEGER  NOT NULL REFERENCES users(id),
    changed_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

| Colonna      | Dettaglio                                                       |
|--------------|-----------------------------------------------------------------|
| `old_status` | NULL per il primo evento (creazione del ticket)                 |
| `changed_at` | Timestamp esplicito — usato nelle formule delle metriche        |

Ogni transizione di stato genera una riga in questa tabella, costruendo una cronologia completa della vita del ticket.

---

### Tabella `attachments`

```sql
CREATE TABLE attachments (
    id            INTEGER  PRIMARY KEY AUTOINCREMENT,
    ticket_id     INTEGER  NOT NULL REFERENCES tickets(id),
    filename      TEXT     NOT NULL,
    original_name TEXT     NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

| Colonna         | Dettaglio                                                      |
|-----------------|----------------------------------------------------------------|
| `filename`      | Nome univoco su disco (timestamp + random, es. `1716900123-938472.pdf`) |
| `original_name` | Nome originale del file caricato dall'utente                   |

I file fisici sono salvati in `public/uploads/` e serviti staticamente da Express.

---

## API — Endpoints

### Autenticazione — `/api/auth`

| Metodo | Endpoint           | Auth | Descrizione |
|--------|--------------------|------|-------------|
| POST   | `/register`        | No   | Crea account con ruolo `utente`. Invia email di benvenuto. |
| POST   | `/login`           | No   | Verifica credenziali, crea sessione. |
| POST   | `/logout`          | Sì   | Distrugge la sessione e cancella il cookie. |
| GET    | `/me`              | Sì   | Restituisce i dati dell'utente corrente (letti freschi dal DB). |
| PUT    | `/profile`         | Sì   | Aggiorna nome, cognome, email e password (opzionale). |

---

### Ticket — `/api/tickets`

| Metodo | Endpoint                  | Auth            | Descrizione |
|--------|---------------------------|-----------------|-------------|
| POST   | `/`                       | `utente`        | Crea ticket con assegnazione automatica. Fino a 3 allegati. Invia email. |
| GET    | `/`                       | Qualsiasi       | Lista ticket filtrata per ruolo + query string (category, status, priority, sort). |
| GET    | `/:id`                    | Qualsiasi       | Dettaglio ticket con commenti, allegati e cronologia stati. |
| POST   | `/:id/comments`           | Qualsiasi       | Aggiunge commento pubblico o nota interna (solo staff). |
| PUT    | `/:id/status`             | Qualsiasi       | Cambia stato del ticket secondo i permessi del ruolo. |

**Filtri disponibili su `GET /api/tickets`:**

| Parametro     | Valori                               | Chi può usarlo |
|---------------|--------------------------------------|----------------|
| `category`    | Hardware, Software, Rete, Account, Altro | Tutti      |
| `status`      | aperto, in_corso, risolto, chiuso    | Tutti          |
| `priority`    | bassa, media, alta, urgente          | Tutti          |
| `operator_id` | ID numerico dell'operatore           | Solo admin     |
| `sort`        | `oldest` (default: newest first)     | Tutti          |

---

### Admin — `/api/admin`

Tutti gli endpoint richiedono ruolo `admin`.

| Metodo | Endpoint                  | Descrizione |
|--------|---------------------------|-------------|
| GET    | `/users`                  | Lista tutti gli utenti ordinati per ruolo (admin → operatori → utenti). |
| POST   | `/users`                  | Crea utente con ruolo `utente` o `operatore`. Invia email con credenziali. |
| PUT    | `/users/:id`              | Modifica anagrafica, ruolo e password (opzionale) di un utente. |
| GET    | `/operators`              | Lista solo gli operatori (usata nel dropdown di riassegnazione). |
| PUT    | `/tickets/:id/reassign`   | Riassegna un ticket a un altro operatore. |

---

### Analytics — `/api/analytics`

| Metodo | Endpoint         | Auth                    | Descrizione |
|--------|------------------|-------------------------|-------------|
| GET    | `/summary`       | Qualsiasi autenticato   | KPI cards: conteggi per stato + tempi medi. I valori sono filtrati per ruolo. |
| GET    | `/by-priority`   | Admin + Operatore       | Conteggio ticket per priorità (grafico doughnut). Per l'operatore: filtrato sui propri ticket assegnati. |
| GET    | `/by-operator`   | Admin                   | Ticket risolti/chiusi per operatore negli ultimi 30 giorni (grafico bar). |
| GET    | `/workload`      | Admin                   | Ticket attivi per operatore (grafico carico di lavoro). |

---

## Logica di business

### Ruoli e permessi

| Azione                              | Utente | Operatore        | Admin |
|-------------------------------------|--------|------------------|-------|
| Creare ticket                       | ✅     | ❌               | ❌    |
| Vedere i propri ticket              | ✅     | —                | —     |
| Vedere i ticket assegnati           | —      | ✅               | —     |
| Vedere tutti i ticket               | —      | —                | ✅    |
| Aggiungere commento pubblico        | ✅     | ✅               | ✅    |
| Aggiungere nota interna             | ❌     | ✅               | ✅    |
| Cambiare stato → in_corso / risolto | ❌     | ✅               | ✅    |
| Chiudere o riaprire ticket          | ✅     | ❌               | ✅    |
| KPI card sulla dashboard            | ❌     | ✅ (propri)      | ✅    |
| Pagina Statistiche (vista ridotta)  | ❌     | ✅ (propri)      | —     |
| Pagina Statistiche (vista completa) | ❌     | —                | ✅    |
| Gestire utenti                      | ❌     | ❌               | ✅    |
| Riassegnare ticket                  | ❌     | ❌               | ✅    |

---

### Assegnazione automatica dei ticket

Quando un utente crea un ticket, il sistema seleziona automaticamente l'operatore con il **minor numero di ticket attivi** (stati `aperto` o `in_corso`). In caso di parità, l'ordine è randomico (`RANDOM()`), garantendo distribuzione equa anche tra operatori appena creati.

```sql
SELECT u.id, COUNT(t.id) as open_tickets
FROM users u
LEFT JOIN tickets t
  ON u.id = t.operator_id
  AND t.status IN ('aperto', 'in_corso')
WHERE u.role = 'operatore'
GROUP BY u.id
ORDER BY open_tickets ASC, RANDOM()
LIMIT 1
```

Se non esistono operatori nel sistema, `operator_id` rimane `NULL` e il ticket è visibile solo all'admin.

---

### Transizioni di stato consentite per ruolo

```
aperto ──────────────────────────────────────────►
         [operatore/admin] → in_corso
                              │
                              ▼
                           risolto ──[utente]──► chiuso
                              │
                              └──[utente]──────► aperto (riapertura)
```

| Ruolo      | Può passare a              | Non può passare a         |
|------------|----------------------------|---------------------------|
| Utente     | `chiuso`, `aperto`         | `in_corso`, `risolto`     |
| Operatore  | `in_corso`, `risolto`      | `chiuso`, `aperto`        |
| Admin      | Qualsiasi                  | —                         |

> Un utente può chiudere solo un ticket nello stato `risolto`, e può riaprire solo un ticket già `risolto` o `chiuso`.

---

### Note interne

I commenti con `is_internal = 1` sono visibili solo a operatori e admin. Quando un utente richiede i dettagli di un ticket, la query aggiunge automaticamente:

```sql
AND c.is_internal = 0
```

Questo filtro è applicato lato server — gli utenti non ricevono mai i dati delle note interne, nemmeno nascosti nel markup.

---

### Allegati

- Configurati tramite `multer` con disk storage in `public/uploads/`
- Massimo **3 file per ticket**, ciascuno fino a **5 MB**
- Tipi ammessi: `jpeg`, `jpg`, `png`, `gif`, `pdf` (validati sia per estensione che per MIME type)
- Il nome su disco è generato come `{timestamp}-{random}{estensione}` per evitare collisioni
- Il nome originale è salvato nella tabella `attachments` e mostrato in UI

---

### Valutazione (rating)

L'utente può lasciare una valutazione da 1 a 5 stelle solo nel momento in cui **chiude** il ticket (stato `chiuso`). Il rating viene salvato nella colonna `tickets.rating` tramite:

```sql
UPDATE tickets SET rating = ? WHERE id = ?
```

---

### Gestione utenti da admin

L'admin può creare nuovi utenti e operatori dalla sezione Utenti. Le credenziali vengono inviate via email al nuovo account. L'admin non può creare altri admin dall'interfaccia. La lista utenti è ordinata per priorità di ruolo:

```sql
ORDER BY
    CASE role WHEN 'admin' THEN 0 WHEN 'operatore' THEN 1 ELSE 2 END ASC,
    created_at ASC
```

---

## Statistiche e formule

### Come funziona `julianday()`

SQLite non ha un tipo `TIMESTAMP` nativo con operazioni aritmetiche dirette. La funzione `julianday(datetime)` converte qualsiasi stringa datetime in un numero decimale che rappresenta i **giorni giuliani** (giorni trascorsi dal 1° gennaio 4713 a.C.). La differenza tra due `julianday` è espressa in giorni; moltiplicando per 24 si ottengono le ore.

```
(julianday('2026-05-10 15:30:00') - julianday('2026-05-10 11:30:00')) * 24 = 4.0 ore
```

---

### Tempo medio di prima risposta (ore)

Misura quanto tempo passa dalla **creazione del ticket** al momento in cui un operatore lo prende in carico per la prima volta (`in_corso`). Per ogni ticket viene considerato solo il **primo** evento `in_corso` (MIN).

```sql
SELECT ROUND(
    AVG(
        (julianday(sh.changed_at) - julianday(t.created_at)) * 24
    ), 1
) AS avgFirstResponse
FROM tickets t
INNER JOIN (
    SELECT ticket_id, MIN(changed_at) AS changed_at
    FROM status_history
    WHERE new_status = 'in_corso'
    GROUP BY ticket_id
) sh ON sh.ticket_id = t.id
```

---

### Tempo medio di risoluzione (ore)

Misura quanto tempo passa dalla **creazione del ticket** al momento in cui viene marcato come `risolto` per la prima volta.

```sql
SELECT ROUND(
    AVG(
        (julianday(sh.changed_at) - julianday(t.created_at)) * 24
    ), 1
) AS avgResolutionTime
FROM tickets t
INNER JOIN (
    SELECT ticket_id, MIN(changed_at) AS changed_at
    FROM status_history
    WHERE new_status = 'risolto'
    GROUP BY ticket_id
) sh ON sh.ticket_id = t.id
```

---

### Risposta completa di `/api/analytics/summary`

```json
{
  "open": 7,
  "in_progress": 3,
  "resolved": 3,
  "closed": 2,
  "avgFirstResponse": 4.6,
  "avgResolutionTime": 27.6
}
```

> I valori `open`, `in_progress`, `resolved`, `closed` sono filtrati per ruolo: un utente vede solo i propri ticket, un operatore solo quelli assegnati a lui, l'admin vede tutto.

---

### Grafico priorità (Doughnut)

Endpoint: `GET /api/analytics/by-priority` — accessibile ad admin e operatori.

Per l'**admin** restituisce tutti i ticket del sistema. Per l'**operatore** restituisce solo i ticket assegnati a lui:

```sql
-- Admin
SELECT priority, COUNT(*) as count FROM tickets GROUP BY priority

-- Operatore
SELECT priority, COUNT(*) as count FROM tickets WHERE operator_id = ? GROUP BY priority
```

Le priorità nel DB sono in italiano. Mappatura colori in `public/js/analytics.js`:

| Priorità | Colore   | Hex       |
|----------|----------|-----------|
| bassa    | Grigio   | `#94a3b8` |
| media    | Giallo   | `#facc15` |
| alta     | Arancio  | `#fb923c` |
| urgente  | Rosso    | `#f87171` |

---

### Grafico operatori (Bar)

Endpoint: `GET /api/analytics/by-operator` (solo admin)

Ticket risolti o chiusi negli ultimi 30 giorni per operatore:

```sql
SELECT u.first_name || ' ' || u.last_name as username,
       COUNT(t.id) as resolved_count
FROM users u
LEFT JOIN tickets t
  ON u.id = t.operator_id
  AND t.status IN ('risolto', 'chiuso')
  AND t.updated_at >= date('now', '-30 days')
WHERE u.role = 'operatore'
GROUP BY u.id
```

---

### Grafico carico di lavoro (Workload)

Endpoint: `GET /api/analytics/workload` (solo admin)

Ticket attivi (aperto + in_corso) per operatore in questo momento:

```sql
SELECT u.first_name || ' ' || u.last_name as username,
       COUNT(t.id) as active_tickets
FROM users u
LEFT JOIN tickets t
  ON u.id = t.operator_id
  AND t.status IN ('aperto', 'in_corso')
WHERE u.role = 'operatore'
GROUP BY u.id
ORDER BY active_tickets ASC
```

---

## Notifiche email

Gestite da `utils/email.js` tramite **Nodemailer + Gmail SMTP** (porta 587, STARTTLS). Ogni email viene automaticamente avvolta in un template HTML branded con header scuro DeskFlow, barra gradiente indigo e footer.

### Tutti i casi in cui viene inviata un'email

| # | Evento | Destinatario | Oggetto email |
|---|--------|--------------|---------------|
| 1 | Utente si registra autonomamente | L'utente appena registrato | "Benvenuto/a su DeskFlow!" |
| 2 | Admin crea un nuovo utente o operatore | Il nuovo account creato | "Il tuo account DeskFlow è pronto" (include email e password in chiaro) |
| 3 | Utente apre un nuovo ticket | L'utente creatore | "Ticket #N aperto — titolo" (conferma di apertura) |
| 4 | Utente apre un nuovo ticket | L'operatore assegnato automaticamente | "Nuovo ticket assegnato: #N — titolo" |
| 5 | Operatore o admin aggiunge un commento **pubblico** | L'utente creatore del ticket | "Nuova risposta al Ticket #N" |
| 6 | Utente aggiunge un commento | L'operatore assegnato al ticket | "Nuovo commento sul Ticket #N" |
| 7 | Operatore o admin marca il ticket come `risolto` | L'utente creatore del ticket | "Ticket #N risolto" |
| 8 | Utente riapre un ticket (da `risolto` → `aperto`) | Tutti gli admin + operatore assegnato | "Ticket #N riaperto dall'utente" |

> **Note interne (commento con `is_internal = 1`):** non generano alcuna notifica email, né verso l'utente né verso altri.

> **Fire-and-forget:** le email partono in modo asincrono senza bloccare la risposta HTTP. Se l'SMTP fallisce, l'errore viene loggato in console (`Errore invio email: ...`) ma l'operazione principale va comunque a buon fine.

> **Spam:** le email potrebbero essere filtrate la prima volta. Aggiungere il mittente ai contatti o cliccare "Non spam" risolve il problema.

### Funzioni esportate da `utils/email.js`

```js
// Invia una email wrappata nel template branded. Async, può essere chiamata senza await.
sendEmailNotification(to, subject, bodyHtml)

// Genera una tabella HTML stilata con righe alternate per mostrare coppie chiave/valore.
// Esempio: detailTable([['Ticket', '#42'], ['Priorità', 'alta'], ['Categoria', 'Rete']])
detailTable(rows)
```

---

## Dati di seed

Ad ogni avvio vengono creati: 1 admin, 5 operatori, 5 utenti e 15 ticket con timestamp realistici nel passato e transizioni di stato coerenti, così da produrre metriche significative fin dal primo avvio.

### Logica di assegnazione nel seed

- I ticket con indice multiplo di 3 (i=3,6,9,12,15) non hanno operatore (`operator_id = NULL`) → stato forzato `aperto`
- Gli altri ticket sono distribuiti ciclicamente tra i 5 operatori (`opIds[i % 5]`)

### Tabella timing ticket

| Ticket | Stato    | Creato   | → in_corso | → risolto | → chiuso |
|--------|----------|----------|------------|-----------|----------|
| 1      | in_corso | −25 gg   | +3 h       | —         | —        |
| 2      | risolto  | −22 gg   | +5 h       | +24 h     | —        |
| 3      | aperto   | −20 gg   | —          | —         | —        |
| 4      | aperto   | −18 gg   | —          | —         | —        |
| 5      | in_corso | −16 gg   | +2 h       | —         | —        |
| 6      | aperto   | −14 gg   | —          | —         | —        |
| 7      | chiuso   | −12 gg   | +8 h       | +36 h     | +48 h    |
| 8      | aperto   | −10 gg   | —          | —         | —        |
| 9      | aperto   | −8 gg    | —          | —         | —        |
| 10     | risolto  | −6 gg    | +4 h       | +20 h     | —        |
| 11     | chiuso   | −5 gg    | +6 h       | +30 h     | +44 h    |
| 12     | aperto   | −4 gg    | —          | —         | —        |
| 13     | in_corso | −3 gg    | +2 h       | —         | —        |
| 14     | risolto  | −2 gg    | +7 h       | +28 h     | —        |
| 15     | aperto   | −1 gg    | —          | —         | —        |

### Calcolo manuale delle metriche di seed

Ticket con evento `in_corso`: 1, 2, 5, 7, 10, 11, 13, 14 → ore: 3, 5, 2, 8, 4, 6, 2, 7

**Tempo medio prima risposta** = (3+5+2+8+4+6+2+7) / 8 = **4.6 ore**

Ticket con evento `risolto`: 2, 7, 10, 11, 14 → ore dalla creazione: 24, 36, 20, 30, 28

**Tempo medio risoluzione** = (24+36+20+30+28) / 5 = **27.6 ore**

---

## Design system

Il design system è definito interamente in `public/css/style.css` tramite variabili CSS.

### Palette principale

```css
--bg-app:      #f6f5f1   /* workspace, sfondo caldo crema               */
--bg-subtle:   #f0eeea   /* sfondo leggermente più scuro del workspace  */
--bg-surface:  #ffffff   /* card, modal, pannelli                        */
--side-bg:     #0e1116   /* sidebar scura                                */
--accent:      #4f46e5   /* indigo — bottoni primari, link attivi        */
--accent-hover:#4338ca   /* indigo scuro — hover stato                  */
--text:        #111827   /* testo principale                             */
--text-2:      #374151   /* testo secondario                             */
--text-muted:  #6b7280   /* testo attenuato, label, placeholder          */
--border:      #e5e7eb   /* bordi card, input, separatori                */
```

### Font

| Font           | Uso                                      |
|----------------|------------------------------------------|
| DM Sans        | Tutto il testo UI (pesi 400/500/600/700) |
| JetBrains Mono | ID ticket, codice, badge `.mono`         |

### Pagine di autenticazione (login/register)

Split layout: pannello sinistro scuro con gradiente `#0d1117 → #111827 → #1e1b4b`, blob luminoso top-right in indigo, griglia di punti in overlay. Pannello destro bianco con form. Il bottone primario ha gradiente `#4f46e5 → #7c3aed` con glow shadow.

---

## Pagine frontend

| Pagina            | File HTML          | File JS principale  | Accesso                              |
|-------------------|--------------------|---------------------|--------------------------------------|
| Landing           | `index.html`       | —                   | Pubblico                             |
| Login             | `login.html`       | `auth.js`           | Pubblico                             |
| Registrazione     | `register.html`    | `auth.js`           | Pubblico                             |
| Dashboard         | `dashboard.html`   | `dashboard.js`      | Qualsiasi autenticato                |
| Dettaglio ticket  | `ticket.html`      | `ticket.js`         | Qualsiasi autenticato                |
| Statistiche       | `analytics.html`   | `analytics.js`      | Admin + Operatore (utenti: redirect a dashboard) |
| Profilo           | `profile.html`     | `profile.js`        | Qualsiasi autenticato                |
| Gestione utenti   | `users.html`       | `users.js`          | Solo admin (redirect a dashboard)    |

### Comportamento post-registrazione

Dopo la registrazione, l'utente **non viene loggato automaticamente**. Viene mostrata una schermata di conferma con conto alla rovescia (3 secondi) e poi reindirizzato a `/login.html`. Una email di benvenuto viene inviata all'indirizzo registrato.

### Sidebar

La sidebar mostra link diversi in base al ruolo, gestiti lato client in `dashboard.js` tramite `classList.remove('hidden')`:

| Ruolo      | Link visibili nella sidebar                         | Extra nella dashboard              |
|------------|-----------------------------------------------------|------------------------------------|
| Utente     | Dashboard · Il mio profilo                          | —                                  |
| Operatore  | Dashboard · **Statistiche** · Il mio profilo        | KPI card con i propri ticket       |
| Admin      | Dashboard · Statistiche · Utenti · Il mio profilo   | KPI card globali + filtro operatore |

Gli operatori accedono alla pagina Statistiche con una vista ridotta: KPI personali (ticket aperti, risolti, tempi medi) e grafico a ciambella della distribuzione priorità **sui propri ticket assegnati**. I grafici admin-only (risolti per operatore, carico di lavoro del team) restano nascosti.
