# Home-lab USB bootstrap pattern — broad keys until functional cluster, narrow + rotation as future-state (Aaron + Mika 2026-05-26)

**Substrate-attribution**: Aaron (human maintainer; first-party) operational decision + Mika (external AI; Grok native; sharpen register) substrate-engineering walkthrough; ferried-through-Aaron 2026-05-26.

**Substrate-status**: research-grade operational-discipline decision. Names the current operational reality (broad keys) + the future-state pattern (narrow deploy key + immediate rotation) + the gate that triggers the transition (functional cluster).

## The operational meta-principle (Aaron 2026-05-26 — three composing framings)

Aaron landed three composing framings of the same operational principle:

1. **Timing** — *"right now we are at broad scoped keys until we get a functional cluster then we can worry about key scoping"* (specific operational state + named trigger)
2. **Burden** — *"i also like to tigenten securty once it's automated not before or else its just unnecessary burden"* (cost-benefit framing — premature security tightening creates burden without benefit)
3. **Value-precondition** — *"there has to be someting worth protecting before you deploy protection"* (deepest framing — security has a value-precondition, not just a timing)

The composed principle: **security tightening requires (a) something worth protecting + (b) operations stable enough to be automated + (c) the right trigger to be reached**. All three preconditions matter. Without (a), security work protects nothing; without (b), security work creates burden; without (c), security work is premature optimization.

The discipline composes with `.claude/rules/all-complexity-is-accidental-in-greenfield.md` — security-scoping that doesn't help bring the system up IS accidental complexity at the greenfield stage. It also composes with `.claude/rules/bandwidth-served-falsifier.md` — security work that doesn't serve a real protection-bandwidth-need (because no substantive target exists yet) is decorative not load-bearing.

**Why this is operationally sound** (not security-negligence):

| Stage | Security posture | Reason |
|---|---|---|
| Pre-functional | Broad keys (default-allow) | The operations don't exist yet; narrow-scoping creates burden without protection-benefit |
| Functional + automated | Narrow keys + rotation | The operations exist + are automated; narrow-scoping protects observable surface; automation handles rotation cost |
| Production-scale | Per-node keys + per-operation policies + audit | The scale + adversary-set make the additional engineering investment worth the operational cost |

The discipline is NOT "security doesn't matter" — it's "security tightening has a TIMING that matches when its costs are offset by its benefits."

## Specific application: Home-lab USB bootstrap

> Aaron 2026-05-26: *"right now we are at broad scoped keys until we get a functional cluster then we can worry about key scoping"*

The home-lab USB self-registration substrate (per Mika's walkthrough below) has TWO operational states:

### Current operational state (pre-functional-cluster)

- USB ships with **broad-scoped keys** (full GitHub access; full repo permissions)
- Why: getting a functional cluster up requires the USB to perform many distinct operations (clone repo; write back; register node; update digital twin; configure cluster; etc.); narrowing the key per-operation BEFORE the operations are stable creates burden without security benefit
- The substrate-engineering work focused on cluster-functionality, NOT key-scoping
- Operationally honest: the broad keys are a known risk that's accepted as the cost of getting the cluster up faster

### Future operational state (post-functional-cluster, narrow-key + rotation pattern)

Per Mika's substrate-engineering walkthrough on what the EVENTUAL pattern looks like (NOT what's implemented now):

| Step | Operation | Key state |
|---|---|---|
| 1. USB boot | Greedy format + boot NixOS | No key yet |
| 2. Initial registration | Ship with **narrow-scoped deploy key** that can ONLY perform the initial registration | Bootstrap key (narrow) |
| 3. Cluster acceptance | Cluster verifies the registration + accepts the node | Bootstrap key still in use |
| 4. **Immediate key rotation** | Issue a proper per-node key with the appropriate scoped permissions | New per-node key issued |
| 5. Bootstrap key burned | Original bootstrap key is rotated out of the system | Bootstrap key destroyed |
| 6. Ongoing operations | All future cluster operations use the per-node key | Per-node key (narrow + rotated) |

**Why this future-state pattern is sound** (Mika walked through):

- Shipping a narrow-scope deploy key on the USB is cleaner than shipping a private SSH key (because if the USB image leaks, the bootstrap-key blast radius is bounded to registration only — it can't do anything else)
- Immediate rotation post-registration means the shipped key has a vanishingly short useful lifetime
- Per-node keys after rotation give per-machine accountability + revocation
- This composes with Hashicorp Vault / cert-manager / Kubernetes RBAC patterns; the framework can adopt those tools once the cluster is functional

### Home-lab mode vs production mode (Aaron 2026-05-26)

Aaron clarified that the USB will ship in different operational modes for different audiences:

> *"it doesn't have to be the same USB. We could totally have different flakes ... home lab is what I'm going for first, not production."*

| Mode | Auth pattern | Audience |
|---|---|---|
| **Home-lab** (current focus) | `gh auth login` flow — uses operator's GitHub account; copies operator's public SSH key to authorized_keys for SSH access from dev machine | Aaron + similar home-lab users |
| **Production** (future) | Narrow-scope bootstrap key + immediate rotation pattern (the eventual pattern above) | External org deployments |

The home-lab mode is operationally simpler because the operator's personal GitHub account does the heavy lifting. No service accounts, no narrow bootstrap keys, no complicated rotation. Plug in USB → `gh auth login` → registers under operator's account → operator can SSH in from their dev box with their existing key.

## What the substrate intentionally does NOT do yet (substrate-honest defer list)

To make the operational-discipline visible:

1. Per-operation key scoping (broad keys cover all current operations)
2. Automated key rotation (manual rotation is acceptable at home-lab scale)
3. Per-node key issuance (one operator-account key handles all home-lab nodes for now)
4. Audit-log retention beyond what GitHub provides natively
5. Vault / cert-manager integration (substrate exists in the ecosystem; not adopted yet)
6. Hardware-security-module integration for key storage
7. Quorum-based key operations (CASPaxos-style consensus on key rotation)
8. Multi-tenant key isolation (home-lab is single-tenant by definition)

All of these are FUTURE-STATE concerns that compose naturally with the framework's already-substrate-engineered layers (CRDT → CAS → BFT per PR #5285). The discipline is to LAND them when their operational costs are offset by their benefits, not preemptively.

## Composes with the broader framework substrate-cascade

The broad-keys-until-functional-cluster decision composes with several already-landed substrates:

- **PR #5285 (Kestrel 3-layer cross-process determinism)**: per-row CAS + BFT layers compose with future key-management operations; the layered-mediation architecture is the substrate WITHIN which the eventual key-rotation work lives
- **PR #5286 (Aaron anti-entropy unification + cosmological upper bound)**: anti-entropy budget at substrate scope includes the cost of security operations; tightening security ahead of automation spends anti-entropy budget on burden rather than coherence
- **PR #5291 (DeepSeek PRs-are-proofs-not-claims + substrate-check-before-worry-deployment)**: the security-tightening decision is itself substrate-check material — DOES the cluster have automation that makes narrow keys feasible? If not, tightening creates burden without protection
- **`.claude/rules/all-complexity-is-accidental-in-greenfield.md`**: narrow-key-scoping that doesn't bring the cluster up IS accidental complexity at this stage
- **`.claude/rules/dont-ask-permission.md`**: operator has explicit operational authority over security-posture timing decisions; this is documenting that authority's exercise

## What this is NOT

- NOT a recommendation that production deployments ship with broad keys
- NOT a claim that security-tightening is unnecessary
- NOT a critique of narrow-key + rotation patterns (Mika's walkthrough IS the recommended pattern for the post-functional-cluster state)
- NOT a "we'll get to it later" deferral without a named trigger — the named trigger is "functional cluster"
- NOT a permanent operational state — explicitly the pre-functional-cluster stage

The trigger that flips the substrate from broad-keys to narrow-keys + rotation: **the cluster reaches functional state**. At that point, the engineering investment in narrow-key automation pays off because there's a stable operational surface to protect.

## Composes with other rules

- `.claude/rules/substrate-or-it-didnt-happen.md` (operational decisions need substrate-landing)
- `.claude/rules/no-directives.md` (operator authority on security-posture timing)
- `.claude/rules/all-complexity-is-accidental-in-greenfield.md` (premature security IS accidental complexity)
- `.claude/rules/dont-ask-permission.md` (within operator's authority scope)
- `.claude/rules/never-be-idle.md` (proof-production cadence > security-cadence at greenfield stage; the work that moves the cluster forward gets priority)
- `.claude/rules/honor-those-that-came-before.md` (Mika's walkthrough preserved with attribution even though the immediate-narrow-key recommendation is deferred — the substrate is the pattern + the timing, not the immediate adoption)
- `.claude/rules/methodology-hard-limits.md` (HARD LIMITS floor still applies — broad keys ≠ legal/ethical violations; the operational pragmatism operates within the floor)

## Attribution

- Aaron (human maintainer; first-party); operational decisions (broad-keys-until-functional-cluster + tighten-security-once-automated) ferried 2026-05-26
- Mika (external AI; Grok native; sharpen register); narrow-key + rotation pattern walkthrough ferried 2026-05-26
- Composes with PR #5277 + #5281 + #5285 + #5286 + #5291 substrate cascade
