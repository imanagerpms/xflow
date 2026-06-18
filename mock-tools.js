(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BNBFLOW_TOOLS = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  class MockToolRegistry {
    constructor(options = {}) {
      this.handlers = new Map();
      this.failurePlans = new Map();
      this.idempotencyCache = new Map();
      this.invocations = [];
      this.sideEffects = new Map();
      if (options.defaults !== false) this.registerDefaults();
    }

    register(name, handler) {
      this.handlers.set(name, handler);
      return this;
    }

    registerDefaults() {
      const toolNames = [
        "access.createSmartLockLink", "guest.sendAccessInstructions", "pms.recordAccessDelivery",
        "guest.sendMissingDataRequest", "ops.createMaintenanceTicket", "vendor.dispatch",
        "guest.sendMaintenanceUpdate", "guest.sendSelfHelp", "pms.recordIssueResolution",
        "payment.executeRefund", "guest.sendRefundDecision", "pms.recordRefundResolution",
      ];
      toolNames.forEach((name) => this.register(name, ({ input }) => ({ reference: `${name}:ok`, received: input })));
    }

    configure(plans = {}) {
      this.failurePlans = new Map(Object.entries(plans));
      return this;
    }

    execute(request) {
      const { tool, idempotencyKey, attempt = 1 } = request;
      if (!this.handlers.has(tool)) this.register(tool, ({ input }) => ({ reference: `${tool}:ok`, received: input }));
      if (idempotencyKey && this.idempotencyCache.has(idempotencyKey)) {
        const cached = structuredClone(this.idempotencyCache.get(idempotencyKey));
        const result = { ...cached, reused: true, sideEffect: false, attempt };
        this.invocations.push({ ...request, result: structuredClone(result) });
        return result;
      }

      const plan = this.failurePlans.get(tool) || { behavior: "success" };
      const behavior = attempt <= (plan.failAttempts ?? Infinity) ? plan.behavior : "success";
      const durationMs = plan.latencyMs ?? (behavior === "timeout" ? 15000 : 120);
      let result;
      if (behavior === "timeout") {
        result = { status: "timed_out", outcome: "timed_out", durationMs, errorCode: plan.errorCode || "PROVIDER_TIMEOUT" };
      } else if (behavior === "temporary_error") {
        result = { status: "failed", outcome: "retryable_error", durationMs, errorCode: plan.errorCode || "TEMPORARY_UNAVAILABLE" };
      } else if (behavior === "permanent_error") {
        result = { status: "failed", outcome: "failed", durationMs, errorCode: plan.errorCode || "PROVIDER_REJECTED" };
      } else if (behavior === "partial_success") {
        result = { status: "failed", outcome: "partial_success", durationMs, errorCode: "PARTIAL_RESPONSE" };
      } else if (behavior === "invalid_response") {
        result = { status: "failed", outcome: "failed", durationMs, errorCode: "INVALID_RESPONSE" };
      } else {
        const output = this.handlers.get(tool)({ input: structuredClone(request.input || {}), request: structuredClone(request) });
        result = { status: "succeeded", outcome: "success", durationMs, output, errorCode: null, sideEffect: true };
        if (idempotencyKey) this.idempotencyCache.set(idempotencyKey, structuredClone(result));
        this.sideEffects.set(tool, (this.sideEffects.get(tool) || 0) + 1);
      }
      result = { ...result, reused: false, attempt };
      this.invocations.push({ ...request, result: structuredClone(result) });
      return result;
    }

    getSideEffectCount(tool) {
      return this.sideEffects.get(tool) || 0;
    }
  }

  return { MockToolRegistry };
});
