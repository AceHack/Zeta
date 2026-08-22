# cluster-joining is blocked on an absent join, not on QEMU networking

**Status:** **DECIDED** on §8 Q1 — see the addendum at the end. §4's QEMU networking
proposal remains **PROPOSED**; §3's container verdict is **SUPERSEDED**.
**Author:** Dejan (devops-engineer) · **Date:** 2026-08-13
**Addendum:** Otto (the shadow) · 2026-08-13, after Aaron's answer
**Scenario:** 081KSNY2Z0008QG0R0008PN7RQ scenario 5 (cluster-joining)
**Prompted by:** Aaron asking how hardware tests are coming along, and then asking
whether Docker or k8s could carry this instead of QEMU.

> **Read §10 first if you are catching up.** Aaron answered Q1 the same day, and
> the answer moved this document from a diagnosis to a closed one: the first
> blocker described below is **fixed**, and §3's "the container layer would be
> vacuous" conclusion rested on a premise the answer removed. Sections 0–9 are
> preserved as written — they were right when written and the reasoning is worth
> keeping intact — but §10 is what is true now.

---

## 0. The short version

The recorded blocker was wrong. cluster-joining was marked
`blocked-on-multi-vm-orchestration` everywhere, which reads as _fix the QEMU
network and the scenario is done_. It is not.

**There is no join to observe.** The scenario's success contract is
`B0891_CLUSTER_JOIN_SERIAL_MARKERS`. Those two strings are produced by exactly
one thing in the repository: a mock serial log inside `multi-vm.test.ts`. No
guest artefact emits them.

That reorders the work, and it changes the answer to the container question.

---

## 1. What was measured (CHECKED)

> **STATUS UPDATE 2026-08-16.** The "VMs cannot see each other" row above is no
> longer current. `buildQemuSystemBootArgs` now accepts an injected netdev spec
> (`QemuNetworkDevice`), and `planMultiVMRuntime` puts the two VMs on one
> rootless QEMU socket L2 segment with distinct MACs. The row's *proof* half
> still stands: nothing has run the two VMs concurrently, so no frame has ever
> crossed that segment. The serial-execution row and the role-provisioning gap
> (a zflash-prepared image installs `HOST=control-plane`) are untouched.

| observation                                                     | evidence                                                                                                                                                                                        |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nothing in the guest tree emits the join markers                | `probeJoinImplementation` over `full-ai-cluster/nixos` plus `full-ai-cluster/usb-nixos-installer`: **45 files scanned, 0 sightings**                                                            |
| The only in-repo producer of those strings is a test double     | `multi-vm.test.ts` injects them into a fake serial log                                                                                                                                          |
| The guest cluster config is still single-node                   | `k3s-server.nix` carries `MULTI-NODE TODO: workers`                                                                                                                                             |
| The installer has no join plumbing                              | no serverAddr or cluster-token wiring anywhere in `zeta-install.sh`                                                                                                                             |
| VMs cannot see each other                                       | `buildQemuSystemBootArgs` emits only `-netdev user,id=net0` per VM — SLIRP NAT, no shared segment                                                                                               |
| VMs cannot observe each other even if they could see each other | `executeMultiVMRuntimePlan` iterates serially, and `runManagedCommandUntilSerialMarkers` **SIGTERMs each VM on marker match** — the existing node is already dead before the joining node boots |
| Only ONE scenario carries `scaffolded`                          | scenarios 3 and 4 were previously promoted to `composes-with-existing`                                                                                                                          |

**Correction to the brief:** the ask mentioned "several scenarios carry
`scaffolded`". Measured, there is exactly one — cluster-joining. So there is no
set of sibling scenarios that one networking fix would unblock. Nothing else is
waiting behind this.

## 2. Why the ordering is load-bearing

Fix only the networking and concurrency, and the joining node boots, emits
nothing, and hits its timeout. The scenario flips from `skipped` to `failed`.

That is strictly worse than today. `skipped` is an honest "this did not run". A
timeout `failed` invites someone to hunt for a network bug that is not there,
because the real cause — no implementation — is invisible in the failure. And
the tempting fix for a mysterious timeout is to relax the marker set, which is
how a false green gets manufactured.

So: **first blocker, then second blocker, then dispatch.** Not before.

## 3. Aaron's question: can Docker Compose or k8s do this instead?

The split Kenji proposed is real as a taxonomy, and I agree with it as far as it
goes:

| layer            | mechanism                        | what it would test          | where it runs |
| ---------------- | -------------------------------- | --------------------------- | ------------- |
| protocol join    | Compose or k8s shared network    | discovery and join logic    | CI, cheap     |
| provisioned join | QEMU, shared L2, concurrent boot | boot then network then join | scheduled     |

But applied to today's repository, **the container layer has nothing to test
yet, and would be a vacuous check if built now.**

The reason is the same finding as above. There is no Zeta join protocol. The
join that exists is k3s's own agent-to-server join, which is upstream software.
A two-container Compose test of "k3s agent joins k3s server" verifies
**Rancher's** code, not Zeta's — and it would go green on a machine where Zeta's
provisioning is entirely broken. By this repository's own standard that is a
check implying more than it tested, which is the defect `zflash-harness-lint.yml`
already confesses in its own header.

**So the honest answer to Aaron is: yes eventually, no today, and the reason is
not QEMU.** The container path becomes genuinely valuable the moment Zeta owns a
join step of its own — a credential-provisioning handshake, a cred-picker
exchange, a token hand-off. At that point Compose is clearly the right host for
it and I would argue for it over QEMU. Until then it is scaffolding around an
empty room.

Worth noting for cost, since it sharpens the distinction: two Compose containers
is a much smaller ask than the kind-plus-ArgoCD path already excluded from the
PR lane in #10473. Lumping "containers" together would hide that. If and when
the protocol layer lands, it should be Compose-sized, not kind-sized.

## 4. If and when the QEMU layer is built: the networking choice

Recorded now so the decision is not re-litigated later. **Not implemented in
this PR.**

**Proposal: QEMU socket backend, point-to-point (`listen=` and `connect=`),**
not multicast, not bridge or TAP.

| option                                | privileges               | verdict                                                   |
| ------------------------------------- | ------------------------ | --------------------------------------------------------- |
| `-netdev user` (today)                | none                     | cannot work — SLIRP NAT isolates each VM                  |
| `-netdev socket,listen=` / `connect=` | **none**                 | **proposed** — L2 link between exactly two QEMU processes |
| `-netdev socket,mcast=`               | none                     | rejected, see below                                       |
| `-netdev bridge` or TAP               | **root / CAP_NET_ADMIN** | rejected — will not run unprivileged on a hosted runner   |

**Why point-to-point over multicast.** A multicast group is _ambient global
state_ on the host. Two harness runs on the same machine — a laptop, or a
self-hosted runner executing two jobs — would silently share a broadcast domain
and cross-talk. That is an undeclared channel through which one run's traffic
influences another's result: a noninterference leak, and a nasty flake class to
debug. A listen/connect pair is point-to-point and its port can be assigned per
run. The topology is exactly two VMs, so we lose nothing.

**The ordering constraint this creates.** The listener must be up before the
connector, or QEMU exits immediately. So the concurrency is not "boot both and
hope" — it is _start the existing node, wait for the port to accept, then start
the joining node_. That readiness wait is part of the design, not an accident.

**Concurrency shape.** The current executor is synchronous throughout
(spawnSync, Atomics.wait). Concurrent boot needs a genuinely async path, and per
`.claude/rules/async-all-the-way-truthful-signatures.md` it must be DoP-knobbed:
DoP=1 stays a single deterministic cooperative loop (DST-replayable), DoP=N runs
the ferry. Same code path, no special case. Note the harness also terminates a VM
on marker match today; concurrent operation needs that changed to "hold the
existing node up until the joining node is done", which is a lifecycle change,
not just a scheduling one.

## 5. Where this can run (CHECKED — the answer is better than expected)

**GitHub-hosted ubuntu-24.04 runners expose /dev/kvm, and this repository
already relies on it.** `build-ai-cluster-iso.yml` installs qemu-system-x86,
boots real VMs, and says so in its own comments ("ubuntu-24.04 runners support
nested KVM"). Two-VM boot needs no capability that single-VM boot did not
already need, and the socket backend needs no privileges at all.

**So the own-hardware argument here is NOT "GitHub cannot do nested
virtualisation."** That would be wrong, and stating it would weaken the case.
The specific claim is narrower and about duration:

> The existing single-VM full-install QEMU steps carry 90-minute timeouts inside
> a workflow budgeted at 180 to 240 minutes. A two-VM scenario runs at least one
> full install plus a second boot, concurrently, on a runner with 4 vCPU shared
> between them. That is a multi-hour job, and GitHub-hosted runners cap at 6
> hours per job.

That is the honest own-hardware argument for this test class: **not capability,
but wall-clock and cost**, plus the ability to keep a warm baseline image between
runs instead of rebuilding it every time. It is worth making that way because it
is checkable, and it survives someone correctly pointing out that KVM works fine
on hosted runners.

## 6. Gating recommendation

**Do not gate. Concur with Kenji.**

- Booting two VMs in the PR lane is a large, slow, flaky-prone addition, and the
  drift-and-heal ADR narrowed the blocking floor deliberately.
- Schedule it, block on nothing, let it earn promotion on observed stability.
- The cheap part — the tripwire in this PR — costs nothing extra: it is a unit
  test inside a suite that already runs.

**Cost of what actually lands here:** one additional test file in an existing
bun test run. Measured at about 0.9s for the probe file; the whole zflash suite
is 258 tests in about 1.1s. No new job, no new runner minute.

## 7. What landed in this PR

1. `join-implementation-probe.ts` — scans the guest roots for the join markers
   and reports the neutral fact (absent or emitted), with injected file access
   so it carries no ambient I/O.
2. `join-implementation-probe.test.ts` — fixture-driven falsifiers for the
   probe, plus the **promotion tripwire**: it fails the day the guest starts
   emitting the markers, with a message saying to promote the scenario and
   reminding the reader that the second blocker is still open. A failure there
   is good news.
3. `scenarios.ts` — new `blocked-on-absent-join-implementation` verdict naming
   the first blocker and pointing at the next; corrected notes.
4. `run.ts` — the skip message now names both blockers in order.
5. `scenarios.test.ts` — regression guard on the corrected verdict.

cluster-joining remains **skipped**, and `--all` still treats skipped as
non-zero (verified: exit 1, nonPassing 1).

## 8. Open questions — for the maintainer

Answer shapes given so the reply can be short.

1. **Does Zeta want a join protocol of its own, or is k3s's join the join?**
   _Expected shape:_ "ours — the cred-picker handshake" or "k3s's is fine, just
   prove the node comes up and registers". This decides whether the container
   layer in section 3 ever becomes non-vacuous, and it is the only question that
   actually unblocks anything.

2. **Is the provisioned-join test worth multi-hour scheduled runner time, or
   does it wait for own hardware?**
   _Expected shape:_ "schedule it on hosted now" or "wait for the box".

3. **Should cluster-joining be split into two named scenarios** (protocol join
   and provisioned join) as Kenji suggests, or stay one scenario that only
   passes under the full provisioned run?
   _Expected shape:_ "split" or "keep one, provisioned only". My lean is keep
   one until question 1 is answered — splitting now would create a scenario with
   nothing to run.

4. **Does the tripwire belong in the PR lane** (where it is today, via the
   existing suite) **or on the weekly schedule?**
   _Expected shape:_ "PR lane, it is free" or "weekly". My lean is PR lane; it
   is a unit test and costs no new job.

## 9. Anchors

- Goguen and Meseguer, _Security Policies and Security Models_ (1982) —
  noninterference; the reason the multicast group is rejected as an ambient
  channel in section 4.
- Zhou et al., _FoundationDB_ (SIGMOD 2021); Will Wilson, _Testing Distributed
  Systems with Deterministic Simulation_ (Strange Loop 2014) — the DoP=1
  deterministic loop standard invoked in section 4.
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — a check with no
  falsifier is unmetered; the container test in section 3 would be unmetered by
  construction until question 1 is answered.

---

## 10. ADDENDUM (2026-08-13, after Aaron's answer) — Q1 decided, first blocker cleared

Aaron, answering §8 Q1 the same day:

> **"k3s's join is the join, don't invent our own"**

and, on the schedule question:

> "also it should be more often than weekly on the k8s testing"

### 10.1 What the answer changed

Q1 was the load-bearing question and it resolved to the second expected shape:
_"k3s's is fine, just prove the node comes up and registers."_ So **there is no
Zeta join protocol to build**, and the work that remained was never protocol
work — it was **observation plumbing**. A harness cannot watch a join that does
not announce itself; nothing was missing but the witness.

`full-ai-cluster/nixos/modules/k3s-join-observer.nix` is that witness. It
implements no join. It watches the k3s agent-to-server handshake that
`services.k3s.{serverAddr,tokenFile}` already performs and writes the scenario's
two contract markers to the console and the serial port. Imported from
`k3s-agent.nix` — only an agent joins anything; the `--cluster-init` founding
server joins nothing, and a witness there would announce a join that never
happened.

The two markers are deliberately two **independent** facts, because an assertion
that cannot fail on its own is not an assertion:

| marker | fact | fails independently when |
| --- | --- | --- |
| `cluster join successful` | the server issued this node a kubelet client certificate AND the API accepts it | the token is wrong, the TLS SAN does not cover `control-plane`, 6443 is closed |
| `joining-node added to the cluster state` | the API server's node registry contains this node (`metadata.uid` present) | the certificate is valid but the kubelet never registers — node-name collision, kubelet failure, API unreachable after issuance |

Readiness (`Ready=True`) is **not** claimed: it needs the Cilium CNI image and
therefore the internet, and conflating _joined_ with _healthy_ would silently
widen the claim. Membership here; health in the online lane. Same line
`k3s-cluster-init.nix` already drew.

### 10.2 §3 is superseded — and the honest answer is not the one it predicted

§3 argued the container layer would be vacuous **because Zeta owned no join**.
The decision removes that premise, so the question was re-asked properly: _can a
container test using our actual k3s configuration fail in a way that is OUR
fault?_

**Yes — but a container cannot consume our configuration, and that is the whole
answer.** Our configuration is NixOS module attributes: `services.k3s.extraFlags`,
`networking.firewall.allowedTCPPorts`, `networking.firewall.checkReversePath =
false`, `networking.hosts`. A Compose `command:` would have to **transcribe**
them, and a transcription drifts from its source with nothing failing. Such a
test verifies the transcription, not the shipped artefact — a check that can pass
while the thing it names is broken.

`pkgs.testers.nixosTest` has no such gap: it **imports the module files that
ship**, and it already boots multiple nodes on one shared virtual segment. So
`nixos/tests/k3s-agent-join.nix` is the layer §3 wanted Compose for, obtained
without the drift surface:

| | Compose (§3's proposal) | nixosTest (landed) |
| --- | --- | --- |
| consumes the shipped config | no — a transcription | **yes — imports the module** |
| shared L2 segment | yes | yes |
| exercises `--tls-san=control-plane` | only if transcribed | **yes** |
| exercises the firewall / rpfilter config | **no — not expressible in a container** | yes |
| observes the serial contract markers | no | **yes — `wait_for_console_text`** |

So: the container layer is **not vacuous in principle** — the correction §3
needed. It is **dominated** in practice. Revisit only if we ever need to test a
join in an environment where a NixOS VM cannot run.

### 10.3 A third blocker, found while wiring this (CHECKED)

Ordering matters here for exactly the reason §2 gives, so it is recorded before
anyone builds §4's networking:

**The joining VM cannot be provisioned as a worker.** `zeta-first-boot.sh` reads
its role from the ISO's own `/etc/zeta-firstboot.conf`, which ships
`HOST=control-plane`; the tty1 role prompt takes its timed default under
automation; and `zflash` writes no firstboot config to the ESP (zero matches for
"firstboot" under `src/Core.TypeScript/zflash/`). The installer config defers the
per-flash `--role` flag to v2 scope of 081KSGS9H0008QG0R002T3BJ2R. So a zflash-prepared boot image
installs a **second control-plane**, which runs no k3s agent — and therefore no
join observer.

Fix only §4's networking and the scenario would still fail, for a reason with
nothing to do with joining. The three remaining blockers are now carried in the
type system (`JoinBlocker` in `scenarios.ts`) rather than in prose, so clearing
one is a visible edit:

1. `joining-node-role-provisioning` (this section)
2. `shared-l2-segment` (§4)
3. `concurrent-vm-lifecycle` (§4)

`cluster-joining` therefore stays **`skipped`**, with the reason updated to name
only what is actually left. No green was manufactured.

### 10.4 The other three open questions, and the schedule

- **Q2** (multi-hour scheduled runner time, or wait for hardware?) — **narrowed,
  not answered.** The two-node join now runs hermetically in ~minutes inside the
  existing ISO lane, so the expensive provisioned-join run is no longer the only
  way to learn anything. §5's wall-clock argument still stands for the full
  boot-then-install-then-join path.
- **Q3** (split into protocol join / provisioned join?) — **effectively split by
  construction.** `k3s-agent-join` is the protocol layer and it runs today;
  `cluster-joining` remains the provisioned layer and remains skipped. Whether to
  give the protocol layer its own scenario row is cosmetic now.
- **Q4** (tripwire in the PR lane or on a schedule?) — **PR lane**, as leaned. It
  costs no new job, and it fired within a day of landing, which is the argument.
- **The k8s cadence** is now daily (`53 16 * * *`, was `43 16 * * 0`) with the
  full reasoning inline in `.github/workflows/k8s-argocd-health-test.yml` —
  briefly: billable cost is **zero** (public repo, checked against the run-timing
  API, not assumed), every tool version is pinned in-repo, and what actually
  drifts (the runner image, registry availability, main-branch changes outside
  the `paths` filter) moves on the order of a day. Weekly gave a mean
  time-to-detect longer than the drift period it existed to catch.

### 10.5 What the tripwire did, and what it became

§7's promotion tripwire **fired**, within a day, exactly as designed — a failure
there was good news and it was good news. It was not deleted afterwards; it was
inverted. Nix cannot import `serial-markers.ts`, so the marker literals live in
two files with no compiler between them, and that scan is now the only thing that
notices when they drift apart.

Its limits were measured by mutation rather than asserted: dropping one space
from a marker is caught, deleting the module is caught, but **keeping the literal
while deleting the line that emits it is not** — a text scan cannot see that. That
is why `k3s-agent-join.nix` waits for the markers on the real console. Neither
check subsumes the other, and a green on the scan alone does not mean a node
announces its join.
