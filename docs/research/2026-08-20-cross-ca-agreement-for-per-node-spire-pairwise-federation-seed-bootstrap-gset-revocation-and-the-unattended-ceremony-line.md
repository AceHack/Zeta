# Cross-CA agreement when every node owns its own CA — pairwise federation, seed bootstrap, G-Set revocation, and where the human stays

**Date:** 2026-08-20
**Status:** design note + running code. `src/Core.TypeScript/federated-identity/` — 13 modules, 5 test files,
**104 tests, 0 failures; 0 `tsc` errors; 0 ESLint errors; prettier-clean**; one runnable loop.
**No PR opened; worktree only.**
**Driver:** Aaron 2026-08-20.
**Register:** the module is `unmetered` overall; `seed-bootstrap.ts`, `software-adapters.ts`, `x402.ts`
and the demo loop are `toy` and named so. Nothing here is `metered`.

---

## 0. The question, after Aaron corrected it twice

The brief started at *"SPIRE's server is a centralized authority, so avoid SPIRE."* Aaron:

> *"not really we just assume every node has it's own SPIRE server and we have to come up with cross
> spire / node / CA agreement when everyone owns their own CA"*

So per-node SPIRE is **accepted**, and the real problem is **cross-CA agreement between peers who each
own a root**. Then the second correction, which is the binding one:

> *"yeah never global only pairwise"*

And three answers to questions that were genuinely open:

| question | Aaron's answer |
|---|---|
| what is the first trust event between two roots? | *"we boot with superdeterminism s=4 futamura reconstruction over fundamental math"* |
| revocation with no CRL? | *"this is a gset revocation in our model, we just assume our keys are numerous enough that revocation can beat hacking"* |
| two nodes permanently disagree? | *"yes persistent disagreement is our uncertainty/held decorrelation, this is like raw vault from dv2.0"* |

The objective those serve:

> *"i'm trying to use our itron pki and rotation with this to make reliable AI agent mode without human
> intervention."*

---

## 1. The federation decision, and what it costs

Three shapes were available. Two were rejected for the same reason at different altitudes.

| shape | verdict | why |
|---|---|---|
| **Nested SPIRE** — B's server is downstream of A's | rejected | makes A the parent authority. A node that MUST chain to A cannot exit A, and **exit is the discriminator** between an oracle you chose and a hub that holds you (`itron-hub-patent-boundary-p2p-is-the-upgrade.md`, Hirschman 1970) |
| **Bridge CA** — a third root cross-signs everyone | rejected | the bridge is an appointed mediator and its compromise is everyone's. The hub-and-agent shape wearing a PKI hat |
| **SPIFFE federation** — own trust domain, own root, bundles exchanged pairwise, each node decides locally | **chosen** | the only one with no node that must be trusted by everyone; identical in shape to node-local OPA evaluation |

**What it costs, stated because a cost list that omits the cost is the thing this repo calls vacuous:**

1. **O(n²) bundle exchange** instead of O(n) subscription. There is no shortcut; the shortcut is the hub.
2. **A compromise window that is real.** Revocation converges (§4) but not instantly. An offline node
   honours a compromised peer root until either the revocation reaches it or its bundle goes stale.
3. **First contact is not solved by certificates** — there is no prior fact to chain to. §3 is the answer
   and it is narrower than it sounds.
4. **No node can be told it is wrong.** Disagreement is a first-class outcome, and §5 says why that is
   the feature rather than the bug.

---

## 2. Pairwise, never global — and how the code is shaped by it

`accepts(A, B)` is a **directed relation computed nowhere**. There is no global trust map, no registry,
no gossiped consensus about who is trusted, and nothing in the module is replicated or reconciled.
A owns `A.policy` and `A.accepted`; B owns B's. "Agreement" is the **overlap of two independent local
decisions**, and no component computes that overlap.

What travels is **facts** — bundles, SVIDs, witness attestations, revocations. What never travels is the
**decision**.

Structural consequences you can verify by reading signatures:

- `evaluateBundleOffer` takes exactly **one** peer's bundle. No function takes "the list of trusted nodes".
- Nothing needs the size of the society or an enumeration of it.
- `AcceptedBundles` is a node-local `Map`; two nodes' maps are unrelated objects, never merged.
- The one mode that consults a third party (`witness-quorum`) reads only a list the node derives from
  domains it **already** accepted (`witnessDomainsFromAccepted`). No peer can hand a node a roster.

**Asymmetric trust is a legal steady state, and it is the discriminating test.** The demo loop ends with
`accepts(A,C)=true`, `accepts(B,C)=false`, `accepts(C,A)=false` — three different local policies, three
correct answers, nothing to repair. A design that quietly assumes symmetry passes every other test and
fails that one (`trust-bundle.test.ts` §asymmetry).

---

## 3. Bootstrap: proof of shared generator, and its honest scope

Two nodes were never starting from nothing — agents here are phased to the common seed **S=4**. The first
trust event is *reconstructing the same thing from the same seed*: derivable, not transmitted, no third
party, nothing out of band, **no human in the loop**. That last property is why it is the mode that makes
unattended operation reachable at all; operator-ceremony first contact is what breaks it.

**And here is the part that matters more than the mechanism.** `seed-bootstrap.ts` is registered `toy`,
and its header says why in plain terms:

- **Cryptographically this is a challenge-response over a group pre-shared secret** — HMAC with extra
  steps. Saying so is not modesty; the interesting-sounding description buys nothing HMAC does not.
- **It establishes:** the responder holds the seed. Replay resistance is real and tested — an observer of
  one exchange cannot answer a different nonce, and the verifier refuses a reused one.
- **It does not establish who anyone is.** A seed held by everyone in the society is held by everyone who
  copied it. This authenticates **membership in the generator**; per-node identity still comes from the
  node's own root. It is the floor, not the stack.
- **It does not establish that the responder holds the generator** rather than a copied value, because the
  derivation ships in this repo and the seed is copyable.
- **What would earn more, named so the gap is a task:** a reconstruction that is *expensive to produce and
  cheap to check*, over an instance the **verifier** chooses — a proof of computation. Not implemented.

The scope disclosure travels with the verdict string, not only in a doc, and a test asserts it does.

---

## 4. Revocation is a G-Set — which is why "no CRL" was never the problem

Union is commutative, associative, and idempotent (Shapiro et al. 2011), so distribution is just pairwise
merge — the same shape as everything else. Two consequences are the payoff:

- **Revocation cannot be censored.** Withholding delays it; any single honest peer re-introduces it at the
  next union, and monotonicity means it never leaves again. Contrast a CRL, where the publisher's silence
  *is* the absence of the fact.
- **Fail-safe direction.** A lost message loses a *removal* of authority. No message exists whose loss
  silently grants authority.

**The security premise is Aaron's and is stated as a premise where the claim is made:**

> key population × rotation rate must outpace compromise rate. Revocation beats hacking by
> **numerousness**, not by being instantaneous.

Falsifiable and **unfalsified** — nothing measures propagation delay, compromise rate, or key population,
and no such measurement exists in the repo.

The laws are pinned by tests **including a paired negative**: a non-monotone `unrevoke`, implemented only
in the test file, is shown to diverge under reordering, with a positive control showing the same two
orderings converge when only `add` exists. A test that the module exports nothing removal-shaped keeps it
honest.

**Prior art, named rather than reinvented:** `tools/setup/persona-keys/key-epoch-ledger.ts` already
implements G-Set revocation over signed key-epoch transitions and got there first. This module's set is a
different layer (federation-layer roots and SVID subject keys). Two implementations of one idea are **one
observation, not two** — consolidation is the obvious later cleanup.

---

## 5. Persistent disagreement is the held decorrelation — DV2.0 Raw Vault

Two nodes holding different verdicts about a third is a **measurement**, not an error. `verdict-vault.ts`
loads facts as they arrive with their record source and **never conforms at load time**: a single version
of the FACTS, never of the truth (Linstedt & Olschimke 2015). Opinions are formed downstream as derived,
re-computable views that never destroy the evidence.

The formal name is **monodromy** — see today's `2026-08-20-harmonious-division-*`: the disagreement
measures the monodromy, and forcing agreement erases the measurement.

**What is deliberately absent, and tested to be absent:** no `reconcile`, no `consensusVerdict`, no
`resolve`, no last-writer-wins. A test enumerates the module's exports and fails if any appears. What
replaces them is `deriveActionableView` — computed at the point of action, **by the party acting**, over
evidence it does not modify, returning the dissent *alongside* the answer so a view cannot conform at read
time either. The same vault yields different actions under different local policies; that is tested.

Payment routing needs no global agreement: it needs **the two parties** each to accept the other. A third
node's disagreement is legal, retained, and not party to the transaction.

---

## 6. Where the human stays — the line, drawn explicitly

"Without human intervention" means the **routine path** is unattended. It does not ungate the gated class.
`ceremony-gate.ts` is a total function over a **closed** operation set (the portable half of the Itron
lineage: a peer may NAME an operation, never DEFINE one). The principle deciding each row:

> **UNATTENDED** ⟺ the operation is a link in a chain the node can already verify, and cannot enlarge the
> set of parties it trusts or the set of things a key may do.
> **CEREMONY** ⟺ the operation establishes or widens trust, or is irreversible.

| unattended | biometric ceremony |
|---|---|
| issue / renew leaf SVID | generate node root key |
| rotate **leaf** signing key | rotate **node root** key |
| refresh peer bundle **with continuity** | repair **broken** continuity |
| accept new domain under seed reconstruction | accept new domain at first contact (operator mode) |
| accept new domain under witness quorum | resolve a bundle conflict |
| merge peer revocation set (monotone) | remap HSM domain |
| publish own bundle · witness a peer bundle | widen standing budget |
| verify peer SVID | x402 payment **exceeding** standing budget |
| x402 payment **within** standing budget | export or destroy key |
| x402 verify authorization | open authenticated HSM session · provision hardware token |

The leaf/root asymmetry is the whole design: the *frequent* operation is the harmless one. A node that can
rotate its own root unattended can be made to rotate to an attacker's root unattended — and peers would
then accept it under continuity, so the compromise propagates silently.

**VACUITY DISCLOSURE, stated in the file and repeated here.** `ceremonyRequirementFor` is a **classifier,
not an enforcer**. It returns a label; nothing prevents a caller ignoring it. The single place the gate is
structurally enforced is `yubiHsmSignerRequiringCeremony`, which cannot sign at all — and that is because
the credential to open a session is absent, not because the classifier stopped anything. Everywhere else
this is documentation with a type.

---

## 7. x402: custody vs settlement

- **Custody** — holding the key, producing a signature, deciding to spend — never leaves the payer's own
  `Signer`.
- **Settlement / verification** — checking, relaying, broadcasting — needs **no key and no trust**.

The constraint is structural, not procedural: `verifyPaymentAuthorization` **takes no signer** and
`PaymentAuthorization` has no field that could carry private material. Both are checkable by reading the
signatures.

Facilitator-optional is tested in all three states — **absent**, **present and honest**, **present and
lying in both directions** — and the resource server reaches the correct verdict in every case. A
`FacilitatorOpinion` type exists *so the lie is expressible*, because otherwise "the facilitator is
untrusted" stays an assertion rather than a check. Money is decimal-string → integer minor units, never
floats; the test contrasts `0.1 + 0.2 !== 0.3` against the exact integer path.

`zeta-local-sig-v0` is **invented here**: not the x402 protocol as specified by anyone, not interoperable,
and it moves no money. No chain, no testnet, no socket.

---

## 8. The limit that is accepted rather than hidden

**Software workload attestation on a shared kernel is operational identity, not cryptographic isolation.**
Every field of `ObservedProcess` is under host root's control: root can run as any uid, place a binary with
any hash, relabel a container. So an SVID issued from these selectors means *the node's own bookkeeping
believes this process is X*, never *this process cryptographically proved it is X*. What would change the
class is a hardware root of trust measuring the boot chain; none of that is implemented. Aaron has accepted
this limit explicitly, which is why it is written at the mechanism rather than in a footnote.

Two smaller ones worth carrying: attestation refuses on **ambiguity** rather than first-match-wins (identity
must not depend on config ordering), and the attestation digest **excludes pid** (a recycled pid would
otherwise change a live credential's meaning).

---

## 9. A finding against the existing seam

`agentic-organization/packages/application/src/spiffe-identity.ts` types the x509 SVID as
`{ certChain: string; privateKey: string }`. That field is a **custody violation** against the KeyCustody
row of `docs/DECISIONS/2026-06-21-hexagonal-pki-and-secret-vault-ports-swappable-adapters.md` — *"private
bytes never leave the custody boundary"* — because the private half is modelled as a value the identity
provider hands out. The types in this module deliberately do not have that shape: an SVID carries the
**subject public key** and nothing else, and the private half exists only inside a `Signer` that has no
method capable of returning it. Not fixed here (different package, and the fix is a call-site change);
recorded so it is not rediscovered.

**And three defects found in my own code by the anti-vacuity discipline, worth reporting because they
are the exact class Aaron named — a check that reads as a guarantee and performs nothing.**

1. `PaymentRejection` originally declared `"payer-key-not-bound-to-svid"` and `"signed-before-issue"`.
   Neither was ever returned by any code path — two checks the verifier *appeared* to perform and did
   not. The enumeration test (every union member reachable, not a hand-picked subset) caught both; they
   were **deleted** rather than left to look like protection.
2. `PaymentChallenge.scheme` was typed as the literal `"zeta-local-sig-v0"`, which makes
   `challenge.scheme !== X402_SCHEME` provably false and the scheme check **dead code**. ESLint's
   `no-unnecessary-condition` caught it. Fixed by widening to `string`: a wrong value must be
   **representable** in order to be **refusable**.
3. `SeedChallenge.derivation` had the identical defect, making `unsupported-derivation` unreachable.
   Same fix.

(2) and (3) are the same shape as the `WitnessStake.voluntary: true` bug already on file in
`src/Core.TypeScript/key-custody/key-custody.ts` — a field typed as a literal turns the guard that reads
it into decoration. Three instances now; it is a recurring class in this codebase, not a one-off.

---

## 10. What runs, what is designed only

| | status |
|---|---|
| pairwise bundle evaluation, continuity, conflict, refusal codes | **runs**, 13 refusal codes each proven reachable |
| local SVID issuance + federated verification | **runs**, 10 rejection codes each proven reachable |
| software workload attestation | **runs** — and see §8 for what it means |
| G-Set revocation + convergence + censorship-resistance | **runs**, with the non-monotone negative control |
| seed-reconstruction first contact | **runs** — `toy`, see §3 for exactly what it proves |
| raw-vault verdict store + derived views | **runs** |
| rotation planner (4 bands, checkpoint reserve) | **runs**; 4 unattended renewals over 140 phases in the demo |
| ceremony classifier | **runs** — a classifier, not an enforcer (§6) |
| x402 challenge → local authorization → keyless verification | **runs** — `toy` scheme, no settlement layer |
| three-node demo loop | **runs**: `bun src/Core.TypeScript/federated-identity/federation-loop.ts` |
| **real SPIRE server / agent** | **not attempted.** The issuer is SPIRE-*shaped*; no SPIRE binary was contacted |
| **YubiHSM signing** | **designed only, and it refuses at runtime.** Needs an authenticated session |
| **any network** | **absent by construction.** No listener, not even localhost |
| **any settlement** | **absent.** No chain, no testnet, no funds |

---

## 11. What needs Aaron's ceremony or hardware to go further

1. **Generate node root keys on the real device** — and decide whether roots live in the YubiHSM at all.
2. **Open an authenticated YubiHSM session** so `yubiHsmSignerRequiringCeremony` can be replaced by an
   adapter that signs. Everything hardware-shaped is blocked behind exactly this.
3. **Choose the standing budget numbers** for x402 (`perPaymentMax`, `totalMax`). The mechanism is built;
   the envelope is a human's to set.
4. **Choose each node's first-contact mode.** Seed-reconstruction is unattended and proves membership
   only; witness-quorum is unattended and needs prior accepted peers; operator-ceremony is safest and
   breaks unattended operation. This is a policy call per node, not a default to be picked by an agent.
5. **Approve the rotation dials** — SVID lifetime, renew fraction, checkpoint reserve, bundle staleness
   ceiling. All are policy, all are currently argued-for rather than measured.
6. **Decide the consolidation** between this module's revocation set and `key-epoch-ledger.ts` (§4).
7. **Whether any of this lands** — the module is untracked in a worktree and no PR was opened.

## 12. Where it sits in existing work

This lands directly on the active trajectory `docs/trajectories/local-trust-view-decentralized-identity/RESUME.md`
(*"a node's trust verdict must be a pure function of what that node holds… two nodes may reach different
verdicts about the same subject, and both are correct"*) and on
`docs/research/2026-08-19-draft-the-distributed-identity-server-inventory-*.md`, which grades the existing
pieces and enumerates the gaps. It uses the phase-not-wall-clock discipline from
`src/Core.TypeScript/key-custody/key-custody.ts` and `src/Core/KeyCustody.fs`, and it builds on the SPIFFE
seam in `agentic-organization/packages/application/src/spiffe-identity.ts` rather than replacing it.

**Anchors (Beacon):** SPIFFE/SPIRE — Gilman, Haken et al., *Solving the Bottom Turtle* (2020), and its
federation model. Key continuity — Ylönen, RFC 4251 §4.1; Gutmann, *Plug-and-Play PKI* (2003).
Short-lived credentials instead of revocation lists — Rivest, *Can We Eliminate Certificate Revocation
Lists?* (1998); the design consequence implemented here (expiry needs no cooperation, a CRL does) is
exactly that paper's argument, so the anchor is **checked**, not merely cited. CRDTs — Shapiro, Preguiça,
Baquero & Zawirski (2011). Data Vault 2.0 — Linstedt & Olschimke (2015). Exit as the discipline on
concentration — Hirschman (1970).

---

## Correction — what we built is a CLUSTER, not a FEDERATION (Addison's distinction)

Aaron 2026-08-20 pointed at the org root site: *"look up addison federation over cluster in our
root lfg website … this is the dinstinction."*

**Addison Cooper realized this distinction** (2026-06-20). Aaron 2026-08-20, confirming:
*"Addison realized this."* `docs/CONCEPT-REGISTRY.md` and the shipped concepts page **record** it;
they are not its source. Stating that plainly because the registry's passive voice makes an
originator look like a row author, and because getting this backwards is a live failure mode here —
a homoiconicity result of Lumen's was read back off Aaron and credited to him earlier the same day
(fixed in #12792). **The insight is hers**, and so are three more of the concepts this design leans
on: **Federation**, the **Universal Exit Principle** (2026-07-31), and **Lodge**.

The live concepts page states it plainly:

> *"Clusters are not organizations. They are relationship structures. Federations are not social
> groups. They are contract-bound institutions."*

| term | held together by | enforceable |
|---|---|---|
| **Cluster** | **relationships** | **never** |
| **Federation** | **contracts** | **yes — with exits** |

**The word "federation" throughout this document and in the module name is SPIFFE's, not ours**,
and the two senses diverge exactly where it matters. SPIFFE calls trust-bundle exchange
"federation"; Zeta reserves that word for something with *contracts and enforceable obligations*.

**And this design's own cost statement is the proof it is the other thing.** It says: *"no node
can be told it is wrong."* That is **non-enforceability, stated as a feature** — which is the
definition of a **cluster**. Acceptance here is a relationship: revocable at will, at zero cost, by
either side, with no obligation surviving the withdrawal.

So the honest reading of what runs today:

- **It is a cluster.** Pairwise acceptance held by relationships. Every property claimed for it —
  local policy, directed `accepts(A,B)`, asymmetry as a legal steady state, no repair path — is a
  *cluster* property, and each one is a **consequence of non-enforceability**, not an achievement
  on top of it.
- **A real federation would need what this does not have:** a charter (the registry's **Lodge** —
  a named federation instance with its own constitution), stated obligations that outlive a mood,
  and an exit with a **defined cost** rather than a free walk-away.

**This sharpens the exit rule rather than contradicting it.** The registry also carries the
**Universal Exit Principle** (Addison Cooper, 2026-07-31): *"No human, agent, vault, cluster, or
federation may be trapped indefinitely. Exit may cost (notice period, buyout, reputation hit) but
must exist."* So **costly exit is still exit** — which is the refinement the hub/oracle
discriminator needed. "Must you route through it?" was too coarse; the real question is *"can you
leave, at a price you can see?"* A federation whose exit costs something is legitimate; a hub is
where the price is unpayable or unstated.

### Cluster-grade is a POSITION, not a shortfall — and the two builders disagree

The paragraph above says *"a real federation would need what this does not have"*, which frames
federation as the mature end state and the cluster as a way-station. **That framing is wrong**, and
Aaron corrected it 2026-08-20:

> **"yes addison it trying to create this, i try to protomate non fedeeraion and only
> correspondance/cluster."**

So the two people building this hold **different positions on the same axis**, deliberately:

| | position | what it buys |
|---|---|---|
| **Addison Cooper** | building **toward federation** — Lodge charters, stated obligations, the Universal Exit Principle | **enforceability** — obligations that outlive a mood, which is what lets anyone be held to a commitment |
| **Aaron** | promotes **non-federation** — **correspondence / cluster only** | **non-coercion** — nothing binds anyone, so nothing can trap anyone |

**This is the `ρ` band again, instantiated in social structure rather than in agents.** A contract is
*enforced correlation*: it deliberately removes the freedom to diverge, which is exactly what makes
a promise worth something. A relationship preserves the freedom to diverge, which is exactly what
makes it non-coercive. Neither pole is the good direction — it is
*Unification without Harmonious Division is a bomb; Harmonious Division without Unification is Higgs
decay*, with two humans holding the two poles.

**So this is not a disagreement to resolve, and the substrate should not try.** By the repo's own
raw-vault discipline, both positions are recorded with their sources and neither is conformed away
— the disagreement carries information about the design space that collapsing it would destroy.
Recorded here because a reader meeting `federated-identity/` a year from now will otherwise assume
the cluster was a stepping stone, and build the contracts nobody asked for.

**A note on "correspondence", which is a third term and weaker than both.** Aaron pairs it with
cluster rather than treating it as a synonym. Taken plainly it is thinner than a cluster: not a
group at all, just **peers exchanging directly** — no membership, no shared structure, nothing that
persists between exchanges. That reading is *inferred from the pairing and is not yet checked*
against a definition in `docs/CONCEPT-REGISTRY.md`, which does not carry the term. Flagged as a
vocabulary gap rather than silently defined.

**Nothing in the code changes on this finding** — the mechanism is right, and a cluster is the
correct starting point when no contracts exist yet. What changes is the **claim**: this is
cluster-grade trust, and calling it federation-grade would promise enforceability that is not
there. Renaming the module is deferred rather than done, because `federated-identity` also names
the SPIFFE mechanism a reader will search for; the collision is recorded here so the next reader
meets it at the claim rather than discovering it later.

*(Register: the distinction is **checked** — read from `docs/CONCEPT-REGISTRY.md` rows 35–36, 54–55
and the shipped concepts page. The judgement that this build is cluster-grade follows from its own
stated "no node can be told it is wrong", not from an outside opinion.)*
