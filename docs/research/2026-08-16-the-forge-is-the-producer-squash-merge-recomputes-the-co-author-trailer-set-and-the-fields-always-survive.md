# The forge IS the producer — squash-merge recomputes the co-author trailer set, and the fields always survive

Date: 2026-08-16 · Agent: shadow · Status: **mechanism ESTABLISHED** (116/116 held-out
predictions, zero mispredictions) · Routed by Otto, authorized by Aaron ("lets route it")

## The question

PR #10922 shipped `agencysignature-block.ts` as the single canonical AgencySignature
validator. After merging, it found its **own squash commit** classified
`RECOVERED-MALFORMED`:

- its branch commit `482424bd81ff` parsed cleanly — `%(trailers:key=Agency-Signature-Version)`
  returned `1`;
- the squash commit `56f73d4146ac` of **identical content** did not;
- a blank line had appeared between `Task:` and `Co-authored-by:`.

It refused to round that up, because ~100 other recent commits of apparently the same
shape parse fine — so squash-merge did not look like a deterministic producer. That
restraint was correct, and the missing variable is identified below.

**Aaron's ruling reframes the deliverable** (2026-08-16): *"any layout is fine with me, as
long as we have the needed fields is what matters most."* So the questions answered here
are (1) do the required FIELDS survive the forge, (2) is our canonical parser tolerant
enough, (3) what is actually lost — not "how do we preserve layout."

## Mechanism: ESTABLISHED

GitHub's squash-merge **does not pass the commit message through verbatim.** It
recomputes the co-author trailer set:

1. The body is composed per `squash_merge_commit_message`. Measured on this repo via
   `gh api repos/Lucent-Financial-Group/Zeta`: the value is **`COMMIT_MESSAGES`**, not
   `PR_BODY`. (`squash_merge_commit_title` is `COMMIT_OR_PR_TITLE`; squash is the only
   merge method enabled.)
2. Every existing `Co-authored-by:` line is **removed** from that body.
3. The set of contributing identities — branch commit authors *plus* their
   `Co-authored-by:` trailers — **minus the squash commit's own author** is re-emitted,
   resolved to canonical GitHub account emails.
4. That re-emitted paragraph is appended **after a blank line**.
5. **If the surviving set is empty, nothing is appended** — the message ends wherever the
   body ended, i.e. at `Task:`, and git parses the block normally.

Step 5 is the variable that was missing. The commits that parse are not the same shape as
the ones that fail: they are commits where the forge had **no co-author left to
attribute**, so it never wrote a trailer paragraph at all.

### Four independent confirmations that the forge is rewriting, not passing through

| observation | n | what it proves |
|---|---|---|
| Branch commit had `Task:` → `Co-authored-by:` **contiguous**; squash commit of identical content has a **blank line inserted** | **26** | the forge inserts the separator; not an authoring defect |
| Branch commit carried a `Co-authored-by:` naming an identity that resolves to the **squash author's own account**; squash commit has **no** `Co-authored-by:` at all | **44** | the forge *deletes* trailers |
| Branch commit carried **no** `Co-authored-by:` at all; squash commit has one, **synthesized** (`github-actions[bot]` branch author ≠ squash author) | verified, PRs #10857 #10865 #10867 | the forge *synthesizes* trailers |
| `Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>` on the branch became `<41898282+github-actions[bot]@users.noreply.github.com>` on the squash | verified, PR #10872 | the forge *regenerates* the line from resolved account data — it is not copying text |

### The held-out prediction test

Correlation over a handful of commits would not be a mechanism, so the rule was stated
first and then tested on a held-out sample.

> **Prediction (single-commit PRs).** If every branch `Co-authored-by:` identity resolves
> to the squash commit author's own GitHub account, the forge strips it, the block ends
> the message, and `%(trailers)` parses. Otherwise the forge appends a blank-line-separated
> trailer paragraph and `%(trailers)` returns nothing.

| outcome | count |
|---|---|
| predicted PARSES, and did | 44 |
| predicted FAILS, and did | 72 |
| **mispredictions** | **0** |
| multi-commit PRs (rule not stated for them; skipped) | 34 |

150 merged PRs sampled, pre-merge branch commits fetched from the API and compared against
the landed squash commit. **116/116 single-commit PRs predicted correctly.**

### Confounds tested and excluded

Each was proposed as a candidate and each appears on **both** sides of the parse outcome,
so none discriminates:

| candidate variable | result |
|---|---|
| `merged_by` (AceHack vs github-actions[bot]) | AceHack merges appear as 66 fail / 13 parse — **not causal** |
| auto-merge vs manual merge | `auto=true` → 62 fail / 5 parse; `auto=false` → 15 fail / 8 parse — **not causal** |
| PR body already carried a `Co-authored-by:` | `body=true` → 38 fail / 5 parse; `body=false` → 39 fail / 8 parse — **not causal** |
| composed from PR body vs commit messages | setting is `COMMIT_MESSAGES`; the multi-commit `* <title>` join format is visible in the landed messages — **refutes** the "composed from the PR body" reading |
| single- vs multi-commit PR | affects *how many* blocks land, **not** whether fields survive (see below) |

**Established as causal:** whether the forge has a co-author identity to attribute that is
distinct from the squash commit's author. Everything else co-varies or is inert.

**Not the first sighting.** `memory/amara/conversations/2026-04-26-squash-merge-blank-line-trailer-stripping-discovery-and-amara-ferry-10-11-vocabulary-tiering.md`
recorded this shape on PR #20 on 2026-04-26. It was rediscovered on #10922 on 2026-08-16.
This document exists so there is not a third rediscovery; what is new here is the
*discriminator* (step 5), which is why the earlier record read the behaviour as universal
and the later one read it as nondeterministic. Neither was — both saw one half.

## What this means: no authoring discipline can fix it

The forge is a producer, and it produces the separator from account topology, not from
message text. So:

- No commit-message layout avoids it while a foreign co-author exists. Ending the body at
  `Task:` does not help — step 3 appends anyway (proven by the synthesized case).
- The one authoring lever that *would* suppress it is to stop naming a distinct co-author,
  which trades away agent attribution — the exact thing AgencySignature exists to record.
  **Not recommended**, recorded only so the option is on the table rather than latent.
- Therefore every author-side rule and dispatch-brief clause about "keep the block
  contiguous with `Co-authored-by:`" is **beside the point** for merged commits. It remains
  correct for the *branch* commit, and the branch commit is not what lands.

## Aaron's three questions, answered

### 1. Do the required FIELDS survive the forge? — **Yes. 150/150.**

All ten v1 field *values* were compared pre-merge to post-merge across the sampled PRs:

| check | result |
|---|---|
| all 10 field values survived intact | **150 / 150** |
| any field value altered by the forge | **0** |
| block not recoverable by `findSignatureBlock` | **0** |

The forge has never been observed to drop, reorder, rename, or alter an AgencySignature
key. It touches exactly one thing: the `Co-authored-by:` trailer set and the blank line
before it.

### 2. Is our canonical parser tolerant enough? — **Yes. No widening required.**

`findSignatureBlock` in `src/Core.TypeScript/hygiene/agencysignature-block.ts` is already
field-oriented and layout-tolerant in exactly the way Aaron's ruling asks: it scans for the
first contiguous paragraph carrying all ten keys, so a blank line *before* the block or a
trailer paragraph *after* it are both irrelevant to extraction. Both forge-produced shapes
are already pinned by falsifiers in `agencysignature-block.test.ts` ("recovers a block
orphaned by a blank line before Co-authored-by", "recovers a block a squash-merge buried
mid-message").

**The honest conclusion is that no fix is required — only a documented expectation.** The
module was already built correctly for a defect whose mechanism was not yet known.

Note the tolerance is bounded in the right place and must stay there: contiguity is still
required *inside* the run, so a scan cannot assemble ten keys from ten paragraphs and
"recover" a signature nobody wrote. Aaron's ruling permits **layout** tolerance, not
**field** tolerance; the required fields remain required.

### 3. What is actually lost? — git-native `%(trailers)` interop, and nothing in this repo consumes it.

Every reference to git's trailer machinery in the codebase was enumerated
(`rg '%\(trailers|interpret-trailers'` over `src/ tests/ .github/`):

| site | role |
|---|---|
| `hygiene/audit-agencysignature-main-tip.ts` | **the only reader.** Reads `%(trailers)` STRICT, then falls back to the lenient scan. This is the instrument that *reports* the defect, not an independent consumer of it |
| `hygiene/validate-agencysignature-pr-body.ts` | reader, but of the **PR body pre-merge** — upstream of the forge, unaffected |
| `forge-host/github/flush-via-staging.ts` · `agent-heartbeats/merge-heartbeats-to-main.ts` | **writers** of the block, not readers |
| `pr-archive-on-merge.yml`, the `*.test.ts` files | comments and tests |

No metrics, DORA fold, attribution report, or governance check reads git-native trailers.
**So the practical cost of the layout drift is near zero**, and stating that plainly is the
finding. What is lost is the ability to run `git log --format='%(trailers:key=Agent)'` as an
ad-hoc query and trust it — a real but currently-unexercised capability.

## Footprint on `main` (11,973 commits)

| class | count |
|---|---|
| `%(trailers)` yields the version key (strict-parseable) | 300 |
| complete 10-key block present, git parses none of it | **733** |
|  ↳ cause: blank line then **only** `Co-authored-by:` (the forge shape) | 558 (76.1%) |
|  ↳ cause: multi-commit squash concatenation (more sections after the block) | 175 |
| no complete 10-key block anywhere (mostly pre-v1 history) | 10,940 |

## One genuine gap found, and deliberately NOT fixed here

Multi-commit PRs concatenate each commit's message, so the squash commit can carry
**several** complete blocks. `findSignatureBlock` returns the **first**.

| measurement over all of `main` | count |
|---|---|
| commits whose message contains **>1** complete AgencySignature block | **159** |
| of those, first and last block **disagree on a governance field** | **38** |

Observed disagreements include `Human-Review: pending` vs `explicit`,
`Human-Review-Evidence: chat` vs `none`, and `Action-Mode: supervised` vs
`autonomous-fail-open`. For those 38 commits the auditor reports the *first* commit's
governance claim, silently.

This is not a forge defect — it is an unanswered semantic question: **which of N signatures
is the signature of a squashed commit?** Changing which block wins would change the
recorded governance verdict on 38 landed commits, so it is not a change to make
unilaterally. It is named here and left open. (`Human-Review: pending` is also not in the
v1 enum, which is a separate pre-existing finding.)

## Recommendations

1. **No code change.** `agencysignature-block.ts` already satisfies Aaron's ruling. Record
   the expectation instead: *the forge will orphan the block from git's trailer parser
   whenever a distinct co-author exists, the fields always survive, and the lenient scan is
   the supported reader.*
2. **Do not chase layout in dispatch briefs.** Author-side contiguity rules cannot bind the
   landed commit. Keep writing the canonical shape (it is correct on the branch, and it is
   what the pre-merge gate checks); stop treating post-merge layout as an authoring failure.
3. **`RECOVERED-MALFORMED` is the wrong severity name for the forge shape.** It reads as an
   authoring defect that someone should fix, and nobody can. A distinct outcome —
   "forge-normalized: fields intact, git-unparseable" — would stop the auditor from
   reporting a defect against an author for something the forge did. Not changed here;
   it alters audit output and belongs to whoever owns that instrument's contract.
4. **No repository setting fixes this, and none should be changed.** The plausible lever is
   `squash_merge_commit_message`, but the mechanism is independent of message source: the
   co-author paragraph is recomputed and appended regardless of whether the body came from
   `COMMIT_MESSAGES`, `PR_BODY`, or `BLANK`, and the synthesized case proves it happens even
   with no co-author text in the source at all. Changing the setting would alter what lands
   on `main` for every PR while not addressing the trailer paragraph. **Repository settings
   are outward-facing configuration and are Aaron's** — nothing was changed.
5. **Open for Aaron:** the multi-block first-wins choice above (38 commits with conflicting
   governance fields).

## Anchors

- `git-interpret-trailers(1)` — trailers are "a group of lines at the end of the message";
  the contiguity requirement is documented behaviour, not a bug. Git is behaving correctly
  throughout; the AgencySignature block simply stops being at the end.
- Goguen & Meseguer 1982, noninterference — the shape of the defect is an undeclared
  channel: the merge forge influences a governance record through a path nobody metered.
  The `.claude/rules/dv2-data-split-discipline-activated.md` §7 ask ("does influence enter
  only through declared channels?") answers *no* here, and the honest response is to declare
  the channel and measure it, which is what this document does.
- `.claude/rules/numerology-vs-number-theory.md` — a count is not an identification. "108
  parse fine" was a count; the invariant that separates the classes is the co-author
  identity resolution, and only that is the result.

## Reproduction

Everything above is re-derivable from the repo plus `gh api`:

```
gh api repos/Lucent-Financial-Group/Zeta --jq '.squash_merge_commit_message'
gh api repos/Lucent-Financial-Group/Zeta/pulls/<N>/commits --jq '.[].commit.message'
git log -1 --format='%(trailers:key=Agency-Signature-Version,valueonly)' <squash-sha>
```

Compare the branch commit's tail to the squash commit's tail; the inserted blank line, the
deleted trailer, and the synthesized trailer are all visible in `git log --format=%B`.
