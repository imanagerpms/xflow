# bnbFlow Studio

Interfaccia low-code interattiva per progettare e simulare automazioni operative per BnB e strutture hospitality.

## Funzionalita

- Canvas visuale con nodi trigger, agenti AI, tool, messaggi e guardrail.
- Sei playbook realistici: check-in, late checkout, manutenzione, transfer, no-show e recensioni.
- Prompt operativi modificabili per ogni sotto-agente.
- Configurazione di tool call, condizioni e parametri JSON.
- Simulazione passo-passo con event log.
- Salvataggio locale nel browser tramite `localStorage`.
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
- `app.js`: dati dei flussi, rendering, inspector, drag, simulazione e persistenza.

## Stato del progetto

Il progetto e un prototipo frontend: tool call e integrazioni esterne sono simulate nel browser. Per un ambiente reale servono un backend, autenticazione, gestione sicura dei segreti e connettori verso PMS, smart lock, pagamenti e messaggistica.
