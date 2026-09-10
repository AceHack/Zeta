# A failure taxonomy: the third axis is the oracle problem, the verdict is ternary, and five checks cover the space

**Date:** 2026-09-10 · **Register:** the taxonomy is argued; every worked instance in it is `metered` — each one happened today, in this repository, with a measurement attached. The five-check covering claim is `toy`.

---

## 0. The ask

> *"expected known positive vs expected known negative vs unexpected known positive vs unexpected known negative … unexpected/expected vs known/unknown vs positive/negative — what am I missing to categorize all our failures?"*
> *"where are other dimensions of our failures we are missing? i'm trying to come up with a minimal multi check over each change."*

Two questions: **what does the 2×2×2 miss**, and **what is the smallest set of checks that covers the space**. They have different answers and the second is the useful one.

---

## 1. What the three axes already are — named properly

**`expected × positive/negative` is the confusion matrix**: true positive, false positive, true negative, false negative. Standard, and correct as far as it goes.

**The third axis — `known/unknown` — is the oracle problem, and naming it is worth doing** because it has a literature and a hard result. You cannot place any verdict in the confusion matrix without ground truth, and for most checks the ground truth is exactly what is unavailable. Weyuker (1982), *On Testing Non-testable Programs*, is the founding statement; Barr, Harman, McMinn, Shahbaz & Yoo (2015), *The Oracle Problem in Software Testing: A Survey*, is the modern one.

So the instinct behind the third axis is right and it is the most important of the three: **most of our verdicts are not TP/FP/TN/FN at all — they are `unknown` wearing one of those four costumes.**

---

## 2. The structural correction: the verdict is TERNARY, not binary

`positive/negative` as a binary is where the repo's signature failure hides.

| outcome | meaning |
|---|---|
| **fired** | the check ran and found something |
| **did not fire** | the check ran and found nothing |
| **could not run** | the check did not execute |

Collapsing the third into the second **is** the vacuity class — *a check that did not run looking like one that passed*. Concretely, today: `exit 2` is not `exit 1`, an empty grep is `unknown` and never a negative result, and a required check that never ran contributes **zero** to a failure count while looking green.

A fourth value is needed too, and it is not the same as "could not run":

| **not applicable** | the check ran nothing **because the change could not affect it** |

That distinction is the whole of today's path-domain work: `lint (C#)` skipping on a PR with no `.cs` files is *correct*, and `lint (C#)` being killed at a timeout is *catastrophic* — and **GitHub renders both as "skipped."** A taxonomy that cannot separate them cannot tell a saving from an outage.

---

## 3. The dimensions the 2×2×2 is missing

Today produced a live instance of each, which is why they are worth adding rather than being a wish list.

### 3.1 LOCUS — where the defect is

The single most expensive omission, because it decides **who fixes what**, and one red X represents all three:

| locus | today's instance |
|---|---|
| **subject** | `release` was an empty function in `adapters.ts`, so a second merge could never borrow the base worktree. A real bug in the code. |
| **test** | `org-cli.test.ts` created its org at a literal `/store`, which a Linux runner creates and macOS refuses. A real bug in the test. |
| **environment** | `Cannot find module '@noble/hashes/blake3.js'` and `Cannot find module .../typescript/bin/tsc` — a worktree with no `bun install`. **No bug at all**, and `origin/main` reports the identical failures. |

Three failures, three owners, three correct responses — fix the code, fix the test, fix nothing.

### 3.2 DETERMINANCY — what is the verdict a FUNCTION of?

Not "flaky vs stable", which is too coarse. The sharp question is whether the verdict depends only on the change, or also on ambient state.

The `/store` failure is **100% deterministic given the operating system** and **perfectly inverted between two of them**. That is not flake; it is an **undeclared channel** — §13 noninterference, stated as a property of a test result. Values worth carrying: `change-only` · `environment` · `time` · `concurrency` · `ordering`.

A verdict that is a function of anything but the change is not reporting on the change.

### 3.3 FRESHNESS — as-of

A verdict is a measurement, and measurements age. A green on a tip that has moved is not a green. Today's own instance is subtler and better: the **24,954 GraphQL-forbidden invocations were a correct number whose interpretation was stale** — splitting by date against the 2026-08-26 carve reversed the conclusion (5.853% → 0.474%, then to 0.000%). The datum did not change; its as-of did.

### 3.4 INDEPENDENCE — how many witnesses, really?

N correlated checks are not N checks. Measured in this fleet: `rhoIcc` **0.549/0.628**, `effectiveCount` **1.43 from N = 3**. So three agreeing checks are worth about one and a half, and two reds from correlated checks are roughly one observation. (Knight–Leveson on correlated redundancy is the standing anchor.)

### 3.5 BLOCKING vs DRIFT

The one dimension already implemented here — `registry/uncompensatable-floor.yaml` separates the blocking floor from drift checks. Worth naming so the taxonomy does not reinvent it.

---

## 4. The minimal multi-check over each change

This is the actual ask, and the answer is **not one check per cell**. It is: *enough checks that every axis can be RESOLVED*. Five do it, and each kills a class the other four are blind to.

| # | check | the question it answers | the class it kills |
|---|---|---|---|
| **A** | **did it run?** | presence/liveness | could-not-run masquerading as passed — the vacuity class |
| **B** | **does it fail when it should?** | mutation | a check that cannot fail; resolves `unknown` → known |
| **C** | **does it depend only on the change?** | re-run under a perturbed environment / order | locus = environment, and undeclared channels |
| **D** | **is it fresh for THIS tip?** | as-of | a stale green |
| **E** | **is there a decorrelated second witness?** | independence | correlated agreement counted as corroboration |

**And the finding: this repository already has all five, and applies none of them as one per-change gate.** A → the gate-presence audits. B → `mutation-runner.ts`. C → the DST/hermetic tier. D → tip-freshness checks. E → the four-oracle byte-lock. They exist as separate lanes with separate cadences, so no single change is ever asked all five questions at once. That is the gap, and it is a wiring problem rather than a missing capability.

**The emission shape that makes it possible.** A check must return a typed value rather than a colour:

```
{ outcome: fired | not-fired | not-applicable | could-not-run,
  locus:   subject | test | environment | unknown,
  determinancy: change-only | environment | time | concurrency | ordering,
  asOf:    <tip sha, timestamp>,
  witnesses: <n independent>,
  blocking: floor | drift }
```

Red and green are one bit over a six-dimensional object. Every dimension above was lost at the moment a check chose to render itself as a colour — which is the same error as ranking commands by shape instead of by question, and the same error as judging two rovers by their mean.

---

## 5. What is still missing from THIS list

Stated so the taxonomy can fail rather than feel complete:

- **Cost and reversibility** are deliberately excluded: they are properties of the *response*, not of the verdict, and folding them in is how a severity field starts smuggling an oracle.
- **Multi-change interactions** are out of reach by construction. The repo already recorded this: two individually-green PRs produced a broken merged tree, and *"a pre-merge floor checks each branch against main-as-it-was, so a two-PR semantic collision is out of its reach."* No per-change taxonomy touches it.
- **The oracle problem does not go away.** Check B converts `unknown` to known *for the check itself*, never for the subject. A mutation-surviving test proves the test can fail; it does not prove the specification was right.

---

## Pointers

- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the vacuity class this taxonomy is built around
- `.claude/rules/dv2-data-split-discipline-activated.md` §7 — noninterference, which §3.2 restates as a property of verdicts
- `registry/uncompensatable-floor.yaml` — §3.5, the one dimension already implemented
- `src/Core.TypeScript/hygiene/mutation-runner.ts` — check **B**
- `src/Core.TypeScript/ci/path-domains.ts` — the `not-applicable` value of §2, made mechanical
- **Beacon:** Weyuker (1982) *On Testing Non-testable Programs* · Barr, Harman, McMinn, Shahbaz & Yoo (2015) *The Oracle Problem in Software Testing: A Survey* · Knight & Leveson (1986) on correlated redundancy
