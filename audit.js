(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BNBFLOW_AUDIT = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  class AuditTrail {
    constructor(options = {}) {
      this.clock = options.clock || (() => Date.now());
    }

    emit(run, eventType, data = {}, actor = "runtime") {
      run.audit ||= [];
      run.counters ||= {};
      run.counters.audit = (run.counters.audit || 0) + 1;
      const event = {
        id: `${run.id}:audit:${run.counters.audit}`,
        runId: run.id,
        sequence: run.counters.audit,
        actor,
        eventType,
        data: structuredClone(data),
        createdAt: new Date(this.clock()).toISOString(),
      };
      run.audit.push(event);
      return event;
    }
  }

  return { AuditTrail };
});
