# Ace CLI slice 6 — remote registry (design)

> Spec for slice 6 of the Ace DLC package manager (081KR2E4K0008QG0R002YE3MMD / 081KT07NV0008QG0R000SJ34AK). Builds on the
> slice-5.x local registry (5.1 data layer, 5.2 semver+solver, 5.3 lockfile, 5.4
> lockfile ergonomics — all merged). Brainstormed + decided with the operator
> 2026-06-01.

## Goal

Resolve `name@range` against a **hosted, signed** catalog fetched over HTTP(S),
merged **under** the existing local registry, with **all per-package verification
unchanged**. A remote index is untrusted transport carrying a *signed, anti-rollback,
freshness-gated* document; the package bytes it points at are still hash-pinned +
signature-gated exactly as today.

## Decomposition of slice 5→6 (recap)

- **5.1–5.4** (merged): local registry + semver solver + lockfile + lockfile ergonomics.
- **6** (this spec): remote registry — fetch a signed index over HTTP(S), verify it
  (signature + anti-rollback + freshness), cache it (conditional GET), merge it under
  the local registry, and configure remotes via `~/.ace/registries.json` + CLI.

## Decisions (this spec locks them; operator 2026-06-01)

1. **Full index trust now.** The remote index is verified with **three gates**:
   (a) **ed25519 signature** that must match the registry's **mandatory** per-registry
   `key_id` pin **and** be in the trust store (no any-trusted-key fallback — see the
   conflated-authority note below); (b) **anti-rollback** via a per-registry monotonic
   `sequence` high-water mark; (c) **freshness** via an `issued_at` window — bounded both
   in the past (max-staleness) **and** the future (max-skew; Codex #6424 P2).
   A remote registry is never shipped unsigned. (Anti-rollback + freshness are what the
   per-package pin *cannot* provide — they defend availability + version-selection.)
   **Mandatory per-registry key (Codex #6424 P1):** the trust store is the *global
   package-signing* keyring with no registry role separation, so an any-trusted-key
   fallback would let an unrelated package author's key sign a catalog and steer this
   registry's version selection. A remote therefore **must** pin its expected signer
   (`--key` required); the index's `signature.key_id` must equal that pin (and the key
   must still be trusted). Full trust-store role separation (a distinct registry-
   authority role) stays deferred to the TUF-roles backlog row — mandatory per-registry
   pinning closes the conflated-authority gap now without it.
2. **Cache-fallback + `--offline`.** On an unreachable remote, use the last cached index
   if present, else continue local-only **with a warning**. An `--offline` flag skips
   remotes entirely. Composes with `--frozen` (already registry-independent).
3. **Conditional-GET caching.** ETag / `If-None-Match` + `Last-Modified` /
   `If-Modified-Since` revalidation; content-addressed body cache under
   `~/.ace/registry-cache/`; revalidate each resolve (honors HTTP caching headers).
4. **`registries.json` + CLI subcommands.** Ordered remotes in `~/.ace/registries.json`;
   `ace registry remote add <url> --key <keyid> [--max-staleness-days <n>]` / `list` /
   `rm`. **Precedence: user > bundled > remote[0] > remote[1] > …** (local always
   overrides remote; first-listed remote wins among remotes), mirroring the existing
   bundled∪user override.

## Index format (served at the remote URL)

JSON, signed over the existing canonical-JSON discipline (`canonicalJson` in
`resolve.ts`, exported in 5.3).

```json
{
  "format_version": 1,
  "sequence": 7,
  "issued_at": "2026-06-01T12:00:00Z",
  "packages": {
    "leaf": { "1.0.0": { "url": "https://…/leaf-1.0.0.json", "package_hash": "sha256:…" } },
    "mid":  { "2.3.0": { "url": "https://…/mid-2.3.0.json",  "package_hash": "sha256:…" } }
  },
  "signature": { "algo": "ed25519", "key_id": "ed25519:…", "sig": "<base64>" }
}
```

- `format_version`: `1`. Any other value → hard refusal (forward-compat guard; no silent
  migration this slice).
- `sequence`: monotonic non-negative integer per registry. The **anti-rollback** gate.
- `issued_at`: RFC3339 UTC. The **freshness** gate.
- `packages`: `name → version → { url, package_hash }` — the **same `RegistryEntry`
  shape** the solver already consumes (`store.ts`). The signature covers
  `canonicalJson({ format_version, sequence, issued_at, packages })` (everything except
  `signature`).
- `signature`: `AceSignature` shape (`{ algo: "ed25519", key_id, sig }`), reusing
  `signing.ts`. The `sig` is over the canonical bytes above.

## Components

### `tools/ace/signing.ts` (additive — index sign/verify siblings)

Reuse the existing ed25519 + `keyId` + trust-lookup logic; add index-shaped siblings of
`signManifest` / `verifySignature`:

- `type IndexSignableContent = { format_version: number; sequence: number; issued_at: string; packages: Record<string, Record<string, RegistryEntry>> }`
- `canonicalIndexBytes(content: IndexSignableContent): Uint8Array` — `canonicalJson` of
  the content (no `signature` field), UTF-8 encoded. Sibling of `canonicalManifestBytes`.
- `signIndex(content: IndexSignableContent, privatePem: string): AceSignature` — sign the
  canonical bytes (sibling of `signManifest`; used by tests + future publish tooling).
- `verifyIndexSignature(index, signature, trustStore): VerifyResult` — same `VerifyResult`
  union as `verifySignature` (`{ ok, key_id, label } | { ok: false, reason }`); `algo`
  must be `ed25519`; `key_id` must be in the trust store. **Reuses the same ed25519
  verify path** — only the canonical-bytes builder differs.

### `tools/ace/store.ts` (additive — config + cache paths; sync `loadRegistry` unchanged)

- `RemoteRegistryConfig = { url: string; key_id: string; max_staleness_days?: number }`
  (`key_id` is **required** — every remote pins its signer; per Codex #6424 P1).
- `RegistriesConfig = { remotes: RemoteRegistryConfig[] }`
- `registriesPath(): string` → `~/.ace/registries.json` (sibling of `registryPath` /
  `trustStorePath`).
- `readRegistriesConfig(p = registriesPath()): RegistriesConfig` — JSON parse + shape
  guard (untrusted-input discipline: malformed → `{ remotes: [] }`, never throw; drop
  malformed entries).
- `writeRegistryRemote(entry, p)` / `removeRegistryRemote(url, p)` — add/remove a remote
  (used by the CLI subcommands); dedup by `url`.
- `registryCacheDir(): string` → `~/.ace/registry-cache/`.
- The existing **sync `loadRegistry(bundled, user)` is untouched** (local-only path +
  tests). Remote loading is a new async function (below) that *unions on top of* it.

### `tools/ace/registry-remote.ts` (new — fetch + verify + anti-rollback + cache + merge)

Pure-where-possible; the only effectful surfaces are `fetch` + cache file I/O.

- `type IndexDoc = IndexSignableContent & { signature: AceSignature }`
- `parseIndex(json: string): IndexDoc | { error: string }` — JSON parse + full shape
  guard (every field present + correct type; `packages` a well-formed nested record;
  `format_version === 1`; `sequence` a non-negative integer; `issued_at` a parseable
  RFC3339 string; `signature` an `AceSignature`). Untrusted-input discipline (no throw).
- `type CacheMeta = { url: string; etag?: string; last_modified?: string; sequence_high_water: number; index_content_hash: string; fetched_at: string }`
- `readCache(url) / writeCache(meta, body)` — content-addressed: body stored at
  `registryCacheDir()/blobs/<index_content_hash>.json`; meta at
  `registryCacheDir()/<sha256(url)>.json`.
- `verifyIndex(doc, remote, trustStore, cacheMeta, now, opts): { ok: true } | { ok: false; reason }`
  — the **three gates**, in order:
  1. **signature** — `verifyIndexSignature`: the doc's `signature.key_id` must equal the
     registry's **mandatory** `remote.key_id` pin **and** the key must be in the trust
     store. **No any-trusted-key fallback** (Codex #6424 P1 — avoids conflated authority
     with the global package-signing keyring).
  2. **anti-rollback** — `doc.sequence >= cacheMeta.sequence_high_water` (equal = same
     index; greater = newer; lower = rollback → refuse).
  3. **freshness** — a **two-sided** `issued_at` window:
     - **past:** `now - Date.parse(doc.issued_at) <= maxStaleness`
       (`remote.max_staleness_days ?? DEFAULT_MAX_STALENESS_DAYS`, default **30 days**);
     - **future:** `Date.parse(doc.issued_at) - now <= MAX_FUTURE_SKEW` (default
       **5 minutes**) — a far-future `issued_at` makes the past-check pass trivially
       (negative diff), so a skewed/compromised signer could publish a future-dated
       high-sequence index accepted for years; the future-skew bound refuses it
       (Codex #6424 P2).
     The **past** gate is **skipped only** for a cached body under `--offline`; the
     **future-skew** gate is **always** enforced (a future timestamp is never legitimate
     offline either). Signature + anti-rollback always enforced.
- `fetchRemoteIndex(remote, trustStore, opts): Promise<{ entries: Registry } | { error: string } | { skipped: string }>`
  — per-registry orchestration:
  1. read cache meta;
  2. if `opts.offline` → if cached body present, `verifyIndex` (skip **past** max-staleness
     only; **future-skew, sig + anti-rollback all still enforced**) → entries;
     else `{ skipped }` (+ warn);
  3. else conditional GET (`If-None-Match: etag`, `If-Modified-Since: last_modified`):
     - **304** → use cached body → `verifyIndex` (full gates) → entries;
     - **200** → new body → `parseIndex` → `verifyIndex` (full gates) → on pass, update
       cache (etag/last-modified/high-water/content-hash/body) → entries;
     - **network error** → cached body if present → `verifyIndex` → entries (+ warn);
       else `{ skipped }` (+ warn).
  - Any **parse / signature / anti-rollback / freshness** failure on the body chosen for
    use → `{ error }` (HARD refusal — an invalid *signed* index is an attack signal,
    never a degrade-to-local).
- `loadRegistries(opts: { offline?: boolean; trustStore: TrustStore; … }): Promise<{ registry: Registry; warnings: string[]; errors: string[] }>`
  — orchestrates the merge:
  1. `readRegistriesConfig()` → remotes (listed order);
  2. `fetchRemoteIndex` each;
  3. **merge lowest-precedence-first**: remotes in **reverse** listed order, then the
     sync `loadRegistry()` (bundled then user) on top → user > bundled > remote[0] > … ;
  4. returns the same `Registry` map shape → `solve` / `resolve` unchanged. A
     `{ error }` from any remote propagates as a hard failure (caller refuses the
     install/update); `{ skipped }` / cache-fallback produce `warnings`.

### `tools/ace/ace.ts` (additive — CLI surface + async registry load)

- **`ace registry remote add <url> --key <keyid> [--max-staleness-days <n>]`** →
  `writeRegistryRemote`. **`--key` is required** (every remote pins its signer; Codex
  #6424 P1) — omitting it is a parse error. **`ace registry remote list`** → print configured remotes.
  **`ace registry remote rm <url>`** → `removeRegistryRemote`. (New `remote` sub-verb
  under the existing `registry` command; parse + handlers mirror the existing
  `registry add` shape.)
- **`--offline`** added to `install` + `update` arg parsing.
- **Install + update handlers**: replace the synchronous `loadRegistry()` call with
  `await loadRegistries({ offline, trustStore })`; surface `warnings` (stderr) and
  treat `errors` as a hard refusal **before** solve. Everything downstream (solve →
  resolve → preflight → extract → lockfile) is unchanged — it consumes the merged
  `Registry` identically.
- `--frozen` is unaffected (it never consults the registry); `--frozen` + `--offline`
  is allowed (both skip the network).

## Data flow

```text
install (graph): read root → verify → loadRegistries(offline?)              ┐
  └─ for each remote (listed order):                                        │ remote
       cache meta → [offline? cached : conditional GET] → parseIndex        │ merge
       → verifyIndex(signature, anti-rollback, freshness) → cache update    │ (once,
  └─ merge: remotes(reverse) ∪ bundled ∪ user  → Registry                   ┘ up front)
  → solve → resolve → preflight → extract → buildLockfile → write   (UNCHANGED)
--frozen: read lock → replay (registry untouched)                   (UNCHANGED)
```

## Error handling

| Situation | Behavior |
| --- | --- |
| Remote unreachable, cache present | Use cache + warn |
| Remote unreachable, no cache | Skip remote + warn (continue local-only) |
| `--offline`, cache present | Use cache; **skip past max-staleness only** (future-skew still enforced); sig + anti-rollback still enforced |
| `--offline`, no cache | Skip remote + warn |
| `304 Not Modified` | Use cached body (full gates) |
| Index parse / shape / `format_version ≠ 1` | **Hard refusal** (named registry) |
| Index signature bad / untrusted / not-the-pinned-key | **Hard refusal** (attack signal; pin is mandatory) |
| Index `sequence < high-water` | **Hard refusal** (rollback) |
| Index too stale (`issued_at` past max-staleness) | **Hard refusal** (freshness); `--offline` skips this gate on cache |
| Index `issued_at` in the future beyond max-skew | **Hard refusal** (clock-skew / compromised-signer guard; always enforced, incl. `--offline`) |

## Testing

- **`tools/ace/registry-remote.test.ts`** (new, pure where possible; `fetch` mocked):
  - `parseIndex` shape-guard (missing/typed-wrong fields, bad `format_version`,
    non-integer `sequence`, unparseable `issued_at`) → `{ error }`, no throw.
  - signature: good / bad-sig / trusted-but-not-the-pinned-key refused (via a `signIndex`
    test helper + `generateKeypair`); the `remote.key_id` pin is always enforced.
  - anti-rollback: `sequence < high-water` refused; `==` and `>` accepted; high-water
    persists across fetches.
  - freshness: stale (past) `issued_at` refused; **future-dated `issued_at` beyond
    max-skew refused** (always, incl. `--offline`); `--offline` skips only the past
    staleness gate on a cached body.
  - caching: conditional GET — **304 uses cache**, **200 updates cache**, body is
    content-addressed, meta persists etag/last-modified/high-water.
  - offline: `--offline` uses cache; no-cache → skip + warn.
  - merge precedence: remote ∪ local with **local overriding remote**; multiple remotes
    in listed order (first-listed wins among remotes).
- **Integration (`tools/ace/ace.test.ts`)**, reusing the existing global-`fetch` mock +
  registry helpers:
  - `install` resolves a name from a **mocked signed remote index** (empty local
    registry) and installs the pinned package;
  - rollback / stale / bad-signature each → install refused;
  - `--offline` install path uses cache;
  - `ace registry remote add` (with `--key`) / `list` / `rm` round-trip through
    `registries.json`; `add` **without `--key` is a parse error**.
- All gated by the existing local `bun test tools/ace/` + strict whole-repo
  `bun --bun tsc --noEmit` (the `lint (tsc tools)` CI gate) + markdownlint on this doc.

## Scope / YAGNI — deferred (future slices / backlog rows)

- **Mirror / failover** across multiple URLs for the *same* registry → backlog.
- **Incremental / paginated index** (delta updates, range requests) → backlog; slice 6
  fetches a single index document.
- **Full TUF role separation** (root / targets / snapshot / timestamp, key rotation
  ceremonies) → backlog; slice 6 ships a pragmatic signed-index + monotonic-sequence +
  freshness subset that covers the rollback / DoS / version-steering threats 081KT07NV0008QG0R000SJ34AK
  named, without the full TUF apparatus.
- **`ace registry publish`** index-generation tooling beyond the test-helper `signIndex`
  → backlog.
- **Per-registry key rotation / multi-signer thresholds** → backlog (single trusted
  signer or pinned `key_id` this slice).

## Files touched

- `tools/ace/registry-remote.ts` — **new** (fetch + verify + anti-rollback + cache + merge).
- `tools/ace/registry-remote.test.ts` — **new** (unit tests).
- `tools/ace/signing.ts` — `canonicalIndexBytes` + `signIndex` + `verifyIndexSignature`
  (additive siblings; reuse ed25519 + `keyId` + trust-lookup).
- `tools/ace/store.ts` — `RemoteRegistryConfig` / `RegistriesConfig` + `registriesPath`
  + `readRegistriesConfig` / `writeRegistryRemote` / `removeRegistryRemote` +
  `registryCacheDir`; sync `loadRegistry` unchanged.
- `tools/ace/ace.ts` — `ace registry remote add/list/rm`; `--offline` on install/update;
  swap `loadRegistry()` → `await loadRegistries(...)` in the install + update handlers;
  usage text.
- `tools/ace/ace.test.ts` — remote-registry integration tests.
- `.claude/skills/ace/SKILL.md` — document remote registries (config, trust gates,
  `--offline`, precedence).
- Deferred-enhancement backlog rows filed alongside the impl PR (mirror/failover,
  incremental index, TUF roles, publish tooling, key rotation).
