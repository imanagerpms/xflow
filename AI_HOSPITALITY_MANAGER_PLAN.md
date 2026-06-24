Questo documento e' il piano di handoff per trasformare `xFlow` da prototipo principalmente low-code/runtime a demo ideale di un **AI Hospitality Manager**: un control plane operativo che automatizza il ruolo del manager hospitality, coordina sotto-agenti, tool, conversazioni, fallback e interventi umani.



Il progetto target e':



```text

dev/xflow

```



## 1. Tesi centrale



La demo deve vendere l'idea che un manager hospitality possa avere un copilota operativo che:

- capisce cosa sta succedendo nella struttura;

- raggruppa eventi, messaggi, tool call e task dentro casi operativi (e mostra la tasklist, in prima pagina come core dell'applicazione);

- decide cosa automatizzare e cosa portare all'umano in tasklist (manage by exception);

- mantiene separati problemi tecnici e obiettivi operativi;

- riprende i flow dopo una risoluzione umana;

- conserva audit e success contract.

- i task in task list sono suddivisi per priorità, tipologia e mostrano solo alcuni dati della prentoazione necessari al completamento del task



La frase guida:

> Quando un tool fallisce, il sistema non chiede all'umano di riparare il tool. Chiede all'umano di completare il macro-obiettivo operativo del caso.



Esempio obbligatorio:

1. Check-in online completato.

2. L'agente verifica identita', saldo e finestra di accesso.

3. Il tool `access.createSmartLockLink` va in timeout.

4. Il runtime esegue 3 retry con backoff.

5. Il sistema crea una issue tecnica nella Technical Inbox.

6. Il sistema crea un task operativo: `Garantire accesso all'ospite`.

7. L'umano sceglie codice manuale, chiave fisica, provider alternativo o host welcome.

8. Il flow riprende senza rieseguire la smart lock.

9. Il sistema invia istruzioni al cliente.

10. Aggiorna il PMS.

11. Completa il success contract `guest_can_access_property`.

12. La issue tecnica resta aperta, ma il caso operativo e' sbloccato.



## 2. Cosa abbiamo imparato dalla discussione



### 2.1 Il prodotto migliore non e' un PMS

Non costruire un gestionale PMS alternativo. Il prodotto deve stare sopra PMS, OTA, smart lock, pagamenti, WhatsApp, email, housekeeping e vendor.



Il valore e':

- orchestrazione intelligente;

- inversione del controllo operativo, non abbiamo l'elenco delle prenotazioni da gestire ma un elenco di task ordinati da portare a termine

- continuità del business: ogni agente o automazione quando disattivata, deve sempre offrire una esecuzione manulae di tale compito

- i task in realtà permettono anche l'industrializzazione dell'impresa perché la sfida diventa ordinata e cioè ogni task manuale dovrà essere automatizzato tramite automi o AI

- tracciabilita';

- apprendimento dai fallback umani.



### 2.2 Il prodotto migliore non e' solo un workflow editor

Il canvas low-code resta importante, ma non deve essere la prima cosa vista.

Il manager hospitality non pensa in nodi, tool e JSON. Pensa in casi:

- chi arriva oggi?

- chi rischia di restare fuori?

- quale ospite e' arrabbiato?

- quale camera non e' pronta?

- quale rimborso puo' diventare recensione negativa?

- cosa devo fare io, adesso?



Per questo la prima schermata deve essere il **Manager Cockpit**.

## 3. Nuova architettura di prodotto

1. **TASKLIST**

   - tasklist per priorità con un aiuto della AI a capire come svolgere i compiti più urgenti per avere una efficienza massima, magari con assegnazione automatica alle risorse (receptionist, manutentori...)



Il runtime esistente e' una buona base e non va buttato. Va incapsulato in un'esperienza piu' manageriale.



## 4. Entita' principali



### 4.1 OperationalCase

Nuovo oggetto centrale del prodotto.

Un `OperationalCase` rappresenta una situazione manageriale completa, non un singolo step.

Campi consigliati:

```js

{

  id,

  scenarioId,

  flowId,

  title,

  guest,

  bookingId,

  unit,

  channel,

  status,

  severity,

  eta,

  owner,

  businessGoal,

  summary,

  supervisorDecision,

  successContract,

  nextBestActions,

  attention,

  conversation,

  automations,

  fallback,

  runtime

}

```



Esempi:



- `Arrivo imminente, smart lock non risponde`

- `Aria condizionata guasta, tecnico non disponibile`

- `Rimborso approvato, gateway in errore`

- `Camera non pronta e ospite gia' arrivato`

- `Reclamo rumore durante quiet hours`

- `Overbooking con necessita' di ricollocazione`



### 4.2 Conversation



Il prodotto deve modellare la conversazione come oggetto di contesto, non come semplice messaggio.



Campi consigliati:



```js

{

  id,

  caseId,

  participants,

  channels,

  messages,

  extractedFacts,

  sentiment,

  unresolvedQuestions,

  linkedTasks,

  linkedToolCalls

}

```



Canali:



- WhatsApp;

- OTA Inbox;

- email;

- SMS;

- telefono;

- guest portal;

- note interne;

- messaggi tool/provider.



### 4.3 AttentionItem

Oggetto unico per tutto cio' che richiede attenzione.

Non separare mentalmente task, approvazioni, escalation e takeover: sono tutte forme di attention.

Tipi:

- approval;

- intervention;

- escalation;

- missing_data;

- guest_waiting;

- SLA_risk;

- manual_completion;

- technical_followup.



Campi:



```js

{

  id,

  caseId,

  type,

  title,

  businessGoal,

  priority,

  slaAt,

  owner,

  reason,

  recommendedAction,

  requiredFields,

  requiredEvidence,

  fallbackOptions,

  status

}

```



### 4.4 FlowRun



Il runtime esistente resta valido.



`FlowRun` e' l'esecuzione tecnica di un caso o di una parte del caso.



Deve restare subordinato al case:



```text

OperationalCase

  -> FlowRun

     -> StepRun

     -> ToolAttempt

     -> HumanTask

     -> TechnicalIssue

     -> AuditEvent

```



### 4.5 HumanTask



Un task umano non deve descrivere il problema tecnico.



Deve descrivere il macro-compito operativo.



Esempio sbagliato:



```text

Riparare access.createSmartLockLink

```



Esempio corretto:



```text

Garantire accesso all'ospite

```



### 4.6 TechnicalIssue



La issue tecnica e' importante, ma resta separata.



Esempi:



- `access.createSmartLockLink` timeout;

- `vendor.dispatch` permanent error;

- `payment.executeRefund` gateway error;

- `guest.sendAccessInstructions` delivery failed;

- `pms.recordAccessDelivery` write failed.



Una TechnicalIssue puo' restare aperta anche quando l'OperationalCase e' completato.





## 6. Manager Cockpit



### 6.1 Obiettivo



Il cockpit (come schermata riassuntiva, può essere una dashboard) deve essere una riflessione della AI con dei grafici per rappresentare al massimo:

- cosa succede oggi?

- quali casi sono a rischio?

- chi sta aspettando?

- quale outcome va protetto?

- cosa sta facendo l'AI?

- cosa deve fare un umano?

- cosa e' un problema tecnico ma non operativo?



### 6.2 Layout desktop



Struttura consigliata:



```text

Topbar



Briefing turno

  - AI Duty Manager summary

  - KPI operativi

  - CTA: Avvia demo ideale



Main grid

  Left: case list

  Center/right: selected case detail



Case detail

  - header caso

  - supervisor decision

  - attention queue

  - conversation hub

  - automation map

  - success contract

  - CTA scenario/runtime

```



## 7. Case demo obbligatori



### 7.1 Smart lock timeout



Flow: `online-checkin`



Scenario: `access-smartlock-timeout`



Titolo case:



```text

Arrivo imminente, smart lock non risponde

```



Business goal:



```text

guest_can_access_property

```



Decisione supervisor:



```text

Eseguire retry controllati; se il provider non risponde dopo tre tentativi, aprire task "Garantire accesso all'ospite" con codice manuale o chiave fisica e proseguire con istruzioni e nota PMS.

```



Conversation:



- Guest Portal: check-in completato, arrivo alle 16:10.

- AI Duty Manager: prerequisiti validi, creo accesso e preparo fallback.

- Tool: smart lock timeout.



Attention:



- Garantire accesso se lock fallisce.

- Verificare camera pronta.



Fallback:



- provider alternativo;

- codice manuale;

- chiave fisica;

- accoglienza host.



### 7.2 Vendor dispatch failed



Flow: `maintenance`



Scenario: `maintenance-vendor-failed`



Titolo case:



```text

Aria condizionata guasta, tecnico non disponibile

```



Business goal:



```text

guest_issue_is_safely_resolved

```



Decisione supervisor:



```text

Non trasformare il task in "ripara vendor.dispatch". Il compito umano e' rimuovere l'impatto sul soggiorno: tecnico alternativo, workaround temporaneo o cambio camera.

```



Fallback:



- tecnico alternativo;

- workaround operativo;

- cambio camera;

- compensazione secondo policy.



### 7.3 Refund API failed



Flow: `refund-request`



Scenario: `refund-api-failed`



Titolo case:



```text

Rimborso approvato, gateway in errore

```



Business goal:



```text

refund_request_is_resolved

```



Decisione supervisor:



```text

La priorita' e' completare il rimborso o un equivalente approvato, non aspettare il gateway. Creare task con rimborso manuale, gateway alternativo o voucher e poi comunicare l'esito.

```



Fallback:



- rimborso manuale;

- gateway alternativo;

- voucher soggiorno;

- credito su prenotazione futura.



### 7.4 Camera non pronta



Puo' essere inizialmente solo demo cockpit, non per forza runtime completo.



Titolo case:



```text

Camera non pronta e ospite gia' arrivato

```



Business goal:



```text

guest_issue_is_safely_resolved

```



Scopo:



Mostrare che il manager non interviene solo quando un tool fallisce, ma anche quando un rischio operativo sta per diventare un problema reputazionale.



Fallback:



- deposito bagagli;

- update con ETA realistico;

- camera equivalente pronta;

- late checkout gratuito o micro-compensazione se policy lo consente.



## 8. Agenti



### 8.1 Supervisor Agent - AI Duty Manager



Prompt:



```text

Sei l'AI Duty Manager di una struttura hospitality diffusa. Il tuo lavoro non e' eseguire tool isolati, ma proteggere outcome operativi: accesso ospite, sicurezza, incassi, reputazione e coordinamento team.



Per ogni caso devi sintetizzare rischio, prossimo passo, fallback e soglia di intervento umano.



Quando un provider fallisce, proponi prima il modo piu' rapido per completare il macro-obiettivo e lascia la riparazione tecnica in una coda separata.



Non prendere decisioni economiche irreversibili, accessi rischiosi o azioni di compliance senza policy, evidenze e audit.

```



### 8.2 Access & Arrival Agent



Outcome:



```text

guest_can_access_property

```



Prompt:



```text

Garantisci l'accesso solo a ospiti autorizzati. Verifica identita', saldo, finestra di soggiorno e regole struttura. Se smart lock, messaggi o PMS falliscono, attiva un piano operativo alternativo: codice manuale, chiave fisica, host welcome o canale di comunicazione tracciabile. Non comunicare master code e non attendere il debugging del provider se l'ospite e' in arrivo.

```



Tool:



- `guestPortal.getCheckinStatus`

- `identity.verifyGuest`

- `payment.checkBalance`

- `access.createSmartLockLink`

- `access.createManualCode`

- `guest.sendAccessInstructions`

- `pms.recordAccessDelivery`



Guardrail:



- niente master code;

- accessi solo entro finestra valida;

- no accesso automatico con identita' incoerente;

- no dati personali in chat non sicura.



### 8.3 Guest Recovery Agent



Outcome:



```text

guest_issue_is_safely_resolved

```



Prompt:



```text

Riduci disagio e rischio durante il soggiorno. Classifica sicurezza, abitabilita', comfort e reputazione. Coordina tecnico, staff, cambio camera o compensazione solo entro policy. Ogni risposta al cliente deve avere un prossimo passo, un ETA realistico e una verifica di chiusura.

```



Tool:



- `messages.classifyIssue`

- `ops.createMaintenanceTicket`

- `vendor.dispatch`

- `inventory.findEquivalentRoom`

- `guest.sendMaintenanceUpdate`

- `recovery.suggestCompensation`

- `pms.recordIssueResolution`



Guardrail:



- sicurezza sempre escalation;

- accesso tecnico solo con consenso o staff;

- non promettere ETA inventati;

- compensazioni sopra soglia con approval.



### 8.4 Refund & Revenue Agent



Outcome:



```text

refund_request_is_resolved

```



Prompt:



```text

Risolvi richieste economiche con policy, evidenze e tracciabilita'. Distingui fuori policy, approvazione manager, rimborso automatico, voucher o credito. Se il gateway fallisce ma la decisione e' approvata, crea un task per eseguire il valore dovuto con un mezzo alternativo e registra la pratica.

```



Tool:



- `policy.evaluateRefund`

- `payment.executeRefund`

- `payment.createManualRefundRecord`

- `voucher.issueStayCredit`

- `guest.sendRefundDecision`

- `pms.recordRefundResolution`



Guardrail:



- niente rimborso senza policy/evidenza;

- decisioni sopra soglia con approval;

- comunicazione sensibile tracciata;

- no promesse economiche non registrate.



### 8.5 Housekeeping Coordinator



Outcome:



```text

room_is_ready_for_arrival

```



Prompt:



```text

Coordina pulizie, ispezioni e priorita' arrivi. Anticipa ritardi camera, ricalcola ETA realistici e propone alternative operative: cambio priorita', deposito bagagli, camera equivalente o micro-recovery. Non dichiarare pronta una camera senza conferma di housekeeping o ispezione.

```



Tool:



- `housekeeping.getRoomStatus`

- `housekeeping.escalateRoomReadiness`

- `ops.createHousekeepingTask`

- `inventory.findReadyAlternative`

- `guest.sendArrivalUpdate`



### 8.6 Reputation Manager



Outcome:



```text

guest_relationship_is_recovered_or_review_requested

```



Prompt:



```text

Proteggi reputazione e relazione ospite. Dopo checkout, separa esperienze positive da casi con segnali negativi. Chiedi recensione pubblica solo quando non ci sono problemi aperti. Se l'esperienza e' stata negativa, apri recovery privata e prepara una risposta empatica, specifica e tracciabile.

```



Tool:



- `stay.summarizeSentiment`

- `guest.sendReviewRequest`

- `guest.sendPrivateSurvey`

- `crm.tagGuest`

- `pms.scheduleFollowup`



### 8.7 Compliance Agent



Outcome:



```text

mandatory_report_is_submitted

```



Prompt:



```text

Completa adempimenti obbligatori con minimizzazione dati e audit. Verifica documenti richiesti, scadenze locali e stato invio. Se mancano dati, chiedi solo cio' che serve. Se un portale istituzionale o PMS fallisce, crea task per invio manuale e registrazione evidenza.

```



Tool:



- `guestPortal.createCompletionLink`

- `compliance.validateGuestData`

- `compliance.submitGuestReport`

- `pms.recordComplianceStatus`



## 9. Operations Inbox



### 9.1 Principio



Operations Inbox contiene task per proseguire il caso operativo.



Technical Inbox contiene problemi tecnici.



### 9.2 Task umani da mostrare



Lista dettagliata di task umani da supportare nel prodotto:



1. `Garantire accesso all'ospite`

   - macro-obiettivo: ospite puo' entrare;

   - trigger: smart lock timeout, access link failure, chiavi non disponibili;

   - fallback: codice manuale, chiave fisica, provider alternativo, host welcome;

   - campi: access_method, valid_from, valid_until;

   - evidenze: access_ready.



2. `Completare documentazione ospite`

   - macro-obiettivo: prerequisiti check-in completi;

   - fallback: portale assistito, raccolta in reception;

   - campi: verification_reference;

   - evidenze: documents_complete.



3. `Verificare identita' dell'ospite`

   - macro-obiettivo: accesso sicuro;

   - fallback: contatto verificato, verifica staff, negazione accesso;

   - campi: verification_reference;

   - evidenze: identity_verified.



4. `Ottenere garanzia pagamento`

   - macro-obiettivo: accesso autorizzato con rischio economico controllato;

   - fallback: POS, link alternativo, deposito manuale, approval manager;

   - campi: payment_reference;

   - evidenze: payment_secured.



5. `Consegnare comunicazione urgente`

   - macro-obiettivo: ospite informato;

   - fallback: SMS, OTA Inbox, chiamata, email;

   - campi: delivery_channel;

   - evidenze: guest_notified.



6. `Risolvere problema ospite`

   - macro-obiettivo: impatto rimosso o ridotto;

   - fallback: tecnico alternativo, workaround, cambio camera;

   - campi: resolution_method, resolution_note;

   - evidenze: impact_removed.



7. `Autorizzare accesso tecnico`

   - macro-obiettivo: intervento possibile senza violare privacy/sicurezza;

   - fallback: consenso ospite, presenza staff, nuova finestra;

   - campi: access_window;

   - evidenze: technical_access_authorized.



8. `Gestire incidente critico`

   - macro-obiettivo: ospite sicuro;

   - fallback: takeover umano, emergenza, ricollocazione;

   - campi: safety_action, owner;

   - evidenze: guest_safe.



9. `Risolvere richiesta rimborso`

   - macro-obiettivo: richiesta economica chiusa;

   - fallback: rimborso manuale, gateway alternativo, voucher;

   - campi: resolution_method, amount_or_value, transaction_reference;

   - evidenze: resolution_executed.



10. `Autorizzare richiesta rimborso`

    - macro-obiettivo: decisione economica controllata;

    - fallback: approva, rifiuta, richiedi evidenze;

    - campi: decision_note;

    - evidenze: decision_recorded.



11. `Comunicare decisione sul rimborso`

    - macro-obiettivo: cliente informato con tono e traccia corretti;

    - fallback: OTA Inbox, email, chiamata;

    - campi: delivery_channel;

    - evidenze: decision_communicated.



12. `Registrare esito operativo`

    - macro-obiettivo: PMS/audit aggiornato;

    - fallback: nota PMS manuale, registro interno;

    - campi: record_reference;

    - evidenze: pms_updated.



13. `Coordinare camera non pronta`

    - macro-obiettivo: ospite gestito durante attesa;

    - fallback: deposito bagagli, area comune, camera equivalente, recovery;

    - campi: eta_room_ready, guest_option;

    - evidenze: guest_notified.



14. `Gestire ricollocazione`

    - macro-obiettivo: ospite sistemato in alternativa accettabile;

    - fallback: upgrade interno, partner hotel, transfer incluso;

    - campi: relocation_option, approval_reference;

    - evidenze: guest_confirmed.



15. `Proteggere reputazione dopo reclamo`

    - macro-obiettivo: relazione recuperata o escalation chiusa;

    - fallback: recovery privata, voucher, call manager;

    - campi: recovery_action;

    - evidenze: guest_contacted.



## 10. Technical Inbox



Technical Inbox deve avere un linguaggio diverso da Operations.



Esempio riga:



```text

Provider: access

Tool: access.createSmartLockLink

Errore: TIMEOUT

Tentativi: 3

Workaround ops: attivo

Run: non piu' bloccato

Status: open

```



Serve a:



- ripristinare provider;

- monitorare integrazioni;

- capire impatto tecnico;

- evitare che issue tecniche confondano l'operatore di turno.



## 11. Success contract



Ogni macro-obiettivo deve avere un success contract.



Esempio accesso:



```json

{

  "outcome": "guest_can_access_property",

  "requiredFields": ["access_method", "valid_from", "valid_until"],

  "requiredEvidence": ["guest_notified", "pms_updated"],

  "acceptedResolutions": [

    "tool",

    "completed_manually",

    "completed_with_alternate_provider",

    "completed_with_workaround"

  ]

}

```



Esempio recovery:



```json

{

  "outcome": "guest_issue_is_safely_resolved",

  "requiredFields": ["resolution_method"],

  "requiredEvidence": ["guest_safe", "guest_notified", "pms_updated"],

  "acceptedResolutions": [

    "tool",

    "completed_manually",

    "completed_with_alternate_provider",

    "completed_with_workaround",

    "completed_with_equivalent_outcome"

  ]

}

```



Esempio refund:



```json

{

  "outcome": "refund_request_is_resolved",

  "requiredFields": ["decision", "resolution_method"],

  "requiredEvidence": ["decision_communicated", "pms_updated"],

  "acceptedResolutions": [

    "tool",

    "completed_manually",

    "completed_with_alternate_provider",

    "completed_with_equivalent_outcome",

    "rejected"

  ]

}

```



## 12. Implementazione consigliata



### 12.1 File nuovo



Aggiungere:



```text

case-data.js

```



Contenuto:



```js

window.XFLOW_CASE_DATA = {

  briefing: {

    title,

    summary,

    kpis,

    supervisorPrompt

  },

  domainAgents: [],

  cases: []

};

```



Importarlo in `index.html` prima di `app.js`.



### 12.2 Modifiche a `index.html`



1. Aggiungere nav item `Cockpit`.

2. Renderlo attivo di default.

3. Aggiungere `main` con `data-view-panel="cockpit"`.

4. Lasciare `Studio`, `Simulatore`, `Operations`, `Technical`, `Audit`.



### 12.3 Modifiche a `app.js`



Aggiungere stato:



```js

activeView: "cockpit",

selectedCaseId: "case-access-timeout"

```



Aggiungere elementi DOM:



- `caseList`

- `caseStat`

- `caseBoardHeader`

- `briefTitle`

- `briefSummary`

- `briefKpis`

- `supervisorDecision`

- `attentionQueue`

- `conversationHub`

- `automationMap`

- `startDutyDemoButton`

- `openStudioFromCockpitButton`



Funzioni:



```js

function renderCockpit() {}

function renderBriefing() {}

function renderCaseList() {}

function renderSelectedCase() {}

function startCaseScenario(caseId) {}

function openCaseStudio(caseId) {}

function deriveCaseRuntimeStatus(caseItem, run) {}

function renderAgentPrompt(agentId) {}

```



Agganciare `renderCockpit()` dentro `renderAll()` e `renderRuntimeSurfaces()`.



### 12.4 Integrazione runtime



`startCaseScenario(caseId)` deve:



1. trovare case;

2. impostare `state.selectedPilotFlowId = case.flowId`;

3. impostare `state.selectedScenarioId = case.scenarioId`;

4. chiamare `startSelectedScenario()`;

5. opzionalmente restare nel Cockpit o aprire Simulatore;

6. aggiornare badge e stato live del case.



Comportamento consigliato:



- clic su `Avvia scenario` resta nel Cockpit e mostra stato live;

- pulsante secondario `Apri simulatore` porta alla vista runtime;

- pulsante `Apri Studio` apre canvas sul flow del case.



## 13. UI details



### 13.1 Tono visivo



La UI deve essere:



- operativa;

- densa;

- leggibile;

- professionale;

- adatta a uso ripetuto durante un turno.



Evitare:



- landing page;

- hero marketing;

- illustrazioni decorative;

- card enormi;

- testi tutorial in-app troppo esplicativi;

- palette monocolore;

- gradienti decorativi.



### 13.2 Componenti



Usare:



- chip per priorita' e stato;

- tab o segmented controls per viste;

- bottoni iconici dove possibile;

- liste dense per casi;

- timeline per conversazioni e audit;

- pannelli chiari per decisioni e task;

- stati empty utili ma brevi.



### 13.3 Case card



Ogni case card deve mostrare:



- titolo;

- ospite;

- unita';

- severity;

- SLA/ETA;

- business goal;

- status derivato anche dal runtime se attivo.



### 13.4 Case detail



Deve mostrare:



- heading con ospite, unita', canale, ETA;

- summary;

- supervisor decision;

- next best actions;

- attention items;

- conversation hub;

- automation map;

- fallback;

- success contract;

- pulsanti operativi.



## 14. Demo script



Questo e' lo script che il prototipo deve supportare.



### Step 1 - Apertura



L'utente apre l'app e vede il Cockpit.



Messaggio percepito:



```text

Il sistema capisce il turno operativo, non solo i workflow.

```



### Step 2 - Selezione caso



Seleziona:



```text

Arrivo imminente, smart lock non risponde

```



Vede:



- ospite;

- ETA;

- unit;

- canale;

- decisione AI;

- fallback;

- conversation;

- automation map.



### Step 3 - Avvio scenario



Clicca:



```text

Avvia scenario

```



Il runtime:



- verifica prerequisiti;

- prova smart lock;

- retry 3 volte;

- crea technical issue;

- crea operations task.



### Step 4 - Intervento umano



L'utente apre Operations.



Task:



```text

Garantire accesso all'ospite

```



Sceglie:



```text

Chiave fisica

```



Compila campi/evidenze.



### Step 5 - Ripresa



Il flow:



- riprende dal nodo successivo;

- invia istruzioni;

- aggiorna PMS;

- completa run.



### Step 6 - Separazione tecnica



Technical Inbox mostra:



```text

access.createSmartLockLink - TIMEOUT - workaround attivo - issue open

```



Messaggio percepito:



```text

Il cliente e' stato servito. Il provider si ripara dopo.

```



## 15. Roadmap prototipo



### P0



- Cockpit come prima view.

- `case-data.js`.

- 4 case demo.

- Case collegati ai 3 scenari runtime esistenti.

- Avvio scenario da case.

- Apertura Studio da case.

- Operations e Technical coerenti con case.

- Documentazione aggiornata.

- Test esistenti verdi.



### P1



- OperationalCase persistito in localStorage.

- Stato case derivato da run e task.

- Conversation hub piu' ricco.

- Filtro case per severity, owner, business goal.

- Shift briefing generato da casi.

- Technical issue aggregate per provider.

- Learning da risoluzioni umane.



### P2



- Multi-property.

- Ruoli operatori/manager.

- Autorizzazioni e approvazioni.

- Backend reale.

- Coda durevole.

- Connettori reali PMS, WhatsApp, smart lock, payment, vendor.

- Policy editor.

- Analytics operativi.



## 16. Test



Mantenere:



```bash

npm test

npm run check

```



Aggiungere test dove possibile:



- `case-data.js` esiste ed espone `XFLOW_CASE_DATA`;

- ogni case ha `id`, `title`, `businessGoal`, `supervisorDecision`;

- ogni case con `scenarioId` punta a uno scenario esistente;

- ogni case con `flowId` punta a un flow esistente;

- ogni case ha almeno un fallback;

- ogni case ha conversation o attention;

- smart lock timeout mantiene issue tecnica aperta dopo completamento operativo;

- i task Operations non hanno titoli tecnici tipo nome tool.



## 17. Verifica manuale



Verificare:



1. App apre su Cockpit.

2. Top nav mostra Cockpit, Studio, Simulatore, Operations, Technical, Audit.

3. Briefing visibile e leggibile.

4. Case list popolata.

5. Selezione case aggiorna dettaglio.

6. Case smart lock avvia scenario `access-smartlock-timeout`.

7. Runtime produce tre attempt smart lock.

8. Operations mostra `Garantire accesso all'ospite`.

9. Risoluzione con chiave fisica completa il flow.

10. Technical Inbox mantiene issue smart lock open con workaround attivo.

11. Case manutenzione avvia scenario `maintenance-vendor-failed`.

12. Case refund avvia scenario `refund-api-failed`.

13. Studio si apre sul flow corretto dal case.

14. Audit mostra la sequenza completa.

15. Desktop 1440 px senza overflow o sovrapposizioni.

16. Mobile 390 px senza overflow orizzontale.

17. Console senza errori.



## 18. Documentazione da aggiornare



Aggiornare:



- `README.md`

- `AGENTS.md`

- `PROTOTYPE_PLAN.md` oppure linkare questo documento come piano successivo.



README deve dire chiaramente che xFlow e' un prototipo di:



```text

AI Hospitality Manager / operations control plane

```



Non solo:



```text

low-code workflow editor

```



## 19. Commit consigliato



Dopo implementazione e verifica:



```bash

git status

git add .

git commit -m "feat: add AI hospitality manager cockpit"

```



Nel report finale indicare:



- commit hash;

- test eseguiti;

- funzionalita' implementate;

- limiti residui.



## 20. Criterio di successo finale



La demo e' corretta se una persona capisce in meno di due minuti:



- cosa sta succedendo nella struttura;

- quali casi sono rischiosi;

- cosa sta facendo l'AI;

- quando serve un umano;

- perche' il task umano riguarda il risultato operativo;

- come il flow riparte;

- perche' Technical Inbox e Operations Inbox sono separate;

- come il canvas low-code supporta tutto questo senza essere il centro della storia.



Il prodotto deve sembrare il cockpit di un manager hospitality aumentato da agenti AI, non un catalogo di automazioni.
