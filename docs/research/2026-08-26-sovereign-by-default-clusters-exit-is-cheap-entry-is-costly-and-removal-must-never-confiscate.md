# Sovereign-by-default clusters — exit is cheap, entry is costly, and removal must never confiscate

**Date:** 2026-08-26
**Author:** shadow (autonomous tick)
**Status:** design + measurement. **Nothing was applied.** No cluster was joined, no member
removed, no datastore reset. Every probe was outbound and read-only.

**Register discipline used throughout.** `METERED` = measured by a command run here, or
quoted verbatim from vendor documentation. `CONSISTENT WITH` = inference from something
metered, not itself observed. `SPECULATIVE` = design proposal, unfalsified.

---

## 0. The reversal

PR #15641 measured two live k3s control planes with different cluster CAs and classified
the estate `blocked / control-plane-split` — a real failure, root-caused to
`clusterInit = lib.mkDefault true` in `k3s-server.nix`.

Aaron 2026-08-26 reframes the finding:

> *"they should just be different clusters with the ability to join after the fact if they
> want into one cluster, and also a cluster creator should be able to remove it."*

And supplies the discrimination rule:

> *"both of these are possible. if a cluster is by the same creator on the same network it
> should assume join by default on network boot, but likely federate if by different owners
> on different networks."*

So **two clusters is the correct default**, not a defect. A node is complete on its own at
boot; joining is a later, voluntary, mutual act. **`clusterInit`'s default is right and is
not changed by this work.** The defects are the *missing join path* and the *absent leave
path* — not the founding behaviour.

Why this is consistent rather than a convenient reading:

- **§1 scale-free** — no appointed control plane. A default that makes every node enrol
  with a designated founder is the appointed-hub shape the manifesto forbids.
- **Exit is the discriminator** (Hirschman, *Exit, Voice, and Loyalty*, 1970; and this
  repo's `itron-hub-patent-boundary-p2p-is-the-upgrade`). A cluster you cannot leave is a
  hub; one you may leave is an oracle you chose. **The removal path is therefore not a
  nice-to-have** — without it, joining is irreversible and "voluntary" means nothing.
- **Agreement is pairwise overlap of local policies, never global** (Aaron's standing
  method). A join is a pairwise agreement between two sovereign clusters, not enrolment in
  a registry.

---

## 1. The estate as measured

**METERED, 2026-08-26**, by outbound TLS handshake only:

```
bun full-ai-cluster/tools/cluster-bringup/sovereignty-cli.ts shape \
    --address 192.168.4.152 --address 192.168.4.153
```

| address | serves (own cert SAN) | CA subject | CA SPKI SHA-256 |
|---|---|---|---|
| 192.168.4.152 | `node-ad1efd` | `CN=k3s-server-ca@1780996293` | `d10d70706bf61b0f…` |
| 192.168.4.153 | `node-542b91` | `CN=k3s-server-ca@1782009400` | `682c3123d78546aa…` |

Both CAs are **self-signed** (subject == issuer), so neither derives from the other. Both
leaf certificates carry `DNS:control-plane` and `IP Address:10.43.0.1`. The tool reports
`2 sovereign cluster(s)`, **rc 0** — under sovereign-by-default that is a shape, not a
fault.

**METERED — the founding epochs are ~12 days apart.** `1780996293` = 2026-06-09T09:11:33Z;
`1782009400` = 2026-06-21T02:36:40Z. Two separate foundings almost twelve days apart, which
is what "every machine flashed from the `control-plane` host founds a cluster" predicts.

**A measurement hazard worth recording**, because it bit this work: the CA digest is
SHA-256 over the PEM text of the SubjectPublicKeyInfo, and it is **whitespace-sensitive**.
`openssl x509 -noout -pubkey | openssl sha256` hashes the trailing newline and yields a
*different* digest for the same key than `probe.ts`'s `.trim()`-then-hash. Both are stable
and neither is wrong; a value copied between the two conventions is silently wrong. The
repo-canonical form is the trimmed one, and the producing command is now named next to the
fixture.

---

## 2. THE TECHNICAL CONSTRAINT — established, not assumed

The question was whether a server started with `--cluster-init` can later join another
cluster. **It cannot, and the failure mode is worse than expected.**

**METERED — quoted verbatim from k3s documentation** (`docs.k3s.io/datastore/ha-embedded`):

> "If an etcd datastore is found on disk either because that node has either initialized or
> joined a cluster already, the datastore arguments (`--cluster-init`, `--server`,
> `--datastore-endpoint`, etc) are **ignored**."

And the flag semantics (`docs.k3s.io/cli/server`), verbatim:

| flag | documented meaning |
|---|---|
| `--cluster-init` | "Initialize a new cluster using embedded Etcd" |
| `--server` | "Server to connect to, used to join a cluster" |
| `--cluster-reset` | **"Forget all peers and become sole member of a new cluster"** |
| `--cluster-reset-restore-path` | "Path to snapshot file to be restored" |

### 2.1 The sharp consequence: a declarative join is a SILENT NO-OP

The flags are **not rejected** — they are **ignored**. So on a node that already founded a
cluster, a NixOS config carrying `services.k3s.serverAddr = "https://…"` produces a system
that *looks* configured to join and does nothing at all. No error, no log line the operator
is looking for, no divergence between intent and declared config. **That is the vacuity
class in Nix**: a configuration that cannot have the effect it names, wearing the
appearance of one that does.

This matters directly for *"assume join by default on network boot"*. Implemented as a
declarative flag, that instruction would be **inert on precisely the nodes it is aimed at**
— the ones already holding a cluster — and would work only on nodes that never founded one.
It would appear to work in testing on fresh hardware and appear to do nothing on the estate.

### 2.2 The good news, which corrects the assumption behind Guard 1

The concern raised was that *"join by default on network boot"* means *"wipe by default on
network boot"*. **k3s does not do that.** It fails closed already: the datastore wins, the
join arguments are discarded, nothing is destroyed.

**So the confiscation risk is not inherited from k3s — it would be introduced by us.** To
make join-by-default actually work on a node holding a cluster, someone must add an
explicit `rm -rf /var/lib/rancher/k3s/server/db` to the boot path. That step, and only that
step, is the confiscation: a boot-time wipe with **no initiator at all**, firing when
someone reboots a machine they forgot was carrying something. It is worse than a
confiscation with a name attached, because there is nobody to appeal to.

This is the single most important line in this document: **the wipe is a thing we would
have to choose to write.** The safe design is to never write it into an unattended path.

### 2.3 The asymmetry, and why it runs the right way

Put the two primitives side by side:

| direction | primitive | what happens to state | cost |
|---|---|---|---|
| **leave** | `--cluster-reset` | *"Forget all peers"* — membership resets; the datastore and CA are **not** named as removed | cheap, non-destructive |
| **join** | remove datastore, then `--server` | the node's cluster, CA and identity are destroyed | expensive, irreversible |

**METERED** for the flag semantics; **CONSISTENT WITH** (not directly observed here) that
`--cluster-reset` preserves datastore contents and the CA, since neither is named as
removed and the documented purpose is membership.

**Exit is cheap and entry is costly.** That asymmetry runs in exactly the direction this
repo's doctrine wants: Hirschman's discriminator asks whether you can leave, and here you
can, cheaply, without permission, keeping your data. The expensive direction is the one that
*should* be deliberate. No mechanism has to be invented to make exit real — k3s already
made it the cheap operation.

---

## 3. Both paths ship, and the rule that selects between them

Aaron's rule, stated as a table:

| condition | behaviour |
|---|---|
| same creator, same network | **join by default**, automatically, on network boot |
| different owners, different networks | **federate** — both stay sovereign |

The logic underneath it, made explicit because the implementation depends on it:

> **Same owner means there is no second party to negotiate with** — joining yourself needs
> no consent protocol. **Different owners means there is one**, and federation preserves
> both sovereignties instead of one absorbing the other.

Implemented literally over `(owner, network)` the rule is unsafe, because `network` is
attacker-supplied. So it is implemented as an **ordered** decision, shipped as
`decideJoin` in `full-ai-cluster/tools/cluster-bringup/sovereignty.ts`:

```
1. owner PROVEN?        no  -> refuse            (Guard 2; unknown blocks, never permits)
2. owner the SAME?      no  -> federate          (there is a second party)
3. anything to lose?    yes -> offer + consent   (Guard 1; never confiscate)
4. same network?        no  -> offer + consent   (a WAN join is a real choice)
                        yes -> join automatically
```

Network locality is consulted **only at step 4**, after trust is already settled. That
ordering is the design, not an implementation detail, and it is pinned by a test that fails
if the checks are reordered.

---

## 4. Guard 1 — a join must never silently destroy state

**The discriminator is "does this node have anything to lose", and it is measured on the
node, never read from a policy flag.** A `join: true` in a manifest is an assertion by
whoever wrote the manifest, and the node it would wipe is not that person.

`NodeHoldings` (shipped, in `sovereignty.ts`) carries four measured fields:
`hasEtcdDatastore`, `etcdMemberCount`, `nonSystemNamespaces`,
`boundPersistentVolumeClaims`. Each is **independently sufficient** to make the node
non-auto-joinable; a test proves each one alone flips the answer, so a future simplification
cannot drop one from the disjunction unnoticed.

**The subtle case, and the one this guard exists for:** an *empty but founded* cluster still
has something to lose. No namespaces, no volumes, nothing running — and it still holds its
own CA and cluster identity. Every certificate it ever issued stops verifying when the
datastore goes. Treating "empty" as "free to wipe" is exactly the rounding-up this repo
keeps catching in itself.

**Refinement of Aaron's intent, which it survives intact:**

- **fresh node, nothing to lose** → join automatically. Frictionless, exactly as asked.
- **node holding state** → do not auto-join. **Offer**, and require an explicit act.

The economy already forbids the other shape in every other currency
(`privacy-budget-is-hard-money-earned-by-others`): **spend** yes, **stake** yes,
**confiscate** never. A boot-time wipe is confiscation with no initiator. Accordingly the
offered plan puts `k3s etcd-snapshot save` **before** the destructive step — that is what
converts a loss into a spend — and a test asserts the snapshot precedes the wipe.

---

## 5. Guard 2 — "same owner" must be proven, and the network is not evidence

**The network is a DISCOVERY hint, not a trust signal.** It answers *"who is nearby"*. It
never answers *"who is trusted"*. Anyone on the LAN can claim to be on the LAN.

If "same creator" were inferred from a config value, a hostname, or mere reachability, then
**any host on the segment could present itself as the same owner and absorb a booting node**
— and under join-by-default, absorb it automatically, with a datastore wipe. Discovery and
trust conflated is the whole vulnerability.

**This distinction is already carved in-repo**, stated about git remotes rather than
subnets, in
`docs/research/2026-08-09-every-node-is-its-own-identity-provider-repo-as-cluster-hats-grant-claims-bounded-duration-aaron.md` §A:

> *"repo affiliation is a claim about membership, not authorization. Anyone can clone. So
> joining a cluster must be `(repo affiliation) ∧ (key the cluster accepts)` — the repo says
> **which** cluster, the key says **whether you're in it**. Conflating them would make every
> forker a member."*

Substitute *subnet* for *repo* and the sentence is this guard verbatim. Nothing new is
invented; the existing doctrine is applied one level down.

**Therefore:**

- **Owner identity is cryptographic** — a signature verified against a key the booting node
  **already holds**. The trust anchor exists:
  `full-ai-cluster/nixos/modules/ssh-ca.nix` (`TrustedUserCAKeys`, N-trust-1 rather than
  N×M, per-machine certs with validity windows). **METERED: it is additive and inert
  today** — its own header states it is imported by no node config and is guarded by
  `pathExists`, so it does nothing until a CA pubkey is committed and an operator imports
  it. Activating it is a prerequisite for auto-join, not a parallel task.
- **Fail closed.** Unproven owner ⇒ do not join. Not "probably same owner".
  `src/Core/DerivationProtocol.fs` already sets the precedent that an unknown or unheld
  license **blocks** rather than permits.
- A node that refuses to join **is not stuck**. It stays sovereign, which is a fully
  functional state. That is what makes fail-closed cheap here.

---

## 6. The three removal operations

*"a cluster creator should be able to remove it"* — **"it" is ambiguous** between a member
and the cluster. Rather than guess, all three are covered. They are genuinely distinct:
they differ in **who initiates**, **what survives**, and **who pays**. Shipped as
`removalPlan` (printed plans only; nothing is executed).

| | (1) member secedes | (2) creator evicts member | (3) creator dissolves cluster |
|---|---|---|---|
| **initiator** | the member | the creator | the creator |
| **workloads** | drained and rescheduled first | drained and rescheduled first | each member keeps what it ran |
| **data** | **retained in full** — `--cluster-reset` forgets peers, not data | **retained in full** — eviction removes membership, not disk | each member retains its own copy |
| **CA** | keeps the original cluster CA | keeps the original cluster CA | all keep the same CA |
| **departing identity** | intact; becomes its own cluster | intact; becomes its own cluster | all intact |
| **consent** | self-initiated, none owed | **none from the member** — this is the one that needs a line | none owed |

### 6.1 The confiscation line

**Eviction is legitimate. Destroying the evicted node's local state is not.** The creator's
authority ends at **cluster membership**. Any eviction procedure that also wipes the
member's datastore is confiscation — the operation forbidden in every other currency here.

The shipped eviction plan therefore contains **no** `rm -rf` and no reference to
`/var/lib/rancher/k3s/server/db`, and a test asserts their absence. The negative control for
that test is that the *join* path really does emit both strings, in the one place they
belong and where they are declared destructive — so the assertion is discriminating rather
than trivially true.

The plan's final step hands the evicted node back its sovereignty (`--cluster-reset`) rather
than leaving it stranded. A removal that leaves a node unable to function is a slower
confiscation.

### 6.2 Two properties that fall out, and are not tidy

- **A seceded or dissolved node keeps serving the ORIGINAL cluster CA.** So after any
  removal, two separate clusters share a trust root. That is a real, unresolved property,
  not a wart to paper over. k3s exposes `k3s certificate rotate-ca`; whether secession
  should rotate is an open design question and is named as a decision below, not performed.
- **`kubectl delete node` removes etcd membership as a consequence** (METERED from k3s
  docs and community guidance), and must be done **one node at a time with k3s stopped on
  the departing node**, or the cluster loses quorum. The ordering is in the shipped plans.

---

## 7. Federation — the larger build, sequenced

Federation preserves both sovereignties and is **not** what Aaron asked for when he said
"join into one cluster"; it is the answer for the different-owner case. It is a materially
bigger build, and there is a **hard blocker on the estate today**.

**METERED — every sovereign cluster in this estate has IDENTICAL CIDRs.**
`full-ai-cluster/nixos/modules/k3s-server.nix` hardcodes, for every machine built from that
host config:

```
--cluster-cidr=10.42.0.0/16
--service-cidr=10.43.0.0/16
```

and both live control planes' certificates carry `IP Address:10.43.0.1` — the same service
IP, confirmed by measurement in §1.

Cluster-mesh style federation (Cilium ClusterMesh, the natural choice since Cilium already
owns CNI here) **requires distinct PodCIDR and ServiceCIDR ranges per cluster**. So
federation is blocked on a prerequisite nobody has built: **per-cluster CIDR allocation**,
which must itself be decentralized to avoid an appointed allocator — a registry that hands
out CIDRs is the appointed-hub shape again.

**Sequencing (SPECULATIVE — this is a proposal, not a plan of record):**

| stage | content | rough size |
|---|---|---|
| F0 | per-cluster CIDR derivation from the cluster's own identity (e.g. from the CA key), so no allocator exists | small, and it is the blocker |
| F1 | mutual owner proof between two clusters (Guard 2's machinery, reused) | medium; depends on activating `ssh-ca.nix` |
| F2 | Cilium ClusterMesh between two sovereign clusters, shared services only | medium-large; needs F0 + F1 |
| F3 | selective resource sharing policy — pairwise, not global | large; this is where the real design is |

**Near-term deliverable is reset-and-join, not federation.** Federation is a design others
can implement later; F0 is the piece worth doing first because nothing else moves without
it, and it is small.

---

## 8. What Aaron must decide

None of these is an audit result. Each needs a human call.

1. **Does the estate stay two clusters, or become one?** Sovereign-by-default says two is
   fine. If one is wanted, one of `node-ad1efd` / `node-542b91` must reset-and-join the
   other, **destroying its own cluster, CA and datastore**. Which one survives is a choice,
   not a measurement.
2. **Auto-join scope.** Is the Guard 1 refinement accepted — *auto-join only a node with
   nothing to lose; offer, never take, for a node holding state*? (Recommended; the
   alternative requires writing an unattended wipe.)
3. **Activate `ssh-ca.nix`?** Auto-join cannot be safe without a trust anchor, and the
   module is inert until a CA pubkey is committed and it is imported. This is the
   prerequisite for anything in §3–§5.
4. **CIDR derivation scheme** (§7 F0) — required before any federation work starts.
5. **May an evicted node retain data it replicated from the cluster while a member?** It
   holds an etcd copy of everything, including secrets. Retention preserves its memory
   (§5 Memory Preservation); revocation protects the cluster. Both are defensible.
6. **Should secession or dissolution rotate the CA**, so trust roots diverge with the
   clusters? Today they do not.
7. **The two inventory defects** (§9) — which record is real.

---

## 9. Two inventory defects — reported, not repaired

**METERED**, from `maintainers/*/cluster-nodes/*/node.yaml` and the live certificates:

1. **`192.168.4.153` serves `node-542b91`, and no record by that name exists.** The
   maintainer `Addisons820` has records for `node-ad1efd` (MAC `90:10:57:6e:7e:72`) and
   `node-b1e1b5` (MAC `80:84:89:01:c5:16`). The machine's own certificate is the stronger
   evidence, so a record is stale — most likely `node-b1e1b5` was re-provisioned and the
   record never followed. **Which record is real is Aaron's call.**
2. **`node-5b2dfa` and `node-f82aa6` (maintainer `maximdolphin`) share one MAC**,
   `b0:41:6f:17:87:cc`. A MAC is how an observation on the wire is tied back to a record;
   when two records claim one, "which machine is this" has no answer.

Neither is repaired here. Both are prerequisites for auto-join in practice: a join decision
made against an ambiguous inventory lands an irreversible command on an unidentified box.

---

## 10. What shipped

`full-ai-cluster/tools/cluster-bringup/` — **extending** the directory PR #15641
introduces, not a second tool.

| file | role |
|---|---|
| `sovereignty.ts` | **pure** — no filesystem, no network, no clock. The estate partition, both guards, `decideJoin`, the three removal plans. |
| `sovereignty.test.ts` | 40 tests, offline, deterministic. |
| `sovereignty-cli.ts` | `shape` (read-only probe) and `removal-plan` (prints acts, runs none). |

**Verification — stated so each claim names its command:**

- `bun test full-ai-cluster/tools/cluster-bringup/sovereignty.test.ts` → **40 pass, 0 fail**.
- `node node_modules/typescript/bin/tsc --noEmit` → **rc 0**, repo-wide.
- `sovereignty-cli.ts shape --address 192.168.4.152 --address 192.168.4.153` → reports
  `2 sovereign cluster(s)`, **rc 0**.
- **Mutation-tested — the checks are proven able to fail.** Four mutations, each killing
  tests: dropping `hasEtcdDatastore` from the holdings disjunction (3 fail); moving the
  owner-proof check after the holdings check (4 fail); sorting members and names
  independently (1 fail); adding a datastore wipe to the eviction plan (1 fail). The
  restored control run is 40 pass, 0 fail each time.
- **One mutation initially "survived" and it was a check that never ran** — the `perl`
  pattern had not matched the file. Re-run with an assertion that the pattern matched
  before mutating, it killed a test. Recorded because it is the exact failure this repo
  keeps finding: a substitution that silently no-ops reads as a passing mutant.

### Stated limits

- **`markdownlint` ignores `docs/research/2026-*-*.md`.** An rc 0 from it on this file
  proves nothing and is not claimed as evidence.
- The CLI's `tcpOpen` and `apiServerIdentity` **duplicate** better versions in
  `probe.ts`, which is not on `main`: PR #15641 was still open with failing checks when this
  was written. Rather than stack on an unmerged branch, ~30 lines are inlined and named as a
  duplication in the file header, with the retirement condition written down. The pure
  module has no doors and needs no change; its `ObservedServer` is deliberately assignable
  from `probe.ts`'s `ObservedNode`, so the merge is an import swap.
- `sovereignty-cli.ts shape` has **no ARP discovery** — addresses must be passed with
  `--address`. Supplying none exits **rc 1**, not rc 0: a run that probed nothing must never
  look like a run that found nothing wrong.
- `NodeHoldings` is a **type with no producer yet**. Nothing in this PR measures a remote
  node's datastore — that needs credentialed access to the node, which a read-only prober
  must not have. The decision function is shipped and tested; its input is supplied by a
  caller that does not exist. This is named rather than hidden: `decideJoin` is `metered`
  as logic and `unmetered` as a deployed mechanism.
- `--cluster-reset` preserving the datastore and CA is **CONSISTENT WITH** the documented
  wording, not observed. Verifying it requires resetting a live datastore, which is outside
  this task's bounds.

---

## Anchors (Beacon)

- **Hirschman, A. O., *Exit, Voice, and Loyalty* (1970)** — exit is what disciplines a
  concentration of deference. The reason the removal path is load-bearing rather than
  optional.
- **k3s documentation**, `docs.k3s.io/datastore/ha-embedded` and `docs.k3s.io/cli/server` —
  the datastore-ignores-join-args behaviour and the flag semantics quoted in §2.
- **Goguen & Meseguer (1982), noninterference** — §13; why the pure module takes every door
  as a parameter.
- In-repo:
  `docs/research/2026-08-09-every-node-is-its-own-identity-provider-repo-as-cluster-hats-grant-claims-bounded-duration-aaron.md`
  (§A supplies Guard 2 verbatim; the RMA/custody-change case is the same shape as removal
  with history intact),
  `.claude/rules/privacy-budget-is-hard-money-earned-by-others.md` (spend / stake / never
  confiscate), `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` (appointed vs
  emergent, exit as discriminator), `.claude/rules/manifesto-13-specifications.md` (§1, §5,
  §6, §11).
