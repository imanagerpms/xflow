(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BNBFLOW_TASKS = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const taskCatalog = {
    guaranteeGuestAccess: {
      title: "Garantire accesso all'ospite",
      businessGoal: "guest_can_access_property",
      priority: "critica",
      slaMinutes: 12,
      proposal: "Preparare un accesso verificabile senza attendere il ripristino della smart lock.",
      fallbacks: [
        { id: "manual_code", label: "Codice manuale", resolutionType: "completed_manually", defaults: { access_method: "Codice manuale" } },
        { id: "physical_key", label: "Chiave fisica", resolutionType: "completed_with_workaround", defaults: { access_method: "Chiave fisica in lockbox" } },
        { id: "alternate_provider", label: "Provider alternativo", resolutionType: "completed_with_alternate_provider", defaults: { access_method: "Link provider alternativo" } },
        { id: "host_welcome", label: "Accoglienza host", resolutionType: "completed_with_workaround", defaults: { access_method: "Consegna chiavi da host" } },
      ],
      successContract: {
        requiredFields: ["access_method", "valid_from", "valid_until"],
        requiredEvidence: ["access_ready"],
        acceptedResolutions: ["completed_manually", "completed_with_workaround", "completed_with_alternate_provider"],
      },
    },
    completeDocumentation: {
      title: "Completare documentazione ospite",
      businessGoal: "guest_can_access_property",
      priority: "alta",
      slaMinutes: 45,
      proposal: "Assistere l'ospite o raccogliere i dati obbligatori in reception.",
      fallbacks: [
        { id: "assisted_portal", label: "Portale assistito", resolutionType: "completed_manually" },
        { id: "reception", label: "Raccolta in reception", resolutionType: "completed_with_workaround" },
      ],
      successContract: {
        requiredFields: ["verification_reference"],
        requiredEvidence: ["documents_complete"],
        acceptedResolutions: ["completed_manually", "completed_with_workaround"],
      },
    },
    verifyIdentity: {
      title: "Verificare identita dell'ospite",
      businessGoal: "guest_can_access_property",
      priority: "critica",
      slaMinutes: 15,
      proposal: "Confrontare prenotazione e prova minima senza condividere documenti in chat.",
      fallbacks: [
        { id: "verified_contact", label: "Contatto verificato", resolutionType: "completed_manually" },
        { id: "deny_access", label: "Nega accesso", resolutionType: "cannot_complete" },
      ],
      successContract: {
        requiredFields: ["verification_reference"],
        requiredEvidence: ["identity_verified"],
        acceptedResolutions: ["completed_manually", "cannot_complete"],
      },
    },
    securePayment: {
      title: "Ottenere garanzia di pagamento",
      businessGoal: "guest_can_access_property",
      priority: "alta",
      slaMinutes: 30,
      proposal: "Registrare un metodo alternativo o una garanzia autorizzata.",
      fallbacks: [
        { id: "pos", label: "POS in struttura", resolutionType: "completed_manually" },
        { id: "alternate_link", label: "Link alternativo", resolutionType: "completed_with_alternate_provider" },
      ],
      successContract: {
        requiredFields: ["payment_reference"],
        requiredEvidence: ["payment_secured"],
        acceptedResolutions: ["completed_manually", "completed_with_alternate_provider"],
      },
    },
    deliverUrgentCommunication: {
      title: "Consegnare comunicazione urgente",
      businessGoal: "guest_can_access_property",
      priority: "critica",
      slaMinutes: 8,
      proposal: "Usare SMS, OTA inbox o chiamata e confermare la ricezione.",
      fallbacks: [
        { id: "sms", label: "SMS", resolutionType: "completed_with_alternate_provider" },
        { id: "phone", label: "Chiamata", resolutionType: "completed_manually" },
      ],
      successContract: {
        requiredFields: ["delivery_channel"],
        requiredEvidence: ["guest_notified"],
        acceptedResolutions: ["completed_manually", "completed_with_alternate_provider"],
      },
    },
    resolveGuestIssue: {
      title: "Risolvere problema ospite",
      businessGoal: "guest_issue_is_safely_resolved",
      priority: "alta",
      slaMinutes: 20,
      proposal: "Rimuovere l'impatto con tecnico alternativo, workaround o cambio camera.",
      fallbacks: [
        { id: "alternate_vendor", label: "Tecnico alternativo", resolutionType: "completed_with_alternate_provider", defaults: { resolution_method: "Tecnico alternativo" } },
        { id: "workaround", label: "Workaround operativo", resolutionType: "completed_with_workaround", defaults: { resolution_method: "Workaround operativo" } },
        { id: "room_move", label: "Cambio camera", resolutionType: "completed_with_equivalent_outcome", defaults: { resolution_method: "Cambio camera" } },
      ],
      successContract: {
        requiredFields: ["resolution_method", "resolution_note"],
        requiredEvidence: ["impact_removed"],
        acceptedResolutions: ["completed_with_alternate_provider", "completed_with_workaround", "completed_with_equivalent_outcome"],
      },
    },
    authorizeTechnicalAccess: {
      title: "Autorizzare accesso tecnico",
      businessGoal: "guest_issue_is_safely_resolved",
      priority: "alta",
      slaMinutes: 15,
      proposal: "Ottenere consenso o presenza staff e definire una finestra.",
      fallbacks: [{ id: "staff_present", label: "Presenza staff", resolutionType: "completed_manually" }],
      successContract: {
        requiredFields: ["access_window"],
        requiredEvidence: ["technical_access_authorized"],
        acceptedResolutions: ["completed_manually"],
      },
    },
    manageCriticalIncident: {
      title: "Gestire incidente critico",
      businessGoal: "guest_issue_is_safely_resolved",
      priority: "critica",
      slaMinutes: 5,
      proposal: "Prendere il controllo, mettere al sicuro l'ospite e coordinare l'emergenza.",
      fallbacks: [
        { id: "takeover", label: "Takeover umano", resolutionType: "completed_manually" },
        { id: "relocation", label: "Ricollocazione", resolutionType: "completed_with_equivalent_outcome" },
      ],
      successContract: {
        requiredFields: ["safety_action", "owner"],
        requiredEvidence: ["guest_safe"],
        acceptedResolutions: ["completed_manually", "completed_with_equivalent_outcome"],
      },
    },
    resolveRefundRequest: {
      title: "Risolvere richiesta rimborso",
      businessGoal: "refund_request_is_resolved",
      priority: "alta",
      slaMinutes: 60,
      proposal: "Eseguire manualmente la decisione approvata o offrire un equivalente tracciabile.",
      fallbacks: [
        { id: "manual_refund", label: "Rimborso manuale", resolutionType: "completed_manually", defaults: { resolution_method: "Rimborso manuale" } },
        { id: "alternate_provider", label: "Gateway alternativo", resolutionType: "completed_with_alternate_provider", defaults: { resolution_method: "Gateway alternativo" } },
        { id: "voucher", label: "Voucher soggiorno", resolutionType: "completed_with_equivalent_outcome", defaults: { resolution_method: "Voucher soggiorno" } },
      ],
      successContract: {
        requiredFields: ["resolution_method", "amount_or_value", "transaction_reference"],
        requiredEvidence: ["resolution_executed"],
        acceptedResolutions: ["completed_manually", "completed_with_alternate_provider", "completed_with_equivalent_outcome"],
      },
    },
    approveRefund: {
      title: "Autorizzare richiesta rimborso",
      businessGoal: "refund_request_is_resolved",
      priority: "alta",
      slaMinutes: 120,
      proposal: "Verificare evidenze, importo e deroga prima dell'esecuzione.",
      fallbacks: [
        { id: "approved", label: "Approva", resolutionType: "approved" },
        { id: "rejected", label: "Rifiuta", resolutionType: "rejected" },
      ],
      successContract: {
        requiredFields: ["decision_note"],
        requiredEvidence: ["decision_recorded"],
        acceptedResolutions: ["approved", "rejected"],
      },
    },
    deliverMaintenanceUpdate: {
      title: "Aggiornare l'ospite sulla risoluzione",
      businessGoal: "guest_issue_is_safely_resolved",
      priority: "alta",
      slaMinutes: 10,
      proposal: "Usare un canale alternativo e confermare che l'ospite abbia ricevuto il piano.",
      fallbacks: [
        { id: "phone", label: "Chiamata", resolutionType: "completed_manually" },
        { id: "ota", label: "OTA inbox", resolutionType: "completed_with_alternate_provider" },
      ],
      successContract: {
        requiredFields: ["delivery_channel"],
        requiredEvidence: ["guest_notified"],
        acceptedResolutions: ["completed_manually", "completed_with_alternate_provider"],
      },
    },
    deliverRefundDecision: {
      title: "Comunicare la decisione sul rimborso",
      businessGoal: "refund_request_is_resolved",
      priority: "alta",
      slaMinutes: 30,
      proposal: "Consegnare la decisione motivata su un canale tracciabile.",
      fallbacks: [
        { id: "phone", label: "Chiamata registrata", resolutionType: "completed_manually" },
        { id: "ota", label: "OTA inbox", resolutionType: "completed_with_alternate_provider" },
      ],
      successContract: {
        requiredFields: ["delivery_channel"],
        requiredEvidence: ["decision_communicated"],
        acceptedResolutions: ["completed_manually", "completed_with_alternate_provider"],
      },
    },
    recordOperationalOutcome: {
      title: "Registrare esito operativo",
      businessGoal: null,
      priority: "alta",
      slaMinutes: 30,
      proposal: "Annotare manualmente l'esito nel PMS con un riferimento verificabile.",
      fallbacks: [{ id: "manual_record", label: "Nota PMS manuale", resolutionType: "completed_manually" }],
      successContract: {
        requiredFields: ["record_reference"],
        requiredEvidence: ["pms_updated"],
        acceptedResolutions: ["completed_manually"],
      },
    },
  };

  function validateSuccessContract(contract = {}, resolution = {}) {
    const fields = resolution.fields || {};
    const evidence = new Set(Array.isArray(resolution.evidence) ? resolution.evidence : Object.keys(resolution.evidence || {}).filter((key) => resolution.evidence[key]));
    const errors = [];
    for (const field of contract.requiredFields || []) {
      if (fields[field] === undefined || fields[field] === null || String(fields[field]).trim() === "") errors.push(`Campo obbligatorio: ${field}`);
    }
    for (const item of contract.requiredEvidence || []) {
      if (!evidence.has(item)) errors.push(`Evidenza obbligatoria: ${item}`);
    }
    if ((contract.acceptedResolutions || []).length && !contract.acceptedResolutions.includes(resolution.type)) {
      errors.push(`Risoluzione non ammessa: ${resolution.type || "non specificata"}`);
    }
    return { valid: errors.length === 0, errors };
  }

  return { taskCatalog, validateSuccessContract };
});
