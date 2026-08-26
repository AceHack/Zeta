# GitHub-native consent sign-off — design

> **What this is.** A way for the ~20 people named in _You, Born at the Hinge_ to record consent
> using a credential they already control, in under a minute, producing an artifact anyone can
> verify without asking Aaron. It is the **machine-checkable half** of
> [`CONSENT-LEDGER.md`](CONSENT-LEDGER.md), which stays the source of truth for scope, conditions,
> reasoning and history. This doc is design + schema; the enforcement is
> `src/Core.TypeScript/hygiene/audit-consent-signoff.ts`.
>
> **Status: designed and verified, not yet used.** `consent-events.json` ships with an empty
> roster and zero events. Nothing here has collected anyone's consent, and no one has been asked.

## 1. The property that has to hold

> **They produced the artifact with a credential they control, and verification does not route
> through Aaron.**

A ledger row saying _"Aaron says they consented"_ fails this, and most of `CONSENT-LEDGER.md` is
currently that shape — honestly labelled as such ("relayed by Aaron", "a predicted yes is not a
yes"), which is exactly why it is worth giving those rows something to stand on. The row must
**cite an artifact the person authored**, and a third party must be able to re-check it.

Everything below follows from that one sentence.

## 2. Why GitHub review verbs

Aaron: _"most of my people understand github so this would be a good sign off method."_

A **pull request whose diff is the passage about them, with the person as reviewer.** GitHub
already has three authenticated, timestamped, attributed decision verbs, and they already mean
what consent needs:

| GitHub verb         | meaning here                         | recorded as                          |
| ------------------- | ------------------------------------ | ------------------------------------ |
| **Approve**         | consent, to this text, at this scope | `grant` event citing the review id   |
| **Request changes** | decline — with their reason attached | no grant; their reason is the record |
| **Comment**         | discuss without deciding             | nothing folds; the thread is the ask |

No custom vocabulary, no form to build, no new account for anyone. And **the diff is the ask** —
they read the exact text that will be published, not a summary that can drift from it.

Signer effort: open the emailed link → read a short diff → click Approve. **Target: under 60
seconds.** _(Register: **speculative** — the target is a design goal, not a measurement. The
first real signature is the falsifier.)_

## 3. Where the PRs live — the public-repo question, answered by measurement

The original framing of this work assumed Zeta is private and therefore that a separate public
repo was needed so signers would not have to be added as collaborators. **That premise is false
and was checked rather than assumed:**

```text
$ gh repo view Lucent-Financial-Group/Zeta --json visibility,isPrivate
{"isPrivate":false,"visibility":"PUBLIC"}
```

Zeta is **public** — and `CONSENT-LEDGER.md` already records that as deliberate: the drafts are
public _by design_, everyone named has been sent the links, and a public work-in-progress is a
**correction surface** (Aaron 2026-08-21: _"anyone can claim factual inaccurasion on so it offers
protection"_).

So the constraint the separate repo existed to solve does not exist. **Decision: the consent PRs
live in Zeta.**

| option                             | verdict                                                                                                                                                                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PRs in Zeta** ✅                 | Everyone already has read access (it is public), so **zero collaborators are added**. The diff is the real chapter, so there is no copy to drift. The review is publicly queryable forever.                                       |
| Separate public consent repo       | Solves a problem we do not have, and buys a real cost: the passage in it is a **copy** of the book text, so the artifact people approve can silently diverge from what publishes. Keep in reserve only if Zeta ever goes private. |
| Signer forks Zeta and opens the PR | Rejected — makes the signer clone a 50k-file repo. The effort budget is 60 seconds.                                                                                                                                               |
| Gist / issue form / email survey   | Rejected — none has a typed decision verb. Parsing _"yes, but…"_ out of prose is the vacuity class: a check whose result depends on a reader's charity.                                                                           |

**The verifier does not depend on this choice.** `artifact.repo` is a field, so moving the PRs to
another repo later is a data change, not a code change. That is deliberate — the mechanism must
not become a reason Aaron cannot move.

### Reviews from non-collaborators — what actually works, and one thing to not build on

Anyone with **read access** may review a pull request, and a public repo grants read access to
everyone (`docs.github.com`: _"You can request a review from a person or team with read access to
the repository, and they receive a notification"_; _"Anyone with read access can review and comment
on proposed changes"_). _(Register: **consistent with** the documented permission model. The first
real review request to a non-collaborator is the falsifier; if the reviewer picker refuses, the
fallback is an `@mention` in the PR body plus the emailed link, which needs no review request at
all and produces the same review object.)_

**Do not build on branch protection.** GitHub only counts approvals _"by the required number of
reviewers with write permissions"_ toward a required-review rule. A design that needs the approval
to satisfy branch protection would push straight back toward granting twenty people write access —
the exact over-permission this avoids. **We need the review as an attributable artifact, not as a
merge gate.** The PR does not even have to merge for the consent to be real and checkable.

## 4. The design point most consent systems get wrong

> **Consent is given to _text_, not to a name.**

If the passage changes after approval, the consent is stale — and nothing about the approval says
so. GitHub's `dismiss_stale_reviews` branch-protection setting handles a _sliver_ of this: it
dismisses an approval when new commits land **on that pull request**. It cannot help at all with
the case that actually matters here, which is the passage being edited **months after the PR
merged**, during ordinary revision.

So the binding is a **content hash**, re-checked at build time.

A passage is delimited in the chapter with markers, and the hash is over the canonical text
between them:

```text
<!-- consent:begin id=chris-readers-disease person="Chris King" -->
Chris King named it *reader's disease* — the habit of mistaking
having read a thing for having understood it.
<!-- consent:end id=chris-readers-disease -->
```

- **Canonical form is minimal on purpose**: CRLF → LF, trailing whitespace per line, surrounding
  blank lines. Nothing else. Every additional normalization is a place a change could hide.
- **A one-character edit changes the hash.** That is the feature. The row goes **STALE** and
  publication is refused until it is re-approved.
- Markers inside fenced code blocks are **ignored**, so this very document does not register as a
  live consent span. An example must never be an assertion.
- `bun src/Core.TypeScript/hygiene/audit-consent-signoff.ts --spans` prints the current hash for
  every span, so nobody ever types one by hand.

This is the same discipline as `b-ref-adjudicated` in
[`.claude/rules/workitems-mint-with-zetaid.md`](../../../.claude/rules/workitems-mint-with-zetaid.md):
**checked, not trusted**, and a claim that no longer holds fails as STALE rather than silently
passing.

### Re-consent is a delta, not a re-read — the footprint hash

Hashing per passage would make a book-length revision pass unbearable: twenty people re-approving
thirty spans each. So a person may instead consent to their **whole footprint** — every span that
names them — with `spanId: "*"` and a hash folded over the ordered `(spanId, sha256)` list.

One approval covers all of it. When anything moves, the footprint goes stale **once**, and the
finding names exactly which member span changed, so re-consent is a diff of one paragraph rather
than a fresh read of everything. Ordering is ordinal by `spanId`, never file order, so the value
is identical on every machine.

## 5. Where the gate sits — a gradient, not a binary

Aaron 2026-08-26: _"i've told everyone who's named so far zeta is a public github repo. this is
fine because it can be disputed that i was delusional or hallucinating — a published book is the
hard demarcation."_

| tier                            | what it is                                      | what the audit does                                                                                                                                                                       |
| ------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **repo content** (drafts, RAWs) | public, disclosed, disputable, cheap to correct | fails on **false claims** — a cited review that does not exist / is not APPROVED / has the wrong author; a de-identified passage that still carries the name; a subject not on the roster |
| **the distributable book**      | the hard demarcation                            | additionally fails on **insufficient consent** — STALE text, an unclaimed named passage, a revoked passage still present                                                                  |

That is `--publish` versus the default mode. The split is principled rather than lenient: a **lie
in the ledger** is a defect at any stakes, while **insufficient consent** is a defect at the
stakes Aaron himself draws the line at.

**One honest limit, stated without editorialising:** the deniability is real but not absolute. A
public repo is indexed, quotable, mirrored and archived by third parties, so _"it can be disputed"_
is a **risk reduction, not a guarantee**. A passage in the repo can be read, screenshotted and
quoted by someone who never sees the dispute.

**And Aaron's practice is already stricter than his stated rule**, which is why the mechanism
supports more than the stated threshold: the ledger carries a subject **role-only, unnamed, in the
repo**, pending her reply — a protection applied long before any publication question arose. So
`mode=deidentified` is first-class:

```text
<!-- consent:begin id=colleague-elicitation person="A Private Individual" mode=deidentified -->
A colleague of mine, at the time, taught me to ask rather than infer.
<!-- consent:end id=colleague-elicitation -->
```

A de-identified span needs **no consent event** — it publishes under the de-identification, not
under a permission. What it does need is to actually de-identify: the audit fails
`DEIDENT_LEAK`, **in both tiers**, if the passage contains any of that person's declared aliases.
A de-identification that does not de-identify is a broken claim, not a lesser one.

## 6. Granularity — six scopes, every one of them already in the ledger

Manifesto §6 asks for granular consent, and a blanket release for twenty people is easier to
collect and worse to hold. One PR per **(person × scope)** makes granularity free. The scopes are
**derived from distinctions `CONSENT-LEDGER.md` already draws**, not invented here:

| scope                 | the ask                                      | the ledger row that establishes it                                                               |
| --------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `naming`              | your real name appears at all                | Chris King widening: _"Scope is naming; it does not cover publishing words attributed to Chris"_ |
| `attribution`         | credited as the source of an idea or coinage | Chris King, _"reader's disease"_; Houman's requested open-source credit                          |
| `quotation`           | your own words quoted verbatim               | the mother's _"a zombie waking up"_; _"an attestation in his voice needs his own text"_          |
| `portrayal`           | you are described; your conduct is narrated  | Lillian in the hospital-escape scene — _"exposure of her, not only of Aaron"_                    |
| `third-party-account` | your read of **someone else's** hard moment  | Max quoted on Addison's commit — _"confirm that attribution with Max before publish"_            |
| `role-attribution`    | identified by professional role or employer  | the ex-wife row — _"fine as an ex-wife, not as a tech mentor"_                                   |

The last one is worth keeping even though it looks like a special case: it is the only scope in
the ledger where a **denial** is on file with a stated reason (employer confidentiality), and the
open question flagged on that row — that the text still carries the _role_ even though it carries
no name — is precisely a `role-attribution` question that had no name until now.

## 7. Revocation — grant(+1) / revoke(−1), folded

Manifesto §6 says _ongoing, granular, **revocable**_. Revocable is a word with no mechanism unless
something refuses to publish.

- The ledger is an **event log**, not a status column: `grant` and `revoke` events, folded to a
  current state per `(person, scope, spanId)`.
- **Both events are kept.** A retraction preserves the record of having consented and then
  withdrawn; it does not delete it. Raw vault — _a single version of the facts, never a single
  version of the truth_ ([`dv2-data-split-discipline-activated`](../../../.claude/rules/dv2-data-split-discipline-activated.md)).
  This is also the cheapest possible form of the _"record that it was refuted"_ discipline the
  ledger already asks for.
- The **build refuses to publish** a passage whose net state is revoked (`REVOKED_PASSAGE_PRESENT`).
- Ordering is by `phase` — **the timestamp carried by the artifact** (a review's `submitted_at`),
  never a local clock, so every verifier folds the same evidence set
  ([`local-time-never-enters-the-shared-fold`](../../../.claude/rules/local-time-never-enters-the-shared-fold.md)).
  On an exact tie, **revoke wins**: under ambiguity the safe direction is less exposure.

### The asymmetry, and why it is not sloppiness

> **A grant must cite an artifact the person authored. A revoke may arrive on any channel —
> including Aaron relaying a phone call.**

This is enforced at parse time: a `grant` with `artifact.kind: "relayed"` is refused outright.

It looks inconsistent and is not. Privacy is hard money: _"one-way to MORE privacy is free, less
privacy needs the owner"_
([`privacy-budget-is-hard-money-earned-by-others`](../../../.claude/rules/privacy-budget-is-hard-money-earned-by-others.md)).
Requiring ceremony to **withdraw** would be a friction tax pointed at the person the mechanism
exists to protect — and the failure mode of a hard-to-use revocation is somebody staying in a book
they wanted out of.

**What revocation cannot do**, stated because the ledger already flags it and a mechanism must not
imply more than it delivers: git history is permanent. A revoke removes a passage from what
publishes and from the working tree. It does not remove it from the history, absent a force-push,
which is a gated class. Anyone consenting to a public draft is consenting to that too, and should
be told once rather than assumed to have inferred it.

## 8. The ledger schema

`consent-events.json`, beside `CONSENT-LEDGER.md`. The prose ledger keeps everything a machine
cannot check; this file holds only what one can.

```json
{
  "schemaVersion": 1,
  "people": [
    {
      "person": "Chris King",
      "githubLogin": "chrisking",
      "githubUserId": 4242,
      "aliases": ["Chris King", "Chris"]
    }
  ],
  "events": [
    {
      "eventId": "grant-chris-attribution-1",
      "type": "grant",
      "person": "Chris King",
      "scope": "attribution",
      "spanId": "chris-readers-disease",
      "spanSha256": "c6fe...bea",
      "artifact": {
        "kind": "pull-request-review",
        "repo": "Lucent-Financial-Group/Zeta",
        "pullNumber": 15600,
        "reviewId": 900001
      },
      "phase": "2026-08-26T10:00:00Z",
      "note": "free text; the prose ledger carries the reasoning"
    }
  ]
}
```

Field notes, each one load-bearing:

- **`githubUserId`** — the numeric account id, not just the login. GitHub frees a **deleted login
  for re-registration**; the id is never reused. Without it, a row can pass a login check while
  pointing at a different human. When present, the id decides.
- **`eventId`** — the idempotency key. Replaying the ledger must not double-count; duplicates are
  refused at parse time.
- **`phase`** — RFC3339 **UTC**, and a non-`Z` offset is refused. See §7.
- **`aliases`** — the strings a `mode=deidentified` passage about this person may not contain.
  `[]` is allowed and means "never de-identified"; it is a declaration, not a default.
- **`spanId: "*"`** — a footprint grant (§4).

## 9. The flow, end to end

1. **Mark the passage.** Wrap it in `consent:begin` / `consent:end` with `person=` and an `id`.
   Add the person to the `people` roster (name, GitHub login, account id, aliases).
2. **Open one PR per (person × scope).** The diff is the passage. Title it in plain language —
   _"Consent: naming Chris King in ch-4"_ — and put the one-sentence ask in the body: what is
   being asked, what it covers, and that Request-changes is a real answer.
3. **Add them as a reviewer**, or `@mention` them and send the link. GitHub emails them.
4. **They click Approve** (or Request changes, or Comment).
5. **Record the event.** Get the review id from
   `gh api repos/OWNER/REPO/pulls/N/reviews`, the hash from `--spans`, and add one `grant` object.
6. **CI checks it** on every PR (repo tier) and again before the distributable book is built
   (`--publish`).

Revocation is step 5 with `type: "revoke"` and nothing else required.

## 10. Coordination with the derived named index

Another agent is designing a **person → appearances** index generated from in-text markers, with
an audit for unmarked appearances and a delta view on revision. **These must be one mechanism, not
two, and the proposal is that this design supplies the substrate:**

- **One marker vocabulary.** `consent:begin … person="…"` already carries subject, file and line
  for every marked appearance. `person → [spans]` is a `groupBy` over `collectSpans()`, exported
  and already used by `footprintOf`. A second marker syntax would mean two vocabularies drifting
  against each other — the Babel failure, in miniature.
- **One roster.** `people[]` in `consent-events.json` (name, login, account id, aliases) is the
  natural home for the index's person records too.
- **The complementary audits.** `SPAN_UNCLAIMED` here answers _"a marked passage with no consent"_;
  the index's unmarked-appearance audit answers _"a person's name in prose with no marker"_. Both
  are needed and neither subsumes the other — mine cannot see an unmarked mention, theirs cannot
  see a stale approval.
- **The delta view is the footprint hash** (§4): one value per person, staleness detected once,
  with the changed member named. That is exactly the "consent binds to the combined footprint,
  re-consent on the delta" property, and it is implemented and tested.

**Where we might disagree, said out loud rather than diverged quietly:** if that design needs
per-appearance markers finer than a paragraph span (a single inline name), `spanId` granularity
will have to shrink, and the footprint hash absorbs that without change — but `SPAN_UNCLAIMED`
would then fire on inline mentions that no one intends to gate. If it does, the fix is a span
attribute, not a second syntax.

## 11. What this does **not** give you

Stated plainly so nobody mistakes a green verifier for a signed release.

**This is not a legal instrument.** What a passing check proves is narrow and worth naming
exactly:

> An account bearing that login and that numeric id submitted an `APPROVED` review on that pull
> request at that timestamp, and the text now published hashes to what was in front of it.

What it does **not** prove:

- **Who holds the account.** GitHub identity is not identity. A shared, delegated, or compromised
  account produces a review indistinguishable from a genuine one.
- **That they read it.** Approve is a click. The mechanism records a decision; it cannot record
  comprehension.
- **That the consent was informed, uncoerced, or competent** — the questions a release actually
  turns on. `CONSENT-LEDGER.md` §"Two bright lines" already holds the hard cases (minors,
  inducement, DNA) and none of them become checkable here.
- **Anything about the account's future.** A deleted account takes its review record with it. The
  `githubUserId` guards against a _re-registered_ login, not against disappearance.

**For legal defensibility, Aaron uses an e-signature service** (DocuSign / Dropbox Sign class),
and a **DKIM-signed email reply is the vendor-independent archival channel** — it survives the
vendor, carries a cryptographic signature over the message, and is readable in fifty years without
anyone's platform. Those are the instruments. **This is the machine-checkable layer, and a
substitute for neither.**

The honest framing of what it adds: an e-signature proves consent _was given_. This proves the
**text still is what they consented to** — which is the thing a signed PDF cannot tell you, and
the thing that quietly goes wrong during revision.

## 12. Placement, and the registers on the claims

**Why this doc lives in `docs/books/you-born-at-the-hinge/` and not `docs/protocols/`:** it extends
one specific ledger, its scopes are derived row-by-row from that ledger's own precedents, and its
verifier defaults to that corpus. Separating the mechanism from the only ledger it governs would
create exactly the drift the content hash exists to prevent. Change-rate says the same thing —
this is a satellite of `CONSENT-LEDGER.md`, not a stable cross-cutting hub
([`dv2-data-split-discipline-activated`](../../../.claude/rules/dv2-data-split-discipline-activated.md)).
**Promote it to `docs/protocols/` the day a second book adopts it**, which is when it earns
hub status.

Claim registers, per
[`toy-is-free-metered-must-be-earned`](../../../.claude/rules/toy-is-free-metered-must-be-earned.md):

| claim                                                           | register                                                                                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Zeta is public                                                  | **metered** — `gh repo view`, quoted verbatim in §3                                                           |
| the verifier detects a one-character passage edit               | **metered** — live run against a real GitHub review, plus 42 tests, each failure mode shown failing           |
| a non-collaborator can review a PR on a public repo             | **consistent with** — GitHub's documented read-access rule; unverified against a live non-collaborator review |
| approvals without write access do not satisfy branch protection | **metered** — quoted from GitHub's protected-branches doc; the design does not rely on it either way          |
| sixty-second signer effort                                      | **speculative** — a target, falsified or confirmed by the first real signature                                |
| the mechanism reduces legal risk                                | **not claimed.** See §11.                                                                                     |

## 13. Pointers

- [`CONSENT-LEDGER.md`](CONSENT-LEDGER.md) — the prose ledger this extends; source of truth for scope and reasoning
- `consent-events.json` — the event log (empty; nothing collected yet)
- `src/Core.TypeScript/hygiene/audit-consent-signoff.ts` — the verifier
- `src/Core.TypeScript/hygiene/audit-consent-signoff.test.ts` — the falsifiers, one per failure mode
- [`privacy-budget-is-hard-money-earned-by-others`](../../../.claude/rules/privacy-budget-is-hard-money-earned-by-others.md) — why grant and revoke are asymmetric
- [`local-time-never-enters-the-shared-fold`](../../../.claude/rules/local-time-never-enters-the-shared-fold.md) — why `phase` is the artifact's timestamp
- [`engagement-profiles-public-work-only-not-surveillance-dossiers`](../../../.claude/rules/engagement-profiles-public-work-only-not-surveillance-dossiers.md) — ask, believe the account, never infer the inner life
- [`docs/governance/MANIFESTO.md`](../../governance/MANIFESTO.md) §6 consent-first, §5 memory preservation
