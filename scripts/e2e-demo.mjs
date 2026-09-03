import { chromium } from "playwright";

const base = "http://localhost:5173";

async function clickStageButton(page, text) {
  const button = page.getByRole("button", { name: new RegExp(text, "i") });
  await button.waitFor({ state: "visible", timeout: 15000 });
  await button.click();
}

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (error) => errors.push(`pageerror: ${error}`));
page.on("requestfailed", (request) => {
  const url = request.url();
  if (url.includes("favicon")) return;
  errors.push(`requestfailed: ${url} :: ${request.failure()?.errorText || "unknown"}`);
});
page.on("console", async (msg) => {
  if (msg.type() === "error") {
    const text = msg.text();
    if (/favicon|fonts\.googleapis|fonts\.gstatic|Failed to load resource/i.test(text)) return;
    const locations = msg.location();
    errors.push(`console: ${text} @ ${locations.url || "unknown"}:${locations.lineNumber || 0}`);
  }
});
page.on("response", async (response) => {
  const url = response.url();
  if (response.status() >= 400 && !/favicon|fonts\.googleapis|fonts\.gstatic/i.test(url)) {
    errors.push(`http ${response.status()}: ${url}`);
  }
});

try {
  await page.goto(base, { waitUntil: "networkidle" });
  await clickStageButton(page, "Load demo set");
  await page.getByText("PNG READY").first().waitFor({ timeout: 20000 });
  const readyCount = await page.getByText("PNG READY").count();
  if (readyCount < 3) throw new Error(`Expected 3 PNG READY badges, got ${readyCount}`);
  const xmlBadge = await page.getByText(/XML EMBED/i).count();
  if (!xmlBadge) throw new Error("Expected XML EMBED badge for demo image C");

  await clickStageButton(page, "Initialize 3-way pipeline");
  await clickStageButton(page, "Run CLAHE");
  await page.getByText("COMPLETE").first().waitFor({ timeout: 20000 });
  await clickStageButton(page, "Continue");

  await clickStageButton(page, "Match all pairs");
  await page.getByText(/RAW MATCHES/i).waitFor();
  await page.getByRole("button", { name: /A ↔ C/i }).click();
  await page.getByRole("button", { name: /B ↔ C/i }).click();
  await clickStageButton(page, "Continue to RANSAC");

  await clickStageButton(page, "Run RANSAC");
  await page.getByText(/INLIERS/i).first().waitFor();
  await clickStageButton(page, "Apply transforms");

  await clickStageButton(page, "Warp all pairs");
  await page.getByText(/HOMOGRAPHY/i).first().waitFor();
  await clickStageButton(page, "View full analysis");

  await page.getByText(/THREE-PAIR SCORECARD/i).waitFor({ timeout: 15000 });
  await page.getByText(/SPATIAL COVERAGE GRID/i).waitFor();
  await page.getByRole("button", { name: /A ↔ C/i }).first().click();
  await page.getByRole("button", { name: /B ↔ C/i }).first().click();
  await page.getByRole("button", { name: /Overlay blend/i }).click();
  await page.getByRole("button", { name: /Visual match map/i }).click();
  await page.getByRole("button", { name: /Registered image/i }).click();

  if (errors.length) throw new Error(`Console/page errors:\n${errors.join("\n")}`);
  console.log("E2E PASS: demo set → 3-way pipeline → scorecard/coverage");
} catch (error) {
  await page.screenshot({ path: "/tmp/luna-e2e-fail.png", fullPage: true });
  console.error("E2E FAIL:", error.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
