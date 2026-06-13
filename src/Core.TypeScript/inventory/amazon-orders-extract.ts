#!/usr/bin/env bun
/// <reference lib="dom" />
/**
 * Personal Amazon order-history extractor (v2.3).
 *
 * Human-driven only — not agent-invocable. Agent-driven scraping of
 * authenticated personal accounts is refused at the safety-classifier
 * layer per B-0582 (destructive-verb-refusal-gate). The legitimate
 * path is the operator running this script in their own session.
 *
 * v2.3 changes vs v2.2:
 *   - **Per-page incremental writes** — after every page extraction,
 *     the in-progress accumulator is written to disk. A crash mid-run
 *     no longer loses all data; the partial file has everything up
 *     through the last completed page. (Empirical anchor: browser
 *     chromium process crashed on page 22 of 23 with v2.2 — losing
 *     all 22 pages of in-memory data.)
 *   - Resume-from-partial: if a partial file exists for the year, the
 *     script reads it on startup, skips pages already completed, and
 *     resumes from the next un-extracted page. Pass --restart to
 *     ignore existing partial and start fresh.
 *
 * v2.x features retained:
 *   - Auto-installs playwright + chromium on first run
 *   - Session persistence — subsequent runs skip login
 *   - Output: ~/.local/share/zeta-inventory/amazon/<year>/
 *   - Default year = current year
 *   - Press-Enter pause after browser opens (sidesteps wait-for-selector
 *     timing issues)
 *   - Container-agnostic extraction (finds /dp/ links, walks ancestors
 *     for date + price)
 *
 * Usage:
 *     bun tools/inventory/amazon-orders-extract.ts                 # current year
 *     bun tools/inventory/amazon-orders-extract.ts 2025            # specific year
 *     bun tools/inventory/amazon-orders-extract.ts 2025 --restart  # ignore partial
 */

import { chmodSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";

const HARDWARE_KEYWORDS =
  /\b(Beelink|Minisforum|GMKtec|ASUS\s+NUC|Intel\s+NUC|Framework|Mini.?PC|GPU|Graphics\s+Card|NVIDIA|GeForce|Radeon|Ryzen|Intel\s+Core|Core\s+Ultra|NPU|AI\s+CPU|OCuLink|Thunderbolt|PCIe|DDR\d|RAM\s+\d|SSD|NVMe|M\.2|HDD|switch|router|ethernet|network|KVM|PiKVM|JetKVM|Tinypilot|Comet\s+Pro|Lantronix|monitor|display|UPS|rack|server|NAS|workstation|motherboard|CPU|processor|cooler|fan|PSU|power\s+supply|case|chassis|cable|adapter|hub|dock|usb)\b/i;

const args = process.argv.slice(2);
const RESTART = args.includes("--restart");
const YEAR = args.find((a) => /^\d{4}$/.test(a)) ?? new Date().getFullYear().toString();
const BASE_URL = `https://www.amazon.com/your-orders/orders?timeFilter=year-${YEAR}`;
const DATA_ROOT = join(homedir(), ".local/share/zeta-inventory/amazon");
const SESSION_FILE = join(DATA_ROOT, "playwright-session.json");
const YEAR_DIR = join(DATA_ROOT, YEAR);
const PARTIAL_FILE = join(YEAR_DIR, "amazon-items-partial.json");
const FULL_OUT = join(YEAR_DIR, "amazon-items-full.json");
const HARDWARE_OUT = join(YEAR_DIR, "amazon-items-hardware-filtered.json");

interface Item {
  page: number;
  title: string;
  url: string;
  date: string | null;
  nearbyPrice: string | null;
}

interface Partial {
  year: string;
  completedPages: number[];
  items: Item[];
}

interface PlaywrightRuntime {
  chromium: {
    launch(options: { headless: boolean }): Promise<{
      close(): Promise<void>;
      newContext(options?: { storageState?: string }): Promise<{
        storageState(options: { path: string }): Promise<void>;
        newPage(): Promise<{
          goto(url: string): Promise<unknown>;
          waitForLoadState(state: string, options: { timeout: number }): Promise<void>;
          waitForTimeout(ms: number): Promise<void>;
          evaluate<T, A>(fn: (arg: A) => T | Promise<T>, arg: A): Promise<T>;
          evaluate<T>(fn: () => T | Promise<T>): Promise<T>;
        }>;
      }>;
    }>;
  };
}

async function ensureModule(name: string): Promise<boolean> {
  try { await import(name); return true; } catch { return false; }
}

async function loadPlaywright(): Promise<PlaywrightRuntime> {
  const runtimeImport = new Function("name", "return import(name)") as (
    name: string,
  ) => Promise<PlaywrightRuntime>;
  return runtimeImport("playwright");
}

async function installIfMissing(): Promise<void> {
  if (!(await ensureModule("playwright"))) {
    console.log("Installing playwright (first-run setup)...");
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- first-run bootstrap: invoking the user's bun from $PATH is intentional + the script itself runs via `bun ...` so the same PATH governs invocation
    const r = spawnSync("bun", ["install", "playwright"], { stdio: "inherit" });
    if (r.status !== 0) { console.error("Failed. Run manually: bun install playwright"); process.exit(1); }
  }
}

async function ensureChromium(): Promise<void> {
  const { chromium } = await loadPlaywright();
  try {
    const b = await chromium.launch({ headless: true });
    await b.close();
  } catch (err) {
    const msg = String(err);
    if (msg.includes("Executable doesn't exist") || msg.includes("Looks like Playwright Test or Playwright was just installed")) {
      console.log("Installing chromium binary (first-run setup)...");
      // eslint-disable-next-line sonarjs/no-os-command-from-path -- first-run bootstrap: invoking bunx from $PATH is intentional + matches the parent bun invocation
      const r = spawnSync("bunx", ["playwright", "install", "chromium"], { stdio: "inherit" });
      if (r.status !== 0) { console.error("Failed. Run manually: bunx playwright install chromium"); process.exit(1); }
    } else { throw err; }
  }
}

async function pressEnterToContinue(prompt: string): Promise<void> {
  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(prompt);
  console.log("Press ENTER in this terminal when you're ready to continue.");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
    process.stdin.resume();
  });
  process.stdin.pause();
}

function loadPartial(): Partial {
  if (RESTART || !existsSync(PARTIAL_FILE)) {
    return { year: YEAR, completedPages: [], items: [] };
  }
  try {
    const data = JSON.parse(readFileSync(PARTIAL_FILE, "utf-8")) as Partial;
    if (data.year !== YEAR) {
      console.log(`Partial file is for year ${data.year}, current year ${YEAR} — ignoring`);
      return { year: YEAR, completedPages: [], items: [] };
    }
    console.log(`Resuming from partial: ${data.completedPages.length} pages already completed (${data.items.length} items so far)`);
    return data;
  } catch {
    return { year: YEAR, completedPages: [], items: [] };
  }
}

function writePartial(state: Partial): void {
  writeFileSync(PARTIAL_FILE, JSON.stringify(state, null, 2));
  // Best-effort 0600 on partial — same rationale as session file: file
  // contains real personal-purchase data + (in future) accounting-grade
  // titles/dates/prices the maintainer is preserving for their accountant.
  try { chmodSync(PARTIAL_FILE, 0o600); } catch { /* best-effort */ }
}

async function main(): Promise<void> {
  await installIfMissing();
  await ensureChromium();
  mkdirSync(YEAR_DIR, { recursive: true });

  const { chromium } = await loadPlaywright();
  console.log(`Extracting Amazon orders for year ${YEAR}${RESTART ? " (--restart)" : ""}...`);
  console.log(`Output directory: ${YEAR_DIR}`);

  const state = loadPartial();

  const browser = await chromium.launch({ headless: false });
  const sessionOpts = existsSync(SESSION_FILE) ? { storageState: SESSION_FILE } : {};
  const ctx = await browser.newContext(sessionOpts);
  const page = await ctx.newPage();

  try {
    await page.goto(BASE_URL);
  } catch (err) {
    console.error(`goto(${BASE_URL}) failed:`, err);
    await pressEnterToContinue("Press Enter to close the browser and exit.");
    await browser.close();
    process.exit(1);
  }

  await pressEnterToContinue(
    `Amazon orders page is open in the browser.\n` +
      (existsSync(SESSION_FILE)
        ? "Session was reused. Verify you can see your orders, then press Enter."
        : "If sign-in is required, complete it. Verify you can see your orders. Then press Enter."),
  );

  await ctx.storageState({ path: SESSION_FILE });
  try { chmodSync(SESSION_FILE, 0o600); } catch { /* permissions best-effort */ }

  const totalPages = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll<Element>(".a-pagination li, ul.a-pagination li, [aria-label*='pagination'] li"));
    const numbers = items.map((li: Element) => li.textContent?.trim() ?? "").filter((t: string) => /^\d+$/.test(t));
    return numbers.length > 0 ? Math.max(...numbers.map(Number)) : 1;
  });
  console.log(`Detected total pages: ${totalPages}`);
  if (state.completedPages.length > 0) {
    console.log(`Will skip pages already in partial: ${state.completedPages.join(",")}`);
  }

  for (let p = 1; p <= totalPages; p++) {
    if (state.completedPages.includes(p)) continue;

    if (p > 1 || state.completedPages.length > 0) {
      try {
        await page.goto(`${BASE_URL}&startIndex=${(p - 1) * 10}`);
        await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
        await page.waitForTimeout(1500);
      } catch (err) {
        console.warn(`Page ${p} navigation failed: ${String(err).split('\n')[0]} — skipping`);
        continue;
      }
    }
    let items: Item[] = [];
    try {
      items = await page.evaluate(({ pageNumber }: { pageNumber: number }) => {
        const HARDCODED = /^(Buy it again|Track package|Order details|View invoice|Return|Replace|Write a|Get product support|Archive order|Hide order|Share gift receipt|Leave seller feedback|Track shipment|View your item|Manage|Order summary)/i;
        const allLinks = Array.from(document.querySelectorAll("a[href*='/dp/'], a[href*='/gp/product/']"));
        const seen = new Set<string>();
        const result: Item[] = [];
        allLinks.forEach((a) => {
          const link = a as HTMLAnchorElement;
          const title = (link.textContent ?? "").trim();
          const href = link.href ?? "";
          if (title.length < 5 || title.length > 300) return;
          if (HARDCODED.test(title)) return;
          const dedup = href.split("?")[0] ?? href;
          if (seen.has(dedup)) return;
          seen.add(dedup);
          let date: string | null = null;
          let price: string | null = null;
          let cur: HTMLElement | null = link.parentElement;
          for (let depth = 0; depth < 10 && cur && (!date || !price); depth++, cur = cur.parentElement) {
            const text = cur.textContent ?? "";
            if (!date) { const m = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/); if (m) date = m[0]; }
            if (!price) { const m = text.match(/\$[\d,]+\.\d{2}/); if (m) price = m[0]; }
          }
          result.push({ page: pageNumber, title, url: dedup, date, nearbyPrice: price });
        });
        return result;
      }, { pageNumber: p });
    } catch (err) {
      console.warn(`Page ${p} extract failed: ${String(err).split('\n')[0]} — skipping`);
      continue;
    }
    console.log(`Page ${p}: ${items.length} unique items`);
    state.items.push(...items);
    state.completedPages.push(p);
    // CHECKPOINT — write partial after every page so a crash preserves progress
    writePartial(state);
  }

  // FS-only cleanup FIRST — these don't depend on the browser context, so
  // they always succeed regardless of post-navigation-timeout chromium state.
  // v2.3 had a freeze where storageState() / browser.close() hung after a
  // page-23 navigation timeout, preventing FULL_OUT + HARDWARE_OUT writes.
  // Move FS writes ahead of context operations so the user always has files
  // on disk even when the browser is degraded.
  writeFileSync(
    FULL_OUT,
    JSON.stringify({ year: YEAR, totalPages, itemCount: state.items.length, items: state.items }, null, 2),
  );
  try { chmodSync(FULL_OUT, 0o600); } catch { /* best-effort — personal financial data */ }
  console.log(`\nWrote ${FULL_OUT} — ${state.items.length} items`);

  const hardwareItems = state.items.filter((i) => HARDWARE_KEYWORDS.test(i.title));
  writeFileSync(
    HARDWARE_OUT,
    JSON.stringify({ year: YEAR, itemCount: hardwareItems.length, items: hardwareItems }, null, 2),
  );
  try { chmodSync(HARDWARE_OUT, 0o600); } catch { /* best-effort — personal financial data */ }
  console.log(`Wrote ${HARDWARE_OUT} — ${hardwareItems.length} hardware-matching items`);

  // Browser-context cleanup AFTER, each in its own try-with-timeout so a
  // hung context can't prevent the next step or the script from exiting.
  await withTimeout("session-save", 5000, async () => {
    await ctx.storageState({ path: SESSION_FILE });
    try { chmodSync(SESSION_FILE, 0o600); } catch { /* best-effort */ }
  });
  await withTimeout("browser-close", 5000, () => browser.close());

  console.log("\nDone. Review the hardware-filtered file before any git commit.");
}

async function withTimeout(label: string, ms: number, fn: () => Promise<unknown>): Promise<void> {
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
    ]);
  } catch (err) {
    console.warn(`Cleanup step "${label}" failed/timed out (${String(err).split('\n')[0]}) — continuing`);
  }
}

main().catch((err) => {
  console.error("\nUnexpected error:", err);
  process.exit(1);
});
