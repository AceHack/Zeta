# Ace CLI slice 6.2 — `ace registry publish` enhancements (design)

> Spec for slice 6.2 of the Ace DLC package manager (081KR2E4K0008QG0R002YE3MMD / 081KT07NV0008QG0R0016FVWD7). Three deferred
> enhancements to the slice-6.1 producer (`ace registry publish`, merged #6439): a
> per-package URL override, comma-separated multi-directory input, and an explicit
> `--sequence` override. Brainstormed + decided with the operator 2026-06-01. The
> ETag/Last-Modified sidecar (also deferred from 6.1) is **dropped** — see Decisions.

## Goal

Loosen the three rigid assumptions slice 6.1 baked in, without touching the signed-index
contract or the consumer:

1. A package's published `url` no longer has to be `<base-url>/<name>-<version>.json` — a
   package can declare its own hosting URL.
2. Packages no longer have to live in a single directory — `--packages` accepts a
   comma-separated list.
3. The published `sequence` no longer has to be the auto-bump — `--sequence N` sets it
   explicitly (still anti-rollback-gated).

Nothing about the produced index's shape, signature, or the slice-6 consumer changes; these
are producer-side ergonomics.

## Decomposition (recap)

- **Slice 6** (081KT07NV0008QG0R000SJ34AK, #6431): consumer — fetch + verify + cache + merge a signed index.
- **Slice 6.1** (081KT07NV0008QG0R0016FVWD7, #6439): producer core — `ace registry publish` (dir scan, derive
  url + `package_hash`, sign, auto-bump `sequence`, round-trip self-verify, consumer-parity
  input validation, deterministic output).
- **Slice 6.2** (this spec): producer ergonomics — per-package `url`, multi-dir, `--sequence`.

## Decisions (this spec locks them; operator 2026-06-01)

1. **Per-package url = optional top-level `url` field in the package file.** Read an optional
   `url` that is a **sibling of `manifest`/`files`** (i.e. `{ manifest, files, url? }`), NOT
   inside the signed manifest. When present + valid, it is the index entry's `url`; when
   absent, the entry keeps the derived `<base-url>/<name>-<version>.json`. The field is a
   publish-only hint:
   - **`package_hash` is unaffected** — `packageHash` hashes only
     `canonicalJson({ manifest, files })` (resolve.ts), so the `url` hint never reaches the
     hash the consumer pins.
   - **The signed manifest is unaffected** — `url` is outside `manifest`, so the package's
     own signature + `content_hash` gates ignore it.
   - **Validation:** `url` must be a non-empty string that parses as an absolute URL
     (`new URL(url)` succeeds). Otherwise the package is **skipped + warned** (consistent
     with the other scan skips).
   - **`--base-url` stays required** (packages without a `url` field still derive from it).
2. **Multi-dir = comma-separated `--packages a,b,c`.** Split the `--packages` value on
   commas, trim each segment, drop empty segments. Scan every listed directory; each must be
   readable (an unreadable listed dir is a **hard error**, naming that dir — same posture as
   single-dir today). Merge all packages; a duplicate `name@version` **across** dirs is the
   same hard error the single-dir duplicate already produces (ambiguous index entry). A
   single dir (no comma) behaves exactly as in 6.1.
3. **Explicit sequence = `--sequence N`.** Optional. When present, `sequence = N` instead of
   the auto-bump; `N` must parse as a **positive integer** (else parse error). The existing
   anti-rollback guard becomes live: when `--out` already holds a parseable prev index and
   `N <= prev.sequence`, publish is a **hard error** (no write). When absent, sequence
   auto-bumps from `--out` exactly as in 6.1.
4. **ETag/Last-Modified sidecar — DROPPED (not deferred-again; closed as won't-build).** The
   consumer (slice 6) already does HTTP conditional-GET (`If-None-Match` → 304 from the
   host), and 6.1's deterministic byte output already yields a stable host ETag across no-op
   republishes. A producer-emitted sidecar would duplicate the host's job and require new
   consumer support to read it. There is nothing for the producer to emit; the item is
   closed rather than carried forward.

## CLI

```text
ace registry publish --packages <dir>[,<dir>...] --base-url <url> --key <pem-path> [--out <path>] [--sequence <n>]
```

- **`--packages <dir>[,<dir>…]`** (required) — one directory, or a comma-separated list of
  directories, of package `*.json` files to index.
- **`--base-url <url>`** (required) — base for the derived per-package url
  (`<base>/<name>-<version>.json`) for any package **without** a `url` field. Trailing `/`
  normalized to a single separator (unchanged from 6.1).
- **`--key <pem-path>`** (required) — ed25519 private-key PEM (unchanged).
- **`--out <path>`** (default `./index.json`) — write target + prev-sequence source for the
  auto-bump (unchanged).
- **`--sequence <n>`** (optional, **new**) — explicit monotonic sequence; positive integer;
  overrides the auto-bump; still anti-rollback-gated against `--out`'s prev.

Missing any required flag → parse error. `--sequence` present but not a positive integer →
parse error.

## The per-package `url` override

A package file may carry a publish-only `url` sibling:

```json
{
  "manifest": { "format_version": 1, "name": "leaf", "version": "1.0.0", "content_hash": "sha256:…", "signature": { … } },
  "files":    { "leaf.txt": "…" },
  "url":      "https://cdn.example.com/leaf/v1.json"
}
```

- When `url` is present + valid → the index entry for `leaf@1.0.0` uses that exact URL.
- When `url` is absent → the entry uses `<base-url>/leaf-1.0.0.json` (6.1 behavior).

### Interaction with the filename guard (load-bearing)

Slice 6.1 requires the on-disk basename to equal `<name>-<version>.json` *specifically so the
derived URL points at a file the operator actually hosts*. A `url` override removes that
coupling — the URL is explicit, so the on-disk filename no longer needs to encode it.
Therefore:

- **Package WITH a valid `url` override** → the `<name>-<version>.json` **filename guard is
  skipped** for it (its file may be named anything, e.g. `leaf.json` hosted at a CDN path).
  This is the primary use case the override exists for.
- **Package WITHOUT a `url` override** → the filename guard applies exactly as in 6.1
  (basename must be `<name>-<version>.json`).

All other scan guards apply to **both** cases unchanged: reserved-prototype-key identities,
URL-unsafe name/version characters, `content_hash` present + matching `files`,
`dependencies` is a well-formed array of valid edges, every `files` value is a string, no
unsafe `files` paths (`validatePackagePaths`). Duplicate `name@version` (now possibly from
two differently-named files in one dir, or across dirs) → the existing duplicate hard error.

## Flow (deltas from 6.1)

```text
parse:
  --packages → split(',').map(trim).filter(nonempty) → dirs[]   (≥1 required)
  --sequence → if present, parse positive int (else parse error) → seqOverride

scan (per dir in dirs[], each must readdir OK else hard error):
  for each *.json file f in dir:
    parse + shape-guard {manifest, files}                  (non-package → skip+warn)
    content_hash present + matches files                   (else skip+warn)
    read optional top-level `url`:
       absent                         → urlOverride = undefined
       present, non-empty, new URL ok → urlOverride = url
       present but invalid            → skip+warn
    filename guard:
       urlOverride set                → SKIP filename guard
       urlOverride unset              → require f === `${name}-${version}.json` (else skip+warn)
    URL-unsafe identity / deps-array / dep-edge / file-values / validatePackagePaths  (else skip+warn)
    accumulate { pkg, url: urlOverride }     (merge across dirs)
  no valid packages across all dirs          → hard error

sequence:
  prev = read --out (absent → null | parses → IndexDoc | unparseable → hard error)   [6.1]
  seq  = seqOverride ?? nextSequence(prev)
  guard: prev && seq <= prev.sequence        → hard error (anti-rollback; now reachable
                                                via --sequence — the guard goes live)

build + self-verify + write:  unchanged from 6.1
  buildIndexDoc({ packages: {pkg,url?}[], baseUrl, sequence: seq, issuedAt, privatePem })
    per entry: url = entry.url ?? joinUrl(baseUrl, `${name}-${version}.json`)
    package_hash = packageHash(entry.pkg)        (manifest+files only — url hint excluded)
  round-trip self-verify (parseIndex + verifyIndexSignature)   → hard error, no write on fail
  deterministic sort by (name, version)                         [6.1]
  writeFileSync(--out, pretty)
```

## Components

### `tools/ace/registry-publish.ts` (modify)

- **`buildIndexDoc` input shape changes** from `packages: AcePackage[]` to
  `packages: ReadonlyArray<{ pkg: AcePackage; url?: string }>`. Per entry the URL is
  `entry.url` when present, else the derived join of `baseUrl` + `name-version.json`; the
  package hash is `packageHash(entry.pkg)` (unchanged — hashes manifest+files only). Reserved-key + duplicate
  guards unchanged. Deterministic sort by `(name, version)` unchanged (sort on
  `entry.pkg.manifest`).
- `nextSequence`, `joinUrl` unchanged.

### `tools/ace/ace.ts` (modify)

- **Parse** (`registry publish` branch): `--packages` value retained raw; add `--sequence`
  parse → `pubSequence?: number` (positive-int validation, else parse error). Keep
  `pubPackagesDir` field holding the raw (possibly comma-joined) value (handler splits), or
  add `pubPackagesDirs: string[]` — implementation detail for the plan; behavior is the
  comma-split above.
- **Handler:**
  - split `--packages` into `dirs[]`; loop `readdirSync` per dir (each failure → hard error
    naming that dir); accumulate across dirs.
  - per file: read optional top-level `url` (`(obj as { url?: unknown }).url`); validate
    non-empty string + `new URL(url)` parses, else skip+warn; when set, skip the filename
    guard; build the scan entry as `{ pkg: obj as AcePackage, url }`.
  - `seq = parsed.pubSequence ?? nextSequence(prev)`; the existing
    `if (prev && seq <= prev.sequence)` guard now fires for a too-low `--sequence`.
  - pass `{ pkg, url }[]` to `buildIndexDoc`.
  - "no valid packages" message generalized to name the dir list.
- **Usage text** updated for `[,<dir>…]` + `[--sequence <n>]`.

### `.claude/skills/ace/SKILL.md` (modify)

- Document the `url` field (publish-only, outside the signed manifest, overrides the derived
  URL, relaxes the filename requirement for that package), comma-separated `--packages`, and
  `--sequence`.

## Error handling (deltas)

| Situation | Behavior |
| --- | --- |
| `--sequence` not a positive integer | Parse error |
| `--sequence N` with `--out` prev where `N <= prev.sequence` | Hard error (anti-rollback) |
| One of the comma-listed dirs unreadable | Hard error (names the dir) |
| Empty `--packages` after trim/drop-empty (e.g. `","`) | Parse/hard error ("requires a value") |
| Package `url` present but not a non-empty absolute URL | Skip + warn |
| Duplicate `name@version` across dirs | Hard error (ambiguous; existing guard) |
| (unchanged 6.1 cases) | (unchanged) |

## Testing

- **`tools/ace/registry-publish.test.ts`** (extend):
  - `buildIndexDoc` with `{ pkg, url }` entries — entry with `url` uses the override; entry
    without `url` derives `<base>/<name>-<version>.json`; `package_hash` identical whether or
    not `url` is set (hash excludes the hint); duplicate `name@version` still `{ error }`;
    deterministic sort preserved.
- **End-to-end (`tools/ace/ace.test.ts`)** — extend the slice-6.1 publish block:
  - **per-package url:** a package file named `leaf.json` (NOT `leaf-1.0.0.json`) carrying
    `url: "https://cdn/leaf-v1.json"` + a normal `other-2.0.0.json` → publish exit 0; index
    `leaf@1.0.0.url === "https://cdn/leaf-v1.json"`, `other@2.0.0.url ===
    "<base>/other-2.0.0.json"`; `leaf`'s `package_hash` equals `packageHash` of its
    `{manifest,files}` (override didn't perturb the hash).
  - **url override relaxes filename guard:** `leaf.json` WITHOUT a `url` field → skipped
    (filename guard); WITH a valid `url` → indexed. (Confirms the interaction both ways.)
  - **invalid url:** `leaf-1.0.0.json` with `url: "leaf#x"` (not absolute) → skipped + warned.
  - **multi-dir:** `--packages dirA,dirB` indexes packages from both; a `name@version`
    present in both dirs → exit 1 (duplicate); an unreadable listed dir → exit 1.
  - **--sequence:** `--sequence 5` on a fresh `--out` → index sequence 5; re-publish with
    `--sequence 3` against that `--out` (prev sequence 5) → exit 1 (anti-rollback);
    `--sequence 0` / `--sequence abc` → parse error.
  - regression: existing 6.1 publish tests still pass (single dir, derived url, auto-bump).
- Gated by `bun test tools/ace/` + strict `bun --bun tsc --noEmit -p tsconfig.json` +
  markdownlint on this doc + `SKILL.md`.

## Scope / YAGNI

In scope: per-package `url` field, comma-separated multi-dir, explicit `--sequence`.

Out of scope:

- **ETag/Last-Modified sidecar** — **dropped** (Decision 4; consumer conditional-GET + 6.1
  deterministic output already cover it).
- **Recursive subdir scan** — not chosen (comma-list covers the multi-location need
  explicitly + auditably).
- **`--url-map` file / repeatable `--url` flag** — not chosen; the in-file `url` field keeps
  the override self-contained per package.
- **Incremental/delta publish** (081KT07NV0008QG0R001PHV1ND), **multi-signer** (081KT07NV0008QG0R000GGW5E6), **mirror/failover**
  (081KT07NV0008QG0R000K1X7NZ) — separate rows.

## Files touched

- `tools/ace/registry-publish.ts` — `buildIndexDoc` per-entry `{ pkg, url? }` input.
- `tools/ace/registry-publish.test.ts` — per-entry url unit tests.
- `tools/ace/ace.ts` — parse (`--packages` comma-split, `--sequence`) + handler (multi-dir
  scan, read+validate `url`, filename-guard skip on override, sequence override) + usage.
- `tools/ace/ace.test.ts` — per-package-url + multi-dir + `--sequence` e2e tests.
- `.claude/skills/ace/SKILL.md` — document the three enhancements.
- 081KT07NV0008QG0R0016FVWD7 already records these as deferred; the impl PR notes them shipped.
