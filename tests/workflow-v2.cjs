const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
(async () => {
  const b = await chromium.launch({ channel: "chrome", headless: true });
  const c = await b.newContext({
      viewport: { width: 1440, height: 1050 },
      acceptDownloads: true,
    }),
    p = await c.newPage(),
    errors = [],
    results = [];
  p.on("pageerror", (e) => errors.push(e.message));
  const check = async (name, fn) => {
    await fn();
    results.push({ name, status: "passed" });
    console.log("PASS " + name);
  };
  const base = process.env.TEST_URL || "http://127.0.0.1:4173/";
  let exported;
  try {
    await p.goto(base);
    await check("draft recovery and stale-result warning", async () => {
      await p.fill("#thesis", "苹果 2024 财年净利润增长，主营业务是否改善？");
      await p.selectOption("#metric", "net");
      assert(await p.locator("#dirty-warning").isVisible());
      await p.reload();
      assert.match(await p.locator("#thesis").inputValue(), /净利润/);
      assert.equal(await p.locator("#metric").inputValue(), "net");
      assert(await p.locator("#dirty-warning").isVisible());
      await p.click("#analyze");
      assert.equal(await p.locator("#verdict").innerText(), "反对当前口径");
      assert(await p.locator("#dirty-warning").isHidden());
      await p.reload();
      assert.equal(await p.locator("#verdict").innerText(), "反对当前口径");
    });
    await check(
      "guided presets, period-specific bridge and source search",
      async () => {
        await p.click('[data-preset="quarter"]');
        assert.match(await p.locator("#bridge-period").innerText(), /Q4/);
        await p.click('[data-preset="operating"]');
        assert.match(await p.locator("#profit-bridge").innerText(), /-32.59/);
        await p.fill("#evidence-search", "不存在证据词");
        assert.match(await p.locator("#evidence").innerText(), /没有匹配/);
        await p.fill("#evidence-search", "服务");
        assert.equal(await p.locator(".ev").count(), 1);
        await p.fill("#evidence-search", "");
      },
    );
    await check(
      "evidence notes persist and escape untrusted markup",
      async () => {
        await p.locator('.ev[data-evidence="E2"]').click();
        await p.fill(
          "#evidence-note",
          "<img src=x onerror=alert(1)> 需要补充独立信源",
        );
        await p.click("#save-note");
        await p.click("#close-modal");
        await p.reload();
        await p.locator('.ev[data-evidence="E2"]').click();
        assert.match(
          await p.locator("#evidence-note").inputValue(),
          /独立信源/,
        );
        assert.equal(await p.locator("#modal img").count(), 0);
        await p.click("#close-modal");
      },
    );
    await check(
      "saved version restores context and notes without deleting history",
      async () => {
        await p.click("#save");
        await p.click('[data-preset="net"]');
        await p.click("#save");
        await p.click('[data-view="history"]');
        await p.locator('[data-restore="1"]').click();
        assert.equal(await p.locator("#metric").inputValue(), "operating");
        assert.equal(await p.locator("#verdict").innerText(), "部分支持");
        await p.locator('.ev[data-evidence="E2"]').click();
        assert.match(
          await p.locator("#evidence-note").inputValue(),
          /独立信源/,
        );
        await p.click("#close-modal");
      },
    );
    await check("tasks deduplicate and deletion can be undone", async () => {
      await p.fill("#followup", "需要获取下一期原始财报");
      await p.click("#make-task");
      await p.click("#make-task");
      await p.click('[data-view="tasks"]');
      assert.equal(await p.locator(".task").count(), 1);
      await p.locator("[data-delete]").click();
      assert.equal(await p.locator(".task").count(), 0);
      await p.click("#undo-task");
      assert.equal(await p.locator(".task").count(), 1);
    });
    await check(
      "readable report and portable JSON are real downloadable files",
      async () => {
        await p.click('[data-view="workbench"]');
        let wait = p.waitForEvent("download");
        await p.click("#report");
        let file = await (await wait).path();
        let report = fs.readFileSync(file, "utf8");
        assert.match(report, /研究报告/);
        assert(!report.includes("<img"));
        assert.match(report, /独立信源/);
        assert.match(report, /pdf#page=1/);
        wait = p.waitForEvent("download");
        await p.click("#export");
        file = await (await wait).path();
        exported = fs.readFileSync(file, "utf8");
        assert.equal(JSON.parse(exported).schema, "trace-research-export-v2");
      },
    );
    await check(
      "import rejects tampered data before touching workspace",
      async () => {
        const invalid = JSON.parse(exported);
        invalid.data.annual.current.net = 1;
        await p.setInputFiles("#import-file", {
          name: "bad.json",
          mimeType: "application/json",
          buffer: Buffer.from(JSON.stringify(invalid)),
        });
        await p.waitForFunction(() =>
          document.querySelector("#toast").textContent.includes("不一致"),
        );
        assert.equal(await p.locator("#modal").isVisible(), false);
      },
    );
    await check(
      "import preview, merge and revalidation preserve records",
      async () => {
        await p.click('[data-preset="net"]');
        await p.setInputFiles("#import-file", {
          name: "study.json",
          mimeType: "application/json",
          buffer: Buffer.from(exported),
        });
        await p.waitForSelector("#confirm-import");
        assert.match(await p.locator("#modal-body").innerText(), /重新计算/);
        await p.click("#confirm-import");
        assert.equal(await p.locator("#metric").inputValue(), "operating");
        await p.click('[data-view="tasks"]');
        assert.equal(await p.locator(".task").count(), 1);
        await p.click('[data-view="history"]');
        assert.equal(await p.locator("[data-restore]").count(), 2);
        await p.click('[data-view="workbench"]');
      },
    );
    await check(
      "inline scope error preserves clearly marked old analysis",
      async () => {
        await p.fill("#thesis", "苹果 2024 财年收入增长");
        await p.click("#analyze");
        assert(await p.locator("#thesis-error").isVisible());
        assert.match(await p.locator("#thesis-error").innerText(), /收入/);
        assert(await p.locator("#dirty-warning").isVisible());
        await p.click('[data-preset="operating"]');
      },
    );
    await check(
      "pending model request cancels when the thesis changes",
      async () => {
        let captured = false;
        await p.route("https://model.example.test/slow", async (route) => {
          captured = true;
          await new Promise((r) => setTimeout(r, 1200));
          try {
            await route.fulfill({
              contentType: "application/json",
              body: JSON.stringify({
                choices: [
                  {
                    message: {
                      content: JSON.stringify({
                        summary: "过期模型输出",
                        questions: ["q"],
                        citations: ["E1"],
                      }),
                    },
                  },
                ],
              }),
            });
          } catch {}
        });
        await p.click("#settings");
        await p.fill("#endpoint", "https://model.example.test/slow");
        await p.fill("#model", "test-fixture");
        await p.click("#connect");
        await p.click("#ai-analyze");
        await p.fill(
          "#thesis",
          "苹果 2024 财年盈利改善主要来自主营业务，需要进一步验证。",
        );
        await p.waitForTimeout(1400);
        assert(captured);
        assert.match(await p.locator("#mode").innerText(), /请重新验证/);
        assert(await p.locator("#modal").isHidden());
        await p.click("#analyze");
      },
    );
    await check(
      "prior AI output is cleared after a failed replacement request",
      async () => {
        await p.unroute("https://model.example.test/slow");
        let count = 0;
        await p.route("https://model.example.test/slow", (r) => {
          count++;
          return count === 1
            ? r.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                  choices: [
                    {
                      message: {
                        content: JSON.stringify({
                          summary: "核验示例",
                          questions: ["q"],
                          citations: ["E1"],
                        }),
                      },
                    },
                  ],
                }),
              })
            : r.fulfill({ status: 401, body: "Unauthorized" });
        });
        await p.click("#ai-analyze");
        await p.waitForFunction(() =>
          document
            .querySelector("#modal-title")
            .textContent.includes("模型辅助分析"),
        );
        await p.click("#close-modal");
        await p.click("#ai-analyze");
        await p.waitForFunction(() =>
          document.querySelector("#mode").textContent.includes("模型失败"),
        );
        const wait = p.waitForEvent("download");
        await p.click("#export");
        assert.equal(
          JSON.parse(fs.readFileSync(await (await wait).path(), "utf8")).ai,
          null,
        );
      },
    );
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.screenshot({ path: "verification/desktop-v2.png" });
    await check("mobile workflow has no horizontal overflow", async () => {
      await p.setViewportSize({ width: 390, height: 844 });
      await p.reload();
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await p.screenshot({
        path: "verification/mobile-v2.png",
        fullPage: true,
      });
    });
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      "verification/workflow-v2-results.json",
      JSON.stringify(
        {
          runAt: new Date().toISOString(),
          url: base,
          results,
          uncaughtErrors: errors,
          modelTests: "mocked, no live inference credentials",
        },
        null,
        2,
      ),
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
