/**
 * uat-three-criteria.ts — ONE run, from a clean slate, that exercises all three acceptance
 * criteria end to end and REFUSES rather than reports when one of them does not hold.
 *
 * ── WHY THIS EXISTS AS A SCRIPT AND NOT AS A NARRATIVE ───────────────────────
 * Each half of this has been demonstrated before in separate runs, with the joins between them
 * described in prose. That is weaker than it sounds: a reader has to take on trust that the store
 * one step wrote is the store the next step read, and prose cannot fail. This does the whole thing
 * in one process, against one set of directories, and every claim is an assertion that can go red.
 *
 * ── IT USES THE SAME DOORS THE BROWSER USES ──────────────────────────────────
 * The tracker is read over `/api/work/board`, a ticket is handed over with `POST /api/work/load`,
 * and a gate is answered by writing the action queue — the same three paths the portal's buttons
 * take. Calling the modules directly would test the modules and not the product.
 *
 * ── WHAT IT WILL NOT DO ──────────────────────────────────────────────────────
 * With no Jira credentials it REFUSES the tracker half rather than substituting a fixture. A UAT
 * that silently falls back to a fake tracker reports a working integration on a machine that has
 * never reached one, which is the exact failure the whole register is built against.
 *
 *   bun src/Core.TypeScript/corporate/uat-three-criteria.ts --jira <path> [--keep]
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ─── The checklist ───────────────────────────────────────────────────────────

interface Check {
  readonly criterion: 1 | 2 | 3;
  readonly claim: string;
  readonly ok: boolean;
  readonly saw: string;
}

const checks: Check[] = [];

function check(criterion: 1 | 2 | 3, claim: string, ok: boolean, saw: string): void {
  checks.push({ criterion, claim, ok, saw });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${claim}`);
  console.log(`        ${saw}`);
}

// ─── Plumbing ────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
function flag(name: string): string | undefined {
  const at = argv.indexOf(name);
  return at < 0 ? undefined : argv[at + 1];
}

const jiraPath = flag("--jira");
const keep = argv.includes("--keep");
const root = mkdtempSync(join(tmpdir(), "org-uat-"));
const dir = (name: string): string => {
  const p = join(root, name);
  mkdirSync(p, { recursive: true });
  return p;
};
const store = dir("store");
const docs = dir("docs");
const inbox = dir("inbox");
const memory = dir("memory");
const actions = dir("actions");
const rooms = dir("rooms");

const PORT = 7900 + Math.floor(Math.random() * 60);
const BASE = `http://127.0.0.1:${String(PORT)}`;

/** Walk a directory tree. Used to count event shards and to find memory files. */
function walk(at: string, out: string[] = []): string[] {
  if (!existsSync(at)) return out;
  for (const name of readdirSync(at)) {
    const p = join(at, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** One run of the organization, at a declared instant. Returns its stdout. */
function runOrg(atIso: string, extra: readonly string[] = []): string {
  const result = spawnSync(
    "bun",
    [
      "src/Core.TypeScript/corporate/run-org.ts",
      "--store", store,
      "--inbox", inbox,
      "--memory", memory,
      "--actions", actions,
      "--rooms", rooms,
      "--study-cmd", "node", "--study-arg", "tools/demo-studier.cjs",
      "--artifact-cmd", "node", "--artifact-arg", "tools/demo-author.cjs",
      "--now", atIso,
      ...extra,
    ],
    { encoding: "utf-8", env: { ...process.env, DEMO_DOCS_DIR: docs }, shell: false, timeout: 300_000 },
  );
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

async function main(): Promise<void> {
  console.log(`workspace: ${root}\n`);

  // ═══ CRITERION 1 — work management, over the same doors the UI uses ════════
  console.log("── 1. WORK MANAGEMENT ──────────────────────────────────────────");

  if (jiraPath === undefined || !existsSync(jiraPath)) {
    check(1, "the tracker is configured", false, "--jira was not given, and no fixture is substituted for it");
  } else {
    const server = spawn(
      "bun",
      [
        "src/Core.TypeScript/corporate/serve-org.ts",
        "--store", store, "--docs", docs, "--actions", actions, "--memory", memory,
        "--rooms", rooms, "--inbox", inbox, "--jira", jiraPath,
        "--checkpoint", "grooming", "--operator", "uat",
        "--port", String(PORT),
      ],
      { stdio: "ignore", shell: false },
    );
    try {
      // Wait for it to answer rather than sleeping a guessed interval.
      let up = false;
      for (let i = 0; i < 40 && !up; i += 1) {
        await new Promise((r) => setTimeout(r, 500));
        up = await fetch(`${BASE}/api/portal`).then((r) => r.ok).catch(() => false);
      }
      if (!up) throw new Error("the server never answered");

      // ── the board ──
      const board = (await fetch(`${BASE}/api/work/board`).then((r) => r.json())) as {
        ok?: boolean;
        reason?: string;
        columns?: readonly { key: string; label: string; unread: boolean; rows: readonly { issue: { key: string; summary: string }; loaded: boolean }[] }[];
      };
      const columns = board.columns ?? [];
      const total = columns.reduce((n, c) => n + c.rows.length, 0);
      check(
        1,
        "the board reads the real tracker and returns every column",
        board.ok === true && columns.length >= 3 && total > 0,
        board.ok === true
          ? columns.map((c) => `${c.label}=${c.unread ? "unread" : String(c.rows.length)}`).join(" · ")
          : `refused: ${String(board.reason)}`,
      );

      // A ticket appears in EXACTLY ONE column: `assigned_open` overlaps the other two by
      // construction, so a board without a precedence double-counts and cannot be read from.
      const seen = new Map<string, number>();
      for (const c of columns) for (const r of c.rows) seen.set(r.issue.key, (seen.get(r.issue.key) ?? 0) + 1);
      const duplicated = [...seen.entries()].filter(([, n]) => n > 1);
      check(
        1,
        "no ticket is counted in two columns",
        duplicated.length === 0,
        duplicated.length === 0 ? `${String(seen.size)} distinct ticket(s), none duplicated` : `duplicated: ${duplicated.map(([k]) => k).join(", ")}`,
      );

      // ── hand one over, the way the button does ──
      // The FIRST ticket the board offers, so this is not a hand-picked case. AIAGENT-1637 is
      // skipped on purpose: it is under a clean-room constraint and agents must not look at it.
      const candidate = columns.flatMap((c) => c.rows).find((r) => !r.loaded && r.issue.key !== "AIAGENT-1637");
      if (candidate === undefined) {
        check(1, "there is a ticket to hand over", false, "every ticket on the board is already loaded");
      } else {
        const loaded = (await fetch(`${BASE}/api/work/load`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key: candidate.issue.key, byHuman: "uat" }),
        }).then((r) => r.json())) as { ok?: boolean; loaded?: string; reason?: string };

        const written = join(inbox, `jira-${candidate.issue.key}.json`);
        check(
          1,
          "handing a ticket over writes it into the organisation's inbox",
          loaded.ok === true && existsSync(written),
          loaded.ok === true ? `${String(loaded.loaded)} → ${written}` : `refused: ${String(loaded.reason)}`,
        );

        // The intake is the tracker's own words, not something this script made up.
        const intake = JSON.parse(readFileSync(written, "utf-8")) as { externalId?: string; title?: string; source?: string };
        check(
          1,
          "the loaded ticket carries the tracker's own key and summary",
          intake.externalId === candidate.issue.key && intake.title === candidate.issue.summary && intake.source === "jira",
          `${String(intake.source)} ${String(intake.externalId)} — ${String(intake.title)}`,
        );

        // ── the organisation picks it up and STOPS at the gate ──
        const day1 = runOrg("2026-09-09T09:00:00.000Z", ["--checkpoint", "grooming"]);
        check(
          1,
          "the organisation picks the ticket up on its next run",
          day1.includes(`intake accepted '${candidate.issue.summary}'`),
          day1.includes("intake accepted") ? "intake accepted it" : "intake never mentioned it",
        );
        check(
          1,
          "it STOPS at the configured gate instead of deciding for you",
          day1.includes("waiting for a person at 'brd_approval'"),
          day1.includes("waiting for a person") ? "stopped at brd_approval, awaiting a person" : "it did not stop",
        );

        // ── documents exist to review ──
        const written1 = walk(docs).filter((f) => f.endsWith(".md"));
        check(
          1,
          "there are documents to review, on disk",
          written1.length > 0,
          `${String(written1.length)} document(s) under ${docs}`,
        );

        // ── answer it, the way the Inbox button does ──
        const view = (await fetch(`${BASE}/api/portal`).then((r) => r.json())) as {
          work?: readonly { workId: string; awaitingHumanAt?: string }[];
        };
        const held = (view.work ?? []).filter((w) => w.awaitingHumanAt !== undefined);
        check(
          1,
          "the portal shows the held work to the person who must answer",
          held.length > 0,
          `${String(held.length)} item(s) awaiting a person`,
        );
        for (const w of held) {
          writeFileSync(
            join(actions, `uat-${w.workId}.json`),
            `${JSON.stringify({
              actionId: `uat-${w.workId}`,
              kind: "approve_gate",
              byHuman: "uat",
              atMs: Date.parse("2026-09-10T09:00:00.000Z"),
              subjectId: w.workId,
              reason: "UAT: read the grooming document and the acceptance criteria are testable",
              detail: { gate: String(w.awaitingHumanAt) },
            }, null, 2)}\n`,
            "utf-8",
          );
        }

        const day2 = runOrg("2026-09-10T09:00:00.000Z", ["--checkpoint", "grooming", "--resume"]);
        check(
          1,
          "answering the gate lets the walk continue past it",
          !day2.includes("waiting for a person at 'brd_approval'") && day2.includes("qa_uat"),
          day2.includes("qa_uat") ? "the walk reached qa_uat" : "the walk did not get past the checkpoint",
        );
      }
    } finally {
      server.kill();
    }
  }

  // ═══ CRITERION 2 — a living organisation ══════════════════════════════════
  console.log("\n── 2. A LIVING ORGANISATION ────────────────────────────────────");

  // ── LET IT FINISH FIRST ───────────────────────────────────────────────────
  // The first version of this went straight to the night with criterion 1's work still in flight,
  // so "3 working" was the baseline and the wake test compared 3 to 3. An organisation that never
  // slept cannot demonstrate waking, and the check could not have failed for the right reason.
  let settled = false;
  for (let i = 0; i < 4 && !settled; i += 1) {
    const out = runOrg(`2026-09-1${String(i)}T18:00:00.000Z`, ["--resume"]);
    const c = /(\d+) working · \d+ in a meeting · \d+ studying · \d+ asleep/.exec(out);
    settled = c !== null && Number(c[1]) === 0;
  }
  check(
    2,
    "the organisation FINISHES its work and goes quiet, rather than staying busy forever",
    settled,
    settled ? "no hat is worn once the work is done" : "hats were still on after four more runs",
  );

  // A NIGHT: nothing to do. Some of the org reads; the rest sleeps.
  const night = runOrg("2026-09-14T02:00:00.000Z", ["--resume"]);
  const census = /(\d+) working · (\d+) in a meeting · (\d+) studying · (\d+) asleep/.exec(night);
  check(
    2,
    "with no work, NO hat is worn — authority is not held for its own sake",
    census !== null && Number(census[1]) === 0,
    census === null ? "no census was taken" : `${census[1]} working at 02:00`,
  );

  check(
    2,
    "and the organisation is still not idle: some read, the rest sleep",
    census !== null && Number(census[3]) > 0 && Number(census[4]) > 0,
    census === null ? "no census was taken" : `${census[3]} studying · ${census[4]} asleep`,
  );

  check(
    2,
    "idle hats spend the time reading the repository, and write down what they found",
    /\d+\/\d+ study block\(s\) produced a memory/.test(night) &&
      !/0\/\d+ study block\(s\) produced a memory/.test(night),
    (/(\d+\/\d+) study block\(s\) produced a memory/.exec(night)?.[1] ?? "?") + " study blocks produced a memory",
  );

  // ── A DEFECT WITH NOTHING BEHIND IT IS REFUSED ────────────────────────────
  // Checked FIRST, and on purpose. The first run of this UAT filed exactly this by mistake —
  // `evidenceRefs: []` — and the organisation refused it, which is correct: a defect nobody can
  // point at is an assertion. Asserting the refusal keeps the guard covered instead of quietly
  // routing around it.
  writeFileSync(
    join(inbox, "uat-unevidenced.json"),
    `${JSON.stringify({
      source: "uat",
      externalId: "UAT-NO-EVIDENCE",
      kind: "defect",
      title: "A defect with nothing behind it",
      body: "Steps to reproduce: run the importer twice. Expected: one row. Actual: two rows.",
      reproduction: "run the importer twice",
      severity: "high",
      evidenceRefs: [],
    }, null, 2)}\n`,
    "utf-8",
  );
  const refusalRun = runOrg("2026-09-14T08:00:00.000Z", ["--resume"]);
  check(
    2,
    "a defect with NO EVIDENCE is refused at intake, not worked on",
    /intake refused: missing_evidence/.test(refusalRun),
    (/intake refused: ([^\n]+)/.exec(refusalRun)?.[1] ?? "it was NOT refused").slice(0, 80),
  );
  rmSync(join(inbox, "uat-unevidenced.json"), { force: true });

  // A MORNING: real work arrives, and somebody has to wake up for it.
  writeFileSync(
    join(inbox, "uat-wake.json"),
    `${JSON.stringify({
      source: "uat",
      externalId: "UAT-WAKE-1",
      kind: "defect",
      title: "A defect raised overnight, to see who wakes up for it",
      body: "Steps to reproduce: run the importer twice. Expected: one row. Actual: two rows.",
      reproduction: "run the importer twice",
      severity: "high",
      evidenceRefs: ["uat://importer-run-log/2026-09-14", "uat://screenshot/duplicate-rows.png"],
    }, null, 2)}\n`,
    "utf-8",
  );
  // WITH A CHECKPOINT, on purpose. Without one the defect was walked all the way to done inside
  // this single run, so by the time the census was taken nothing needed a hat any more and the
  // organisation read as 0 working — correct behaviour, and a scenario that cannot demonstrate
  // waking. "Work arrives and somebody puts a hat on" needs work that is still IN FLIGHT when the
  // census is taken, which is exactly what a gate that waits for a person produces.
  const morning = runOrg("2026-09-14T09:00:00.000Z", ["--resume", "--checkpoint", "grooming"]);
  check(
    2,
    "a well-formed defect IS accepted — the guard above is a check, not a wall",
    /intake accepted 'A defect raised overnight/.test(morning),
    /intake accepted 'A defect raised overnight/.test(morning) ? "accepted" : "it was refused too",
  );
  const morningCensus = /(\d+) working · (\d+) in a meeting · (\d+) studying · (\d+) asleep/.exec(morning);
  check(
    2,
    "work arriving puts hats back ON — authority is worn only when it is needed",
    morningCensus !== null && Number(morningCensus[1]) > 0 && Number(morningCensus[1]) > Number(census?.[1] ?? "0"),
    `${String(census?.[1] ?? "?")} working at 02:00 → ${String(morningCensus?.[1] ?? "?")} working at 09:00`,
  );
  check(
    2,
    "SLEEP ENDS: a hat that was asleep and is now needed is reported as waking",
    /woke: /.test(morning),
    (/woke: ([^\n]+)/.exec(morning)?.[1] ?? "nobody woke").slice(0, 90),
  );

  // The free time is BOOKED — a studying hat is not available for anything else.
  const events = walk(join(store, "events")).map((f) => JSON.parse(readFileSync(f, "utf-8")) as { fact?: { kind?: string; hatId?: string; startMs?: number; endMs?: number } });
  const freeBlocks = events.filter((e) => e.fact?.kind === "self_directed");
  check(
    2,
    "free time is recorded as a booked hour with a start and an end, not as a note",
    freeBlocks.length > 0 &&
      freeBlocks.every((e) => typeof e.fact?.startMs === "number" && (e.fact.endMs ?? 0) > (e.fact.startMs ?? 0)),
    `${String(freeBlocks.length)} free-time block(s), each with a start and an end`,
  );

  // ═══ CRITERION 3 — memory ═════════════════════════════════════════════════
  console.log("\n── 3. MEMORY ───────────────────────────────────────────────────");

  const repos = walk(memory)
    .filter((f) => f.includes(`${join(".git", "HEAD")}`))
    .map((f) => f.slice(memory.length + 1).replace(join(".git", "HEAD"), "").replace(/[\\/]+$/, ""));
  const agentRepos = repos.filter((r) => r.startsWith("agents"));
  check(
    3,
    "there is a SHARED library repository",
    repos.some((r) => r === "library"),
    repos.length > 0 ? `repositories: ${repos.join(", ")}` : "no git repository was created",
  );
  check(
    3,
    "each agent has its OWN git repository for its own memory",
    agentRepos.length > 0,
    agentRepos.length > 0 ? agentRepos.join(", ") : "no per-agent repository exists",
  );

  const firstAgentRepo = agentRepos[0];
  if (firstAgentRepo !== undefined) {
    const cwd = join(memory, firstAgentRepo);
    const log = spawnSync("git", ["log", "--oneline"], { cwd, encoding: "utf-8", shell: false });
    const commits = (log.stdout ?? "").trim().split("\n").filter((l) => l.trim() !== "");
    check(
      3,
      "the agent's memory has a HISTORY, not just a directory",
      commits.length > 0,
      `${String(commits.length)} commit(s); newest: ${commits[0] ?? "(none)"}`,
    );
  }

  // Written, recalled, and reinforced — the three halves of a memory that is actually used.
  const memFiles = walk(memory).filter((f) => f.endsWith(".md") && !f.includes(".recall"));
  check(
    3,
    "memories are written as readable files, not as an opaque store",
    memFiles.length > 0,
    `${String(memFiles.length)} memory file(s)`,
  );

  const recall = walk(join(memory, ".recall")).filter((f) => f.endsWith(".md"));
  const recallText = recall.map((f) => readFileSync(f, "utf-8")).join("\n");
  check(
    3,
    "what a hat already knows is PUT IN FRONT OF IT before it produces anything",
    recall.length > 0 && recallText.includes("What this hat already knows"),
    recall.length > 0
      ? `${String(recall.length)} recall file(s), ${String((recallText.match(/^- \[/gm) ?? []).length)} memory line(s) injected`
      : "nothing was ever recalled",
  );

  const states = walk(memory).filter((f) => f.endsWith(".state.json")).map((f) => JSON.parse(readFileSync(f, "utf-8")) as { phase?: string; reinforcementCount?: number; utility?: { injectedCount?: number } });
  const reinforced = states.filter((s) => (s.reinforcementCount ?? 0) > 0);
  check(
    3,
    "a memory that keeps being true is REINFORCED across runs, not rewritten",
    reinforced.length > 0,
    `${String(reinforced.length)} of ${String(states.length)} memories have been reinforced at least once`,
  );

  const injected = states.filter((s) => (s.utility?.injectedCount ?? 0) > 0);
  check(
    3,
    "the store records which memories were actually used, so uselessness can be measured",
    injected.length > 0,
    `${String(injected.length)} memory/memories have been injected at least once`,
  );

  // ─── The verdict ───────────────────────────────────────────────────────────
  console.log("\n════════════════════════════════════════════════════════════════");
  let failed = 0;
  for (const c of [1, 2, 3] as const) {
    const mine = checks.filter((x) => x.criterion === c);
    const bad = mine.filter((x) => !x.ok);
    failed += bad.length;
    console.log(
      `  CRITERION ${String(c)}: ${bad.length === 0 ? "PASS" : "FAIL"}  (${String(mine.length - bad.length)}/${String(mine.length)} checks)`,
    );
    for (const b of bad) console.log(`      failed: ${b.claim} — ${b.saw}`);
  }
  console.log("════════════════════════════════════════════════════════════════");

  if (keep) console.log(`\nworkspace kept: ${root}`);
  else rmSync(root, { recursive: true, force: true });

  process.exit(failed === 0 ? 0 : 1);
}

await main();
