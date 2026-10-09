(function (root) {
  "use strict";
  const E =
    typeof module !== "undefined"
      ? require("./engine.js")
      : root.ResearchEngine;
  const clean = (s, n = 800) => (typeof s === "string" ? s.slice(0, n) : "");
  const iso = (s) =>
    typeof s === "string" && Number.isFinite(Date.parse(s))
      ? new Date(s).toISOString()
      : "";
  function input(v) {
    return v &&
      typeof v.thesis === "string" &&
      ["annual", "quarter"].includes(v.period) &&
      Object.hasOwn(E.names, v.metric)
      ? { thesis: clean(v.thesis), period: v.period, metric: v.metric }
      : null;
  }
  function analysis(v, data) {
    const q = input(v);
    if (!q) return null;
    try {
      return E.analyze(data, q.thesis, q.period, q.metric);
    } catch {
      return null;
    }
  }
  function notes(v) {
    const out = {};
    if (!v || typeof v !== "object") return out;
    for (const [k, s] of Object.entries(v).slice(0, 36))
      if (
        /^(annual|quarter):(operating|net|gross):E[1-6]$/.test(k) &&
        typeof s === "string"
      )
        out[k] = clean(s, 2000);
    return out;
  }
  function sanitize(v, data) {
    const safe = v && typeof v === "object" ? v : {},
      out = {
        tasks: [],
        versions: [],
        draft: input(safe.draft),
        current: input(analysis(safe.current, data)),
        notes: notes(safe.notes),
      };
    const seen = new Set();
    for (const [i, t] of (Array.isArray(safe.tasks) ? safe.tasks : [])
      .slice(0, 200)
      .entries()) {
      if (!t || typeof t.text !== "string" || !t.text.trim()) continue;
      const id =
        typeof t.id === "string" && /^[\w-]{1,80}$/.test(t.id)
          ? t.id
          : "recovered-task-" + i;
      if (seen.has(id)) continue;
      seen.add(id);
      out.tasks.push({
        id,
        text: clean(t.text, 500),
        done: t.done === true,
        created: iso(t.created) || new Date(0).toISOString(),
        context: clean(t.context),
        period: clean(t.period, 80),
      });
    }
    seen.clear();
    for (const [i, v] of (Array.isArray(safe.versions) ? safe.versions : [])
      .slice(0, 50)
      .entries()) {
      if (!v) continue;
      const r = analysis(v.result, data);
      if (!r || v.dataVersion !== data.version) continue;
      const id =
        typeof v.id === "string" && /^[\w-]{1,80}$/.test(v.id)
          ? v.id
          : "recovered-version-" + i;
      if (seen.has(id)) continue;
      seen.add(id);
      let ai = null;
      try {
        if (v.ai)
          ai = {
            model: clean(v.ai.model, 120),
            time: iso(v.ai.time),
            output: E.validateAI(
              v.ai.output,
              r.evidence.map((e) => e.id),
            ),
            verification: "引用存在性校验通过；模型语义仍须复核。",
          };
      } catch {}
      out.versions.push({
        id,
        date: iso(v.date) || new Date(0).toISOString(),
        result: r,
        dataVersion: data.version,
        ai,
        notes: notes(v.notes),
      });
    }
    return out;
  }
  function parseImport(text, data) {
    if (text.length > 2 * 1024 * 1024)
      throw Error("文件超过 2 MB，请选择本产品导出的 JSON 研究包。");
    let v;
    try {
      v = JSON.parse(text);
    } catch {
      throw Error("无法读取 JSON，请选择研究包而非视频或压缩包。");
    }
    if (
      !["trace-research-export-v1", "trace-research-export-v2"].includes(
        v?.schema,
      )
    )
      throw Error("不是可识别的溯证研究包。");
    if (v.data?.version !== data.version)
      throw Error("数据版本不匹配，不能混合不同财报快照。");
    for (const p of ["annual", "quarter"])
      for (const y of ["current", "prior"])
        for (const [k, n] of Object.entries(data[p][y]))
          if (v.data?.[p]?.[y]?.[k] !== n)
            throw Error("财务数据与已核验快照不一致，已拒绝导入。");
    if (v.data.taxAdjustment !== data.taxAdjustment)
      throw Error("一次性税项与已核验快照不一致。");
    const r = analysis(v.analysis, data);
    if (!r) throw Error("研究命题或比较口径无效。");
    if (
      !Array.isArray(v.tasks) ||
      !Array.isArray(v.versions) ||
      v.tasks.length > 200 ||
      v.versions.length > 50
    )
      throw Error("任务或版本记录超出支持范围。");
    const imported = sanitize({ ...v, current: r, draft: input(r) }, data);
    if (
      imported.tasks.length !== v.tasks.length ||
      imported.versions.length !== v.versions.length
    )
      throw Error("包含无效任务或版本记录；请检查文件，原工作区未改变。");
    // Imported prose and model output must never override source-backed conclusions.
    imported.versions.forEach((x) => (x.ai = null));
    return imported;
  }
  function merge(local, incoming, data) {
    const unique = (xs, max) => {
      const list = Array.from(new Map(xs.map((x) => [x.id, x])).values());
      if (list.length > max)
        throw Error("合并后记录数量超过上限；未覆盖原有记录，请先导出归档。");
      return list;
    };
    return sanitize(
      {
        tasks: unique([...incoming.tasks, ...local.tasks], 200),
        versions: unique([...incoming.versions, ...local.versions], 50),
        current: incoming.current,
        draft: incoming.draft,
        notes: { ...incoming.notes, ...local.notes },
      },
      data,
    );
  }
  function markdown(r, data, state, ai = null) {
    const md = (s) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/[\\\x60*_{}\[\]!|#]/g, "\\$&");
    const lines = [
      "# 溯证 · 投资研究报告",
      "",
      "> 历史研究，不构成投资建议。默认规则验证；模型辅助仅在实际连接并返回时记录。",
      "",
      "## 研究命题",
      "",
      md(r.thesis),
      "",
      "- 比较期间：" + r.label,
      "- 判断口径：" + E.names[r.metric],
      "- 数据版本：" + data.version,
      "- 原始材料发布：2024-10-31；核验：" + data.retrieved,
      "",
      "## 当前结论",
      "",
      r.verdict + "。" + r.conclusion,
      "",
      "## 净利润变动拆解",
      "",
      ...r.bridge.parts.map(
        (x) =>
          "- " +
          x.label +
          "：" +
          (x.value >= 0 ? "+" : "") +
          x.value.toLocaleString() +
          " 百万美元",
      ),
      "- 合计变动：" + r.bridge.delta.toLocaleString() + " 百万美元",
      "",
      "拆解为损益表恒等式，不是完整经济因果识别。所得税总变动不等于一次性税项。",
      "",
      "## 证据与边界",
      "",
    ];
    for (const e of r.evidence) {
      const s = data.sources.find((x) => x.id === e.source);
      lines.push(
        "### " + e.id + " · " + e.title,
        "",
        { support: "支持", against: "反对 / 边界", unknown: "无法验证" }[
          e.kind
        ],
        "",
        e.detail,
        "",
        "> " + e.quote.replace(/\n/g, "\n> "),
        "",
        e.reason,
        "",
      );
      if (s)
        lines.push(
          "来源：[" +
            s.title +
            "](" +
            s.url +
            "#page=" +
            e.page +
            ")，第 " +
            e.page +
            " 页。",
          "",
        );
      const note = state.notes?.[r.period + ":" + r.metric + ":" + e.id];
      if (note)
        lines.push(
          "研究者备注（非原始披露）：",
          "> " + md(note).replace(/\n/g, "\n> "),
          "",
        );
    }
    lines.push(
      "## 后续研究任务",
      "",
      ...state.tasks.map(
        (t) => "- [" + (t.done ? "x" : " ") + "] " + md(t.text),
      ),
      "",
      "## AI 使用记录",
      "",
    );
    lines.push(
      ai
        ? "模型：" +
            ai.model +
            "；返回时间：" +
            ai.time +
            "。结构与引用已校验，语义仍待人工复核。"
        : "本轮未采纳模型输出；使用确定性规则计算。",
    );
    if (ai)
      lines.push(
        "",
        md(ai.output.summary),
        "",
        "引用：" + ai.output.citations.join("、"),
      );
    lines.push(
      "",
      "## 未验证事项",
      "",
      "未来持续性与独立信源交叉验证仍缺材料。多个发行人材料不是多个独立信源。不含实时行情，不提供买卖建议。",
      "",
    );
    return lines.join("\n");
  }
  const api = { sanitize, parseImport, merge, markdown, input };
  if (typeof module !== "undefined") module.exports = api;
  else root.Workspace = api;
})(typeof window !== "undefined" ? window : globalThis);
