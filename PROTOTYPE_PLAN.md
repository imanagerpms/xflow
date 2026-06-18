# Piano comprensivo: prototipo bnbFlow Runtime

## 1. Visione

Evolvere `bnbFlow Studio` da catalogo visuale di automazioni a prototipo eseguibile capace di:

- ricevere un evento hospitality;
- far decidere un sotto-agente entro policy esplicite;
- invocare tool simulati;
- gestire successi, errori, dati mancanti e timeout;
- creare task umani orientati al risultato operativo;
- riprendere il flusso dopo un intervento umano;
- conservare un audit completo di decisioni e azioni.

La tesi da dimostrare e semplice: l'automazione deve continuare a perseguire il macro-obiettivo anche quando il tool previsto non funziona.

## 2. Principi di prodotto

1. **Outcome prima del tool.** Il tool e un mezzo; il flusso e responsabile del risultato operativo.
2. **Eccezioni di prima classe.** Ogni step dichiara in anticipo successi, blocchi, fallback e condizioni di escalation.
3. **Controllo umano esplicito.** Approvazioni, escalation e takeover sono stati del runtime, non note libere.
4. **Completamento verificabile.** Un task umano si chiude con campi ed evidenze richieste dal success contract.
5. **Operations prima, riparazione tecnica dopo.** Il cliente non deve attendere il debugging di un'integrazione.
6. **Nessuna azione implicita.** Decisioni economiche, accessi e compliance restano tracciabili.
7. **Ripresa deterministica.** Il runtime deve sapere da quale nodo proseguire dopo ogni risoluzione.

## 3. Obiettivi del prototipo

### Obiettivi P0

- Rendere eseguibili tre flussi rappresentativi.
- Supportare rami multipli e condizioni strutturate.
- Simulare tool con successo, timeout ed errori configurabili.
- Creare e risolvere task umani.
- Consentire completamento manuale o tramite fallback alternativo.
- Riprendere automaticamente il flusso dopo la risoluzione.
- Mostrare timeline, payload, decisioni e audit.
- Persistenza locale tra refresh.

### Non-obiettivi iniziali

- Integrazioni reali con PMS, smart lock o gateway.
- Invio reale di messaggi o pagamenti.
- Autenticazione multiutente completa.
- Esecuzione distribuita o alta disponibilita.
- Gestione legale definitiva di compliance e fiscalita.
- Rendere immediatamente eseguibili tutti i 40 template.

I 40 flussi restano il catalogo di prodotto. Il motore viene validato inizialmente su tre flussi, poi esteso agli altri per configurazione.

## 4. Flussi pilota

### 4.1 Check-in online e accesso

Copre identita, pagamenti, smart lock, messaggistica e fallback fisici.

Outcome principale: `guest_can_access_property`.

Scenari obbligatori:

- percorso ideale;
- documento mancante;
- saldo aperto;
- identita incoerente;
- smart lock in timeout;
- link creato ma messaggio non consegnato;
- accesso garantito manualmente con chiave o host.

### 4.2 Guasto durante il soggiorno

Copre triage, SLA, sicurezza, fornitore, comunicazione e recovery.

Outcome principale: `guest_issue_is_safely_resolved`.

Scenari obbligatori:

- problema informativo risolto automaticamente;
- problema comfort con tecnico disponibile;
- vendor dispatch fallito;
- accesso tecnico non autorizzato;
- incidente critico con takeover umano;
- cambio camera come risultato alternativo.

### 4.3 Richiesta rimborso

Copre policy, evidenze, soglie economiche, approvazione e comunicazione sensibile.

Outcome principale: `refund_request_is_resolved`.

Scenari obbligatori:

- richiesta fuori policy;
- rimborso sotto soglia;
- approvazione manager richiesta;
- approvazione rifiutata;
- refund API fallita ma rimborso eseguito manualmente;
- sostituzione con voucher o credito soggiorno.

## 5. Modello concettuale

### Business outcome

Descrive il risultato atteso, indipendente dal sistema usato.

Esempi:

- `guest_can_access_property`
- `room_is_ready_for_arrival`
- `payment_is_secured`
- `guest_issue_is_safely_resolved`
- `refund_request_is_resolved`
- `mandatory_report_is_submitted`

### Capability

Descrive la capacita necessaria per ottenere l'outcome.

Esempi: creare un accesso, inviare un messaggio, acquisire un pagamento, assegnare una camera.

### Tool

Implementa una capability tramite un provider specifico.

Esempio: `access.createSmartLockLink` implementa `create_temporary_access`.

### Success contract

Definisce i dati e le evidenze che dimostrano il raggiungimento dell'outcome.

```json
{
  "outcome": "guest_can_access_property",
  "required_fields": ["access_method", "valid_from", "valid_until"],
  "required_evidence": ["guest_notified"],
  "accepted_resolutions": ["tool", "manual", "alternate_provider", "workaround"]
}
```

### Fallback playbook

Elenco ordinato delle strategie alternative:

1. riprovare lo stesso tool;
2. usare un provider alternativo;
3. eseguire manualmente la stessa azione;
4. usare un workaround operativo;
5. ottenere un outcome equivalente;
6. compensare o annullare in sicurezza.

## 6. Contratto dei nodi

Ogni nodo deve dichiarare:

```json
{
  "id": "create-access",
  "type": "tool",
  "capability": "create_temporary_access",
  "business_goal": "guest_can_access_property",
  "tool": "access.createSmartLockLink",
  "timeout_seconds": 15,
  "max_attempts": 3,
  "idempotency_key": "{{booking.id}}:access:v1",
  "success_contract": {},
  "fallback_playbook": [],
  "outcomes": {
    "success": "send-instructions",
    "needs_data": "request-missing-data",
    "needs_approval": "create-human-task",
    "retryable_error": "retry-tool",
    "failed": "activate-business-fallback",
    "timed_out": "activate-business-fallback"
  }
}
```

Outcome standard dei nodi:

- `success`
- `needs_data`
- `policy_blocked`
- `needs_approval`
- `retryable_error`
- `failed`
- `timed_out`
- `cancelled`
- `completed_manually`
- `completed_with_alternative`

## 7. Stato del runtime

### Flow run

```text
queued
  -> running
  -> waiting_guest
  -> waiting_human
  -> waiting_external
  -> running
  -> completed | partially_completed | failed | cancelled
```

### Step run

```text
pending -> running -> succeeded
                   -> retry_scheduled -> running
                   -> waiting_human -> completed_manually
                   -> failed | skipped | compensated
```

### Human task

```text
open -> assigned -> in_progress -> resolved
                              -> rejected
                              -> expired
                              -> cancelled
```

Una risoluzione produce sempre un evento strutturato, per esempio `outcome.completed_manually` o `approval.rejected`.

## 8. Classificazione delle eccezioni

| Classe | Esempio | Strategia predefinita |
|---|---|---|
| Dato mancante | Documento assente | Chiedere dato, impostare scadenza |
| Dato incoerente | Nome diverso dal prenotante | Task verifica identita |
| Policy | Rimborso sopra soglia | Approval gate |
| Tool temporaneo | Timeout provider | Retry con backoff |
| Tool definitivo | Provider non disponibile | Fallback sul macro-obiettivo |
| Sicurezza | Porta forzata, gas, incendio | Escalation immediata e takeover |
| Operativa | Camera non pronta | Riassegnazione o soluzione alternativa |
| Comunicazione | WhatsApp non consegnato | Canale alternativo o telefonata |
| Compliance | Record autorita respinto | Correzione manuale con SLA |
| Sentiment | Ospite molto insoddisfatto | Takeover e recovery plan |

## 9. Task umani orientati all'outcome

Ogni task mostra:

- titolo operativo, non nome dell'errore tecnico;
- macro-obiettivo e tempo residuo;
- ospite, prenotazione, camera e struttura;
- step e tool falliti come contesto secondario;
- evidenze rilevanti;
- proposta dell'agente;
- fallback disponibili;
- campi obbligatori per completare il task;
- effetto di ogni azione sul flusso.

### Libreria task P0

| Task | Trigger | Azioni umane | Success contract |
|---|---|---|---|
| Garantire accesso all'ospite | Smart lock o access link fallito | Codice manuale, chiave, host, ricollocazione | Metodo, validita, ospite avvisato |
| Verificare identita | Dati incoerenti o documento dubbio | Conferma, richiesta prova, rifiuto | Identita verificata o accesso negato |
| Completare documentazione | Guest portal indisponibile | Assistenza, raccolta in reception, link alternativo | Campi obbligatori completi |
| Ottenere garanzia di pagamento | Gateway fallito o carta rifiutata | POS, link alternativo, bonifico, pagamento in struttura | Pagamento o garanzia registrata |
| Consegnare comunicazione urgente | Canale non disponibile | SMS, OTA inbox, chiamata, contatto secondario | Destinatario e consegna confermati |
| Garantire camera pronta | Housekeeping tool o task fallito | Riassegnazione, backup, nuova ETA, camera alternativa | Camera pronta o alternativa assegnata |
| Risolvere problema ospite | Vendor o manutenzione falliti | Tecnico alternativo, host, workaround, room move | Problema risolto o impatto rimosso |
| Autorizzare accesso tecnico | Consenso o presenza mancanti | Contattare ospite, inviare staff, riprogrammare | Accesso autorizzato e finestra definita |
| Gestire incidente critico | Sicurezza o abitabilita | Takeover, emergenza, evacuazione, ricollocazione | Ospite sicuro e caso preso in carico |
| Risolvere richiesta rimborso | Policy o refund tool bloccati | Approva, rifiuta, esegui manualmente, voucher | Decisione comunicata ed eseguita |
| Valutare danno | Evidenze o attribuzione dubbie | Chiudi, richiedi prove, approva pratica | Decisione e motivazione registrate |
| Proteggere inventario | PMS o channel manager falliti | Blocco manuale, stop-sell, room move | Inventario coerente e senza conflitto |
| Completare adempimento | Connettore compliance fallito | Portale manuale, correzione, escalation | Ricevuta o presa in carico formale |
| Consegnare documento fiscale | Tool fattura fallito | Gestionale esterno, bozza manuale, invio differito | Documento o scadenza concordata |
| Prendere in carico conversazione | Sentiment o rischio elevati | Rispondere, recovery, restituire controllo | Piano comunicato e owner assegnato |

### Risoluzioni standard

- `completed_manually`
- `completed_with_alternate_provider`
- `completed_with_workaround`
- `completed_with_equivalent_outcome`
- `approved`
- `rejected`
- `cancelled_with_compensation`
- `cannot_complete`

## 10. Operations Inbox e Technical Inbox

### Operations Inbox

Obiettivo: completare il macro-compito per ospite e struttura.

Filtri:

- priorita;
- SLA;
- struttura;
- area operativa;
- assegnatario;
- business outcome;
- stato.

Azioni principali:

- prendi in carico;
- esegui fallback;
- approva o rifiuta;
- completa manualmente;
- contatta ospite;
- delega;
- annulla con compensazione.

### Technical Inbox

Obiettivo: ripristinare tool e integrazioni senza bloccare operations.

Contiene:

- provider e funzione;
- codice errore sanificato;
- volume di failure;
- ultimo successo;
- tentativi e latency;
- run impattati;
- stato workaround operativo.

La creazione del task tecnico non sostituisce il task operativo.

## 11. Schermate del prototipo

### 11.1 Catalogo flussi

Mantenere gli 8 gruppi e i 40 template esistenti.

### 11.2 Editor visuale

Aggiungere:

- porte di uscita per outcome;
- connessioni colorate per tipo;
- warning sui rami non gestiti;
- configurazione retry e timeout;
- business goal e success contract;
- fallback playbook ordinabile;
- approval gate;
- anteprima del task umano generato.

### 11.3 Simulatore

Controlli:

- scelta scenario;
- successo o failure forzata per tool;
- latenza simulata;
- avanzamento step-by-step;
- pausa e ripresa;
- inserimento risposta ospite;
- impersonazione operatore.

### 11.4 Operations Inbox

Lista compatta con priorita, SLA, outcome, ospite, struttura e owner.

### 11.5 Dettaglio task

Layout consigliato:

- sinistra: contesto cliente e timeline;
- centro: macro-obiettivo, proposta agente e fallback;
- destra: modulo di risoluzione e impatto sul flow.

### 11.6 Run inspector

Visualizza grafo corrente, nodi completati, payload, tool attempt, task e audit.

### 11.7 Technical Inbox

Vista separata e secondaria, orientata a provider e capability.

## 12. Architettura proposta per il prototipo

Preservare inizialmente l'app statica senza framework.

Moduli suggeriti:

```text
index.html
styles.css
app.js                  # shell UI e routing delle viste
catalog.js              # template dei flussi
runtime.js              # state machine ed esecuzione grafo
policies.js             # soglie e routing approval
mock-tools.js            # registry tool e failure injection
task-catalog.js          # definizioni task e success contract
scenarios.js             # scenari demo riproducibili
storage.js               # persistenza versionata
audit.js                 # eventi e timeline
```

Persistenza consigliata:

- `localStorage` per preferenze UI e configurazioni leggere;
- IndexedDB per run, step, task e audit;
- schema versionato con migrazione esplicita.

## 13. Modello dati minimo

### FlowDefinition

`id`, `version`, `name`, `group`, `nodes`, `edges`, `entryNodeId`, `status`.

### NodeDefinition

`type`, `businessGoal`, `capability`, `tool`, `policy`, `outcomes`, `successContract`, `fallbackPlaybook`.

### FlowRun

`id`, `flowId`, `flowVersion`, `status`, `context`, `currentNodes`, `startedAt`, `completedAt`.

### StepRun

`id`, `runId`, `nodeId`, `status`, `input`, `output`, `attempts`, `outcome`, `timestamps`.

### ToolAttempt

`id`, `stepRunId`, `tool`, `provider`, `idempotencyKey`, `status`, `duration`, `errorCode`.

### HumanTask

`id`, `runId`, `businessGoal`, `title`, `priority`, `slaAt`, `assignee`, `fallbacks`, `requiredFields`, `resolution`.

### AuditEvent

`id`, `runId`, `actor`, `eventType`, `data`, `createdAt`.

## 14. Motore mock dei tool

Ogni tool simulato supporta:

- `success`;
- `timeout`;
- `temporary_error`;
- `permanent_error`;
- `partial_success`;
- `invalid_response`.

Configurazione esempio:

```json
{
  "tool": "access.createSmartLockLink",
  "behavior": "timeout",
  "latency_ms": 2500,
  "fail_attempts": 3
}
```

Il registry deve registrare tutti i tentativi e rispettare l'idempotency key.

## 15. Policy engine minimo

Regole iniziali:

- confidenza agente sotto `0.85`: review umana;
- compensazione fino a 30 euro: automatica se policy consente;
- da 30 a 100 euro: approvazione host;
- sopra 100 euro: approvazione manager;
- identita incoerente: nessun accesso automatico;
- sicurezza critica: takeover immediato;
- tool temporaneo: massimo 3 retry;
- tool definitivo: fallback sul business outcome;
- task oltre SLA: aumento priorita e riassegnazione.

Le soglie devono essere configurabili nel prototipo.

## 16. Roadmap di sviluppo

### Milestone 0: fondazioni

- Separare catalogo e runtime.
- Definire schema versionato di flow e nodi.
- Implementare event bus e audit store.
- Aggiungere router interno per le nuove viste.

### Milestone 1: runtime deterministico

- State machine di run e step.
- Valutazione condizioni e routing outcome.
- Pausa, ripresa e cancellazione.
- Persistenza e recovery dopo refresh.

### Milestone 2: tool mock e failure injection

- Registry dei tool.
- Timeout, retry, backoff e idempotenza.
- Errori temporanei e permanenti.
- Tool attempt nella timeline.

### Milestone 3: task umani

- Generazione task da policy e fallback.
- Operations Inbox.
- Dettaglio e form di risoluzione.
- Validazione success contract.
- Evento di ripresa del flow.

### Milestone 4: editor delle eccezioni

- Outcome ports e rami visuali.
- Configurazione business goal.
- Success contract e fallback playbook.
- Warning di completezza.

### Milestone 5: simulatore e demo

- Scenari dei tre flussi pilota.
- Controllo degli errori tool.
- Step-by-step e takeover.
- Metriche e audit finale.

### Milestone 6: hardening

- Test automatici dello state machine.
- Accessibilita e responsive.
- Migrazioni storage.
- Gestione dati sensibili mock.
- Documentazione e demo script.

## 17. Backlog prioritizzato

### P0

- Schema runtime e validatore.
- Tre flussi pilota.
- Tool registry mock.
- Outcome routing.
- Retry e timeout.
- Human task generator.
- Operations Inbox.
- Risoluzione manuale e ripresa.
- Audit timeline.
- Persistenza locale.

### P1

- Technical Inbox.
- Policy builder visuale.
- Editing fallback drag-and-drop.
- Metriche aggregate.
- Duplicazione e versioning flow.
- Export/import JSON.

### P2

- Ruoli e permessi simulati.
- Commenti e collaborazione.
- Confronto versioni.
- Replay completo dei run.
- Primo adapter reale in ambiente sandbox.

## 18. Metriche del prototipo

- percentuale di run completati automaticamente;
- percentuale completata con intervento umano;
- percentuale completata con outcome alternativo;
- tempo medio di presa in carico;
- tempo medio di risoluzione;
- SLA violati;
- failure e timeout per tool;
- retry medi per capability;
- task per categoria;
- tasso di recovery dopo failure;
- run falliti senza fallback disponibile.

## 19. Strategia di test

### Unit test

- transizioni valide e invalide;
- routing degli outcome;
- retry e timeout;
- idempotenza;
- validazione success contract;
- escalation per soglia;
- ripresa dopo task umano.

### Test di scenario

- tutti gli scenari dei tre flussi pilota;
- refresh mentre il run e in attesa;
- task risolto con provider alternativo;
- task scaduto;
- approvazione rifiutata;
- doppio click su azione operatore;
- tool che risponde dopo timeout;

### Test UI

- desktop 1440 px;
- mobile 390 px;
- nessuna sovrapposizione;
- tastiera e focus;
- filtri inbox;
- canvas con rami multipli;
- assenza di errori console.

## 20. Criteri di accettazione

Il prototipo e completo quando:

1. I tre flussi pilota sono eseguibili end-to-end.
2. Ogni failure tool genera retry o fallback coerente.
3. Un tool definitivamente fallito non obbliga a riparare il tool per completare il macro-obiettivo.
4. Un operatore puo completare un outcome manualmente con evidenze obbligatorie.
5. Il flow riparte dal punto corretto senza duplicare azioni.
6. Operations Inbox e Technical Inbox restano distinte.
7. Ogni decisione e presente nell'audit.
8. Un run in attesa sopravvive al refresh.
9. Il simulatore riproduce gli scenari in modo deterministico.
10. Non esistono rami critici senza fallback o stato terminale.

## 21. Script della demo finale

1. Aprire il flusso Check-in online.
2. Mostrare business goal, tool e fallback nel nodo accesso.
3. Avviare scenario con smart lock in timeout.
4. Osservare tre retry e creazione del task `Garantire accesso all'ospite`.
5. Aprire Operations Inbox e prendere il task.
6. Selezionare `Chiave fisica in lockbox`.
7. Inserire posizione, validita e conferma comunicazione.
8. Risolvere il task e osservare la ripresa del flow.
9. Verificare invio istruzioni, aggiornamento PMS e run completato.
10. Aprire Technical Inbox e mostrare che il problema smart lock resta da diagnosticare separatamente.

## 22. Primo incremento implementabile

Il primo incremento verticale dovrebbe includere soltanto:

- il flusso Check-in online;
- un tool smart lock mock;
- tre esiti: successo, timeout e errore definitivo;
- tre retry;
- task `Garantire accesso all'ospite`;
- risoluzione con codice manuale o chiave fisica;
- ripresa con messaggio e nota PMS;
- audit completo.

Questo incremento valida il modello centrale prima di estenderlo a manutenzione, rimborsi e agli altri template.
