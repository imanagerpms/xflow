const assert = require("node:assert/strict");
const test = require("node:test");

const caseData = require("../case-data.js");
const scenarios = require("../scenarios.js");
global.window = {};
require("../catalog.js");
const catalog = global.window.BNBFLOW_CATALOG;

test("case data exposes a hospitality portfolio and operational cases", () => {
  assert.ok(Array.isArray(caseData.properties));
  assert.ok(Array.isArray(caseData.cases));
  assert.ok(Array.isArray(caseData.tasks));
  assert.equal(caseData.properties.filter((property) => property.type === "Hotel").length, 5);
  assert.equal(caseData.properties.filter((property) => property.type === "Casa vacanza").length, 30);
  assert.equal(caseData.properties.filter((property) => property.type === "Affittacamere").length, 10);
  assert.equal(caseData.properties.filter((property) => property.type === "Affittacamere").reduce((sum, property) => sum + property.rooms, 0), 100);
});

test("each operational case has required manager cockpit fields", () => {
  for (const caseItem of caseData.cases) {
    assert.ok(caseItem.id);
    assert.ok(caseItem.title);
    assert.ok(caseItem.businessGoal);
    assert.ok(caseItem.supervisorDecision);
    assert.ok(caseItem.fallback.length >= 1);
    assert.ok(caseItem.conversation.length >= 1 || caseItem.attention.length >= 1);
  }
});

test("runtime-backed cases point to existing scenarios and flows", () => {
  const scenarioIds = new Set(scenarios.scenarios.map((scenario) => scenario.id));
  const flowIds = new Set([...Object.keys(scenarios.flows), ...catalog.flows.map((flow) => flow.id)]);
  for (const caseItem of caseData.cases) {
    if (caseItem.scenarioId) assert.ok(scenarioIds.has(caseItem.scenarioId), `${caseItem.id} scenario missing`);
    if (caseItem.flowId) assert.ok(flowIds.has(caseItem.flowId), `${caseItem.id} flow missing`);
  }
});

test("operations tasks describe business outcomes, not tool repair", () => {
  const technicalTokens = ["access.createSmartLockLink", "vendor.dispatch", "payment.executeRefund", "pms.", "guest."];
  for (const task of caseData.tasks) {
    assert.ok(task.title);
    assert.ok(task.recommendation);
    assert.ok(task.room);
    assert.ok(task.guest);
    assert.ok(task.arrivalTime);
    assert.match(task.checkinDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(task.checkoutDate, /^\d{4}-\d{2}-\d{2}$/);
    for (const token of technicalTokens) {
      assert.equal(task.title.includes(token), false, `${task.id} exposes technical tool name`);
    }
  }
});

test("each property has at least two tasks with different types", () => {
  for (const property of caseData.properties) {
    const tasks = caseData.tasks.filter((task) => task.propertyId === property.id);
    const types = new Set(tasks.map((task) => task.type));
    assert.ok(tasks.length >= 2, `${property.id} has fewer than two tasks`);
    assert.ok(types.size >= 2, `${property.id} does not have varied task types`);
  }
});
