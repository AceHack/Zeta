# The second tick source, and the watchdog that could not see one

Status: LANDED (adapter + liveness fix) / OPEN QUESTIONS for the browser-PWA route
Date: 2026-08-25
Workitem: `081M0WYCQHF087G0R000ZVPA7T`
Author: Dejan (devops-engineer)

Framing, from the maintainer 2026-08-25:

> "we should route more background work to our independent hardware and usb setup and k8s helm
> charts cause this is how we decouple from github our single point of failure today"

## 1. What was actually wrong — the port had one implementation, and the CHECK had one too

`docs/trajectories/dogfooding-the-whole-stack/RESUME.md` row 4 marks "Tick sources — GitHub
Actions" as the dogfooded reference implementation while rows 5–7 (browser/PWA, bare services,
k8s pods) are `partial` or `not started`. So the fleet's liveness — which `CLAUDE.md` names as the
externalized idle counter — ran on exactly one substrate.

The deeper defect is that **there was no port to implement.** A heartbeat tick existed only as four
inlined YAML steps in `.github/workflows/agent-heartbeat.yml`. That is the same shape as
`agentic-organization/packages/domain/src/work-provider.ts`, which declares a `WorkProviderKind` DU
over five providers with total dispatch and ships **zero** adapters — a declared seam with one
implementation is a hub wearing an interface.

**And the liveness check was the harder coupling.** `heartbeat-liveness.ts` asked *"how old is the
newest SUCCESSFUL GitHub Actions run of agent-heartbeat.yml?"*. That is the provider's **job
status**, not whether a tick happened, and until this change "alive" was **defined** as "GitHub ran
a job" — so a second tick source could not have turned the check green even in principle.

### 1a. The two directions it was wrong, measured rather than argued

**FALSE ALARM — observed live at 2026-08-25T17:11Z.** The checker, run against the real API
payload:

```
[heartbeat-liveness] NO SUCCESSFUL agent-heartbeat IN 102 MINUTES — last success 2026-08-25T15:29:08.000Z
LIVENESS_RC=1
```

At that same moment:

```
$ git log -1 --format='%ci | %s' refs/remotes/origin/heartbeat/alexa
2026-08-25 16:49:12 +0000 | telemetry(drift-rate): alexa tick outcome 2026-08-25T16:49:12Z
   (and, two commits back) heartbeat(alexa): accumulated tick 2026-08-25T16:49:05Z
```

A tick **had** landed, 22 minutes earlier. The run that produced it went red at a *later* step, so
its `conclusion` was not `success`, so the watchdog could not see the tick it had itself produced.
Over the preceding 24 hours only **36 of 65** heartbeat runs concluded `success` — the lane is
routinely productive-then-red, so this is the normal case, not an edge case.

**FALSE GREEN — structural, by reading the workflow.** The tick body runs under
`|| echo "[heartbeat] tick failed (non-fatal)"`, and the commit step prints `no new events to
commit` and succeeds when nothing is staged. A run can therefore conclude `success` having
committed nothing and pushed nothing, and the watchdog reads that as proof of life. **A check that
passes when the thing it checks did not happen is the vacuity class.**

This was not hypothetical either: the very first run of the new local adapter reproduced it —
the tick body chose `navigate_cartography`, exited 1 with `not-yet-executable`, and left nothing
staged. On the Actions lane that path ends in a green run and a phantom heartbeat.

## 2. What shipped

| File | Role |
|---|---|
| `src/Core.TypeScript/agent-heartbeats/tick-source.ts` | the **port** — the four-step tick sequence, provider-neutral, with the lane preparer and the command runner both injected |
| `src/Core.TypeScript/agent-heartbeats/local-tick.ts` | the **second implementation** — a bare local service |
| `src/Core.TypeScript/agent-heartbeats/lane-tick-evidence.ts` | tick evidence read from the lanes, attributed by the `Agent-Runtime:` trailer |
| `heartbeat-liveness.ts` → `assessFleetLiveness` | liveness over **every** source; the original function and its 14 tests are untouched |
| `tools/tick-source/*.template` | launchd unit, systemd service + timer |

**A tick source now records its own tick** (`emitTickEvent`), unconditionally, whatever the body
decided. Liveness must not depend on whether today's pick from the action menu happened to be
executable — that dependency is exactly what produced the false green.

**Each source gets its OWN lane, and that is a property, not a preference.** Every tick does
`git checkout -B heartbeat/<agent> origin/main` then `git push --force-with-lease`. Two sources on
one lane do not merge — they alternately refuse each other's lease, and each refusal is a lost
tick. **The lane is single-writer by construction.** The flush already fans in over many lanes, so
nothing downstream changes.

## 3. The exit test — real output

A lane no workflow can write (`grep -rl "dejan-local" .github/workflows/` → no match; the matrix is
`[alexa, otto, soraya]`), ticked from a local clone by local Ollama:

```
[local-tick] lane=heartbeat/dejan-local runtime=launchd/com.lucent.zeta.heartbeat.dejan-local
             carried=false committed=true pushed=true
REAL_TICK_RC=0
```

Verified independently from the remote:

```
$ git ls-remote --heads origin refs/heads/heartbeat/dejan-local
540a440938293637489cff9bc6284906f011b76d	refs/heads/heartbeat/dejan-local
Agent-Runtime: launchd/com.lucent.zeta.heartbeat.dejan-local
Agent-Model: qwen2.5:0.5b
```

And with GitHub Actions **simulated entirely absent** (`{"workflow_runs":[]}`):

```
--- (a) Actions source only, as the checker worked before ---
no tick evidence from ANY source ...            RC_A=1
--- (b) with the local tick source's lane evidence ---
fleet alive - 2/2 tick sources fresh; newest launchd/... 0min ago   RC_B=0
```

**That is the exit test.** The fleet reads alive on compute GitHub does not own.

### What this does NOT claim

**Compute is decoupled; transport is not.** The lane is still pushed to a git remote and that
remote is still github.com. This removes GitHub *Actions* from the critical path of producing a
tick. It does not remove GitHub. Transport decoupling is the Reticulum row (13) of the same ledger.
`remote` is a parameter so the substitution is config, not code, the day a second remote exists.

## 4. Route selection — measured, and the ranking was WRONG the first time

I initially ranked bare-local-service first on the evidence below. The maintainer corrected the
ranking: *"browser/PWA — this one we are further along than the linux hardware one."* He is right
about the **substrate** and the measurements below are about **readiness to land a tick today**;
both are recorded because they answer different questions.

| Route | Measured state |
|---|---|
| bare local service | Ollama + all three heartbeat models present (`qwen2.5:0.5b`, `llama3.2:1b`, `gemma2:2b`); bun 1.3.14; launchd cells already provisioned; push credential present (`gh auth status` → ssh, `repo` scope) |
| k8s pods | **no cluster running** — `kubectl cluster-info` rc=1, two `kind-*` contexts exist but none is current |
| USB / metal | `zflash/` is **not** a top-level directory (it is docs + a workitem); the installer surface is `full-ai-cluster/usb-nixos-installer/`. Per #15370, nothing boots metal |
| browser / PWA | 36 files, checkpointing, outbox, passkey signer, receipt carriers — far more substrate than row 6's "not started". Blocked on **delivery**, see §5 |

## 5. The browser/PWA route — the blocker is DELIVERY, not authentication

The maintainer's constraint: static hosting only, *"no serverless login or vm"*, and a browser
plugin is a last resort he would rather avoid. And on the click: *"live human click we want to
reduce to one time authorization of PWA access over a set period of time like days."*

### 5a. The `manus.space` dependency is worse than accidental — it is DEAD

`ZETA_OPERATOR_HARNESS_ORIGIN = "https://idspace-dla-6faa9bmi.manus.space"` has exactly three
references (`passkeyProposal.ts:8`, `OracleRaceMode.tsx:154`, and a cosmetic link in
`demo/proofs/index.html`). The maintainer's read was that Manus just defaults to its own hosting
and a GitHub Pages equivalent exists. **Probed, both origins:**

```
MANUS  GET  /api/github-app/operator/challenge   -> http=500  (HTML body, not JSON)
MANUS  GET  /api/github-app/operator/session     -> http=500
MANUS  GET  /api/github-app/operator/proposals   -> http=500
MANUS  POST /api/github-app/operator/challenge   -> http=500
MANUS  GET  /                                    -> http=200  (371684 bytes — the SPA is up)
PAGES  GET  /Zeta/                               -> http=200
PAGES  GET  /Zeta/api/github-app/operator/challenge -> http=404
```

So: the site is up, **the API is not** — it 500s on every endpoint, GET and POST, serving HTML.
Any code path through `operatorFetch` is already broken. **It cannot be repointed at GitHub Pages**,
because these are POST endpoints that must hold a GitHub App private key to write to the repo, and
Pages serves static files (hence the 404). Pointing at Pages would trade a 500 for a 404.

**This matters beyond tidiness**, because `authorizeOperatorDevice` + `submitAutomaticProposal` are
*exactly* the amortised-click design the maintainer described — a WebAuthn assertion returns a
`DeviceCapability` carrying `expiresAt`, and subsequent submissions ride
`Authorization: Bearer <capability>` with **no further click**. The bounded-delegation design is
already written, and it is **inert**, because it needs a verifier that no longer answers.

### 5b. The real blocker: signing unattended is solvable, DELIVERING unattended is not

- **Producing** a tick unattended in a browser: solved. Service worker + IndexedDB outbox already
  exist (`browser-checkpoint-port`, `browser-database-intent-outbox`).
- **Signing** unattended: solvable, but **not with WebAuthn** — every assertion sets
  `userVerification: "required"`, i.e. a biometric prompt per signature. A non-extractable WebCrypto
  key registered once during the human moment signs silently thereafter.
- **Delivering** unattended: **this is the blocker.** The `issues/new` carrier works precisely
  *because* the human's click carries GitHub's own session — **the click IS the credential.** Remove
  the click and there is no credential.

The repo has already answered this, and the answer is telling. Its own browser delivery port,
`src/Core.TypeScript/browser-node/browser-delegated-device-proposal-gh-cli.ts`, shells out to the
local `gh` CLI, with the comment *"Use `gh`'s credential store without exposing a token to the PWA"*
and a refusal that reads *"Complete one local `gh auth login` device ceremony and retry without
moving the token into the browser."*

> **So the PWA's delivery leg is a local credentialed process. The browser route and the bare-local
> route are not competitors — the adapter in this PR is the leg the browser route is missing.**

### 5c. X, named precisely

**A browser-only PWA cannot land a tick today without exactly one of:**

1. **a bearer credential at rest in the browser** (a fine-grained PAT with a short expiry in
   IndexedDB, ideally unlocked per session by a passkey so it is *operator-approved via biometric*
   rather than merely present). No backend. Real, statable weaknesses: a bearer token in browser
   storage, and **no revocation channel** other than expiry; or
2. **a verifier** that turns a passkey assertion into a bounded capability and writes on the PWA's
   behalf — what the dead Manus harness was. This is a backend by definition and **cannot** be
   GitHub Pages; or
3. **a local relay** holding the credential — i.e. this PR's adapter, which already exists and is
   what `browser-delegated-device-proposal-gh-cli.ts` reaches for.

Not an option: **the OAuth device flow.** `github.com/login/device/code` sends no CORS headers, so a
pure browser client cannot complete it without a proxy — a backend wearing a different name.

### 5d. Bounded delegation must be enforced, and the renewal series is a benefit meter

The maintainer's rationale: *"humans will require an ongoing benefit to keep allowing more days —
this is much easier to maintain commitment than a click per change, it's a click per days of
ongoing realized benefit."* A click-per-change is **extractive** — it takes attention repeatedly and
returns nothing marginal. A click-per-N-days inverts it: the system must be worth renewing.

Both directions are failures: an **unbounded** grant destroys the meter and removes the human's
ability to withhold without an affirmative revocation they will never perform; **per-change
prompting** restores the extraction. And **an expiry nothing checks is the vacuity class** — it
silently converts a bounded grant into an unbounded one.

**The renewal interval is a falsifier you get for free**: if grants keep coming, value was realized;
if they stop, the system stopped being worth it, and nobody had to be surveyed. A **lapse must be
distinguishable from "nobody was asked"**, or the metric becomes unfalsifiable.

**This is deliberately NOT built here.** Per the maintainer, it *"should blend/merge with our dora
metrics"* — a grant should be emitted as an event into the same append-only stream
`src/Core.TypeScript/backlog/dora-metrics.ts` already folds, recording grant time, duration granted,
and the capability covered, as a **distinct series** beside the four keys rather than averaged into
one score. DORA measures delivery, not worth; a renewal series is the outcome signal it lacks, and
it is hard to game because you cannot inflate it by deploying more. Filed as follow-on
`081M0WZR8JC087G0R001F4HSSS` rather than half-built.

## 6. Honest limits

- **The maintainer must still install the unit.** The templates are written and the adapter is
  proven, but no launchd/systemd unit is loaded on any machine by this PR. Until one is, the second
  source exists and is not *scheduled* — a capability, not yet a redundancy.
- **`heartbeat/dejan-local` is now a permanent lane.** Ruleset 16934633 carries `deletion` on
  `refs/heads/heartbeat/*`, so the proof artifact cannot be cleaned up.
- **The flush is untouched.** The new lane accumulates and is not yet drained to main; wiring it
  into the flush matrix is deliberate follow-on, not silently assumed.
- **Pre-existing flake, not caused here.** `prepare-heartbeat-branch.test.ts` failed 5/15 under
  concurrent load against its 5s timeout, and passes alone on unmodified `origin/main` (rc=0) and
  in this branch (rc=0). The new suite is 277ms for 21 tests. Worth a P1 on its own.

## 7. Pointers

- `docs/trajectories/dogfooding-the-whole-stack/RESUME.md` — rows 4–7
- `.github/workflows/agent-heartbeat.yml` — the inlined sequence this port extracts
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the vacuity class the false green belongs to
- `docs/research/2026-08-09-every-node-is-its-own-identity-provider-repo-as-cluster-hats-grant-claims-bounded-duration-aaron.md` — bounded-duration claims, the shape §5d should take
