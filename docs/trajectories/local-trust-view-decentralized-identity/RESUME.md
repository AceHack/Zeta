# Local trust view — every node computes its own verdict (decentralized identity)

Status: **active trajectory**; OPERATOR-INITIATED (Aaron 2026-08-10)
Last refreshed: 2026-08-10
Current blocker: none — the first slice is specified and unblocked
Next concrete action: build `LocalTrustView` (§4 slice 1), keyed on an **open** identifier, with the two-nodes-disagree-and-both-are-correct property as the headline test; then `diffTrustView` (slice 1b) so the disagreement becomes the product
Evidence links: `src/Core/AntiSybil.fs` · `src/Core/CoordinationSpectrum.fs` · `src/Core/SybilBft*.fs` · `src/Core/IdentityDLA.fs` · `src/Core/PrivacyPreservingIdentity.fs` · `src/Core/IdentityCapacity.fs` · `src/Core.TypeScript/observe/phase-erasure.ts` (`verifyFromAnchor`, `firstBrokenLink`, landed `755640fb0`) · `src/Core/Consent/KskAuthorization.fs` (per-traveler roster precedent) · `src/Core/MultiSignatureVerification.fs`

---

## 0. The carved sentence

> **Freedom is choosing who you trust without accidental interference.** A node's trust
> verdict must be a **pure function of what that node holds** — its own anchors, its own
> attestations, its own oracle. No registry consulted, no global graph assembled, no
> ambient input. Two nodes with different histories may reach **different verdicts about
> the same subject, and both are correct**.

Aaron 2026-08-10: *"this is freedom, choosing who you trust without accidental
interference."*

## 1. Why this is §13 noninterference, not a slogan

"Accidental interference" has an exact technical meaning here, and it is the reason this
trajectory is an engineering task rather than a value statement.

**Noninterference (§13):** influence enters only through declared, metered channels.
Applied to trust: a verdict contaminated by *ambient* state — a global registry, a shared
graph, someone else's oracle consulted by default — has taken influence through an
undeclared channel. That is interference, and it is *accidental* precisely because nobody
chose it; it arrived by architecture.

So purity is not an implementation preference. **Purity is the freedom guarantee.** A
trust function that reads only its own arguments cannot be steered by a party the node
did not choose to consult, and that is checkable rather than promised.

This is also why the sibling property matters: if two nodes with different histories could
*not* disagree, some shared authority would be making the call for both.

## 2. What already exists (checked 2026-08-10)

| surface | what it gives |
|---|---|
| `verifyFromAnchor` / `firstBrokenLink` | chain-segment verification against an anchor **the verifier already trusts**; genesis is the special case. Landed today. |
| `CoordinationSpectrum.fs` | the **neutral fact** (`SameSourceAsKnown`) with the reading deliberately left to the caller |
| `AntiSybil.fs`, `SybilBft*.fs` | the sybil oracle the spectrum wraps, plus BFT liveness/progress |
| `IdentityDLA.fs`, `IdentityCapacity.fs`, `PrivacyPreservingIdentity.fs` | identity substrate, capacity, privacy-preserving forms |
| `Consent/KskAuthorization.fs` | **the precedent**: per-traveler rosters, no global roster, two travelers may reach different verdicts on the identical request and both are correct |
| `MultiSignatureVerification.fs` | the signature primitive the authentication upgrade (§5) needs |

**The primitives are in better shape than the composition.** What does not exist is the
function that puts them together *locally*.

## 3. What is NOT a blocker (checked, and my earlier claim was wrong)

`IdentityRegistry.fs` is a generated, closed enum of eight personas. I first read that as a
central issuer. **It is not.** `PersonaId.parse` has exactly two call sites
(`ActorRef.fs:113`, `:170`) and both degrade as `| None -> None` — an unrecognized
identity is *unresolved to a known alias*, never *refused participation*.

Aaron 2026-08-10: *"this will dilute over time, it's just an honest measure today, not a
conclusion. Over time we have more hubs; hubs are inevitable but there are an infinite
amount."*

That is the scale-free reading and it is correct: a power-law degree distribution has no
characteristic scale, so there is no *the* hubs — a head that is currently eight names and
an unbounded tail. **A closed enum is a snapshot of the head. It is only a central issuer
if the tail needs permission to grow, and it does not.** The registry stays useful exactly
as it is: a typed, exhaustively-matchable list of *known* personas, good for DST
determinism and total matches.

**Design consequence:** the trust view keys on an **open identifier** (anchor set / ZetaId
/ public key). `PersonaId` is an optional *label overlaid on top*. A subject with no
persona name is a first-class participant, not an error case.

## 4. The staged plan

### Slice 1 — `LocalTrustView` (next action)

`(myAnchors, observedStamps) → verdict(subject)`. Total, no I/O, no registry read, no
global graph assembled.

Required properties, each a test:

1. **Purity / noninterference** — the verdict is a function of the arguments alone. Same
   inputs, same verdict, on any machine, with no ambient reads.
2. **Legitimate disagreement** — two views with different histories return different
   verdicts for the same subject, and both are correct. *This is the headline test; it is
   the thesis as an assertion.*
3. **Spectrum, not boolean** — returns a graded verdict carrying `SharedAnchor(depth)`,
   never `Friend`/`Enemy`. Recency of the deepest shared anchor is the strength measure.
4. **Open-keyed** — a subject with no `PersonaId` is handled identically to one with.
5. **No global assembly** — the type makes it impossible to ask for "everyone's" view.

### Slice 1b — `diffTrustView`: the disagreement IS the product

Aaron 2026-08-10: *"we should learn from every unique history."*

This looks like it fights §0 and does not. **Noninterference was never "no influence" — it
is "no UNDECLARED influence."** A peer's history entering as an *argument you chose to
fetch and can inspect* is evidence; the same history arriving because the architecture
consults a registry on your behalf is interference. The function stays pure; the arguments
get richer.

**And the uniqueness is the entire reason there is anything to learn.** If every node held
the same history, N nodes would give one observation, not N — the
correlation-destroys-evidence result from
the amortization doc <!-- STALE-REF: ../../research/2026-08-10-amortization-is-deliberate-correlation-cost-cluster-decomposition-and-the-potential-as-condensate.md -->,
arriving from the other side. So the system wants **shared substrate** (cheap — sharing is
where savings come from) and **independent histories** (informative — independence is
where evidence comes from). Same structure, opposite sign, exactly as in §5 of that doc.

**The primitive:** `diffTrustView(mine, theirs, subject)` → *which anchors one side holds
that the other does not*. **Not a merged score.**

Averaging destroys the information; the divergence *localises* what one node knows that
the other does not. This is Knight & Leveson (1986) applied to trust: independently
developed versions fail in correlated ways, so voting buys little and the value is in
**reading the divergence**. It is what made the N=3 clean-room run worth its cost, and it
is why reconciliation is the wrong instinct here.

Properties:

1. **Pairwise and initiated** — computed by a party who already holds one side. Never a
   broadcast, never an assembly; slice 2's constraint survives intact.
2. **Still pure** — `theirs` is an argument, not a fetch performed inside the function.
3. **Disagreement is an OUTPUT, not an error** — the return type has no "conflict" case,
   because there is no conflict. Two correct views differing is the normal case.
4. **Asymmetric by construction** — `diff(a,b)` and `diff(b,a)` answer different
   questions ("what do they know that I do not" vs the reverse), and collapsing them to a
   symmetric distance would discard the direction that tells you what to go learn.

### Slice 2 — the fingerprint constraint

A party computes its own neighbourhood **without the global graph existing anywhere**.
Rationale is not internal misreading; it is that *a graph which exists can leave*, and the
only protection against a reading you do not control is that the object was never
assembled (Narayanan–Shmatikov: sparse high-dimensional history is uniquely identifying —
the best-documented failure of the method being borrowed).

### Slice 3 — signatures close the theft gap

Anchors cannot be **minted** (you must have participated), which is where PGP's
sybil-resistance fails — keypairs are free. But anchors can be **acquired**: the chain is
verifiable and *not secret*, so anyone holding an anchor can produce valid continuations.
`MultiSignatureVerification` over the stamp is the upgrade from *consistency* to
*identity*. Per-agreement mutual anchors (Aaron) bound the blast radius: a stolen anchor
unlocks only its own contract, never the participant.

### Slice 4 — OAuth as an **export**, deliberately last

OAuth today is consumed only (GitHub device code, Bitbucket); there is no issuing surface.
**Building the provider first would force naming an issuer, and an issuer is a hub** — the
exact thing this trajectory exists to remove, reintroduced at step one and worked around
forever after. Once a node computes its own verdict, OAuth becomes a shim that *exports* a
local verdict to systems expecting a central authority. Same content, opposite dependency
direction.

## 5. Falsifiers

- If the verdict ever reads state outside its arguments, §0 is violated and the freedom
  claim is void — **check by construction, not by review**.
- If two differently-historied nodes cannot disagree, a shared authority is deciding for
  both.
- If a global graph is assemblable from the API, slice 2 has failed regardless of intent.
- If a `Friend` verdict ever appears in the type, the neutral-fact discipline
  (`dual-use-detection-is-neutral-oracle-decides`) has been abandoned: reunion, sybil, and
  deanonymization are three readings of one fact, and the mechanism must not pick.

## 6. Pointers

- `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` <!-- STALE-REF: ../../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md --> — report the fact, never the verdict
- `.claude/rules/privacy-budget-is-hard-money-earned-by-others.md` <!-- STALE-REF: ../../../.claude/rules/privacy-budget-is-hard-money-earned-by-others.md --> — why frost must be structural, not policy; the newcomer path that does not reopen minting
- `.claude/rules/manifesto-13-specifications.md` <!-- STALE-REF: ../../../.claude/rules/manifesto-13-specifications.md --> — §1 scale-free, §11 multi-oracle, §13 noninterference
- `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` <!-- STALE-REF: ../../../.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md --> — emergent hubs vs appointed; the IP boundary this trajectory sits on
- `docs/research/2026-08-10-the-threshold-rhyme-*` — foreclose-vs-per-step; frost is the foreclosing branch
