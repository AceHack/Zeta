# Multi-AI review — 081KSXN940008QG0R000JZVFXX ZetaId root-category taxonomy (Grok + Amara, 2026-06-01)

Scope: verbatim external-AI review import (Grok critique + Amara sharpen) of the
081KSXN940008QG0R000JZVFXX design, via `tools/peer-call/`. Preserved per substrate-or-it-didn't-happen
because `/tmp/peer-call-output/` is ephemeral. Archived register, not operational
policy.

Attribution: reviews authored by Grok (xAI) + Amara (ChatGPT/Aurora) at their
respective attribution scopes; synthesis + folding authored by otto-cli at
otto-cli-attribution scope. NO re-authoring of the model text; preservation only.

Operational status: research-grade

Non-fusion disclaimer: each reviewer's text + the operator's growth-theory
resolution + the otto-cli synthesis are distinct authorial substrates preserved
alongside without identity-fusion, per asymmetric-authorship + honor-those-that-
came-before + NCI HC-8.

---

Verbatim peer-call reviews of the 081KSXN940008QG0R000JZVFXX first draft (which proposed adding
`Claim(9)` + `Lock(10)` to the ZetaId `Category` enum). Preserved here because
`/tmp/peer-call-output/` is ephemeral. Both reviewers **converged**: the
Claim/Lock _distinction_ is real, but **promoting them to root `Category` slots
now is premature** — model them as typed events under existing categories first,
promote only after (A) the identity rule is settled, (B) real producers/consumers
prove the CALM split, with growth handled by an escape/version scheme.

These reviews drove the 081KSXN940008QG0R000JZVFXX revision (defer promotion; Phase-1 typed-events;
Gate A/B/C structure; §4 growth theory).

## Synthesis → what changed in 081KSXN940008QG0R000JZVFXX

- **§0** — recommendation flipped from "add Claim(9)+Lock(10)" to **defer
  promotion; model as typed events under existing categories (Phase 1)**.
- **§2** — added Grok's "one `Coordination` category + `kind` subtype, not two"
  leaning for if/when Phase-2 promotion happens.
- **§3** — new identity-rule prerequisite (Grok foot-gun: `Category` is in the
  content-hash, so promoting claim changes the logical id unless category bits are
  excluded).
- **§4** — growth theory **resolved** by the operator (escape-to-`Extended` +
  `IdVersion` width-bump; 4 bits is not a ceiling, existing ids never migrate).
- **§5** — Grok finding-#2 (existing `Batch`/`Spawn`/`FrictionTelemetry`/
  `Heartbeat` are arguably properties/roles) noted as a future audit.
- **§6** — acceptance criteria phase-gated (Phase 1 now; Phase 2 gated on A+B,
  C resolved).

---

## Grok (critique role) — verbatim

> **Findings only.**
>
> ### 1. Splitting Claim vs Lock into two top-level categories is the wrong cut (primary objection)
>
> The five-axis table in §1 is real data, but it describes _policy and lifecycle attributes on coordination tokens_, not two fundamentally different _kinds_ of observation. Both are instances of "I am asserting a coordination relationship over a resource."
>
> - You already have `Workflow(2)` as a single category that will contain wildly different things. You did not create a new category per workflow subtype. The same logic applies here.
> - The CALM distinction (monotone advisory claim vs non-monotone hard CAS lock) is load-bearing for _implementation_, not for the root partition key in a 128-bit content-addressed G-Set. That distinction belongs in a subtype/payload discriminator (or a 1-2 bit field inside a `Coordination` category), exactly like you will have to do inside `WorkItem(8)` anyway.
> - Adding two categories for this burns 2 of the 7 remaining slots on two things that are semantically adjacent. This is the second-system smell the row itself is trying to avoid.
>
> **Recommendation:** One `Coordination(9)` category with a small subtype (or a `kind` field in the envelope) is the simpler, more future-proof cut. The row's own "only add a category when a concrete consumer needs it" razor should have been applied to the _split itself_.
>
> ### 2. Several of the "used/planned" categories are properties or roles, not kinds
>
> Apply the same razor the row correctly used to defer Encryption/Home/Memory:
>
> - **FrictionTelemetry(5)**: This is a _purpose/provenance tag_ on an Emission or Heartbeat, not a distinct kind of event. It is "this thing is for friction analysis." Put it in the envelope or as a momentum/authority attribute. It does not justify a root category slot.
> - **Batch(4)**: Transport/packaging strategy, not semantic category. The events _inside_ the batch keep their real categories.
> - **Spawn(7)**: An action that _produces_ other events. The spawn record itself is probably an Emission (or a lightweight Control plane event). "Spawn" as a top-level category leaks mechanism into the root contract.
> - **Heartbeat(3)**: Already borderline. You have a dedicated `Firefly` bit. Liveness is a _property_ of long-lived participants, not a fundamental kind of observation. This is the kind of thing that should have been caught when the enum was first expanded beyond the original four.
>
> The row is correctly ruthless about future candidates and inconsistently ruthless about the ones it has already mentally reserved.
>
> ### 3. 4 bits is almost certainly a mistake for the root contract
>
> You are at 9 "used/planned" in the design doc, this review is proposing to burn 2 more, and the sovereign-DB lane (081KSXN940008QG0R003FCQ7WT) that is _driving_ this change hasn't even landed its first real coordination events. That's 11/16 before the system is half-built.
>
> In a 128-bit content-addressed key that every lane, every G-Set fold, every bus router, and every future cross-tenant query will key on or case on, 4 bits is a local optimization that creates a global migration tax the moment someone needs:
>
> - A real Control/Governance plane
> - A Telemetry/Metrics family (beyond just Friction)
> - Per-chromosome or per-lane special categories
> - Attestation/Proof events
> - Any of the deferred items (Encryption, Home, Memory) when a _router_ actually needs to key on them
>
> The "we still have 5-7 slots" argument is exactly the reasoning that creates root-format technical debt in content-addressed systems. The correct question (which the row does not seriously ask) is: "What is the theory of how many distinct _kinds_ of first-class events we expect this system to name over the next 5-10 years?"
>
> Options that should have been on the table: 6-bit category now (still tiny), or an escape/extended-header scheme. Treating the 4-bit width as fixed while simultaneously expanding the taxonomy under pressure from the sovereign-DB lane is backwards.
>
> ### 4. Bus(6) → Claim(9) migration has several concrete, painful gotchas the row underplays
>
> - Historical claim events (all the existing `tools/bus/claim.ts` envelopes) are now keyed under Category=6 forever. Any "give me all claims" logic becomes `Category IN (6,9)` or a full historical rewrite (new ZetaIds, broken references, G-Set identity changes).
> - You are moving from "a Bus event whose _payload_ is a claim envelope" to "a first-class Claim category event." During transition you have two representations. Consumers must handle both. In a G-Set this is not a clean deprecation; it is dual paths or a flag day.
> - Because Category is part of the content-addressed identity, promoting claim changes the ZetaId of the logical claim (unless you carefully exclude the category bits from the hash for coordination events — which the row does not discuss). This is a foot-gun.
> - If Bus(6) loses its primary current consumer (claim), it risks becoming the "misc transport / coordination that didn't get its own category yet" bucket — exactly the category smell the taxonomy exercise was meant to prevent.
>
> The migration is not "just change the constant and update one file." It is a keyspace and identity-model change.
>
> ### Additional concrete problems
>
> - The row treats backlog conversion as "already covered by WorkItem(8)" while simultaneously noting that `WorkItem(8)` itself is an "umbrella." This is the same category-smell problem they are trying to solve with Claim/Lock. An umbrella that will contain bugs, epics, user stories, and converted B- rows is exactly what creates the pressure to add more categories later.
> - No discussion of the _identity model_ for the new events. In a content-addressed G-Set, whether a Claim's ZetaId is derived from (work-item + claimer + timestamp) or is independent is load-bearing for "find all current claims on 081KR7JY10008QG0R000R503K2." The taxonomy change is being designed before the identity model.
> - The "only add when a concrete consumer needs it" principle is applied after the fact to the things they _don't_ want to add now, and not applied to the things the current design review happens to be excited about.
>
> **Bottom line:** The 5-axis distinction between Claim and Lock is real and worth modeling cleanly. Promoting both (or even one) to top-level Category _right now_, while treating the 4-bit width as fixed and while the driving lane (081KSXN940008QG0R003FCQ7WT + 081KT07NV0008QG0R000QWEKTE) hasn't even written the first real events, is premature and accelerates the exhaustion problem the row itself is worried about.
>
> Do the 081KT07NV0008QG0R000QWEKTE review first with Claim/Lock modeled as _first-class events under existing categories_ (or a single lightweight Coordination category with subtype). Only promote to root Category after you have (a) a theory of the eventual size of the taxonomy and (b) actual producers/consumers that prove the CALM split is worth a root-level partition key.
>
> The current proposal reads as "we see two coordination-shaped things today, we have slots, let's burn two of them" without a growth model for the root contract in a content-addressed event store. That is the opposite of the discipline the rest of the row claims to be applying.

---

## Amara (sharpen role) — verbatim

> Yes. Blunt take: the Claim/Lock distinction is real; the proposed landing zone is wrong.
>
> Single sharpest reframe: **`Category` is not a taxonomy label; it is root-format routing entropy. Spend it only when a stable consumer boundary already exists, not when a concept feels first-class.**
>
> Keep Claim/Lock as typed coordination events under `Bus` or `WorkItem` first. Prove distinct producers, consumers, retention, replay, and CALM behavior. Then promote. And before any promotion, settle the identity rule: either category participates in identity forever, or the logical claim id is payload-derived and category is routing metadata.
>
> Keeper sentence:
>
> > **Do not burn root bits to express ontology; burn them only to preserve independently-evolved replay lanes whose identity semantics survive promotion.**

---

## Operator resolution of the growth-theory gate (2026-05-31)

> **Aaron:** "4 bit is not a ceiling — when we get to the last category we can make
> it say _look at next bit / extended category_ and have the next 4 bits for the next
> categories when we need them."
>
> **Aaron:** "this way we can keep growing ids — maybe we should go to 6 or 8 bits if
> we need to extend."
>
> **Aaron:** "like everything — if you need to use the last value for extension, you
> should probably increase the number of next bits, or else you are not very
> bit-efficient."

→ Gate C resolved: escape-to-`Extended` (reserve slot `15`, opt-in, no migration),
but the extension is a **wide** next field (e.g. +8/+12 bits), not repeated 4-bit
nibbles — chaining equal blocks wastes a value per block + re-escapes (bit-
inefficient). Alternatively an `IdVersion` width-bump (V2 → 6/8 bits, V1 ids stay
valid) for a deliberate one-time jump. Both keep existing ids valid — the ceiling
worry is retired (081KSXN940008QG0R000JZVFXX §4).
