import { chromium } from "playwright";

const base = "http://localhost:3000";

async function clickEnabledPipeline(page) {
  await page.waitForFunction(() => {
    const buttons = [...document.querySelectorAll("button")];
    const target = buttons.find((b) => /Run full pair pipeline|Re-run pairs/i.test(b.textContent || ""));
    return Boolean(target && !target.disabled);
  }, { timeout: 60000 });
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")];
    const target = buttons.find((b) => /Run full pair pipeline|Re-run pairs/i.test(b.textContent || ""));
    if (!target || target.disabled) throw new Error("Pipeline button unavailable");
    target.click();
  });
}

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

try {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Load demo set/i }).click();
  await page.getByText(/Loaded/i).first().waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /^Run CLAHE/i }).click();
  await page.getByRole("button", { name: /Re-run CLAHE/i }).waitFor({ timeout: 60000 });
  await clickEnabledPipeline(page);
  await page.getByText(/Pipeline complete/i).waitFor({ timeout: 180000 });
  await page.getByText(/RMSE/i).first().waitFor();
  await page.getByRole("button", { name: /Coverage/i }).click();
  await page.getByText(/Uniform:/i).first().waitFor();
  await page.getByRole("button", { name: /Baseline comparison/i }).click();
  await page.getByText(/Classical ORB-like|Running baseline/i).first().waitFor({ timeout: 120000 });
  await page.getByText(/Classical ORB-like/i).waitFor({ timeout: 120000 });

  await page.getByRole("button", { name: /Synthetic ground-truth pair/i }).click();
  await page.getByText(/Loaded Synthetic|Synthetic ground-truth/i).first().waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /^Run CLAHE/i }).click();
  await page.getByRole("button", { name: /Re-run CLAHE/i }).waitFor({ timeout: 60000 });
  await clickEnabledPipeline(page);
  await page.getByText(/Pipeline complete/i).waitFor({ timeout: 180000 });
  await page.getByRole("button", { name: /Ground-truth validation/i }).click();
  await page.getByText(/Max corner error|H_gt/i).first().waitFor({ timeout: 15000 });
  console.log("E2E PASS: full pipeline + coverage + baseline + GT");
} catch (error) {
  await page.screenshot({ path: "/tmp/luna-pipeline-fail.png", fullPage: true });
  const status = await page.locator("p").allTextContents();
  console.error("E2E FAIL:", error instanceof Error ? error.message : error);
  console.error("Status texts:", status.slice(0, 12));
  process.exitCode = 1;
} finally {
  await browser.close();
}
