# DeskFlow — Sistema di Helpdesk e Ticketing

DeskFlow è un'applicazione web per la gestione del supporto tecnico. Permette agli utenti di aprire ticket di assistenza, agli operatori di gestirli e agli amministratori di coordinare tutto il sistema.

---

## Come avviare il progetto

**Requisiti:** Node.js 18+

```bash
# 1. Installa le dipendenze
npm install

# 2. Crea il file di configurazione
cp .env.example .env
# Poi apri .env e compila i valori

# 3. Avvia il server
node server.js
```

Il server si avvia su `http://localhost:3000`.

### Credenziali di test (dopo il seeding automatico)

| Ruolo     | Email               | Password |
|-----------|---------------------|----------|
| Admin     | admin@test.com      | password |
| Operatore | operatore1@test.com | password |
| Utente    | utente1@test.com    | password |

> Il database viene ricreato ad ogni avvio con dati di esempio. Questa è una scelta intenzionale per lo sviluppo.

---

## Variabili d'ambiente richieste

Crea un file `.env` nella root del progetto con questi valori:

```
SESSION_SECRET=una_stringa_casuale_lunga_almeno_32_caratteri
EMAIL_USER=tua_email@gmail.com
EMAIL_PASS=app_password_gmail
PORT=3000
```

> **Importante:** il server non si avvia se `SESSION_SECRET` non è impostato.

---

## Funzionalità principali

- **Apertura ticket** con categoria, priorità e allegati (fino a 3 file, max 5 MB ciascuno)
- **Assegnazione automatica** all'operatore con meno ticket aperti
- **Gestione ruoli** — Admin, Operatore, Utente — con permessi distinti
- **Note interne** visibili solo agli operatori e agli admin
- **Notifiche email** automatiche ad ogni evento rilevante
- **Dashboard** con statistiche, filtri e grafici
- **Valutazione** del supporto alla chiusura del ticket (1–5 stelle)

---

## Struttura del progetto

```
├── server.js           # Punto di ingresso del server Express
├── db.js               # Configurazione SQLite e seeding dati
├── routes/
│   ├── auth.js         # Login, registrazione, profilo
│   ├── tickets.js      # Creazione, lista, dettaglio, commenti
│   ├── admin.js        # Gestione utenti e riassegnazione ticket
│   └── analytics.js    # Statistiche e KPI
├── middleware/
│   └── auth.js         # Protezione delle rotte (requireAuth, requireAdmin)
├── utils/
│   └── email.js        # Invio notifiche email con Nodemailer
├── public/
│   ├── css/style.css   # Stile dell'applicazione
│   ├── js/             # JavaScript del frontend
│   └── uploads/        # File allegati ai ticket
└── views/              # Pagine HTML
```

---

## Miglioramenti di sicurezza applicati

Di seguito le vulnerabilità corrette, spiegate in modo semplice.

### Protezione da XSS (Cross-Site Scripting)

**Problema:** titoli di ticket, commenti e nomi utente venivano inseriti direttamente nel codice HTML della pagina. Un utente poteva scrivere codice JavaScript nel titolo di un ticket e farlo eseguire nel browser di chiunque aprisse quella pagina.

**Soluzione:** tutti i dati che arrivano dall'API vengono ora "puliti" prima di essere mostrati. I caratteri speciali come `<`, `>` e `"` vengono trasformati in versioni innocue. Questo vale per commenti, nomi utente, titoli e tutti i campi inseriti dagli utenti.

---

### Password non più inviata via email

**Problema:** quando un admin creava un nuovo account, la password veniva inclusa nell'email di benvenuto. Chiunque potesse leggere quell'email aveva accesso all'account.

**Soluzione:** l'email di benvenuto mostra ora solo l'indirizzo email e il ruolo dell'utente, senza la password.

---

### Cookie di sessione più sicuri

**Problema:** il cookie che mantiene l'utente loggato mancava di alcune protezioni importanti.

**Soluzione:**
- `sameSite: Strict` — il cookie non viene mai inviato da altri siti, proteggendo da attacchi CSRF
- `secure: true` in produzione — il cookie viaggia solo su connessioni HTTPS
- `httpOnly: true` — già presente, impedisce a JavaScript di leggere il cookie

---

### Limite ai tentativi di login

**Problema:** non c'era nessun limite al numero di tentativi di accesso. Un attaccante poteva provare migliaia di password senza essere bloccato.

**Soluzione:** dopo 10 tentativi falliti in 15 minuti dallo stesso indirizzo IP, l'accesso viene temporaneamente bloccato. La registrazione è limitata a 5 tentativi per ora.

---

### Intestazioni di sicurezza HTTP

**Problema:** il server non inviava alcune intestazioni standard che il browser usa per proteggersi da certi tipi di attacco.

**Soluzione:** aggiunto Helmet.js, che aggiunge automaticamente le intestazioni di sicurezza più importanti, come `X-Frame-Options` (previene il clickjacking) e `X-Content-Type-Options` (previene il MIME sniffing).

---

### Validazione dei dati in ingresso

**Problema:** il server accettava dati mal formati — email non valide, password di un carattere, valutazioni fuori scala.

**Soluzione:**
- L'email deve avere un formato valido (`nome@dominio.estensione`)
- La password deve essere di almeno 8 caratteri
- La valutazione di un ticket deve essere un numero intero tra 1 e 5

---

### Reindirizzamento sicuro dopo il login

**Problema:** dopo il login, il browser veniva reindirizzato all'URL ricevuto dalla risposta del server senza verificarlo. Un URL esterno malevolo avrebbe potuto mandare l'utente su un altro sito.

**Soluzione:** il reindirizzamento avviene solo se l'URL inizia con `/` (percorso relativo). Qualsiasi URL esterno viene ignorato e sostituito con la dashboard.

---

### Upload di file atomico

**Problema:** quando si allegavano più file a un ticket, se uno degli inserimenti nel database falliva, i file rimanevano sul disco senza riferimento nel database.

**Soluzione:** tutti gli inserimenti degli allegati avvengono in una singola transazione. Se qualcosa va storto, tutto viene annullato e i file già scritti sul disco vengono eliminati.

---

### Indici sul database

**Problema:** le query di filtro scansionavano tutta la tabella dei ticket ad ogni richiesta. Con migliaia di ticket, questo sarebbe diventato molto lento.

**Soluzione:** aggiunti 6 indici sulle colonne più usate nei filtri (`status`, `operator_id`, `user_id`, `created_at`). Le query sono ora significativamente più veloci.

---

### Paginazione sulla lista ticket

**Problema:** la lista dei ticket caricava tutti i record in una volta. Con molti ticket, questo avrebbe saturato la memoria del server e rallentato il browser.

**Soluzione:** la lista accetta i parametri `limit` (massimo 200, default 50) e `offset` per caricare i ticket a blocchi.

---

### Avvio sicuro del server

**Problema:** se `SESSION_SECRET` non era configurato, il server usava un valore di default debole, rendendo le sessioni facilmente falsificabili.

**Soluzione:** se `SESSION_SECRET` non è presente nel file `.env`, il server si rifiuta di avviarsi e mostra un errore chiaro.

---

### Integrità del database

**Problema:** SQLite non attiva i vincoli sulle chiavi esterne per default. Eliminando un utente, i suoi ticket e commenti sarebbero rimasti nel database senza un riferimento valido.

**Soluzione:** attivata l'opzione `PRAGMA foreign_keys = ON` e aggiunte le regole `ON DELETE CASCADE` (elimina i dati collegati) e `ON DELETE SET NULL` (rimuove solo il riferimento senza eliminare il record).

---

## Stack tecnologico

| Componente | Tecnologia |
|------------|------------|
| Backend    | Node.js, Express 5 |
| Database   | SQLite (better-sqlite3) |
| Sessioni   | express-session |
| Password   | bcryptjs |
| Email      | Nodemailer (Gmail SMTP) |
| Upload     | Multer |
| Sicurezza  | Helmet, express-rate-limit |
| Frontend   | HTML, CSS, Vanilla JS |
