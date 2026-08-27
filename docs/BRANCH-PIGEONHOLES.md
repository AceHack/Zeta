# Branch pigeonholes — 78 remote refs, categorised from evidence they carry

Measured 2026-08-27 against `origin/main`. Reproduce with:

```bash
bun src/Core.TypeScript/hygiene/report-branch-pigeonholes.ts          # human-readable
bun src/Core.TypeScript/hygiene/report-branch-pigeonholes.ts --json   # machine-readable
```

**Nothing in this document has been deleted, and nothing should be deleted by reading it.**
It reports. The bulk-delete decision is the maintainer's, made once the table is visible.

## The method, and the rule it follows

`.claude/rules/pigeonhole-by-self-claim-never-by-assumption.md`:

> The subject supplies the category, the evidence supplies the truth value. Observer-chosen
> bins are how a classifier goes unfalsifiable.

So no taxonomy was invented and no branch was sorted into it by how stale it looked. Two
separable axes, kept separable:

| axis | source | reads |
|---|---|---|
| **lane** | the branch's own self-claim | the ref namespace its author chose, plus the repo machinery that acts on that namespace |
| **disposition** | evidence | did its content reach `main`, and by which route |

### The test that does not work

The obvious content test — `git diff origin/main...<branch>` being empty — is **wrong, and
wrong in the direction that costs work.** The three-dot form diffs from the *merge-base*. This
repo squash-merges, so a squash-merged branch keeps its full diff against its merge-base forever
and reads as unlanded every time.

Measured while writing this: across 40 recently-merged refs the three-dot test returned
**40 unlanded / 0 landed**, including three branches watched merging that same night
(#15742, #15747, #15750). A 100% false-positive rate.

### The tests used instead

| evidence | strength | note |
|---|---|---|
| **PR record** (`pulls?state=all&head=<owner>:<branch>`) | **primary** | the branch's own self-claim — exactly what the rule asks us to read. A merged PR whose head SHA equals the tip proves the tip landed. |
| ancestry (`merge-base --is-ancestor`) | sufficient, not necessary | proves a true merge; squash breaks it |
| **touched-path content test** (`git diff <tip> main -- <paths it changed>`) | corroboration | **empty ⇒ landed (proof); non-empty proves nothing** — `main` may have moved past those files. The asymmetry is enforced in code: a non-empty result never downgrades a branch on its own. |
| **patch-id equivalence** (`git cherry`) | corroboration | catches commits re-landed under a *different* ref. **Full** equivalence is landing; **partial** equivalence is not, and is reported rather than rounded up. |

Both controls were run on the PR query before trusting it: a known-merged branch returns
`#15696 MERGED`, a nonexistent branch returns `0`.

## The table

77 refs excluding `main` at the time of the run; the fleet is live, so counts drift by a few
between runs. Re-run the script for current numbers.

### By lane (self-claimed)

| lane | count | what it means |
|---|---|---|
| `work` | 47 | ordinary branches |
| `protected-automation` (`heartbeat/*`) | 26 | **undeletable by ruleset — see below** |
| `live-ledger` (`liveness/*`) | 1 | append-only, written tonight |
| `legacy-automation` (`agent-heartbeats`) | 1 | superseded lane, 689 unique commits |

### By disposition (evidence-derived)

| disposition | count | evidence | action |
|---|---|---|---|
| `unlanded-never-proposed` | 23 | no PR ever opened, content not in `main` | **forward action** |
| `retired-by-decision` | 14 | a PR was closed unmerged; content still differs | **forward action** (record the reason, then delete) |
| `in-flight` | 9 | open PR | none — leave alone |
| `landed-squash` | 9 | merged PR, head SHA == tip | delete-eligible |
| `landed-equivalent` | 8 | branch's touched paths already match `main` | delete-eligible |
| `partially-landed` | 6 | merged PR exists but tip is past it | **forward action** |
| `landed-patch-equivalent` | 4 | all commits patch-identical to `main` under another ref | delete-eligible |
| `landed-merge` | 1 | tip is an ancestor of `main` | delete-eligible |
| **`unknown`** | **1** | — | leave, evidence named below |

## UNKNOWN — size 1, and why that is the right size

> `liveness/observations` @ `72251d7cca06e74963ae48de2eed1e78908e0864`

**Why it is unknown:** the ref has **no merge base with `main`** — it carries unrelated
history. Ancestry is undefined, and the content test is undefined with it. It is not that the
tests disagreed; it is that neither test *applies*.

**What would resolve it:** which process writes the ref, and whether anything reads it. Its tip
was written at 02:44Z on the day of measurement (`liveness(not-alive): observed …`), so it is an
actively-appended ledger, not a stale branch.

**A non-empty UNKNOWN is the success signal.** An empty one would mean the classifier
force-fit something, and a force-fit here is a deleted branch.

## Ready-to-delete set — 6 refs, verified individually

Every SHA below is recorded so any deletion is reversible with
`git push origin <sha>:refs/heads/<name>`.

**Still do not run this.** It is listed so the decision can be made from evidence.

| SHA | branch | evidence |
|---|---|---|
| `acd737a79571abd4e3bcc9ec7c71eefaeb160d68` | `claim/081M0WTW45W-auto-vivify-dangling-paths` | PR #15390 merged; **and** all 2 touched paths already match `main` |
| `fc2f75a03b6ec6284fb6360e956e22766440a019` | `shadow/actions-cache-measurement-v2` | PR #15561 closed unmerged, **but** its single research doc is byte-identical in `main` — landed by another route |
| `9142e163f9bb9a32de7abd806ba1b39feb0d3bc2` | `cursor/rework-pr-13767-9c53` | never had a PR, **but** its one commit is patch-identical to one already in `main` |
| `1a2055f9cfde92c617a6cc1aed5fc78d1081b5fa` | `fix/four-unowned-ci-gaps` | PR #15378 merged; both commits patch-equivalent in `main` |
| `efd4f4356bed2c35c0568471972c7051cd77365f` | `shadow/cache-key-narrow-toolchain-inputs` | PR #15545 closed unmerged; commits patch-equivalent in `main` |
| `12a346c32f35325c6e987a5a243b22332a7c8f59` | `shadow/dotnet-cache-restore-only-slim-lane` | PR #15549 closed unmerged; commits patch-equivalent in `main` |

Note the shape of rows 2, 5 and 6: **a closed-unmerged PR is not evidence the work is lost.**
Three of the six were closed by their authors and the content reached `main` anyway. Reading
the PR state alone would have kept them; reading it alone the other way would have deleted the
`derivation-*` branches below.

**Six is the honest number.** The 78 branches are not a pile of deletable garbage — that was
the expected shape and the evidence does not support it.

## `heartbeat/*` — 26 refs that CANNOT be deleted, by design

This is a mechanical fact, not a judgement call. Repo ruleset **16934633
"Heartbeat Branch Protection"**:

```json
{ "conditions": { "include": ["refs/heads/heartbeat/*"],
                  "exclude": ["refs/heads/heartbeat/*-flush-*"] },
  "rules": ["deletion"], "bypass_actors": [], "enforcement": "active" }
```

An **empty `bypass_actors` list** means no actor can delete them — not an admin, not a PAT.

And they *should not* be. The `heartbeat/<lane>` + `heartbeat/<lane>-buffer` pairs pointing at
identical SHAs are not duplicates; they are a **reusable two-ref staging design that mints
nothing per flush**. From `.github/workflows/pr-archive-on-merge.yml`:

> Those lanes reuse `heartbeat/<lane>` and `heartbeat/<lane>-buffer` and mint nothing per
> flush, which is why they hold at ~2 refs each while this lane reached **1,290**.

**These 26 refs are the fix for branch proliferation, not an instance of it.** A pass that
"cleaned up" the heartbeat lane would regress a lane that had already reached 1,290 refs.
`heartbeat/<lane>-flush` is a parked snapshot the flush job force-pushes to and cuts its PR
from; deleting one breaks that lane's flush.

`liveness/observations` and `heartbeat/pr-archive` were both written within minutes of this
measurement. **Any recommendation touching these is high-risk and none is made here.**

## Forward actions

### A. `unlanded-never-proposed` — 18 work refs, no PR ever opened

Content nobody was ever asked to look at. **Never a silent delete.**

The highest-value group in the whole report:

| refs | why it needs an action, not a delete |
|---|---|
| `derivation-a/threshold-sig-verify` `06b7b32b05`<br>`derivation-b/threshold-sig-verify` `9c527259bd`<br>`derivation-c/threshold-sig-verify` `63cf97e93b` | A **clean-room N-version experiment** (N=3, independent derivations of threshold-signature verification, each with its own acceptance tests and a report naming 14–15 spec ambiguities). **No report doc for it exists in `main`** — these three branches are the only copy. Deleting them collapses an N-version experiment to nothing, which is exactly what `dv2-data-split-discipline-activated.md` forbids: *both branches held, each with its path recorded.* **Action: ferry the three reports into `docs/research/` before anything else happens to these refs.** |
| `otto/telemetry-zetaid-shards` `81351e0ddf` | 568 files, 3 commits, **1 of 3 already patch-landed** — so this is a partial re-land with a genuine remainder. Action: diff the remainder, land or retire it explicitly. |
| `otto/agent-sovereign-keys-proposal` `316b67b419` | 6 commits, 23 files — a key-governance taxonomy (self-sovereign / shared-capability / delegated) plus an L0→L6 ladder. Research prose, never proposed. Action: ferry to `docs/research/`. |
| `otto/lint-fused-persona-cell-phase5` `c99a73e34e` | 12 commits, 149 files. (Sits in `retired-by-decision` — PR #9551 closed — but the size warrants naming here.) |
| `claude/design-sync-dqxa3r` `b04c6e6ba8` | 36 files, a claude.ai/design portal UI-kit import. Action: confirm superseded by the shipped design surface, else ferry. |
| `cursor/longhorn-common-nix-default-test-06ca` `274e217e20`<br>`cursor/longhorn-rebase-clean-06ca` `b85aba8674` | Near-duplicate pair, same two test commits. Action: pick one, open a PR, delete the other naming it as successor. |
| `claim/081ktqx7w6q08qg0r000-otto-2026-08-{24,25,26,27}` | Four dated single-commit claim refs on one work-item id — a per-day claim lane that mints a ref per tick. Action: **the lane itself is the fix** — point it at a reusable staging ref like `heartbeat/*` already does, then the four collapse to one. |
| `claim/task-browser-{checkpoint-port,pwa-checkpoint-transport,zetadb-invalidation}`<br>`codex/browser-zetadb-startup-hydration` | Four single-commit task-browser claims from 2026-08-08/09. Action: one work-item, one PR, or retire as a group with the reason recorded. |
| `automation/society-protected-main-contract` `beaf6cd899` | 5 files, 2026-08-13. Action: propose or retire. |
| `claim/081KWQS2PN608QG0R002CXSBG0-minimal-bnn-synthesis` `d0da655971` | Minimal BNN cell + collision protocol, 2026-07-08. **Overlaps live Cl(4) BNN work** — route to that owner rather than deleting. |

### B. `retired-by-decision` — 14 refs whose PR was closed unmerged

A close is a recorded decision by the branch's own author or reviewer — the strongest
self-claim available. **Action: confirm the reason is recorded somewhere durable, then
delete.** If no reason exists, re-file or re-cut first. Several of these
(#15545, #15549, #15561) turned out to have landed anyway and are in the ready-to-delete set
above; the rest carry content that genuinely differs.

Refs: `claim/081M0XF2RTG087G0R002DRKG39-arity-census-freetime`,
`claim/bug-dotnet-arm64-accessviolation`, `claim/kiro-free-tier-intelligence-scaling`,
`claim/kiro-identity-adr-corrections-2026-07-08`,
`claim/kiro-trio-attestation-research-2026-07-08`, `claim/kiro-trust-protection-adr-2026-07-08`,
`fix/installer-ci-and-gate-reds-2026-07-31`, `fix/model-benchmark-template-typo`,
`fix/verify-session-toctou`, `otto/lint-fused-persona-cell-phase5`,
`shadow/archive-strand-audit-off-the-blocking-floor`,
`shadow/candidate-generator-possibility-space`,
`shadow/consensus-vote-dead-timestamp-and-local-time-audit`,
`shadow/f2-role-correlation-unused-locals`.

### C. `partially-landed` — 6 refs where the tip is past the merge

Some content landed, some did not. **Action: diff the tip against the merged head and either
land the remainder or record why it is dropped.**

| ref | note |
|---|---|
| `agent-heartbeats` `2a73240478` | **689 unique commits**; last merged PR #5470 is from 2026-05-27, tip from 2026-06-19. The largest single unlanded body in the repo, and superseded by the `heartbeat/*` lanes. Highest-value item in this section. |
| `fix/settings-record-wrong-in-the-permissive-direction` `bad7bec1bb` | PR #15369 merged, commits added after |
| `fix/worktree-mise-trust` `4fa87b7bcc` | PR #15402 merged, commits added after |
| `lior/lineage-disjointness-estimator` `9195f16159` | PR #15696 merged, 9 commits past it |
| `shadow/containerized-job-runtime-toolchain-portability-tiering` `ac55981a64` | PR #15575 merged, 7 commits past it |
| `heartbeat/soraya` `9c090c9704` | protected lane — no action, the flush handles it |

---

# Separate matter: 15,602 stale remote-tracking refs

**This is a different action from everything above** — pointers, not branches — and the risk
profile is not comparable.

## Measured

| where | `refs/remotes/origin/*` |
|---|---|
| the shared checkout `/Users/acehack/Documents/src/repos/Zeta` | **15,680** |
| the actual remote (`gh api .../branches`, `git ls-remote`) | **78** |
| **stale pointers to branches deleted upstream** | **15,602** |
| a clean clone made today | **79** (78 + `origin/HEAD`) |

The shared checkout additionally carries **1,172** refs under remotes named
`parts567` and `streams-2200z`, both pointing at `/private/tmp/` paths that no longer exist.
Total remote-tracking refs there: **16,852**.

## Why pruning is low-risk, stated precisely

`git fetch --prune` **removes pointers; it deletes no objects.** That is the important
asymmetry and it is what makes this materially safer than deleting real branches.

The honest caveat, which the one-line version omits: once a ref is pruned its objects become
unreachable and a *later* `git gc` can collect them. For a ref whose branch still exists
upstream that is harmless (refetchable). For a ref deleted upstream **and** never merged, prune
plus gc would be the last copy going. So the question is whether any stale ref holds unlanded
work — which is measurable, and was measured.

## The evidence that makes a bulk prune defensible

**65 recent stale refs sampled, PR record checked on each. Zero carry unlanded content.**

- First 25 non-automation stale refs, newest first: **23 MERGED**, 2 with no PR.
- The 2 with no PR — `b17`, `b41` — were **local shorthand names for work that landed under a
  different ref**. `b41`'s commit subject appears verbatim on `main` as #15641; `b17`'s as
  #15617. The classic squash-breaks-ancestry case, not a loss.
- Next 40 sampled: **0 with no PR**.

Age distribution of the 15,602: 5,139 from 2026-08, 1,020 from 07, 3,624 from 06, 5,696 from
05, 123 from 04.

A large share are `automation/pr-archive-<pr>-run-<id>-attempt-1` — the branch-per-record
generator that reached 1,290 refs and was **already replaced** by the reusable staging design
described above. The stale refs are the fossil record of a bug that is fixed.

## Recommended

```bash
git fetch origin --prune                      # in each clone
git remote remove parts567 streams-2200z      # dead /private/tmp remotes, shared checkout only
git ls-remote --heads origin | wc -l          # must equal `git branch -r | wc -l` minus origin/HEAD
```

Verify the count matches the API afterwards; that equality is the check that the prune worked.

## A stale view is itself a defect

This is not cosmetic. A 16,849-ref local view has been **producing false negatives**: agents
grep the shared checkout, find nothing, and report that a file or branch does not exist. Two
memory entries already record this failure mode
(`shared-checkout-goes-stale-fast-and-agents-keep-reading-it`,
`list-the-directory-before-grepping-for-structure`). A check that did not run looks exactly
like a check that passed.

**The measurement to trust is `gh api .../branches` or `git ls-remote`, never a local
`git branch -r`.** That is what this document and its script both use.
