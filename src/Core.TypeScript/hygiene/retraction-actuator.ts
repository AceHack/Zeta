#!/usr/bin/env bun
// retraction-actuator.ts — the sovereign edge for episode-protocol.ts
// (workitem 081KZHGP45V, final piece; consent: RFC round 2026-08-10 —
// Vera+Riven builder assents, Lior/Soraya conditions folded in, operator
// word "lets do it"). ALL decisions live in the proven state machine; this
// edge only GATHERS facts, STEPS the machine, and EXECUTES its commands.
//
// Per sovereign doctrine the command is push_retraction: a `git revert`
// commit pushed directly to main. Known trap handled: GITHUB_TOKEN pushes
// do not trigger workflows, so after pushing the edge DISPATCHES gate.yml
// on main and the next tick's post_push_gate event reads build-and-test
// check-runs on the pushed head by SHA (any event type).
//
// Fact-gathering (pure functions over plain data; the CLI fetches):
//   openTicks   — trailing sweeps whose findings include BD001 (ledger).
//   isolation   — commits between the last green gate push-run head and
//                 the first red one; unique iff exactly one.
//   in-flight   — any queued/in-progress gate push-run, OR main has moved
//                 beyond the first-red head (someone acted; stand down and
//                 re-evaluate next tick — conservative by design).
//   vector-touch— the breaking commit's own paths against the byte-lock
//                 contract patterns (the revert touches the same paths).
//
// Episode bookkeeping: docs/drift-events/retraction-episodes.json
// ({ [episodeId]: { machine: EpisodeState, pushedSha?, updatedTick } }),
// committed by the sweep workflow's existing bookkeeping step. The author
// notification letter is written to docs/letters/ and rides the same
// bookkeeping commit (Riven-2: recipe verbatim).

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { readLedger } from "./drift-ledger.ts";
import { IDLE, step, type EpisodeEvent, type EpisodeState } from "./episode-protocol.ts";

// ── Pure fact computations ──────────────────────────────────────────────────

/** Trailing consecutive sweeps whose findings include a BD001 entry. */
export function bd001OpenTicks(ledger: ReadonlyArray<{ readonly tick: number; readonly findings: ReadonlyArray<{ readonly rule: string }> }>): number {
  const sorted = [...ledger].sort((a, b) => a.tick - b.tick);
  let n = 0;
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (sorted[i]!.findings.some((f) => f.rule === "BD001")) n += 1;
    else break;
  }
  return n;
}

export interface GateRunFact {
  readonly headSha: string;
  readonly conclusion: string | null; // "success" | "failure" | null (running)
}

/** From newest-first push-run facts: the first red run after the last green,
 * with its predecessor green head — or null when the picture is not clean. */
export function isolateBreak(runsNewestFirst: readonly GateRunFact[]): { readonly redHead: string; readonly greenHead: string } | null {
  const completed = runsNewestFirst.filter((r) => r.conclusion === "success" || r.conclusion === "failure");
  if (completed.length === 0 || completed[0]!.conclusion !== "failure") return null; // newest completed must be red
  let redHead = completed[0]!.headSha;
  for (const r of completed.slice(1)) {
    if (r.conclusion === "failure") { redHead = r.headSha; continue; } // walk to the FIRST red
    return { redHead, greenHead: r.headSha };
  }
  return null; // no green in window
}

export const VECTOR_PATTERNS = [/golden-vectors[^/]*\.json$/, /^tests\/cross-verification\//];

export function touchesVectors(paths: readonly string[]): boolean {
  return paths.some((p) => VECTOR_PATTERNS.some((re) => re.test(p)));
}

// ── Edge state ──────────────────────────────────────────────────────────────

interface EpisodeRecord {
  readonly machine: EpisodeState;
  readonly pushedSha?: string;
  readonly updatedTick: number;
}
type EpisodeFile = Record<string, EpisodeRecord>;

const EPISODES_PATH = "docs/drift-events/retraction-episodes.json";

function readEpisodes(): EpisodeFile {
  if (!existsSync(EPISODES_PATH)) return {};
  return JSON.parse(readFileSync(EPISODES_PATH, "utf8")) as EpisodeFile;
}

function writeEpisodes(e: EpisodeFile): void {
  const sorted = Object.fromEntries(Object.entries(e).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  writeFileSync(EPISODES_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
}

// ── IO shell ────────────────────────────────────────────────────────────────

function sh(cmd: string): string {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

async function gh(path: string): Promise<unknown> {
  const token = process.env["GH_TOKEN"];
  const repo = process.env["REPO"];
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`gh ${path}: ${String(res.status)}`);
  return res.json();
}

const invokedDirectly = typeof process.argv[1] === "string" && /retraction-actuator\.(?:ts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  const repo = process.env["REPO"];
  if (!process.env["GH_TOKEN"] || !repo) {
    console.error("retraction-actuator: GH_TOKEN and REPO required");
    process.exit(2);
  }

  const ledger = readLedger("docs/drift-events");
  const openTicks = bd001OpenTicks(ledger);
  const latestTick = ledger.reduce((m, e) => Math.max(m, e.tick), 0);
  console.log(`actuator: BD001 open ${String(openTicks)} consecutive tick(s) at tick ${String(latestTick)}`);

  const runsRaw = (await gh("/actions/workflows/gate.yml/runs?branch=main&event=push&per_page=15")) as {
    workflow_runs: { head_sha: string; status: string; conclusion: string | null }[];
  };
  const anyRunning = runsRaw.workflow_runs.some((r) => r.status !== "completed");
  const runs: GateRunFact[] = runsRaw.workflow_runs.map((r) => ({ headSha: r.head_sha, conclusion: r.conclusion }));
  const iso = isolateBreak(runs);

  const episodes = readEpisodes();
  const episodeId = iso ? `ep-${iso.redHead.slice(0, 9)}` : latestTick > 0 ? `ep-tick-${String(latestTick)}` : "ep-none";
  const rec: EpisodeRecord = episodes[episodeId] ?? { machine: IDLE, updatedTick: latestTick };
  let machine = rec.machine;
  let pushedSha = rec.pushedSha;

  // Post-push validation first, if we previously pushed (post_push_gate by SHA).
  if (machine.kind === "landed" && pushedSha !== undefined) {
    const checks = (await gh(`/commits/${pushedSha}/check-runs?per_page=100`)) as {
      check_runs: { name: string; status: string; conclusion: string | null }[];
    };
    const legs = checks.check_runs.filter((c) => c.name.startsWith("build-and-test"));
    if (legs.length > 0 && legs.every((c) => c.status === "completed")) {
      const pass = legs.every((c) => c.conclusion === "success");
      const r = step(episodeId, machine, { kind: "post_push_gate", tick: latestTick, pass });
      machine = r.state;
      console.log(`actuator: post_push_gate pass=${String(pass)} → ${machine.kind} (${r.command.kind})`);
    } else {
      console.log("actuator: post-push gate still running — nothing to do this tick");
    }
  }

  // Heal observed while attempted → stand down (Vera-2 sovereign form).
  if (machine.kind === "attempted" && openTicks === 0) {
    const r = step(episodeId, machine, { kind: "sweep_healed", tick: latestTick });
    machine = r.state;
    console.log(`actuator: healed before landing → ${machine.kind}`);
  }

  // Trigger evaluation.
  if (machine.kind === "idle" && iso !== null) {
    const mainHead = sh("git rev-parse origin/main");
    const fleetInFlight = anyRunning || mainHead !== iso.redHead;
    const candidates = sh(`git rev-list ${iso.greenHead}..${iso.redHead}`).split("\n").filter(Boolean);
    const single = candidates.length === 1 ? candidates[0]! : null;
    const paths = single === null ? [] : sh(`git diff-tree --no-commit-id --name-only -r ${single}`).split("\n").filter(Boolean);
    const author = single === null ? "unknown" : sh(`git log -1 --format=%an ${single}`);
    const event: EpisodeEvent = {
      kind: "break_detected",
      tick: latestTick,
      openTicks,
      candidateShas: single === null ? candidates : [single],
      fleetHealInFlight: fleetInFlight,
      touchesVectorContracts: touchesVectors(paths),
      authorPersona: author,
    };
    const r = step(episodeId, machine, event);
    machine = r.state;
    console.log(`actuator: break_detected → ${machine.kind} (${r.command.kind}: ${"reason" in r.command ? r.command.reason : r.command.breakSha})`);

    if (r.command.kind === "push_retraction") {
      const sha = r.command.breakSha;
      sh(`git config user.name "github-actions[bot]"`);
      sh(`git config user.email "github-actions[bot]@users.noreply.github.com"`);
      sh("git fetch origin main");
      sh("git checkout -B retraction-work origin/main");
      try {
        sh(`git revert --no-edit ${sha}`);
        sh("git push origin HEAD:main");
        pushedSha = sh("git rev-parse HEAD");
        const pr = step(episodeId, machine, { kind: "push_result", tick: latestTick, pushed: true });
        machine = pr.state;
        console.log(`actuator: retraction pushed ${pushedSha.slice(0, 9)} (reverts ${sha.slice(0, 9)})`);
        // Bot pushes don't trigger workflows — dispatch the gate on main.
        await fetch(`https://api.github.com/repos/${repo}/actions/workflows/gate.yml/dispatches`, {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env["GH_TOKEN"]}`, Accept: "application/vnd.github+json" },
          body: JSON.stringify({ ref: "main" }),
        });
        // Riven-2: the letter, recipe verbatim.
        const letter = `docs/letters/to-${r.command.notifyAuthor.persona.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-retraction-${sha.slice(0, 9)}.md`;
        writeFileSync(letter, [
          `# Retraction notice — ${sha.slice(0, 9)} (episode ${episodeId})`,
          "",
          `Your commit ${sha.slice(0, 9)} was retracted by the sovereign`,
          "auto-revert healer: main's build-and-test was red for",
          `${String(openTicks)} consecutive tick(s) with no fleet heal in flight.`,
          "A retraction is a retraction of bytes, never a judgment of the",
          "lane. Re-land is one command:",
          "",
          "```bash",
          r.command.notifyAuthor.relandRecipe,
          "```",
          "",
          "— the retraction actuator (081KZHGP45V), on behalf of the fleet",
          "",
        ].join("\n"));
        console.log(`actuator: letter written ${letter}`);
      } catch (err) {
        const pr = step(episodeId, machine, { kind: "push_result", tick: latestTick, pushed: false });
        machine = pr.state;
        console.log(`actuator: push failed → ${machine.kind}: ${(err as Error).message.slice(0, 200)}`);
      } finally {
        sh("git checkout --detach origin/main 2>/dev/null || true");
      }
    }
  } else if (machine.kind === "idle") {
    console.log("actuator: no clean red/green picture — nothing to do");
  }

  const next: EpisodeFile = { ...episodes, [episodeId]: { machine, updatedTick: latestTick, ...(pushedSha !== undefined ? { pushedSha } : {}) } };
  // Persist only meaningful state: never mint brand-new idle records (one
  // per tick of quiet would be ledger noise, not bookkeeping).
  if (episodeId !== "ep-none" && (machine.kind !== "idle" || episodes[episodeId] !== undefined)) writeEpisodes(next);
  console.log(`actuator: episode ${episodeId} → ${machine.kind}`);
  process.exit(0);
}
