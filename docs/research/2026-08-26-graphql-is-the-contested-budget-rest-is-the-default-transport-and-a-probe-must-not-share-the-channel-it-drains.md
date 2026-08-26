# GraphQL is the contested budget, REST is the default transport — and a probe must not share the channel it drains

2026-08-26. Satellite for [`.claude/rules/rest-is-the-default-transport-graphql-is-the-contested-budget.md`](../../.claude/rules/rest-is-the-default-transport-graphql-is-the-contested-budget.md).

Aaron, tonight: *"yes i thought we already had the rule somewhere it's very important."*

It did not exist. Measured at the time of writing: `grep -rl "GraphQL" .claude/rules/` returned **zero files**. The knowledge lived in exactly one place — a docstring in `src/Core.TypeScript/agent-heartbeats/merge-heartbeats-to-main.ts` justifying one local decision — and a docstring is read by whoever is editing that module. On the evening of 2026-08-25/26, **four agents independently walked into the same wall**.

That is the whole case for a rule rather than a comment: the knowledge was present, correct, dated, and located where nobody looking for it would be.

---

## 1. Two backends, two budgets, and `gh` does not say which one it used

`gh` reaches GitHub over two different APIs, and nothing in the command's shape tells you which:

| Command | Transport |
|---|---|
| `gh pr view` | **GraphQL** |
| `gh pr list` | **GraphQL** |
| `gh pr checks` | **GraphQL** |
| `gh run view` | **GraphQL** |
| `gh api repos/{owner}/{repo}/...` | **REST** |

GitHub meters these against **two separate 5000/hour budgets**. They do not share, and in this repo they are nowhere near equally loaded.

**The trap is that the GraphQL commands are the ergonomic ones.** `gh pr view 15673 --json state` is shorter than its REST spelling, reads better, and is what every example on the internet shows. The cheap transport is the one you have to already know about. That asymmetry — the default being the expensive path — is why this needed a carved rule and not a note.

### The REST substitution table

The whole point of the rule is that it must be actionable at the call site, so:

| Instead of | Use |
|---|---|
| `gh pr view N --json state,mergeable` | `gh api repos/{owner}/{repo}/pulls/{N}` — fields `state`, `mergeable`, `auto_merge`, `head.sha` |
| `gh pr list --state open` | `gh api "repos/{owner}/{repo}/pulls?state=open&per_page=100"` (add `--paginate`) |
| `gh pr checks N` | `gh api repos/{owner}/{repo}/commits/{SHA}/check-runs` |
| `gh run view ID` | `gh api repos/{owner}/{repo}/actions/runs/{ID}` |
| `gh run view ID --log` (per-step) | `gh api repos/{owner}/{repo}/actions/runs/{ID}/jobs` |

Two of these carry a correctness bonus beyond the budget, already recorded in this repo's memory and worth repeating because they are the reason to *want* the substitution rather than merely tolerate it:

- `gh pr checks` under-reports. `statusCheckRollup` returned **6 checks where the check-runs API returned 43** on the same SHA. A tick metric built on the former was measuring a reporting artifact.
- The check-run id **is** the job id, so `.../actions/runs/{id}/jobs` names the failing *step*. Three apparently separate flakes resolved to one toolchain-install stall via that one call.

The GraphQL route is not merely more expensive here. It is also less informative.

---

## 2. The measurements

### Two budgets, wildly unequal load

- **2026-08-14** (recorded only as a code comment): **GraphQL 1147/5000 points** against **REST 33/5000 requests**. The asymmetry was already a factor of ~35 and visible to anyone who ran `gh api rate_limit`. It was written down in a docstring.
- **2026-08-25/26**: agent polling drove GraphQL to **0/5000 within a minute of an hourly reset — twice**. REST was never contended in the same window.

### The drain is observation, not action

This is the counter-intuitive half and it is what stops the wrong fix. The instinct on hitting the wall is to stop *doing* things — stop arming auto-merge, stop opening PRs. Measured in one hour:

- **7 lane runs, 11 PRs created.**
- Auto-merge arming therefore cost **at most 11 GraphQL mutations against 5000 — about 0.2%.**

The budget was not spent doing things. **It was spent looking.** Any remedy aimed at the write path is aimed at 0.2% of the problem.

### `rate_limit` reporting 5000/5000 while calls are refused

Two agents and the author each misdiagnosed this on the same night, so it belongs here as a named trap:

> **`gh api rate_limit` showing a full primary budget while calls are being refused means a SECONDARY (burst) limit is active. The primary counters never reflect secondary limits.**

The counters are not lying; they are answering a different question. Reading a full primary budget as "not rate-limited" is a check that did not run looking exactly like one that passed. The correct read of a refusal with full counters is *back off*, not *retry harder*.

---

## 3. The one operation that must spend GraphQL

`enablePullRequestAutoMerge` is **GraphQL-only**. There is no REST equivalent. So `gh pr merge --auto` is the single operation whose GraphQL cost is unavoidable — and, per the measurement above, it is also rare and cheap.

This matters for the rule's shape. A rule that said "never GraphQL" would be false, would be discovered to be false the first time someone armed auto-merge, and would then be discarded wholesale. Naming the exception *in the rule* is what keeps the rule survivable.

The neighbouring detail, from the same module's docstring: the scoped flush PAT **cannot call that mutation at all** (`Resource not accessible by personal access token`), which is why arming is opt-in behind `ZETA_FLUSH_ARM_AUTOMERGE=1` in the heartbeat flush path. Granting the permission is a credential change and therefore a human call.

---

## 4. The sharper half — a probe must not share the channel it drains

A runaway retry loop drained the quota for roughly **40 minutes**. Its author's own post-mortem is the most valuable artifact of the night:

> *It **did** have a `state=MERGED` stop condition. But that condition was read via `gh pr view` — **the same GraphQL transport the loop was saturating** — and its failure branch was `api-unavailable) : ;`, a silent no-op. So under rate-limiting the loop could never observe the goal state, and a probe failure was indistinguishable from "goal not yet met."*

Three disciplines fall out. They are separable, and each one alone would have broken the loop.

### 4.1 Probe the goal over a DIFFERENT transport than the one you are consuming

A loop that saturates the channel it needs in order to see that it is finished **cannot terminate**. It is self-blinding by construction, and the blindness switches on at exactly the moment it matters — under load, which is when the loop is doing the most damage.

The structural form: if the termination condition and the work share a failure mode, the termination condition is not independent of the work, and a stop condition that is not independent is not a stop condition. Here the fix is nearly free — the loop's work was GraphQL and the goal state is available over REST.

This is the same shape as N-version programming's central caveat, which this repo already leans on: **agreement between correlated implementations is not evidence.** A probe correlated with the thing it probes is not a measurement.

### 4.2 A probe's failure must never look like a negative result

`catch → treat as not-done` turns an outage into an infinite loop. `catch → treat as done` turns an outage into a false success. **Neither is acceptable**, and the choice between them is a false one:

> **A failed probe is `unknown`, and unknown must be visible.**

`api-unavailable) : ;` is the vacuity class in its purest form — a handler that is syntactically present, semantically empty, and reads as care. It is the shell spelling of the empty method under a signature. Three registers, not two: `done`, `not-done`, `could-not-tell` — and the third one exits the loop and says so.

### 4.3 A retry loop stops when the GOAL is met, however it was met

Not when *its own attempt* succeeded. These differ exactly when **something else** completes the work — which in this fleet is not an edge case but the normal condition:

- armed auto-merge lands the PR
- another agent lands the same change
- repo automation (heartbeat flush, branch reaper, lockfile healer) acts on the same object

A loop keyed to its own success will keep trying to do a thing that is already done, and every one of those attempts is a call against the budget. The goal is a property of the world, not of your attempt on it.

The general form is worth stating because it outlives `gh`: **idempotency (§12) is about the effect of repeating an action; this is about the termination condition of the loop that repeats it.** A retry loop over an idempotent action is still a runaway if its stop condition reads its own attempt.

---

## 5. The falsifier

`src/Core.TypeScript/hygiene/lint-graphql-transport-in-scripts.ts`, with falsifiers in the sibling `.test.ts` (38 tests). Wired as `hygiene:no-graphql-transport-in-scripts` and run in the `lint (bash retirement inventory + hygiene unit tests)` job — **drift tier, not in `gate (required)`'s `needs`**. Promotion to the floor is Aaron's call, and the AUDIT-LIFECYCLE.md step-6 convention is that a new gate stays informational until it has been quiet for some calendar time.

### It is proven to fail

Not asserted — run. Against a fixture directory holding one `spawnSync("gh", ["pr","view", ...])` and one workflow `run:` block with `gh pr view`: **exit 1**, both reported, each naming its REST replacement. Against a directory holding only `gh api ...` and the permitted `gh pr merge --auto`: **exit 0**. And with the real tree's baseline in place, appending a second `["pr","list"]` to an already-baselined file went **red at the exact line**, then green again on revert.

### What it measured on the real tree

**2505 files scanned; 39 call sites in 19 files.**

| Cut | Result |
|---|---|
| By spelling | argv-array **34**, shell **5** |
| By route | `pr list` **26**, `pr view` **10**, `pr checks` **3**, `run view` **0** |
| By surface | TypeScript **34**, `agent-heartbeat.yml` **4**, shell script **1** |

Three readings:

- **The argv form is 34 of 39.** `spawnSync("gh", ["pr", "view", ...])` contains the substring `gh pr view` nowhere. A lint built from the obvious grep would have found five sites, declared the tree nearly clean, and looked thorough doing it. This is the finding most worth carrying forward: the brief for this work named four shell commands, and the tree's dominant spelling was none of them.
- **`pr list` is 26 of 39**, and it is the expensive route — a list costs points in proportion to the pages it walks. That is the mechanism by which a poll loop reaches 0/5000 inside a minute.
- **`gh run view` is zero.** Named in the brief, present nowhere. Kept in the roster anyway, because the next agent wanting a run's status will reach for it.

### The number that was wrong first

The first draft reported **77**. Nineteen of those were **error and usage strings in TypeScript** — `process.stderr.write("required-check-started: gh pr list failed\n")`, `"usage: gh pr view N --json body | bun validate-agencysignature-pr-body.ts"`. Prose *about* a command, not a call.

The control that settled it: a search for a genuine shell invocation in TypeScript — `execSync`/`spawnSync`/`$(...)` wrapping a whole `gh pr ...` command string — over all of `src/Core.TypeScript` returned **zero hits outside the lint's own test fixtures**. TypeScript here shells `gh` through the argv array. So the shell matcher is scoped to shell-shaped files, at zero measured cost, and the gap that leaves is named in the code rather than left to be discovered.

Recorded because a lint's first number is a hypothesis, and a tool that over-reports in its own favour is the same defect class it exists to catch.

### Two design choices worth their own lines

**Comments are masked; strings are not.** This lint's header names all four commands repeatedly. So does `agent-heartbeat.yml`, which carries five comment lines explaining why it uses REST beside its four real call sites. A lint that reports its own documentation gets deleted, and the explanations go with it. But the argv form lives *entirely inside string literals*, so masking string interiors would blind the lint to 34 of its 39 quarry. The masking is deliberately one-directional.

**The baseline stores counts, not a set.** Several files hold more than one call site of the same route. A set-shaped baseline would grandfather the file's whole route and let a seventh `gh pr list` land in `github-adapter.ts` silently. `{ "<key>": <n> }` closes it; the (n+1)th is a finding. Its honest limit: delete one baselined call and add another of the same route in the same file, and the count is unchanged. Named in the code as the known gap.

### The honest limits

- **Interactive `gh` use by a human is not the target and never will be.** `gh pr view 15673` at a prompt is the right command for a person: one call, rendered, not repeated four hundred times an hour. The target is the committed, repeated, unattended call. Stated in the rule, in the lint's first paragraph, and in the lint's own stdout, because a rule read as "the repo banned `gh`" is a rule that gets deleted.
- **A deliberate `gh api graphql -f query=...` is not flagged.** That is a legible choice to use GraphQL; this lint's subject is the *accidental* spend — the call whose transport the author never picked. Flagging the explicit form and not the implicit one would have the polarity backwards.
- **A runtime-assembled verb** (`["pr", verb]`, `gh pr "$SUB"`) is statically undecidable and is not seen.
- **Section 4 has no lint at all.** The transport choice is a syntactic property and can be checked; "does this loop's stop condition share a failure mode with its work" is not, and pretending otherwise would be the over-claim this repo keeps catching. Section 4 is carried by the rule text and by review, and that limit is stated rather than papered over.
- **Both files in this change are markdownlint-exempt.** `.markdownlint-cli2.jsonc` ignores `**/.claude/**` and `docs/research/2026-*-*.md`. An rc=0 from markdownlint on either is vacuous, which is exactly the class `audit-linter-coverage-vs-invocation.ts` exists to make legible. Named here so nobody quotes a green markdown lint as evidence about these two files.

---

## 6. Where this sits in the existing discipline

This is not a new principle. It is three existing ones pointed at a transport:

- **§13 noninterference / entropy quarantine** — a shared, exhaustible, *undeclared* channel is exactly an ambient resource. The GraphQL budget is consumed by calls whose authors never chose to consume it, which is the definition of an unmetered crossing. `.claude/rules/dv2-data-split-discipline-activated.md`.
- **The vacuity class** — `api-unavailable) : ;` is a check that cannot fail. `.claude/rules/toy-is-free-metered-must-be-earned.md`, and the empty-method-under-a-signature case in `.claude/rules/never-assume-malice-where-mistake-is-possible.md`.
- **Never assume malice** — the runaway loop, the silent no-op branch, and the four agents who hit the wall are all ordinary error under a budget. The loop's author wrote the post-mortem quoted in §4, which is the falsifier culture working exactly as intended: the defect is named precisely and attributed to nobody's intent.

**Anchors (Beacon).**

- **Secondary rate limits / backoff** — GitHub's own REST documentation on primary vs secondary rate limits is the primary source for §2's trap. The general discipline is *exponential backoff with jitter*: Jacobson & Karels, *Congestion Avoidance and Control* (SIGCOMM 1988), and the AIMD analysis in Chiu & Jain (1989). A retry loop with no backoff and a blind stop condition is congestion collapse in miniature.
- **Independent failure detection** — Chandra & Toueg, *Unreliable Failure Detectors for Reliable Distributed Systems* (JACM 1996). Their central move is to separate a detector's completeness from its accuracy and admit *suspicion* as a distinct state; §4.2's `unknown` register is that admission in a retry loop. A detector that shares a failure mode with the process it monitors satisfies neither property.
- **Correlated redundancy is not redundancy** — Knight & Leveson, *An Experimental Evaluation of the Assumption of Independence in Multiversion Programming* (IEEE TSE 1986). The measured result that independently written versions fail together far more than independence predicts. §4.1 is that finding applied to a probe and its subject.
- **Termination conditions must be world-properties** — the goal-vs-attempt distinction is the same one Dijkstra draws between a loop's invariant and its guard (*A Discipline of Programming*, 1976): a guard that tests the loop body's own progress rather than the postcondition does not establish the postcondition.

---

## 7. Pointers

- [`.claude/rules/rest-is-the-default-transport-graphql-is-the-contested-budget.md`](../../.claude/rules/rest-is-the-default-transport-graphql-is-the-contested-budget.md) — the carved sentence this satellite carries the detail for.
- `src/Core.TypeScript/hygiene/lint-graphql-transport-in-scripts.ts` (+ `.test.ts`, `.baseline.json`) — the falsifier.
- `src/Core.TypeScript/agent-heartbeats/merge-heartbeats-to-main.ts` — the original docstring: the 2026-08-14 measurement, `ARMING_DISABLED`, and `armOutcome`'s neutral-fact contract. **Cited, not edited** — it is another agent's file and it landed today.
- `src/Core.TypeScript/hygiene/AUDIT-LIFECYCLE.md` — the 7-step pattern this lint follows; step 5 is why there is a baseline, step 6 is why the gate is non-required.
- `.claude/rules/dv2-data-split-discipline-activated.md` §7 noninterference · §6 idempotency.
- `.claude/rules/async-all-the-way-truthful-signatures.md` — the sibling guard on un-knobbed work; a poll loop with no degree-of-parallelism knob is the same shape as `Task.Run`.
