# AGENTS.md

## Obiettivo

Mantenere `bnbFlow Studio` come editor low-code operativo per automazioni hospitality, con flussi comprensibili a property manager e prompt abbastanza realistici da fungere da base per un'implementazione reale.

## Architettura

L'app e statica e non usa framework o dipendenze:

- `index.html` contiene lo shell applicativo e le icone SVG riutilizzabili.
- `styles.css` contiene token visivi, layout a tre colonne e breakpoint responsive.
- `catalog.js` espone `BNBFLOW_CATALOG` con gli 8 gruppi, i metadata dei flussi base e i flussi generati.
- `app.js` contiene i 6 flussi base, integra il catalogo e gestisce shell UI, router delle viste, editor e inbox.
- `runtime.js`, `mock-tools.js`, `task-catalog.js`, `policies.js`, `audit.js` e `storage.js` implementano il runtime statico in moduli UMD testabili anche da Node.
- `scenarios.js` contiene i tre flussi pilota eseguibili e gli scenari deterministici.
- `tests/` verifica state machine, routing, retry, idempotenza, success contract, task e ripresa.

Il catalogo canonico contiene 40 flussi: 8 gruppi da 5, con 30 flussi Core e 10 Avanzati. I flussi sono definiti come nodi ordinati. Ogni nodo puo includere prompt, condizione, funzione tool, parametri JSON e guardrail. Il rendering aggiorna sidebar a tab, canvas, connettori, inspector e terminale runtime bottom.

## Regole per le modifiche

- Conservare l'esperienza in italiano e il tono professionale hospitality.
- Preferire flussi realistici e azioni verificabili a esempi generici.
- Non inserire credenziali, token o dati personali reali.
- Mantenere il progetto utilizzabile senza build finche non emerge una necessita concreta di backend o framework.
- Evitare dipendenze per funzionalita ottenibili con API browser standard.
- Conservare l'ordine dei gruppi definito in `BNBFLOW_CATALOG.groups` e mantenere la ricerca trasversale su nome, descrizione, prompt, trigger e tool.
- Tenere catalogo flussi e palette di editing in tab distinti; il terminale runtime deve occupare solo l'area di editing ed essere visibile esclusivamente durante una simulazione.
- Verificare desktop e mobile dopo modifiche al layout.
- Eseguire almeno `node --check app.js` e `node --check catalog.js` dopo modifiche JavaScript.
- Non rompere i dati gia salvati in `localStorage`; l'editor usa `bnbflow-state-v2`, mentre il runtime usa lo schema versionato `bnbflow-runtime-v1`.
- Ogni tool critico deve instradare failure definitiva verso un fallback operativo o uno stato terminale esplicito; il task tecnico non sostituisce mai il task Operations.
- Una risoluzione umana deve validare il success contract e riprendere da un nodo deterministico senza rieseguire side effect gia completate.
- Conservare separate Operations Inbox e Technical Inbox.

## Verifica manuale minima

1. Aprire e chiudere gruppi della sidebar e cercare almeno per prompt, trigger e tool.
2. Aprire un flusso da ciascuna area operativa.
3. Selezionare nodi di tipi diversi e controllare i tre tab dell'inspector.
4. Modificare un campo e salvare.
5. Avviare e interrompere una simulazione.
6. Aggiungere e trascinare un nodo dalla palette.
7. Eseguire lo scenario smart lock timeout, risolvere con chiave fisica e verificare completamento run + issue ancora aperta in Technical Inbox.
8. Aggiornare la pagina durante `waiting_human` e verificare il recovery del run.
9. Controllare che non ci siano errori in console, overflow o focus invisibili a 1440 px e 390 px.
10. Eseguire `npm run check`.
