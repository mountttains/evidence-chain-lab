const test = require("node:test"),
  assert = require("node:assert/strict");
const E = require("../engine.js"),
  d = require("../data/case.json");
const thesis = "苹果 2024 财年盈利改善来自主营业务";
test("annual operating profit growth and net income fall are both preserved", () => {
  const r = E.analyze(d, thesis);
  assert.equal(E.fmt(r.op), "+7.80%");
  assert.equal(E.fmt(r.net), "-3.36%");
  assert.equal(r.verdict, "部分支持");
  assert.equal(r.evidence.filter((e) => e.kind === "unknown").length, 2);
  assert(Math.abs(r.share - 92.806) < 0.01);
});
test("net income selection reverses verdict", () => {
  const r = E.analyze(d, thesis, "annual", "net");
  assert.equal(r.verdict, "反对当前口径");
  assert.equal(r.evidence[0].kind, "against");
});
test("quarter cannot accidentally use annual numbers", () => {
  const r = E.analyze(d, thesis, "quarter");
  assert.equal(E.fmt(r.op), "+9.72%");
  assert.equal(E.fmt(r.net), "-35.81%");
  assert(r.label.includes("Q4"));
});
test("gross margin uses numerator and denominator from same period", () => {
  const r = E.analyze(d, thesis, "annual", "gross");
  assert.equal(r.grossChange.toFixed(2), "2.08");
});
test("data corruption and accounting mismatch fail closed", () => {
  const bad = structuredClone(d);
  bad.annual.current.revenue += 100;
  assert.throws(() => E.validateData(bad));
  const missing = structuredClone(d);
  delete missing.quarter.current.net;
  assert.throws(() => E.validateData(missing));
});
test("unsupported company, period and investment advice are rejected", () => {
  for (const t of [
    "茅台利润改善来自主营业务",
    "苹果 2025 年盈利改善",
    "苹果应该买入并保证收益利润改善",
    "苹果与微软利润改善比较",
  ])
    assert.throws(() => E.checkThesis(t));
});
test("unknown followups do not invent evidence; advice has no trade recommendation", () => {
  const r = E.analyze(d, thesis);
  assert.match(E.answer("渠道库存多少", r).text, /无法/);
  assert.match(E.answer("现在可以买入吗", r).text, /不提供/);
});
test("AI fabricated citations and malformed output are rejected", () => {
  assert.throws(() =>
    E.validateAI({ summary: "bad", questions: ["Q"], citations: ["E999"] }, [
      "E1",
    ]),
  );
  assert.throws(() =>
    E.validateAI({ summary: "bad", questions: [], citations: ["E1"] }, ["E1"]),
  );
  assert.equal(
    E.validateAI({ summary: "ok", questions: ["Q"], citations: ["E1"] }, ["E1"])
      .summary,
    "ok",
  );
});
