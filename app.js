const iconByType = {
  trigger: "icon-zap",
  agent: "icon-bot",
  tool: "icon-tool",
  message: "icon-mail",
  guardrail: "icon-shield",
};

const typeLabels = {
  trigger: "Trigger",
  agent: "Agente AI",
  tool: "Tool call",
  message: "Messaggio",
  guardrail: "Guardrail",
};

const paletteItems = [
  {
    type: "trigger",
    title: "Trigger evento",
    description: "Webhook PMS, OTA, form o smart lock.",
  },
  {
    type: "agent",
    title: "Sotto-agente",
    description: "Prompt operativo con policy e obiettivo.",
  },
  {
    type: "tool",
    title: "Tool call",
    description: "Azione su PMS, pagamenti, accessi o CRM.",
  },
  {
    type: "message",
    title: "Invio cliente",
    description: "WhatsApp, email, SMS o portale ospite.",
  },
  {
    type: "guardrail",
    title: "Controllo",
    description: "Regole di sicurezza, privacy e approvazione.",
  },
];

const flows = [
  {
    id: "online-checkin",
    name: "Check-in online completato",
    category: "Guest access",
    summary: "Crea link smart lock, invia istruzioni e aggiorna PMS dopo verifica documenti.",
    trigger: "guest.checked_in.online",
    metrics: { sla: "2 min", risk: "Basso", automations: "5 tool" },
    simulationOrder: [
      "checkin-trigger",
      "checkin-agent-verify",
      "checkin-guardrail",
      "checkin-tool-access",
      "checkin-message",
      "checkin-note",
    ],
    edges: [
      ["checkin-trigger", "checkin-agent-verify"],
      ["checkin-agent-verify", "checkin-guardrail"],
      ["checkin-agent-verify", "checkin-tool-access"],
      ["checkin-guardrail", "checkin-message"],
      ["checkin-tool-access", "checkin-message"],
      ["checkin-message", "checkin-note"],
    ],
    nodes: [
      {
        id: "checkin-trigger",
        type: "trigger",
        x: 42,
        y: 244,
        name: "Check-in online eseguito",
        description:
          "Il guest portal emette l'evento quando documenti, firma privacy e orario stimato di arrivo sono stati completati.",
        condition: "booking.status == 'confirmed' && guest.portal.checkin == 'complete'",
        params: {
          event: "guest.checked_in.online",
          source: "GuestPortal",
          booking_id: "{{booking.id}}",
          guest_language: "{{guest.language}}",
        },
        guardrail:
          "Non prosegue se mancano consenso privacy, documento principale o saldo prenotazione.",
      },
      {
        id: "checkin-agent-verify",
        type: "agent",
        x: 330,
        y: 120,
        name: "Agente Check-in & Accessi",
        description:
          "Valida prenotazione, regole struttura, lingua del cliente e decide quando generare accessi temporanei.",
        condition: "Solo arrivi nelle prossime 72 ore",
        prompt:
          "Sei il sotto-agente Check-in & Accessi di Casa Livia BnB a Roma. Obiettivo: consegnare istruzioni di ingresso chiare e sicure solo a ospiti autorizzati.\n\nContesto disponibile: prenotazione PMS, dati guest portal, stato pagamenti, regole casa, orario stimato di arrivo, lingua preferita e note operative.\n\nProcedura:\n1. Verifica che prenotazione, pagamento, documento principale e firma privacy siano completi.\n2. Se l'arrivo e' entro 72 ore, crea un link smart lock valido dalla finestra di check-in fino al checkout + 30 minuti.\n3. Scrivi al cliente nella sua lingua, con tono cordiale, concreto e senza promesse non verificate.\n4. Includi indirizzo, piano, citofono, link accesso, regole essenziali e contatto emergenze.\n5. Se rilevi incongruenze su pagamento, documenti o nome ospite, ferma il flusso e crea task per staff.\n\nNon inviare mai codici permanenti. Non mostrare dati personali di altri ospiti. Se il sistema smart lock non risponde, passa a fallback con intervento host.",
        guardrail:
          "Richiede pagamento saldato, documento verificato e finestra accesso limitata.",
      },
      {
        id: "checkin-guardrail",
        type: "guardrail",
        x: 330,
        y: 382,
        name: "Controllo identita e saldo",
        description:
          "Blocca la generazione accesso se saldo o documento non sono coerenti con la prenotazione.",
        condition: "payment.balance == 0 && identity.status == 'verified'",
        params: {
          checks: ["payment.balance", "identity.status", "arrival_window", "guest_count"],
          failure_route: "ops.createStaffTask",
        },
        guardrail:
          "Se fallisce, invia messaggio neutro al cliente e chiede revisione manuale allo staff.",
      },
      {
        id: "checkin-tool-access",
        type: "tool",
        x: 620,
        y: 118,
        name: "Crea link accesso",
        description:
          "Genera un link smart lock temporaneo per portone e appartamento con scadenza automatica.",
        condition: "guardrail.identity_and_balance == 'pass'",
        tool: "access.createSmartLockLink",
        params: {
          booking_id: "{{booking.id}}",
          doors: ["building_entrance", "apartment_2B"],
          valid_from: "{{booking.checkin_at}}",
          valid_until: "{{booking.checkout_at + 30m}}",
          delivery_mode: "secure_link",
        },
        guardrail:
          "Validita massima: soggiorno + 30 minuti. Link revocabile se cambia stato prenotazione.",
      },
      {
        id: "checkin-message",
        type: "message",
        x: 620,
        y: 382,
        name: "Invia istruzioni ospite",
        description:
          "Invia WhatsApp e fallback email con link accesso, indicazioni arrivo e contatto urgenze.",
        condition: "access.link.created == true",
        tool: "guest.sendMessage",
        params: {
          channels: ["whatsapp", "email"],
          template: "arrival_access_instructions",
          language: "{{guest.language}}",
          variables: {
            first_name: "{{guest.first_name}}",
            access_link: "{{access.link}}",
            address: "{{property.address}}",
            emergency_phone: "{{property.emergency_phone}}",
          },
        },
        guardrail:
          "Fallback email dopo 90 secondi se WhatsApp non viene consegnato.",
      },
      {
        id: "checkin-note",
        type: "tool",
        x: 900,
        y: 252,
        name: "Aggiorna PMS e task",
        description:
          "Registra timeline, marca accesso consegnato e crea micro-task per controllo pre-arrivo.",
        condition: "message.delivery_status in ['sent','delivered']",
        tool: "pms.addTimelineNote",
        params: {
          booking_id: "{{booking.id}}",
          note: "Access link sent after online check-in verification.",
          tags: ["online-checkin", "access-sent"],
          create_task: {
            assignee: "frontdesk",
            due_at: "{{booking.checkin_at - 2h}}",
            title: "Verifica camera pronta prima dell'arrivo",
          },
        },
        guardrail:
          "Il PMS resta la fonte di verita: ogni azione automatica viene annotata.",
      },
    ],
  },
  {
    id: "late-checkout",
    name: "Richiesta late checkout",
    category: "Revenue ops",
    summary: "Controlla calendario e housekeeping, calcola prezzo e invia offerta pagabile.",
    trigger: "guest.request.late_checkout",
    metrics: { sla: "5 min", risk: "Medio", automations: "4 tool" },
    simulationOrder: [
      "late-trigger",
      "late-agent",
      "late-tool-calendar",
      "late-tool-price",
      "late-message",
      "late-pms",
    ],
    edges: [
      ["late-trigger", "late-agent"],
      ["late-agent", "late-tool-calendar"],
      ["late-tool-calendar", "late-tool-price"],
      ["late-tool-price", "late-message"],
      ["late-message", "late-pms"],
    ],
    nodes: [
      {
        id: "late-trigger",
        type: "trigger",
        x: 44,
        y: 252,
        name: "Richiesta late checkout ricevuta",
        description:
          "Messaggio WhatsApp o portale ospite con richiesta di lasciare la camera dopo l'orario standard.",
        condition: "booking.in_house == true && request.intent == 'late_checkout'",
        params: {
          event: "guest.request.late_checkout",
          source: "WhatsApp",
          requested_time: "{{message.extracted_time}}",
        },
        guardrail:
          "Le richieste con tono arrabbiato o evento medico vengono passate a staff umano.",
      },
      {
        id: "late-agent",
        type: "agent",
        x: 324,
        y: 156,
        name: "Agente Revenue & Disponibilita",
        description:
          "Decide se il late checkout e' vendibile senza impattare prossimo arrivo e pulizie.",
        condition: "requested_time <= 15:00",
        prompt:
          "Sei il sotto-agente Revenue & Disponibilita per un BnB con pulizie esternalizzate. Obiettivo: rispondere alla richiesta late checkout massimizzando ricavo e proteggendo l'operativita.\n\nValuta in ordine:\n1. Prossimo arrivo nella stessa unita e orario check-in promesso.\n2. Finestra housekeeping, priorita del team pulizie e tempi minimi di reset camera.\n3. Segmento ospite, durata soggiorno, eventuali problemi gia avuti e valore relazione.\n4. Prezzo dinamico: gratuito solo per recovery o ospiti VIP, altrimenti fee chiara con link pagamento.\n\nSe non disponibile, proponi alternative: deposito bagagli, uso area comune o partner luggage storage. Non confermare mai senza calendario e task housekeeping aggiornabili.",
        guardrail:
          "Non promette late checkout se c'e' arrivo same-day prima delle 16:00.",
      },
      {
        id: "late-tool-calendar",
        type: "tool",
        x: 612,
        y: 84,
        name: "Controlla arrivi e pulizie",
        description:
          "Verifica prossimo check-in, blocchi calendario e disponibilita squadra pulizie.",
        condition: "agent.intent == 'evaluate_availability'",
        tool: "calendar.checkTurnoverWindow",
        params: {
          unit_id: "{{booking.unit_id}}",
          requested_checkout_at: "{{request.requested_checkout_at}}",
          include_housekeeping_roster: true,
        },
        guardrail:
          "Se la finestra pulizia scende sotto 150 minuti, richiede approvazione manuale.",
      },
      {
        id: "late-tool-price",
        type: "tool",
        x: 612,
        y: 324,
        name: "Calcola fee late checkout",
        description:
          "Calcola fee in base a ora richiesta, occupazione, profilo ospite e policy commerciale.",
        condition: "turnover.available == true",
        tool: "pricing.calculateLateCheckoutFee",
        params: {
          booking_id: "{{booking.id}}",
          requested_until: "{{request.requested_checkout_at}}",
          base_policy: "20_eur_per_hour_after_11",
          max_fee: 80,
          waive_if_recovery_case: true,
        },
        guardrail:
          "La fee viene sempre comunicata prima della conferma operativa.",
      },
      {
        id: "late-message",
        type: "message",
        x: 894,
        y: 190,
        name: "Invia offerta pagabile",
        description:
          "Propone late checkout con scadenza offerta e link pagamento, oppure alternative se non disponibile.",
        condition: "price.offer_created == true || turnover.available == false",
        tool: "guest.sendOffer",
        params: {
          booking_id: "{{booking.id}}",
          channel: "whatsapp",
          template: "late_checkout_offer",
          expires_in_minutes: 20,
          payment_link: "{{payment.link}}",
        },
        guardrail:
          "Messaggio breve, con importo totale e orario esatto; niente condizioni nascoste.",
      },
      {
        id: "late-pms",
        type: "tool",
        x: 894,
        y: 430,
        name: "Aggiorna task housekeeping",
        description:
          "Se il cliente paga, sposta task pulizie e aggiorna checkout operativo nel PMS.",
        condition: "payment.status == 'paid'",
        tool: "housekeeping.rescheduleTurnover",
        params: {
          unit_id: "{{booking.unit_id}}",
          new_checkout_at: "{{request.requested_checkout_at}}",
          notify_team: true,
          pms_note: "Paid late checkout confirmed.",
        },
        guardrail:
          "Aggiorna calendario solo dopo pagamento o approvazione staff.",
      },
    ],
  },
  {
    id: "maintenance",
    name: "Guasto durante soggiorno",
    category: "Guest recovery",
    summary: "Classifica urgenza, crea ticket, avvisa fornitore e mantiene aggiornato l'ospite.",
    trigger: "guest.report.maintenance_issue",
    metrics: { sla: "10 min", risk: "Alto", automations: "6 tool" },
    simulationOrder: [
      "maint-trigger",
      "maint-agent",
      "maint-guardrail",
      "maint-ticket",
      "maint-vendor",
      "maint-message",
      "maint-recovery",
    ],
    edges: [
      ["maint-trigger", "maint-agent"],
      ["maint-agent", "maint-guardrail"],
      ["maint-guardrail", "maint-ticket"],
      ["maint-ticket", "maint-vendor"],
      ["maint-vendor", "maint-message"],
      ["maint-message", "maint-recovery"],
    ],
    nodes: [
      {
        id: "maint-trigger",
        type: "trigger",
        x: 44,
        y: 252,
        name: "Segnalazione guasto",
        description:
          "L'ospite invia foto o testo: aria condizionata, serratura, acqua calda, rumore o elettrodomestico.",
        condition: "message.intent == 'maintenance_issue'",
        params: {
          event: "guest.report.maintenance_issue",
          attachments: "{{message.attachments}}",
          sentiment: "{{message.sentiment}}",
        },
        guardrail:
          "Le parole chiave sicurezza, incendio, allagamento o gas attivano escalation immediata.",
      },
      {
        id: "maint-agent",
        type: "agent",
        x: 326,
        y: 112,
        name: "Agente Guest Recovery",
        description:
          "Triage del problema, tono empatico e scelta tra self-help, tecnico, cambio camera o compensazione.",
        condition: "guest.in_house == true",
        prompt:
          "Sei il sotto-agente Guest Recovery & Manutenzione. Obiettivo: ridurre disagio ospite, proteggere sicurezza e documentare il problema in modo utile allo staff.\n\nClassifica la segnalazione in: sicurezza urgente, comfort critico, comfort non critico, richiesta informativa. Usa foto, storico camera, meteo, orario e disponibilita fornitori.\n\nRisposta ospite: riconosci il disagio, indica prossimo passo concreto, dai tempi realistici e non attribuire colpe. Se il problema impatta sonno, accesso, acqua calda, elettricita o sicurezza, apri ticket urgente e avvisa host.\n\nPrima di offrire rimborso, valuta gravita, durata, evidenze e policy. Non chiedere all'ospite di fare interventi rischiosi. Non condividere contatti privati dei fornitori se non autorizzati.",
        guardrail:
          "Incidenti sicurezza sempre escalation host + fornitore urgente, anche fuori orario.",
      },
      {
        id: "maint-guardrail",
        type: "guardrail",
        x: 326,
        y: 380,
        name: "Classifica urgenza",
        description:
          "Applica matrice rischio: sicurezza, abitabilita, comfort, reputazione e impatto economico.",
        condition: "issue.category != null",
        params: {
          urgent_keywords: ["gas", "fire", "flood", "locked out", "no electricity"],
          human_escalation_threshold: "critical",
          quiet_hours: "22:00-08:00",
        },
        guardrail:
          "Nessuna automazione chiude ticket critici senza conferma ospite o staff.",
      },
      {
        id: "maint-ticket",
        type: "tool",
        x: 620,
        y: 116,
        name: "Crea ticket manutenzione",
        description:
          "Apre ticket con foto, unita, categoria problema, SLA e priorita per operations.",
        condition: "issue.category in ['critical','comfort']",
        tool: "ops.createMaintenanceTicket",
        params: {
          booking_id: "{{booking.id}}",
          unit_id: "{{booking.unit_id}}",
          priority: "{{issue.priority}}",
          title: "{{issue.short_title}}",
          attachments: "{{message.attachments}}",
          sla_minutes: "{{issue.sla_minutes}}",
        },
        guardrail:
          "Il ticket include solo dati necessari al fornitore, senza documento ospite.",
      },
      {
        id: "maint-vendor",
        type: "tool",
        x: 620,
        y: 382,
        name: "Incarica fornitore",
        description:
          "Seleziona tecnico disponibile per categoria, zona e SLA; invia briefing e finestra accesso.",
        condition: "ticket.priority in ['urgent','high']",
        tool: "vendor.dispatch",
        params: {
          skill: "{{issue.vendor_skill}}",
          location: "{{property.address}}",
          access_mode: "host_approved_or_guest_present",
          requested_arrival_before: "{{ticket.sla_deadline}}",
        },
        guardrail:
          "Accesso tecnico in camera solo con consenso ospite o presenza staff.",
      },
      {
        id: "maint-message",
        type: "message",
        x: 900,
        y: 158,
        name: "Aggiorna ospite",
        description:
          "Invia aggiornamento con tempistiche, workaround e richiesta disponibilita ingresso.",
        condition: "ticket.created == true",
        tool: "guest.sendMessage",
        params: {
          channel: "whatsapp",
          template: "maintenance_update",
          language: "{{guest.language}}",
          include_eta: true,
          request_room_access_consent: true,
        },
        guardrail:
          "Mai promettere ora esatta se il fornitore ha dato solo una fascia.",
      },
      {
        id: "maint-recovery",
        type: "tool",
        x: 900,
        y: 410,
        name: "Valuta recovery",
        description:
          "Suggerisce voucher, late checkout gratuito o refund parziale in base all'impatto reale.",
        condition: "issue.impact_score >= 7 || guest.sentiment == 'negative'",
        tool: "recovery.suggestCompensation",
        params: {
          booking_id: "{{booking.id}}",
          issue_id: "{{ticket.id}}",
          policy: "tiered_guest_recovery",
          require_approval_over_eur: 50,
        },
        guardrail:
          "Compensazioni sopra soglia richiedono approvazione host.",
      },
    ],
  },
  {
    id: "transfer-upsell",
    name: "Upsell transfer pre-arrivo",
    category: "Concierge revenue",
    summary: "Rileva arrivo imminente, prepara preventivo transfer e invia proposta contestuale.",
    trigger: "arrival.minus_48h.no_transfer",
    metrics: { sla: "15 min", risk: "Basso", automations: "4 tool" },
    simulationOrder: [
      "transfer-trigger",
      "transfer-agent",
      "transfer-flight",
      "transfer-quote",
      "transfer-message",
      "transfer-crm",
    ],
    edges: [
      ["transfer-trigger", "transfer-agent"],
      ["transfer-agent", "transfer-flight"],
      ["transfer-flight", "transfer-quote"],
      ["transfer-quote", "transfer-message"],
      ["transfer-message", "transfer-crm"],
    ],
    nodes: [
      {
        id: "transfer-trigger",
        type: "trigger",
        x: 44,
        y: 254,
        name: "Arrivo tra 48 ore senza transfer",
        description:
          "Schedulazione giornaliera intercetta prenotazioni confermate senza servizio transfer.",
        condition: "booking.arrival_in_hours <= 48 && services.transfer == null",
        params: {
          event: "arrival.minus_48h.no_transfer",
          source: "scheduler",
          segment: "{{guest.segment}}",
        },
        guardrail:
          "Non invia upsell a prenotazioni corporate con policy no-extra o opt-out marketing.",
      },
      {
        id: "transfer-agent",
        type: "agent",
        x: 324,
        y: 152,
        name: "Agente Concierge Upsell",
        description:
          "Personalizza offerta transfer in base a orario, aeroporto, lingua e composizione gruppo.",
        condition: "guest.marketing_opt_in == true || message_is_transactional == true",
        prompt:
          "Sei il sotto-agente Concierge Upsell per un BnB urbano. Obiettivo: proporre servizi utili senza sembrare aggressivo.\n\nUsa dati disponibili: aeroporto o stazione, orario arrivo, numero ospiti, bagagli se noti, lingua, durata soggiorno e storico acquisti. Se mancano dati, fai una domanda sola e facile.\n\nCrea proposta transfer con prezzo totale, cosa include, tempi di attesa e scadenza. Evidenzia beneficio pratico: arrivo senza code, autista con nome, consegna diretta all'indirizzo. Non usare scarsita finta. Non inviare piu di un follow-up se il cliente non risponde.",
        guardrail:
          "Rispetta opt-out marketing; messaggi solo transazionali se necessari all'arrivo.",
      },
      {
        id: "transfer-flight",
        type: "tool",
        x: 612,
        y: 88,
        name: "Estrai dati arrivo",
        description:
          "Legge note prenotazione e messaggi per recuperare volo, treno, aeroporto o ETA.",
        condition: "arrival_data.incomplete == true",
        tool: "messages.extractArrivalDetails",
        params: {
          booking_id: "{{booking.id}}",
          lookback_days: 30,
          fields: ["flight_number", "station", "arrival_time", "luggage_count"],
        },
        guardrail:
          "Non deduce dati sensibili: se incerto, chiede conferma al cliente.",
      },
      {
        id: "transfer-quote",
        type: "tool",
        x: 612,
        y: 330,
        name: "Richiedi preventivo partner",
        description:
          "Ottiene prezzo transfer dal partner piu adatto per tratta, orario e numero passeggeri.",
        condition: "arrival.pickup_location != null",
        tool: "vendor.getTransferQuote",
        params: {
          pickup: "{{arrival.pickup_location}}",
          dropoff: "{{property.address}}",
          passengers: "{{booking.guest_count}}",
          arrival_at: "{{arrival.arrival_at}}",
          include_commission: true,
        },
        guardrail:
          "Mostra prezzo finale, inclusa commissione e IVA se applicabile.",
      },
      {
        id: "transfer-message",
        type: "message",
        x: 900,
        y: 172,
        name: "Invia proposta transfer",
        description:
          "Invia offerta breve con prezzo, beneficio e CTA di conferma via link.",
        condition: "quote.status == 'available'",
        tool: "guest.sendMessage",
        params: {
          channel: "whatsapp",
          template: "transfer_offer",
          language: "{{guest.language}}",
          variables: {
            quote_price: "{{quote.total}}",
            pickup_label: "{{arrival.pickup_location}}",
            booking_link: "{{quote.checkout_link}}",
          },
        },
        guardrail:
          "Follow-up massimo uno, non prima di 12 ore.",
      },
      {
        id: "transfer-crm",
        type: "tool",
        x: 900,
        y: 414,
        name: "Aggiorna CRM preferenze",
        description:
          "Tagga interesse transfer, lingua risposta e stato offerta per campagne future.",
        condition: "message.sent == true",
        tool: "crm.updateGuestProfile",
        params: {
          guest_id: "{{guest.id}}",
          tags: ["transfer-offered"],
          preferences: {
            arrival_transport: "{{arrival.pickup_location}}",
            upsell_last_sent_at: "{{now}}",
          },
        },
        guardrail:
          "Onora opt-out e retention dati del CRM.",
      },
    ],
  },
  {
    id: "no-show-payment",
    name: "No-show e pagamento",
    category: "Risk & payments",
    summary: "Contatta ospite, sospende accessi, applica policy no-show e notifica staff.",
    trigger: "arrival.window.expired",
    metrics: { sla: "30 min", risk: "Alto", automations: "5 tool" },
    simulationOrder: [
      "noshow-trigger",
      "noshow-agent",
      "noshow-message",
      "noshow-access",
      "noshow-payment",
      "noshow-pms",
    ],
    edges: [
      ["noshow-trigger", "noshow-agent"],
      ["noshow-agent", "noshow-message"],
      ["noshow-message", "noshow-access"],
      ["noshow-access", "noshow-payment"],
      ["noshow-payment", "noshow-pms"],
    ],
    nodes: [
      {
        id: "noshow-trigger",
        type: "trigger",
        x: 44,
        y: 252,
        name: "Finestra arrivo scaduta",
        description:
          "L'ospite non ha effettuato accesso entro la finestra attesa e non ha inviato aggiornamenti ETA.",
        condition: "now > booking.checkin_window_end && access.first_open == null",
        params: {
          event: "arrival.window.expired",
          grace_period_minutes: 30,
          source: "smart_lock + PMS",
        },
        guardrail:
          "Prima di applicare fee verifica messaggi recenti, voli in ritardo e policy OTA.",
      },
      {
        id: "noshow-agent",
        type: "agent",
        x: 326,
        y: 134,
        name: "Agente No-show & Pagamenti",
        description:
          "Gestisce contatto cliente, rischio chargeback, policy OTA e sospensione accessi.",
        condition: "booking.status == 'confirmed'",
        prompt:
          "Sei il sotto-agente No-show & Pagamenti. Obiettivo: distinguere un ritardo reale da un no-show, proteggere ricavi e ridurre rischio dispute.\n\nPrima di ogni azione economica controlla: ultimo messaggio ospite, tracking volo se disponibile, policy OTA, metodo pagamento, deposito, note staff e access log. Scrivi all'ospite con tono utile: chiedi ETA e offri assistenza se e' in viaggio.\n\nSe non risponde entro la finestra di grazia definita, sospendi link accesso non usati, applica la policy consentita dal canale e aggiorna PMS. Non addebitare extra se la policy OTA lo vieta o se esiste una conversazione aperta con staff.",
        guardrail:
          "Pagamenti no-show solo quando policy e canale autorizzano l'addebito.",
      },
      {
        id: "noshow-message",
        type: "message",
        x: 616,
        y: 90,
        name: "Invia reminder ETA",
        description:
          "Chiede conferma arrivo con CTA rapida e informa che l'accesso resta disponibile fino a una certa ora.",
        condition: "guest.last_message_age_minutes > 60",
        tool: "guest.sendMessage",
        params: {
          channels: ["whatsapp", "sms"],
          template: "arrival_eta_reminder",
          wait_for_reply_minutes: 30,
          language: "{{guest.language}}",
        },
        guardrail:
          "Non menziona penali nel primo reminder se l'ospite potrebbe essere in viaggio.",
      },
      {
        id: "noshow-access",
        type: "tool",
        x: 616,
        y: 332,
        name: "Sospendi accesso non usato",
        description:
          "Revoca o mette in pausa link accesso se non e' mai stato utilizzato e non c'e' risposta.",
        condition: "message.reply == null && access.first_open == null",
        tool: "access.pauseSmartLockLink",
        params: {
          booking_id: "{{booking.id}}",
          reason: "arrival_window_expired_no_response",
          allow_reactivation_by_staff: true,
        },
        guardrail:
          "Non sospende se l'ospite ha gia aperto portone o appartamento.",
      },
      {
        id: "noshow-payment",
        type: "tool",
        x: 900,
        y: 142,
        name: "Applica policy no-show",
        description:
          "Calcola importo addebitabile e crea capture/payment note in base a canale e contratto.",
        condition: "no_show.confirmed == true && ota.policy.allows_charge == true",
        tool: "payment.captureNoShowFee",
        params: {
          booking_id: "{{booking.id}}",
          amount: "{{policy.no_show_amount}}",
          currency: "EUR",
          evidence: ["message_attempts", "access_log", "booking_policy"],
        },
        guardrail:
          "Addebiti sopra soglia o con carta a rischio richiedono approvazione staff.",
      },
      {
        id: "noshow-pms",
        type: "tool",
        x: 900,
        y: 410,
        name: "Marca no-show nel PMS",
        description:
          "Aggiorna stato prenotazione, timeline, disponibilita eventuale e task follow-up.",
        condition: "payment.capture_status in ['succeeded','not_applicable']",
        tool: "pms.markNoShow",
        params: {
          booking_id: "{{booking.id}}",
          release_inventory_after: "{{property.no_show_release_policy}}",
          create_staff_task: true,
          evidence_bundle_id: "{{payment.evidence_bundle_id}}",
        },
        guardrail:
          "Non rilascia inventory se ci sono bagagli registrati o contatto recente del cliente.",
      },
    ],
  },
  {
    id: "review-poststay",
    name: "Recensione post-stay",
    category: "Reputation",
    summary: "Segmenta esperienza, chiede recensione pubblica o apre recovery privata.",
    trigger: "checkout.completed.room_ok",
    metrics: { sla: "3 ore", risk: "Medio", automations: "4 tool" },
    simulationOrder: [
      "review-trigger",
      "review-agent",
      "review-sentiment",
      "review-message",
      "review-crm",
      "review-followup",
    ],
    edges: [
      ["review-trigger", "review-agent"],
      ["review-agent", "review-sentiment"],
      ["review-sentiment", "review-message"],
      ["review-message", "review-crm"],
      ["review-crm", "review-followup"],
    ],
    nodes: [
      {
        id: "review-trigger",
        type: "trigger",
        x: 44,
        y: 252,
        name: "Checkout completato + camera OK",
        description:
          "Housekeeping chiude controllo camera senza danni e PMS conferma checkout concluso.",
        condition: "booking.checked_out == true && housekeeping.room_status == 'ok'",
        params: {
          event: "checkout.completed.room_ok",
          delay_after_checkout_hours: 3,
          source: "PMS + housekeeping",
        },
        guardrail:
          "Non chiede recensione se esiste ticket aperto o sentiment negativo non risolto.",
      },
      {
        id: "review-agent",
        type: "agent",
        x: 324,
        y: 136,
        name: "Agente Reputation Manager",
        description:
          "Sceglie tra richiesta recensione, survey privata o recovery in base al soggiorno.",
        condition: "stay.has_open_issue == false",
        prompt:
          "Sei il sotto-agente Reputation Manager. Obiettivo: aumentare recensioni positive senza spingere ospiti insoddisfatti verso canali pubblici.\n\nAnalizza: messaggi durante soggiorno, ticket manutenzione, rating interno pulizie, puntualita check-in, richieste speciali, tono conversazioni e valore ospite. Se l'esperienza sembra positiva, invia richiesta recensione personalizzata. Se ci sono segnali negativi, invia survey privata e crea task recovery.\n\nIl messaggio deve essere breve, umano e specifico sul soggiorno. Non offrire incentivi in cambio di recensioni. Non manipolare il feedback e rispetta le regole delle OTA.",
        guardrail:
          "No incentivi per recensioni; recovery privata se sentiment sotto soglia.",
      },
      {
        id: "review-sentiment",
        type: "tool",
        x: 612,
        y: 90,
        name: "Analizza sentiment soggiorno",
        description:
          "Combina messaggi, ticket e note staff in un punteggio azionabile per reputazione.",
        condition: "messages.count > 0 || tickets.count > 0",
        tool: "stay.summarizeSentiment",
        params: {
          booking_id: "{{booking.id}}",
          include_sources: ["guest_messages", "ops_tickets", "housekeeping_notes"],
          output_scale: "0-10",
        },
        guardrail:
          "Il riepilogo non inventa problemi: cita solo segnali presenti nei dati.",
      },
      {
        id: "review-message",
        type: "message",
        x: 612,
        y: 332,
        name: "Invia review request",
        description:
          "Richiede recensione pubblica se sentiment positivo; altrimenti apre canale privato.",
        condition: "sentiment.score >= 8 && stay.has_open_issue == false",
        tool: "guest.sendReviewRequest",
        params: {
          booking_id: "{{booking.id}}",
          channel: "email",
          public_review_url: "{{ota.review_url}}",
          private_survey_url: "{{survey.url}}",
          language: "{{guest.language}}",
        },
        guardrail:
          "Se score < 8 usa survey privata e task staff, non link pubblico.",
      },
      {
        id: "review-crm",
        type: "tool",
        x: 900,
        y: 142,
        name: "Tagga profilo ospite",
        description:
          "Aggiorna CRM con preferenze, probabilita ritorno e canale di acquisizione.",
        condition: "review_request.sent == true",
        tool: "crm.tagGuest",
        params: {
          guest_id: "{{guest.id}}",
          tags: ["poststay-review-requested", "{{sentiment.segment}}"],
          preferences_from_stay: true,
        },
        guardrail:
          "I tag non devono contenere categorie sensibili o giudizi personali.",
      },
      {
        id: "review-followup",
        type: "tool",
        x: 900,
        y: 410,
        name: "Schedula follow-up",
        description:
          "Se non arriva recensione, pianifica un solo follow-up leggero dopo alcuni giorni.",
        condition: "review.submitted == false after 5d",
        tool: "pms.scheduleFollowup",
        params: {
          booking_id: "{{booking.id}}",
          followup_after_days: 5,
          max_followups: 1,
          channel: "email",
        },
        guardrail:
          "Massimo un follow-up e stop immediato dopo opt-out.",
      },
    ],
  },
];

const state = {
  currentFlowId: flows[0].id,
  selectedNodeId: "checkin-agent-verify",
  activeTab: "config",
  simulationTimer: null,
  simulationIndex: -1,
  nodeStatuses: {},
  activeEdges: new Set(),
  drag: null,
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  hydrateSavedState();
  bindEvents();
  renderAll();
});

function cacheElements() {
  els.flowList = document.querySelector("#flowList");
  els.flowSearch = document.querySelector("#flowSearch");
  els.paletteGrid = document.querySelector("#paletteGrid");
  els.flowTitle = document.querySelector("#flowTitle");
  els.flowCategory = document.querySelector("#flowCategory");
  els.flowMeta = document.querySelector("#flowMeta");
  els.flowCanvas = document.querySelector("#flowCanvas");
  els.connectorLayer = document.querySelector("#connectorLayer");
  els.eventLog = document.querySelector("#eventLog");
  els.simulateButton = document.querySelector("#simulateButton");
  els.saveButton = document.querySelector("#saveButton");
  els.newFlowButton = document.querySelector("#newFlowButton");
  els.toast = document.querySelector("#toast");
  els.inspectorTitle = document.querySelector("#inspectorTitle");
  els.nodeBadge = document.querySelector("#nodeBadge");
  els.nodeNameInput = document.querySelector("#nodeNameInput");
  els.nodeDescriptionInput = document.querySelector("#nodeDescriptionInput");
  els.nodeConditionInput = document.querySelector("#nodeConditionInput");
  els.nodePromptInput = document.querySelector("#nodePromptInput");
  els.nodeToolInput = document.querySelector("#nodeToolInput");
  els.nodeParamsInput = document.querySelector("#nodeParamsInput");
  els.guardrailText = document.querySelector("#guardrailText");
}

function bindEvents() {
  els.flowSearch.addEventListener("input", renderFlowList);
  els.simulateButton.addEventListener("click", toggleSimulation);
  els.saveButton.addEventListener("click", () => {
    showToast("Configurazione salvata in memoria locale del browser.");
    localStorage.setItem("bnbflow-state", JSON.stringify(flows));
  });
  els.newFlowButton.addEventListener("click", duplicateCurrentFlow);

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.activeTab = tab.dataset.tab;
      renderTabs();
    });
  });

  [
    ["nodeNameInput", "name"],
    ["nodeDescriptionInput", "description"],
    ["nodeConditionInput", "condition"],
    ["nodePromptInput", "prompt"],
    ["nodeToolInput", "tool"],
  ].forEach(([elementKey, field]) => {
    els[elementKey].addEventListener("input", (event) => {
      const node = getSelectedNode();
      if (!node) return;
      node[field] = event.target.value;
      renderCanvas();
      renderFlowList();
    });
  });

  els.nodeParamsInput.addEventListener("input", (event) => {
    const node = getSelectedNode();
    if (!node) return;
    try {
      node.params = JSON.parse(event.target.value || "{}");
      els.nodeParamsInput.classList.remove("has-error");
      els.guardrailText.textContent = node.guardrail || "Parametri JSON validi.";
    } catch (error) {
      els.nodeParamsInput.classList.add("has-error");
      els.guardrailText.textContent = "JSON non valido: correggi la sintassi prima di salvare.";
    }
  });

  window.addEventListener("resize", renderConnectors);
  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
}

function renderAll() {
  renderFlowList();
  renderPalette();
  renderCanvasHeader();
  renderCanvas();
  renderInspector();
  renderTabs();
  renderLog(["Seleziona un flusso o avvia una simulazione per vedere gli step runtime."]);
}

function getCurrentFlow() {
  return flows.find((flow) => flow.id === state.currentFlowId) || flows[0];
}

function getSelectedNode() {
  const flow = getCurrentFlow();
  return flow.nodes.find((node) => node.id === state.selectedNodeId) || flow.nodes[0];
}

function renderFlowList() {
  const query = els.flowSearch.value.trim().toLowerCase();
  els.flowList.innerHTML = "";

  flows
    .filter((flow) => {
      const haystack = [
        flow.name,
        flow.category,
        flow.summary,
        flow.trigger,
        ...flow.nodes.map((node) => `${node.name} ${node.description} ${node.tool || ""}`),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    })
    .forEach((flow) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `flow-card ${flow.id === state.currentFlowId ? "active" : ""}`;
      button.innerHTML = `
        <div class="flow-card-header">
          <strong>${escapeHtml(flow.name)}</strong>
          <span class="flow-chip">${escapeHtml(flow.category)}</span>
        </div>
        <p>${escapeHtml(flow.summary)}</p>
      `;
      button.addEventListener("click", () => selectFlow(flow.id));
      els.flowList.appendChild(button);
    });
}

function renderPalette() {
  els.paletteGrid.innerHTML = "";
  paletteItems.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `palette-item type-${item.type}`;
    button.innerHTML = `
      <span class="palette-icon">
        <svg><use href="#${iconByType[item.type]}"></use></svg>
      </span>
      <span>
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.description)}</span>
      </span>
    `;
    button.addEventListener("click", () => addNode(item.type));
    els.paletteGrid.appendChild(button);
  });
}

function renderCanvasHeader() {
  const flow = getCurrentFlow();
  els.flowTitle.textContent = flow.name;
  els.flowCategory.textContent = `${flow.category} / ${flow.trigger}`;
  els.flowMeta.innerHTML = Object.entries(flow.metrics)
    .map(
      ([label, value]) => `
      <div class="metric">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `,
    )
    .join("");
}

function renderCanvas() {
  const flow = getCurrentFlow();
  els.flowCanvas.innerHTML = "";

  flow.nodes.forEach((node) => {
    const status = state.nodeStatuses[node.id] || "";
    const card = document.createElement("article");
    card.className = `node-card type-${node.type} ${node.id === state.selectedNodeId ? "selected" : ""} ${status}`;
    card.style.left = `${node.x}px`;
    card.style.top = `${node.y}px`;
    card.dataset.nodeId = node.id;
    card.innerHTML = `
      <header class="node-card-header">
        <span class="node-kind">
          <svg><use href="#${iconByType[node.type]}"></use></svg>
          ${escapeHtml(typeLabels[node.type])}
        </span>
        <span class="node-status"></span>
      </header>
      <div class="node-body">
        <h3>${escapeHtml(node.name)}</h3>
        <p>${escapeHtml(node.description)}</p>
      </div>
      <footer class="node-footer">
        <span class="node-pill">${escapeHtml(node.tool || node.condition || "configurabile")}</span>
        <button class="node-open" type="button" aria-label="Apri nodo" title="Apri nodo">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M7 17 17 7"></path><path d="M8 7h9v9"></path>
          </svg>
        </button>
      </footer>
    `;

    card.addEventListener("pointerdown", (event) => onNodePointerDown(event, node));
    card.querySelector(".node-open").addEventListener("click", (event) => {
      event.stopPropagation();
      selectNode(node.id);
    });
    els.flowCanvas.appendChild(card);
  });

  requestAnimationFrame(renderConnectors);
}

function renderConnectors() {
  const flow = getCurrentFlow();
  els.connectorLayer.innerHTML = "";

  flow.edges.forEach(([fromId, toId]) => {
    const from = flow.nodes.find((node) => node.id === fromId);
    const to = flow.nodes.find((node) => node.id === toId);
    if (!from || !to) return;

    const startX = from.x + 250;
    const startY = from.y + 77;
    const endX = to.x;
    const endY = to.y + 77;
    const delta = Math.max(70, Math.abs(endX - startX) / 2);
    const d = `M ${startX} ${startY} C ${startX + delta} ${startY}, ${endX - delta} ${endY}, ${endX} ${endY}`;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("class", `connector-path ${state.activeEdges.has(`${fromId}:${toId}`) ? "is-active" : ""}`);
    els.connectorLayer.appendChild(path);
  });
}

function renderInspector() {
  const node = getSelectedNode();
  if (!node) return;

  els.inspectorTitle.textContent = node.name;
  els.nodeBadge.textContent = typeLabels[node.type];
  els.nodeBadge.className = `node-badge type-${node.type}`;
  els.nodeNameInput.value = node.name || "";
  els.nodeDescriptionInput.value = node.description || "";
  els.nodeConditionInput.value = node.condition || "";
  els.nodePromptInput.value = node.prompt || "";
  els.nodeToolInput.value = node.tool || "";
  els.nodeParamsInput.value = JSON.stringify(node.params || {}, null, 2);
  els.guardrailText.textContent = node.guardrail || "Nessun guardrail specifico configurato.";

  const isAgent = node.type === "agent";
  const hasTool = Boolean(node.tool) || node.type === "tool" || node.type === "message";
  els.nodePromptInput.disabled = !isAgent;
  els.nodeToolInput.disabled = !hasTool;
  els.nodeParamsInput.disabled = !(node.params || hasTool || node.type === "trigger" || node.type === "guardrail");
}

function renderTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === state.activeTab);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${state.activeTab}Panel`);
  });
}

function renderLog(items, liveIndex = -1) {
  els.eventLog.innerHTML = "";
  items.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = index === liveIndex ? "is-live" : "";
    li.innerHTML = `<span class="event-dot"></span><span>${escapeHtml(item)}</span>`;
    els.eventLog.appendChild(li);
  });
}

function selectFlow(flowId) {
  stopSimulation(false);
  const flow = flows.find((item) => item.id === flowId);
  if (!flow) return;
  state.currentFlowId = flowId;
  state.selectedNodeId = flow.nodes.find((node) => node.type === "agent")?.id || flow.nodes[0]?.id;
  state.nodeStatuses = {};
  state.activeEdges = new Set();
  renderFlowList();
  renderCanvasHeader();
  renderCanvas();
  renderInspector();
  renderLog([`Flusso caricato: ${flow.name}`]);
}

function selectNode(nodeId) {
  state.selectedNodeId = nodeId;
  renderCanvas();
  renderInspector();
}

function addNode(type) {
  stopSimulation(false);
  const flow = getCurrentFlow();
  const selected = getSelectedNode();
  const id = `${type}-${Date.now()}`;
  const baseX = Math.min((selected?.x || 60) + 290, 860);
  const baseY = Math.min((selected?.y || 120) + 34, 540);
  const node = {
    id,
    type,
    x: baseX,
    y: baseY,
    name: defaultNameForType(type),
    description: defaultDescriptionForType(type),
    condition: "Aggiungi condizione di routing",
    prompt: type === "agent" ? defaultAgentPrompt() : "",
    tool: type === "tool" || type === "message" ? defaultToolForType(type) : "",
    params: defaultParamsForType(type),
    guardrail: "Configura limiti, fallback e casi che richiedono approvazione umana.",
  };

  flow.nodes.push(node);
  if (selected) {
    flow.edges.push([selected.id, id]);
  }
  flow.simulationOrder.push(id);
  state.selectedNodeId = id;
  showToast(`${typeLabels[type]} aggiunto al canvas.`);
  renderCanvasHeader();
  renderCanvas();
  renderInspector();
  renderFlowList();
}

function duplicateCurrentFlow() {
  stopSimulation(false);
  const flow = getCurrentFlow();
  const clone = structuredClone(flow);
  clone.id = `${flow.id}-copy-${Date.now()}`;
  clone.name = `${flow.name} - copia`;
  clone.summary = "Copia modificabile del playbook selezionato.";
  flows.unshift(clone);
  state.currentFlowId = clone.id;
  state.selectedNodeId = clone.nodes.find((node) => node.type === "agent")?.id || clone.nodes[0]?.id;
  showToast("Flusso duplicato. Puoi modificarlo dall'inspector.");
  renderAll();
}

function toggleSimulation() {
  if (state.simulationTimer) {
    stopSimulation(true);
  } else {
    startSimulation();
  }
}

function startSimulation() {
  const flow = getCurrentFlow();
  state.nodeStatuses = {};
  state.activeEdges = new Set();
  state.simulationIndex = -1;
  els.simulateButton.innerHTML = '<svg><use href="#icon-stop"></use></svg><span>Stop</span>';
  els.simulateButton.setAttribute("aria-label", "Interrompi simulazione");
  els.simulateButton.setAttribute("title", "Interrompi simulazione");
  renderLog(["Evento ricevuto. Preparazione runtime..."], 0);
  runNextSimulationStep();
  state.simulationTimer = window.setInterval(runNextSimulationStep, 1150);
}

function runNextSimulationStep() {
  const flow = getCurrentFlow();
  const order = flow.simulationOrder.filter((nodeId) => flow.nodes.some((node) => node.id === nodeId));

  if (state.simulationIndex >= 0 && order[state.simulationIndex]) {
    state.nodeStatuses[order[state.simulationIndex]] = "done";
  }

  state.simulationIndex += 1;

  if (state.simulationIndex >= order.length) {
    stopSimulation(false);
    renderLog(buildSimulationLog(flow, order), order.length - 1);
    showToast("Simulazione completata: tutti gli step principali sono passati.");
    return;
  }

  const activeNodeId = order[state.simulationIndex];
  state.nodeStatuses[activeNodeId] = "running";
  state.selectedNodeId = activeNodeId;
  state.activeEdges = new Set(
    flow.edges
      .filter(([fromId, toId]) => fromId === order[state.simulationIndex - 1] || toId === activeNodeId)
      .map(([fromId, toId]) => `${fromId}:${toId}`),
  );

  renderCanvas();
  renderInspector();
  renderLog(buildSimulationLog(flow, order), state.simulationIndex);
}

function stopSimulation(showMessage) {
  if (state.simulationTimer) {
    window.clearInterval(state.simulationTimer);
    state.simulationTimer = null;
  }
  els.simulateButton.innerHTML = '<svg><use href="#icon-play"></use></svg><span>Simula</span>';
  els.simulateButton.setAttribute("aria-label", "Avvia simulazione");
  els.simulateButton.setAttribute("title", "Avvia simulazione");
  state.activeEdges = new Set();
  if (showMessage) showToast("Simulazione interrotta.");
  renderCanvas();
}

function buildSimulationLog(flow, order) {
  return order.map((nodeId, index) => {
    const node = flow.nodes.find((item) => item.id === nodeId);
    if (!node) return "Step non disponibile";
    const verb =
      node.type === "trigger"
        ? "Trigger ricevuto"
        : node.type === "agent"
          ? "Agente in ragionamento"
          : node.type === "tool"
            ? "Tool call eseguita"
            : node.type === "message"
              ? "Messaggio preparato"
              : "Guardrail verificato";
    const status = index < state.simulationIndex ? "OK" : index === state.simulationIndex ? "RUN" : "WAIT";
    return `${status} / ${verb}: ${node.name}`;
  });
}

function onNodePointerDown(event, node) {
  if (event.target.closest("button")) return;
  selectNode(node.id);
  const rect = els.flowCanvas.getBoundingClientRect();
  state.drag = {
    nodeId: node.id,
    offsetX: event.clientX - rect.left - node.x,
    offsetY: event.clientY - rect.top - node.y,
  };
  event.currentTarget.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  if (!state.drag) return;
  const flow = getCurrentFlow();
  const node = flow.nodes.find((item) => item.id === state.drag.nodeId);
  if (!node) return;
  const rect = els.flowCanvas.getBoundingClientRect();
  node.x = clamp(event.clientX - rect.left - state.drag.offsetX, 20, 850);
  node.y = clamp(event.clientY - rect.top - state.drag.offsetY, 30, 590);
  const card = els.flowCanvas.querySelector(`[data-node-id="${node.id}"]`);
  if (card) {
    card.style.left = `${node.x}px`;
    card.style.top = `${node.y}px`;
  }
  renderConnectors();
}

function onPointerUp() {
  state.drag = null;
}

function defaultNameForType(type) {
  return {
    trigger: "Nuovo trigger",
    agent: "Nuovo sotto-agente",
    tool: "Nuova tool call",
    message: "Nuovo messaggio",
    guardrail: "Nuovo controllo",
  }[type];
}

function defaultDescriptionForType(type) {
  return {
    trigger: "Definisci evento in ingresso, sorgente e payload minimo.",
    agent: "Configura obiettivo, contesto, criteri decisionali e fallback.",
    tool: "Collega una funzione operativa con parametri espliciti.",
    message: "Imposta canale, template, lingua e condizioni di invio.",
    guardrail: "Definisci blocchi, soglie e casi da passare allo staff.",
  }[type];
}

function defaultToolForType(type) {
  return type === "message" ? "guest.sendMessage" : "ops.runTool";
}

function defaultParamsForType(type) {
  if (type === "trigger") {
    return { event: "custom.event", source: "webhook", payload_schema: {} };
  }
  if (type === "agent") {
    return { memory: "booking_context", temperature: 0.2, requires_human_approval: false };
  }
  if (type === "message") {
    return { channel: "whatsapp", template: "custom_template", language: "{{guest.language}}" };
  }
  if (type === "guardrail") {
    return { checks: [], failure_route: "ops.createStaffTask" };
  }
  return { booking_id: "{{booking.id}}", dry_run: false };
}

function defaultAgentPrompt() {
  return "Sei un sotto-agente operativo per un BnB. Definisci obiettivo, dati disponibili, passaggi decisionali, tono di comunicazione, limiti e fallback umano. Non promettere azioni non confermate dai tool e registra sempre le decisioni importanti nel PMS.";
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("visible");
  }, 2600);
}

function hydrateSavedState() {
  try {
    const saved = JSON.parse(localStorage.getItem("bnbflow-state") || "null");
    if (!Array.isArray(saved) || saved.length === 0) return;
    flows.splice(0, flows.length, ...saved);
    state.currentFlowId = flows[0].id;
    state.selectedNodeId = flows[0].nodes.find((node) => node.type === "agent")?.id || flows[0].nodes[0]?.id;
  } catch (error) {
    localStorage.removeItem("bnbflow-state");
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
