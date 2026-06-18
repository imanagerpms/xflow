(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BNBFLOW_SCENARIOS = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const accessContract = {
    outcome: "guest_can_access_property",
    requiredFields: ["access_method", "valid_from", "valid_until"],
    requiredEvidence: ["guest_notified", "pms_updated"],
    acceptedResolutions: ["tool", "completed_manually", "completed_with_alternate_provider", "completed_with_workaround"],
  };
  const issueContract = {
    outcome: "guest_issue_is_safely_resolved",
    requiredFields: ["resolution_method"],
    requiredEvidence: ["guest_safe", "guest_notified", "pms_updated"],
    acceptedResolutions: ["tool", "completed_manually", "completed_with_alternate_provider", "completed_with_workaround", "completed_with_equivalent_outcome"],
  };
  const refundContract = {
    outcome: "refund_request_is_resolved",
    requiredFields: ["decision", "resolution_method"],
    requiredEvidence: ["decision_communicated", "pms_updated"],
    acceptedResolutions: ["tool", "completed_manually", "completed_with_alternate_provider", "completed_with_equivalent_outcome", "rejected"],
  };

  const flows = {
    "online-checkin": {
      id: "online-checkin",
      version: 3,
      name: "Check-in online e accesso",
      group: "arrival-access",
      entryNodeId: "access-event",
      businessGoal: "guest_can_access_property",
      successContract: accessContract,
      nodes: [
        { id: "access-event", type: "trigger", name: "Check-in online ricevuto", description: "Acquisisce prenotazione, documenti e stato saldo.", outcomes: { success: "verify-access-prerequisites" } },
        { id: "verify-access-prerequisites", type: "decision", name: "Verifica identita, dati e saldo", description: "Instrada dati mancanti, incongruenze e saldo prima di creare accessi.", businessGoal: "guest_can_access_property", capability: "verify_arrival_eligibility", outcomes: { success: "create-temporary-access", needs_data: "complete-documents", policy_blocked: "verify-identity", needs_approval: "secure-payment" } },
        { id: "complete-documents", type: "human_task", name: "Completa documentazione", taskKey: "completeDocumentation", outcomes: { completed_manually: "verify-access-prerequisites", completed_with_workaround: "verify-access-prerequisites", cannot_complete: "access-failed" } },
        { id: "verify-identity", type: "human_task", name: "Verifica identita", taskKey: "verifyIdentity", outcomes: { completed_manually: "create-temporary-access", cannot_complete: "access-failed" } },
        { id: "secure-payment", type: "human_task", name: "Ottieni garanzia pagamento", taskKey: "securePayment", outcomes: { completed_manually: "create-temporary-access", completed_with_alternate_provider: "create-temporary-access", cannot_complete: "access-failed" } },
        {
          id: "create-temporary-access", type: "tool", name: "Crea accesso temporaneo", description: "Crea un accesso per il soggiorno; il provider e sostituibile.",
          businessGoal: "guest_can_access_property", capability: "create_temporary_access", tool: "access.createSmartLockLink", timeoutSeconds: 15, maxAttempts: 3,
          retryBackoffMs: [500, 1000, 2000], idempotencyKey: "{{booking.id}}:access:v1", fallbackTaskKey: "guaranteeGuestAccess",
          fallbackPlaybook: ["retry_same_tool", "alternate_provider", "manual_code", "physical_key", "host_welcome"],
          successContract: accessContract,
          onSuccess: { fields: { access_method: "Link smart lock", valid_from: "15:00", valid_until: "11:30" }, resolutionType: "tool" },
          outcomes: { success: "send-access-instructions", completed_manually: "send-access-instructions", completed_with_workaround: "send-access-instructions", completed_with_alternate_provider: "send-access-instructions", failed: "access-failed", timed_out: "access-failed" },
        },
        {
          id: "send-access-instructions", type: "tool", name: "Invia istruzioni di accesso", businessGoal: "guest_can_access_property", capability: "deliver_guest_message", tool: "guest.sendAccessInstructions",
          timeoutSeconds: 10, maxAttempts: 2, idempotencyKey: "{{booking.id}}:access-instructions:v1", fallbackTaskKey: "deliverUrgentCommunication",
          onSuccess: { evidence: ["guest_notified"] }, outcomes: { success: "record-access-pms", completed_manually: "record-access-pms", completed_with_alternate_provider: "record-access-pms" },
        },
        {
          id: "record-access-pms", type: "tool", name: "Aggiorna PMS", businessGoal: "guest_can_access_property", capability: "record_operational_outcome", tool: "pms.recordAccessDelivery",
          timeoutSeconds: 8, maxAttempts: 3, idempotencyKey: "{{booking.id}}:pms-access:v1", fallbackTaskKey: "recordOperationalOutcome", onSuccess: { evidence: ["pms_updated"] }, outcomes: { success: "access-completed", completed_manually: "access-completed" },
        },
        { id: "access-completed", type: "outcome", name: "Accesso garantito", businessGoal: "guest_can_access_property", successContract: accessContract },
        { id: "access-failed", type: "terminal", name: "Accesso non autorizzato", terminalStatus: "failed" },
      ],
    },
    maintenance: {
      id: "maintenance",
      version: 3,
      name: "Guasto durante il soggiorno",
      group: "in-stay",
      entryNodeId: "issue-event",
      businessGoal: "guest_issue_is_safely_resolved",
      successContract: issueContract,
      nodes: [
        { id: "issue-event", type: "trigger", name: "Segnalazione ospite", outcomes: { success: "triage-issue" } },
        { id: "triage-issue", type: "decision", name: "Triage sicurezza e impatto", businessGoal: "guest_issue_is_safely_resolved", capability: "triage_guest_issue", outcomes: { informational: "send-self-help", comfort: "create-maintenance-ticket", needs_approval: "authorize-technical-access", critical: "critical-takeover" } },
        { id: "send-self-help", type: "tool", name: "Invia soluzione guidata", tool: "guest.sendSelfHelp", businessGoal: "guest_issue_is_safely_resolved", capability: "resolve_information_request", idempotencyKey: "{{booking.id}}:self-help:v1", maxAttempts: 2, fallbackTaskKey: "resolveGuestIssue", onSuccess: { fields: { resolution_method: "Istruzioni verificate" }, evidence: ["guest_safe", "guest_notified"], resolutionType: "tool" }, outcomes: { success: "record-issue-pms", completed_with_alternate_provider: "notify-issue-resolution", completed_with_workaround: "notify-issue-resolution", completed_with_equivalent_outcome: "notify-issue-resolution" } },
        { id: "authorize-technical-access", type: "human_task", name: "Autorizza accesso tecnico", taskKey: "authorizeTechnicalAccess", outcomes: { completed_manually: "create-maintenance-ticket", cannot_complete: "resolve-guest-issue" } },
        { id: "critical-takeover", type: "human_task", name: "Takeover incidente critico", taskKey: "manageCriticalIncident", outcomes: { completed_manually: "notify-issue-resolution", completed_with_equivalent_outcome: "notify-issue-resolution", cannot_complete: "issue-failed" } },
        { id: "create-maintenance-ticket", type: "tool", name: "Crea ticket operativo", tool: "ops.createMaintenanceTicket", businessGoal: "guest_issue_is_safely_resolved", capability: "open_maintenance_case", idempotencyKey: "{{booking.id}}:issue-ticket:v1", maxAttempts: 2, fallbackTaskKey: "resolveGuestIssue", outcomes: { success: "dispatch-vendor", completed_with_alternate_provider: "notify-issue-resolution", completed_with_workaround: "notify-issue-resolution", completed_with_equivalent_outcome: "notify-issue-resolution" } },
        {
          id: "dispatch-vendor", type: "tool", name: "Incarica fornitore", tool: "vendor.dispatch", businessGoal: "guest_issue_is_safely_resolved", capability: "dispatch_qualified_vendor",
          timeoutSeconds: 20, maxAttempts: 3, retryBackoffMs: [500, 1000, 2000], idempotencyKey: "{{booking.id}}:vendor:v1", fallbackTaskKey: "resolveGuestIssue",
          fallbackPlaybook: ["retry_same_tool", "alternate_vendor", "staff_workaround", "room_move"],
          onSuccess: { fields: { resolution_method: "Tecnico incaricato" }, evidence: ["guest_safe"], resolutionType: "tool" },
          outcomes: { success: "notify-issue-resolution", completed_with_alternate_provider: "notify-issue-resolution", completed_with_workaround: "notify-issue-resolution", completed_with_equivalent_outcome: "notify-issue-resolution" },
        },
        { id: "resolve-guest-issue", type: "human_task", name: "Rimuovi impatto sul soggiorno", taskKey: "resolveGuestIssue", outcomes: { completed_with_alternate_provider: "notify-issue-resolution", completed_with_workaround: "notify-issue-resolution", completed_with_equivalent_outcome: "notify-issue-resolution", cannot_complete: "issue-failed" } },
        { id: "notify-issue-resolution", type: "tool", name: "Aggiorna ospite", tool: "guest.sendMaintenanceUpdate", businessGoal: "guest_issue_is_safely_resolved", capability: "deliver_guest_message", idempotencyKey: "{{booking.id}}:issue-message:v1", maxAttempts: 2, fallbackTaskKey: "deliverMaintenanceUpdate", onSuccess: { evidence: ["guest_notified"] }, outcomes: { success: "record-issue-pms", completed_manually: "record-issue-pms", completed_with_alternate_provider: "record-issue-pms" } },
        { id: "record-issue-pms", type: "tool", name: "Registra risoluzione nel PMS", tool: "pms.recordIssueResolution", businessGoal: "guest_issue_is_safely_resolved", capability: "record_operational_outcome", idempotencyKey: "{{booking.id}}:issue-pms:v1", maxAttempts: 3, fallbackTaskKey: "recordOperationalOutcome", onSuccess: { evidence: ["pms_updated"] }, outcomes: { success: "issue-completed", completed_manually: "issue-completed" } },
        { id: "issue-completed", type: "outcome", name: "Problema risolto in sicurezza", businessGoal: "guest_issue_is_safely_resolved", successContract: issueContract },
        { id: "issue-failed", type: "terminal", name: "Caso non risolto", terminalStatus: "failed" },
      ],
    },
    "refund-request": {
      id: "refund-request",
      version: 3,
      name: "Richiesta rimborso",
      group: "revenue",
      entryNodeId: "refund-event",
      businessGoal: "refund_request_is_resolved",
      successContract: refundContract,
      nodes: [
        { id: "refund-event", type: "trigger", name: "Richiesta rimborso ricevuta", outcomes: { success: "assess-refund" } },
        { id: "assess-refund", type: "decision", name: "Valuta policy, evidenze e soglia", businessGoal: "refund_request_is_resolved", capability: "assess_refund_policy", outcomes: { outside_policy: "communicate-rejection", automatic: "execute-refund", needs_approval: "approve-refund", equivalent: "resolve-refund" } },
        { id: "approve-refund", type: "human_task", name: "Approval gate", taskKey: "approveRefund", outcomes: { approved: "execute-refund", rejected: "communicate-rejection", cannot_complete: "refund-failed" } },
        {
          id: "execute-refund", type: "tool", name: "Esegui rimborso", tool: "payment.executeRefund", businessGoal: "refund_request_is_resolved", capability: "execute_refund",
          timeoutSeconds: 20, maxAttempts: 3, retryBackoffMs: [500, 1000, 2000], idempotencyKey: "{{booking.id}}:refund:v1", fallbackTaskKey: "resolveRefundRequest",
          fallbackPlaybook: ["retry_same_tool", "alternate_gateway", "manual_refund", "voucher"],
          onSuccess: { fields: { decision: "approvato", resolution_method: "Rimborso gateway" }, resolutionType: "tool" },
          outcomes: { success: "communicate-refund", completed_manually: "communicate-refund", completed_with_alternate_provider: "communicate-refund", completed_with_equivalent_outcome: "communicate-refund" },
        },
        { id: "resolve-refund", type: "human_task", name: "Risolvi con alternativa", taskKey: "resolveRefundRequest", outcomes: { completed_manually: "communicate-refund", completed_with_alternate_provider: "communicate-refund", completed_with_equivalent_outcome: "communicate-refund", cannot_complete: "refund-failed" } },
        { id: "communicate-rejection", type: "tool", name: "Comunica esito fuori policy", tool: "guest.sendRefundDecision", businessGoal: "refund_request_is_resolved", capability: "deliver_sensitive_decision", idempotencyKey: "{{booking.id}}:refund-rejection:v1", maxAttempts: 2, fallbackTaskKey: "deliverRefundDecision", onSuccess: { fields: { decision: "rifiutato", resolution_method: "Chiusura secondo policy" }, evidence: ["decision_communicated"] }, outcomes: { success: "record-refund-pms", completed_manually: "record-refund-pms", completed_with_alternate_provider: "record-refund-pms" } },
        { id: "communicate-refund", type: "tool", name: "Comunica risoluzione", tool: "guest.sendRefundDecision", businessGoal: "refund_request_is_resolved", capability: "deliver_sensitive_decision", idempotencyKey: "{{booking.id}}:refund-message:v1", maxAttempts: 2, fallbackTaskKey: "deliverRefundDecision", onSuccess: { evidence: ["decision_communicated"] }, outcomes: { success: "record-refund-pms", completed_manually: "record-refund-pms", completed_with_alternate_provider: "record-refund-pms" } },
        { id: "record-refund-pms", type: "tool", name: "Aggiorna pratica e PMS", tool: "pms.recordRefundResolution", businessGoal: "refund_request_is_resolved", capability: "record_operational_outcome", idempotencyKey: "{{booking.id}}:refund-pms:v1", maxAttempts: 3, fallbackTaskKey: "recordOperationalOutcome", onSuccess: { evidence: ["pms_updated"] }, outcomes: { success: "refund-completed", completed_manually: "refund-completed" } },
        { id: "refund-completed", type: "outcome", name: "Richiesta risolta", businessGoal: "refund_request_is_resolved", successContract: refundContract },
        { id: "refund-failed", type: "terminal", name: "Richiesta non risolta", terminalStatus: "failed" },
      ],
    },
  };

  const scenarios = [
    { id: "access-happy", flowId: "online-checkin", name: "Percorso ideale", description: "Documenti e saldo validi; smart lock disponibile.", nodeOutcomes: { "verify-access-prerequisites": "success" }, toolPlans: {}, context: { booking: { id: "BK-DEMO-101" } } },
    { id: "access-documents-missing", flowId: "online-checkin", name: "Documento mancante", description: "Il run attende il completamento documenti e riprende.", nodeOutcomes: { "verify-access-prerequisites": ["needs_data", "success"] }, toolPlans: {}, context: { booking: { id: "BK-DEMO-102" } } },
    { id: "access-balance-open", flowId: "online-checkin", name: "Saldo aperto", description: "Serve una garanzia alternativa prima dell'accesso.", nodeOutcomes: { "verify-access-prerequisites": "needs_approval" }, toolPlans: {}, context: { booking: { id: "BK-DEMO-103" } } },
    { id: "access-identity-mismatch", flowId: "online-checkin", name: "Identita incoerente", description: "L'accesso automatico viene bloccato.", nodeOutcomes: { "verify-access-prerequisites": "policy_blocked" }, toolPlans: {}, context: { booking: { id: "BK-DEMO-104" } } },
    { id: "access-smartlock-timeout", flowId: "online-checkin", name: "Smart lock in timeout · demo obbligatoria", description: "Tre tentativi, task operativo, ripresa e issue tecnica separata.", nodeOutcomes: { "verify-access-prerequisites": "success" }, toolPlans: { "access.createSmartLockLink": { behavior: "timeout", failAttempts: 3, latencyMs: 15000 } }, context: { booking: { id: "BK-DEMO-105" } } },
    { id: "access-message-failed", flowId: "online-checkin", name: "Messaggio non consegnato", description: "L'accesso esiste ma serve un canale alternativo.", nodeOutcomes: { "verify-access-prerequisites": "success" }, toolPlans: { "guest.sendAccessInstructions": { behavior: "permanent_error" } }, context: { booking: { id: "BK-DEMO-106" } } },
    { id: "maintenance-informational", flowId: "maintenance", name: "Problema informativo", description: "Risoluzione automatica con istruzioni verificate.", nodeOutcomes: { "triage-issue": "informational" }, toolPlans: {}, context: { booking: { id: "BK-DEMO-201" } } },
    { id: "maintenance-comfort", flowId: "maintenance", name: "Comfort · tecnico disponibile", description: "Ticket, dispatch e aggiornamento ospite.", nodeOutcomes: { "triage-issue": "comfort" }, toolPlans: {}, context: { booking: { id: "BK-DEMO-202" } } },
    { id: "maintenance-vendor-failed", flowId: "maintenance", name: "Vendor dispatch fallito", description: "Task orientato alla risoluzione del problema ospite.", nodeOutcomes: { "triage-issue": "comfort" }, toolPlans: { "vendor.dispatch": { behavior: "permanent_error" } }, context: { booking: { id: "BK-DEMO-203" } } },
    { id: "maintenance-access-not-authorized", flowId: "maintenance", name: "Accesso tecnico non autorizzato", description: "Richiede consenso o presenza staff.", nodeOutcomes: { "triage-issue": "needs_approval" }, toolPlans: {}, context: { booking: { id: "BK-DEMO-204" } } },
    { id: "maintenance-critical", flowId: "maintenance", name: "Incidente critico", description: "Takeover umano immediato.", nodeOutcomes: { "triage-issue": "critical" }, toolPlans: {}, context: { booking: { id: "BK-DEMO-205" } } },
    { id: "maintenance-room-move", flowId: "maintenance", name: "Cambio camera", description: "Outcome equivalente tramite room move.", nodeOutcomes: { "triage-issue": "comfort" }, toolPlans: { "vendor.dispatch": { behavior: "permanent_error" } }, context: { booking: { id: "BK-DEMO-206" } } },
    { id: "refund-outside-policy", flowId: "refund-request", name: "Richiesta fuori policy", description: "Decisione motivata e comunicata.", nodeOutcomes: { "assess-refund": "outside_policy" }, toolPlans: {}, context: { booking: { id: "BK-DEMO-301" }, refund: { amount: 120 } } },
    { id: "refund-under-threshold", flowId: "refund-request", name: "Rimborso sotto soglia", description: "Esecuzione automatica entro policy.", nodeOutcomes: { "assess-refund": "automatic" }, toolPlans: {}, context: { booking: { id: "BK-DEMO-302" }, refund: { amount: 25 } } },
    { id: "refund-manager-approval", flowId: "refund-request", name: "Approvazione manager", description: "Approval gate prima dell'esecuzione.", nodeOutcomes: { "assess-refund": "needs_approval" }, toolPlans: {}, context: { booking: { id: "BK-DEMO-303" }, refund: { amount: 180 } } },
    { id: "refund-approval-rejected", flowId: "refund-request", name: "Approvazione rifiutata", description: "Rifiuto strutturato e comunicazione al cliente.", nodeOutcomes: { "assess-refund": "needs_approval" }, toolPlans: {}, context: { booking: { id: "BK-DEMO-304" }, refund: { amount: 180 } } },
    { id: "refund-api-failed", flowId: "refund-request", name: "Refund API fallita", description: "Task per risolvere la richiesta, non per riparare il gateway.", nodeOutcomes: { "assess-refund": "automatic" }, toolPlans: { "payment.executeRefund": { behavior: "permanent_error" } }, context: { booking: { id: "BK-DEMO-305" }, refund: { amount: 25 } } },
    { id: "refund-voucher", flowId: "refund-request", name: "Voucher o credito", description: "Outcome equivalente con valore tracciato.", nodeOutcomes: { "assess-refund": "equivalent" }, toolPlans: {}, context: { booking: { id: "BK-DEMO-306" }, refund: { amount: 75 } } },
  ];

  function getScenariosForFlow(flowId) {
    return scenarios.filter((scenario) => scenario.flowId === flowId);
  }

  return { flows, scenarios, getScenariosForFlow };
});
