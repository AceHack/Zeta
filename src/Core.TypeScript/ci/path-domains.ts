// src/Core.TypeScript/ci/path-domains.ts
//
// WHICH CHECKS CAN A DIFF POSSIBLY AFFECT?
//
// ═══════════════════════════════════════════════════════════════════════════
// THE MEASUREMENT THAT COMMISSIONED THIS FILE
// ═══════════════════════════════════════════════════════════════════════════
//
// PR #17264 -- `[telemetry-flush] archive(pr-reviews)` -- changed FOUR files:
// two tick shards under `docs/github/prs/shards/` and two archive markdown
// files under `docs/history/pr-reviews/`. Its gate run (34532486225) executed
// **76 jobs, 3,409 CPU-seconds, 267 s wall-clock**.
//
// Among them, MEASURED from that run's per-step timings:
//
//   lint (C#)      155 s   60 s installing a .NET toolchain + 70 s linting
//                          `.cs` files, on a PR containing zero `.cs` files
//   lint (Rust)    116 s   same shape, zero `.rs` files
//   lint (shell)    79 s   zero `.sh` files
//
// Roughly HALF of each job is runner setup and half is the scan, and on this
// PR both halves are dead weight. That 50/50 split is the design input: the
// filter has to gate the JOB, because gating only the step still pays the
// toolchain install. And 18 of the last 100 merged PRs were flush/archive, so
// this is close to a fifth of all traffic.
//
// A check that cannot fail is the vacuity class. A check that cannot even
// READ anything the diff touched is the same defect priced in CPU-seconds.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHY THIS IS SAFE, STATED AS THE ARGUMENT AND NOT AS A HOPE
// ═══════════════════════════════════════════════════════════════════════════
//
// 1. **The DIFF is the authority, never the label.** `[skip-review]` and
//    `[telemetry-flush]` in a PR title do NOTHING here and must never be read
//    by this module. A title is contributor-controlled text; a diff is a fact
//    about two trees. Anything that lets a title turn a check off is a
//    self-certifying gate, which is worth less than no gate at all.
//
// 2. **Fail closed, and the default is EVERYTHING ON.** An extension this map
//    does not recognise turns on *every* domain. New file types therefore
//    inherit the full gate until someone deliberately narrows them -- the
//    opposite of an allowlist that silently exempts what it forgot.
//
// 3. **Only NON-FLOOR drift checks may be gated.** `registry/uncompensatable-
//    floor.yaml` records the blocking floor -- build-and-test,
//    test-typescript-hermetic, cross-verify/full-verify, lint (semgrep),
//    lint-typescript -- and changing that list is a treaty amendment on the
//    maintainer's consent path. This module is not that path and must never be
//    used to narrow a floor job.
//
// 4. **Whole-tree drift is still covered, because the gate runs on `push:
//    branches: [main]`.** A drift lint skipped on a docs-only PR would have
//    been reporting on MAIN's state rather than on anything the PR did -- a
//    question nobody asked in that PR -- and the same lint runs over the whole
//    tree on the very next merge. Nothing stops being checked; a redundant
//    reading stops being paid for.
//
// ═══════════════════════════════════════════════════════════════════════════
// HONEST LIMITS
// ═══════════════════════════════════════════════════════════════════════════
//
//   - The map is by EXTENSION AND PATH PREFIX. A lint that reads a file whose
//     name gives no hint of its language -- a shell script inside a workflow
//     `run:` block is the live example -- needs its domain widened by hand, and
//     `shell` below therefore includes `.github/workflows/**` for exactly that
//     reason. Where a lint's true input surface could not be established by
//     reading it, IT IS NOT GATED. Leaving a job running costs seconds;
//     gating one that reads more than you thought costs a missed defect.
//   - This narrows only what RUNS. It does not narrow what the gate REPORTS:
//     `gate (required)` still runs, still reports, and still rolls up the same
//     floor.
//   - A skipped job and a failed job must never look alike to a reader. Skips
//     here are `if:`-conditioned, which GitHub renders as `skipped` and which
//     the floor rollup does not treat as success for floor members -- because
//     no floor member is gated.

/** A check's input domain. A diff "touches" a domain if any changed path maps to it. */
export type Domain =
  | "csharp" | "fsharp" | "rust" | "go" | "python" | "shell"
  | "workflows" | "markdown" | "yaml" | "typescript";

export const ALL_DOMAINS: readonly Domain[] = [
  "csharp", "fsharp", "rust", "go", "python", "shell",
  "workflows", "markdown", "yaml", "typescript",
];

/** Paths that provably feed no check gated here: generated, read by nothing. */
const INERT_PREFIXES: readonly string[] = [
  "docs/", "memory/", "openspec/", ".claude/", "data/",
  "db/mutation-findings/", "db/drift-dashboard/", "db/uncertainty/", "db/search-index/",
];

/**
 * Extension -> domains. A file may feed more than one: a `.sh` under
 * `.github/workflows/` is both shell and workflow surface.
 */
const BY_EXTENSION: ReadonlyMap<string, readonly Domain[]> = new Map<string, readonly Domain[]>([
  [".cs", ["csharp"]], [".csproj", ["csharp"]],
  [".fs", ["fsharp"]], [".fsi", ["fsharp"]], [".fsx", ["fsharp"]], [".fsproj", ["fsharp"]],
  [".rs", ["rust"]],
  [".go", ["go"]],
  [".py", ["python"]],
  [".sh", ["shell"]], [".bash", ["shell"]], [".zsh", ["shell"]],
  [".md", ["markdown"]],
  [".yaml", ["yaml"]], [".yml", ["yaml"]],
  [".ts", ["typescript"]], [".tsx", ["typescript"]], [".mts", ["typescript"]], [".cts", ["typescript"]],
  [".json", []], [".jsonc", []], [".txt", []], [".lock", []],
]);

/** Exact filenames that are a language's project surface without carrying its extension. */
const BY_FILENAME: ReadonlyMap<string, readonly Domain[]> = new Map<string, readonly Domain[]>([
  ["Cargo.toml", ["rust", "yaml"]], ["Cargo.lock", ["rust"]],
  ["go.mod", ["go"]], ["go.sum", ["go"]],
  ["pyproject.toml", ["python"]], ["requirements.txt", ["python"]],
  ["Directory.Packages.props", ["csharp", "fsharp"]],
  ["Zeta.sln", ["csharp", "fsharp"]],
  [".editorconfig", ["csharp", "fsharp"]],
]);

function extensionOf(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot);
}

function baseNameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/**
 * Domains one changed path can affect.
 *
 * `null` means UNRECOGNISED, which callers must treat as "every domain" --
 * the fail-closed direction. It is returned rather than `ALL_DOMAINS` so that
 * a caller cannot confuse "this file genuinely feeds everything" with "nobody
 * has classified this file", and so a test can tell them apart.
 */
export function domainsForPath(path: string): readonly Domain[] | null {
  if (path.length === 0) return null;

  // Workflow files feed actionlint AND shellcheck: `run:` blocks are shell
  // that no `.sh` extension announces.
  if (path.startsWith(".github/workflows/")) return ["workflows", "shell", "yaml"];

  const byName = BY_FILENAME.get(baseNameOf(path));
  if (byName !== undefined) return byName;

  // EXTENSION BEATS PREFIX, and this order is load-bearing.
  //
  // The first draft consulted INERT_PREFIXES first, so anything under
  // `docs/`, `.claude/` or `data/` returned "feeds nothing". The whole-tree
  // falsifier below refused it and named the reason: **158 tracked source
  // files live under those prefixes** -- 7 TypeScript hooks in
  // `.claude/hooks/`, 20 scripts under `docs/research/scripts/`, and a long
  // tail in `docs/recovered-orphan-branches-2026-05/`. Prefix-first would
  // have silently exempted every one of them from its own lint, including
  // from `lint-typescript`, which is a FLOOR job. A "directory of docs" is a
  // statement about intent; a `.ts` extension is a statement about what a
  // linter will open.
  const byExt = BY_EXTENSION.get(extensionOf(path));
  if (byExt !== undefined) return byExt;

  // Only an extension NOTHING claims may be judged by its tree. These are
  // generated-telemetry trees the existing gate filter already treats as a
  // docs surface; an unknown extension elsewhere still returns `null`.
  if (INERT_PREFIXES.some((prefix) => path.startsWith(prefix))) return [];

  return null;
}

export interface DomainVerdict {
  /** Domain -> whether any changed path can affect it. */
  readonly touched: Readonly<Record<Domain, boolean>>;
  /** Paths no rule recognised. Non-empty means every domain was forced on. */
  readonly unrecognised: readonly string[];
}

/** Fold a changed-file list into the per-domain vector. Fail-closed on anything unknown. */
export function classify(changed: readonly string[]): DomainVerdict {
  const touched: Record<Domain, boolean> = Object.fromEntries(
    ALL_DOMAINS.map((d) => [d, false]),
  ) as Record<Domain, boolean>;
  const unrecognised: string[] = [];

  for (const raw of changed) {
    const path = raw.trim();
    if (path.length === 0) continue;
    const domains = domainsForPath(path);
    if (domains === null) {
      unrecognised.push(path);
      for (const d of ALL_DOMAINS) touched[d] = true;
      continue;
    }
    for (const d of domains) touched[d] = true;
  }
  return { touched, unrecognised };
}

/** `domain=true|false` lines for `$GITHUB_OUTPUT`. Ordinal order, so the emission is stable. */
export function toGithubOutput(verdict: DomainVerdict): string {
  return [...ALL_DOMAINS]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((d) => `${d}=${verdict.touched[d] ? "true" : "false"}`)
    .join("\n");
}

if (import.meta.main) {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(Buffer.from(c));
  const changed = Buffer.concat(chunks).toString("utf8").split("\n");
  const verdict = classify(changed);
  if (verdict.unrecognised.length > 0) {
    process.stderr.write(
      `path-domains: ${verdict.unrecognised.length} unrecognised path(s) — every domain forced ON (fail-closed):\n` +
      verdict.unrecognised.slice(0, 20).map((p) => `  ${p}\n`).join(""),
    );
  }
  process.stdout.write(`${toGithubOutput(verdict)}\n`);
}
