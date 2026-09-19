// Smoke test for italian-vocal-site using local MS Edge (channel: msedge).
const { chromium } = require("playwright");
const path = require("path");
const { pathToFileURL } = require("url");

const SITE = path.resolve(__dirname, "..", "index.html");
const URL = pathToFileURL(SITE).href;

(async () => {
  const errors = [];
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

  const report = { steps: [], errors };

  async function step(name, fn) {
    try { const r = await fn(); report.steps.push({ name, ok: true, detail: r || "" }); console.log("OK  " + name + (r ? " :: " + r : "")); }
    catch (e) { report.steps.push({ name, ok: false, detail: e.message }); console.log("FAIL " + name + " :: " + e.message); }
  }

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  await step("meta loaded: 2 grupos / 46 secs", async () => {
    const n = await page.evaluate(() => ({ g: window.__SVOCAL.META.grupos.length, f: window.__SVOCAL.FLAT.length }));
    if (n.g !== 2 || n.f !== 46) throw new Error("got " + JSON.stringify(n));
    return JSON.stringify(n);
  });

  await step("TOC renders 2 grupos", async () => {
    const n = await page.locator(".grupo").count();
    if (n !== 2) throw new Error("grupos=" + n);
    return "grupos=" + n;
  });

  // 展开整棵目录树（站点默认只展开当前篇/大类，测试直接强制展开以保证可见性）
  await page.evaluate(() => {
    document.querySelectorAll(".grupo").forEach((g) => g.classList.add("open"));
    document.querySelectorAll(".parte-item").forEach((p) => p.classList.add("open"));
  });
  await page.waitForTimeout(200);

  await step("first sec (术语) renders rows with audio paths", async () => {
    await page.locator(".grupo").first().locator(".sec-item").first().click();
    await page.waitForSelector(".row", { timeout: 5000 });
    const info = await page.evaluate(() => {
      const r = document.querySelector(".row");
      const es = r.querySelector(".es");
      return { rows: document.querySelectorAll(".row").length, esText: es.textContent, aIt: es.getAttribute("data-a"), aZh: r.querySelector(".zh").getAttribute("data-a") };
    });
    if (!info.esText) throw new Error("empty term");
    if (!/^audio\/it\//.test(info.aIt) || !/^audio\/zh\//.test(info.aZh)) throw new Error("bad audio path " + info.aIt + " " + info.aZh);
    return "rows=" + info.rows + " first=" + info.esText;
  });

  await page.screenshot({ path: path.resolve(__dirname, "shot_terms.png") });

  await step("dialogue sec renders turns with role badges", async () => {
    await page.evaluate(() => {
      document.querySelectorAll(".grupo").forEach((g) => g.classList.add("open"));
      document.querySelectorAll(".parte-item").forEach((p) => p.classList.add("open"));
    });
    await page.locator(".grupo").nth(1).locator(".sec-item").first().click();
    await page.waitForSelector(".turn", { timeout: 5000 });
    const info = await page.evaluate(() => {
      const t = document.querySelector(".turn");
      return { turns: document.querySelectorAll(".turn").length, role: t.querySelector(".role").textContent, es: t.querySelector(".t-es").textContent, aIt: t.querySelector(".t-es").getAttribute("data-a") };
    });
    if (!info.role || !info.es) throw new Error("empty dialogue");
    if (!/^audio\/it\//.test(info.aIt)) throw new Error("bad audio path " + info.aIt);
    return "turns=" + info.turns + " role=" + info.role;
  });

  await page.screenshot({ path: path.resolve(__dirname, "shot_dialogue.png") });

  await step("search finds 'soprano'", async () => {
    await page.fill("#search", "soprano");
    await page.waitForSelector(".sr-item", { timeout: 5000 });
    const n = await page.locator(".sr-item").count();
    if (n < 1) throw new Error("no results");
    return "results=" + n;
  });

  await step("search click navigates to sec", async () => {
    await page.locator(".sr-item").first().click();
    await page.waitForSelector(".sec-title", { timeout: 5000 });
    const t = await page.locator(".sec-title").textContent();
    return "title=" + t;
  });

  await step("player starts without throwing", async () => {
    await page.evaluate(() => { document.querySelector("#searchResults") && document.querySelector("#searchResults").classList.add("hidden"); document.querySelector("#content").classList.remove("hidden"); });
    await page.click("#playBtn");
    await page.waitForTimeout(1500);
    const label = await page.locator("#plLabel").textContent();
    return "label=" + label;
  });

  await step("study mode flashcard opens", async () => {
    await page.click("#studyBtn");
    await page.waitForSelector(".card-face", { timeout: 5000 });
    const has = await page.locator(".card-face").count();
    return "cards=" + has;
  });

  await browser.close();
  console.log("\n=== ERRORS ===");
  console.log(errors.length ? errors.join("\n") : "none");
  require("fs").writeFileSync(path.resolve(__dirname, "smoke_report.json"), JSON.stringify(report, null, 2));
  process.exit(errors.length || report.steps.some((s) => !s.ok) ? 1 : 0);
})().catch((e) => { console.error("FATAL", e); process.exit(2); });
