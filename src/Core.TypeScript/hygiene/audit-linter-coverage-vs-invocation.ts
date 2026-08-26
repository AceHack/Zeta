#!/usr/bin/env bun
// audit-linter-coverage-vs-invocation.ts — a configured linter must be an INVOKED linter,
// and an invoked linter must examine a non-empty corpus.
//
// THE CLASS THIS CLOSES. A linter is present, configured, believed to be checking a file,
// and does not examine it -- while the invocation exits 0. Every instance produces a check
// that did not run and looks like a check that passed. Three instances were found by hand
// on 2026-08-24 alone, which is the argument for a machine:
//
//   1. `bunx markdownlint-cli2 docs/research/2026-*.md` exits 0 with zero output whether
//      the file is clean or not, because `docs/research/2026-*-*.md` is in the config's
//      `ignores`. Proven by control: byte-identical sabotaged content exits 1 outside the
//      glob and 0 -- silently, no "0 files" note -- inside it. Agents quoted that rc=0 as
//      evidence about files that were never linted.
//   2. eslint / prettier / stylelint configured, pinned, named in CI, invoked nowhere
//      (081M0RBXF6J087G0R0023EX9X2). The eslint half is now closed on 24+1 paths.
//   3. `prettier --check` fails on 81 files under `tools/setup/persona-keys/**` on `main`,
//      and nothing gates it.
//
// The prior art in this repo is `lint:markdown` linting ZERO files and exiting 0 for months
// (#10712), and the three separate "a check that exists and is wired to nothing" notes in
// the `lint (bash retirement inventory)` job that hosts this audit. Prose about the class
// regenerates the class; this file is the machine.
//
// WHAT THIS AUDIT IS NOT. It does not turn any linter on, does not widen any glob, does not
// remove a carve-out, and does not add one. Every carve-out below may be deliberate. The
// audit's whole job is to make the blindness LEGIBLE and to fail when it CHANGES -- what to
// do about each instance is the maintainer's call, and this file records the measured cost
// so that call has numbers under it.
//
// FOUR CHECKS.
//
//   1 SCRIPT INVOCATION PARITY. Every `lint:` / `format:` / `hygiene:` / `typecheck` script
//     in package.json is either invoked by a workflow (by script name OR by the path it
//     shells) or is named in DECLARED_UNINVOKED with a reason. BOTH directions fail: a new
//     uninvoked script goes red, and a script that starts being invoked while still listed
//     as uninvoked goes red too. A ledger that only fails one way is a suppression list.
//
//   2 TOOL INVOCATION PARITY. Every linting tool DISCOVERED in the tree -- through three
//     independent recognizer routes, not a hand-kept list -- must be claimed by a row in
//     TOOLS, and its declared disposition must match the workflows. `gated` with no
//     invocation is red (the tool's CI wiring vanished). `ungated` with an invocation is
//     also red (good news the ledger is lying about). An unclaimed discovery is red: that
//     is instance #4, caught by machine.
//
//   3 EXAMINED-CORPUS FLOORS. An exit 0 from an invocation that examined ZERO files must
//     not be indistinguishable from one that examined many and found nothing. Every `gated`
//     tool declares a floor on the corpus its CI invocation actually reaches, measured from
//     the tracked tree here. The markdownlint floor is measured through markdownlint-cli2's
//     OWN glob-and-ignore resolution -- a probe rule that reports every file the linter
//     opened -- so it cannot drift from what the gate really lints.
//
//   4 EXCLUSION-LIST PARITY. `tsconfig.json#exclude` and `eslint.config.ts#ignorePatterns`
//     are two lists of the same fact -- "which trees are not TypeScript we typecheck" --
//     maintained separately, with nothing checking they agree. Same class one level up.
//     The divergence set must equal the declared one EXACTLY, so a new divergence is red
//     and a repaired one is red until the ledger admits it. Shape borrowed from
//     `audit-dotnet-pin-parity.ts`.
//
// SELF-BLINDNESS. An enumerating check is exactly the shape that goes blind, so this one
// carries the discipline it audits: each discovery route and each corpus it gathers has its
// own floor, and a route that stops recognizing anything fails NAMING itself rather than
// reporting a shorter roster as though the class had shrunk. Inherited from
// `audit-scan-floor-routes.ts`, which exists because an `rg`-shelling guard once inspected
// zero files on a runner where `rg` is not installed.
//
// FLOOR VALUES ARE HALF THE CORPUS MEASURED AT LANDING, and that choice is stated rather
// than tuned. The failure being detected is a COLLAPSE -- a glob that stops matching, a
// tool that scans nothing -- not a drift. Half is the largest single-step reduction ordinary
// churn plausibly produces, so it detects the collapse while leaving room for legitimate
// deletion. It is deliberately NOT a ratchet on the exact count: a floor that fails on
// every deletion gets raised by whoever is annoyed by it, and a floor nobody believes is a
// blind instrument again.
//
// DST: pure function of the tracked file tree plus one markdownlint-cli2 probe over it. No
// clock, no network, no randomness. Output is ordinal-sorted throughout.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-linter-coverage-vs-invocation.ts
//   bun src/Core.TypeScript/hygiene/audit-linter-coverage-vs-invocation.ts --json
//
// Exit codes:
//   0  coverage and invocation agree everywhere the ledger says they should
//   1  usage error, or a declared file is missing
//   3  divergence -- a linter's configured coverage and its CI invocation disagree

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { CROSS_VERIFY_AUDITS, CROSS_VERIFY_ROSTER_PATH } from "../ci/cross-verify-roster.ts";
import { join } from "node:path";

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────

export interface Finding {
  readonly ok: boolean;
  readonly check: string;
  readonly message: string;
}

/** A linting tool the repository configures. */
export interface ToolRow {
  readonly id: string;
  /** One line: what coverage this tool is CONFIGURED for. */
  readonly coverage: string;
  /**
   * Files that define this tool's coverage. Every one must exist -- a ledger row
   * pointing at a deleted config is a row describing a tool that is no longer there.
   */
  readonly configFiles: readonly string[];
  /**
   * Discovery tokens this row CLAIMS. A token found by any route and claimed by no row
   * is an undeclared linter, which is the whole point of the discovery half.
   */
  readonly claims: readonly string[];
  /**
   * Substrings whose presence in a workflow `run:` body means "this tool ran".
   * Chosen to be specific enough that a comment mentioning the tool does not count --
   * see `runBodies`, which strips comment lines before matching.
   */
  readonly invokedBy: readonly string[];
  readonly disposition: "gated" | "ungated";
  /** For `gated` rows: the corpus its CI invocation reaches, and the floor under it. */
  readonly corpus?: { readonly floor: number; readonly how: string };
  /**
   * What the current disposition COSTS, measured. For `ungated` rows this is the size of
   * the hole. For `gated` rows with carve-outs it is the size of the blind set. Numbers
   * are measured, dated, and reproducible from the commands in the PR body -- never
   * estimated, because an estimated cost is how a carve-out survives review.
   */
  readonly cost: string;
}

// ───────────────────────────────────────────────────────────────────────────────
// The ledger
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Measured on c8b23f023, 2026-08-24, by the commands recorded in the landing PR.
 *
 * NOTHING HERE IS A PROPOSAL. Each `ungated` row is a hole this audit refuses to let
 * close silently; whether to fill it is a separate, maintainer-owned decision, and two of
 * them (prettier, stylelint) would redden `main` across five figures of findings if simply
 * switched on. The cost strings exist so that decision is made against numbers.
 */
export const TOOLS: readonly ToolRow[] = [
  {
    id: "markdownlint",
    coverage: "`**/*.md` minus the `ignores` array in .markdownlint-cli2.jsonc",
    configFiles: [".markdownlint-cli2.jsonc"],
    claims: ["markdownlint-cli2", ".markdownlint-cli2.jsonc", "lint:markdown"],
    invokedBy: ["markdownlint-cli2"],
    disposition: "gated",
    corpus: { floor: 1400, how: "files markdownlint-cli2 itself reports opening for `**/*.md`" },
    cost:
      "GATED BUT LARGELY BLIND. 2,843 of 19,612 tracked .md files are examined; 16,847 are " +
      "carved out. Linting the blind set with the same rule config finds 4,634 files with " +
      "18,715 findings. Largest carve-outs by hidden findings: docs/history/pr-reviews/** " +
      "(3,620 files / 8,291 findings), memory/** (229 / 5,820), docs/pr-discussions/** " +
      "(335 / 1,711), docs/amara-full-conversation/** (10 / 1,387), docs/research/2026-*-*.md " +
      "(296 / 1,220), workitems/081*.md (45 / 62). Most are deliberate verbatim-preservation " +
      "carve-outs with rationale in the config; the two that cost agents real time today are " +
      "the research and workitem globs, because those directories are WRITTEN to daily and a " +
      "clean rc=0 on a file inside them reads as a passing check.",
  },
  {
    id: "eslint",
    coverage: "`**/*.ts` minus eslint.config.ts#ignorePatterns; CI narrows to a measured-clean roster",
    configFiles: ["eslint.config.ts"],
    claims: ["eslint", "eslint.config.ts", "lint:eslint", "@eslint/js", "typescript-eslint", "eslint-plugin-sonarjs"],
    invokedBy: ["lint:eslint", "eslint src/apps/twitch-ai"],
    disposition: "gated",
    corpus: { floor: 51, how: "tracked .ts under the `lint:eslint` roster paths" },
    cost:
      "GATED ON A ROSTER, NOT ON THE CONFIG'S COVERAGE. The config's own coverage is 3,005 " +
      "tracked .ts files; CI runs it on 102 (the roster) plus 5 (twitch-ai). The remaining " +
      "~2,900 measured 19,685 errors repo-wide, which is why the roster exists and why " +
      "widening is a measured, per-path decision rather than a flip.",
  },
  {
    id: "prettier",
    coverage: "`**/*.{json,jsonc,md,markdown,ts,toml,yml,yaml,css}` minus .prettierignore",
    configFiles: [".prettierrc.json", ".prettierignore"],
    claims: ["prettier", "prettier-plugin-toml", ".prettierrc.json", ".prettierignore", "format:check", "format:write"],
    invokedBy: ["format:check", "prettier --check", "prettier --write"],
    disposition: "ungated",
    cost:
      "CONFIGURED, PINNED, INVOKED NOWHERE. 31,020 tracked files are in scope after " +
      ".prettierignore; 20,354 of them fail `--check` today (17,095 .md, 1,818 .ts, 1,293 " +
      ".json, 99 .yaml, 31 .yml, 14 .css, 3 parse errors). Turning it on as a gate reddens " +
      "`main` immediately. The 81 failing files under tools/setup/persona-keys/** are the " +
      "narrow slice already noticed by hand -- a per-path roster, the way eslint was widened, " +
      "is the shape that would work here.",
  },
  {
    id: "stylelint",
    coverage: "`**/*.css` minus .stylelintignore (which excludes the website boundary by design)",
    configFiles: [".stylelintrc.json", ".stylelintignore"],
    claims: ["stylelint", ".stylelintrc.json", ".stylelintignore", "lint:css", "stylelint-config-standard"],
    invokedBy: ["lint:css", "stylelint "],
    disposition: "ungated",
    cost:
      "CONFIGURED, PINNED, INVOKED NOWHERE. 16 .css files in scope (of 18 tracked; the " +
      "website boundary is excluded on purpose per the 2026-06-10 style inversion), 15 of " +
      "them error, 6,771 errors total -- 6,124 of those in the two copies of the Iris " +
      "design-system bundle, which is generated and arguably belongs in .stylelintignore. " +
      "Note the script carries `--allow-empty-input`, which is precisely the flag that turns " +
      "an empty corpus into an exit 0.",
  },
  {
    id: "cspell",
    coverage: "cspell.json exists and configures a dictionary; no glob is bound to it",
    configFiles: ["cspell.json"],
    claims: ["cspell", "cspell.json"],
    invokedBy: ["cspell "],
    disposition: "ungated",
    cost:
      "CONFIG WITH NO CONSUMER. cspell is not a devDependency, has no package.json script, " +
      "and appears in no workflow -- the config file is the only trace of it. Cost of the " +
      "hole is unmeasurable without choosing a corpus, which is itself the finding: there " +
      "is no coverage to compare an invocation against.",
  },
  {
    id: "tsc",
    coverage: "`include: **/*.ts` minus tsconfig.json#exclude",
    configFiles: ["tsconfig.json"],
    claims: ["tsconfig.json", "typescript", "typecheck", "tsc"],
    invokedBy: ["lint/lint-typescript.ts", "run typecheck"],
    disposition: "gated",
    corpus: { floor: 1193, how: "tracked .ts not matched by tsconfig.json#exclude" },
    cost: "GATED, NO GAP. 2,386 of 3,011 tracked .ts files typecheck; the 625 excluded are the declared trees.",
  },
  {
    id: "semgrep",
    coverage: ".semgrep-floor.yml (blocking) + .semgrep.yml (drift), minus .semgrepignore",
    configFiles: [".semgrep.yml", ".semgrep-floor.yml", ".semgrepignore"],
    claims: ["semgrep", ".semgrep.yml", ".semgrep-floor.yml", ".semgrepignore"],
    invokedBy: ["semgrep --config"],
    disposition: "gated",
    corpus: { floor: 8, how: "rules across .semgrep-floor.yml and .semgrep.yml" },
    cost:
      "GATED. 17 rules over 33,988 of 44,154 tracked files; .semgrepignore hides docs/history/, " +
      "docs/recovered-orphan-branches-2026-05/ and genesis/ (10,166 files), all verbatim or " +
      "vendored surfaces with the rationale on file.",
  },
  {
    id: "actionlint",
    coverage: ".github/workflows/*.yml",
    configFiles: [".github/workflows"],
    claims: ["actionlint"],
    invokedBy: ["actionlint -"],
    disposition: "gated",
    corpus: { floor: 37, how: "tracked .github/workflows/*.yml|*.yaml" },
    cost: "GATED, NO GAP. All 75 workflow files are linted.",
  },
  {
    id: "shellcheck",
    coverage: "`find tools -name '*.sh'`",
    configFiles: [".github/workflows/gate.yml"],
    claims: ["shellcheck"],
    invokedBy: ["shellcheck --format"],
    disposition: "gated",
    corpus: { floor: 11, how: "tracked tools/**/*.sh" },
    cost:
      "GATED WITH A REAL GAP. 23 of 37 tracked .sh files are checked. The 14 outside tools/ " +
      "are never shellchecked: 6 are in docs/recovered-orphan-branches-2026-05/ (verbatim, " +
      "fine), 1 in db/ -- but full-ai-cluster/usb-nixos-installer/ (2), .gemini/service/ (2), " +
      "and scripts/hooks/ (1) are live scripts outside the glob. The job ALSO carries an " +
      "explicit `if [ ${#files[@]} -eq 0 ]; then echo 'no shell scripts found'; exit 0; fi` " +
      "-- an in-tree instance of the exact sub-case check 3 exists to refuse.",
  },
  {
    id: "dotnet-format",
    coverage: "Zeta.sln (F# whitespace + C# style)",
    configFiles: ["Zeta.sln", ".editorconfig"],
    claims: ["dotnet format", ".editorconfig", "Zeta.sln"],
    invokedBy: ["lint/lint-fsharp.ts", "lint/lint-csharp.ts"],
    disposition: "gated",
    corpus: { floor: 43, how: "Project( entries in Zeta.sln" },
    cost: "GATED, NO GAP MEASURED. 86 projects in the solution; a project outside the .sln would be invisible, hence the floor.",
  },
  {
    id: "ruff-mypy",
    coverage: "src/Core.Python (uv workspace)",
    configFiles: ["src/Core.Python/pyproject.toml"],
    claims: ["ruff", "mypy"],
    invokedBy: ["lint/lint-python.ts"],
    disposition: "gated",
    corpus: { floor: 9, how: "tracked src/Core.Python/**/*.py" },
    cost:
      "GATED WITH A REAL GAP. 18 of 52 tracked .py files are linted. The 34 outside " +
      "src/Core.Python are never checked: 18 in docs/research/scripts/, 10 cross-verification " +
      "generators, plus tools/mutation, tools/dora, src/Core.QSharp.ReferenceOracle, " +
      "src/Core.Lean4 and one file at the repo root.",
  },
  {
    id: "gofmt-golangci",
    coverage: "src/Core.Go",
    configFiles: ["src/Core.Go/go.mod"],
    claims: ["gofmt", "golangci-lint"],
    invokedBy: ["lint/lint-go.ts"],
    disposition: "gated",
    corpus: { floor: 9, how: "tracked src/Core.Go/**/*.go" },
    cost:
      "GATED WITH A REAL GAP. 19 of 31 tracked .go files are linted. The 12 outside " +
      "src/Core.Go are never checked -- notably the hat-system operator under " +
      "full-ai-cluster/k8s/applications/hat-system/operator/ (3 files) and src/wasm-dla/go.",
  },
  {
    id: "cargo-fmt-clippy",
    coverage: "every Cargo.toml found by walking src/",
    configFiles: ["src"],
    claims: ["cargo fmt", "cargo clippy", "clippy"],
    invokedBy: ["lint/lint-rust.ts"],
    disposition: "gated",
    corpus: { floor: 18, how: "tracked src/**/Cargo.toml" },
    cost: "GATED, NO GAP TODAY. All 36 tracked Cargo.toml files are under src/; a crate added outside src/ would be invisible.",
  },
];

/**
 * package.json scripts that no workflow invokes, with the reason each is acceptable.
 *
 * Measured on c8b23f023. This list is checked in BOTH directions: an uninvoked script
 * missing from it fails, and a listed script that has started being invoked fails too.
 * The second direction is what stops it becoming a suppression list -- a ledger you can
 * only add to is a place findings go to be forgotten.
 *
 * PROVEN IN ANGER, 2026-08-24. Two rows left here as `A GENUINE HOLE` --
 * `hygiene:no-culture-sensitive-collation` and `hygiene:mise-pin-parity` -- were wired into
 * gate.yml's `lint-bash-retirement-inventory` job. This audit did NOT go stale: the second
 * direction went red (exit 3) naming both, and stayed red until the rows were deleted. That
 * is the whole point of checking both ways, and it is the first time it fired on a real fix
 * rather than on a fixture. A coverage audit that does not notice its own findings being
 * closed is the vacuity class it was built to catch, one level up.
 */
export const DECLARED_UNINVOKED: Readonly<Record<string, string>> = {
  "format:check": "prettier -- see the TOOLS row; turning it on reddens main on 20,354 files",
  "format:write": "the write half of the above; a formatter, never a gate",
  "lint:css": "stylelint -- see the TOOLS row; 15 of 16 files error today",
  "lint:markdown":
    "the TOOL is gated -- gate.yml shells `bunx markdownlint-cli2` directly rather than through " +
    "this script name. The script is the laptop/devcontainer mirror (GOVERNANCE 24), so it is " +
    "uninvoked-by-name while the tool it wraps is fully invoked.",
  "hygiene:fix-markdown": "a fixer, not a check; the healer workflow calls its path, not this name",
  "hygiene:sort-tick-history": "a canonicalizer, not a check",
  "hygiene:measure-shell-key-exposure": "a measurement, no pass/fail verdict to gate on",
};

/**
 * `tsconfig.json#exclude` entries with no counterpart in `eslint.config.ts#ignorePatterns`,
 * canonicalized (a leading `**\/` and a trailing `/**` are noise for "which tree").
 *
 * Measured on c8b23f023: these 11 patterns cover 619 tracked .ts files that eslint would
 * lint and tsc will not admit to its program -- so every one is a guaranteed typed-linting
 * parse error the moment the eslint roster widens over them. The divergence set must match
 * EXACTLY: a new divergence fails, and a repaired one fails until this list admits it.
 *
 * The eslint-only direction is empty today and the audit requires it to stay empty: an
 * eslint ignore with no tsconfig counterpart would mean a tree tsc typechecks that eslint
 * refuses to look at, which is the same defect pointing the other way.
 */
export const DECLARED_EXCLUDE_DIVERGENCE: readonly string[] = [
  "agentic-organization",
  "db",
  "demo/identity-dla-site",
  "dist",
  "docs/recovered-orphan-branches-2026-05",
  "full-ai-cluster/portal/web",
  "src/Core.TypeScript/cursor",
  "src/Core.TypeScript/qsharp-oracle",
  "src/Renderers/website",
  "src/wasm-dla",
  "src/wasm-dla/assemblyscript/assembly",
];

/** Floors on the audit's OWN corpora. A route that recognizes nothing must say so. */
export const ROUTE_FLOORS = {
  /** package.json scripts matching the lint/format/hygiene/typecheck shape. */
  scripts: 10,
  /** workflow files whose `run:` bodies are searched for invocations. */
  workflows: 37,
  /** discovery route A: third-party binaries shelled by lint-family scripts. */
  discoveryScripts: 3,
  /** discovery route B: devDependencies whose name looks like a linter. */
  discoveryDevDeps: 3,
  /** discovery route C: root-level files whose name looks like a lint config. */
  discoveryConfigFiles: 5,
} as const;

// ───────────────────────────────────────────────────────────────────────────────
// Discovery -- three independent routes, so no single rename blinds the roster
// ───────────────────────────────────────────────────────────────────────────────

/**
 * package.json script names in the lint/format/hygiene family. This is the corpus CHECK 1
 * walks -- it is about OUR scripts, invoked or not, and says nothing about which third-party
 * tool each one wraps.
 */
export function lintFamilyScripts(scriptNames: readonly string[]): string[] {
  return scriptNames.filter((n) => /^(lint|format|hygiene):/.test(n) || n === "typecheck").sort();
}

/**
 * Discovery route A: the THIRD-PARTY BINARY each lint-family script shells, if any.
 *
 * The split matters and is not cosmetic. `hygiene:check-arity` and `lint:typescript` shell
 * `bun <ourfile>.ts` -- they are audits we wrote, and CHECK 1 already governs whether CI runs
 * them. `lint:css` shells `stylelint`, which is a tool with its own configuration and its own
 * coverage, and that is what CHECK 2 is about. Folding the two together would demand a TOOLS
 * row for every hygiene script and turn the ledger into a second copy of package.json.
 *
 * The recognizer is structural rather than a name list: take the first token that is not a
 * runtime (`bun`/`node`/`npx`/`bunx`) or a flag, and drop it if it is a path into our own
 * tree. Whatever survives is something we did not write.
 */
export function discoverByScriptBinary(scripts: Readonly<Record<string, string>>): string[] {
  const RUNTIME = new Set(["bun", "bunx", "node", "npx", "npm", "pnpm", "yarn"]);
  const found = new Set<string>();
  for (const name of lintFamilyScripts(Object.keys(scripts))) {
    for (const raw of (scripts[name] ?? "").split(/\s+/)) {
      const tok = raw.replace(/^\.\//, "");
      if (tok.length === 0 || tok.startsWith("-") || RUNTIME.has(tok)) continue;
      if (/\.(ts|tsx|mjs|cjs|js)$/.test(tok)) break; // our own script; CHECK 1 owns it
      found.add(tok.includes("/") ? (tok.split("/").pop() ?? tok) : tok);
      break;
    }
  }
  return [...found].sort();
}

/**
 * devDependency names that look like a linting tool. Route B.
 *
 * A NAME PATTERN, not a list of the tools we happen to use -- that is what makes this route
 * able to notice a tool nobody told it about. `oxlint`, `biome`, `@biomejs/biome`,
 * `dprint`, a future `*-lint` package: all match without an edit here.
 */
export function discoverByDevDependency(names: readonly string[]): string[] {
  return names
    .filter((n) =>
      /(^|[/@-])(lint|linter|prettier|format(ter)?|stylelint|cspell|semgrep|oxlint|biome|dprint)([-/]|$)/i.test(n),
    )
    .sort();
}

/** Root-level file names that look like a lint configuration. Route C. */
export function discoverByConfigFile(rootEntries: readonly string[]): string[] {
  return rootEntries
    .filter(
      (f) =>
        /^\.?(eslint|prettier|stylelint|markdownlint|semgrep|cspell|oxlint|biome|dprint|editorconfig)/i.test(f) ||
        /^tsconfig(\..+)?\.json$/.test(f),
    )
    .sort();
}

// ───────────────────────────────────────────────────────────────────────────────
// Pure checks
// ───────────────────────────────────────────────────────────────────────────────

/**
 * CHECK 2, discovery half. Every token any route found must be claimed by a TOOLS row.
 * This is the instance-#4 catcher: a linter added to the tree with no ledger row is red
 * before anyone has to notice a suspicious rc=0.
 */
export function checkDiscoveryClaimed(
  discovered: Readonly<Record<string, readonly string[]>>,
  tools: readonly ToolRow[],
): Finding[] {
  const claimed = new Set(tools.flatMap((t) => t.claims.map((c) => c.toLowerCase())));
  const out: Finding[] = [];
  for (const [route, tokens] of Object.entries(discovered).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const unclaimed = tokens.filter((t) => !claimed.has(t.toLowerCase())).sort();
    if (unclaimed.length > 0) {
      out.push({
        ok: false,
        check: "tool-discovery",
        message:
          `route \`${route}\` found ${unclaimed.length} linting surface(s) no TOOLS row claims: ` +
          `${unclaimed.join(", ")}. A configured linter with no ledger row is the class this audit ` +
          `exists for -- add a row stating its coverage, its CI invocation (or that it has none), ` +
          `and the measured cost of that disposition.`,
      });
    }
  }
  return out;
}

/** CHECK 2, parity half. Declared disposition must match what the workflows actually do. */
export function checkToolDispositions(
  tools: readonly ToolRow[],
  invocations: ReadonlyMap<string, readonly string[]>,
): Finding[] {
  const out: Finding[] = [];
  for (const t of tools) {
    const where = invocations.get(t.id) ?? [];
    if (t.disposition === "gated" && where.length === 0) {
      out.push({
        ok: false,
        check: "tool-invocation",
        message:
          `\`${t.id}\` is declared GATED but no workflow \`run:\` body invokes it ` +
          `(recognizers: ${t.invokedBy.map((s) => `\`${s}\``).join(", ")}). Either its CI wiring ` +
          `was removed -- in which case the gate it is believed to provide is gone -- or a step was ` +
          `reworded past the recognizer. Both are the class.`,
      });
    } else if (t.disposition === "ungated" && where.length > 0) {
      out.push({
        ok: false,
        check: "tool-invocation",
        message:
          `\`${t.id}\` is declared UNGATED but IS invoked by ${where.join(", ")}. That is good news ` +
          `the ledger is lying about: promote the row to \`gated\`, give it a corpus floor, and ` +
          `replace its cost line with what it now covers.`,
      });
    } else {
      out.push({
        ok: true,
        check: "tool-invocation",
        message:
          `${t.id.padEnd(18)} ${t.disposition.padEnd(8)} ` +
          (where.length > 0 ? `invoked by ${where.join(", ")}` : "invoked by nothing (declared)"),
      });
    }
  }
  return out;
}

/** CHECK 1. Script-level parity, checked in both directions. */
export function checkScriptParity(
  scripts: readonly string[],
  invokedScripts: ReadonlySet<string>,
  declaredUninvoked: Readonly<Record<string, string>>,
): Finding[] {
  const out: Finding[] = [];
  for (const s of [...scripts].sort()) {
    const invoked = invokedScripts.has(s);
    const declared = Object.prototype.hasOwnProperty.call(declaredUninvoked, s);
    if (!invoked && !declared) {
      out.push({
        ok: false,
        check: "script-invocation",
        message:
          `\`${s}\` is defined in package.json and no workflow invokes it -- neither by script name ` +
          `nor by the path it shells. A check that exists, can fail, and is wired to nothing reads ` +
          `exactly like a check that passed. Wire it, or add it to DECLARED_UNINVOKED with the reason.`,
      });
    } else if (invoked && declared) {
      out.push({
        ok: false,
        check: "script-invocation",
        message:
          `\`${s}\` is listed in DECLARED_UNINVOKED but a workflow now invokes it. Remove the entry: ` +
          `a ledger that only grows is a suppression list, and this one is checked in both directions ` +
          `precisely so it cannot become one.`,
      });
    }
  }
  for (const s of Object.keys(declaredUninvoked).sort()) {
    if (!scripts.includes(s)) {
      out.push({
        ok: false,
        check: "script-invocation",
        message: `DECLARED_UNINVOKED names \`${s}\`, which is no longer a package.json script. A suppression cannot outlive its cause.`,
      });
    }
  }
  return out;
}

/** CHECK 3. An invocation that examined nothing must not look like one that examined many. */
export function checkCorpusFloors(tools: readonly ToolRow[], measured: ReadonlyMap<string, number>): Finding[] {
  const out: Finding[] = [];
  for (const t of tools) {
    if (!t.corpus) continue;
    const n = measured.get(t.id);
    if (n === undefined) {
      out.push({
        ok: false,
        check: "corpus-floor",
        message: `\`${t.id}\` declares a corpus floor of ${t.corpus.floor} and nothing measured its corpus. An unmeasured floor is the vacuity class wearing a floor's clothes.`,
      });
      continue;
    }
    if (n < t.corpus.floor) {
      out.push({
        ok: false,
        check: "corpus-floor",
        message:
          `\`${t.id}\` examines ${n} file(s) -- below its floor of ${t.corpus.floor} (${t.corpus.how}). ` +
          `Its CI invocation can still exit 0 while inspecting almost nothing, which is indistinguishable ` +
          `from a clean run unless something asserts this number. Something now does.`,
      });
    } else {
      out.push({
        ok: true,
        check: "corpus-floor",
        message: `${t.id.padEnd(18)} corpus ${String(n).padStart(6)} >= floor ${t.corpus.floor} (${t.corpus.how})`,
      });
    }
  }
  return out;
}

/**
 * Canonical form of an exclusion pattern.
 *
 * `bin`, `bin/**`, `**\/bin` and `**\/bin/**` all name the same tree for the purpose of
 * "is this tree excluded from both lists" -- the any-depth prefix and the recursive suffix
 * are noise here. Without this, the two lists appear to diverge on six entries that in fact
 * agree, and six false positives are how a parity check gets switched off.
 */
export function canonicalizeExclude(pattern: string): string {
  return pattern
    .replace(/^\*\*\//, "")
    .replace(/\/\*\*$/, "")
    .replace(/\/+$/, "");
}

/** CHECK 4. Two lists of one fact, maintained separately, must agree -- or declare the gap. */
export function checkExclusionParity(
  tsconfigExclude: readonly string[],
  eslintIgnores: readonly string[],
  declared: readonly string[],
): Finding[] {
  const a = new Set(tsconfigExclude.map(canonicalizeExclude));
  const b = new Set(eslintIgnores.map(canonicalizeExclude));
  const tsOnly = [...a].filter((x) => !b.has(x)).sort();
  const esOnly = [...b].filter((x) => !a.has(x)).sort();
  const want = [...declared].sort();
  const out: Finding[] = [];

  const added = tsOnly.filter((x) => !want.includes(x));
  const gone = want.filter((x) => !tsOnly.includes(x));
  if (added.length > 0) {
    out.push({
      ok: false,
      check: "exclusion-parity",
      message:
        `tsconfig.json excludes ${added.length} tree(s) eslint.config.ts does not, and the ledger ` +
        `does not know about them: ${added.join(", ")}. Every .ts file under them is a guaranteed ` +
        `typed-linting parse error the moment the eslint roster widens. Mirror the exclusion into ` +
        `eslint.config.ts, or record it in DECLARED_EXCLUDE_DIVERGENCE with what it costs.`,
    });
  }
  if (gone.length > 0) {
    out.push({
      ok: false,
      check: "exclusion-parity",
      message:
        `DECLARED_EXCLUDE_DIVERGENCE names ${gone.length} tree(s) that no longer diverge: ` +
        `${gone.join(", ")}. Drop them -- a recorded gap that has closed makes the ledger a place ` +
        `findings go to be forgotten.`,
    });
  }
  if (esOnly.length > 0) {
    out.push({
      ok: false,
      check: "exclusion-parity",
      message:
        `eslint.config.ts ignores ${esOnly.length} tree(s) tsconfig.json does not: ${esOnly.join(", ")}. ` +
        `That is the same defect pointing the other way -- tsc typechecks a tree eslint refuses to look at.`,
    });
  }
  if (out.length === 0) {
    out.push({
      ok: true,
      check: "exclusion-parity",
      message: `exclusion lists agree except the ${want.length} declared divergences (tsconfig-only), and eslint-only is empty`,
    });
  }
  return out;
}

/** A route that recognizes nothing must fail naming itself, not report a shorter roster. */
export function checkRouteFloors(counts: Readonly<Record<string, number>>): Finding[] {
  const out: Finding[] = [];
  for (const [route, floor] of Object.entries(ROUTE_FLOORS).sort(([a], [b]) => (a < b ? -1 : 1))) {
    const n = counts[route] ?? 0;
    if (n < floor) {
      out.push({
        ok: false,
        check: "route-floor",
        message:
          `route \`${route}\` gathered ${n} item(s), below its floor of ${floor}. The recognizer went ` +
          `dark -- a rename, a reformat, a moved surface -- and this audit would otherwise have reported ` +
          `a clean, shorter roster as though the class had shrunk.`,
      });
    } else {
      out.push({ ok: true, check: "route-floor", message: `${route.padEnd(22)} ${String(n).padStart(5)} >= ${floor}` });
    }
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────────────
// IO
// ───────────────────────────────────────────────────────────────────────────────

const dropComments = (yaml: string): string =>
  yaml
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");

/**
 * Every workflow's non-comment body. A tool named only in a comment has not run.
 *
 * One syscall, one answer: a missing directory is read from `readdirSync`'s own ENOENT
 * rather than pre-checked, and it returns an empty map so the `workflows` route floor is
 * what names the failure. An `existsSync` gate here would be a check-then-use window AND
 * would swallow the one condition worth shouting about.
 */
export function workflowBodies(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return out;
    throw e;
  }
  for (const f of entries.sort()) {
    if (!/\.ya?ml$/.test(f)) continue;
    out.set(f, dropComments(readFileSync(join(dir, f), "utf8")));
  }
  return out;
}

function tracked(root: string, ...patterns: string[]): string[] {
  return execFileSync("git", ["ls-files", ...patterns], { cwd: root, encoding: "utf8", maxBuffer: 512e6 })
    .split("\n")
    .filter(Boolean);
}

/**
 * The number of files markdownlint-cli2 ACTUALLY OPENS for `**\/*.md`, obtained from the
 * linter's own glob-and-ignore resolution via a probe rule that only records names.
 *
 * Reimplementing the ignore semantics here would drift from the linter within a release;
 * asking the linter is the only answer that stays true. Costs ~20 s of the gate step's
 * measured 21 s on the CI runner (~12 s on a dev laptop; the runner number is the one that
 * matters, and gate.yml quotes it), paid in a job that already installs the linter -- and it
 * is the one number that makes the markdownlint carve-outs a measured quantity rather than
 * a comment.
 */
async function markdownlintExaminedCount(root: string): Promise<number> {
  const { main } = await import("markdownlint-cli2");
  const seen = new Set<string>();
  await main({
    directory: root,
    argv: ["**/*.md"],
    logMessage: () => undefined,
    logError: () => undefined,
    optionsOverride: {
      customRules: [
        {
          names: ["ZETA-COVERAGE-PROBE"],
          description: "records the name of every file the linter opened",
          tags: ["probe"],
          parser: "none",
          function: (params: { name: string }) => {
            seen.add(params.name);
          },
        },
      ],
      config: { "ZETA-COVERAGE-PROBE": true },
    },
    outputFormatters: [[() => undefined]],
  });
  return seen.size;
}

const stripJsonc = (s: string): string => s.replace(/^\s*\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1");

async function main(): Promise<void> {
  const root = process.cwd();
  const json = process.argv.includes("--json");

  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const bodies = workflowBodies(join(root, ".github", "workflows"));

  // A `run:` body is no longer the only place a gated check is invoked from. Since the
  // 2026-08-26 `cross-verify` split, that job is a 31-leg matrix whose legs all run
  // `cross-verify-roster.ts --run <id>` and take the actual command from the roster -- so
  // for five audits the roster IS the invocation surface, and reading only workflow text
  // reported them as wired to nothing. That report would have been exactly backwards:
  // they run on the required floor of every PR.
  //
  // Only the COMMAND strings join the corpus, never the roster's prose. That is the same
  // rule `dropComments` enforces for workflows -- a tool named in a comment has not run --
  // and it matters more here, because the roster carries every replaced step's rationale
  // verbatim and those paragraphs name plenty of scripts they do not invoke.
  //
  // `bodies` itself is left alone so the `workflows` route floor keeps counting workflows.
  const invocationSurfaces = new Map(bodies);
  invocationSurfaces.set(CROSS_VERIFY_ROSTER_PATH, CROSS_VERIFY_AUDITS.map((a) => a.command).join("\n"));
  const allBodies = [...invocationSurfaces.values()].join("\n");

  // ── discovery ────────────────────────────────────────────────────────────────
  const rootEntries = readdirSync(root);
  const discovered = {
    scriptBinary: discoverByScriptBinary(pkg.scripts),
    devDependency: discoverByDevDependency(Object.keys(pkg.devDependencies ?? {})),
    configFile: discoverByConfigFile(rootEntries),
  };

  // ── invocation derivation ────────────────────────────────────────────────────
  const scripts = lintFamilyScripts(Object.keys(pkg.scripts));
  const invokedScripts = new Set<string>();
  for (const s of scripts) {
    const cmd = pkg.scripts[s] ?? "";
    const path = /([\w./-]+\.ts)/.exec(cmd)?.[1]?.replace(/^\.\//, "");
    if (allBodies.includes(`run ${s}`) || (path !== undefined && allBodies.includes(path))) invokedScripts.add(s);
  }
  const invocations = new Map<string, readonly string[]>();
  for (const t of TOOLS) {
    const where: string[] = [];
    for (const [file, body] of invocationSurfaces) if (t.invokedBy.some((r) => body.includes(r))) where.push(file);
    invocations.set(t.id, where.sort());
  }

  // ── corpus measurement ───────────────────────────────────────────────────────
  const rosterPaths = (pkg.scripts["lint:eslint"] ?? "")
    .split(/\s+/)
    .slice(1)
    .filter((p) => p.length > 0 && !p.startsWith("-"));
  const allTs = tracked(root, "*.ts");
  const tsconfig = JSON.parse(stripJsonc(readFileSync(join(root, "tsconfig.json"), "utf8"))) as { exclude: string[] };
  const excluded = (f: string): boolean =>
    tsconfig.exclude.some((e) => {
      const base = e.replace(/\/\*\*$/, "");
      return f === base || f.startsWith(base + "/") || new Bun.Glob(e).match(f);
    });
  const sln = readFileSync(join(root, "Zeta.sln"), "utf8");
  const semgrepRules =
    (readFileSync(join(root, ".semgrep-floor.yml"), "utf8").match(/^\s*-\s*id:/gm) ?? []).length +
    (readFileSync(join(root, ".semgrep.yml"), "utf8").match(/^\s*-\s*id:/gm) ?? []).length;

  const measured = new Map<string, number>([
    ["markdownlint", await markdownlintExaminedCount(root)],
    ["eslint", allTs.filter((f) => rosterPaths.some((r) => f === r || f.startsWith(r + "/"))).length],
    ["tsc", allTs.filter((f) => !excluded(f)).length],
    ["semgrep", semgrepRules],
    ["actionlint", tracked(root, ".github/workflows/*.yml", ".github/workflows/*.yaml").length],
    ["shellcheck", tracked(root, "tools/*.sh").length],
    ["dotnet-format", (sln.match(/^Project\(/gm) ?? []).length],
    ["ruff-mypy", tracked(root, "src/Core.Python/*.py").length],
    ["gofmt-golangci", tracked(root, "src/Core.Go/*.go").length],
    ["cargo-fmt-clippy", tracked(root, "src/*Cargo.toml").length],
  ]);

  // ── exclusion parity ─────────────────────────────────────────────────────────
  const eslintSrc = readFileSync(join(root, "eslint.config.ts"), "utf8");
  const block = /const ignorePatterns = \[([\s\S]*?)\];/.exec(eslintSrc);
  if (!block) {
    console.error("[linter-coverage] ✗ could not locate `const ignorePatterns = [...]` in eslint.config.ts");
    process.exit(1);
  }
  const eslintIgnores = [...block[1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);

  // ── run every check ──────────────────────────────────────────────────────────
  const findings: Finding[] = [
    ...checkRouteFloors({
      scripts: scripts.length,
      workflows: bodies.size,
      discoveryScripts: discovered.scriptBinary.length,
      discoveryDevDeps: discovered.devDependency.length,
      discoveryConfigFiles: discovered.configFile.length,
    }),
    ...TOOLS.flatMap((t) =>
      t.configFiles
        .filter((f) => !existsSync(join(root, f)))
        .map((f) => ({
          ok: false,
          check: "config-present",
          message: `\`${t.id}\` declares config \`${f}\`, which does not exist. A ledger row describing a tool that is no longer configured is stale by definition.`,
        })),
    ),
    ...checkDiscoveryClaimed(discovered, TOOLS),
    ...checkScriptParity(scripts, invokedScripts, DECLARED_UNINVOKED),
    ...checkToolDispositions(TOOLS, invocations),
    ...checkCorpusFloors(TOOLS, measured),
    ...checkExclusionParity(tsconfig.exclude, eslintIgnores, DECLARED_EXCLUDE_DIVERGENCE),
  ];

  if (json) {
    console.log(JSON.stringify({ findings, measured: Object.fromEntries(measured) }, null, 2));
  } else {
    for (const f of findings) {
      if (f.ok) console.log(`[linter-coverage] [${f.check}] ${f.message}`);
      else console.error(`[linter-coverage] ✗ [${f.check}] ${f.message}`);
    }
  }
  const failed = findings.filter((f) => !f.ok);
  if (failed.length > 0) {
    console.error(`[linter-coverage] ✗ ${failed.length} divergence(s) between configured coverage and CI invocation.`);
    process.exit(3);
  }
  console.log(
    `[linter-coverage] ✓ ${TOOLS.length} tools, ${scripts.length} scripts: coverage and invocation agree with the ledger.`,
  );
}

if (import.meta.main) await main();
