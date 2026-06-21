# Ace CLI — slice 3: authenticity / Ed25519 signature verify (design)

> **Status:** design APPROVED by operator 2026-06-01 (three forks chosen via
> brainstorming: trust model = **both** bundled-root + user-addable; enforcement =
> **signed-enforced, unsigned needs `--allow-no-signature`**; scope = **verify + trust
> add + minimal `ace sign`**). This doc is the faithful transcription for review
> before the implementation plan. Updated 2026-06-01 for PR #6315 review findings
> (keygen key permissions; `--allow-no-signature` override scope; whole-manifest
> canonicalization; resolvable custody-doc link; content_hash-vs-manifest
> canonicalization distinction).

Builds on slice 1 (`bun link` distribution + skill surface, #6301) and slice 2
(content-hash **integrity** install/verify, #6308). Slice 2 deliberately shipped
integrity-only and printed an explicit "NOT authenticity-verified" line so the gap
was loud, not a green-by-skip. **Slice 3 closes that gap.**

## 1. Why — the load-bearing security invariant

Per the distribution design §5: the skills store is an **untrusted distribution
surface**, so signature-verify must run **at install time**, not just `list` time.
081KR2E4K0008QG0R002YE3MMD's acceptance criteria call for "content-addressed, **signed** packages" +
"signature verification on install." Slice 2 gave content-addressing + integrity;
slice 3 gives **authenticity** — proof a package came from a holder of a trusted
private key, not just that its bytes match their own self-declared hash (a hash the
attacker also controls when they control the distribution surface).

## 2. Decisions (settled)

| Fork | Decision | Why |
|---|---|---|
| **Primitive** | Ed25519 via `node:crypto` | Zero dependency, Node-floor portable (verified: sign/verify work, 44-byte SPKI keys) — matches the slices 1–2 zero-dep ethos. Not a fork; settled by the ethos. |
| **Trust anchors** | **Both** — bundled root file (in-repo) ∪ user store (`~/.ace`) | Repo ships a root-of-trust anchor; operator extends it with third-party publisher keys. |
| **Enforcement** | **Signed-enforced.** Three distinct cases (see §6): valid trusted sig → install; **bad sig → hard refuse always**; **present-but-untrusted-key sig → hard refuse always** (operator must `ace trust add` the key — NOT overridable); **genuinely unsigned (no `signature` field) → refuse unless `--allow-no-signature`** (loud). | `--allow-no-signature` means "this package carries no signature, proceed anyway" — it **never** bypasses a *present* signature. Otherwise an attacker could staple a junk/untrusted signature and ride the override path, defeating signed-enforcement. Genuinely-unsigned stays overridable so slice-2 integrity-only packages aren't bricked. |
| **Scope** | **verify + `ace trust add` + minimal `ace sign`** (+ `keygen`) | Full produce→sign→trust→verify loop is in-tool + dogfoodable; testable end-to-end. |

## 3. Signature format (additive, back-compatible)

A signature is computed over the **entire canonical manifest with its own
`signature` field removed** — and the manifest already carries `content_hash`
(sha256 of the `files` JSON, slice 2), so **one signature binds both identity
(name/version) and content** without inventing a second hash.

- **Canonical manifest bytes (for the signature):** the manifest object with the
  `signature` field removed, serialized as **deterministic canonical JSON —
  recursively key-sorted, no insignificant whitespace** (an RFC 8785 / JCS-style
  canonicalization; for the MVP: recursively sort all object keys then
  `JSON.stringify`, stable for the manifest's string/integer value types).
  **The whole object is covered, not a fixed field allowlist** — so every present
  field AND any future field is bound by the signature. (An allowlist would be a
  footgun: a later reader could act on a new field that an old signature never
  bound. Covering the whole object closes that.)
- **`content_hash` uses a DIFFERENT canonicalization, on purpose — and is UNCHANGED
  from slice 2.** `content_hash` = `sha256(JSON.stringify(pkg.files))` (the existing
  `contentHash` in `store.ts`, **insertion-order**, no sorting). The manifest's
  recursive-key-sort canonicalization above applies to the **manifest**, NEVER to
  `files`. `ace sign` MUST reuse the slice-2 `contentHash` function **verbatim**
  when it recomputes/checks `content_hash`, so the signer's hash always equals what
  `installPackage` recomputes at install time. Applying the sorted canonicalization
  to `files` would disagree with the slice-2 installer → `ace sign` would refuse a
  package `installPackage` accepts, or sign a hash the installer can't reproduce.
  Do not do it. (Making `content_hash` itself order-independent is a separate
  pre-existing slice-2 concern, deferred to 3.1 — §10.)
- **`manifest.signature`** (new, optional): `{ algo: "ed25519", key_id, sig }`
  where `sig` = base64 of the raw 64-byte Ed25519 signature. The `signature` field
  itself is excluded from the canonical bytes (you can't sign over the signature).
- **`key_id`** = `"ed25519:" + sha256(<SPKI-DER public key bytes>).hex().slice(0,16)`
  — selects which trusted key the verifier checks against.
- **Absent `signature`** = unsigned. Every slice-2 package is a valid unsigned
  package (back-compat).

## 4. Trust model — bundled ∪ user

- **Bundled root:** `tools/ace/trusted-keys.json`, checked into the repo, ships as
  an **empty JSON array `[]`**. This design does **NOT fabricate a Zeta root
  keypair** — minting the real root key is an operator custody ceremony (the
  private key must be held per the
  [agent-native key-custody design](../../research/2026-05-31-agent-native-key-custody-design-otto-holds-key-aaron-cant-access-wont-lose-threshold-attestation-honest-debug-dump-limit.md)),
  out of scope here. Slice 3 builds the *mechanism* that reads the bundled anchor;
  the anchor starts empty and is populated by that later ceremony.
- **User store:** `~/.ace/trusted-keys.json` (sibling of `~/.ace/store`), managed
  by `ace trust add`. Created on first add.
- **Schema (both files):** JSON array of
  `{ key_id, public_key, label?, added? }` where `public_key` = base64 SPKI-DER.
- **`loadTrustStore(bundledPath, userPath)`** → `Map<key_id, { public_key, label,
  source: "bundled" | "user" }>`. User entries override bundled on key_id
  collision. With both empty (the default until a key is added), **every** package
  is untrusted → genuinely-unsigned ones need `--allow-no-signature`, and any
  present-but-untrusted signature is hard-refused. That is the honest default:
  nothing is trusted until a key is explicitly added.

## 5. Verbs

| Verb | Form | Behavior |
|---|---|---|
| `keygen` | `ace keygen [--out <prefix>]` | Generate an Ed25519 keypair. Writes `<prefix>.key` (PKCS8 PEM, private) **with owner-only `0600` permissions — secure-create, never world-readable** (see §8) + `<prefix>.pub` (JSON `{ algo, key_id, public_key }`, normal perms). Default prefix `ace-key`. |
| `sign` | `ace sign <pkg> --key <priv> [--out <file>]` | Read package JSON; **recompute `content_hash` using the slice-2 `contentHash(JSON.stringify(files))` from `store.ts`** (NOT the manifest's sorted canonicalization — §3) and **refuse to sign if it doesn't match** (never sign tampered content); build canonical manifest bytes (§3); Ed25519-sign with the private key; set `manifest.signature`; write to `--out` (else stdout). |
| `trust add` | `ace trust add <pub-or-b64> [--label <name>]` | Append a public key to `~/.ace/trusted-keys.json` (create if absent; dedup by key_id). `<pub-or-b64>` = path to a `.pub` file OR a raw base64 SPKI-DER string. |
| `trust list` | `ace trust list` | List trusted keys (bundled ∪ user) with key_id, label, source. |
| `install` | `ace install <url-or-path> [--allow-no-signature]` | **Changed** — adds the authenticity gate (§6). |
| `list` / `verify` / `help` | (unchanged from slice 2) | `verify <hash>` stays a presence check; if the installed manifest carries a signature, it additionally reports the signer. |

## 6. Install enforcement gate

Order (authenticity is checked **before** any extraction, so untrusted content is
never written to disk):

1. Fetch/read source → parse JSON → `pkg` (invalid JSON → exit 65).
2. **Authenticity gate** (load trust store, then `verifySignature(manifest,
   trustStore)`):
   - `signature` present + crypto-valid + `key_id` in trust store → **proceed**
     (record signer).
   - `signature` present but crypto-invalid → **hard refuse** (exit 1):
     `ace: install refused: bad signature`. **Not overridable.**
   - `signature` present but `algo` is not `ed25519` → **hard refuse** (exit 1):
     `ace: install refused: unsupported signature algorithm`. **Not overridable** — the algorithm is pinned verifier-side (algorithm-confusion / JWT-`alg:none` defense).
   - `signature` present but `key_id` not trusted → **hard refuse** (exit 1):
     `ace: install refused: signature from untrusted key <key_id> (ace trust add to trust it)`.
     **Not overridable** — `--allow-no-signature` does NOT apply to a present signature.
   - `signature` **absent** → if `--allow-no-signature`: loud warn + proceed; else
     **refuse** (exit 1): `ace: install refused: unsigned package (use --allow-no-signature to override)`.
3. **Integrity + extract:** `installPackage` (slice-2 content-hash verify-before-
   extract, unchanged — recomputes `content_hash` with the same slice-2 function the
   signer used). Files-vs-content_hash mismatch → refuse (exit 1).
4. **Success print:**
   - signed+trusted → `ace: integrity + authenticity verified (signed by <key_id> <label>) -> <dir>`
   - unsigned+allowed → the slice-2 line: `ace: integrity-verified (content hash). NOT authenticity-verified (--allow-no-signature).`

`verifySignature(manifest, trustStore)` is **pure**: returns
`{ ok: true, key_id, label }` or `{ ok: false, reason: "no-signature" | "untrusted-key" | "bad-signature" | "unsupported-algo" }`. The enforcement *policy* (which reasons refuse-always vs which the `--allow-no-signature` flag may override — **only `no-signature`**) lives in `ace.ts`, not in the crypto.

## 7. Module boundaries

- **`tools/ace/signing.ts`** (NEW, pure crypto, no fs/process): `generateKeypair()`
  → `{ privatePem, publicSpkiB64, keyId }`; `keyId(spkiB64)`; `canonicalManifestBytes(manifest)`
  (whole-manifest-minus-`signature`, recursively key-sorted — §3);
  `signManifest(manifest, privatePem)` → signature object; `verifySignature(manifest, trustStore)`.
  It **imports the slice-2 `contentHash` from `store.ts`** (does not reimplement it)
  so the signer's `content_hash` always matches the installer's. Key-file *writing*
  (incl. the `0600` private-key permission) is I/O and lives in `ace.ts`, not here.
- **`tools/ace/store.ts`** (extended): add `trustStorePath()`, `bundledTrustPath()`,
  `loadTrustStore()`, `addTrustedKey()`, `listTrustedKeys()` — all the `~/.ace`/repo
  trust-file I/O lives here next to `defaultStorePath`/`listInstalled`. **`installPackage`
  and `contentHash` are unchanged** (integrity-only single responsibility; slice-2
  contract + tests intact).
- **`tools/ace/ace.ts`** (extended): `parseArgs` + `main` wire `keygen`/`sign`/`trust`/
  the install gate; orchestrates the enforcement policy; performs the `0600`
  secure-create when writing a generated private key.
- **`.claude/skills/ace/SKILL.md`**: verb table + the integrity-only note updated;
  description stays ≤120 chars (per the audit).
- **`tools/ace/store.ts` slice-3 NOTE**: the CodeQL http-to-file comment updated —
  authenticity now exists (the source-trust defense the note said was slice 3).

## 8. Threat model (honest)

**Defends:** a malicious or compromised **distribution surface** (the untrusted
skills store) — an attacker who controls the bytes cannot forge a signature without
a trusted **private** key, cannot reuse another package's signature (the signature
binds name+version+content_hash via the whole-manifest canonicalization), and
**cannot bypass verification by stapling an untrusted/garbage signature** (a present
signature is always validated; only a genuinely-absent one is
`--allow-no-signature`-overridable).

**Private-key permissions (PR #6315 P1):** `ace keygen` writes the PKCS8 private
key with **owner-only `0600`** (secure-create — open with mode `0o600`, or write
then `chmod 0o600` before any secret bytes are flushed; never rely on the umask).
A world-readable signing key on a shared machine lets another local user sign
packages as that trusted publisher, silently defeating the trust model. The `.pub`
file uses normal permissions. (On Windows, POSIX mode bits are advisory — `node:fs`
applies what the platform supports; the owner-only intent is documented and applied
where the OS honors it.)

**Does NOT defend:**

- An operator tricked into `ace trust add`-ing an attacker's key — that is an
  operator trust decision, outside the tool's control (the tool makes the trust set
  explicit + inspectable via `trust list`).
- **Private-key custody** — where a publisher's private key lives long-term is a
  publisher concern (`ace keygen` produces one with `0600`; secure storage/HSM
  references the
  [agent-native key-custody design](../../research/2026-05-31-agent-native-key-custody-design-otto-holds-key-aaron-cant-access-wont-lose-threshold-attestation-honest-debug-dump-limit.md);
  not implemented here).
- **Revocation / rotation** — no CRL/expiry in this slice (a compromised key is
  removed by editing the trust store). Tracked for 3.1.
- **Guardian-AI oversight** (081KR2E4K0008QG0R002YE3MMD AC) — not in this slice.

## 9. Testing

- **`tools/ace/signing.test.ts`** (new): keygen→sign→verify roundtrip; tampered
  manifest (mutated `content_hash`) → `bad-signature`; tampered manifest (mutated
  an arbitrary/unknown field) → `bad-signature` (proves whole-manifest coverage,
  not a fixed allowlist); key not in trust store → `untrusted-key`; missing
  signature → `no-signature`; `key_id` deterministic + stable; `canonicalManifestBytes`
  identical regardless of input key order; **a signed package's `content_hash`
  matches the slice-2 `contentHash` so `installPackage` accepts it** (signer/installer
  agreement).
- **`tools/ace/store.test.ts`** (additions): `loadTrustStore` union (bundled ∪
  user); `addTrustedKey` creates + dedups; user overrides bundled on key_id;
  `listTrustedKeys` reports source.
- **`tools/ace/ace.test.ts`** (additions): install signed+trusted → ok + authenticity
  message; install bad-sig → refused (exit 1); install untrusted-key → refused
  **even with `--allow-no-signature`** (override does not apply to a present signature);
  install unsigned → refused without flag; install unsigned `--allow-no-signature` → ok
  + warn; `keygen` writes the private key `0600` (assert the mode on POSIX; skip the
  mode assertion with a printed note on Windows per the shield rule);
  `sign`/`trust add`/`trust list` parse + roundtrip; `sign` of a tampered package → refused.
- Gates (per the slice-2 discipline): `bun test tools/ace/` all pass; `tsc` clean on
  `tools/ace`; `ace help`/`list`/`verify` smokes; `markdownlint` SKILL.md; commit
  canary `git ls-tree HEAD | wc -l` unchanged except the new `signing.ts` /
  `signing.test.ts` / `trusted-keys.json` additions.

## 10. Out of scope → follow-ons (3.1+)

- Real Zeta root keypair ceremony (operator custody;
  [agent-native key-custody design](../../research/2026-05-31-agent-native-key-custody-design-otto-holds-key-aaron-cant-access-wont-lose-threshold-attestation-honest-debug-dump-limit.md)).
- **Making `content_hash` canonicalization order-independent.** Slice 2 computes it
  as `sha256(JSON.stringify(pkg.files))` (insertion-order), so two semantically
  identical packages with different `files` key order hash differently. Changing it
  now would break the slice-2 `installPackage` contract + tests + every existing
  package, so slice 3 keeps it verbatim (signer reuses the same fn — §3); making it
  canonical is a separate, back-compat-breaking change deferred here.
- Key rotation / revocation / expiry.
- Guardian-AI oversight (081KR2E4K0008QG0R002YE3MMD AC).
- Interop with `minisign` / `sigstore`/`cosign` signature formats (this slice uses
  our own compact Ed25519-over-canonical-manifest format).
- Standalone `bunx`/bare-machine bootstrap; the bus↔Ace shared-fold-engine refactor
  (#6284 / 081KSXN940008QG0R0033T2BQT).

## Plan shape (4 tasks, subagent-driven like slices 1–2)

1. `signing.ts` — Ed25519 primitives (whole-manifest canonicalization; imports slice-2 `contentHash`) + `signing.test.ts` (pure, no I/O).
2. Trust store in `store.ts` + bundled `trusted-keys.json` + `store.test.ts` additions.
3. `ace.ts` — `keygen` (with `0600` private key) / `sign` / `trust` verbs + install
   authenticity gate (`--allow-no-signature` overrides only genuinely-unsigned) + `ace.test.ts` additions.
4. `SKILL.md` + the slice-2 "NOT authenticity-verified" line + the store.ts CodeQL NOTE updated.
