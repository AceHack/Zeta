import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname } from "node:path";
import { ollamaBackend } from "../accelerator/local-llm.js";
import {
  buildFirstSessionMenu,
  defaultNodeSession,
  firstSessionLabel,
  firstSessionOracle,
  firstSessionWithLlm,
  GH_SKIP_CONTINUE_LATER,
  simulateFirstSession
} from "./first-session.js";
import {
  SERIAL_PREFIX,
  defaultShellRunner,
  executeSetupCredential,
  probeAllCredentials
} from "./first-session-executor.js";
export const DEFAULT_MARKER_PATH = `${process.env.HOME ?? "/home/zeta"}/.config/zeta/first-session-complete`;
export function logSerial(line) {
  console.log(line);
  if (process.env.ZETA_FIRST_SESSION_TEE_CONSOLE === "1")
    try {
      appendFileSync("/dev/ttyS0", `${line}
`);
    } catch {}
}
export function parseArgs(argv) {
  let markerPath = process.env.ZETA_FIRST_SESSION_MARKER ?? DEFAULT_MARKER_PATH, dryRun = !1, demo = !1, demoScript = [], useLlm = !1, home = process.env.HOME ?? "/home/zeta";
  for (let i = 0;i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--marker-path" && argv[i + 1])
      markerPath = argv[++i];
    else if (arg === "--dry-run")
      dryRun = !0;
    else if (arg === "--demo")
      demo = !0;
    else if (arg === "--script" && argv[i + 1])
      demoScript = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg === "--llm")
      useLlm = !0;
    else if (arg === "--home" && argv[i + 1])
      home = argv[++i];
  }
  return {
    markerPath,
    dryRun,
    demo,
    demoScript,
    useLlm,
    home,
    runner: defaultShellRunner(),
    backend: ollamaBackend({ timeoutMs: 30000 })
  };
}
export function sessionFromProbe(runner, home, complete = !1) {
  return {
    credentials: probeAllCredentials(runner, home),
    complete,
    cloudHelpersOffered: !1
  };
}
export function actionFromDemoToken(token, session) {
  const menu = buildFirstSessionMenu(session), normalized = token.trim().toLowerCase();
  if (/^\d+$/.test(normalized)) {
    const idx = Number(normalized);
    return menu[idx] ?? null;
  }
  const alias = {
    "setup-gh": "setup_credential:gh",
    "skip-gh": "skip_credential:gh",
    "skip-optional": "skip_optional_credentials",
    "offer-cloud": "offer_cloud_helpers",
    "local-only": "use_local_llm_only",
    complete: "complete_first_session"
  }[normalized];
  if (!alias)
    return null;
  if (alias.includes(":")) {
    const [kind, vendor] = alias.split(":");
    return menu.find((a) => a.kind === kind && ("vendor" in a ? a.vendor === vendor : !0)) ?? null;
  }
  return menu.find((a) => a.kind === alias) ?? null;
}
export function writeMarker(markerPath) {
  mkdirSync(dirname(markerPath), { recursive: !0 });
  writeFileSync(markerPath, `${new Date().toISOString()}
`, { mode: 420 });
}
function printMenu(session) {
  const menu = buildFirstSessionMenu(session);
  console.log("");
  console.log("  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
  console.log("  \u2551  Zeta first login \u2014 a few simple choices                 \u2551");
  console.log("  \u2551  GitHub joins the cluster (first target). Local is OK.   \u2551");
  console.log("  \u2551  Cloud helpers stay hidden until you ask.                \u2551");
  console.log("  \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
  console.log("");
  for (let i = 0;i < menu.length; i++)
    console.log(`  [${i}] ${firstSessionLabel(menu[i])}`);
  console.log("");
}
async function pickAction(session, opts, demoQueue) {
  if (opts.demo) {
    const token = demoQueue.shift();
    if (!token)
      return null;
    return actionFromDemoToken(token, session);
  }
  if (opts.useLlm)
    return firstSessionWithLlm(session, opts.backend);
  printMenu(session);
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question("  Press Enter for recommended, or pick a number: "), menu = buildFirstSessionMenu(session);
    if (answer.trim() === "")
      return firstSessionOracle(session);
    const idx = Number(answer.trim());
    if (!Number.isInteger(idx) || idx < 0 || idx >= menu.length) {
      logSerial(`${SERIAL_PREFIX} invalid-choice`);
      return firstSessionOracle(session);
    }
    return menu[idx];
  } finally {
    rl.close();
  }
}
async function applyAction(session, action, opts) {
  if (action.kind === "setup_credential") {
    if (opts.dryRun) {
      logSerial(`${SERIAL_PREFIX} dry-run setup ${action.vendor}`);
      return simulateFirstSession(session, action);
    }
    const result = executeSetupCredential(action.vendor, opts.runner, opts.home);
    console.log(`${SERIAL_PREFIX} setup-${action.vendor} outcome=${result.outcome}`);
    if (result.outcome === "ready")
      return simulateFirstSession(session, action);
    console.log(`  (${result.message} \u2014 pick another option)`);
    return session;
  }
  if (opts.dryRun)
    logSerial(`${SERIAL_PREFIX} dry-run ${action.kind}`);
  const next = simulateFirstSession(session, action);
  if (action.kind === "skip_credential" && action.vendor === "gh") {
    console.log("");
    console.log("  Skipped GitHub for now.");
    console.log(`  Continue later: ${GH_SKIP_CONTINUE_LATER}.`);
    console.log("  Tip: on this machine run the first-login helper again, or SSH in and set up GitHub there.");
    console.log("");
  }
  return next;
}
export async function runFirstSession(opts) {
  if (existsSync(opts.markerPath) && !opts.demo && !opts.dryRun) {
    logSerial(`${SERIAL_PREFIX} already-complete marker=${opts.markerPath}`);
    return { ...defaultNodeSession(), complete: !0 };
  }
  logSerial(`${SERIAL_PREFIX} begin`);
  let session = sessionFromProbe(opts.runner, opts.home);
  const demoQueue = opts.demo ? [...opts.demoScript] : [], maxTicks = 24;
  for (let tick = 0;tick < maxTicks; tick++) {
    if (session.complete)
      break;
    const action = await pickAction(session, opts, demoQueue);
    if (!action)
      break;
    logSerial(`${SERIAL_PREFIX} choice kind=${action.kind}${"vendor" in action ? ` vendor=${action.vendor}` : ""}`);
    session = await applyAction(session, action, opts);
    if (session.complete) {
      if (!opts.dryRun)
        writeMarker(opts.markerPath);
      logSerial(`${SERIAL_PREFIX} complete canSelfRegister=${session.credentials.gh === "ready"}`);
      break;
    }
  }
  return session;
}
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  return (await runFirstSession(opts)).complete ? 0 : 1;
}
if (import.meta.main)
  main().then((code) => process.exit(code), (err) => {
    console.error(`${SERIAL_PREFIX} fatal ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
  });
