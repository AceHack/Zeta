# Ace CLI slice 7 — revocation / quarantine (design)

> Spec for slice 7 of the Ace DLC package manager (081KR2E4K0008QG0R002YE3MMD). Lifecycle stage 12
> (revoke/quarantine). A registry can mark a published package version **revoked** (permanent
> hard-refuse) or **quarantined** (soft-refuse, override-able); consumers refuse to
> resolve/install marked versions. Built on the slice-6 signed registry. Brainstormed +
> decided with the operator 2026-06-01.

## Goal

Give a registry operator a way to say "do not use this version" after it is published, and
make consumers honor it. Two severities:

- **revoked** — the version is compromised/malicious; resolve + install **always refuse** it.
- **quarantined** — the version is under review; resolve + install refuse it **by default**,
  but an explicit `--allow-quarantined` installs it.

The marks live inside the already-signed index, so they inherit the signature, the
monotonic-`sequence` anti-rollback, and the freshness gates from slice 6 — a revocation
cannot be "un-seen" by serving an older index (anti-rollback forbids it).

## Decomposition (recap)

- **Slice 6** (081KT07NV0008QG0R000SJ34AK, #6431): consumer — fetch + verify + cache + merge a signed index.
- **Slice 6.1** (081KT07NV0008QG0R0016FVWD7, #6439): producer core — `ace registry publish` (build + sign).
- **Slice 6.2** (#6462): producer ergonomics — per-package url, multi-dir, `--sequence`.
- **Slice 7** (this spec): revocation + quarantine — producer marks; consumer enforces.

## Decisions (this spec locks them; operator 2026-06-01)

1. **Two states.** `revoked` (permanent hard-refuse) and `quarantined` (soft-refuse,
   `--allow-quarantined` override) are distinct, represented as two sibling maps in the index.
2. **`format_version` 2.** A revocation-bearing index is `format_version: 2`. The consumer is
   updated to accept `1` or `2`. A hypothetical `1`-only consumer rejects a `2` index
   (fail-closed — it will not silently install revoked packages it cannot interpret). A plain
   `publish` with no marks stays `format_version: 1`.
3. **Revocation overrides the lockfile.** `ace install` re-checks lockfile-pinned versions
   against the registry's `revoked` set and refuses a locked-but-revoked version; a
   locked-but-quarantined version refuses unless `--allow-quarantined`. Reproducibility yields
   to a security mark.

## Index format (format_version 2)

`IndexSignableContent` gains two optional sibling maps:

```text
revoked:     Record<name, Record<version, RevocationEntry>>
quarantined: Record<name, Record<version, RevocationEntry>>

RevocationEntry = { reason?: string; at: string }   // at = ISO-8601 timestamp
```

- A version's presence in `revoked` (resp. `quarantined`) is the mark; `reason` is an optional
  human string the consumer can surface; `at` records when it was marked.
- The maps are part of the **signed** content. `canonicalIndexBytes` already canonicalizes the
  whole content (recursive key-sort), so the marks are covered by the existing signature with
  no signing change.
- `format_version` is `2` if and only if the index carries a non-empty `revoked` or
  `quarantined`. `format_version` `1` indexes must NOT carry either map (a `1` index with a
  mark is malformed).

Example:

```json
{
  "format_version": 2,
  "sequence": 8,
  "issued_at": "2026-06-01T20:00:00Z",
  "packages": { "leaf": { "1.0.0": { "url": "https://pkgs/leaf-1.0.0.json", "package_hash": "sha256:..." } } },
  "revoked": { "leaf": { "0.9.0": { "reason": "key compromise", "at": "2026-06-01T19:00:00Z" } } },
  "quarantined": { "tool": { "2.0.0": { "reason": "under review", "at": "2026-06-01T19:30:00Z" } } },
  "signature": { "algo": "ed25519", "key_id": "ed25519:...", "sig": "<base64>" }
}
```

## Producer — three subcommands

Each reads the existing `--out` index, **verifies its signature** under `--key` (the
slice-6.1 mutate-guard: refuse to edit an index this key did not sign), edits, bumps
`sequence`, sets the index `format_version` to `2` when a mark remains, re-signs, round-trip
self-verifies, and writes. An existing `--out` is **required** (you cannot mark a version in
a non-existent index); an unparseable `--out` is a hard error (no silent reset).

```text
ace registry revoke      <name>@<version> [--reason "..."] --key <pem-path> [--out <path>]
ace registry quarantine  <name>@<version> [--reason "..."] --key <pem-path> [--out <path>]
ace registry unquarantine <name>@<version>               --key <pem-path> [--out <path>]
```

- **`revoke`** — add `name@version` to `revoked` (with `reason?` + `at = now`). If the version
  is currently `quarantined`, remove it from `quarantined` (revoke supersedes quarantine).
- **`quarantine`** — add `name@version` to `quarantined`. Refuse if the version is already
  `revoked` (revoked is terminal; re-quarantining is meaningless) — hard error.
- **`unquarantine`** — remove `name@version` from `quarantined` (release after review). Hard
  error if it is not currently quarantined. There is **no `unrevoke`** — revocation is
  permanent (and anti-rollback makes un-marking unenforceable across consumers anyway).
- A version need **not** appear in `packages` to be marked — you revoke versions already out
  in the wild that you may no longer host.
- `<name>@<version>` is parsed by splitting on the last `@`; both parts required, else a parse
  error. `--key` required; missing → parse error.

### `publish` carries marks forward

`ace registry publish` (slices 6.1/6.2) builds a fresh index from the package dir(s). It now
**carries forward** `revoked` + `quarantined` from the prev `--out` index (and keeps
`format_version: 2` when either is non-empty). Without this, republishing the catalog would
silently drop every mark — a security hole. The carry-forward is the only `publish` change in
slice 7.

## Consumer — enforce at resolve + install

### Parse (`registry-remote.ts`)

- `parseIndex` accepts `format_version` `1` or `2` (was `=== 1`). On `2`, shape-validate
  `revoked` / `quarantined` if present (each a `Record<string, Record<string, { reason?: string; at: string }>>`;
  `at` required string, `reason` optional string). On `1`, the presence of either map is a
  parse error (malformed).
- `loadRegistries` merges `revoked` / `quarantined` across registries as a **union** (a
  version marked by any trusted registry is marked — security-conservative). The merged
  loaded-registry result exposes `revoked` / `quarantined` alongside `packages`.

### Resolve (`resolve.ts`)

- Thread the merged `revoked` / `quarantined` into resolution and add an
  `allowQuarantined?: boolean` resolve option.
- When a registry edge resolves to a concrete `name@version`: if it is in `revoked` → refuse
  with new `ResolveReason "revoked"` (reason in detail); if in `quarantined` and not
  `allowQuarantined` → refuse with new `ResolveReason "quarantined"`.
- Checks run after the version is concrete and before/with the existing registry-entry +
  signature gates.

### Install (`ace.ts`)

- `ace install --allow-quarantined` — opt into installing quarantined versions (passed through
  to resolve + the lockfile re-check).
- **Lockfile override:** the install-from-lockfile path re-checks every pinned `name@version`
  against the merged `revoked` / `quarantined`: a revoked pin → hard refuse; a quarantined pin
  → refuse unless `--allow-quarantined` (warn when allowed). A pinned version that is fine
  installs as before.

## Components

- **`tools/ace/signing.ts`** — `IndexSignableContent` gains optional `revoked` / `quarantined`
  (`RevocationMap` + `RevocationEntry` types). No change to `canonicalIndexBytes` / `signIndex`
  / `verifyIndexSignature` (they canonicalize the whole content).
- **`tools/ace/registry-revoke.ts`** (new, pure) — `applyRevoke` / `applyQuarantine` /
  `applyUnquarantine`: each takes the prev `IndexSignableContent` + `name` + `version` +
  (`reason?`, `at`) and returns the new `IndexSignableContent` (mark added/removed,
  supersede/terminal rules enforced, `format_version` set to `2` when a mark remains) or
  `{ error }`. Pure — the handler supplies prev + timestamp + does the signing.
- **`tools/ace/registry-publish.ts`** — `buildIndexDoc` gains optional `revoked` /
  `quarantined` carry-forward params (included in the built content; `format_version` 2 when
  non-empty).
- **`tools/ace/registry-remote.ts`** — `parseIndex` v2 + mark shape-guard; `loadRegistries`
  union-merge of marks; loaded result exposes them.
- **`tools/ace/resolve.ts`** — `revoked` / `quarantined` gates + `"revoked"` / `"quarantined"`
  `ResolveReason`s + `allowQuarantined` option.
- **`tools/ace/ace.ts`** — `registry revoke` / `quarantine` / `unquarantine` parse + handlers
  (read-verify-mark-bump-sign-selfverify-write); `publish` carry-forward; `install`
  `--allow-quarantined` + lockfile revocation re-check.
- **`.claude/skills/ace/SKILL.md`** — document the marks, the three subcommands, the consumer
  refusal behavior, and `--allow-quarantined`.

## Flow — producer `revoke` (quarantine/unquarantine analogous)

```text
1. parse  name@version  (split on last '@'; both parts required)  + --key + [--out]
2. read --key PEM; validate ed25519                       (else hard error)
3. read --out index (required):
     missing        → hard error (cannot mark in a nonexistent index)
     unparseable    → hard error (no silent reset)
     parses         → prev
4. verify prev signature under --key                      (else hard error: not your index)
5. content = applyRevoke(prev, name, version, reason, now)
     already revoked → no-op ok (idempotent) OR error?    → idempotent ok
     was quarantined → also removed from quarantined
     → format_version = 2
6. sequence = prev.sequence + 1
7. sign + round-trip self-verify (parseIndex + verifyIndexSignature)   → hard error, no write
8. writeFileSync(--out, pretty);  print "ace: revoked name@version → <out> (sequence n)"
```

## Error handling

| Situation | Behavior |
| --- | --- |
| Missing `<name>@<version>` or `--key` | Parse error |
| `<name>@<version>` not splittable (no `@`, empty part) | Parse error |
| `--out` missing / unparseable | Hard error (cannot mark; no silent reset) |
| `--out` signature does not verify under `--key` | Hard error (not your index) |
| `quarantine` a version already `revoked` | Hard error (revoked is terminal) |
| `unquarantine` a version not currently quarantined | Hard error |
| Round-trip self-verify fails | Hard error — index NOT written |
| Consumer: resolve/install a `revoked` version | Refuse (`"revoked"`; always) |
| Consumer: resolve/install a `quarantined` version | Refuse (`"quarantined"`) unless `--allow-quarantined` |
| Consumer: lockfile pins a now-`revoked` version | `ace install` refuses (revocation overrides pin) |

## Testing

- **`tools/ace/registry-revoke.test.ts`** (new, pure): `applyRevoke` adds to `revoked` + sets
  `format_version` 2 + clears any matching `quarantined`; `applyQuarantine` adds, errors on an
  already-revoked version; `applyUnquarantine` removes, errors when not quarantined; idempotent
  re-revoke.
- **`tools/ace/registry-publish.test.ts`** (extend): `buildIndexDoc` carry-forward includes
  prev `revoked` / `quarantined` + sets `format_version` 2.
- **`tools/ace/registry-remote.test.ts`** (extend): `parseIndex` accepts v2 with marks +
  rejects v1-carrying-marks + shape-guards bad marks; `loadRegistries` union-merges marks.
- **`tools/ace/resolve.test.ts`** (extend): a revoked concrete version → `"revoked"`; a
  quarantined version → `"quarantined"` without `allowQuarantined`, resolves with it.
- **End-to-end (`tools/ace/ace.test.ts`)** — publish an index; `revoke` a version → index
  becomes v2 with the mark, sequence bumps, re-signs + self-verifies; a consumer resolving the
  revoked version refuses; `quarantine` → refuses without `--allow-quarantined`, installs with
  it; `unquarantine` → installs again; `revoke` on a quarantined version moves it; `publish`
  after a revoke preserves the mark; `revoke` against an index signed by a different key →
  refused; lockfile-pinned-then-revoked → `ace install` refuses.
- Gated by `bun test tools/ace/` + strict `bun --bun tsc --noEmit -p tsconfig.json` +
  markdownlint on this doc + `SKILL.md`.

## Scope / YAGNI

In scope: `revoked` + `quarantined` maps in a `format_version` 2 signed index; `revoke` /
`quarantine` / `unquarantine` producer subcommands; `publish` carry-forward; consumer refusal
at resolve + install; lockfile override; `--allow-quarantined`.

Out of scope:

- **`unrevoke`** — revocation is permanent by design.
- **Separate CRL at its own URL** — the in-index list suffices; a standalone revocation feed
  composes later with TUF roles (081KT07NV0008QG0R001K340B3).
- **Time-boxed auto-expiry of quarantine** — quarantine is cleared explicitly via
  `unquarantine`.
- **Version-range marks** (revoke `<2.0.0`) — exact `name@version` only for now.

## Files touched

- `tools/ace/signing.ts` — `revoked` / `quarantined` on `IndexSignableContent` + types.
- `tools/ace/registry-revoke.ts` — **new** (pure `applyRevoke` / `applyQuarantine` /
  `applyUnquarantine`).
- `tools/ace/registry-revoke.test.ts` — **new**.
- `tools/ace/registry-publish.ts` — `buildIndexDoc` mark carry-forward.
- `tools/ace/registry-remote.ts` — `parseIndex` v2 + `loadRegistries` mark union-merge.
- `tools/ace/resolve.ts` — revoked/quarantined gates + reasons + `allowQuarantined`.
- `tools/ace/ace.ts` — revoke/quarantine/unquarantine subcommands; install `--allow-quarantined`
  + lockfile re-check; publish carry-forward wiring.
- `tools/ace/{ace,registry-publish,registry-remote,resolve}.test.ts` — tests above.
- `.claude/skills/ace/SKILL.md` — document slice 7.
