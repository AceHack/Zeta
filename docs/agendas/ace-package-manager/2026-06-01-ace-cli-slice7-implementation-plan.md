# Ace CLI slice 7 — revocation / quarantine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Full behavior is in
> `2026-06-01-ace-cli-slice7-revocation-quarantine-design.md` — read it.

**Goal:** Add revocation + quarantine to the Ace registry: a `format_version`-2 signed index
carries `revoked` / `quarantined` maps; `ace registry revoke|quarantine|unquarantine` mark
versions; `publish` carries marks forward; consumers refuse marked versions at resolve +
install; revocation overrides the lockfile; `--allow-quarantined` opts in.

**Architecture:** marks are two sibling maps in the already-signed `IndexSignableContent`
(inherit signature + anti-rollback + freshness). Producer mutate-commands reuse the slice-6.1
read-verify-edit-bump-sign-selfverify-write pattern via new pure `apply*` functions. Consumer
threads union-merged marks into resolve + the install lockfile re-check.

**Tech stack:** TypeScript on Bun. `bun test tools/ace/`; strict
`bun --bun tsc --noEmit -p tsconfig.json` (exactOptionalPropertyTypes + noUnusedLocals);
markdownlint on `SKILL.md`. Harness: NO Edit tool — new files via Write, edits via Python
patch-scripts (exact-occurrence asserts; `rm` before commit; never commit `_patch_*`). Pure
LF — verify CR=0 with Python `open(f,'rb').read().count(b'\r')` (Git-Bash `grep $'\r'` is
unreliable here). Canary `git ls-tree HEAD | wc -l` = 67 (new files go under existing
top-level dirs, so the count is unchanged). Commit trailer
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

**Tasks (sequential; A before B before C):** A = signing types + producer pure logic
(`signing.ts`, `registry-revoke.ts` new, `registry-publish.ts` carry-forward); B = consumer
parse + resolve (`registry-remote.ts`, `resolve.ts`); C = `ace.ts` integration + e2e; D =
`SKILL.md`.

---

## Task A: signing types + `registry-revoke.ts` (new) + `buildIndexDoc` carry-forward

**Files:** Modify `tools/ace/signing.ts`, `tools/ace/registry-publish.ts`,
`tools/ace/registry-publish.test.ts`; create `tools/ace/registry-revoke.ts`,
`tools/ace/registry-revoke.test.ts`.

- [ ] **Step A1: signing.ts types (additive)**

Add to `tools/ace/signing.ts` near `IndexSignableContent`:

```ts
export interface RevocationEntry { reason?: string; at: string }
export type RevocationMap = Record<string, Record<string, RevocationEntry>>;
```

Extend `IndexSignableContent` with two optional fields (additive; `canonicalIndexBytes` /
`signIndex` / `verifyIndexSignature` unchanged — they canonicalize the whole content):

```ts
export interface IndexSignableContent {
  format_version: number;
  sequence: number;
  issued_at: string;
  packages: Record<string, Record<string, RegistryEntry>>;
  revoked?: RevocationMap;
  quarantined?: RevocationMap;
}
```

- [ ] **Step A2: `registry-revoke.ts` pure apply functions + tests (TDD)**

Create `tools/ace/registry-revoke.test.ts` FIRST (RED). Then `tools/ace/registry-revoke.ts`.
Functions (all pure; return new content or `{ error }`):

```ts
import type { IndexSignableContent, RevocationMap, RevocationEntry } from "./signing.ts";

// format_version is 2 iff a mark remains, else 1.
function withFmt(c: IndexSignableContent): IndexSignableContent {
  const hasMarks = (m?: RevocationMap) => !!m && Object.keys(m).length > 0;
  return { ...c, format_version: (hasMarks(c.revoked) || hasMarks(c.quarantined)) ? 2 : 1 };
}
function clone(m: RevocationMap | undefined): RevocationMap {
  // deep-ish clone (own keys only; null-proto to avoid prototype pollution)
  const out: RevocationMap = Object.create(null);
  for (const n of Object.keys(m ?? {})) { out[n] = Object.create(null); for (const v of Object.keys(m![n]!)) out[n]![v] = { ...m![n]![v]! }; }
  return out;
}
function has(m: RevocationMap | undefined, name: string, version: string): boolean {
  return !!m && !!m[name] && m[name]![version] !== undefined;
}
function add(m: RevocationMap, name: string, version: string, entry: RevocationEntry): void {
  (m[name] ?? (m[name] = Object.create(null)))[version] = entry;
}
function remove(m: RevocationMap, name: string, version: string): void {
  if (m[name]) { delete m[name]![version]; if (Object.keys(m[name]!).length === 0) delete m[name]; }
}

export function applyRevoke(prev: IndexSignableContent, name: string, version: string, reason: string | undefined, at: string): IndexSignableContent {
  const revoked = clone(prev.revoked); const quarantined = clone(prev.quarantined);
  remove(quarantined, name, version);                 // revoke supersedes quarantine
  add(revoked, name, version, reason !== undefined ? { reason, at } : { at });
  return withFmt({ ...prev, revoked, quarantined });
}
export function applyQuarantine(prev: IndexSignableContent, name: string, version: string, reason: string | undefined, at: string): IndexSignableContent | { error: string } {
  if (has(prev.revoked, name, version)) return { error: `${name}@${version} is revoked (terminal); cannot quarantine` };
  const quarantined = clone(prev.quarantined);
  add(quarantined, name, version, reason !== undefined ? { reason, at } : { at });
  return withFmt({ ...prev, quarantined });
}
export function applyUnquarantine(prev: IndexSignableContent, name: string, version: string): IndexSignableContent | { error: string } {
  if (!has(prev.quarantined, name, version)) return { error: `${name}@${version} is not quarantined` };
  const quarantined = clone(prev.quarantined);
  remove(quarantined, name, version);
  return withFmt({ ...prev, quarantined });
}
```

Tests (RED→GREEN): applyRevoke adds to `revoked`, sets `format_version` 2, clears a matching
`quarantined`; re-revoke is idempotent (no error); applyQuarantine errors on an
already-revoked version, else adds; applyUnquarantine removes (and reverts `format_version`
to 1 when it was the last mark), errors when not quarantined. Note exactOptionalPropertyTypes:
build the entry as `reason !== undefined ? { reason, at } : { at }` (never `{ reason: undefined }`).

- [ ] **Step A3: `buildIndexDoc` carry-forward (registry-publish.ts)**

Extend `buildIndexDoc`'s args with optional `revoked?: RevocationMap; quarantined?: RevocationMap;`.
After building `content`, attach them when non-empty and set `format_version` accordingly:

```ts
  const hasMarks = (m?: RevocationMap) => !!m && Object.keys(m).length > 0;
  const fmt = (hasMarks(args.revoked) || hasMarks(args.quarantined)) ? 2 : 1;
  const content: IndexSignableContent = { format_version: fmt, sequence: args.sequence, issued_at: args.issuedAt, packages };
  if (hasMarks(args.revoked)) content.revoked = args.revoked;
  if (hasMarks(args.quarantined)) content.quarantined = args.quarantined;
```

(Import `RevocationMap`. Existing `format_version: 1` literal is replaced by `fmt`.) Extend
`registry-publish.test.ts`: passing `revoked`/`quarantined` yields a v2 doc carrying them;
omitting them yields v1 as before.

- [ ] **Step A4: verify + commit** — `bun test tools/ace/registry-revoke.test.ts tools/ace/registry-publish.test.ts`
  pass; `bun --bun tsc --noEmit` exit 0; Python CR=0 on the 4 touched/new files; canary 67.
  Commit `tools/ace/signing.ts tools/ace/registry-revoke.ts tools/ace/registry-revoke.test.ts tools/ace/registry-publish.ts tools/ace/registry-publish.test.ts`.

---

## Task B: consumer parse (v2) + resolve gates

**Files:** Modify `tools/ace/registry-remote.ts`, `tools/ace/resolve.ts`, and their tests.

- [ ] **Step B1: `parseIndex` accept v2 + mark shape-guard (registry-remote.ts)**

Change the `format_version` gate from `!== 1` to accept `1` or `2`. When marks are present,
shape-validate; reject marks on a v1 index. Add a helper:

```ts
function validMarkMap(m: unknown): boolean {
  if (typeof m !== "object" || m === null) return false;
  for (const name of Object.keys(m as object)) {
    const vs = (m as Record<string, unknown>)[name];
    if (typeof vs !== "object" || vs === null) return false;
    for (const v of Object.keys(vs as object)) {
      const e = (vs as Record<string, unknown>)[v];
      if (typeof e !== "object" || e === null) return false;
      const ee = e as Record<string, unknown>;
      if (typeof ee.at !== "string") return false;
      if (ee.reason !== undefined && typeof ee.reason !== "string") return false;
    }
  }
  return true;
}
```

In `parseIndex`: `if (o.format_version !== 1 && o.format_version !== 2) return { error: "unsupported index format_version" };`
Then: if `o.revoked !== undefined` → must be `format_version === 2` and `validMarkMap` (else
error); same for `o.quarantined`. Carry them onto the returned `IndexDoc`.

- [ ] **Step B2: `loadRegistries` union-merge marks (registry-remote.ts)**

Wherever `loadRegistries` merges `packages` into the loaded result, also union-merge `revoked`
and `quarantined` across all sources (a version marked by any source is marked). Expose
`revoked` / `quarantined` (each a `RevocationMap`) on the loaded-registry result type. Read the
current `loadRegistries` return shape first and extend it minimally.

- [ ] **Step B3: resolve gates (resolve.ts)**

Add `"revoked"` and `"quarantined"` to the `ResolveReason` union. Add an
`allowQuarantined?: boolean` to the resolve options, and pass the merged marks in (extend the
resolve entry-point signature/opts to receive `revoked?: RevocationMap; quarantined?: RevocationMap`).
After a registry edge resolves to a concrete `name@concrete`, before/with the existing
registry-entry + signature gates:

```ts
        if (revoked && revoked[edge.name]?.[concrete] !== undefined) {
          const r = revoked[edge.name]![concrete]!;
          return { ok: false, reason: "revoked", detail: `${edge.name}@${concrete} is revoked${r.reason ? ": " + r.reason : ""}`, path: here };
        }
        if (!opts.allowQuarantined && quarantined && quarantined[edge.name]?.[concrete] !== undefined) {
          const q = quarantined[edge.name]![concrete]!;
          return { ok: false, reason: "quarantined", detail: `${edge.name}@${concrete} is quarantined${q.reason ? ": " + q.reason : ""} (use --allow-quarantined)`, path: here };
        }
```

(Match the exact local names already used at the resolve site — read resolve.ts for `concrete`,
`edge`, `here`, the opts object, and how the registry is threaded; adapt accordingly.)

- [ ] **Step B4: tests + verify + commit** — extend `registry-remote.test.ts` (v2 parse;
  v1-with-marks rejected; bad-mark shape rejected; union-merge) + `resolve.test.ts` (revoked →
  `"revoked"`; quarantined → `"quarantined"` without `allowQuarantined`, resolves with it).
  `bun test tools/ace/` green; tsc 0; CR=0; canary 67. Commit the two files + tests.

---

## Task C: `ace.ts` — subcommands + install enforcement + publish wiring + e2e

**Files:** Modify `tools/ace/ace.ts`, `tools/ace/ace.test.ts`.

Read first: the `registry` parse block + `RegistryArgs` type; the `publish` handler (prev read, then the `buildIndexDoc` call); the `install` handler (lockfile path + the resolve call); the existing
`registry remote`/`publish` subcommand dispatch.

- [ ] **Step C1: e2e tests (RED)** — add to `ace.test.ts` (reuse `writeSignedPkg`, `main`,
  `parseIndex`, `generateKeypair`, temp dirs). Cover, per the spec's Testing section: publish →
  `revoke` makes the index v2 + marks + bumps sequence + self-verifies; consumer resolve of a
  revoked version refuses; `quarantine` refuses without `--allow-quarantined`, installs with
  it; `unquarantine` restores; `revoke` on a quarantined version moves it (out of quarantined,
  into revoked); `publish` after a revoke preserves the mark; `revoke`/`quarantine` against an
  index signed by a different key → refused; `quarantine` of an already-revoked version →
  error; `unquarantine` of a non-quarantined → error; lockfile-pinned-then-revoked →
  `ace install` refuses.

- [ ] **Step C2: parse — three subcommands + `--allow-quarantined`**

Extend `RegistryArgs.sub` with `"revoke" | "quarantine" | "unquarantine"` and fields for the
parsed `name`/`version`/`reason`. Parse `<name>@<version>` by splitting on the LAST `@` (both
parts non-empty, else parse error); `--key` required; `--reason` optional (not for
unquarantine); `--out` optional. Add `--allow-quarantined` (boolean) to the `install` parse.
Use the spread-conditional form for optionals (exactOptionalPropertyTypes).

- [ ] **Step C3: handlers — revoke/quarantine/unquarantine**

Shared shape (mirror the publish mutate path): read `--key` PEM (validate ed25519); read
`--out` (required; missing/unparseable → hard error); `parseIndex(prevRaw)` → prev; verify
prev signature under the key (`publicKeyInfoFromPrivatePem` + `verifyIndexSignature`) else hard
error; call the matching `apply*` (registry-revoke.ts) with `at = new Date().toISOString()`; on
`{ error }` → hard error; `sequence = prev.sequence + 1`; `signIndex` the new content;
round-trip self-verify (`parseIndex` + `verifyIndexSignature`); `writeFileSync` pretty; print
`ace: <verb> <name>@<version> → <out> (sequence n)`.

- [ ] **Step C4: publish carry-forward wiring** — in the `publish` handler, pass
  `revoked: prev?.revoked, quarantined: prev?.quarantined` into `buildIndexDoc` (only when
  prev exists). (`buildIndexDoc` already handles non-empty → v2 from Task A.)

- [ ] **Step C5: install enforcement** — thread the loaded registry's merged
  `revoked`/`quarantined` + `allowQuarantined` into the resolve call. Add the **lockfile
  re-check**: before installing from a lockfile, for each pinned `name@version`, refuse if
  revoked (always) or quarantined (unless `--allow-quarantined`; warn when allowed). Match the
  existing install/lockfile code structure.

- [ ] **Step C6: usage text** — add the three subcommands + `--allow-quarantined` to the help.

- [ ] **Step C7: verify + commit** — `bun test tools/ace/` ALL green; tsc 0; CR=0 on ace.ts +
  ace.test.ts; canary 67; no `_patch_*`. Commit.

---

## Task D: `SKILL.md`

**Files:** Modify `.claude/skills/ace/SKILL.md`.

- [ ] **Step D1** — document the marks (two-state, in the signed v2 index), the three
  subcommands (`revoke`/`quarantine`/`unquarantine`), consumer refusal at resolve+install,
  revocation-overrides-lockfile, and `--allow-quarantined`. Keep existing content. Watch
  markdownlint: no nested backticks in inline code spans; blank lines around lists + fenced
  blocks.
- [ ] **Step D2** — `bunx markdownlint-cli2 .claude/skills/ace/SKILL.md` exit 0; CR=0; canary 67. Commit.

---

## Final holistic review

Dispatch a reviewer over `git diff origin/main..HEAD -- tools/ace/ .claude/skills/ace/SKILL.md`
checking: marks are in the signed content (covered by signature); `format_version` 2 iff marks
present (and reverts to 1 when the last mark is removed); revoke supersedes quarantine +
quarantine errors on revoked + no unrevoke; parseIndex rejects v1-with-marks; union-merge;
resolve + install + lockfile enforcement; `--allow-quarantined` path; producer mutate-guard
(verify-before-edit) on all three subcommands; `bun test tools/ace/` + strict tsc +
markdownlint green; CR=0; canary 67. Then open the impl PR + run the PR-gate loop.
