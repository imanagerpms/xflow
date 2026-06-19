# xFlow

Interfaccia low-code interattiva e runtime outcome-first per progettare, simulare e recuperare automazioni operative per piccoli business.

## Funzionalita

- Canvas visuale con nodi trigger, decisioni, tool, task umani, outcome e stati terminali.
- Catalogo hospitality canonico di 40 playbook: 8 aree da 5 flussi, 30 Core e 10 Avanzati.
- Selettore business con esempi verticali: studio dentistico, ristorante, poliambulatorio e boutique fitness, 15 flow ciascuno.
- Tre flussi pilota eseguibili end-to-end: check-in e accesso, guasto in soggiorno e richiesta rimborso.
- State machine per run e step con outcome routing, timeout, retry/backoff e idempotenza simulata.
- Registry di tool mock con failure injection deterministica e scenari riproducibili.
- Business outcome, capability e provider separati; success contract verificabili per campi ed evidenze.
- Fallback playbook con completamento manuale, provider alternativo, workaround e outcome equivalente.
- Operations Inbox per il macro-obiettivo e Technical Inbox separata per provider e integrazioni.
- Task umani strutturati, ripresa deterministica, audit timeline e recovery dopo refresh.
- Editor visuale per outcome, policy, success contract e fallback.
- Ricerca trasversale per nome, descrizione, prompt, trigger e tool.
- Layout responsive desktop e mobile, senza framework o build.

## Avvio

Non sono richieste dipendenze o build.

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Aprire [http://127.0.0.1:4173](http://127.0.0.1:4173).

## Demo principale

Nel Simulatore selezionare `Check-in online e accesso` e lo scenario `Smart lock in timeout`. Il runtime esegue tre tentativi, apre il task operativo `Garantire accesso all'ospite` e registra separatamente l'issue tecnica. Risolvere il task con `Chiave fisica` o `Codice manuale`: il flow riparte da invio istruzioni, aggiorna il PMS e completa il success contract senza ripetere lo step smart lock.

## Test

```bash
npm test
npm run check
```

La suite usa il test runner integrato di Node e non installa dipendenze. Copre catalogo, transizioni, routing, retry/backoff, idempotenza, success contract, task umani, ripresa, fallback manutenzione, rimborso e persistenza.

## Struttura

- `index.html`: shell, viste applicative e sprite delle icone.
- `styles.css`: design system, layout densi e breakpoint responsive.
- `catalog.js`: gruppi, business demo, metadata e definizioni dei playbook.
- `app.js`: router UI, editor, simulatore, inbox e integrazione del runtime.
- `runtime.js`: state machine deterministica per run, step, tool attempt e task.
- `mock-tools.js`: registry tool mock, failure injection e cache di idempotenza.
- `scenarios.js`: definizioni eseguibili dei tre piloti e scenari demo.
- `task-catalog.js`: task outcome-first e validazione dei success contract.
- `policies.js`: soglie e regole configurabili del prototipo.
- `audit.js`: eventi ordinati della timeline.
- `storage.js`: persistenza runtime versionata tramite `bnbflow-runtime-v1`.
- `tests/`: test automatici senza dipendenze esterne.

## Persistenza e limiti

Il catalogo/editor continua a usare la chiave legacy `bnbflow-state-v2`; run, task, issue e audit usano lo schema versionato `bnbflow-runtime-v1`. Il progetto resta un prototipo frontend: tool call, clock e integrazioni esterne sono simulati. Per un ambiente reale servono backend, autenticazione, coda durevole, gestione sicura dei segreti e connettori verso PMS, smart lock, pagamenti e messaggistica.
