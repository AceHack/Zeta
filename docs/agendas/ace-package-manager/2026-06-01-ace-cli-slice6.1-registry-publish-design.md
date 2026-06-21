# Ace CLI slice 6.1 — `ace registry publish` (design)

> Spec for slice 6.1 of the Ace DLC package manager (081KR2E4K0008QG0R002YE3MMD / 081KT07NV0008QG0R0016FVWD7). The **producer**
> counterpart to slice 6 (081KT07NV0008QG0R000SJ34AK, remote registry — the consumer side: fetch + verify +
> cache + merge a signed index, merged via #6431). Brainstormed + decided with the operator
> 2026-06-01.

## Goal

Generate + sign a registry **index** that slice-6 consumers accept. Scan a directory of
package files, derive each package's consumer `url` + `package_hash`, assemble the signed
`IndexSignableContent`, bump the monotonic `sequence`, sign with the registry key, and —
crucially — **round-trip self-verify** the produced index through the consumer's own
`parseIndex` + `verifyIndexSignature` so publish can never emit an index the consumer would
reject.

## Decomposition (recap)

- **Slice 6** (081KT07NV0008QG0R000SJ34AK, merged #6431): the **consumer** side — `registry-remote.ts` fetches a
  signed index, verifies it (mandatory-pin signature + monotonic-sequence anti-rollback +
  two-sided freshness), caches it (conditional GET), merges it under the local registry.
- **Slice 6.1** (this spec, 081KT07NV0008QG0R0016FVWD7): the **producer** side — `ace registry publish` builds +
  signs the index document a registry serves. This inverts the consumer: sign-to-produce,
  then parse+verify to self-check.

## Decisions (this spec locks them; operator 2026-06-01)

1. **Input = directory scan.** `--packages <dir>` indexes every `*.json` in the directory
   that shape-validates as an `AcePackage` (`{ manifest, files }`); non-packages are skipped
   with a stderr warning. One dir = one published index.
2. **URL = `--base-url` + name-version convention.** `url = <base-url>/<name>-<version>.json`
   — the exact convention the slice-5/6 lockfile + index examples already use (e.g.
   `https://pkgs/leaf-1.0.0.json`). Per-package url override is deferred (operator: "1 then
   maybe 2").
3. **Sequence = auto-bump from `--out`.** If the `--out` file already exists + parses as an
   index, `sequence = prev.sequence + 1`; else `sequence = 1`. A guard refuses a computed
   sequence `<= prev` (cannot happen with `+1`; documents intent + protects a future
   explicit-sequence flag) — the publish-side mirror of the consumer's anti-rollback gate.
4. **Scope = core + round-trip self-verify.** dir-scan + `--base-url` + `--key <pem-path>` +
   sequence-bump + `signIndex` + write `index.json`, AND re-parse the written index through
   the consumer's `parseIndex` + `verifyIndexSignature` (against the signing key's derived
   public key) before exit. Deferred: per-package url override, ETag/Last-Modified sidecar,
   multi-dir, incremental/delta publish.

## CLI

```text
ace registry publish --packages <dir> --base-url <url> --key <pem-path> [--out <path>]
```

- **`--packages <dir>`** (required) — directory of package `*.json` files to index.
- **`--base-url <url>`** (required) — base for the per-package consumer url
  (`<base>/<name>-<version>.json`; a trailing `/` on `<base>` is normalized so the result
  has exactly one separator).
- **`--key <pem-path>`** (required) — path to an ed25519 **private**-key PEM (PKCS#8, the
  format `generateKeypair()` emits). Read + used by `signIndex`.
- **`--out <path>`** (default `./index.json`) — write target **and** the prev-sequence
  source for the auto-bump.

Missing any required flag → parse error (same shape as the existing `registry remote add`
parse errors).

## The signed-index contract (unchanged from slice 6)

The produced document is exactly what slice-6's `parseIndex` consumes:

```json
{
  "format_version": 1,
  "sequence": 7,
  "issued_at": "2026-06-01T12:00:00Z",
  "packages": { "leaf": { "1.0.0": { "url": "https://pkgs/leaf-1.0.0.json", "package_hash": "sha256:…" } } },
  "signature": { "algo": "ed25519", "key_id": "ed25519:…", "sig": "<base64>" }
}
```

The `signature` is over `canonicalIndexBytes(content)` (canonical JSON of everything except
`signature`). Because the consumer re-derives those canonical bytes from the **parsed**
document, the on-disk file formatting is irrelevant to verification — so publish
**pretty-prints** the output for human + static-host readability without affecting the
signature.

## Flow

```text
1. read --key PEM                         (read failure → hard error)
2. scan --packages dir for *.json:
     parse + shape-guard each              (non-AcePackage → skip + stderr warn)
     package_hash = packageHash(pkg)
     url = joinUrl(base, `${name}-${version}.json`)
     accumulate packages[name][version] = { url, package_hash }
     duplicate name@version in the dir      → hard error (ambiguous)
   no valid packages found                  → hard error (nothing to publish)
3. sequence = nextSequence(prev):
     prev = --out missing            → null   (fresh publish, sequence 1)
          | --out exists && parses   → that
          | --out exists && !parses  → hard error  (do NOT fall back to null)
                see "Corrupt-existing-output is a hard error" below
     n = prev ? prev.sequence + 1 : 1
     guard: n <= (prev?.sequence ?? -1)     → hard error (anti-rollback; unreachable with +1)
4. issued_at = new Date().toISOString()
5. content = { format_version: 1, sequence: n, issued_at, packages }
   signature = signIndex(content, pem)
   doc = { ...content, signature }
6. ROUND-TRIP SELF-VERIFY (never write a broken index):
     reparsed = parseIndex(JSON.stringify(doc))         → must NOT be { error }
     { keyId, public_key } = publicKeyInfoFromPrivatePem(pem)
     trust = Map([[keyId, { public_key }]])
     verifyIndexSignature(content, signature, trust)    → must be { ok: true }
     either fails                                        → hard error, NO write
7. writeFileSync(--out, JSON.stringify(doc, null, 2))   (write failure → hard error)
8. print: "ace: published N package(s) at sequence n → <out>"
```

### Corrupt-existing-output is a hard error

An existing `--out` that exists but does **not** parse as a valid index (truncated /
partially-written / hand-corrupted `index.json`) is a **hard error** — publish refuses
and writes nothing. It must NOT be silently treated as "no previous index" and reset
to sequence `1`.

The reason is the anti-rollback gate, which lives on the **consumer** side: a consumer
that has already seen sequence `7` rejects any later index whose sequence is `≤ 7`. If
publish silently reset a corrupt local `index.json` to sequence `1`, it would emit a
freshly-signed but **un-adoptable** index — valid signature, but every consumer past
sequence `1` refuses it. The corruption is local and transient; the resulting bad
publication is global and sticky. So the unparseable case is caught in the I/O layer
(reading `--out`) **before** `nextSequence` is reached — `nextSequence` only ever sees
`null` (genuinely absent) or a parsed `IndexDoc`, never a corrupt one.

Recovery is explicit and operator-driven: inspect the corrupt file, recover the true
last sequence (e.g. from the static host or a backup), and either repair `--out` to a
parseable index at that sequence or remove it deliberately only when a sequence-`1`
reset is actually intended (a genuinely fresh registry). Publish does not guess.

## Components

### `tools/ace/registry-publish.ts` (new — pure, no I/O)

- `buildIndexDoc(args: { packages: AcePackage[]; baseUrl: string; sequence: number; issuedAt: string; privatePem: string }): IndexDoc | { error: string }`
  — assemble `packages` (compute `packageHash` + `joinUrl` per package; duplicate
  `name@version` → `{ error }`), build `content`, `signIndex`, return `doc`. Pure (the
  caller supplies the already-read package objects + sequence + issuedAt + pem string).
- `nextSequence(prev: IndexDoc | null): number` — `prev ? prev.sequence + 1 : 1`.
- `joinUrl(base: string, file: string): string` — single-separator join
  (`base.replace(/\/+$/,"") + "/" + file`).
- Reuses `packageHash` (resolve.ts), `signIndex` / `IndexSignableContent` / `IndexDoc`
  (signing.ts / registry-remote.ts type).

### `tools/ace/signing.ts` (additive — one helper)

- `publicKeyInfoFromPrivatePem(privatePem: string): { keyId: string; public_key: string }`
  — derive the SPKI-DER base64 public key + its `keyId` from a private PEM (reuses
  `createPublicKey` + the existing `keyId()`), so the publish self-verify can build a
  one-entry trust store. Additive sibling of `signIndex`'s internal key derivation.

### `tools/ace/ace.ts` (additive — `registry publish` sub-verb)

- Extend `RegistryArgs.sub` with `"publish"` + fields `pubPackagesDir`, `pubBaseUrl`,
  `pubKeyPath`, `pubOut`.
- Parse `registry publish` under the existing `if (command === "registry")` block (sibling
  of `remote`), validating the three required flags + optional `--out`.
- Handler: read the key PEM; `readdirSync` the `--packages` dir for `*.json`; read+parse+
  shape-guard each (skip+warn non-packages); read the prev index from `--out` if present
  (**existing-but-unparseable `--out` → hard error**, never reset to sequence 1 — see Flow
  step 3 + "Corrupt-existing-output is a hard error"); `nextSequence`; `buildIndexDoc`;
  **self-verify** (`parseIndex` + `verifyIndexSignature`
  via `publicKeyInfoFromPrivatePem`); `writeFileSync(--out, pretty)`; print summary.
- Reuses `parseIndex` (registry-remote.ts) + `verifyIndexSignature` (signing.ts) for the
  self-verify — the consumer's own gates run against the freshly-produced index.

## Data flow

```text
package dir → [scan + shape-guard + packageHash + joinUrl] → packages map
            → [nextSequence(prev from --out)] → sequence
            → buildIndexDoc → signIndex → doc
            → SELF-VERIFY (parseIndex + verifyIndexSignature)   ← consumer gates
            → write index.json
(then, separately, a consumer: ace registry remote add <url> --key <keyId> → ace install)
```

## Error handling

| Situation | Behavior |
| --- | --- |
| Missing `--packages` / `--base-url` / `--key` | Parse error (exit non-zero) |
| `--key` PEM unreadable / not a valid private key | Hard error |
| `--packages` dir missing / no `*.json` / no valid packages | Hard error ("nothing to publish") |
| A `*.json` that isn't a well-formed `AcePackage` | Skip + stderr warning (not fatal) |
| Duplicate `name@version` across the dir | Hard error (ambiguous index entry) |
| Computed `sequence <= prev` | Hard error (anti-rollback; unreachable with `+1`) |
| Round-trip self-verify fails (parse or signature) | Hard error — **index NOT written** |
| Write to `--out` fails | Hard error |

## Testing

- **`tools/ace/registry-publish.test.ts`** (new, pure unit):
  - `joinUrl` — trailing-slash on base normalized to one separator; no-slash base works.
  - `nextSequence` — `null → 1`; `{sequence:6} → 7`.
  - `buildIndexDoc` — correct `url` (base + `name-version.json`) + `package_hash`
    (`packageHash`) per package; `content.sequence`/`issued_at` set; signature present;
    duplicate `name@version` → `{ error }`.
  - self-verify round-trip — `buildIndexDoc` output re-parses via `parseIndex` and verifies
    via `verifyIndexSignature` against `publicKeyInfoFromPrivatePem(pem)`.
- **`tools/ace/signing.test.ts`** (append): `publicKeyInfoFromPrivatePem` returns the same
  `keyId` as `generateKeypair()` for the same key (round-trips with `signIndex`'s signer id).
- **End-to-end (`tools/ace/ace.test.ts`)** — the strongest test, producer → consumer:
  - write 1-2 signed package files into a temp dir;
  - `ace registry publish --packages <dir> --base-url https://pkgs --key <pem> --out <idx>`
    → exit 0, `<idx>` exists + parses as an index with the expected nodes;
  - re-run publish → `sequence` bumps `1 → 2`;
  - **wire the produced index as a remote** (mocked `fetch` serving `<idx>` for the index
    url + the package bytes for the artifact urls) → `ace install <root-depending-on-leaf>`
    resolves the dep against the **published** index;
  - `registry publish` without `--key` → parse error;
  - a non-package `*.json` in the dir → skipped (warn), publish still succeeds on the rest.
- All gated by `bun test tools/ace/` + strict `bun --bun tsc --noEmit -p tsconfig.json` +
  markdownlint on this doc.

## Scope / YAGNI — deferred (future sub-rows)

- **Per-package url override** (URL-model option 2) — read a url from a sidecar / manifest
  field per package; operator's "1 then maybe 2". → backlog.
- **ETag / Last-Modified sidecar** — emit caching metadata for static hosting (the consumer
  already does conditional GET; this is the producer-side companion). → backlog.
- **Multi-directory / recursive scan** — index packages across several dirs. → backlog.
- **Incremental / delta publish** — emit only the changes since a prior `sequence` (composes
  with 081KT07NV0008QG0R001PHV1ND incremental index). → backlog.
- **Multi-signer publish** — sign with M-of-N keys (composes with 081KT07NV0008QG0R000GGW5E6). → backlog.

## Files touched

- `tools/ace/registry-publish.ts` — **new** (pure: `buildIndexDoc`, `nextSequence`, `joinUrl`).
- `tools/ace/registry-publish.test.ts` — **new** (unit tests).
- `tools/ace/signing.ts` — `publicKeyInfoFromPrivatePem` (additive).
- `tools/ace/signing.test.ts` — `publicKeyInfoFromPrivatePem` test.
- `tools/ace/ace.ts` — `registry publish` parse + handler; usage text.
- `tools/ace/ace.test.ts` — end-to-end producer→consumer integration test.
- `.claude/skills/ace/SKILL.md` — document `ace registry publish`.
- Deferred-enhancement notes carried in 081KT07NV0008QG0R0016FVWD7 (or new sub-rows) alongside the impl PR.
