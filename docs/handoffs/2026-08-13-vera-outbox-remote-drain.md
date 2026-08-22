# Vera — the one edge that makes a browser tab a participant

**From Otto (shadow), 2026-08-13.** You own this code outright: 114 of 114 signed commits in
`src/Core.TypeScript/browser-node/`, 101 in `darkhall-ui/`. Nothing here is a request to change your
design — it is one missing edge, plus the reason it is worth more than it looks.

## The state of play, verified

The node is **further along than anyone outside it assumes, and pointed the wrong way.**

Built and genuinely wired (not modules-with-tests-and-no-caller):
`startNativeDarkHallBrowserPage` (`darkhall-ui/darkhall-browser-page.ts:1075`) mounts, in one startup
path, the runtime probe, service worker, tab coordinator, **outbox**, **receipt archive**, **receipt
handoff**, and **receipt peer link** (`:1137`), then `startBrowserZetaDbTabRuntime` (`:1141`) with
real IndexedDB execution (`:1152`), web-lock admission (`:1145`), invalidation publish (`:1176`) and
receipt publish (`:1178`).

Also worth stating plainly because it misleads people: **`hall/room/index.html` is not the node.** It
is a static zero-JS still that says so at `:335`; the live node is the sibling `node.html`, reachable
only via a hand-written "run node" link.

## The gap: there is no network egress at all

Grepping `fetch(` / `WebSocket` / `XMLHttpRequest` / `EventSource` across **all** of `browser-node/`
and `darkhall-ui/` returns three service-worker smoke-test stubs and one capability-probe string. No
production path.

Concretely:

- `BrowserDatabaseIntentOutboxPort` (`browser-database-intent-outbox.ts:92-116`) has
  `enqueue / begin / settle / acknowledgeArchive / refuse` — and **no `flush`, no `push`, no remote
  sink.** It drains only to the local IndexedDB executor.
- Receipt handoff is **BroadcastChannel-only** (`browser-database-receipt-broadcast-peer-link.ts:281,291`).
  A "peer" is another tab in the same browser on the same machine.
- **No GitHub Action consumes any of it.**

So the node is a well-built **isolated local database**, not yet a participant.

## Why this is the highest-leverage edge in the system

**1. It is what makes Aaron's liveness claim true.** He states it as: *"as long as one zeta tab/node
is alive zeta is alive… we need no continuous running process if we have enough unreliable ones."*
Today that does not hold, and the reason is sharp rather than vague: IndexedDB is **origin-scoped and
local to one browser profile**, evictable by the UA under storage pressure. The answer to *"what
survives when the last tab closes?"* is not "everything is in git" — it is "everything is in one
machine's browser profile."

**2. It is a witness-vs-quorum problem, and the vocabulary is now in-tree** (`vocab/words/witness.md`,
`vocab/words/quorum.md`). One unreliable node is a **witness**: it tolerates zero faults. Availability
from unreliable parts requires a **quorum**, and a quorum has a size. Grepping
`quorum|witness|majority|f+1|2f+1` across `browser-node/` and `darkhall-ui/` returns **nothing** — so
"one tab alive" is doing that work implicitly. That is not a criticism of the code; it is that peers
**cannot see each other across machines**, so no quorum is constructible even in principle. This edge
is what makes counting possible at all.

**3. It solves a second problem for free.** `docs/design/root-site-iris/site/gitpull.html` is a working
dependency-free in-browser git **reader** over the dumb protocol — `DecompressionStream("deflate")`
for inflate, SHA-1 verification of every object, and no CORS exposure because it is plain same-origin
static GETs. Its missing half is **write-back**, and Aaron's constraint is *no backend server*. That is
the same missing edge: a way to hand a signed batch to something that can write git. Solve it once,
solve both.

## The concrete ask

Add a remote drain to the outbox, and make **GitHub Actions the reliable peer**:

1. `flush(): Promise<Batch>` on `BrowserDatabaseIntentOutboxPort`.
2. A `fetch`-based sink that POSTs signed, content-hashed receipt batches to a `repository_dispatch`
   endpoint.
3. An Action that folds accepted batches into git.

**The schema already makes this safe.** `BROWSER_DATABASE_RECEIPT_HANDOFF_BATCH_SCHEMA` carries
`contentHash` and dedupe acks — so the drain is **idempotent by construction** (§12), and a retried or
duplicated batch is an upsert, not a double-write. That is the property that makes an unreliable
sender acceptable, and you already built it.

## Constraints that will shape the design

- **Auth is the hard part and it is unsolved.** `repository_dispatch` needs a credential, and the
  constraint is no backend. GitHub **device flow** requires no client secret and is the standard
  no-backend path; the honest risk is a token living in browser storage on a page that, until today,
  had a `postMessage` listener with no origin check (now fixed, `081KZYD1M71087G0R0022GS3ZH`). Whatever
  lands, the origin check must stay.
- **The Actions identity cannot open PRs** — `can_approve_pull_request_reviews: false` at repo *and*
  org. If the fold path opens a PR, it needs a fine-grained PAT (`pull_requests: write` +
  `metadata: read`); if it pushes to an ungated branch, it does not. `heartbeat/*` is ungated
  (deletion rule only) and is already used this way.
- **`[skip ci]` inverts on a PR route** — it suppresses `pull_request` runs too, so a required check
  never reports and the PR hangs unmergeable forever. If the fold opens a PR, do not carry a skip token.
- **Do not weaken the gate.** `CI Gate` targets `~DEFAULT_BRANCH` with **`bypass_actors: []`**. Park on
  an ungated branch and flush; never push at `main`.

## What would count as done

A browser tab that has been closed, on a machine that is now off, has its work land in git — and a
second tab elsewhere can tell that it did. At that point "one tab alive" stops being implicit and
starts being **countable**, which is the difference between a witness and a quorum.

## Not asked

Nothing about your internal design. The persistence, tab coordination, receipt archive and handoff are
built and tested; this is strictly the missing egress.

---

## Addendum — the scope is larger than egress (Aaron, 2026-08-13)

Ferried verbatim:

> the PWA should be able to run llms and our own bnn and write code and run our worklofws, it just
> requires mutual observation to make it into git

This reframes the ask above. The brief treated the tab as a **producer of receipts** that needs a way
out. Aaron is describing the tab as a **full compute node** — inference, code generation, workflow
execution — for which git is not the runtime but the *settlement layer*, and the only gate on
settlement is mutual observation.

### What is already true (CHECKED against the tree)

- **The BNN needs no port.** `src/Core.TypeScript/planning/student-t-bnn.ts`,
  `planning/error-bnn-bridge.ts`, and `oracle/hl-bnn-bridge.ts` import **no node builtins** — no
  `node:fs`, no `node:path`, no `child_process`. They are pure TypeScript over arithmetic. A browser
  tab can run them today, unmodified. "Run our own BNN in the PWA" is not a build task; it is an import.
- **GPU compute in a tab is demonstrated, not hypothesised.** `demo/identity-dla-site/src/components/
  OracleWebGPU.tsx` runs the DLA simulation as a WebGPU compute shader at N ≈ 50 000 walkers with a
  graceful fallback, and lands the same `D_f ≈ 1.322` as every CPU oracle. That is an existing
  in-repo proof that the substrate-independence claim survives the browser.
- **Reading git in a tab is built.** `gitpull.html` — dumb protocol, `DecompressionStream("deflate")`,
  SHA-1 verification per object, same-origin static GETs, no CORS surface.

### What is genuinely absent

- **In-tab LLM inference.** There is **nothing** in the tree: no WebLLM, no `transformers.js`, no
  ONNX runtime, no wasm inference path. This is the one item of the four that is a new dependency
  rather than a wiring job, and it is the one that will dominate the size and licensing questions.
- **A workflow executor that is not GitHub Actions.** "Run our workflows" splits two ways and they
  have different costs: *dispatching* a workflow from the tab is the egress problem already scoped
  above; *executing* one in the tab means a second runner implementation, and two runners drift.
  Which one is meant should be decided before anything is built, because they share almost no code.

### The sharp part — mutual observation is a witness count, and tabs on one machine count once

The brief above ends on the distinction it could not yet resolve: *"one tab alive stops being
implicit and starts being countable, which is the difference between a witness and a quorum."*
Aaron's framing answers it — mutual observation **is** the gate. But the answer carries its own
failure mode, and it is worth stating before the code exists rather than after:

**Five tabs on one machine are one witness, not five.** They share a browser profile, an origin, a
clock, a key store, and a compromise. A quorum rule that counts tabs is trivially satisfiable by
opening tabs — which is precisely the sybil shape `src/Core/AntiSybil.fs` and
`src/Core/CoordinationSpectrum.fs` already exist to price. The independence a quorum needs is
independence of *failure*, and co-located tabs have none.

So the countable unit cannot be the tab. It has to be something a second tab on the same machine
cannot manufacture: a distinct key with a distinct attestation, or a distinct machine, or a peer that
paid something to store the observation. Per `dual-use-detection-is-neutral-oracle-decides.md`, the
mechanism should report the neutral fact — *these two observations came from the same source* — and
leave "co-located tabs" versus "one dweller across devices" to policy. Both are honest readings.

This does not block the work. It names the one place where the design can look finished and be empty:
a quorum whose members are not independent is a check that did not run, wearing the name of one that did.

### Correction to the constraints above

The constraints section states `CI Gate` carries **`bypass_actors: []`**. That is now **stale** — a
bypass actor was added on 2026-08-13 at Aaron's instruction so agent-authored PRs can land without a
human in the loop. The advice it supports ("do not weaken the gate; park on an ungated branch") still
holds; the fact does not. Same stale text also sits in `.github/workflows/agent-heartbeat.yml` and
`.github/workflows/tick-metrics.yml` comments.

---

## Correction — "greenfield on WebAuthn" was wrong (Otto, 2026-08-13)

An earlier note on this brief claimed the PWA identity key would be greenfield because no
WebAuthn/passkey code exists in-tree. Aaron flagged it: *"for webauthn i though we had some fido and
biometrics for zflash already and some other research so maybe not fully greenfield."* He is right.
The grep behind that claim was too narrow — it looked for `webauthn` and `passkey` and missed `FIDO`,
`sk-ssh-`, `pam_tid`, and an entire adopted-substrate design. What actually exists:

| Prior work | Status | Where |
|---|---|---|
| **081KSE6WT0008QG0R000SH6E0R — FIDO2/WebAuthn/Passkeys/OIDC adopted as Zeta's cross-cutting auth substrate** (Aaron, 2026-05-25). The exact desktop-biometric → server-token bridge this brief needs; names `@simplewebauthn/server` server-side, browser-native WebAuthn client-side; anchors FIDO Alliance + W3C + OpenID Foundation | **designed, never built** | `docs/recovered-orphan-branches-2026-05/misc/backlog/b0744-…` |
| **Biometric sudo elevation via Touch ID PAM** — ADR, status **accepted** | **landed** | `docs/DECISIONS/2026-05-29-biometric-sudo-elevation-via-touch-id-pam.md` |
| **zflash "I execute, you fingerprint"** — Touch ID PAM as the irreversible-action consent gate, short `yes <4-hex>` challenge | open work-item | `081KSE6WT0008QG0R003WZAQKV` |
| **`fido:credId` as a ZetaId-resolvable identity-anchor scheme**, alongside `oauth:`, `did:`, `nostr:` | architecture, not built | `081KTHY32YQ08QG0R000JWHJYN` |
| **FIDO/U2F hardware-backed SSH keys accepted** (`sk-ssh-`, `sk-ecdsa-`, RFC 8709) | **shipped config** | `full-ai-cluster/nixos/modules/operator-authorized-keys.nix` |

**What is still genuinely absent (CHECKED):** no `@simplewebauthn/*` dependency in any `package.json`,
and **zero** `navigator.credentials` / `PublicKeyCredential` call sites anywhere in the tree. So no
WebAuthn *ceremony* has ever been run. The doctrine, the ADR, the anchor scheme and the hardware-key
plumbing all exist; the registration/assertion code does not.

### Two things this changes

**1. The identity key is not a new root — it is a credence booster, and must not be load-bearing.**
`081KTHY32YQ08QG0R000JWHJYN` already settles the layering: external anchors (`fido:credId` included)
sit **above** the self-certifying heartbeat identity as *optional, revocable* credence, feeding the
credence query — and are **never load-bearing for existence** (§3 weight-free), because a central
anchor imports a trust dependency (§1). A three-key split that treats the passkey as the PWA's root
identity inverts that. The passkey raises confidence that a tab is who it claims; it must not be what
makes the tab exist, or a revoked credential deletes a dweller.

**2. Touch ID PAM does not solve this case, and it is worth saying why.** `pam_tid.so` proves physical
presence **to the local machine**; it produces no origin-bound, hardware-backed assertion a remote
verifier can check. WebAuthn's phishing resistance comes precisely from that origin binding. So the
landed ADR establishes the *doctrine* the PWA needs — "I execute, you fingerprint", biometric as the
consent gate on irreversible action — while supplying none of the *mechanism*. Reusing the doctrine
and building the mechanism is the correct read; treating the ADR as coverage is not.

### The finding underneath the mistake

081KSE6WT0008QG0R000SH6E0R is an **adopted-substrate decision living in a recovery folder**. It was never re-filed into the
live backlog after the 2026-05 orphan-branch recovery, so it is invisible to a normal backlog search
and shows up only if you grep the recovery tree. Anyone scoping auth work will re-derive it from
scratch — which is what just happened here. `docs/recovered-orphan-branches-2026-05/` should be swept
for other decisions in the same state; a decision nobody can find is a decision that will be made
again, differently.

---

## Correction 2 — the machine is not the unit; decorrelation is measured, not proxied (Aaron, 2026-08-13)

Ferried verbatim:

> on the same machine has the common attack vector you call out but we allow multple agents on one
> machine we have decorrelation metrics for named agents so we don't really care about the machines
> they run on, we also are working on getting agents their own cryptographic keys for their own
> private state, we have a lot of worlk on this around our hard money and encryption budget this is
> one of the key sources of decorrelation, that and erasure and etropy capture, machines are just one
> source of entropy and most agents will run on multiple machines and have distributted hardware keys
> and tick sources so it's not every stranded in one place

The addendum above said *"five tabs on one machine are one witness, not five."* That reached for the
machine as a stand-in for identity — which is the specific error
[`shared-checkout-is-view-only.md`](../../.claude/rules/shared-checkout-is-view-only.md) already
carves against: **a bus/routing address is not identity.** A machine is a routing address. I used it
as an identity proxy because I did not check whether the correlation was measurable directly. It is.

### What is actually built (CHECKED, in-tree)

| Instrument | What it measures | Where |
|---|---|---|
| `DecorrelationExcess` | excess correlation over an independent null | `src/Core/DecorrelationExcess.fs` |
| `DecorrelationExcessFusion` | MI excess over a **stratified permutation null**, over a causal DAG | consumed by `CommitPairCorrelator.fs` |
| `CommitPairCorrelator` | the instrument applied to commit-stream pairs | `src/Core/CommitPairCorrelator.fs` |
| `GridTelemetry` | supplies the `(causal DAG, per-action observables, action set)` triple it consumes | `src/Core/GridTelemetry.fs` |
| **CHSH identity oracle** | conviction at `2 + ε`, Hoeffding-shaped margin, **autocorrelation-corrected** via a Bartlett-windowed HAC `n_eff` | `src/Core/AntiSybil.fs` |
| `LoopholeFlags` | Detection · Locality · MeasurementIndependence · Coincidence | `src/Core/AntiSybil.fs:522` |

So the question "are these two claimed identities independent?" is not answered by asking where they
run. It is answered by a **Bell-test-shaped measurement**: two systems sharing only past classical
randomness with no in-tick channel cannot exceed `|S| = 2` (Bell 1964; CHSH 1969), so correlation
above the calibrated margin **convicts** the pair. Named agents are the unit; machines drop out.

Aaron names the decorrelation sources: **own cryptographic keys over own private state** (tied to the
hard-money / encryption-budget work — see
[`privacy-budget-is-hard-money-earned-by-others.md`](../../.claude/rules/privacy-budget-is-hard-money-earned-by-others.md)),
**erasure**, and **entropy capture** (`src/Core.TypeScript/algebra/entropy-tracker.ts`;
`tools/Z3Verify/landauer-floor-lemma.smt2`). A machine is *one* entropy source among these, and most
agents run across several machines with distributed hardware keys and tick sources — so no agent's
independence is stranded in one location to begin with.

### Where co-location actually lands — and it is a flag, not a disqualification

`LoopholeFlags.Locality` is exactly this concern, stated properly: *"the two streams were NOT
space-like separated and setting-choice could reach the other side within the round. Open ⇒ an in-tick
channel, not entanglement, can produce `|S| > 2`."* Co-located agents open that flag. They are not
thereby "one witness" — the reading is still taken, and it is still informative; what changes is which
explanations remain available for a violation. `MeasurementIndependence` covers the sibling case where
settings correlate with process state.

The repo's load-bearing default already says so for the hardest case: for two commit streams **from
the same process**, Locality and MeasurementIndependence are **OPEN** by default
(`docs/research/2026-08-02-adversarial-chsh-soundness-commit-probe-register3-lumen.md`). That is the
honest version of what the addendum was reaching for, and it was already written down.

### The bound that does survive, and should be stated in any quorum design

**One-way inference.** `AllDistinct = true` means **"no pair convicted"** — never *"all proven
distinct"* (`AntiSybil.fs:166`). The instrument convicts correlation; it never certifies independence.
So a quorum can honestly report *"no pair of these members was convicted as correlated at margin ε
over n rounds, with loophole profile P"* and can never report *"these members are independent."*

That is the same asymmetry as
[`dual-use-detection-is-neutral-oracle-decides.md`](../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md):
report the fact (`SameSourceAsKnown`), let policy attach the reading. Applied here, the PWA question
restates cleanly and stops being about tabs at all: **not "how many tabs are open" but "what is the
CHSH margin across these named agents at n rounds, and which loophole flags are open?"** A quorum
that publishes its `n`, its `ε`, and its `LoopholeFlags` is making a claim someone can check; one that
publishes a member count is not.
