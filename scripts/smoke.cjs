const { chromium } = require("playwright"),
  fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const url = process.env.TEST_URL || "http://127.0.0.1:4173";
  const response = await page.goto(url);
  await page.evaluate(() => window.scrollTo(0, 0));
  if (response.status() !== 200) throw Error("HTTP " + response.status());
  if (!(await page.locator("#metrics").innerText()).includes("+7.80%"))
    throw Error("Metrics missing");
  if (!(await page.locator("#import").isVisible()) || !(await page.locator("#profit-bridge").innerText()).includes("-32.59")) throw Error("v1.1 workflow not deployed");
  await page.screenshot({ path: "verification/desktop.png" });
  const dataResponse = await page.request.get(
    new URL("data/case.json", url).href,
  );
  if (dataResponse.status() !== 200) throw Error("Data inaccessible");
  const source = await dataResponse.json();
  if (source.annual.current.net !== 93736) throw Error("Source values wrong");
  await page.selectOption("#metric", "net");
  await page.click("#analyze");
  if ((await page.locator("#verdict").innerText()) !== "反对当前口径")
    throw Error("Interaction failed");
  fs.writeFileSync(
    "verification/" +
      (new URL(url).hostname === "127.0.0.1" ? "local-smoke" : "deployment-check") +
      ".json",
    JSON.stringify(
      {
        version: "1.1.0",
      checkedAt: new Date().toISOString(),
        url,
        status: response.status(),
        dataStatus: dataResponse.status(),
        metricChange: "passed",
        sourceValues: "passed",
      },
      null,
      2,
    ),
  );
  await browser.close();
  console.log("PASS " + url);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
