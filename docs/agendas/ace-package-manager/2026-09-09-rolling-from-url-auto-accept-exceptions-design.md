# Rolling `from-url` auto-accept — the exception is DATA, recorded and expiring (design)

**Work item:** 081M24396B2087G0R000MDMDEA
**Date:** 2026-09-09
**Status:** implemented
**Subject:** `src/Core.TLA/tla2tools.jar` (the only declared row)

---

## 1. The ruling

The maintainer, 2026-09-09, verbatim:

> *"okay i think we can just allow for the roll and update for now, i know that is
> not great from a security point of view but this is not a permanent fix, it just
> until we don't need the new features anymore, we are going to need this exception
> path we can just save the exceptions somewhere and let it not break install.sh."*

Three phrases in that sentence are load-bearing and each one became a mechanism:

| the phrase | the mechanism |
|---|---|
| *"save the exceptions **somewhere**"* | `tools/setup/manifests/from-url-rolling-exceptions` — committed, reviewable, **per-ref** data. Not a flag, not an env var, not a `--force` |
| *"**not a permanent** fix"* | `expires=` on every row, ≤ 90 days after `declared=`, **enforced** by a lint that turns the gate red on the day it passes |
| *"let it not break **install.sh**"* | the scope. Provisioning is unblocked; **no verifier claim is** |

**The security tradeoff is the maintainer's and it was made knowingly. It is not
re-litigated here — it is written down (§6) so the next reader can weigh it.**

## 2. What breaks today, measured

`tlaplus` republishes the v1.8.0 prerelease asset from its own CI, which runs on
pushes to master. **MEASURED 2026-09-09 — four distinct builds in one day:**

| time (UTC) | rev | note |
|---|---|---|
| 12:48:04 | `65fbace` | |
| 15:25:40 | `4ad12e8` | sha256 `82cc5759…` |
| 16:25:36 | `4ad12e8` | sha256 `bb82311b…` — **same rev, different bytes** |
| 21:30:36 | `ede5b88` | sha256 `8836549e…` |

Two of them share a git rev, so **a rebuild is often not a new checker at all,
and the digest cannot tell the difference.** Each rebuild aborts the whole
`from-url` realizer — it is not best-effort, so `install.sh` stops — on every
machine whose cached jar is not the pinned one.

Note *which* machines: the CI cache key hashes `tools/setup/**`, so **every PR
that touches setup at all** takes a cache miss, refetches, and hits the wall.
This PR is one of them.

### 2a. The incident this shipped under

**MEASURED across every open PR while this was being written** — nine PRs from
three authors, 5 to 22 failing checks each, `gate=failure` on several:

```
#17180 failing=5   #17179 failing=9   #17178 failing=8   #17177 failing=20
#17176 failing=22  #17175 failing=19  #17174 failing=22  #17173 failing=21
#17145 failing=15
```

One failing step explains all of them: **`Install toolchain via three-way-parity
script (Unix; GOVERNANCE §24)`** — `install.sh` failing closed on this digest,
which fails *every job that installs the toolchain*. **None of the nine diffs is
the cause.**

**And a re-pin is not a reliable remedy for an outage.** What is MEASURED: three
distinct digests for that one URL in roughly three hours — `bb82311b…` pinned at
18:42, re-pinned to `f629a67c…` at 21:29, and **that re-pin's own CI fetched
`8836549e…` at 21:40**, i.e. the remedy was stale before the run carrying it
finished. A fourth, `ede5b88`, was measured at 21:30 while timing the sweep
for §5.

**WHAT IS NOT ESTABLISHED, and a first draft of this section asserted it:** that
the remedy's half-life is shorter than the merge latency. That was a *rate*
inferred from two intervals, and a peer who produced the figure withdrew it in the
committed record after re-measuring at 22:11 and 22:21 and finding upstream
holding one digest for ~40 minutes. **A re-pin may well hold.** The observations
above stand; the projected cadence does not, and it is retracted here rather than
left as the load-bearing argument. What actually argues for a standing exception
is §2b — the digest cannot tell a meaningful change from a rebuild — plus the
plain fact that the failure mode is fleet-wide and the remedy is manual.

### 2b. A rebuild is often not a new checker — and that is the mirror argument

Two of the day's rebuilds shared a git rev (`4ad12e8`): **same source, different
bytes, no upstream commit between them** — consistent with several matrix legs of
one CI run each uploading the artefact. So the digest, which is the only thing
that says which bytes arrived, **cannot distinguish a meaningful upstream change
from a rebuild of identical source.** Every fleet-wide breakage above may have
been paid for nothing.

That was the strongest available argument for mirroring the measured bytes to one
immutable asset under our own org. **The maintainer has now DECIDED AGAINST IT**
(2026-09-09):

> *"i'd rather just allow the roll instead of mirror and have an exception that
> allows for full rolling, we are going to run into this case again and again in
> the future, the exception is the important thing, then i don't think we [need]
> the mirror."*

**So the mirror is off the table and the exception mechanism is the answer.** The
reasoning is about generality rather than this one jar: rolling upstreams will
recur, and a mirror solves one instance while an exception register solves the
class. Recorded here because the paragraph above previously recommended the
mirror, and a doc that argues for a decided-against option is worse than one that
says nothing.

## 2b-bis. FULL ROLLING is the follow-up this design is shaped for

Today's exception unblocks `install.sh` and **stops there** — which is exactly why
the head that carried it went red: install succeeded, then 52 TLC models refused
the jar on the committed banner. Under the decision above **that residue is not an
acceptable steady state**, because it would require a human re-pin every time
upstream rebuilds, forever.

**A fully-rolling ref must therefore advance BOTH the digest AND the pinned
identity, with no human in the loop — and the sweep is what gates the advance.**

```
fetch → digest differs → run the ref's declared remeasure=
        ├─ PASSES → advance digest AND identity together, write a receipt
        └─ FAILS  → stop. Do not advance. Report.
```

**The gate is what keeps "full rolling" from being "trust whatever arrives."** It
is a genuine falsifier and not a formality: if a new verifier disagreed with the
old one about anything this repo asserts, 52 models would say so. A failing sweep
is a real finding about a new verifier and must **never** be absorbed by advancing
anyway.

Every advance records old digest, new digest, old identity, new identity and the
sweep result, so the claim traces to the measurement that earned it.

**The residual risk the maintainer is accepting, stated plainly:** a verifier can
change behaviour in a way the 52 models do not cover, and full rolling would adopt
it silently because the sweep passed. The sweep bounds the risk to *behaviour our
models do not exercise*; it does not eliminate it. That is a smaller and much
better-characterised exposure than the auto-accept in §6, which adopts new bytes
with **nothing** judging them — but it is not zero.

### The erosion finding is the safety property this rests on

§8a records that a re-pin can silently **narrow** a verifier pin: `TLC2 Version` (prefix, trailing space included)
was deleted from all three pin surfaces, `judgeToolchainBanner`'s
`stdout.includes(pinned)` stayed satisfied, the sweep passed 52/52, and the check
permanently stopped checking part of what it checked. It was found by reading the
diff, not by a test — because a truncated substring pin has no symptom.

**Under full rolling that identity-substitution becomes automatic and frequent.**
So a **round-trip guard** — refusing, before any surface is touched, when the
identity pattern does not match its derived value exactly-once-and-whole — stops
being a nicety and becomes **the safety property the whole mechanism rests on**.
It is not yet in `main` (see §8b) and is the named follow-up. An automatic
pin-rewriter without it would erode its own checks a little on every roll,
silently, forever.

## 2c. The governing idea: GRANTED versus ACCIDENTAL exceptions

The maintainer, later the same day, gave this mechanism the frame it should have
been designed under:

> *"yes we need to fully design that exception mechanism to allow certain
> dependencies to roll, whatever is needed here. we dont want security to block us
> on this, we should just keep track of the exceptions we've granted and don't have
> accidental ones like the docker and other ones you called out."*

**An unpinned dependency is not "unpinned" — it is an exception NOBODY GRANTED.**
That reframing is the useful part, because it makes one register out of two things
that looked unrelated: the tla2tools roll is a *deliberate* exception that happens
to be **loud**, and an unpinned base image is an *accidental* one that happens to be
**silent**. The silent ones are the larger number.

MEASURED today, 22 ungranted sites: **12 container base images on mutable tags**
(`node:24-slim`, `oven/bun:1.3.14-alpine` ×3, `mcr.microsoft.com/dotnet/sdk:10.0-noble`,
`runtime:10.0-noble`, `sdk:8.0`, `aspnet:8.0`, the Windows test image), **7
package-manager commands** (nuget/npm/pip), and **3 `curl | sh` sites**
(`tools/setup/install-rust-wasm32.sh:32`, ollama in `.github/workflows/mux-swarm-tick.yml:49`
and `arc-swarm-fanout.yml:78`).

**The target this row is the first instance of: one register of granted exceptions,
and everything outside it fails closed.** Three properties, in the order they
matter:

1. **Enumerable.** "What are we currently letting roll, and why?" has one complete
   answer. A granted exception carries a reason and an exit condition — which is
   what `tradeoff=` and `exitcheck=` are for here.
2. **The accidental ones become VISIBLE, not fixed by fiat.** Nothing obliges us to
   pin all 22; what is needed is a check that can say *these 22 are exceptions
   nobody granted*, so the number is known and shrinking rather than ambient. **This
   composes with `tools/setup/manifests/pinned-refs` (#17166) — it must not become a
   third register.** `pinned-refs` already owns pins written at their point of use
   and already classifies rows fresh / moved / past-horizon / **unknown**; the
   ungranted set is the complement of its rows over the same surfaces.
3. **Security not blocking us is BOUGHT BY the ledger, not by weakening the check.**
   The trade is legitimate precisely because the exceptions are recorded and
   countable. §6 states what an attacker who controls a granted-exception URL can do
   while it is live.

**A fully-rolling ref is a granted exception**, and this register is its natural
home: it carries a stated reason and an exit condition, and everything outside the
register still fails closed. That is what keeps "allow the roll" from becoming
"nothing is pinned".

**Not built in this diff, deliberately** — the repository is red at
`Install toolchain…` for three authors, and the unblock ships first. What is built
here is the *shape* the register needs: per-ref rows, a reason, an exit condition, a
recorded acceptance, and a lint that refuses anything malformed.

## 3. Shape

Four surfaces, and the first is the whole design:

1. **`tools/setup/manifests/from-url-rolling-exceptions`** — the declaration.
   One row per ref. Fields: `accept` (a closed set of one: `auto`), `verify`,
   `declared`, `expires`, `exitcheck`, `tradeoff`.
2. **`src/Core.TypeScript/ace/setup-realizers/rolling-exception.ts`** — parse +
   policy + the acceptance record. `activeExceptionFor` is the only function
   that can widen the hole, and it is written to be joyless about it.
3. **`.zeta/from-url-rolling-accepts`** — the record. Untracked, per machine,
   append-only, idempotent.
4. **`src/Core.TypeScript/hygiene/lint-rolling-exceptions.ts`** — the falsifier,
   plus each row's own `exitcheck` run as its own gate step.

### There is no global switch, by construction

`activeExceptionFor` compares dests with `===`. A row reading `*  accept=auto`
matches the literal dest `*` and nothing else. There is no prefix match, no
glob, no wildcard, and no env var — so there is nothing for a future agent to
find and flip. Everything without a row keeps failing closed:

| situation | disposition |
|---|---|
| rolling row, **no** exception | **fails closed** (unchanged) |
| rolling row, **expired** exception | **fails closed**, and the gate is red |
| rolling row, exception, `verify` **fails** | **fails closed**, and the failure is recorded |
| **non-rolling** row, bytes changed | **fails closed** — a supply-chain event, never a rebuild |
| fetch/transport failure | **fails closed** (retried, then thrown) |
| malformed or missing `sha256=` | **fails closed** (unchanged) |
| rolling row, live exception, `verify` passes or is `deferred` | **accepted, loudly, and recorded** |

Two independent refusals guard the non-rolling case: the lint refuses such a row
in the gate, and the realizer refuses to even look one up unless the manifest row
carries `rolling=`.

## 4. The record is the price of the concession

**An auto-accept with no record converts a LOUD failure into a SILENT one, which
is strictly worse than the thing it replaces.** So every acceptance does two
things:

- **prints a banner** naming both digests, the exception's dates, the tradeoff
  doc, `verify=`/`verdict=`, and the fact that *the pin has not moved*;
- **appends a row** to `.zeta/from-url-rolling-accepts`:

```
<dest>  from=<64hex>  to=<64hex>  when=<ISO>  verify=<argv|deferred>  verdict=<not-run|pass|fail>  outcome=<accepted|refused>  expires=<date>
```

`verdict` is the field the requirement turns on. **`not-run` is a first-class
value and is never spelled `pass`** — a `verify=deferred` row records honestly
that nothing judged the bytes. And the record is written on the **refusal** path
too: a failed verification is the most informative event this mechanism can
produce, and it is also what keeps `verdict=fail` reachable rather than
decorative.

### 4a. Idempotent at the READ boundary — and why not a lock

The realizer re-fetches on every run while the pin and the accepted bytes
disagree, so a naive append writes one line per install and buries the event.
The obvious fix — dedup before appending — is a read followed by a write, i.e. a
window: two concurrent installs can both see "absent" and both append. The
reflex at that point is a lock file.

**That reflex is wrong here.** The maintainer, 2026-09-09:

> *"i really don't like locks if they can be avoided or swapped to a CAS, locks
> are a small but sometimes they can be the best option but others should be
> thought about first instead of just landing on locks."*

**So duplicates are made HARMLESS rather than prevented.** The ledger is an
append-only log; `foldAcceptanceRecords` collapses identical rows at **read**
time, keeping the earliest clock and counting the copies. N lines describing one
fact fold to one record, and the reader cannot tell how many writers raced.

That is discipline #6 in its proper form — **apply-N-times equals apply-once in
EFFECT, achieved by an idempotent fold rather than by serialising the writers** —
and it is the same G-Set / Z-set merge shape the substrate already leans on. The
claim it earns is therefore **idempotent at the read boundary**, which is both
stronger and true, where the earlier draft could only say *advisory*.

| piece | what it is for |
|---|---|
| `appendFileSync` (`O_APPEND`, one `write(2)`) | **atomic.** Two writers give two whole lines, never one torn line |
| the write-side scan | **a noise reducer, not a correctness mechanism.** If it loses a race, the fold absorbs it |
| `foldAcceptanceRecords` at read | **where idempotency lives.** `fold(fold(x)) == fold(x)`, pinned by a test |
| the `wx` header create | the one genuine race, closed by the **filesystem** rather than by a lock |

**The general rule this leaves behind, worth stating because this mechanism will
grow consumers: prefer an idempotent read-side fold; then a CAS; and where a
lock genuinely is the answer, say why the fold could not be, rather than
reaching for it first.**

`occurrences > 1` is **reported, not hidden** — it is the only evidence the
ledger keeps that two installs ran concurrently, and `lint-rolling-exceptions.ts`
prints it. That lint is the fold's consumer: a fold nothing reads would be a
golden vector nobody opens.

**It is emphatically NOT `from-url-rolling-receipts`.** That ledger means *this
digest was judged by a re-measure that passed* and is what buys a moved pin.
Writing an auto-accept into it would be the exact laundering the regime exists to
stop — **accepting is not measuring** — so they are separate files with separate
vocabularies.

## 5. Was auto-RE-MEASURE affordable? No, and here is the number

The requirement was to prefer *auto-update when the models still pass* over
*trust whatever arrives*. **It was tried and measured, and the answer is no,
twice over:**

**(a) Wall clock. MEASURED 2026-09-09**, Apple-Silicon host, OpenJDK 26.0.2.1,
the pinned `workers=1` invocation:

```
bun src/Core.TypeScript/formal-verification/run-tlc.ts --all
  → summary: 52 agree with their pin, 0 do not (out of 52)
  → 363.44s user  16.49s system  107% cpu   5:53.12 total
```

**5m53s**, and that is the cost of a *passing* sweep on the newest build
(`ede5b88`), not a pathological one. Adding six minutes to every `install.sh` on
every dev laptop, CI runner and devcontainer layer, for one dependency, is not
affordable — `install.sh` is already the long pole and already has an
exit-124 class of failures on file.

**(b) It could not run there anyway, and this is the harder blocker.** The
declared `remeasure=` judges the jar against `registry/tlc-models.json`'s
`versionBanner`, which is a **committed restatement of the pin** (a declared
`pinsurfaces=` entry). The accept path is not allowed to rewrite committed pin
surfaces — that would be exactly the hand-bump the whole regime forbids — so the
sweep would fail on a banner mismatch that says nothing about the models.

**(c) And firing the re-measure as the UNBLOCK was declined outright.** Moving
that row is a decision about a *verifier*, and on the cadence measured in §2a it
goes stale within hours. A re-pin was attempted here and correctly rolled itself
back (§8a); it is not the remedy for an outage.

**So `verify=deferred`, and the deferral is not a promise.** It is
`tools/setup/repin-rolling.ts`, which runs that same sweep, *is* allowed to move
the pin surfaces, and refuses to write a digest whose re-measure did not pass.
The mechanism for an inline `verify=` argv is built and tested regardless, so the
next row that has an affordable check can declare one.

## 6. THE SECURITY TRADEOFF

Stated plainly, because it is real.

**While this exception is live, whoever can choose the bytes behind that URL
chooses the model checker this repo runs.** For `src/Core.TLA/tla2tools.jar`
that is anyone who can publish to the `tlaplus` v1.8.0 release tag — a
compromised maintainer account, a compromised CI token, a malicious release-asset
overwrite — plus anyone who can forge the TLS-terminated response to it. **An
attacker with that position could ship a TLC that reports every model as valid**,
and the digest, which was the only thing that ever said which bytes arrived,
would no longer refuse it. Downstream, a green TLA+ lane would then be a
statement about a checker nobody chose. The window is bounded by the `expires=`
date and by the fact that exactly one row exists.

**What is NOT given up**, and what makes the trade takeable:

- **The pin does not move.** `from-url` still pins the old digest, and every
  declared pin surface — `registry/tlc-models.json`'s `versionBanner` and
  `jarSha256`, `docs/INSTALLED.md`, `docs/dependency-status.md` — still names it
  and still disagrees with the accepted bytes. **The TLA+ lane stays red until
  someone runs `repin-rolling.ts`, which re-measures.** So the attacker above
  gets a *provisioned machine*, not a *green verifier claim*: to launder a
  claim they would additionally need a 52-model sweep to pass and a receipt to
  be earned.
- **The record.** Both digests, the clock, and the verdict, on every machine that
  accepted.
- **`lint-verifier-jar-provenance.ts` is deliberately left unchanged.** It still
  reports `on disk hashes to X, the manifest pins Y — a different verifier is a
  different experiment`, which is a *true statement* and remains the loud
  residual signal. Relaxing it was considered and rejected: the exception's whole
  justification is that the divergence stays visible.
- **Fail-closed everywhere else** — §3's table.

**Residual risk this design does not remove:** a hostile build is installed and
*run* by anything that invokes the jar directly rather than through the pinned
registry path, and by anyone who ignores the banner. Auto-accept moves the
decision from "the machine refuses" to "the operator is told"; that is a real
weakening and it is the thing that was bought.

**The standing alternative, unchanged from the earlier design:** mirror the
measured bytes to one immutable asset under our own org. That removes the rolling
hazard entirely at the price of becoming a redistributor of an MIT-licensed
third-party binary. It is the maintainer's call and is recorded, not decided,
here.

## 7. Expiry, and what checks it

Two independent expiries, because a date and a reason can die separately:

| what expires | how it is checked | where |
|---|---|---|
| **the window** | `expires=` is a calendar date; past ⇒ the row is inert in `activeExceptionFor` **and** `lint-rolling-exceptions.ts` fails | gate + install |
| **the reason** | `exitcheck=` — `lint-tla2tools-rolling-premise.ts` fails when **no gate-tier model expects a NAMED temporal property** any more | gate |

The second is the interesting one, and it is in the spirit of
`lint-mathjs-dismissal-premise.ts`. The exception exists downstream of a *reason*:
we track the rolling v1.8.0 prerelease rather than the immutable v1.7.4 release
because v1.7.4 prints `Temporal properties were violated.` where v1.8.0 prints
`Temporal property Deterrence was violated.`, and `registry/tlc-models.json` pins
the named form as an `expectDetail`. **If that expectation ever leaves the
registry, the repo no longer needs what only the rolling build provides, and the
whole row should be retired in favour of an immutable pin** — regardless of what
its date says. That is now a red check rather than a thing someone might notice.

`expires=` is set to the 90-day ceiling deliberately: the real exit condition — a
**stable** tlaplus release carrying the named-property diagnostic — is not ours to
schedule, so a shorter window would buy a renewal ritual rather than new
information. That upstream half needs the network and is a **manual revisit**,
the same honest disposition `pinned-refs` records for its npm-advisory row
(`remeasure=manual:…`); it is stated rather than pretended at.

## 8. How it composes with what already exists

Not a third parallel mechanism — the fourth surface of one:

| surface | owns | this change |
|---|---|---|
| `from-url` + `rolling=` | which bytes, and the diagnosis on a rebuild | reads a new manifest; **default unchanged** |
| `repin-rolling.ts` + `from-url-rolling-receipts` | moving a pin, only after a re-measure passes | **untouched.** Still the only path to a moved pin |
| `pinned-refs` + `refresh-pins.ts` | pins written at their point of use | untouched — different subject (`downloadThenRun` has no kind there, on purpose) |
| **`from-url-rolling-exceptions`** (new) | **whether a rebuild may install without judging** | the gap none of the three covered |

Deliberate borrowings so the four read as one system: whitespace-token grammar;
colon-encoded argv for `verify=`/`exitcheck=`; the same **stated honest limit**
(a hand-written row passes — nothing can tell an earned record from a typed one;
what it buys is that the concession stops being invisible and becomes a
reviewable assertion).

### 8a. The same defect, found twice, independently — and whose fix survived

`repin-rolling.ts` could not re-pin from a tree that does not already hold the
previously-pinned artefact: every cold CI cache, every fresh clone, and every
machine whose jar an auto-accept has already replaced. The old identity was
derived from the old *bytes*; with no bytes it came back `null`, the `identity=`
restatement inside `pinsurfaces=` was silently never rewritten, and the
re-measure then failed on a banner mismatch that says nothing about any model.
**MEASURED 2026-09-09: 52 of 52 models "failed" that way, after six minutes.**

**Two agents hit this in the same hour and fixed it independently.** A sibling's
fix landed on `main` first (`recoverIdentityFromSurfaces` /
`identityPatternSource` / `identitySubstitutionPairs`), and **that is the version
kept.** Mine was discarded on merge rather than reconciled: shipping a second
implementation of one mechanism is the duplication this whole agenda exists to
avoid, and theirs is better factored — it builds a fresh regex per call (a shared
`/g` object advances `lastIndex` and would skip matches in later texts) and it
*throws* rather than silently substituting nothing when the identity cannot be
recovered.

**The convergence is the interesting part.** Both fixes recover the previous
identity from the pin surfaces, because that is where it is already written down,
and both refuse on ambiguity. Independent derivation reaching the same shape is
evidence the shape is right — and it is also the N-version reminder that
agreement between correlated implementations is weaker evidence than it feels.

### 8b. THE HAZARD THAT ALMOST SHIPPED, kept on the record because it has no symptom

Fixing the above opened a second, nastier failure that a green run cannot
distinguish from success. My first `identityPattern` matched
`TLC2 Version <ts> (rev: <rev>)` — the way the banner *reads* in the surface —
while `deriveIdentity` emits only `<ts> (rev: <rev>)`. Substituting the wider
match with the narrower value **deleted `TLC2 Version` (prefix, trailing space included) from all three pin
surfaces**.

**Nothing went red.** `judgeToolchainBanner` asks `stdout.includes(pinned)`, and
the truncated string is still a substring of TLC's real banner — so the sweep
passed **52/52** while the verifier pin permanently stopped checking part of what
it had checked. That is the vacuity class arriving by *erosion* rather than by
omission, and it is strictly worse than a check that never existed, because the
diff reads as a routine re-pin.

It was caught by **reading the diff of the pin surfaces**, not by a test. And
three of my own tests had *codified* the defect — they asserted the prefixed form
**was** the identity, written from the same misunderstanding as the code, so they
passed and proved nothing. **A falsifier authored alongside the thing it checks
inherits its blind spot.**

`main`'s surviving implementation does not have this bug: its pattern already
excludes the prefix. What it does **not** yet have is an *enforced* guard against
reintroducing it — an invariant that the pattern must match its derived identity
exactly-once-and-whole, refused **before** any surface is touched rather than six
minutes of TLC later. **That guard is the one piece of this worth carrying
forward, and it is routed as a follow-up rather than smuggled into this diff.**

It matters more under the full-rolling decision in §2b-bis than it does today:
once identity substitution runs automatically on every roll, an un-guarded
rewriter would erode its own checks a little each time, silently, forever.

**`clone-at-tag-stays-sufficient` is unaffected.** No resolver was added to any
bootstrap surface; `lint-clone-at-tag-is-sufficient.ts` must stay green and
unweakened. The exceptions manifest is read by the realizer that is already
there, and a clone with the file deleted simply fails closed on a rebuild — the
strict behaviour, not a broken one.

## 9. Honest limits

- **A hand-written acceptance record passes.** Same admission the two receipt
  ledgers make. The record is a convenience for the operator and an audit trail,
  never a proof.
- **The fold makes duplicates harmless, not impossible.** Two racing installs
  still write two lines; what is guaranteed is that every reader going through
  `readAcceptanceLedger` sees one fact. A consumer that reads the file directly
  re-exposes them, which is why the fold is the declared read boundary.
- **The `attacker`-word check in the lint is crude.** It cannot tell a good
  security paragraph from a bad one. What it buys is that the section cannot be
  quietly dropped, which is the failure that actually happens.
- **90 days is a POLICY number.** It is a judgement about how long a temporary
  concession may sit unrevisited, not a measurement of anything.
- **The clock is local.** Expiry is a *local action* steered by a local clock,
  which is exactly where `local-time-never-enters-the-shared-fold` puts it; the
  committed declaration, which is the shared artefact, carries no clock at all.
- **This does not make the TLA+ lane green after a roll, and must not.** It makes
  the machine finish installing. Those are different claims and conflating them
  would be the laundering.
- **SO THE UNBLOCK IS PARTIAL, and the residue is named rather than discovered.**
  Once `install.sh` completes, the TLC runs proceed and judge the loaded jar
  against `registry/tlc-models.json`'s `versionBanner` — a committed restatement
  of the pin — so on a rolled build **the TLA+ lane should report a banner
  mismatch**. That would be a *true* statement (a different verifier is running)
  and it is deliberately left standing.

  **THE BLAST-RADIUS HALF IS NOW MEASURED.** Without this change, sibling PRs in
  the same hour carried **15–24 failing checks each** (17176: 24, 17174: 22,
  17179: 22, 17177: 21, 17173: 21, 17175: 20, 17180: 18, 17178: 18, 17145: 15),
  and the failing step is literally `Install toolchain…` — confirmed on #17176
  inside `build-and-test` on all three platforms, inside `full-verify`, and
  inside `Analyze (csharp)`. With this change, head `b7b083dc`: 100 checks and
  **zero install-toolchain failures**.

  **THE TLA+ HALF IS UNTESTED — not refuted — and the distinction is the point.**
  On that head the TLA+ lane did *not* go red, and reading that as "the
  prediction was wrong, happily" would be a check that did not run looking like
  one that passed. What actually happened: `build-and-test (ubuntu-24.04-arm)`
  **did** auto-accept the rolled jar and **did** report 70 `TlcRunnerTests`
  passing — but `Tlc.Runner.Tests.fs` gates the model runs on `isLinux && isX64`
  by design ("TLC is pure-math computation, so running it on every leg of the
  matrix is duplicate work; CI filters to standard Linux x64"), and that leg is
  ARM64, so **no TLC model ran there**. The timing confirms it independently: the
  whole `Test` step took ~2.5 minutes and `BftConsensus` alone is 192s. The one
  leg that would have exercised it — `build-and-test (ubuntu-24.04)`, x64 — was
  **cancelled** on that head, and cancelled is not passed. The prediction stands
  open.

## 10. Falsifiers

**MEASURED 2026-09-09 — 25 mutants applied one at a time, 25 killed**, with
declared **controls that must SURVIVE** (a green happy-path test proves nothing on
its own). Mutation logs are in each test file's header.

| file | tests | mutants |
|---|---|---|
| `rolling-exception.test.ts` | 36 | 12 killed |
| `lint-rolling-exceptions.test.ts` | 28 | 8 lint + 2 premise, all killed |
| `repin-rolling.test.ts` | 27 | 3 killed |

**One control was WRONG and is corrected in place rather than quietly swapped.**
The re-pin file's first declared control exercised the very function one mutant
mutates, so it died with it — a control inside the mutated unit could never have
been evidence of anything. It was replaced by `substituteAll` and
`rewriteManifestRow`, which were then measured surviving all three. The note is
in that test file's header.

**And the mechanism was run end to end against the real manifest and the live
network**, both directions:

- with the exception row present: `↓ from-url: src/Core.TLA/tla2tools.jar` →
  the acceptance banner → `✓ from-url complete`, and a row appended to
  `.zeta/from-url-rolling-accepts` reading
  `from=bb82311b…  to=8836549e…  verify=deferred  verdict=not-run  outcome=accepted`.
- with the row removed (the control): the realizer **threw** the unchanged
  `rollingRemedy`, exactly as before this change existed.

Wired into `gate.yml` beside `refresh-pins.ts --verify` and
`lint-mathjs-dismissal-premise.ts`, which is where the sibling premise-and-pin
checks already live.
