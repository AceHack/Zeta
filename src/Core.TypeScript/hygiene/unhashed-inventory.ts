// unhashed-inventory.ts — the derivation behind the ONE surface that lists every dependency in
// this repo whose bytes nothing verifies.
//
// THE "HANDLED SEPARATELY" HALF (Aaron 2026-09-10: "they are just not the preferred and need to
// be handled separately, we need to wire these everywhere though"). `unhashed-pin.ts` gives the
// class a spelling; without a place that COUNTS it, the class is still scattered across a dozen
// mechanisms and nobody can answer "how many are there and which ones". Five mechanisms each
// quietly permitting one unhashed dependency is not five small decisions, it is one large one
// nobody made.
//
// DERIVED, NEVER HAND-MAINTAINED. A hand-written list of exceptions drifts from the thing it
// describes and then reads as compliance — the exact failure this repo names as the vacuity
// class. So the inventory is regenerated from the declarations themselves (`--write`) and CI
// compares the committed copy against a fresh derivation. The comparison fails BOTH ways:
//
//   * an unhashed dependency that is NOT in the committed inventory  -> it entered without
//     anyone seeing it. Fails.
//   * an inventory entry that the tree no longer produces (the row gained a digest, or the
//     mechanism was wired)                                          -> the roster must SHRINK.
//     Fails until it is regenerated.
//
// The second direction is the one that makes this more than a warning label: an exception that
// is no longer needed cannot sit there looking justified.
//
// WHAT COUNTS AS COVERED. A content digest verified before use — `sha256=<hex>`, a git
// `commit=<40 hex>` checkout, an `@sha256:` container digest, a lockfile `integrity`. NOT
// covered: a version number, a tag, a floating major, a package id with no version at all. A
// version pin says WHICH RELEASE was asked for; it does not say which bytes arrived.

import { readFileSync, readdirSync, type Dirent } from "node:fs";
import { join, resolve } from "node:path";
import { parseMechanismManifest, parseSetupManifest } from "../ace/setup-manifest.ts";
import { TAG_ONLY, UNPINNED } from "../ace/setup-realizers/unhashed-pin.ts";

export type Coverage = "digest" | "tag-only" | "unpinned" | "undeclared";

/** One dependency, or one aggregate of dependencies a mechanism acquires the same way. */
export interface InventoryEntry {
  readonly mechanism: string;
  readonly subject: string;
  readonly source: string;
  readonly coverage: Coverage;
  /** The declared reason, verbatim, for tag-only/unpinned. Empty otherwise. */
  readonly reason: string;
  /** For an aggregate row: how many dependencies it stands for. 1 for a single row. */
  readonly count: number;
  /** For an undeclared row: why this mechanism cannot carry a declaration yet. */
  readonly blocker: string;
}

export interface Inventory {
  readonly declared: readonly InventoryEntry[];
  readonly undeclared: readonly InventoryEntry[];
  readonly digestCovered: readonly InventoryEntry[];
}

const SHA256_HEX = /^[0-9a-f]{64}$/u;
const GIT_SHA = /^[0-9a-f]{40}$/u;

/**
 * Every mechanism manifest, and how to read a dependency out of it.
 *
 * THE TABLE IS THE REVIEWED ARTIFACT; the document is derived from it. A manifest present in
 * `tools/setup/manifests/` and absent from this table is a REFUSAL (`unknownManifests` below),
 * so a new dependency mechanism cannot enter the tree without someone stating how its pins work.
 * That is the same shape as the action roster: adoption has to be an explicit act.
 */
export interface MechanismDescriptor {
  /** Manifest basename under tools/setup/manifests/. */
  readonly manifest: string;
  /** How the rows are shaped. */
  readonly shape: "tokens" | "spec" | "lines" | "opaque" | "pip-hashed";
  /** Row-level: the manifest format has a `sha256=` slot and the realizer honours it. */
  readonly hasDigestSlot: boolean;
  /** Row-level: a `commit=<40 hex>` attribute is the content pin (git). */
  readonly commitPinned?: boolean;
  /** Acquires nothing over a network — excluded from the inventory with this reason. */
  readonly acquiresNothing?: string;
  /** Why rows here cannot carry a declaration yet. Required when hasDigestSlot is false. */
  readonly blocker?: string;
}

export const MECHANISMS: readonly MechanismDescriptor[] = [
  // ── WIRED: the format has a digest slot and the realizer calls resolvePin ──────────────
  { manifest: "from-url", shape: "tokens", hasDigestSlot: true },
  { manifest: "from-elan", shape: "tokens", hasDigestSlot: true },
  { manifest: "from-autotools-tarball", shape: "tokens", hasDigestSlot: true },
  { manifest: "from-installer", shape: "tokens", hasDigestSlot: true },
  { manifest: "from-deb", shape: "tokens", hasDigestSlot: true },
  // A pip requirements file under `--require-hashes`: every row carries `--hash=sha256:` and pip
  // REFUSES any requirement in the file that does not. Landed on main 2026-09-10 for Scorecard
  // #457/#458, and this audit refused it on the same day for being undescribed -- which is the
  // third refusal doing its job on its first live case rather than in a test.
  { manifest: "yamllint-requirements.txt", shape: "pip-hashed", hasDigestSlot: true },

  // ── CONTENT-PINNED BY GIT: a commit sha IS a content digest over a tree ────────────────
  { manifest: "from-opam-git", shape: "tokens", hasDigestSlot: false, commitPinned: true },
  { manifest: "from-agda-cubical", shape: "tokens", hasDigestSlot: false, commitPinned: true },

  // ── NOT YET DECLARABLE: the format cannot carry an attribute, or the ecosystem has no
  //    digest to carry. Each blocker is a specific, removable obstacle — not an excuse.
  {
    manifest: "from-bun-global",
    shape: "lines",
    hasDigestSlot: false,
    blocker:
      "parseSimpleManifest treats the whole line as a package id, so a k=v attribute cannot be" +
      " added without changing the parser; rows also carry no VERSION, so `bun install --global`" +
      " resolves latest on every run",
  },
  {
    manifest: "from-uv-tool",
    shape: "lines",
    hasDigestSlot: false,
    blocker:
      "parseSimpleManifest treats the whole line as a pip requirement, so a k=v attribute cannot" +
      " be added without changing the parser; `==` pins a version, never the wheel's bytes",
  },
  {
    manifest: "from-uv-venv",
    shape: "spec",
    hasDigestSlot: false,
    blocker: "pip specs pin a version; hashes need a --require-hashes requirements file this mechanism does not use",
  },
  {
    manifest: "from-dotnet-global",
    shape: "spec",
    hasDigestSlot: false,
    blocker: "`dotnet tool install` takes a version, never a digest; several rows pin no version either",
  },
  {
    manifest: "from-dotnet-workload",
    shape: "spec",
    hasDigestSlot: false,
    blocker: "`dotnet workload install` takes a workload id only",
  },
  {
    manifest: "from-ollama",
    shape: "opaque",
    hasDigestSlot: false,
    blocker: "key/value file, not a row-per-dependency format; the model is named by a mutable ollama tag",
  },
  {
    manifest: "apt",
    shape: "spec",
    hasDigestSlot: false,
    blocker: "apt verifies its own repository signatures; per-package digests are the distro's, not ours",
  },
  {
    manifest: "brew",
    shape: "spec",
    hasDigestSlot: false,
    blocker: "homebrew formulae carry their own upstream sha256; we pin neither the formula revision nor the bottle",
  },
  {
    manifest: "brew-cask",
    shape: "spec",
    hasDigestSlot: false,
    blocker: "same as brew; casks additionally fetch vendor DMGs on the cask's schedule",
  },
  {
    manifest: "windows",
    shape: "spec",
    hasDigestSlot: false,
    blocker: "scoop/winget/choco manifests carry the hash upstream; we pin the package id only",
  },

  // ── ACQUIRE NOTHING ───────────────────────────────────────────────────────────────────
  { manifest: "from-shim", shape: "tokens", hasDigestSlot: false, acquiresNothing: "creates a symlink between two local binaries" },
  { manifest: "from-uv-project", shape: "spec", hasDigestSlot: false, acquiresNothing: "installs only from a committed uv.lock in the named project" },
  { manifest: "cluster-cells", shape: "opaque", hasDigestSlot: false, acquiresNothing: "cluster topology, not a dependency manifest" },
  { manifest: "from-url-rolling-exceptions", shape: "opaque", hasDigestSlot: false, acquiresNothing: "an exception ledger over from-url rows, not a dependency source" },
  { manifest: "from-url-rolling-receipts", shape: "opaque", hasDigestSlot: false, acquiresNothing: "a receipt ledger over from-url rows, not a dependency source" },
  { manifest: "pinned-refs", shape: "opaque", hasDigestSlot: false, acquiresNothing: "a mirror of pins written at their point of use; nothing in any build path reads it" },
  { manifest: "pinned-refs-receipts", shape: "opaque", hasDigestSlot: false, acquiresNothing: "a receipt ledger over pinned-refs rows" },
  { manifest: "README.md", shape: "opaque", hasDigestSlot: false, acquiresNothing: "documentation" },
];

const MANIFEST_DIR = "tools/setup/manifests";

function readIfPresent(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/**
 * Manifests on disk that the table above does not describe.
 *
 * A new mechanism must be described before it can ship, because an undescribed one is invisible
 * to every count below — and an inventory that silently omits a mechanism is worse than none.
 */
export function unknownManifests(root: string): readonly string[] {
  const described = new Set(MECHANISMS.map((m) => m.manifest));
  let names: string[];
  try {
    names = readdirSync(resolve(root, MANIFEST_DIR));
  } catch {
    return [];
  }
  return names.filter((n) => !described.has(n)).sort();
}

function declaredEntry(
  mechanism: string,
  subject: string,
  source: string,
  attrs: Readonly<Record<string, string>>,
): InventoryEntry | null {
  const sha = attrs.sha256;
  if (sha === TAG_ONLY) {
    return {
      mechanism,
      subject,
      source,
      coverage: TAG_ONLY,
      reason: (attrs.tagonly ?? "").trim(),
      count: 1,
      blocker: "",
    };
  }
  if (sha === UNPINNED) {
    return {
      mechanism,
      subject,
      source,
      coverage: UNPINNED,
      reason: (attrs.unpinned ?? "").trim(),
      count: 1,
      blocker: "",
    };
  }
  return null;
}

/** Rows of the manifests the table describes, classified. */
export function scanManifests(root: string): InventoryEntry[] {
  const out: InventoryEntry[] = [];
  for (const m of MECHANISMS) {
    if (m.acquiresNothing !== undefined) continue;
    const path = resolve(root, MANIFEST_DIR, m.manifest);
    const text = readIfPresent(path);
    if (text === null) continue;
    const source = `${MANIFEST_DIR}/${m.manifest}`;

    if (m.shape === "pip-hashed") {
      for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (line.length === 0 || line.startsWith("#") || line.startsWith("-")) continue;
        const name = line.split(/[\s<>=!~]/u)[0] ?? line;
        out.push({
          mechanism: m.manifest,
          subject: name,
          source,
          coverage: /--hash=sha256:[0-9a-f]{64}/u.test(line) ? "digest" : "undeclared",
          reason: "",
          count: 1,
          blocker: /--hash=/u.test(line)
            ? ""
            : "the file is installed under --require-hashes, so a row without --hash=sha256: makes pip refuse the whole install",
        });
      }
      continue;
    }

    if (m.shape === "opaque" || m.shape === "lines") {
      const rows = text.split(/\r?\n/).filter((l) => l.trim().length > 0 && !l.trimStart().startsWith("#"));
      if (rows.length > 0) {
        // `lines` manifests are one dependency per line, so the names are worth printing; an
        // `opaque` one (a key/value file) has no per-row dependency name to print.
        const names = rows.map((l) => l.trim().split(/\s+/)[0] ?? "").sort().join(", ");
        out.push({
          mechanism: m.manifest,
          subject: m.shape === "lines" ? names : `${String(rows.length)} row(s)`,
          source,
          coverage: "undeclared",
          reason: "",
          count: rows.length,
          blocker: m.blocker ?? "",
        });
      }
      continue;
    }

    if (m.shape === "spec") {
      const rows = parseSetupManifest(text);
      if (rows.length === 0) continue;
      const declared = rows.map((r) => declaredEntry(m.manifest, r.spec, source, r.attrs)).filter((e) => e !== null);
      out.push(...(declared as InventoryEntry[]));
      const remaining = rows.length - declared.length;
      if (remaining > 0 && !m.hasDigestSlot) {
        out.push({
          mechanism: m.manifest,
          subject: rows
            .filter((r) => declaredEntry(m.manifest, r.spec, source, r.attrs) === null)
            .map((r) => r.spec)
            .sort()
            .join(", "),
          source,
          coverage: "undeclared",
          reason: "",
          count: remaining,
          blocker: m.blocker ?? "",
        });
      }
      continue;
    }

    for (const row of parseMechanismManifest(text)) {
      const subject = row.tokens[0];
      if (subject === undefined) continue;
      // NO LINE NUMBER IN THE KEY. A line number makes an entry's identity depend on every
      // edit ABOVE it, so an unrelated comment -- or a merge with main, which is how this was
      // found -- reddens an audit on the `cross-verify` floor for a change that touched nothing
      // it governs. A check that reddens on unrelated edits holds the floor closed for no
      // reason, which is the blast-radius defect the floor split exists to avoid.
      const rowSource = source;
      const dec = declaredEntry(m.manifest, subject, rowSource, row.attrs);
      if (dec !== null) {
        out.push(dec);
        continue;
      }
      const sha = (row.attrs.sha256 ?? "").toLowerCase();
      if (SHA256_HEX.test(sha)) {
        out.push({ mechanism: m.manifest, subject, source: rowSource, coverage: "digest", reason: "", count: 1, blocker: "" });
        continue;
      }
      if (m.commitPinned === true && GIT_SHA.test(row.attrs.commit ?? "")) {
        out.push({ mechanism: m.manifest, subject, source: rowSource, coverage: "digest", reason: "", count: 1, blocker: "" });
        continue;
      }
      out.push({
        mechanism: m.manifest,
        subject,
        source: rowSource,
        coverage: "undeclared",
        reason: "",
        count: 1,
        blocker: m.blocker ?? "the realizer requires a digest; this row declares neither one nor a reason",
      });
    }
  }
  return out;
}

/** `.mise.toml` + `.mise.full.toml` — every tool is version-pinned, none is digest-pinned. */
export function scanMise(root: string): InventoryEntry[] {
  const out: InventoryEntry[] = [];
  for (const file of [".mise.toml", ".mise.full.toml"]) {
    const text = readIfPresent(resolve(root, file));
    if (text === null) continue;
    const tools: string[] = [];
    let inTools = false;
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (line.startsWith("[")) {
        inTools = line === "[tools]";
        continue;
      }
      if (!inTools || line.length === 0 || line.startsWith("#")) continue;
      const match = /^"?([A-Za-z0-9_.:@\/-]+)"?\s*=/u.exec(line);
      if (match?.[1] !== undefined) tools.push(match[1]);
    }
    if (tools.length === 0) continue;
    out.push({
      mechanism: "mise",
      subject: [...tools].sort().join(", "),
      source: file,
      coverage: "undeclared",
      reason: "",
      count: tools.length,
      blocker:
        "mise pins a VERSION; a per-tool digest needs a committed mise.lock, which this tree does" +
        " not have yet. `MISE_PYTHON_GITHUB_ATTESTATIONS=0` in tools/setup/common/mise.sh also" +
        " disables the one upstream attestation check that exists",
    });
  }
  return out;
}

/**
 * Every file under `root` matching `predicate`, in sorted order.
 *
 * `withFileTypes` rather than a follow-up `statSync`: the listing already knows what each entry
 * is, so asking the filesystem a second time both costs a syscall and opens a window in which
 * the entry can change kind. `lint-check-then-use-file-races` refuses the two-call form by name.
 */
/**
 * A directory's entries, or none when it cannot be read.
 *
 * Swallowing the error is safe HERE and only here: an unreadable subdirectory contributes no
 * dependencies, and a total failure (an unreadable root) is caught by the caller's
 * derived-ZERO refusal, which exits 2 rather than reporting a clean tree.
 */
function entriesOf(dir: string): Dirent[] {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function walkFiles(root: string, predicate: (p: string) => boolean): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string): void => {
    for (const dirent of entriesOf(dir).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const name = dirent.name;
      if (name === ".git" || name === "node_modules" || name === "references") continue;
      const relPath = rel === "" ? name : `${rel}/${name}`;
      if (dirent.isDirectory()) walk(join(dir, name), relPath);
      else if (dirent.isFile() && predicate(relPath)) out.push(relPath);
    }
  };
  walk(resolve(root), "");
  return out;
}

/** Container bases: `FROM image:tag@sha256:...` is covered; anything else is not. */
export function scanDockerfiles(root: string): InventoryEntry[] {
  const out: InventoryEntry[] = [];
  for (const rel of walkFiles(root, (p) => p.split("/").pop()?.startsWith("Dockerfile") === true)) {
    const text = readIfPresent(resolve(root, rel));
    if (text === null) continue;
    for (const line of text.split(/\r?\n/)) {
      const match = /^\s*FROM\s+(\S+)/iu.exec(line);
      const image = match?.[1];
      if (image === undefined || image.startsWith("$")) continue;
      out.push({
        mechanism: "docker",
        subject: image,
        source: rel,
        coverage: image.includes("@sha256:") ? "digest" : "undeclared",
        reason: "",
        count: 1,
        blocker: image.includes("@sha256:")
          ? ""
          : "a container base is pinnable with @sha256: at its point of use; this one is not, and has no tools/setup/manifests/pinned-refs row either",
      });
    }
  }
  return out;
}

/** NuGet: central versions with no lockfile is an ecosystem with no digest at all. */
export function scanNuget(root: string): InventoryEntry[] {
  const props = walkFiles(root, (p) => p.endsWith("Directory.Packages.props"));
  const locks = walkFiles(root, (p) => p.endsWith("packages.lock.json"));
  const out: InventoryEntry[] = [];
  for (const rel of props) {
    const text = readIfPresent(resolve(root, rel));
    if (text === null) continue;
    const count = (text.match(/<PackageVersion\s/gu) ?? []).length;
    if (count === 0) continue;
    out.push({
      mechanism: "nuget",
      subject: `${String(count)} centrally-versioned package(s)`,
      source: rel,
      coverage: locks.length > 0 ? "digest" : "undeclared",
      reason: "",
      count,
      blocker:
        locks.length > 0
          ? ""
          : "no packages.lock.json anywhere in the tree, so no contentHash exists and" +
            " `dotnet restore --locked-mode` has nothing to check. Versions are pinned; bytes are not",
    });
  }
  return out;
}

/** bun/npm lockfiles carry `integrity`, which IS a content digest. Counted so the ratio is visible. */
export function scanLockfiles(root: string): InventoryEntry[] {
  const out: InventoryEntry[] = [];
  for (const rel of walkFiles(root, (p) => p.endsWith("bun.lock") || p.endsWith("package-lock.json"))) {
    const text = readIfPresent(resolve(root, rel));
    if (text === null) continue;
    const count = (text.match(/sha512-|sha1-|"integrity"/gu) ?? []).length;
    if (count === 0) continue;
    out.push({ mechanism: "npm", subject: `${String(count)} integrity-covered package(s)`, source: rel, coverage: "digest", reason: "", count, blocker: "" });
  }
  return out;
}

/** GitHub Actions `uses:` — a 40-hex ref is a content pin; anything else is not. */
export function scanActions(root: string): InventoryEntry[] {
  const files = walkFiles(root, (p) => p.startsWith(".github/") && (p.endsWith(".yml") || p.endsWith(".yaml")));
  let pinned = 0;
  const floating: string[] = [];
  for (const rel of files) {
    const text = readIfPresent(resolve(root, rel));
    if (text === null) continue;
    text.split(/\r?\n/).forEach((line) => {
      if (/^\s*#/u.test(line)) return;
      const match = /^\s*(?:-\s*)?uses:\s*([A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+)@(\S+)/u.exec(line);
      const action = match?.[1];
      const ref = match?.[2];
      if (action === undefined || ref === undefined) return;
      if (GIT_SHA.test(ref)) pinned += 1;
      else floating.push(`${action}@${ref} (${rel})`);
    });
  }
  const out: InventoryEntry[] = [];
  if (pinned > 0) {
    out.push({ mechanism: "github-actions", subject: `${String(pinned)} SHA-pinned reference(s)`, source: ".github/workflows", coverage: "digest", reason: "", count: pinned, blocker: "" });
  }
  for (const f of floating.sort()) {
    out.push({
      mechanism: "github-actions",
      subject: f,
      source: ".github/workflows",
      coverage: "undeclared",
      reason: "",
      count: 1,
      blocker: "third-party actions are pinnable to a 40-hex SHA; audit-action-sha-roster refuses a floating ref",
    });
  }
  return out;
}

/** `pip install` in CI without `--require-hashes` installs bytes nothing checked. */
export function scanPip(root: string): InventoryEntry[] {
  const out: InventoryEntry[] = [];
  for (const rel of walkFiles(root, (p) => p.startsWith(".github/") && (p.endsWith(".yml") || p.endsWith(".yaml")))) {
    const text = readIfPresent(resolve(root, rel));
    if (text === null) continue;
    text.split(/\r?\n/).forEach((line) => {
      if (/^\s*#/u.test(line)) return;
      if (!/\bpip\b[^\n]*\binstall\b/u.test(line)) return;
      if (line.includes("--require-hashes")) return;
      out.push({
        mechanism: "pip",
        subject: line.trim().replace(/\s+/gu, " ").slice(0, 120),
        source: rel,
        coverage: "undeclared",
        reason: "",
        count: 1,
        blocker: "pip can verify wheels with --require-hashes against a hashed requirements file; this call site uses neither",
      });
    });
  }
  return out;
}

// JSON rather than a delimiter. A hand-picked separator has to be a character the fields
// cannot contain, and the first draft of this reached for a NUL byte written literally into
// the source -- which made the file `file(1)`-binary, made grep silently skip it, and made a
// test comparing against a plain space fail with two identical-looking strings.
function sortKey(e: InventoryEntry): string {
  return JSON.stringify([e.mechanism, e.source, e.subject]);
}

export function deriveInventory(root: string): Inventory {
  const raw = [
    ...scanManifests(root),
    ...scanMise(root),
    ...scanDockerfiles(root),
    ...scanNuget(root),
    ...scanLockfiles(root),
    ...scanActions(root),
    ...scanPip(root),
  ];

  // DEDUPE BY IDENTITY. Two `FROM` lines naming the same image in one Dockerfile are one
  // dependency acquired twice, and with line numbers out of the key they now collide. Summing
  // the counts keeps the number honest without inventing a second entry that a reader would
  // have to reconcile against the first.
  const merged = new Map<string, InventoryEntry>();
  for (const e of raw) {
    const existing = merged.get(sortKey(e));
    merged.set(sortKey(e), existing === undefined ? e : { ...existing, count: existing.count + e.count });
  }
  const all = [...merged.values()].sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0));

  return {
    declared: all.filter((e) => e.coverage === TAG_ONLY || e.coverage === UNPINNED),
    undeclared: all.filter((e) => e.coverage === "undeclared"),
    digestCovered: all.filter((e) => e.coverage === "digest"),
  };
}

function total(entries: readonly InventoryEntry[]): number {
  return entries.reduce((n, e) => n + e.count, 0);
}

const HEADER = `<!-- GENERATED by src/Core.TypeScript/hygiene/audit-unhashed-dependencies.ts --write. DO NOT EDIT BY HAND. -->

# Unhashed dependencies — the whole set, in one place

> An **unhashed dependency** is one whose bytes nothing in this repo verifies before use. It is
> **supported** and it is **not preferred**. Aaron 2026-09-10: *"we need to support non hashed
> dependencies they are just not the preferred and need to be handled separately, we need to wire
> these everywhere though, not all dependencies have a stable sha."*
>
> This page is **derived**, never hand-edited — \`bun src/Core.TypeScript/hygiene/audit-unhashed-dependencies.ts --write\`.
> CI regenerates it and fails if the committed copy disagrees, in **either** direction: a new
> unhashed dependency that is not listed here fails, and a listed one that now has a digest fails
> until it is removed. The roster can shrink; it cannot quietly grow.
`;

function renderTable(entries: readonly InventoryEntry[], columns: "declared" | "undeclared" | "covered"): string {
  if (entries.length === 0) return "_None._\n";
  const lines: string[] = [];
  if (columns === "declared") {
    lines.push("| Mechanism | Dependency | Kind | Declared reason | Where |", "|---|---|---|---|---|");
    for (const e of entries) {
      lines.push(`| \`${e.mechanism}\` | \`${e.subject}\` | ${e.coverage} | ${e.reason} | \`${e.source}\` |`);
    }
  } else if (columns === "undeclared") {
    lines.push("| Mechanism | Count | Dependencies | Why it carries no digest | Where |", "|---|---|---|---|---|");
    for (const e of entries) {
      lines.push(`| \`${e.mechanism}\` | ${String(e.count)} | \`${e.subject}\` | ${e.blocker} | \`${e.source}\` |`);
    }
  } else {
    lines.push("| Mechanism | Covered | Where |", "|---|---|---|");
    for (const e of entries) {
      lines.push(`| \`${e.mechanism}\` | \`${e.subject}\` | \`${e.source}\` |`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function renderInventory(inv: Inventory): string {
  const declaredN = total(inv.declared);
  const undeclaredN = total(inv.undeclared);
  const coveredN = total(inv.digestCovered);
  return [
    HEADER,
    "## Counts",
    "",
    `- **Declared unhashed:** ${String(declaredN)} — each one names its own reason on its own row.`,
    `- **Undeclared unhashed:** ${String(undeclaredN)} — visible and countable, but not yet declarable. This number must only fall.`,
    `- **Digest-covered:** ${String(coveredN)}.`,
    "",
    "## Declared — an unhashed dependency that says why",
    "",
    "Each row opted in with `sha256=tag-only` + `tagonly=<reason>` (the URL carries a version tag)",
    "or `sha256=unpinned` + `unpinned=<reason>` (it does not). The reason is a **value**, not a",
    "comment, because a comment travels with the line that copies it.",
    "",
    renderTable(inv.declared, "declared"),
    "## Undeclared — seen, counted, not yet declarable",
    "",
    "These are unhashed too. They are not exceptions anybody took; they are mechanisms whose format",
    "or ecosystem cannot yet carry a declaration. The `Why` column is the specific obstacle, so the",
    "work of removing one is nameable rather than vague.",
    "",
    renderTable(inv.undeclared, "undeclared"),
    "## Digest-covered — the denominator",
    "",
    "Listed so the numbers above are a ratio rather than a scare.",
    "",
    renderTable(inv.digestCovered, "covered"),
  ].join("\n");
}

export const INVENTORY_PATH = "docs/UNHASHED-DEPENDENCIES.md";
