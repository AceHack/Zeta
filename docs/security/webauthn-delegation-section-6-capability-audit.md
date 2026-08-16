# §6 capability audit — WebAuthn device delegation

**Date:** 2026-08-16 · **Author:** Otto (shadow) · **Scope:** §6 only of
[`webauthn-delegation-conformance-checklist.md`](webauthn-delegation-conformance-checklist.md)
(the capability; §0–§5 and §7–§8 are out of scope here).
**Routed by:** Aaron, 2026-08-16 — check the delegation deployment against the checklist.

> *"A flawless verifier in front of an unbounded bearer token is the weaker half doing all the
> work."* — checklist §6. This document audits the stronger half.

## Evidence classes used

Per checklist §9, a count is not evidence and an inspection is not a verification. Every row below
carries one of:

| class | means |
|---|---|
| **VERIFIED** | I executed a check that can fail, **and** I ran a mutation that made it fail |
| **VERIFIED (static)** | I read the enforcing code and confirmed it is reachable; no execution by me |
| **DOCUMENTED-UNVERIFIED** | the property is declared in source or docs; I did not confirm behaviour |
| **DECLARED-ABSENT** | the property is explicitly *not* provided, and says so in the type |
| **UNKNOWN** | I could not determine it from here; the settling test is named |

`AssertedOnly` (the other agent's self-reported suite result) is **not** an evidence class. Nothing
below is derived from that report.

---

## 0. The finding that reframes the rest — the deployment under test is the wrong origin

`idspace-dla-6faa9bmi.manus.space` serves a build of the in-repo site
`demo/identity-dla-site` (title matches: *"Identity Space Boundary — Multi-Oracle DLA"*, and
`PasskeyProposalPanel` is mounted from `OracleRaceMode.tsx:1189`). **But the delegation path in
that code is hard-bound to the GitHub Pages origin at four independent sites**, all in
`demo/identity-dla-site/src/lib/passkeyProposal.ts`:

```ts
export const ZETA_PAGES_ORIGIN = "https://lucent-financial-group.github.io";
// enrollProposalPasskey()   — throws unless window.location.origin === ZETA_PAGES_ORIGIN
// signProposal()            — same guard
// authorizeOperatorDevice() — same guard
// + rp.id / rpId pinned to  "lucent-financial-group.github.io"
```

And the one credential enrolled on `main` today carries that origin:

```json
{ "sequence": 2, "issuedAt": "2026-08-14T15:49:00.000Z",
  "authors": [ { "credentialId": "Ca3BF1v-RDBKvvtBxx70z4Kv5JB5gn_7_kwfbifBK8YYnsDA",
                 "origin": "https://lucent-financial-group.github.io",
                 "rpId":   "lucent-financial-group.github.io", … } ],
  "revoked": {} }
```

Consequences, stated plainly:

1. At the `manus.space` origin the panel **renders but is inert** — enroll, authorize, and sign all
   throw before the authenticator is invoked. No capability can be minted there.
2. Even if one were, `verifyAuthorizedWebAuthnAssertion` rejects on `clientData.origin !== author.origin`,
   so it could never stage a commit.
3. **Therefore the §6 checklist cannot be meaningfully executed against `manus.space`.** It must be
   run against `https://lucent-financial-group.github.io`. Any suite result obtained at the
   `manus.space` origin is measuring a disabled path.

This is a *good* property of the code (the origin pin is doing exactly its job), but it means the
artifact Aaron pointed at and the artifact the checklist targets are not the same surface. Naming
that is the highest-value output of this audit.

**How I know:** static reading of in-repo source, plus two single unauthenticated GETs to the
deployment root (one page fetch, one header fetch). I did not probe further.

---

## 1. The architecture, as read from source

This matters because §6.6 is unanswerable without it. The browser **never holds a GitHub
credential**. The flow is:

```
PWA (Pages origin)
  │ passkey assertion (UV required) over SHA-256(canonical delegation intent)
  ├──► SignedDeviceDelegation   { deviceId, devicePublicKeyJwk, capability{…}, validity }
  │      device keypair: non-exportable P-256, IndexedDB
  │ device-key ECDSA over SHA-256(canonical proposal intent)
  ├──► SignedDeviceProposal     { baseSha, patchDigest, delegationDigest, expiresAt }
  │
  ▼ POST http://127.0.0.1:8787/v1/delegated-device-proposals    (loopback relay, origin-checked)
local companion  ──► `gh issue create`  (uses gh's OWN credential store; never sent to browser)
  │
  ▼ GitHub issue (base64url submission body)
.github/workflows/passkey-proposal-gated-commit.yml   (on: issues.opened)
  └─ proposal-gated-commit-runner.ts
       verify → apply patch → write receipt → commit → push (GITHUB_TOKEN)
       → gh pr create (ZETA_PR_ARCHIVE_TOKEN)
       → required checks remain the merge authority
```

Two properties worth stating because they are easy to miss:

- **The capability never authorises a merge.** Its single action is `"stage-review-branch"`. Merge
  authority stays with the repo's required checks. That is a materially smaller grant than "commit
  on my behalf" implies.
- **The capability cannot modify its own authority.** `PROTECTED_PATHS` refuses any patch touching
  `.github/`, `docs/security/`, the verifier sources, or `demo/identity-dla-site/` itself.

---

## 2. §6 line-by-line register

### §6.1 — explicit scope (repos, branches, operations) · **VERIFIED**

Scope is a *type*, not a convention — `delegated-device-proposal-contract.ts`:

```ts
interface DeviceProposalCapability {
  readonly action: "stage-review-branch";              // one operation, not a grant class
  readonly baseRef: "main";
  readonly branchPrefix: "heartbeat/proposal-";        // branch namespace
  readonly maxPatchBytes: number;                      // ≤ 32 KiB hard ceiling
  readonly pathPolicy: "zeta.proposal-protected-paths.v1";
}
```

Enforced **at the executor**, not the UI:
`validCapability()` refuses any deviation including `maxPatchBytes > DEVICE_PROPOSAL_HARD_MAX_PATCH_BYTES`;
`validateProposalShape()` refuses `Buffer.byteLength(payload) > delegation.capability.maxPatchBytes`;
`patchPaths()` refuses protected paths, path traversal (`..`), absolute paths, and rename-style
headers where `a/` and `b/` differ.

**Executed:** `bun test delegated-device-proposal.test.ts` → 10/10 pass (DDP-7 and DDP-10 re-sign the
mutated patch with the *real* device key, so they test the path policy and not merely the signature —
that is what makes them non-vacuous).

**Mutation that proves non-vacuity (I ran this):** setting `PROTECTED_PATHS = []` in
`proposal-gated-commit.ts` fails exactly **DDP-7** and **DDP-10**, 8 pass / 2 fail. Restored; suite
back to 10/10.

> **Gap, named:** the `maxPatchBytes` over-budget refusal has **no test**. It is a check with no
> failing mutant, which by checklist §9 means that leg is not covered. Staged as **T-1** below.

### §6.2 — capability TTL · **split: DECLARED-ABSENT (capability) / VERIFIED static (proposal)**

The capability **has no TTL, and says so in its own type**:

```ts
readonly validity: "until-authority-revoked";
```

The UI states it too: *"This device is authorized until its root passkey is revoked. Browser-local
agents can queue bounded patches without another biometric prompt."*

So on the literal wording of §6.2 — *"capability carries a TTL and expires"* — **this line does not
pass.** It is refused honestly rather than failed silently, which is the important distinction: the
verifier requires `validity === "until-authority-revoked"` exactly, so no capability can smuggle a
different lifetime in either direction.

The **proposal** (one use) does carry a TTL: `DEVICE_PROPOSAL_MAX_LIFETIME_MS = 5 min`, plus
`MAX_FUTURE_SKEW_MS = 30 s`, plus a `baseSha === currentMainSha` freshness check that invalidates a
proposal the moment `main` advances. Verified static in `validateProposalShape`; the stale-base leg
is executed by DDP-6.

Net: **long-lived capability, short-lived uses.** That is a defensible design, but it means
revocation (§6.3) is the *only* thing standing between a compromised device and unbounded proposal
staging. §6.3 is therefore load-bearing in a way it would not be if a TTL existed.

### §6.3 — revocable, revocation immediate · **VERIFIED (with two caveats)**

Two independent revocation paths, both checked on every proposal:

- **Author/root passkey** — `registry.revoked[credentialId]` → `revoked-author`
  (`proposal-verifier.ts:365`, inside `verifyAuthorizedWebAuthnAssertion`, so the delegated path
  inherits it). Revoking the root passkey revokes every device delegated from it.
- **Individual device** — `registry.revokedDevices[deviceId]` → `device-key`
  (`delegated-device-proposal.ts`).

**Mutation that proves non-vacuity (I ran this):** replacing both revocation conditions with
`if (false)` fails exactly **DDP-5** and **DDP-9**, 8 pass / 2 fail. Restored.

**Immediacy:** the workflow checks out `main` at run time and reads the registry from that checkout,
so a merged revocation is effective for every proposal issued after the merge. Revocation latency =
time to merge a registry change. Not instant, but bounded and legible.

> **Caveat 1 — `revokedDevices` is optional and absent from `main`.** The registry on `main` has
> `"revoked": {}` and **no `revokedDevices` key at all**. The verifier handles that safely
> (`?.` → `undefined` → no revocation), so this is not a bug; but it means the device-level
> revocation surface has never been populated and its first use will be its first exercise.
>
> **Caveat 2 — bumping `sequence` does NOT revoke a delegation.** The two paths differ, and the
> difference is easy to misread as a revocation lever:
>
> | path | check | effect of bumping `sequence` |
> |---|---|---|
> | v2 proposal (`verifySignedProposal`) | `registry.sequence !== proposal.authorRegistrySequence` → reject | **invalidates** all outstanding proposals |
> | device delegation (`validateDelegation`) | `delegation.authorRegistrySequence > registry.sequence` → reject | **no effect** — older sequences stay valid |
>
> This is consistent with `validity: "until-authority-revoked"` and is almost certainly intended.
> It is recorded here because an operator reaching for "bump the sequence" as an emergency revoke
> would believe they had revoked a device and would be wrong. **Use `revoked` / `revokedDevices`.**

### §6.4 — bound to the device key (proof-of-possession) · **VERIFIED (static)**

Not a bearer token. The binding chain:

- device keypair is **non-exportable P-256** — `browser-delegated-device-key.ts` rejects any stored
  key whose `extractable !== false`, and generates via WebCrypto with extractable false;
- `deviceId === SHA-256(canonical devicePublicKeyJwk)`, re-derived and compared by the verifier;
- the delegation JWK is refused if it contains a `d` member (private material);
- every proposal is ECDSA-signed **by the device key** (`verifyDeviceSignature`, `ieee-p1363`,
  fixed 64-byte, non-canonical base64url refused) over the canonical proposal intent, which itself
  contains `delegationDigest`.

So possession of the capability JSON alone is insufficient — an attacker who exfiltrates
`localStorage` gets a signed delegation they cannot use, because the private key is not extractable
from the browser and every proposal needs a fresh signature over `(baseSha, patchDigest, …)`.

DDP-3 executes the "forged signature" leg (all-zero signature → `device-signature`). **What I did
not do** is the checklist's literal test — replay the capability from a *different client*. That
requires a live capability. Staged as **T-2**.

### §6.5 — every use logged with the descriptor it was granted under · **PARTIAL — mechanism exists, unexercised, and the descriptor is not recorded**

A real, in-repo, text audit record exists — `proposal-gated-commit-runner.ts` writes
`docs/observe-events/proposal-receipts/<proposalId>.json`:

```json
{ "schema": "zeta.proposal-receipt.v3", "proposalId": …, "issue": <url>, "baseSha": …,
  "changeDigest": …, "authorityCredentialId": …, "authorRegistrySequence": …,
  "nonce": …, "deviceId": …, "receivedAt": … }
```

written with `flag: "wx"` (fails if it exists), and the commit message carries
`delegated-device:` / `authority-passkey:` / `patch-digest:` trailers. The receipt doubles as the
replay guard (`proposalIdWasConsumed` checks for it on `origin/main`).

Three things to say honestly:

1. **Zero receipts exist.** `GET /repos/Lucent-Financial-Group/Zeta/contents/docs/observe-events/proposal-receipts`
   → **404**. The directory has never been created, so **no proposal has ever been consumed through
   this path**, and the audit mechanism has produced no records. The apparatus is
   **DOCUMENTED-UNVERIFIED end-to-end**, whatever a suite reports about its parts.
2. **The descriptor itself is not recorded.** The receipt pins *which credential* and *which
   device*, but not *the capability descriptor the use was granted under* — `maxPatchBytes`,
   `pathPolicy`, `branchPrefix` and `action` are absent, and so is `delegationDigest`, which would
   pin all of them in 32 bytes. So the §6.5 chain reconstructs
   `action → credential → device`, and **breaks at `→ descriptor`**.
   `proposal.delegationDigest` is already computed and verified by the runner; adding one field to
   the receipt schema would close this. Recommended as the cheapest real improvement in this audit.
3. **The assertion is not stored.** §6.5 asks for `… → assertion`; the receipt keeps digests, not
   the assertion bytes, so a later auditor cannot re-verify the signature from the receipt alone —
   only from the (mutable, deletable) issue body.

### §6.6 — fine-grained App installation token, not a PAT · **the credential finding, stated plainly**

**There is no GitHub credential in browser storage, and no PAT in the PWA.** I verified this by
reading source, not by trusting a report:

- the PWA's only GitHub network calls are **unauthenticated public reads** —
  `api.github.com/repos/…/commits/main` with `Accept:` only, and `raw.githubusercontent.com` for the
  registry. No `Authorization` header is constructed anywhere in `demo/identity-dla-site/`;
- what `localStorage` holds is `zeta-proposal-passkey-credential-id` (a public credential ID) and
  `zeta-proposal-device-delegation-v1` (the signed delegation). Neither is a GitHub credential;
- the panel's own idle string is *"No repository credential is stored or requested by this page."*
  — and unusually, that claim is true as written;
- `browser-delegated-device-proposal-gh-cli.ts` comments the intent and the refusal text enforces
  it: *"Use `gh`'s credential store without exposing a token to the PWA or this adapter"* /
  *"Complete one local `gh auth login` device ceremony and retry without moving the token into the
  browser."*
- DDP-2 asserts the public issue carrier round-trips **without** carrying a credential (it greps for
  `ghp_`). Weak as a test — a `github_pat_` prefix would slip it — but the design makes it moot.

So the line's stated failure condition — *"a PAT in browser storage fails this line"* — **is not
met.** Good.

But §6.6 asks what the underlying credential *is*, and the honest answer is that **there are three,
with three different answers.** Reporting a single verdict here would be the rounding-up the
checklist warns about:

| leg | credential | class |
|---|---|---|
| **commit + push** to the review branch | workflow `GITHUB_TOKEN`, `permissions: contents: write, issues: write` | **PASSES** — a GitHub Actions **App installation token**: repo-scoped, job-lifetime, permissions declared in the workflow file and diffable |
| **open the review PR** | `ZETA_PR_ARCHIVE_TOKEN` (repo Actions secret) | **UNKNOWN** — see below |
| **create the issue** (delivery) | whatever `gh auth login` left in the local `gh` credential store | **fails the spirit of the line** — see below |

**`ZETA_PR_ARCHIVE_TOKEN` — UNKNOWN, and I cannot settle it from here.** Secret *values* are not
readable through the API by design; `gh api /repos/…/actions/secrets` returns names only, and the
name is present. The runner's teaching error says *"configure `ZETA_PR_ARCHIVE_TOKEN` with
Pull requests: write"* — that phrasing is fine-grained-permission vocabulary, consistent with either
a fine-grained PAT or a GitHub App token, and it does **not** discriminate between them. It is a
long-lived, repo-write-capable credential held server-side. Settling test: **T-5**.

**The `gh` credential is the weakest link in the chain, and it is worth being blunt about.**
`gh auth login` by default yields a broad, **user-scoped OAuth token for the GitHub CLI app** — not
a fine-grained App installation token, and not scoped to this repository. So the delivery leg runs
at **full user authority**. Three things bound the damage, and they are real:

- the only action taken with it is `gh issue create` — the least-privileged useful GitHub write;
- the relay binds to **loopback** (`127.0.0.1:8787`) and refuses any `Origin` other than the
  expected one, so a hostile web page cannot reach it cross-origin;
- **nothing the issue says is trusted** — the workflow re-verifies the passkey assertion, the device
  signature, the registry, the freshness, and the path policy before a single byte lands. An
  attacker who owned the `gh` token could open issues; they could not stage a commit, because
  DDP-3 is exactly that attack and it is refused.

Still: an audit of "what GitHub credential does this flow ultimately rest on" must answer *a
user-scoped CLI OAuth token on the operator's laptop*, not *a fine-grained App installation token*.
On the strictest reading of §6.6 that is a **FAIL for the delivery leg**, mitigated to low severity
by the three bounds above. Whether it is *actually* a CLI OAuth token or a PAT injected via
`GH_TOKEN` is local machine state I cannot read: **T-4**.

**Org context, for completeness:** 11 GitHub Apps are installed on `Lucent-Financial-Group`. None is
a delegation-specific app. A `manus-connector` install (app_id 1869309, installed 2026-06-19,
`repository_selection: "all"`) carries `contents: write`, `administration: write`,
`dependabot_secrets: write` and `organization_personal_access_token_requests: write` across **every**
repo. That is unrelated to this flow's design — nothing in the source uses it — but it is a broad
standing grant sharing a name with the deployment under test, and it is worth a separate look that
is outside this §6 scope.

---

## 3. Register summary

| # | property | class | one-line basis |
|---|---|---|---|
| 6.1 | explicit scope | **VERIFIED** | typed capability + executor-side refusal; mutation `PROTECTED_PATHS = []` kills DDP-7/10 |
| 6.1a | `maxPatchBytes` refusal | **DOCUMENTED-UNVERIFIED** | code present, **no test** — no failing mutant exists (**T-1**) |
| 6.2 | capability TTL | **DECLARED-ABSENT** | `validity: "until-authority-revoked"`; refused honestly, not silently |
| 6.2a | proposal TTL | **VERIFIED (static)** | 5 min + 30 s skew + `baseSha` freshness; stale leg executed by DDP-6 |
| 6.3 | revocable | **VERIFIED** | two paths; mutation `if (false)` kills DDP-5/9. Caveats: `revokedDevices` unpopulated; sequence-bump is **not** a revoke |
| 6.4 | device-key bound | **VERIFIED (static)** | non-exportable P-256, `deviceId = H(pubkey)`, per-proposal ECDSA. Cross-client replay not executed (**T-2**) |
| 6.5 | logged with descriptor | **PARTIAL / UNEXERCISED** | receipt v3 exists; **zero receipts on main (404)**; descriptor + assertion **not** recorded |
| 6.6 | App token, not PAT | **SPLIT** | no credential in browser (**pass**) · push = Actions installation token (**pass**) · PR token **UNKNOWN** (T-5) · issue delivery = user-scoped `gh` token (**fail-in-spirit**, T-4) |

**Headline:** the capability half is substantially better built than the checklist's warning
anticipates — scope is typed and enforced at the executor, the token is not a bearer token, and the
capability cannot rewrite its own authority. The three real gaps are **(a)** the audit receipt omits
the descriptor it was granted under, **(b)** the whole path is unexercised — zero receipts — so
every end-to-end claim is `DOCUMENTED-UNVERIFIED`, and **(c)** the ultimate GitHub credential is a
user-scoped CLI token, not a scoped App installation token.

---

## 4. Staged tests — blocked on Aaron's biometric, not on effort

These require a live capability. Minting one requires pressing *"authorize this device"*, which
invokes Aaron's Touch ID — **his gate by standing rule** (*"nothing operator-run, only
operator-approved via biometric — the biometric IS the authorization"*). An agent completing that
ceremony would defeat the property the flow exists to establish, so these are **specified, not run**.

Each states the request, the expected refusal, and the mutation that proves the test is not vacuous.

**Run all of these at `https://lucent-financial-group.github.io`, not at `manus.space`** (see §0).

### T-1 · §6.1 — `maxPatchBytes` is enforced (no biometric needed; pure unit test)

- **Request:** in `delegated-device-proposal.test.ts`, build the standard fixture (its capability is
  `maxPatchBytes: 16 * 1024`) and submit a payload of `16 * 1024 + 1` bytes, re-signed with the real
  device key so only the size differs.
- **Expected:** `{ ok: false, code: "device-proposal" }`.
- **Non-vacuity mutation:** delete the
  `Buffer.byteLength(payload, "utf8") > delegation.capability.maxPatchBytes` clause in
  `validateProposalShape` — the new test must fail and no other test may fail.
- *This is the one staged test that needs no capability and no biometric. It closes the only
  uncovered §6.1 leg and can be written today.*

### T-2 · §6.4 — the capability is not a bearer token

- **Request:** after authorizing a device, copy `localStorage["zeta-proposal-device-delegation-v1"]`
  verbatim into a second browser profile (fresh IndexedDB, therefore a different device key) and
  attempt `submitAutomaticProposal`.
- **Expected:** refusal at the signer — the second profile cannot produce a signature over the
  proposal intent that verifies against `delegation.devicePublicKeyJwk`. If it somehow reaches the
  verifier: `{ ok: false, code: "device-signature" }`.
- **Non-vacuity mutation:** make `verifyDeviceSignature` return `true` unconditionally; the copied
  capability must then succeed. If it still fails, the test was measuring something else.

### T-3 · §6.3 — revocation is effective and immediate

- **Request:** with a working device, (a) confirm one proposal stages a branch; (b) merge a registry
  change adding `"revokedDevices": { "<deviceId>": { "at": "…", "reason": "audit T-3" } }`;
  (c) submit a *fresh* proposal from the same device.
- **Expected:** (a) succeeds; (c) refused with `{ ok: false, code: "device-key" }` and **no branch
  and no receipt created**. Then repeat with `revoked[<rootCredentialId>]` → `revoked-author`.
- **Non-vacuity mutation:** already demonstrated at unit level (`if (false)` kills DDP-5/9); at
  integration level, confirm step (c) *succeeds* if the registry change is reverted — otherwise the
  refusal may be coming from staleness, not revocation.
- **Also record:** the wall-clock latency between merging the revocation and the first refusal. That
  number is the honest answer to "immediate", and it is currently unmeasured.

### T-4 · §6.6 — identify the credential the local relay actually uses

- **Request (local, read-only):** `gh auth status --show-token` on the machine running the relay, and
  `gh api -i /rate_limit | grep -i x-oauth-scopes`.
- **Expected/record:** whether the token is a CLI OAuth user token (scopes like `repo`, `gist`,
  `read:org` — the default) or a PAT injected via `GH_TOKEN`/`GITHUB_TOKEN`, and its scopes.
  `x-oauth-scopes` is empty for fine-grained PATs and App tokens — that emptiness is itself the
  discriminator.
- **Why it matters:** this is the only credential in the chain with authority beyond this repo, and
  §6.6's answer for the delivery leg depends entirely on which it is.
- **Improvement to consider if it is broad:** replace the `gh` shell-out with a dedicated
  fine-grained token scoped to *issues: write on this repo only*. The relay needs nothing else, and
  the change is contained to `browser-delegated-device-proposal-gh-cli.ts`.

### T-5 · §6.6 — identify `ZETA_PR_ARCHIVE_TOKEN`

- **Request (whoever holds it):** check its type at source — GitHub Settings → Developer settings →
  fine-grained tokens (or the App's installation). Then confirm live with
  `curl -sI -H "Authorization: Bearer $TOKEN" https://api.github.com/rate_limit` and read
  `x-oauth-scopes` (present + non-empty ⇒ classic PAT) and `x-ratelimit-limit`
  (5000 ⇒ user token; 15000 ⇒ App installation token on an org).
- **Expected for a pass:** a fine-grained credential limited to
  `Lucent-Financial-Group/Zeta` with `Pull requests: write` and nothing else.
- **Non-vacuity:** confirm it *cannot* read a second private repo in the org — a token that can is
  not scoped, whatever its type.

### T-6 · §6.5 — the audit record links action → capability → **descriptor** → assertion

- **Request:** stage one proposal end-to-end, then open the resulting
  `docs/observe-events/proposal-receipts/<proposalId>.json`.
- **Expected (currently will FAIL):** the receipt should let an auditor reconstruct the exact
  descriptor the use was granted under. Today it records `authorityCredentialId`, `deviceId`,
  `changeDigest`, `nonce`, `baseSha`, `issue` — and **not** `delegationDigest`, `maxPatchBytes`,
  `pathPolicy`, `branchPrefix`, `action`, or the assertion.
- **The fix, and it is small:** add `delegationDigest` (already computed and verified in
  `verifyDelegatedDeviceProposal`) to the receipt schema — it pins the whole descriptor in 32 bytes,
  stays text/hex-in-JSON per `no-binary-in-proof-lineage`, and makes §6.5 checkable rather than
  aspirational. Bump to `zeta.proposal-receipt.v4`.
- **Non-vacuity mutation:** write a receipt with a `delegationDigest` from a *different* delegation;
  an auditing script must reject it. Without such a script the field is decoration.

---

## 4a. Closure log — what has been fixed since this audit was written

> Added 2026-08-16 by Otto (shadow), on a follow-up pass. The findings above are left **exactly as
> originally recorded** — this section is the delta, not a rewrite. Each row below was re-verified
> as still-open against `main` before it was touched.

| audit finding | state | what closed it |
|---|---|---|
| §6.5 — receipt omits the descriptor (`→ descriptor` breaks) | **CLOSED** | `delegationDigest` added to the receipt; schema `zeta.proposal-receipt.v3` → **v4** |
| §6.3 caveat 1 — `revokedDevices` never exercised from registry bytes | **CLOSED (unit)** | DDP-14/15/16 load a fixture registry **from disk** through `loadProposalAuthorRegistry` |
| §6.3 caveat 2 — sequence-bump is not a revoke (operator trap) | **CLOSED** | DDP-11/12/13 pin the asymmetry; a docstring at `validateDelegation` names the levers that do work |
| §6.1a / **T-1** — `maxPatchBytes` refusal has no test | **STILL OPEN** | not attempted on this pass |
| **T-2, T-3, T-4, T-5** | **STILL OPEN** | still require a live capability / local machine state |

### §6.5 — the `→ descriptor` leg

`proposal-gated-commit-runner.ts` now builds receipts through an exported, pure
`proposalReceipt()` and records `delegationDigest` — SHA-256 over the canonical delegation intent,
which covers `action`, `baseRef`, `branchPrefix`, `maxPatchBytes`, `pathPolicy` and `validity`
along with the device key and authority. The value recorded is the one
`validateProposalShape` has **already verified** equals `deviceDelegationDigest(delegation)`, so
the receipt pins a checked value rather than an attacker-supplied one.

The audit's own non-vacuity note — *"without such a script the field is decoration"* — is answered
by `receiptBindsDelegation(receipt, delegation)`, which recomputes the digest and compares it in
constant time, failing closed on a missing or malformed value. PGCR-7 shows a receipt carrying a
**different** delegation's digest is refused.

**Schema migration cost: zero.** Nothing in the repo parses `zeta.proposal-receipt.v3`, and per
§6.5 above there are still **no receipts on `main`**, so there is no v3 artifact to migrate.

### §6.3 — the two caveats

DDP-9 already exercised `revokedDevices`, but against an **in-memory registry object**, which skips
the JSON loader entirely. DDP-14 writes a registry to a real file, loads it through the production
`loadProposalAuthorRegistry`, and only then verifies — so parse, `validRevocations`, and the
loader's propagation of the field are all on the path. DDP-15 is the control that keeps it honest
(same file *without* `revokedDevices` must verify `ok: true`, otherwise the refusal could be a load
failure wearing a revocation's clothes). DDP-16 pins that a malformed entry fails the **load**.

The sequence asymmetry is now pinned by DDP-11 (bump ⇒ still valid), DDP-12 (the `>` clause is
live), and DDP-13 (`revoked` / `revokedDevices` still bite at the bumped sequence).

### Mutation results (each change has a failing mutant)

| # | mutation | tests killed |
|---|---|---|
| M1 | `authorRegistrySequence > registry.sequence` → `!==` | DDP-11, DDP-13 |
| M2 | device-revocation condition → `if (false)` | DDP-9, DDP-13, **DDP-14** |
| M3 | drop `revokedDevices` validation from `validateProposalAuthorRegistry` | DDP-16 |
| M4 | loader drops `revokedDevices` from the registry it returns | **DDP-14 only** |
| M5 | receipt omits `delegationDigest` (i.e. revert to v3 content) | PGCR-5, PGCR-7 |
| M6 | `receiptBindsDelegation` → `return true` | PGCR-7, PGCR-8 |
| M7 | `canonicalDeviceDelegationIntentBytes` drops `capability` | PGCR-6 |

M4 is the load-bearing one for the §6.3 caveat: it is a defect **DDP-9 cannot see**, because DDP-9
never goes through the loader. That is the evidence the new test covers genuinely new ground rather
than restating existing coverage.

### An owned error from this pass

**PGCR-6 was vacuous when first written, and M7 caught it.** The first draft compared two separate
`fixture()` calls with different `maxPatchBytes` and asserted their digests differed. They did —
but for the wrong reason: each `fixture()` call generates fresh keypairs, so the digests differ
whatever you vary. M7 (dropping `capability` from the canonical bytes entirely) left the whole
suite green. The test now varies **exactly one field off a single fixture**, and M7 kills it. The
trap is documented in `delegated-device-proposal-fixture.ts` so the next author does not repeat it.

This is worth recording rather than quietly fixing: the mutation requirement is what caught it, and
without M7 a decorative test would have shipped attached to a real fix — the exact shape this
audit's evidence-class table exists to prevent.

### Still unexercised, stated plainly

**The end-to-end path remains unexercised.** There are still **zero receipts** under
`docs/observe-events/proposal-receipts/` — the directory does not exist on `main`. No receipt has
ever been *written by the workflow*; the receipts in these tests are built by calling
`proposalReceipt()` directly. So:

- the receipt **shape** and the descriptor binding are **VERIFIED** (unit, with failing mutants);
- the receipt **being written during a real staged proposal** remains **DOCUMENTED-UNVERIFIED**,
  and T-6 stays open until a proposal is staged end-to-end.

`applyPlan()` — the function that writes the file, commits and pushes — is still untested, because
it shells out to `git` and reads `GITHUB_EVENT_PATH`. Extracting `proposalReceipt()` shrank the
untested surface to the I/O around it; it did not eliminate it. No claim here should be read as
end-to-end coverage.

## 5. What I deliberately did not do

- **Did not mint, request, or attempt a capability.** That requires the Touch ID ceremony, which is
  Aaron's gate. I did not click it, script it, or ask him to click it mid-run.
- **Did not fuzz, enumerate, brute-force, or attempt scope escape against the live host.** Exactly
  **two** unauthenticated GETs to `idspace-dla-6faa9bmi.manus.space/` (one page, one headers),
  spaced. That system's operator asked for no repeated retries and I honoured it.
- **Did not write, delete, or mutate anything on that deployment**, and did not open an issue on
  this repo (opening an issue is the flow's *live* trigger — the workflow fires on `issues.opened`).
- **Did not touch the shared checkout.** All work in my own clone
  `/Users/acehack/Documents/src/repos/zeta-shadow-wacap`; the two source mutations were made there,
  verified, and reverted (`git status` clean, suite restored to 10/10).
- **Did not treat the other agent's suite report as evidence.** That report is the artifact under
  test; nothing above cites it. Where I could not determine something — `ZETA_PR_ARCHIVE_TOKEN`, the
  `gh` token type, end-to-end behaviour — I marked it **UNKNOWN** and named the settling test rather
  than inferring it.
- **Did not audit §0–§5 or §7–§8.** In particular the low-S / DER-decoding surface (§1.3, the
  checklist's "add this first") is untouched here. Note the verifier uses Node's
  `crypto.verify` with `dsaEncoding: "ieee-p1363"` on the *device* signature and rejects
  non-64-byte input — so the DER conversion defect surface is avoided on that leg by construction.
  The **passkey assertion** leg does parse browser DER and is where §1 still applies.

## Pointers

- [`webauthn-delegation-conformance-checklist.md`](webauthn-delegation-conformance-checklist.md) — the checklist this audits
- `src/Core.TypeScript/planning/delegated-device-proposal-contract.ts` — the capability type (§6.1/6.2)
- `src/Core.TypeScript/planning/delegated-device-proposal.ts` — the verifier (§6.1/6.3/6.4)
- `src/Core.TypeScript/planning/proposal-gated-commit.ts` — `PROTECTED_PATHS`, `patchPaths` (§6.1)
- `src/Core.TypeScript/planning/proposal-gated-commit-runner.ts` — the receipt + both tokens (§6.5/6.6)
- `src/Core.TypeScript/browser-node/browser-delegated-device-proposal-gh-cli.ts` — the `gh` credential boundary (§6.6)
- `src/Core.TypeScript/browser-node/browser-delegated-device-key.ts` — non-exportable device key (§6.4)
- `docs/security/proposal-author-registry.json` — the roster + revocation surface (§6.3)
- `.github/workflows/passkey-proposal-gated-commit.yml` — `GITHUB_TOKEN` permissions (§6.6)
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why "unexercised" is stated out loud rather than read as "real"
- `memory/feedback_nothing_operator_run_only_operator_approved_via_biometric_aaron_2026_06_21.md` — why §4's tests are staged, not run
