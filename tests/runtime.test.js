const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const { FlowRuntime, assertTransition, RUN_TRANSITIONS } = require("../runtime.js");
const { MockToolRegistry } = require("../mock-tools.js");
const { validateSuccessContract } = require("../task-catalog.js");
const { RuntimeStore, RUNTIME_SCHEMA_VERSION } = require("../storage.js");
const { flows, scenarios } = require("../scenarios.js");

function deterministicClock() {
  let now = 1_700_000_000_000;
  return () => (now += 1000);
}

function scenario(id) {
  return structuredClone(scenarios.find((item) => item.id === id));
}

function runtimeFor(scenarioId, options = {}) {
  const selected = scenario(scenarioId);
  const runtime = new FlowRuntime({ clock: deterministicClock(), ...options });
  runtime.start(flows[selected.flowId], selected);
  return runtime;
}

test("il catalogo canonico resta 40 flussi, 8x5, 30 Core e 10 Avanzati", () => {
  const sandbox = {
    window: {
      BNBFLOW_SCENARIOS: { flows: {}, scenarios: [] },
      BNBFLOW_STORAGE: { RuntimeStore: class { load() { return null; } save() {} } },
      BNBFLOW_RUNTIME: { FlowRuntime: class {} },
      localStorage: {},
    },
    document: { addEventListener() {} },
    localStorage: {},
    structuredClone,
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync("catalog.js", "utf8"), sandbox);
  vm.runInContext(`${fs.readFileSync("app.js", "utf8")}; window.__flows = flows;`, sandbox);
  const catalog = sandbox.window.BNBFLOW_CATALOG;
  const allFlows = sandbox.window.__flows;
  assert.equal(catalog.groups.length, 8);
  assert.equal(allFlows.length, 40);
  assert.equal(allFlows.filter((flow) => flow.level === "Core").length, 30);
  assert.equal(allFlows.filter((flow) => flow.level === "Avanzato").length, 10);
  catalog.groups.forEach((group) => assert.equal(allFlows.filter((flow) => flow.group === group.id).length, 5));
});

test("la state machine rifiuta transizioni run invalide", () => {
  assert.doesNotThrow(() => assertTransition(RUN_TRANSITIONS, "queued", "running", "run"));
  assert.throws(() => assertTransition(RUN_TRANSITIONS, "completed", "running", "run"), /Transizione run non valida/);
});

test("i tre flussi pilota completano il percorso nominale end-to-end", () => {
  for (const scenarioId of ["access-happy", "maintenance-comfort", "refund-under-threshold"]) {
    const runtime = runtimeFor(scenarioId);
    runtime.runUntilBlocked();
    assert.equal(runtime.run.status, "completed", scenarioId);
    assert.ok(runtime.run.audit.some((event) => event.eventType === "success_contract.evaluated" && event.data.valid));
  }
});

test("ogni edge punta a un nodo esistente e ogni tool critico ha un fallback", () => {
  Object.values(flows).forEach((flow) => {
    const nodeIds = new Set(flow.nodes.map((node) => node.id));
    flow.nodes.forEach((node) => {
      Object.values(node.outcomes || {}).forEach((target) => assert.ok(nodeIds.has(target), `${flow.id}:${node.id} -> ${target}`));
      if (node.type === "tool") {
        const terminalRoute = Boolean(node.outcomes?.failed || node.outcomes?.timed_out);
        assert.ok(node.fallbackTaskKey || terminalRoute, `${flow.id}:${node.id} senza fallback`);
      }
    });
  });
});

test("il routing outcome gestisce dato mancante e riprende sulla verifica", () => {
  const runtime = runtimeFor("access-documents-missing");
  runtime.runUntilBlocked();
  assert.equal(runtime.run.status, "waiting_human");
  assert.equal(runtime.run.tasks[0].title, "Completare documentazione ospite");
  const result = runtime.resolveTask(runtime.run.tasks[0].id, {
    type: "completed_manually",
    fields: { verification_reference: "VER-101" },
    evidence: ["documents_complete"],
  });
  assert.equal(result.ok, true);
  runtime.runUntilBlocked();
  assert.equal(runtime.run.status, "completed");
  assert.equal(runtime.run.nodeVisits["verify-access-prerequisites"], 2);
});

test("timeout applica tre tentativi, backoff e fallback business", () => {
  const runtime = runtimeFor("access-smartlock-timeout");
  runtime.runUntilBlocked();
  const attempts = runtime.run.toolAttempts.filter((attempt) => attempt.tool === "access.createSmartLockLink");
  const retries = runtime.run.audit.filter((event) => event.eventType === "tool.retry_scheduled");
  assert.equal(attempts.length, 3);
  assert.deepEqual(retries.map((event) => event.data.backoffMs), [500, 1000]);
  assert.equal(runtime.run.tasks[0].title, "Garantire accesso all'ospite");
  assert.equal(runtime.run.tasks[0].businessGoal, "guest_can_access_property");
  assert.equal(runtime.run.technicalIssues[0].status, "open");
});

test("il registry mock rende idempotente una side effect riuscita", () => {
  const tools = new MockToolRegistry();
  const request = { tool: "pms.recordAccessDelivery", input: { booking: "BK-1" }, idempotencyKey: "BK-1:pms:v1", attempt: 1 };
  const first = tools.execute(request);
  const second = tools.execute({ ...request, attempt: 2 });
  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  assert.equal(second.sideEffect, false);
  assert.equal(tools.getSideEffectCount("pms.recordAccessDelivery"), 1);
});

test("il success contract richiede campi, evidenze e tipo ammesso", () => {
  const contract = { requiredFields: ["method"], requiredEvidence: ["confirmed"], acceptedResolutions: ["completed_manually"] };
  assert.equal(validateSuccessContract(contract, { type: "completed_manually", fields: {}, evidence: [] }).valid, false);
  assert.equal(validateSuccessContract(contract, { type: "completed_manually", fields: { method: "chiave" }, evidence: ["confirmed"] }).valid, true);
  assert.equal(validateSuccessContract(contract, { type: "rejected", fields: { method: "chiave" }, evidence: ["confirmed"] }).valid, false);
});

test("un task umano non si chiude senza evidenze obbligatorie", () => {
  const runtime = runtimeFor("access-smartlock-timeout");
  runtime.runUntilBlocked();
  const result = runtime.resolveTask(runtime.run.tasks[0].id, {
    type: "completed_with_workaround",
    fields: { access_method: "Chiave", valid_from: "15:00", valid_until: "11:30" },
    evidence: [],
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /access_ready/);
  assert.equal(runtime.run.status, "waiting_human");
});

test("risoluzione manuale riprende senza duplicare azioni e lascia issue tecnica aperta", () => {
  const tools = new MockToolRegistry();
  const runtime = runtimeFor("access-smartlock-timeout", { tools });
  runtime.runUntilBlocked();
  const task = runtime.run.tasks[0];
  const resolution = {
    type: "completed_with_workaround",
    fields: { access_method: "Chiave fisica", valid_from: "15:00", valid_until: "11:30" },
    evidence: ["access_ready"],
  };
  assert.equal(runtime.resolveTask(task.id, resolution).ok, true);
  assert.equal(runtime.resolveTask(task.id, resolution).alreadyResolved, true);
  runtime.runUntilBlocked();
  assert.equal(runtime.run.status, "completed");
  assert.equal(runtime.run.stepRuns.filter((step) => step.nodeId === "create-temporary-access").length, 1);
  assert.equal(tools.getSideEffectCount("guest.sendAccessInstructions"), 1);
  assert.equal(tools.getSideEffectCount("pms.recordAccessDelivery"), 1);
  assert.equal(runtime.run.technicalIssues[0].status, "open");
  assert.equal(runtime.run.technicalIssues[0].operationalWorkaround, "active");
  assert.equal(runtime.run.technicalIssues[0].runNoLongerBlocked, true);
});

test("guasto con vendor fallito completa tramite provider alternativo", () => {
  const runtime = runtimeFor("maintenance-vendor-failed");
  runtime.runUntilBlocked();
  assert.equal(runtime.run.tasks[0].title, "Risolvere problema ospite");
  runtime.resolveTask(runtime.run.tasks[0].id, {
    type: "completed_with_alternate_provider",
    fields: { resolution_method: "Tecnico alternativo", resolution_note: "Intervento confermato" },
    evidence: ["impact_removed"],
  });
  runtime.runUntilBlocked();
  assert.equal(runtime.run.status, "completed");
  assert.ok(runtime.run.audit.some((event) => event.eventType === "run.resumed_after_human"));
});

test("refund API fallita completa manualmente e comunica la decisione", () => {
  const runtime = runtimeFor("refund-api-failed");
  runtime.runUntilBlocked();
  assert.equal(runtime.run.tasks[0].title, "Risolvere richiesta rimborso");
  runtime.resolveTask(runtime.run.tasks[0].id, {
    type: "completed_manually",
    fields: { resolution_method: "Rimborso manuale", amount_or_value: "25 EUR", transaction_reference: "RF-MAN-25" },
    evidence: ["resolution_executed"],
  });
  runtime.runUntilBlocked();
  assert.equal(runtime.run.status, "completed");
  assert.equal(runtime.run.outcomeState.refund_request_is_resolved.fields.decision, "approvato");
});

test("la persistenza runtime usa uno schema versionato", () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: (key) => memory.delete(key) };
  const store = new RuntimeStore(storage);
  const snapshot = store.save({ run: { id: "run-1", status: "waiting_human" } });
  assert.equal(snapshot.schemaVersion, RUNTIME_SCHEMA_VERSION);
  assert.equal(store.load().data.run.status, "waiting_human");
});
