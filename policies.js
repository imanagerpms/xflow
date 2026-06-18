(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BNBFLOW_POLICIES = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const defaultPolicy = {
    agentConfidenceReviewBelow: 0.85,
    automaticCompensationMaxEur: 30,
    hostApprovalMaxEur: 100,
    maxToolAttempts: 3,
    retryBackoffMs: [500, 1000, 2000],
  };

  function routeRefund(amount, policy = defaultPolicy) {
    if (amount <= policy.automaticCompensationMaxEur) return "automatic";
    if (amount <= policy.hostApprovalMaxEur) return "host_approval";
    return "manager_approval";
  }

  function requiresHumanReview({ confidence = 1, identityStatus = "verified", safety = "normal" }, policy = defaultPolicy) {
    if (safety === "critical") return { required: true, reason: "critical_safety_takeover" };
    if (identityStatus !== "verified") return { required: true, reason: "identity_mismatch" };
    if (confidence < policy.agentConfidenceReviewBelow) return { required: true, reason: "low_confidence" };
    return { required: false, reason: null };
  }

  return { defaultPolicy, routeRefund, requiresHumanReview };
});
