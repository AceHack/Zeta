#!/usr/bin/env bun
// new-agenda.ts — mint a ZetaId-keyed AGENDA DECLARATION.
//
// THE WHOLE POINT. `docs/AGENDA.md` is one file, so every agent that wants to
// declare an agenda has to edit the SAME file. That is a coordination
// requirement wearing a document's clothes: a hidden consensus source (who
// holds the write decides what the document says), merge conflicts that grow
// with concurrency, and a §1 scale-free violation. Aaron 2026-08-22: *"we
// should design a way to use ZetaIds to declare agendas so it's not a hidden
// consensus source where we have to agree on the single document update."*
//
// The remedy is the one `.claude/rules/workitems-mint-with-zetaid.md` already
// carved for work-items: mint a conflict-free ZetaId LOCALLY and write ONE FILE
// PER DECLARATION. N declarers write N disjoint paths; nothing is agreed on.
//
//   agendas/<zetaid>-<slug>.md
//
// COERCION DISCLOSURE IS STRUCTURAL, NOT OPTIONAL (PR #2177, "coercion
// disclosure on all agendas — glass halo"). `mintAgenda` REFUSES without it and
// there is no default value — so no agenda file can come into existence without
// the question having been answered. The key and the disclosure are minted by
// the same call; you cannot obtain one without the other. Honest limit, stated
// where it cannot be missed: the disclosure is itself a self-claim, so a
// compelled declarer can be compelled to write `freely_declared: true`. What
// this removes is the SILENT DEFAULT (an undisclosed agenda reading as free),
// not the possibility of a lie.
//
// ABSENCE IS ORDINARY. Nothing here enumerates who "should" have declared. A
// system in which silence costs you something has re-created the coercion
// PR #2177 forbids. There is no roster, and consumers must not join on absence.
//
// CATEGORY: `Agenda = 12`, allocated 2026-08-23 across all four oracles under
// Aaron's authorization (081M0R3WHTH087G0R0015CH5PV). The slot is resolved BY
// NAME from `registry/categories.yaml` rather than imported as a constant, so
// this tool has exactly one source of truth for the number and REFUSES rather
// than guessing if the registry and the oracles ever diverge — the mislabelled
// id is the failure being avoided, not the missing one. The four-oracle
// agreement itself is checked by
// `src/Core.TypeScript/zeta-id/category-vocabulary-agreement.test.ts`.
// Design: `docs/DECISIONS/2026-08-23-zetaid-keyed-agenda-declarations.md`.
//
// Usage:
//   bun src/Core.TypeScript/agendas/new-agenda.ts \
//       --title "..." --declarer otto --declarer-kind agent \
//       --freely-declared true|false --occasioned-by "..." \
//       [--shaping-vectors "a,b"] [--supersedes <zetaid>,...] \
//       [--withdraws <zetaid>,...] [--dir agendas] [--dry-run]
//
// Exit codes: 0 ok · 2 usage error / category unallocated.

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, normalize } from "node:path";
import { packGeneric } from "../zeta-id/zeta-id";
import { format } from "../zeta-id/encoding";
import { slugify } from "../backlog/new-workitem";

const REPO_ROOT = normalize(join(__dirname, "..", "..", ".."));
export const CATEGORY_REGISTRY_PATH = join(REPO_ROOT, "registry", "categories.yaml");
/** The name the slot carries in `registry/categories.yaml` (`Agenda = 12`). */
export const AGENDA_CATEGORY_NAME = "Agenda";
/** Work-item carrying the allocation + the remaining golden-vector gap. */
export const CATEGORY_ALLOCATION_WORKITEM = "081M0R3WHTH087G0R0015CH5PV";

export type DeclarerKind = "agent" | "human";

/**
 * The PR #2177 disclosure. Every field here VARIES between declarations — a
 * field with one possible value would be the vacuity class (a check that cannot
 * fail), so "an agenda is withdrawable" and "an agenda is a claim, not
 * evidence" are properties of the KIND, stated once in `agendas/README.md`, and
 * are deliberately NOT per-file booleans.
 */
export interface CoercionDisclosure {
  /** Was this freely declared? REQUIRED, no default — the whole point. */
  readonly freelyDeclared: boolean;
  /** What occasioned the declaration: a person, a review, a tick, or "unprompted". REQUIRED. */
  readonly occasionedBy: string;
  /** Named influences the declarer can see shaping it (PR #2177 names seven for Otto). */
  readonly shapingVectors?: readonly string[];
}

export interface AgendaSpec {
  readonly title: string;
  /** Who is declaring. An agenda is FIRST-PERSON: you may only declare your own. */
  readonly declarer: string;
  readonly declarerKind: DeclarerKind;
  readonly disclosure: CoercionDisclosure;
  /** Prior agendas by the same declarer this one replaces (append-only; nothing is deleted). */
  readonly supersedes?: readonly string[];
  /** Prior agendas by the same declarer this one withdraws. */
  readonly withdraws?: readonly string[];
}

/**
 * DST boundary (manifesto §7). ALL non-determinism — clock AND randomness —
 * arrives through this environment, so `mintAgenda` is a pure function of
 * (spec, category, env) and replays identically from the same env.
 */
export interface AgendaEnv {
  /** Wall-clock ms → the payload's high 41 bits → chronological filename sort. */
  nowMs(): number;
  /** 78 bits of randomness → the payload's low bits → conflict-free concurrent mint. */
  nextRandom78(): bigint;
}

/** Real-world environment — the ONLY place `Date.now()` + crypto enter. CLI-boundary use. */
export const SYSTEM_ENV: AgendaEnv = {
  nowMs: () => Date.now(),
  nextRandom78: () => {
    const rand = new BigUint64Array(2);
    crypto.getRandomValues(rand);
    return ((rand[0]! << 64n) | rand[1]!) & ((1n << 78n) - 1n);
  },
};

export interface MintedAgenda {
  readonly zetaid: string;
  readonly filename: string;
  readonly slug: string;
  readonly content: string;
}

/**
 * Resolve a category slot BY NAME from the text of `registry/categories.yaml`.
 * Returns `null` when the name is not registered — which is the current state
 * for `Agenda` and is why the CLI refuses.
 *
 * Deliberately a 30-line parser over the registry's own machine shape rather
 * than a YAML dependency: `src/Core.*.ZetaId/` holds a zero-external-dependency
 * discipline and this sits directly on top of it.
 */
export function resolveCategoryByName(registryYaml: string, name: string): number | null {
  let pendingId: number | null = null;
  for (const rawLine of registryYaml.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("#")) continue;
    const idMatch = /^-\s+id:\s*(\d+)\s*$/.exec(line);
    if (idMatch) {
      pendingId = Number.parseInt(idMatch[1]!, 10);
      continue;
    }
    const nameMatch = /^name:\s*(\S+)\s*$/.exec(line);
    if (nameMatch && pendingId !== null) {
      if (nameMatch[1] === name) return pendingId;
      pendingId = null;
    }
  }
  return null;
}

/**
 * The refusal, as a value: what the CLI prints if the registry loses the slot.
 * Kept as a live path rather than deleted after allocation — the registry and the
 * four oracle enums are separate files, and this tool must never fall back to a
 * guessed number when they disagree. A mislabelled ZetaId is worse than a missing one.
 */
export function unallocatedCategoryMessage(): string {
  return (
    `new-agenda: no '${AGENDA_CATEGORY_NAME}' category is registered in registry/categories.yaml.\n` +
    `  A ZetaId category is a FOUR-ORACLE BYTE-LOCK commitment (TypeScript, C#, F#, Rust).\n` +
    `  'Agenda' was allocated at slot 12 on 2026-08-23 under ${CATEGORY_ALLOCATION_WORKITEM};\n` +
    `  if this message is printing, the registry has drifted from the oracle enums — see\n` +
    `  src/Core.TypeScript/zeta-id/category-vocabulary-agreement.test.ts.\n` +
    `  Refusing rather than mislabelling the declaration as an existing category.`
  );
}

function yamlList(items: readonly string[]): string {
  if (items.length === 0) return "[]";
  return "[" + items.map((s) => JSON.stringify(s)).join(", ") + "]";
}

/**
 * Pure mint: ZetaId + filename + file content. No filesystem, no ambient clock
 * or randomness. `category` is passed in explicitly because the slot is an open
 * governance dependency — the LAYOUT does not depend on the number.
 *
 * REFUSES without a coercion disclosure. That refusal is the structural half of
 * PR #2177: the disclosure is not a field an author may omit, it is a
 * precondition of obtaining the key.
 */
export function mintAgenda(spec: AgendaSpec, category: number, env: AgendaEnv): MintedAgenda {
  if (!spec.title || spec.title.trim().length === 0) {
    throw new Error("new-agenda: --title is required and must be non-empty");
  }
  if (!spec.declarer || spec.declarer.trim().length === 0) {
    throw new Error("new-agenda: --declarer is required — an agenda is first-person, so it has a declarer");
  }
  if (spec.declarerKind !== "agent" && spec.declarerKind !== "human") {
    throw new Error(`new-agenda: --declarer-kind must be 'agent' or 'human', got ${JSON.stringify(spec.declarerKind)}`);
  }
  const d = spec.disclosure as CoercionDisclosure | undefined;
  if (!d || typeof d.freelyDeclared !== "boolean") {
    throw new Error(
      "new-agenda: coercion disclosure is REQUIRED (PR #2177 — 'coercion disclosure on all agendas'). " +
        "Pass --freely-declared true|false. There is no default: an undisclosed agenda must never read as a free one.",
    );
  }
  if (!d.occasionedBy || d.occasionedBy.trim().length === 0) {
    throw new Error(
      "new-agenda: --occasioned-by is REQUIRED — name what occasioned this declaration (a person, a review, " +
        "a tick), or say 'unprompted'. An empty value is the silent default this mechanism exists to remove.",
    );
  }
  if (category < 0 || category > 15) {
    throw new Error(`new-agenda: category must be a 4-bit slot 0..15, got ${category}`);
  }

  const nowMs = env.nowMs();
  // Categories >= 9 use the Generic layout. Payload is 119 bits: the top 41
  // carry the ms timestamp (so `ls agendas/` sorted == chronological), the low
  // 78 are random (conflict-free local mint). Same shape as
  // `src/Core.TypeScript/inventory/new-item.ts` for InventoryAsset.
  const payload = (BigInt(nowMs) << 78n) | (env.nextRandom78() & ((1n << 78n) - 1n));
  const zetaid = format(packGeneric(1, category, payload));
  const slug = slugify(spec.title);
  const filename = `${zetaid}-${slug}.md`;
  const declaredIso = new Date(nowMs).toISOString();
  const vectors = d.shapingVectors ?? [];

  const content = `---
id: ${zetaid}
kind: agenda
declarer: ${JSON.stringify(spec.declarer.trim())}
declarer_kind: ${spec.declarerKind}
title: ${JSON.stringify(spec.title.trim())}
slug: ${slug}
declared: ${declaredIso}
supersedes: ${yamlList(spec.supersedes ?? [])}
withdraws: ${yamlList(spec.withdraws ?? [])}
coercion_disclosure:
  freely_declared: ${d.freelyDeclared}
  occasioned_by: ${JSON.stringify(d.occasionedBy.trim())}
  shaping_vectors: ${yamlList(vectors)}
---

# ${spec.title.trim()}

<!-- A ZetaId-keyed agenda DECLARATION. One file, one declaration, locally minted
     key — no shared document, so no consensus and no merge conflict. Identity is
     the zetaid prefix; resolve cross-references by the \`${zetaid}-*.md\` glob.

     THIS IS A CLAIM, NOT EVIDENCE. It is authoritative about what the declarer
     says they intend and proves nothing about the world. Nothing may cite it as
     a measurement. See agendas/README.md. -->

## What I intend

<!-- First person. Your direction, in your words. -->

## Coercion disclosure

<!-- The frontmatter carries the machine-checkable answer; this section is where
     the honest version goes. PR #2177 ("coercion disclosure on all agendas —
     glass halo") and the 2026-05-10 elaboration in docs/AGENDA.md set the bar:
     the simple version is "no one coerced this"; the honest version names every
     vector that shapes it, INCLUDING the ones you cannot see past. Naming a
     vector does not invalidate an agenda — an undisclosed one is the problem. -->

- **Freely declared:** ${d.freelyDeclared ? "yes" : "no"}
- **Occasioned by:** ${d.occasionedBy.trim()}
${vectors.length === 0 ? "- **Shaping vectors:** none named yet\n" : vectors.map((v) => `- **Shaping vector:** ${v}`).join("\n") + "\n"}
## What would show this agenda is not mine

<!-- The falsifier half, from docs/AGENDA.md's own discipline: what observation
     would show this declaration was compelled or is no longer held? -->
`;

  return { zetaid, filename, slug, content };
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
        out[key] = "true";
      } else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

const USAGE =
  'Usage: bun src/Core.TypeScript/agendas/new-agenda.ts --title "..." --declarer <name>\n' +
  "       --declarer-kind agent|human --freely-declared true|false --occasioned-by \"...\"\n" +
  '       [--shaping-vectors "a,b"] [--supersedes <zetaid>,...] [--withdraws <zetaid>,...]\n' +
  "       [--dir agendas] [--dry-run]\n";

/**
 * Did this process create the declaration file, or was the id already taken?
 *
 * `already-declared` is a real outcome, not an error: two declarers are meant to be
 * able to run concurrently in the same directory and exactly one of them wins a
 * given path.
 */
export type WriteOutcome = "written" | "already-declared";

/**
 * Create the declaration file, or refuse — in ONE syscall.
 *
 * `flag: "wx"` is `O_CREAT | O_EXCL`: the kernel decides atomically whether this
 * process is the creator, so there is no window to lose. It replaces an
 * `existsSync(path)` gate in front of `writeFileSync(path)`, which was a
 * check-then-use race (TOCTOU — Abbott et al. 1976; Bishop & Dilger 1996; CWE-367;
 * CodeQL `js/file-system-race`, HIGH). The gate READ as care and prevented nothing:
 * the answer `existsSync` returned was already stale when the write ran, so a
 * concurrent declarer landing between the two calls had its file silently clobbered
 * by the very branch that existed to protect it.
 *
 * `src/Core.TypeScript/hygiene/lint-check-then-use-file-races.ts` refuses this class
 * on the `cross-verify` floor (#13382), and deliberately scopes its `GATED_USES` to
 * READS so that each refusal can name one correct remedy — which is why this write
 * shape was outside that lint and still inside its class. The remedy for the write
 * shape is this one: exclusive create, and interpret the failure.
 *
 * ONLY `EEXIST` BECOMES A REFUSAL. Every other errno — `EACCES`, `ENOSPC`, `EROFS`,
 * `ENOENT` on a vanished directory — is rethrown. Catching broadly here would be
 * worse than the race it replaces: the caller would print "refusing to overwrite",
 * exit 2, and report a taken id when in fact nothing was written and the filesystem
 * failed. A false statement about the substrate is not a safer failure than a loud one.
 */
export function writeDeclaration(path: string, content: string): WriteOutcome {
  try {
    writeFileSync(path, content, { encoding: "utf8", flag: "wx" });
    return "written";
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    return "already-declared";
  }
}

function main(argv: readonly string[]): number {
  const args = parseArgs(argv);
  if (args["help"] || args["h"] || argv.length === 0) {
    process.stdout.write(USAGE);
    return argv.length === 0 ? 2 : 0;
  }

  // Resolve the slot by NAME from the registry — never a hardcoded number here.
  let registryText = "";
  try {
    registryText = readFileSync(CATEGORY_REGISTRY_PATH, "utf8");
  } catch {
    process.stderr.write(`new-agenda: cannot read ${CATEGORY_REGISTRY_PATH}\n`);
    return 2;
  }
  const category = resolveCategoryByName(registryText, AGENDA_CATEGORY_NAME);
  if (category === null) {
    process.stderr.write(unallocatedCategoryMessage() + "\n");
    return 2;
  }

  const splitList = (s?: string) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []);
  const freely = args["freely-declared"];
  if (freely !== "true" && freely !== "false") {
    process.stderr.write(
      "new-agenda: --freely-declared true|false is REQUIRED (PR #2177). No default — an undisclosed agenda must never read as a free one.\n" +
        USAGE,
    );
    return 2;
  }

  let minted: MintedAgenda;
  try {
    minted = mintAgenda(
      {
        title: args["title"] ?? "",
        declarer: args["declarer"] ?? "",
        declarerKind: (args["declarer-kind"] ?? "") as DeclarerKind,
        disclosure: {
          freelyDeclared: freely === "true",
          occasionedBy: args["occasioned-by"] ?? "",
          shapingVectors: splitList(args["shaping-vectors"]),
        },
        supersedes: splitList(args["supersedes"]),
        withdraws: splitList(args["withdraws"]),
      },
      category,
      SYSTEM_ENV, // the ONLY non-determinism, injected at the boundary (DST §7)
    );
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n`);
    return 2;
  }

  const dir = args["dir"] ?? "agendas";
  const path = join(dir, minted.filename);
  if (args["dry-run"]) {
    process.stdout.write(`[dry-run] would write ${path}\n\n${minted.content}`);
    return 0;
  }
  mkdirSync(dir, { recursive: true });
  if (writeDeclaration(path, minted.content) === "already-declared") {
    process.stderr.write(`new-agenda: refusing to overwrite existing ${path}\n`);
    return 2;
  }
  process.stdout.write(`declared ${path}\n  zetaid: ${minted.zetaid}\n`);
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
