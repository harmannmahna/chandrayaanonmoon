import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE || "http://127.0.0.1:8000";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });

  const checks = [];

  async function visit(path, assertFn) {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(400);
    await assertFn();
    checks.push(`OK ${path}`);
  }

  await visit("/", async () => {
    await page.getByRole("heading", { name: "LunaMatch" }).waitFor();
    await page.getByText("Image Registration").waitFor();
  });

  await visit("/register", async () => {
    await page.getByRole("heading", { name: "Image Registration Wizard" }).waitFor();
    await page.getByRole("button", { name: "Skip" }).waitFor();
    await page.getByRole("button", { name: "Load demo pair" }).waitFor();
    // Skip through full demo pipeline
    await page.getByRole("button", { name: "Skip" }).click();
    await page.getByText("Stage 4 · Plain-language conclusion", { timeout: 120000 }).waitFor();
    await page.getByRole("button", { name: "Download matched spots" }).waitFor();
    await page.getByRole("button", { name: "Download unmatched spots" }).waitFor();
    const matchedDisabled = await page.getByRole("button", { name: "Download matched spots" }).isDisabled();
    const unmatchedDisabled = await page.getByRole("button", { name: "Download unmatched spots" }).isDisabled();
    if (matchedDisabled || unmatchedDisabled) {
      throw new Error("Download buttons unexpectedly disabled after Skip");
    }
  });

  await visit("/ice", async () => {
    await page.getByText(/LUNA\/ICE|Ice|optical/i).first().waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: /Skip/i }).waitFor();
  });

  await visit("/solar", async () => {
    await page.getByRole("tab", { name: "Moon Phases" }).waitFor();
    await page.getByRole("tab", { name: "Crater Shadows" }).click();
    await page.getByText(/Crater|shadow|illumination/i).first().waitFor();
    await page.getByRole("tab", { name: "South Pole / Cold-Trap" }).click();
    await page.getByText(/cold-trap|South-pole/i).first().waitFor();
  });

  await visit("/briefing", async () => {
    await page.getByText(/Briefing|Chandrayaan|Mission/i).first().waitFor();
  });

  await visit("/illumination", async () => {
    // client redirect to /solar
    await page.waitForURL(/\/solar/, { timeout: 15000 });
  });

  await browser.close();

  if (errors.length) {
    console.error("UI errors:\n" + errors.join("\n"));
    process.exitCode = 1;
  }
  console.log(checks.join("\n"));
  console.log("Smoke passed" + (errors.length ? " with console noise" : ""));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
