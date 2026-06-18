# AGENTS.md

## Obiettivo

Mantenere `bnbFlow Studio` come editor low-code operativo per automazioni hospitality, con flussi comprensibili a property manager e prompt abbastanza realistici da fungere da base per un'implementazione reale.

## Architettura

L'app e statica e non usa framework o dipendenze:

- `index.html` contiene lo shell applicativo e le icone SVG riutilizzabili.
- `styles.css` contiene token visivi, layout a tre colonne e breakpoint responsive.
- `app.js` contiene il catalogo `flows`, lo stato UI e tutte le interazioni.

I flussi sono definiti come nodi ordinati. Ogni nodo puo includere prompt, condizione, funzione tool, parametri JSON e guardrail. Il rendering aggiorna canvas, connettori, inspector ed event log.

## Regole per le modifiche

- Conservare l'esperienza in italiano e il tono professionale hospitality.
- Preferire flussi realistici e azioni verificabili a esempi generici.
- Non inserire credenziali, token o dati personali reali.
- Mantenere il progetto utilizzabile senza build finche non emerge una necessita concreta di backend o framework.
- Evitare dipendenze per funzionalita ottenibili con API browser standard.
- Verificare desktop e mobile dopo modifiche al layout.
- Eseguire almeno `node --check app.js` dopo modifiche JavaScript.
- Non rompere i dati gia salvati in `localStorage`; se cambia lo schema, aggiungere una migrazione o una nuova chiave versionata.

## Verifica manuale minima

1. Aprire un flusso dalla sidebar.
2. Selezionare nodi di tipi diversi e controllare i tre tab dell'inspector.
3. Modificare un campo e salvare.
4. Avviare e interrompere una simulazione.
5. Aggiungere e trascinare un nodo dalla palette.
6. Controllare che non ci siano errori in console a 1440 px e 390 px.
