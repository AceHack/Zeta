# Ace as the universal ZetaId pointer resolver — scoping study

**Date:** 2026-08-14 · **Agent:** Otto · **Status:** scoping study. Design and boundaries, **not a build.**
**Work-items:** umbrella `081M00S1JVN087G0R001WKXQ32`; children `081M00S0SPW087G0R0001RS7M9`,
`081M00S0YB4087G0R00109502S`, `081M00S12N8087G0R002HW4ZK0`, `081M00S16T3087G0R0023AZTX0`,
`081M00S1C5J087G0R001Q5CJYH`.

## The reframing

Aaron 2026-08-14:

> *"eventually i think of ace as the **universal zetaid pointer resolver** and some of those pointers
> end up in running process background and foreground capable"*

and

> *"we need a universal background service abstraction and distributed cron abstraction"*

and

> *"ace has all the potential desired states, some state file on each machine decides what the actual
> state for that machine is based on ace templates/packages"*

`ZetaId → the thing it names`, where the target may be inert bytes or a live process. Packages become
one target kind; "which OS" becomes an adapter detail.

---

## 0. The structural finding, stated first

**The resolver already exists in this repo, in two halves that do not reference each other.**

- `src/Core.TypeScript/ace/` — bytes, content hashes, Ed25519 trust, dependency solving, the
  capability declaration (`capability-manifest.ts`, PR #10675). Knows *what a thing is* and *whether
  it may be trusted*. Has **no notion of a running process** — stated explicitly in that module's own
  `INSTALL_TIME_VS_RUNTIME` constant.
- `src/Core.TypeScript/service/` — `IServiceManager` plus `LaunchdAdapter` / `SystemdAdapter` /
  `TaskSchedulerAdapter`, with an OS-detecting factory in `adapters/index.ts`. Knows *how to make a
  process exist on this OS*. Has **no notion of content identity, trust, or capability** — it is keyed
  on a persona *string* against a hardcoded `PERSONAS` array in `persona-registry.ts`.

Neither imports the other. The "universal background service abstraction" Aaron asks for is
approximately built; what is missing is that it is keyed on the wrong thing (a persona name) and
declares guarantees it does not deliver. That reframes the work from *build a resolver* to *join two
halves and repair the seam* — a much smaller and much more defensible scope.

---

## 1. Target kinds (Q1)

Classified by a principle rather than a list, so the set is closed: **what does the resolver still own
after `resolve` returns?**

| # | Kind | Resolver owns afterwards | In-repo instance |
|---|---|---|---|
| 1 | **Inert** | nothing | `ace install` → store dir |
| 2 | **Ambient** | a *reversal*, not a lifetime | `from-shim` (PATH symlinks), `from-deb`, `from-autotools-tarball` |
| 3 | **Oneshot** | an exit status | `systemd.service` `Type=oneshot` |
| 4 | **Periodic** | exit status + a firing rule | **every zeta loop** |
| 5 | **Resident** | a liveness invariant | **none — see below** |
| 6 | **Attached** | nothing; the caller is the supervisor | a foreground CLI run |
| 7 | **Endpoint** | a reachable address; the thing may run elsewhere | the bus / Reticulum direction |
| 8 | **Unresolvable-here** | a typed refusal | *does not exist yet, and must* |

Two of these rows carry the study's weight.

**Row 5 is empty, and that is the scope win.** Every "background service" in this repo is *Periodic*,
not *Resident*: launchd `StartInterval` + `RunAtLoad`; systemd `.timer` with `OnUnitActiveSec` firing a
`Type=oneshot`; Task Scheduler `LogonTrigger` with `<Repetition>`. Nothing here is a long-lived daemon
with a restart policy. **Periodic abstracts far better than Resident** — the three OS mechanisms
genuinely agree on "run this again later", and disagree mostly on details that can be *declared*.
Resident is where systemd/launchd/SCM stop agreeing (restart backoff, readiness protocols, socket
activation, dependency ordering, cgroup accounting), and Resident is what makes people say service
management does not abstract. **So: keep Resident out.** If a Resident target is ever genuinely needed,
it is a separate proposal with its own evidence, not an extension of this one.

**Row 8 must be a value, not an exception.** If an adapter cannot guarantee what a caller needs, the
caller has to be able to *refuse* rather than discover it in production. A refusal that arrives as a
thrown error, or as `ok: false` with a string, is not selectable. This is the same shape
`capability-manifest.ts` already got right: *"A refusal is structurally distinct from 'authorized for
nothing'"*.

---

## 2. Where the resolver stops and a supervisor begins (Q2)

**Recommendation: the resolver owns everything up to and including the first transition into the
target state, plus the *declaration* of the invariant that must hold afterwards. It never owns
maintaining that invariant.**

`resolve` returns a **realization** = (materialized bytes, declared invariant, handle). Maintaining the
invariant is the host's job — launchd on macOS, systemd on Linux, the cell runner in the cluster.

Three independent reasons this is the right line, none of them invented here:

1. **Aaron's own honest bound already draws it.** From `081KTHTPPCD08QG0R002FCS10E`: *"zetaids are
   viruses, they need a host."* The seed expresses only where a host runs; the host supplies the
   machinery. Supervision *is* host machinery. The resolver ships the seed.
2. **The repo's routing model already draws it.** `docs/writer-actor-routing-model.md`: *"Persona =
   owner/**supervisor** of many actors, NOT an actor itself"*, and *"the persona is what remains; the
   actor is what acts on behalf of what remains."* The supervisor role is already assigned, and not to
   a package manager.
3. **Crossing it re-imports every problem OS service managers spent decades on.** Restart backoff,
   readiness, ordering, flapping detection. Building a second one inside ace buys nothing and competes
   with the one already running on the box.

**The falsifiable test that the line is real:** `resolve` must be able to return *without ever polling
a process*. The moment `resolve` contains a retry-until-healthy loop, or reads liveness to decide what
to do next, the line has broken. That is a mechanical check on the call graph, and it can fail: it goes
red if any code path from `resolve` reaches a status/poll/sleep call.

**What this line costs, said plainly:** the resolver cannot answer "is it working?". It can only answer
"did I hand it to a host that declared it would keep it working?". Health belongs to whoever observes
the *effect* — which in this repo is already the heartbeat-via-commit discipline
(`git log --since` on `origin/main`), an externalized counter that deliberately does not trust a
process's self-report. That is the correct place for health, and it is not here.

---

## 3. Per-adapter guarantees, declared not implied (Q3)

### The problem is live, not hypothetical

Read from the three adapters and their templates:

| guarantee | launchd | systemd `--user` | Task Scheduler |
|---|---|---|---|
| first fire | at load (`RunAtLoad`) | **30s after boot** (`OnBootSec=30`) | **at logon** (`LogonTrigger`) |
| survives logout | no (`gui/<uid>` agent) | no — `loginctl enable-linger` appears nowhere in the repo | no — logon-triggered |
| at-most-one-concurrent | yes | yes (`Type=oneshot`) | yes (`MultipleInstancesPolicy=IgnoreNew`) |
| bounded run time | **none** | **none** | **`PT5M`** |
| reports last exit | *capable, unused* | **cannot, as wired** | not read |

The `bounded run time` row is a real operational divergence: a hung tick is killed after five minutes
on Windows and hangs forever on macOS and Linux. Nothing declares this.

The `reports last exit` row is the sharper one, and it is the mechanism's motivation. See §3.2.

### 3.1 The proposed mechanism

An adapter publishes a **guarantee vector**: a set of named guarantees, each phrased so that a
**failing observation exists**. A caller passes a *required* set; a missing guarantee yields
`Unresolvable-here` (target kind 8) rather than a best-effort install.

Two constraints that make it more than paperwork:

- **Guarantees are declared per `(adapter × template)` pair, not per adapter.** `bounded-run-time` is
  true on Windows *because the XML says `PT5M`* — it is a property of the template, not of the OS.
  Editing a template is therefore a guarantee change. This is DV2.0 (`.claude/rules/dv2-data-split-discipline-activated.md`):
  the guarantee vector is a **satellite** of the template, which changes faster than the adapter code
  that is its hub.
- **`declared-unprobed` must be a distinct value from `probed-true`.** Each guarantee gets a
  conformance probe that can go red. Some probes are not runnable in CI — `survives-logout` on macOS
  has no CI logout — and those guarantees must stay visibly unprobed.

### 3.2 How this check fails — stated, per the discipline

The guarantee vector is **self-declared**. It is `source`, never `authorization`
(`.claude/rules/no-directives.md`), exactly as `capability-manifest.ts` established for capabilities.
So it fails as a check in one specific way: **whenever the declaration and the template drift.** A
declaration alone would be the eleventh check that could not fail.

The mitigations, and their own limits:

- **Probes** catch drift for probeable guarantees. They fail to catch anything for unprobeable ones —
  hence the distinct `declared-unprobed` value, so an unprobeable guarantee *looks* weaker at the call
  site rather than silently passing.
- **If `declared-unprobed` and `probed-true` are ever collapsed to one boolean, the mechanism is
  worthless.** That collapse is the single failure mode to guard, and it is a type-level guard, not a
  process one.

### 3.3 The `converges` guarantee, and the manifest that over-promises

`tools/setup/manifests/cluster-cells` states: *"The manifest is the source of truth — change it in git,
re-run install, node converges."* But `tools/setup/install.sh:259-273` provisions cells **on macOS +
launchd only**, and `tools/setup/host-loop-bootstrap.sh:37` prints *"launchd cell provisioning is
macOS-only; Linux systemd: future"*.

So `converges` is true on one adapter and the manifest implies it uniformly. This is precisely the
failure the guarantee vector exists to prevent, found already committed. `converges` should be a
declared guarantee, and `ace apply` should **refuse** on an adapter that does not declare it, rather
than installing and hoping.

---

## 4. The idempotency key (Q4)

**A ZetaId cannot be the key.** From `src/Core.FSharp.ZetaId/BitLayout.fs`, a minted id spends 48 bits
on `Timestamp` and 32 bits on `Randomness`. Minting is therefore *not a function of the thing named* —
two mints of the same intent differ. Only `Category.ContentAddress = 9uy` is content-derived
(truncated BLAKE3, 119-bit payload, `Codec.fs` `packGeneric`).

**Proposed key: `ContentAddress(BLAKE3(canonical realization spec))`**, where the realization spec is
the tuple that fully determines the running thing:

```
(target-kind, package content_hash, entrypoint, argv,
 declared env subset, capability list, schedule spec, machine-selector identity)
```

Two properties are load-bearing:

- **It excludes the requested ZetaId.** Otherwise resolving the same thing under two names starts two
  processes — the exact failure the question names.
- **It includes the capability list.** Same bytes with a different declaration is a *different*
  realization and must not silently reuse a running one.

### The enforcement move: put the key where the OS already enforces uniqueness

Write the realization key into the **scheduler artifact's own identity** — the launchd `Label`, the
systemd unit name, the Task Scheduler task name. Then apply-twice is idempotent *by the OS's own
namespace* rather than by our bookkeeping. This is a natural key, not a retry guard, which is what §12
asks for.

**This repairs a bug that exists now.** Both `LaunchdAdapter.install()` (which calls
`await this.uninstall(persona)` first) and `tools/setup/host-loop-bootstrap.sh:170-172`
(`launchctl bootout` then `launchctl load -w`) **kill an in-flight agent tick on every re-apply**. The
docstring on `IServiceManager.install` says *"Idempotent (reinstalls if exists)"* — reinstall is
idempotent on the *plist*, and is emphatically not idempotent in *effect* on a live process. With a
content-derived label, an unchanged spec re-applies to an already-present label and becomes a **no-op**;
kill-and-restart happens only when the key actually changed. A persona-derived label such as
`com.lucent.zeta.otto` structurally cannot tell those two cases apart.

### On `gen(gen) == gen`

Honest answer: **the law holds on the ContentAddress projection and cannot hold on minted ids.**
Content-addressing a realization and then resolving it returns the same realization, so
`resolve(resolve(x)) == resolve(x)` — a fixed point. A minted `Observation`/`Spawn` ZetaId carries
timestamp and randomness, so re-minting is not the identity. The resolver satisfies
`.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md` on the half where it can, and
this is worth saying rather than claiming the law globally.

---

## 5. Persona vs occupancy (Q5)

**Answer: neither. The ZetaId names the *realization*; persona and occupancy are two distinct target
kinds, and the binding between them is a third, faster-changing thing.**

### The ambiguity is already live and already broken on this machine

Observed 2026-08-14 by `plutil -p ~/Library/LaunchAgents/com.lucent.zeta.otto.plist` and
`launchctl print`:

- `Label` = `com.lucent.zeta.otto` — names the **persona** Otto.
- `ProgramArguments` = `/Users/acehack/.zeta/clones/otto/tools/kiro/kiro-loop-wrapper.sh` — runs the
  **kiro** harness. Env is `ZETA_KIRO_LOOP_WORKTREE` / `ZETA_KIRO_LOOP_FORWARD_ACTIONS`.
- `persona-registry.ts` declares Otto's label as `com.lucent.zeta.otto-loop` — **which does not exist
  on this machine** (`launchctl print` returns *"Could not find service"*).
- The live job reports `runs = 1`, `last exit code = 78: EX_CONFIG`, `state = spawn scheduled`.

So the *name* froze the persona, the *contents* rotated to another harness, the desired-state registry
and the machine disagree about the identity of the thing, the job has failed every time it has run, and
nothing detects any of it.

### The design answer

- A **persona** ZetaId resolves to *what remains* — memory, keys, standing. It is **not resolvable to a
  process**; attempting it is a typed refusal, not a best-effort.
- A **cell occupancy** resolves to a running process. Its realization key **includes the occupant**, so
  rotating an agent through a cell *changes the key*. That is correct: rotation should be an intentional
  restart, and the content-derived label makes it automatic and visible instead of a silent contents
  swap under a frozen name.
- The **persona→cell binding** is the `agent=` column in `tools/setup/manifests/cluster-cells`. It is a
  DV2.0 satellite — fast-changing — and must never be baked into a name that also has to be stable. The
  plist above is exactly that mistake.

### The key-custody consequence

A key bound to a *persona* must not be reachable from a *cell occupancy* resolution, because occupancy
rotates. `capability-manifest.ts` deliberately refuses to express holder-kind, and rightly so — a
denylist of species words guards spelling, not shape. So the separation belongs in the **resolution
graph**, not the capability grammar: persona-scoped keys resolve only under the persona target kind,
which has no process realization at all. Structural guard, matching the existing module's stance.

---

## 6. Distributed cron and the phase source (Q6)

`.claude/rules/local-time-never-enters-the-shared-fold.md`: local wall-clock steers local action only;
the shared conclusion sees agreed phase. A cron that fires or filters on local time leaks local time
into a shared result, and nodes with different clocks fold different sets and diverge.

**Recommendation: fire on a monotone phase counter that is itself in the shared fold. Local time may
choose the POLL rate and nothing else.**

Phase source candidates, assessed:

- **Wall clock / NTP** — rejected. It is the leak, by definition.
- **A leader's tick** — rejected. Central point of coordination, manifesto §1.
- **The `origin/main` commit DAG** — **recommended.** This repo already runs on heartbeat-via-commit and
  already treats `git log --since ... origin/main` as the *externalized* counter precisely because the
  narrative self-counter is unreliable (`CLAUDE.md`). The commit graph is shared, append-only, causally
  ordered, and observed identically by every node. Phase is a monotone function of shared history, not
  of anybody's clock.

Why this satisfies the rule's litmus: two nodes with wildly different clocks poll at different rates and
still fire on the same phases, in the same order, exactly once. They *notice* at different local times.
Noticing-time is local (allowed — it is a retransmit timer). Firing-phase is shared and contains no
local-time-derived term. Two nodes cannot fold different sets, because the set is a function of
(evidence, phase) only.

### The honest bound, which must not be buried

**This yields per-phase exactly-once ordering. It does not yield punctuality.** "Run every 60 seconds"
is not expressible without local time. What is expressible is "run once per phase advance."

So: if a caller genuinely needs *at 03:00 UTC*, that is a **local** schedule on a node that has chosen
to trust its own clock. It must be a **separate target kind** — `Periodic-local` — carrying a declared
guarantee that it **does not participate in the shared fold**. Do not let the two share a type. Sharing
a type is how the leak gets reintroduced by someone reasonably reaching for the nearest abstraction.

That is the leak, named and confined rather than abstracted away.

---

## 7. The boundary — what this does NOT do

The most valuable output. Nix has ~20 years and still does not fully close macOS; the way this idea dies
is by expanding.

1. **Not a supervisor.** No restart policy, health check, backoff, readiness protocol, or dependency
   ordering between running targets. The host owns all of it (§2).
2. **Not an enforcer.** The capability manifest is a declaration, established in PR #10675. The resolver
   does not confine the process it starts. No sandbox, no seccomp, no keychain ACL, no TPM.
3. **Not a runtime identity — and it makes that gap worse.** `INSTALL_TIME_VS_RUNTIME` stands unchanged.
   Adding process realization to ace *widens* the install-time/runtime gap rather than closing it,
   because now a live process exists that people will be tempted to believe is "the verified package."
   It is not. Say it loudly or it will be assumed away.
4. **Not a placement engine.** It does not decide *which* machine runs a target. The per-machine selector
   is authored, not computed. Placement is Kubernetes/Nomad; explicitly declined.
5. **Not wall-clock cron** (§6).
6. **No Resident target kind** (§1). Periodic only.
7. **User scope only.** `gui/<uid>`, `systemctl --user`, per-user tasks. Root/system units are out —
   they need a privilege escalation the shadow may inherit but never extend
   (`.claude/rules/no-directives.md`).
8. **Not a replacement for Nix/brew/apt.** Adapters *delegate*. Ace does not build packages for foreign
   ecosystems.
9. **Not uninstall-complete for Ambient targets.** `from-deb` and `from-shim` mutate machine state ace
   cannot fully reverse. Declare it rather than implying convergence.
10. **Does not converge on non-declaring adapters.** No `converges` guarantee ⇒ `ace apply` refuses
    (§3.3).

---

## 8. Answer to the framing question

The frame is right, and the reason is narrower and better than the ambition suggests: **it is right
because Row 5 is empty.** This repo does not need a universal *daemon* abstraction — the thing that does
not abstract. It needs a universal *periodic-with-declared-guarantees* abstraction, which three OS
mechanisms already substantially agree on, plus a content-derived key so that re-applying is a no-op
instead of a kill.

Service and cron are therefore **in scope and closeable**, with two named leaks that are confined rather
than papered over:

- **Punctuality** cannot cross the local/shared boundary — confined to a separate `Periodic-local` kind.
- **Ambient reversal** cannot be guaranteed — confined to a declared-incomplete guarantee on Ambient.

The capability manifest becomes necessary rather than optional exactly as predicted: it is the only
thing bounding what the materialized process reaches, and it must be inside the idempotency key so a
capability change is a different realization.

---

## Anchors (Beacon)

- Hunt & Larus, *Singularity: Rethinking the Software Stack*, ACM SIGOPS OSR 41(2), 2007 — manifest-based
  programs; the manifest half without the verified-kernel half (already the anchor of `capability-manifest.ts`).
- Wulf et al., **HYDRA**, CACM 1974 — a capability names both an object and the rights over it.
- Goguen & Meseguer, *Security Policies and Security Models*, 1982 — noninterference; §13 and the
  local-time boundary in §6.
- Lamport, *Time, Clocks, and the Ordering of Events in a Distributed System*, CACM 1978 — logical vs
  physical time; the phase/wall-clock split is this result applied to scheduling.
- Cook & Dolan-Gavitt et al. lineage on TOCTOU — the install-time/runtime gap in §7.3.
- Dolstra, *The Purely Functional Software Deployment Model* (PhD, 2006) — Nix; the content-addressed
  realization key, and the cited evidence for the boundary discipline (twenty years, macOS still open).

## Pointers

- `src/Core.TypeScript/ace/capability-manifest.ts` (PR #10675) — the declaration half; `INSTALL_TIME_VS_RUNTIME`.
- `src/Core.TypeScript/service/service-manager.ts` + `adapters/` + `templates/` — the realization half.
- `src/Core.FSharp.ZetaId/BitLayout.fs`, `Codec.fs`, `Types.fs` — why a minted id is not a key.
- `docs/writer-actor-routing-model.md` — persona = owner/supervisor; actor = what acts.
- `tools/setup/manifests/cluster-cells`, `tools/setup/install.sh:259`, `tools/setup/host-loop-bootstrap.sh:37,170`.
- `workitems/081KTHTPPCD08QG0R002FCS10E-*` — "zetaids are viruses, they need a host" (the §2 frame).
- `workitems/081KTHY32YQ08QG0R000JWHJYN-*` — ZetaId as uniform pointer/resolver to external anchors.
- `workitems/081KTFKQGZP08QG0R001ND3VK2-*` — ace as ZetaId-seeded package-pattern (unfold, not install).
- `.claude/rules/local-time-never-enters-the-shared-fold.md` · `dv2-data-split-discipline-activated.md`
  · `no-directives.md` · `only-the-irreducible-is-primitive-generate-the-rest.md`.
