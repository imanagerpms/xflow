(function (root, factory) {
  let auditApi = root?.BNBFLOW_AUDIT;
  let toolApi = root?.BNBFLOW_TOOLS;
  let taskApi = root?.BNBFLOW_TASKS;
  if (typeof module === "object" && module.exports) {
    auditApi = require("./audit.js");
    toolApi = require("./mock-tools.js");
    taskApi = require("./task-catalog.js");
  }
  const api = factory(auditApi, toolApi, taskApi);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BNBFLOW_RUNTIME = api;
})(typeof window !== "undefined" ? window : globalThis, function (auditApi, toolApi, taskApi) {
  const RUN_TRANSITIONS = {
    queued: ["running", "cancelled"],
    running: ["waiting_guest", "waiting_human", "waiting_external", "paused", "completed", "partially_completed", "failed", "cancelled"],
    waiting_guest: ["running", "cancelled"],
    waiting_human: ["running", "failed", "cancelled"],
    waiting_external: ["running", "cancelled"],
    paused: ["running", "cancelled"],
    completed: [], partially_completed: [], failed: [], cancelled: [],
  };

  const STEP_TRANSITIONS = {
    pending: ["running", "skipped", "cancelled"],
    running: ["succeeded", "retry_scheduled", "waiting_human", "failed", "skipped"],
    retry_scheduled: ["running", "failed"],
    waiting_human: ["completed_manually", "completed_with_alternate_provider", "completed_with_workaround", "completed_with_equivalent_outcome", "failed"],
    succeeded: [], completed_manually: [], completed_with_alternate_provider: [], completed_with_workaround: [], completed_with_equivalent_outcome: [], failed: [], skipped: [], compensated: [], cancelled: [],
  };

  function assertTransition(table, from, to, entity) {
    if (!(table[from] || []).includes(to)) throw new Error(`Transizione ${entity} non valida: ${from} -> ${to}`);
  }

  class FlowRuntime {
    constructor(options = {}) {
      this.clock = options.clock || (() => Date.now());
      this.audit = options.audit || new auditApi.AuditTrail({ clock: this.clock });
      this.tools = options.tools || new toolApi.MockToolRegistry();
      this.tasks = options.taskCatalog || taskApi.taskCatalog;
      this.onChange = options.onChange || (() => {});
      this.runSequence = 0;
      this.run = null;
      this.flow = null;
      this.scenario = null;
    }

    start(flow, scenario = {}) {
      this.flow = structuredClone(flow);
      this.scenario = structuredClone(scenario);
      this.runSequence += 1;
      const now = new Date(this.clock()).toISOString();
      this.run = {
        id: `run-${flow.id}-${String(this.runSequence).padStart(3, "0")}`,
        flowId: flow.id,
        flowVersion: flow.version,
        scenarioId: scenario.id || "default",
        scenarioName: scenario.name || "Scenario standard",
        status: "queued",
        currentNodeId: flow.entryNodeId,
        context: structuredClone(scenario.context || {}),
        outcomeState: {},
        stepRuns: [],
        toolAttempts: [],
        tasks: [],
        technicalIssues: [],
        audit: [],
        counters: { step: 0, task: 0, technical: 0, audit: 0 },
        nodeVisits: {},
        startedAt: now,
        updatedAt: now,
        completedAt: null,
      };
      this.tools.configure(scenario.toolPlans || {});
      this.audit.emit(this.run, "run.queued", { flowId: flow.id, flowVersion: flow.version, scenarioId: this.run.scenarioId });
      this._notify();
      return this.run;
    }

    restore(flow, scenario, run) {
      this.flow = structuredClone(flow);
      this.scenario = structuredClone(scenario || {});
      this.run = structuredClone(run);
      this.runSequence = Math.max(this.runSequence, Number(this.run.id?.match(/(\d+)$/)?.[1] || 0));
      this.tools.configure(this.scenario.toolPlans || {});
      this.audit.emit(this.run, "run.restored", { status: this.run.status, currentNodeId: this.run.currentNodeId });
      this._notify();
      return this.run;
    }

    snapshot() {
      return this.run ? structuredClone(this.run) : null;
    }

    transitionRun(to) {
      if (this.run.status === to) return;
      assertTransition(RUN_TRANSITIONS, this.run.status, to, "run");
      const from = this.run.status;
      this.run.status = to;
      this.run.updatedAt = new Date(this.clock()).toISOString();
      if (["completed", "partially_completed", "failed", "cancelled"].includes(to)) this.run.completedAt = this.run.updatedAt;
      this.audit.emit(this.run, `run.${to}`, { from, to });
    }

    transitionStep(step, to) {
      if (step.status === to) return;
      assertTransition(STEP_TRANSITIONS, step.status, to, "step");
      const from = step.status;
      step.status = to;
      step.timestamps ||= {};
      step.timestamps[to] = new Date(this.clock()).toISOString();
      this.audit.emit(this.run, `step.${to}`, { stepRunId: step.id, nodeId: step.nodeId, from, to });
    }

    advance() {
      if (!this.run || !this.flow) throw new Error("Nessun run inizializzato");
      if (["completed", "partially_completed", "failed", "cancelled"].includes(this.run.status)) return this.run;
      if (["waiting_human", "waiting_guest", "waiting_external", "paused"].includes(this.run.status)) return this.run;
      if (this.run.status === "queued") this.transitionRun("running");

      const node = this.flow.nodes.find((item) => item.id === this.run.currentNodeId);
      if (!node) {
        this.transitionRun("failed");
        this.audit.emit(this.run, "runtime.node_missing", { nodeId: this.run.currentNodeId });
        this._notify();
        return this.run;
      }

      const step = this._getOrCreateStep(node);
      if (step.status === "pending" || step.status === "retry_scheduled") this.transitionStep(step, "running");
      this.run.nodeVisits[node.id] = (this.run.nodeVisits[node.id] || 0) + 1;
      this.audit.emit(this.run, "node.entered", { nodeId: node.id, type: node.type, visit: this.run.nodeVisits[node.id] });

      if (node.type === "trigger") this._completeStep(step, node, "success");
      else if (node.type === "decision") this._executeDecision(step, node);
      else if (node.type === "tool") this._executeTool(step, node);
      else if (node.type === "human_task") this._waitForHuman(step, node, node.taskKey);
      else if (node.type === "outcome") this._completeOutcome(step, node);
      else if (node.type === "terminal") this._completeTerminal(step, node);
      else this._completeStep(step, node, "success");

      this._notify();
      return this.run;
    }

    runUntilBlocked(maxSteps = 100) {
      let count = 0;
      while (this.run && ["queued", "running"].includes(this.run.status) && count < maxSteps) {
        this.advance();
        count += 1;
      }
      if (count >= maxSteps) throw new Error("Limite di sicurezza del runtime superato");
      return this.run;
    }

    pause() {
      if (this.run?.status === "running") {
        this.transitionRun("paused");
        this._notify();
      }
      return this.run;
    }

    resume() {
      if (["paused", "waiting_external", "waiting_guest"].includes(this.run?.status)) {
        this.transitionRun("running");
        this._notify();
      }
      return this.run;
    }

    cancel() {
      if (this.run && !["completed", "failed", "cancelled"].includes(this.run.status)) {
        this.transitionRun("cancelled");
        this._notify();
      }
      return this.run;
    }

    resolveTask(taskId, resolution, actor = "operator.demo") {
      const task = this.run?.tasks.find((item) => item.id === taskId);
      if (!task) return { ok: false, errors: ["Task non trovato"] };
      if (task.status === "resolved") return { ok: true, alreadyResolved: true, task };
      if (!["open", "assigned", "in_progress"].includes(task.status)) return { ok: false, errors: [`Task non risolvibile nello stato ${task.status}`] };

      const validation = taskApi.validateSuccessContract(task.successContract, resolution);
      if (!validation.valid) {
        this.audit.emit(this.run, "task.resolution_rejected", { taskId, errors: validation.errors }, actor);
        this._notify();
        return { ok: false, errors: validation.errors };
      }

      task.status = "resolved";
      task.assignee ||= actor;
      task.resolution = { ...structuredClone(resolution), resolvedBy: actor, resolvedAt: new Date(this.clock()).toISOString() };
      const step = this.run.stepRuns.find((item) => item.id === task.stepRunId);
      if (step?.status === "waiting_human") {
        const targetStepStatus = STEP_TRANSITIONS.waiting_human.includes(resolution.type) ? resolution.type : "completed_manually";
        this.transitionStep(step, targetStepStatus);
        step.outcome = resolution.type;
      }
      this._applyResolution(task, resolution);
      this.audit.emit(this.run, `outcome.${resolution.type}`, { taskId, businessGoal: task.businessGoal, fields: resolution.fields, evidence: resolution.evidence }, actor);
      this.audit.emit(this.run, "task.resolved", { taskId, resolutionType: resolution.type }, actor);

      this.run.technicalIssues.filter((issue) => issue.sourceStepRunId === task.stepRunId).forEach((issue) => {
        issue.operationalWorkaround = "active";
        issue.runNoLongerBlocked = true;
      });

      const sourceNode = this.flow.nodes.find((node) => node.id === task.sourceNodeId);
      const nextNodeId = sourceNode?.outcomes?.[resolution.type] || sourceNode?.outcomes?.completed_manually || task.resumeNodeId;
      if (!nextNodeId) {
        this.transitionRun("failed");
        this.audit.emit(this.run, "routing.missing", { nodeId: sourceNode?.id, outcome: resolution.type });
      } else {
        this.run.currentNodeId = nextNodeId;
        this.transitionRun("running");
        this.audit.emit(this.run, "run.resumed_after_human", { taskId, nextNodeId, resolutionType: resolution.type }, actor);
      }
      this._notify();
      return { ok: true, task };
    }

    _getOrCreateStep(node) {
      const retryStep = [...this.run.stepRuns].reverse().find((step) => step.nodeId === node.id && step.status === "retry_scheduled");
      if (retryStep) return retryStep;
      this.run.counters.step += 1;
      const step = {
        id: `${this.run.id}:step:${this.run.counters.step}`,
        runId: this.run.id,
        nodeId: node.id,
        nodeName: node.name,
        type: node.type,
        status: "pending",
        input: structuredClone(this.run.context),
        output: null,
        attempts: 0,
        outcome: null,
        timestamps: { pending: new Date(this.clock()).toISOString() },
      };
      this.run.stepRuns.push(step);
      return step;
    }

    _executeDecision(step, node) {
      const configured = this.scenario.nodeOutcomes?.[node.id] ?? "success";
      const visitIndex = this.run.nodeVisits[node.id] - 1;
      const outcome = Array.isArray(configured) ? configured[Math.min(visitIndex, configured.length - 1)] : configured;
      this.audit.emit(this.run, "decision.made", { nodeId: node.id, outcome, businessGoal: node.businessGoal });
      this._completeStep(step, node, outcome);
    }

    _executeTool(step, node) {
      step.attempts += 1;
      const idempotencyKey = this._renderTemplate(node.idempotencyKey || `${this.run.id}:${node.id}`);
      const result = this.tools.execute({
        runId: this.run.id,
        stepRunId: step.id,
        tool: node.tool,
        provider: node.tool?.split(".")[0],
        input: this.run.context,
        idempotencyKey,
        attempt: step.attempts,
        timeoutSeconds: node.timeoutSeconds || 15,
      });
      const attempt = {
        id: `${step.id}:attempt:${step.attempts}`,
        stepRunId: step.id,
        tool: node.tool,
        provider: node.tool?.split(".")[0],
        idempotencyKey,
        attempt: step.attempts,
        status: result.status,
        outcome: result.outcome,
        durationMs: result.durationMs,
        errorCode: result.errorCode,
        reused: Boolean(result.reused),
      };
      this.run.toolAttempts.push(attempt);
      this.audit.emit(this.run, "tool.attempted", attempt);

      if (result.outcome === "success") {
        step.output = structuredClone(result.output || {});
        this._applyOutcomeUpdate(node.businessGoal, node.onSuccess);
        this._completeStep(step, node, "success");
        return;
      }

      const maxAttempts = node.maxAttempts || 1;
      const retryable = ["retryable_error", "timed_out"].includes(result.outcome);
      if (retryable && step.attempts < maxAttempts) {
        const backoffMs = (node.retryBackoffMs || [500, 1000, 2000])[step.attempts - 1] || 2000;
        step.outcome = result.outcome;
        step.retryAt = new Date(this.clock() + backoffMs).toISOString();
        this.transitionStep(step, "retry_scheduled");
        this.audit.emit(this.run, "tool.retry_scheduled", { nodeId: node.id, attempt: step.attempts, maxAttempts, backoffMs, outcome: result.outcome });
        return;
      }

      step.outcome = result.outcome;
      step.output = { errorCode: result.errorCode };
      this._createTechnicalIssue(node, step, result);
      if (node.fallbackTaskKey) {
        this._waitForHuman(step, node, node.fallbackTaskKey, result);
      } else {
        this.transitionStep(step, "failed");
        const next = node.outcomes?.[result.outcome] || node.outcomes?.failed;
        if (next) this.run.currentNodeId = next;
        else this.transitionRun("failed");
      }
    }

    _waitForHuman(step, node, taskKey, failure = null) {
      if (step.status === "running") this.transitionStep(step, "waiting_human");
      const existing = this.run.tasks.find((task) => task.stepRunId === step.id && ["open", "assigned", "in_progress"].includes(task.status));
      if (existing) return existing;
      const definition = this.tasks[taskKey];
      if (!definition) throw new Error(`Task catalog mancante: ${taskKey}`);
      this.run.counters.task += 1;
      const createdAt = new Date(this.clock()).toISOString();
      const task = {
        id: `${this.run.id}:task:${this.run.counters.task}`,
        runId: this.run.id,
        stepRunId: step.id,
        sourceNodeId: node.id,
        taskKey,
        title: definition.title,
        businessGoal: definition.businessGoal || node.businessGoal,
        priority: definition.priority,
        slaAt: new Date(this.clock() + definition.slaMinutes * 60000).toISOString(),
        status: "open",
        assignee: null,
        proposal: definition.proposal,
        fallbacks: structuredClone(definition.fallbacks),
        successContract: structuredClone(definition.successContract),
        technicalContext: failure ? { tool: node.tool, errorCode: failure.errorCode, attempts: step.attempts } : null,
        createdAt,
        resolution: null,
      };
      this.run.tasks.push(task);
      this.transitionRun("waiting_human");
      this.audit.emit(this.run, "task.created", { taskId: task.id, title: task.title, businessGoal: task.businessGoal, sourceNodeId: node.id, technicalContext: task.technicalContext });
      return task;
    }

    _createTechnicalIssue(node, step, result) {
      const existing = this.run.technicalIssues.find((issue) => issue.sourceStepRunId === step.id);
      if (existing) return existing;
      this.run.counters.technical += 1;
      const issue = {
        id: `${this.run.id}:technical:${this.run.counters.technical}`,
        runId: this.run.id,
        sourceStepRunId: step.id,
        provider: node.tool?.split(".")[0],
        tool: node.tool,
        capability: node.capability,
        errorCode: result.errorCode,
        attempts: step.attempts,
        lastLatencyMs: result.durationMs,
        status: "open",
        operationalWorkaround: "pending",
        runNoLongerBlocked: false,
        createdAt: new Date(this.clock()).toISOString(),
      };
      this.run.technicalIssues.push(issue);
      this.audit.emit(this.run, "technical_issue.created", { issueId: issue.id, tool: issue.tool, errorCode: issue.errorCode, attempts: issue.attempts });
      return issue;
    }

    _completeStep(step, node, outcome) {
      step.outcome = outcome;
      this.transitionStep(step, "succeeded");
      const nextNodeId = node.outcomes?.[outcome];
      this.audit.emit(this.run, "routing.outcome", { nodeId: node.id, outcome, nextNodeId: nextNodeId || null });
      if (!nextNodeId) {
        this.transitionRun("failed");
        this.audit.emit(this.run, "routing.missing", { nodeId: node.id, outcome });
      } else {
        this.run.currentNodeId = nextNodeId;
      }
    }

    _completeOutcome(step, node) {
      const state = this.run.outcomeState[node.businessGoal] || { fields: {}, evidence: [], resolutionTypes: [] };
      const accepted = node.successContract?.acceptedResolutions || [];
      const resolutionType = [...(state.resolutionTypes || [])].reverse().find((type) => accepted.includes(type)) || state.resolutionTypes?.at(-1);
      const validation = taskApi.validateSuccessContract(node.successContract, { fields: state.fields, evidence: state.evidence, type: resolutionType });
      step.output = { successContract: validation, outcomeState: structuredClone(state) };
      step.outcome = validation.valid ? "success" : "failed";
      this.transitionStep(step, validation.valid ? "succeeded" : "failed");
      this.audit.emit(this.run, "success_contract.evaluated", { nodeId: node.id, businessGoal: node.businessGoal, valid: validation.valid, errors: validation.errors });
      this.transitionRun(validation.valid ? "completed" : "partially_completed");
    }

    _completeTerminal(step, node) {
      step.outcome = node.terminalStatus || "failed";
      this.transitionStep(step, node.terminalStatus === "completed" ? "succeeded" : "failed");
      this.transitionRun(node.terminalStatus || "failed");
    }

    _applyOutcomeUpdate(businessGoal, update = {}) {
      if (!businessGoal || !update) return;
      const state = (this.run.outcomeState[businessGoal] ||= { fields: {}, evidence: [], resolutionTypes: [] });
      Object.assign(state.fields, structuredClone(update.fields || {}));
      state.evidence = [...new Set([...state.evidence, ...(update.evidence || [])])];
      if (update.resolutionType) state.resolutionTypes.push(update.resolutionType);
    }

    _applyResolution(task, resolution) {
      const goal = task.businessGoal;
      const state = (this.run.outcomeState[goal] ||= { fields: {}, evidence: [], resolutionTypes: [] });
      Object.assign(state.fields, structuredClone(resolution.fields || {}));
      state.evidence = [...new Set([...state.evidence, ...(resolution.evidence || [])])];
      if (goal === "guest_issue_is_safely_resolved" && state.evidence.includes("impact_removed")) state.evidence = [...new Set([...state.evidence, "guest_safe"])];
      state.resolutionTypes.push(resolution.type);
      if (goal === "guest_issue_is_safely_resolved" && !state.fields.resolution_method) state.fields.resolution_method = resolution.fields?.resolution_method || task.title;
      if (goal === "refund_request_is_resolved" && !state.fields.decision && !["approved", "rejected"].includes(resolution.type)) state.fields.decision = "approvato";
    }

    _renderTemplate(value) {
      if (!value) return value;
      return String(value).replaceAll("{{booking.id}}", this.run.context.booking?.id || "booking-demo");
    }

    _notify() {
      if (!this.run) return;
      this.run.updatedAt = new Date(this.clock()).toISOString();
      this.onChange(this.snapshot());
    }
  }

  return { FlowRuntime, RUN_TRANSITIONS, STEP_TRANSITIONS, assertTransition };
});
