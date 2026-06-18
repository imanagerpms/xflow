# AGENTS.md

## Obiettivo

Mantenere `bnbFlow Studio` come editor low-code operativo per automazioni hospitality, con flussi comprensibili a property manager e prompt abbastanza realistici da fungere da base per un'implementazione reale.

## Architettura

L'app e statica e non usa framework o dipendenze:

- `index.html` contiene lo shell applicativo e le icone SVG riutilizzabili.
- `styles.css` contiene token visivi, layout a tre colonne e breakpoint responsive.
- `catalog.js` espone `BNBFLOW_CATALOG` con gli 8 gruppi, i metadata dei flussi base e i flussi generati.
- `app.js` contiene i 6 flussi base, integra il catalogo, gestisce lo stato UI e tutte le interazioni.

Il catalogo canonico contiene 40 flussi: 8 gruppi da 5, con 30 flussi Core e 10 Avanzati. I flussi sono definiti come nodi ordinati. Ogni nodo puo includere prompt, condizione, funzione tool, parametri JSON e guardrail. Il rendering aggiorna sidebar raggruppata, canvas, connettori, inspector ed event log.

## Regole per le modifiche

- Conservare l'esperienza in italiano e il tono professionale hospitality.
- Preferire flussi realistici e azioni verificabili a esempi generici.
- Non inserire credenziali, token o dati personali reali.
- Mantenere il progetto utilizzabile senza build finche non emerge una necessita concreta di backend o framework.
- Evitare dipendenze per funzionalita ottenibili con API browser standard.
- Conservare l'ordine dei gruppi definito in `BNBFLOW_CATALOG.groups` e mantenere la ricerca trasversale su nome, descrizione, prompt, trigger e tool.
- Verificare desktop e mobile dopo modifiche al layout.
- Eseguire almeno `node --check app.js` e `node --check catalog.js` dopo modifiche JavaScript.
- Non rompere i dati gia salvati in `localStorage`; lo schema corrente usa `bnbflow-state-v2` e salva flussi, selezione e gruppi chiusi.

## Verifica manuale minima

1. Aprire e chiudere gruppi della sidebar e cercare almeno per prompt, trigger e tool.
2. Aprire un flusso da ciascuna area operativa.
3. Selezionare nodi di tipi diversi e controllare i tre tab dell'inspector.
4. Modificare un campo e salvare.
5. Avviare e interrompere una simulazione.
6. Aggiungere e trascinare un nodo dalla palette.
7. Controllare che non ci siano errori in console a 1440 px e 390 px.
