const test = require("node:test"),
  assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs");
const E = require("../engine.js"),
  W = require("../workspace.js"),
  d = require("../data/case.json");
const thesis = "苹果 2024 财年盈利改善主要来自主营业务";
const r = E.analyze(d, thesis);
const packet = () => ({
  schema: "trace-research-export-v2",
  data: structuredClone(d),
  analysis: structuredClone(r),
  tasks: [],
  versions: [],
  notes: {},
});
test("net income bridge reconciles each period exactly", () => {
  for (const period of ["annual", "quarter"]) {
    const b = E.analyze(d, thesis, period).bridge;
    assert.equal(
      b.parts.reduce((s, p) => s + p.value, 0),
      b.current - b.prior,
    );
  }
  assert.deepEqual(
    r.bridge.parts.map((x) => x.value),
    [8915, 834, -13008],
  );
  assert.equal(r.bridge.delta, -3259);
});
test("browser and JSON financial snapshots stay identical", () => {
  const scope = { window: {} };
  vm.runInNewContext(fs.readFileSync("data/case.js", "utf8"), scope);
  assert.equal(JSON.stringify(scope.window.CASE_DATA), JSON.stringify(d));
});
test("text metric and period mismatch rejected; income alone is not profit", () => {
  assert.throws(
    () => E.analyze(d, "苹果 2024 财年净利润改善", "annual", "operating"),
    /净利润/,
  );
  assert.throws(
    () => E.analyze(d, "苹果 2024 第四季度盈利改善", "annual"),
    /第四季度/,
  );
  assert.throws(() => E.analyze(d, "苹果 2024 财年收入增长"), /收入/);
  assert.throws(() => E.analyze(d, "苹果估值回落但利润改善"), /估值/);
  assert.throws(() => E.analyze(d, "苹果利润增长超过50%"), /数值目标/);
  assert.doesNotThrow(() => E.analyze(d, "苹果 2024年相比2023年盈利改善"));
});
test("damaged saved state recovers without crashing", () => {
  const s = W.sanitize(
    {
      tasks: [null, {}, { text: "核验后续财报", created: "bad" }],
      versions: [null, { result: {} }],
      notes: { __proto__: "evil", "annual:operating:E1": "检查口径" },
    },
    d,
  );
  assert.equal(s.tasks.length, 1);
  assert.equal(s.versions.length, 0);
  assert.equal(s.notes["annual:operating:E1"], "检查口径");
});
test("import rederives conclusions and never trusts imported HTML or model result", () => {
  const p = packet();
  p.analysis.conclusion = "<script>fake</script>";
  p.analysis.verdict = "必涨";
  const imported = W.parseImport(JSON.stringify(p), d);
  assert.equal(E.analyze(d, imported.current.thesis).verdict, "部分支持");
  assert(!JSON.stringify(imported).includes("必涨"));
});
test("tampered source values, wrong schema, malformed records and oversized inputs rejected", () => {
  const p = packet();
  p.data.annual.current.net += 1;
  assert.throws(() => W.parseImport(JSON.stringify(p), d), /不一致/);
  assert.throws(() => W.parseImport('{"schema":"arbitrary"}', d), /识别/);
  const q = packet();
  q.tasks = [null];
  assert.throws(() => W.parseImport(JSON.stringify(q), d), /无效/);
  assert.throws(
    () => W.parseImport(" ".repeat(2 * 1024 * 1024 + 1), d),
    /2 MB/,
  );
});
test("import deduplicates without overwriting local changes or silently dropping over-limit tasks", () => {
  const task = {
    id: "same",
    text: "本地",
    done: true,
    created: new Date().toISOString(),
  };
  const local = W.sanitize({ tasks: [task] }, d),
    incoming = W.sanitize(
      { tasks: [{ ...task, text: "旧导出", done: false }], current: r },
      d,
    );
  const merged = W.merge(local, incoming, d);
  assert.equal(merged.tasks.length, 1);
  assert.equal(merged.tasks[0].text, "本地");
  const many = W.sanitize(
    {
      tasks: Array.from({ length: 200 }, (_, i) => ({
        ...task,
        id: "task-" + i,
      })),
    },
    d,
  );
  assert.throws(() => W.merge(many, incoming, d), /上限/);
});
test("report contains math, citations, contextual notes and explicit model boundary", () => {
  const report = W.markdown(r, d, {
    notes: { "annual:operating:E2": "需独立信源" },
    tasks: [],
  });
  assert.match(report, /92.8/);
  assert.match(report, /pdf#page=1/);
  assert.match(report, /需独立信源/);
  assert.match(report, /本轮未采纳模型/);
  assert.match(report, /-3,259/);
});
