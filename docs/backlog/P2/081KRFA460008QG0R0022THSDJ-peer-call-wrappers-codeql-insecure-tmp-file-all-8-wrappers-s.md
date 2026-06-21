---
id: 081KRFA460008QG0R0022THSDJ
priority: P2
status: open
title: "Peer-call wrappers — CodeQL insecure-temp-file alert on autogenOutputPath() across all 8 wrappers (substrate-consistent fix needed)"
created: 2026-05-13
last_updated: 2026-05-13
depends_on: []
composes_with: []
type: security
---

# 081KRFA460008QG0R0022THSDJ — Peer-call wrappers: CodeQL insecure-temp-file across all 8 wrappers

## What

CodeQL alert #79 (`github-advanced-security` bot) flagged
`tools/peer-call/grok.ts`'s `autogenOutputPath()` function for
"Insecure creation of file in the os temp dir." The pattern:

```typescript
function autogenOutputPath(entity: string): string {
  const ts = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `/tmp/peer-call-output/${ts}-${entity}.md`;
}
```

Two concerns:

1. **Hardcoded `/tmp`** — not portable (Windows / non-Unix
   systems use different temp dirs). `os.tmpdir()` is the
   canonical alternative; respects TMPDIR / TEMP / TMP env vars.

2. **Predictable filename** — `${ts}-${entity}.md` is
   deterministic from clock + entity. On a world-writable
   `/tmp`, a local attacker could symlink-race the path before
   the wrapper writes to it, redirecting writes elsewhere.

## Why P2 + substrate-consistent fix

The same pattern exists in **all 8 peer-call wrappers**:
`claude.ts`, `grok.ts`, `gemini.ts`, `codex.ts`, `kiro.ts`,
`amara.ts`, `ani.ts`, `riven.ts`. Each has its own
`autogenOutputPath(entity)` function with the same hardcoded
`/tmp/peer-call-output/` + timestamp-suffix shape.

Fixing one wrapper in isolation creates substrate inconsistency
across the wrappers — CodeQL would re-flag the others as soon
as they're touched. The fix should be applied to all 8 at once.

P2 because:

- Pre-existing on `main` (not a regression introduced by
  PR #2949); CodeQL detection re-surfaced when PR #2949
  modified `grok.ts`
- Multi-user attack surface limited (peer-call wrappers run
  on maintainer laptops + CI runners, not production servers)
- BUT real attack surface for shared-tenant / multi-user
  systems (CI runners on GitHub-hosted shared runners)

## Hypothesis (untested)

Two fixes compose:

1. **Replace hardcoded `/tmp`** with `os.tmpdir()` — single-line
   change per wrapper; portable; respects env vars
2. **Add unpredictable suffix** to filename — either
   `fs.mkdtempSync(prefix)` for a unique dir + fixed filename,
   or `crypto.randomUUID()` appended to the file basename

Suggested signature (apply to all 8):

```typescript
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { resolve } from "node:path";

function autogenOutputPath(entity: string): string {
  const ts = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  // mkdtempSync creates a unique non-predictable directory; the
  // filename inside it can stay deterministic for caller-side
  // recovery via the OUTPUT-FILE: marker.
  const dir = mkdtempSync(resolve(tmpdir(), "peer-call-output-"));
  return resolve(dir, `${ts}-${entity}.md`);
}
```

## Acceptance criteria

1. Apply the fix uniformly to all 8 wrappers (no inconsistent
   substrate)
2. CodeQL alert #79 resolved
3. Existing OUTPUT-FILE marker contract preserved (callers
   reading `tail -1` should still recover the path)
4. No regression on existing tests (peer-call smoke test PR
   #2950 + any wrapper-specific tests)

## Composes with

- PR #2949 (081KRA5AR0008QG0R0011ZGRZT self-documenting failure marker; CodeQL
  re-surfaced via this PR)
- PR #2950 (081KRA5AR0008QG0R0011ZGRZT acceptance #4 smoke test; can extend with
  tmpdir-isolation verification)
- 081KRA5AR0008QG0R0011ZGRZT (parent friction-reducer; CodeQL fix is adjacent)
- `tools/peer-call/*.ts` (all 8 wrappers + 3 utility files)
- `.claude/rules/peer-call-infrastructure.md` (canonical
  inventory)
- CodeQL alert #79 on
  https://github.com/Lucent-Financial-Group/Zeta/security/code-scanning/79

## Out of scope

- Production-grade tmpfile hardening (umask, atomic create-
  with-exclusive-lock) — overkill for this maintainer-tooling
  surface; the mkdtempSync + tmpdir() fix is the canonical
  shape for the threat model
- Migrating to a non-tmpdir output location (e.g., per-user
  `~/.cache/zeta/peer-call/`) — separate concern about
  output-lifecycle / cleanup; can land later

## Origin

CodeQL alert surfaced 2026-05-13 during PR #2949 review (081KRA5AR0008QG0R0011ZGRZT
self-documenting failure marker). Otto filed this row to track
the substrate-consistent fix across all 8 wrappers; resolved the
PR #2949 thread with reference to this row.
