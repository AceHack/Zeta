#!/usr/bin/env bun
// new-workitem.ts — mint a new work-item with a consensus-free ZetaId (081KSXN940008QG0R002FWR9B2).
//
// THE WHOLE POINT (081KSXN940008QG0R002FWR9B2): allocating a sequential `B-NNNN` id requires
// cross-agent consensus (scan origin/main + in-flight PRs for the next free
// number, race peers). That does NOT scale to 500 concurrent agents. This tool
// mints a `Category.WorkItem` ZetaId LOCALLY — 128-bit, crypto-minted, no
// consensus, no origin check, no PR scan — so N agents create work-items with
// zero coordination and zero collision (the 081KSXN940008QG0R00171YAZW agent-bus G-Set property).
//
// FILE SHAPE (decided 2026-06-06, the 500-agent collision test):
//   workitems/<zetaid>-<description>.md
//   • <zetaid> = the canonical Crockford base32 ZetaId (081KS3X9Y0008QG0R000W00V73) — the conflict-free,
//     filename-safe, SORT-PRESERVING key. Because version+timestamp are the ZetaId's
//     high bits, `ls workitems/` sorted == chronological creation order, for free.
//   • <description> = a human-readable slug of the title (rides along; identity is
//     the zetaid PREFIX, so a reword changes only the suffix — resolve by
//     `<zetaid>-*.md` glob).
//
// STATE is the folder (081KSXN940008QG0R002FWR9B2): active items live in `workitems/`; completed ones
// move to `workitems/done/YYYY/MM/<zetaid>-<desc>.md` (a separate complete-workitem
// step). `type ∈ {task,bug}` is frontmatter, immutable. `state` mirrors the folder.
//
// Usage:
//   bun src/Core.TypeScript/backlog/new-workitem.ts --type task --title "Do the thing"
//       [--priority P2] [--depends-on 081KSXN940008QG0R002FWR9B2,<zetaid>] [--composes-with ...]
//       [--persona N] [--dir workitems] [--dry-run]
//
// Exit codes: 0 ok · 2 usage error.

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pack, DEFAULT_ENV } from "../zeta-id/zeta-id";
import { format } from "../zeta-id/encoding";
import { Category, Chromosome, type ZetaObservation } from "../zeta-id/types";
import { makeCreatedEvent, mintWorkItemEventIdHex } from "../work-items/types";
import { writeEvent, maybeGitPushEvent, type WriteResult } from "../work-items/publish";

export type WorkItemType = "task" | "bug";

export interface NewWorkItemSpec {
  readonly title: string;
  readonly type: WorkItemType;
  readonly priority?: string; // default "P2"
  readonly dependsOn?: readonly string[];
  readonly composesWith?: readonly string[];
  readonly persona?: number; // ZetaId persona byte (0 = unspecified)
}

/**
 * DST boundary (manifesto §7 — Deterministic Simulation Testing). ALL
 * non-determinism — the clock AND randomness — is injected through this
 * environment. `mintWorkItem` is a pure function of (spec, env): given the same
 * env it replays identically. `Date.now()` / crypto appear ONLY in `SYSTEM_ENV`,
 * the outermost boundary used by the CLI — never inside the mint logic.
 */
export interface WorkItemEnv {
  /** Current wall-clock in ms (→ ZetaId timestamp high-bits → chronological sort). */
  nowMs(): number;
  /** 64 bits of randomness (→ ZetaId low bits → conflict-free across concurrent minters). */
  nextInt64(): bigint;
}

/** Real-world environment — the ONLY place `Date.now()` + crypto enter. CLI-boundary use. */
export const SYSTEM_ENV: WorkItemEnv = {
  nowMs: () => Date.now(),
  nextInt64: () => DEFAULT_ENV.nextInt64(),
};

export interface MintedWorkItem {
  readonly zetaid: string; // canonical Crockford base32
  readonly filename: string; // <zetaid>-<slug>.md
  readonly slug: string;
  readonly content: string; // full file content
}

/** Slugify a title into a filename-safe, lowercase, hyphenated description.
 *  Keeps only [a-z0-9-]; collapses runs; trims; caps length so paths stay short. */
export function slugify(title: string, maxLen = 60): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen)
    .replace(/-+$/g, "");
  return s.length > 0 ? s : "untitled";
}

function yamlList(items: readonly string[]): string {
  if (items.length === 0) return "[]";
  return "[" + items.map((s) => JSON.stringify(s)).join(", ") + "]";
}

/** Pure mint: produces the ZetaId, filename, and file content — no filesystem, no
 *  ambient clock/randomness. DETERMINISTIC given (spec, env): all non-determinism
 *  arrives via `env` (DST §7). Pass `SYSTEM_ENV` in production; a fixed env in tests. */
export function mintWorkItem(spec: NewWorkItemSpec, env: WorkItemEnv): MintedWorkItem {
  if (!spec.title || spec.title.trim().length === 0) {
    throw new Error("new-workitem: --title is required and must be non-empty");
  }
  if (spec.type !== "task" && spec.type !== "bug") {
    throw new Error(`new-workitem: --type must be 'task' or 'bug', got ${JSON.stringify(spec.type)}`);
  }
  const nowMs = env.nowMs();

  // The work-item identity: a WorkItem-category ZetaId. timestamp -> high bits ->
  // chronological sort; randomness -> collision-free across concurrent minters.
  const obs: ZetaObservation = {
    version: 1,
    timestamp: nowMs as ZetaObservation["timestamp"],
    chromosome: Chromosome.MetaCoherence, // planning lives in the meta-coherence chromosome
    category: Category.WorkItem,
    authority: { type: "Standard" },
    persona: (spec.persona ?? 0) as ZetaObservation["persona"],
    momentum: { type: "Normal" },
    location: 0 as ZetaObservation["location"],
  };

  const id = pack(obs, env);
  const zetaid = format(id);
  const slug = slugify(spec.title);
  const filename = `${zetaid}-${slug}.md`;
  const priority = spec.priority ?? "P2";
  const createdIso = new Date(nowMs).toISOString();

  const content = `---
id: ${zetaid}
type: ${spec.type}
state: backlog
priority: ${priority}
slug: ${slug}
title: ${JSON.stringify(spec.title)}
created: ${createdIso}
depends_on: ${yamlList(spec.dependsOn ?? [])}
composes_with: ${yamlList(spec.composesWith ?? [])}
---

# ${spec.title}

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by \`${zetaid}-*.md\` glob. -->
`;

  return { zetaid, filename, slug, content };
}

/** Event G-Set root co-located with the work-item markdown tree. */
export function workItemEventsRoot(workItemsDir: string): string {
  return join(workItemsDir, "events");
}

/** Append a WorkItemCreated fact to the event G-Set (081KSXN940008QG0R002FWR9B2). */
export function publishCreatedEvent(
  minted: MintedWorkItem,
  spec: NewWorkItemSpec,
  env: WorkItemEnv,
  by: string,
  eventsRoot?: string,
  push = false,
): WriteResult {
  const atMs = env.nowMs();
  const event = makeCreatedEvent(
    {
      workItemId: minted.zetaid,
      type: spec.type,
      title: spec.title.trim(),
      slug: minted.slug,
      priority: spec.priority ?? "P2",
      filename: minted.filename,
    },
    by,
    atMs,
    (ms) => mintWorkItemEventIdHex(env, ms),
  );
  const result = writeEvent(event, eventsRoot);
  maybeGitPushEvent(result, event, by, push);
  return result;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        out[key] = "true"; // boolean flag
      } else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

function main(argv: readonly string[]): number {
  const args = parseArgs(argv);
  if (args["help"] || args["h"] || argv.length === 0) {
    process.stdout.write(
      "Usage: bun src/Core.TypeScript/backlog/new-workitem.ts --type task|bug --title \"...\"\n" +
        "       [--priority P2] [--depends-on a,b] [--composes-with a,b] [--persona N] [--dir workitems] [--dry-run]\n",
    );
    return argv.length === 0 ? 2 : 0;
  }
  const title = args["title"];
  const type = args["type"] as WorkItemType | undefined;
  if (!title || (type !== "task" && type !== "bug")) {
    process.stderr.write("new-workitem: --type (task|bug) and --title are required\n");
    return 2;
  }
  const splitList = (s?: string) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []);

  let minted: MintedWorkItem;
  let spec: NewWorkItemSpec;
  try {
    // Build the spec omitting absent optionals (exactOptionalPropertyTypes: do not
    // pass explicit `undefined` to optional fields).
    spec = {
      title,
      type,
      dependsOn: splitList(args["depends-on"]),
      composesWith: splitList(args["composes-with"]),
      ...(args["priority"] ? { priority: args["priority"] } : {}),
      ...(args["persona"] ? { persona: Number(args["persona"]) } : {}),
    };
    minted = mintWorkItem(
      spec,
      SYSTEM_ENV, // the ONLY non-determinism, injected at the boundary (DST §7)
    );
  } catch (e) {
    process.stderr.write(`new-workitem: ${(e as Error).message}\n`);
    return 2;
  }

  const dir = args["dir"] ?? "workitems";
  const path = join(dir, minted.filename);
  const push = args["push"] === "true";

  if (args["dry-run"]) {
    process.stdout.write(`[dry-run] would write ${path}\n\n${minted.content}`);
    return 0;
  }

  mkdirSync(dir, { recursive: true });
  if (existsSync(path)) {
    // Astronomically unlikely (128-bit id) — but never clobber.
    process.stderr.write(`new-workitem: refusing to overwrite existing ${path}\n`);
    return 2;
  }
  writeFileSync(path, minted.content, "utf8");
  const actor = process.env.ZETA_WORKITEM_ACTOR ?? "otto-cli";
  const eventResult = publishCreatedEvent(minted, spec, SYSTEM_ENV, actor, workItemEventsRoot(dir), push);
  if (eventResult.kind === "collision") {
    process.stderr.write(`new-workitem: event collision at ${eventResult.path}\n`);
    return 1;
  }
  process.stdout.write(`created ${path}\n  zetaid: ${minted.zetaid}\n  event: ${eventResult.path}\n`);
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
