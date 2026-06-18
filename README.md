# bnbFlow Studio

Interfaccia low-code interattiva per progettare e simulare automazioni operative per BnB e strutture hospitality.

## Funzionalita

- Canvas visuale con nodi trigger, agenti AI, tool, messaggi e guardrail.
- Catalogo di 40 playbook realistici, organizzati in 8 aree operative da 5 flussi.
- Sidebar con gruppi richiudibili, badge Core/Avanzato e ricerca trasversale su nome, descrizione, prompt, trigger e tool.
- 30 flussi Core e 10 flussi Avanzati per coprire prenotazioni, soggiorno, operations, revenue e compliance.
- Prompt operativi modificabili per ogni sotto-agente.
- Configurazione di tool call, condizioni e parametri JSON.
- Simulazione passo-passo con event log.
- Salvataggio locale versionato nel browser tramite la chiave `localStorage` `bnbflow-state-v2`.
- Layout responsive per desktop e mobile.

## Avvio

Non sono richieste dipendenze o build.

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Aprire [http://127.0.0.1:4173](http://127.0.0.1:4173).

## Struttura

- `index.html`: struttura dell'app e sprite delle icone.
- `styles.css`: design system, layout e stati responsive.
- `catalog.js`: gruppi, metadata e definizioni dei playbook del catalogo completo.
- `app.js`: flussi base, integrazione del catalogo, rendering, inspector, drag, simulazione e persistenza.

## Stato del progetto

Il progetto e un prototipo frontend: tool call e integrazioni esterne sono simulate nel browser. Per un ambiente reale servono un backend, autenticazione, gestione sicura dei segreti e connettori verso PMS, smart lock, pagamenti e messaggistica.
