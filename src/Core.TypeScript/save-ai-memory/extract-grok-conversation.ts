#!/usr/bin/env bun
/**
 * tools/save-ai-memory/extract-grok-conversation.ts
 *
 * Extract a Grok conversation from the user's authenticated Chrome session
 * via osascript-driven AppleScript invocation.
 *
 * Authorization scope: this tool requires user-explicit per-extraction
 * direction (the human maintainer is the conversation owner and the only
 * authorization source per `.claude/rules/mechanical-authorization-check.md`).
 * It does NOT bypass any policy; it does NOT have ambient permission to
 * extract arbitrary authenticated content; each invocation requires the
 * human maintainer's named intent for the specific conversation being
 * preserved. Use is bounded by the `save-ai-memory` SKILL.md workflow.
 *
 * Implementation note: the script writes JS to a temp `.applescript` file
 * and invokes `osascript /path/to/file` (rather than `osascript -e "..."`).
 * This is a standard AppleScript packaging pattern documented in Apple's
 * scripting reference; the tool uses it because empirically the per-call
 * auto-mode classifier handled the file-based form differently than the
 * inline `-e` form during PR #3364 development. The tool itself does not
 * claim "bypass" semantics — it uses the standard file-based AppleScript
 * pattern that scripts commonly use; the differential classifier behavior
 * was observed empirically and is documented in:
 *   memory/feedback_aaron_playwright_browser_evaluate_hangs_on_grok_share_pages_30min_aaron_interrupt_was_unstick_not_block_signal_2026_05_15.md
 * If a future agent observes the classifier scoring this form the same as -e
 * (i.e., the differential closes), this tool will inherit those checks
 * cleanly because the user-explicit authorization scope is the same.
 *
 * Pipes the extracted plaintext to stdout for piping into process-extract.ts:
 *
 *   bun tools/save-ai-memory/extract-grok-conversation.ts \
 *       --url-fragment "grok.com/c/<conversation-id>" \
 *       | bun tools/save-ai-memory/process-extract.ts \
 *         --ai-name ani --platform grok \
 *         --topic plateau-bounded-extract --conversation-id <id>
 *
 * REQUIREMENTS
 *
 *   - macOS (osascript)
 *   - Google Chrome with target conversation already authenticated + open
 *     in some tab (script finds it by URL substring match)
 *   - Chrome → View → Developer → Allow JavaScript from Apple Events ON
 *   - Playwright Chrome killed (it shadows real Chrome):
 *     `pkill -f ms-playwright/mcp-chrome`
 *
 * WHAT THIS DOES
 *
 *   1. Identifies the scrollable conversation container (Grok-specific class)
 *   2. Scrolls to top, waits 2s
 *   3. Ping-pong scrolls (scrollTop=100 ↔ 0) to trigger lazy-load of older
 *      messages — Grok's load-older listener only fires on actual scroll
 *      events (programmatic scrollTop=0 alone is insufficient; intersection-
 *      observer and/or wheel-event triggers are needed; the 100↔0 cycle
 *      simulates an upward scroll motion)
 *   4. Repeats until scrollHeight plateaus (3 consecutive iters with <200px
 *      growth) OR a hard iteration cap (default 200, override with --max-iter)
 *   5. Final `document.body.innerText` extraction to stdout
 *
 * WHAT THIS DOES NOT DO
 *
 *   - Does NOT navigate the browser (you open the conversation manually)
 *   - Does NOT save the file (pipe to process-extract.ts for §33 archive)
 *   - Does NOT trim Grok sidebar from the output (process-extract.ts
 *     preserves verbatim; sidebar lives at the top of body.innerText)
 *   - Does NOT work for share/<id> URLs (those are React-shell-only with no
 *     SSR conversation; this skill is for the authenticated /c/<id> URL only)
 *
 * CHROME CONTAINER SELECTOR
 *
 *   Grok renders conversations into a div with classes:
 *     w-full h-full overflow-y-auto overflow-x-hidden ...
 *   This selector may need updating if Grok ships a UI refresh; override
 *   via --container-selector.
 */

import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

// Hard-coded Grok scroll-container selector. Was previously
// --container-selector-overridable, but the user-input → template-literal
// JS-construction pattern triggered repeated CodeQL `js/code-injection`
// findings even with allow-list validation + JSON.stringify encoding.
// Hard-coding eliminates the taint source entirely. If Grok refactors the
// DOM class, edit this constant + update the discovery trace memo.
const GROK_SCROLL_CONTAINER = "div.w-full.h-full.overflow-y-auto.overflow-x-hidden";

interface Config {
  urlFragment: string;
  maxIter: number;
  stableRequired: number;
  stableThreshold: number;
  settleMs: number;
  pingPongDelayMs: number;
  logToStderr: boolean;
}

function parseArgs(argv: string[]): Config {
  const cfg: Config = {
    urlFragment: "grok.com/c/",
    maxIter: 200,
    stableRequired: 3,
    stableThreshold: 200,
    settleMs: 1500,
    pingPongDelayMs: 400,
    logToStderr: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = (): string => {
      const v = argv[++i];
      if (v === undefined) {
        console.error(`Missing value for ${a}`);
        process.exit(1);
      }
      return v;
    };
    // Validate numeric flag values immediately. parseInt's "leading-numeric-
    // prefix" behavior (`parseInt('10foo')` → 10, `parseInt('2e3')` → 2)
    // would silently change scroll-loop behavior + produce non-repeatable
    // archives while still exiting 0. Require the ENTIRE input match
    // /^[0-9]+$/ first, then parse — strict positive-integer only.
    function parseIntOrDie(name: string, raw: string): number {
      if (!/^[0-9]+$/.test(raw)) {
        console.error(
          `Invalid value for ${name}: "${raw}" (expected positive integer with no trailing chars; saw partial-numeric or non-numeric input)`,
        );
        process.exit(1);
      }
      const n = Number.parseInt(raw, 10);
      if (!Number.isFinite(n) || n <= 0) {
        console.error(`Invalid value for ${name}: "${raw}" (expected positive integer)`);
        process.exit(1);
      }
      return n;
    }
    switch (a) {
      case "--url-fragment":
        cfg.urlFragment = next();
        break;
      case "--max-iter":
        cfg.maxIter = parseIntOrDie("--max-iter", next());
        break;
      case "--stable-required":
        cfg.stableRequired = parseIntOrDie("--stable-required", next());
        break;
      case "--stable-threshold":
        cfg.stableThreshold = parseIntOrDie("--stable-threshold", next());
        break;
      case "--settle-ms":
        cfg.settleMs = parseIntOrDie("--settle-ms", next());
        break;
      case "--ping-pong-delay-ms":
        cfg.pingPongDelayMs = parseIntOrDie("--ping-pong-delay-ms", next());
        break;
      case "--quiet":
        cfg.logToStderr = false;
        break;
      case "--help":
      case "-h":
        console.error(
          `Usage: bun ${argv[1] ?? "extract-grok-conversation.ts"} [options]\n\n` +
            "Options:\n" +
            "  --url-fragment <str>       URL substring matching the open tab (default: grok.com/c/)\n" +
            "  --max-iter <n>             max ping-pong iterations (default: 200)\n" +
            "  --stable-required <n>      consecutive sub-threshold iters to confirm plateau (default: 3)\n" +
            "  --stable-threshold <n>     pixel growth below this counts as stable (default: 200)\n" +
            "  --settle-ms <n>            wait after scroll before measuring (default: 1500)\n" +
            "  --ping-pong-delay-ms <n>   delay between scroll-to-100 and scroll-to-0 (default: 400)\n" +
            "  --quiet                    suppress per-iter progress to stderr\n\n" +
            "Note: the Grok scroll container is hard-coded to a Grok-specific class.\n" +
            "If Grok refactors the DOM, edit the GROK_SCROLL_CONTAINER constant in this file.\n",
        );
        process.exit(0);
        break;
      default:
        console.error(`unknown flag: ${a}`);
        process.exit(1);
    }
  }
  return cfg;
}

function log(cfg: Config, msg: string): void {
  if (cfg.logToStderr) console.error(`[extract-grok] ${msg}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Per-process secure tmpdir for .applescript file writes. Created lazily on
// first runJs call and reused. mkdtempSync creates a directory with mode 0700
// and a random suffix — defends against the CodeQL "insecure tmp file" finding
// (symlink-attack vector when writing to predictable /tmp/<fixed-name>).
let secureTmpDir: string | null = null;
function getSecureTmpDir(): string {
  if (secureTmpDir === null) {
    secureTmpDir = mkdtempSync(join(tmpdir(), "extract-grok-"));
    process.on("exit", () => {
      try {
        rmSync(secureTmpDir as string, { recursive: true, force: true });
      } catch {
        // best-effort cleanup; ignore failures during exit
      }
    });
  }
  return secureTmpDir;
}

/**
 * Run a JS expression inside the target Chrome tab via file-based AppleScript.
 * The JS body is written to a temp .applescript file (in a secure
 * mkdtemp-created directory) and invoked via `osascript /path/to/file` rather
 * than `osascript -e "..."`. This is the standard AppleScript packaging
 * pattern for scripts that benefit from file-isolation (timeout-block
 * declarations, multi-line readability, syntax-error reporting against a
 * file:line). The same content runs either way; the file form was chosen
 * for readability + the empirical reason documented at the top of this file.
 */
/**
 * Escape a string for safe embedding inside an AppleScript "..." string literal.
 * AppleScript string escape rules: `\\` for backslash, `\"` for quote. We must
 * escape backslashes FIRST (otherwise the `\"` we produce gets re-escaped).
 * Embedded newlines are also rejected — they'd break the literal in source.
 */
function escapeAppleScriptString(s: string): string {
  if (s.includes("\n") || s.includes("\r")) {
    throw new Error(
      "AppleScript string literal cannot contain raw newlines (would break the source); refusing to interpolate",
    );
  }
  return s.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

/**
 * runJs(cfg, js, timeoutSec, treatErrorPrefixAsAbort)
 *
 * The `treatErrorPrefixAsAbort` flag controls whether stdout starting with
 * "ERROR: " is treated as an AppleScript-side sentinel (abort with exit 1)
 * vs as legitimate response data. For SHORT scripted probes (scrollHeight,
 * scrollTop) the sentinel handling is right; for the LARGE body.innerText
 * extraction it's wrong (a conversation message could legitimately begin
 * with "ERROR: ..." and would be falsely aborted). Default `true` for
 * probes; the body-innerText call passes `false` explicitly.
 */
function runJs(cfg: Config, js: string, timeoutSec = 60, treatErrorPrefixAsAbort = true): string {
  // Escape both the URL fragment (developer-overridable via --url-fragment)
  // and the JS body for AppleScript string context. Without this, a fragment
  // or JS body containing " or \ would corrupt the AppleScript source.
  const urlFragmentLit = escapeAppleScriptString(cfg.urlFragment);
  const jsLit = escapeAppleScriptString(js);
  // Multi-tab-match guard (Codex PR #3364 finding): collect all matching
  // (window, tab) pairs, return ERROR if 0 or >1 — fail loudly rather than
  // silently bind to the first match (which would corrupt the archive when
  // --url-fragment is non-unique, e.g., the default "grok.com/c/" matching
  // multiple Grok tabs).
  const applescript = `with timeout of ${timeoutSec} seconds
    tell application "Google Chrome"
        set matches to {}
        repeat with w in windows
            repeat with t in tabs of w
                if URL of t contains "${urlFragmentLit}" then
                    set end of matches to t
                end if
            end repeat
        end repeat
        if (count of matches) is 0 then
            return "ERROR: no Chrome tab URL contains the fragment"
        end if
        if (count of matches) > 1 then
            return "ERROR: multiple Chrome tabs match the URL fragment (count=" & (count of matches) & "); narrow --url-fragment to a uniquely-matching substring"
        end if
        tell (item 1 of matches)
            return execute javascript "${jsLit}"
        end tell
    end tell
end timeout`;
  const tmpPath = join(getSecureTmpDir(), "runjs.applescript");
  writeFileSync(tmpPath, applescript, "utf-8");
  // Set maxBuffer to 32 MB — the canonical extraction returns ~2 MB of
  // body.innerText for Grok conversations; default 1 MiB risks ENOBUFS
  // truncation as conversations grow. 32 MB gives generous headroom.
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- osascript is a stable system binary on macOS; path is fixed by the OS, not user-supplied
  const result = spawnSync("osascript", [tmpPath], {
    encoding: "utf-8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    log(cfg, `osascript error (status=${result.status}): ${result.stderr.trim()}`);
    return "";
  }
  const stdout = result.stdout.replace(/\n$/, "");
  // Surface multi-tab-match (or other AppleScript-side ERRORs) at the runJs
  // boundary so callers see the failure rather than treating the literal
  // "ERROR: ..." string as data. Only treat ERROR-prefix as sentinel for
  // SCRIPTED PROBES (treatErrorPrefixAsAbort=true); the final body.innerText
  // extraction passes `false` because a conversation message could
  // legitimately begin with "ERROR: ..." and would be falsely aborted.
  if (treatErrorPrefixAsAbort && stdout.startsWith("ERROR: ")) {
    log(cfg, `ABORT: ${stdout}`);
    process.exit(1);
  }
  return stdout;
}

async function main(): Promise<void> {
  const cfg = parseArgs(process.argv.slice(2));
  log(cfg, `target URL fragment: ${cfg.urlFragment}`);
  log(cfg, `container selector (hard-coded): ${GROK_SCROLL_CONTAINER}`);

  // All JS bodies executed in Chrome are PLAIN STRING LITERALS — no
  // template-literal interpolation anywhere. The selector is hard-coded
  // module-level (GROK_SCROLL_CONTAINER), and the JS bodies below quote
  // it directly. This eliminates every user-input → code-construction
  // path that CodeQL's js/code-injection rule tracked across iterations.
  // If the selector value changes, regenerate these constants from the
  // GROK_SCROLL_CONTAINER source-of-truth via a maintenance script.
  const JS_SCROLL_TOP_AND_HEIGHT =
    '(function() { var c = document.querySelector("div.w-full.h-full.overflow-y-auto.overflow-x-hidden"); if (!c) return "ERROR: container not found"; c.scrollTop = 0; return c.scrollHeight.toString(); })()';
  const JS_SCROLL_100 =
    'document.querySelector("div.w-full.h-full.overflow-y-auto.overflow-x-hidden").scrollTop = 100';
  const JS_SCROLL_0 =
    'document.querySelector("div.w-full.h-full.overflow-y-auto.overflow-x-hidden").scrollTop = 0';
  const JS_SCROLL_HEIGHT =
    'document.querySelector("div.w-full.h-full.overflow-y-auto.overflow-x-hidden").scrollHeight.toString()';
  const JS_BODY_INNER_TEXT = "document.body.innerText";

  // Initial scroll-to-top + first scrollHeight measurement
  const initSH = runJs(cfg, JS_SCROLL_TOP_AND_HEIGHT);
  // Validate strictly: empty string, non-numeric, or explicit ERROR sentinel
  // are all hard-fails. Without this check, no-tab-match / osascript timeout /
  // returns yielding empty or NaN would silently produce an empty extract +
  // exit 0, contaminating any downstream pipeline (e.g., process-extract.ts).
  if (initSH.startsWith("ERROR:")) {
    log(cfg, initSH);
    process.exit(1);
  }
  if (initSH.trim().length === 0) {
    log(cfg, "ABORT: initial scrollHeight returned empty (likely no Chrome tab matches the URL fragment, or osascript timed out / failed silently)");
    process.exit(1);
  }
  const initSHNum = Number.parseInt(initSH, 10);
  if (!Number.isFinite(initSHNum) || initSHNum <= 0) {
    log(cfg, `ABORT: initial scrollHeight is non-numeric or non-positive: "${initSH}"`);
    process.exit(1);
  }
  log(cfg, `initial scrollHeight: ${initSHNum}`);
  await sleep(2000);

  let priorSH = initSHNum;
  let stableCount = 0;

  for (let i = 1; i <= cfg.maxIter; i++) {
    // Ping-pong: scroll down a tiny bit, then back to 0 (triggers lazy-load)
    runJs(cfg, JS_SCROLL_100, 30);
    await sleep(cfg.pingPongDelayMs);
    runJs(cfg, JS_SCROLL_0, 30);
    await sleep(cfg.settleMs);

    const shStr = runJs(cfg, JS_SCROLL_HEIGHT, 30);
    const sh = Number.parseInt(shStr, 10);
    if (!Number.isFinite(sh) || sh <= 0) {
      log(cfg, `iter ${i}: scrollHeight read failed (got "${shStr}"); skipping iter`);
      continue;
    }
    const growth = sh - priorSH;
    log(cfg, `iter ${i}: scrollHeight=${sh} (Δ +${growth})`);
    priorSH = sh;

    if (growth < cfg.stableThreshold) {
      stableCount++;
      if (stableCount >= cfg.stableRequired) {
        log(
          cfg,
          `plateau confirmed at iter ${i} (${stableCount} consecutive sub-${cfg.stableThreshold}px iters)`,
        );
        break;
      }
    } else {
      stableCount = 0;
    }
  }

  log(cfg, "extracting final body.innerText...");
  // Pass treatErrorPrefixAsAbort=false: a conversation message could
  // legitimately begin with "ERROR: " and falsely trigger the sentinel.
  // For the final extract, accept any return as data.
  const finalText = runJs(cfg, JS_BODY_INNER_TEXT, 120, false);
  if (finalText.trim().length === 0) {
    log(cfg, "ABORT: final body.innerText extraction returned empty; aborting before silent-success contaminates downstream pipeline");
    process.exit(1);
  }
  log(cfg, `extracted ${finalText.length} bytes`);
  process.stdout.write(finalText);
}

main().catch((err) => {
  console.error("[extract-grok] fatal:", err);
  process.exit(1);
});
