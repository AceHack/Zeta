# The PR-free heartbeat lane: attestation instead of a gate

Date: 2026-08-25
Status: DESIGN. Nothing in this document changes a ruleset. The audit it specifies is implemented,
tested, and armed-but-green; the ruleset change is written out as a reviewable command for the
maintainer's own hand.
Author: Otto (shadow seat), working from Aaron's brief.

Direction, verbatim:

> *"heartbeats should not need a PR to go to main if we can help it. heartbeats should be almost
> free. PRs are our corporate lane for our code forge hosts like github, we want to move away from
> these and have things working with just mutual agent workflows. The heartbeats should be able to
> handle their own verifications with our mini agent society on the github free runners — if not,
> this is something we should design and get working soon. we can change branch protection or
> anything we need for this, maybe we can exclude the heartbeat folder or something. we only need to
> use PRs for corporate lanes. **any new design that has PRs as part of the design should be treated
> as a smell** — we are trying to remove PRs altogether, and soon."*

---

## 0. Summary for someone with two minutes

1. **"Exclude the heartbeat folder" is not expressible on GitHub.** Rulesets scope by **ref**, never
   by path. `required_status_checks` applies to the whole branch or not at all. There is a
   `file_path_restriction` rule, and it is the wrong polarity and the wrong axis — section 2. This is
   a straight answer to the thing you floated: **no, and here is what to do instead.**
2. **The lever is `bypass_mode`, and the surface is smaller than the record claims.** Measured live:
   `main` carries **no `pull_request` rule at all**, in any ruleset, and classic branch protection
   requires **neither** a PR **nor** a status check. Exactly **one** mechanism forces every lane
   through a PR — the single required context `gate (required)` in ruleset `CI Gate` (16134995),
   whose only bypass actor may bypass `on pull_request` only. **One ruleset, one rule, one field.**
3. **The bypass is not the hard part; what replaces the gate is.** A bypass actor is a permanent
   hole. So the lane's self-verification is specified as a **content-bound commit attestation** —
   `Verification-Subject` is the commit's *own tree sha*, which makes a **copied** attestation
   mechanically detectable, closing half of the limit `agencysignature-block.ts` records as
   unfixable. The other half (a *forged* fresh attestation) is not closable by any parser and is
   handled by **who holds the credential**, not by what the commit says.
4. **The falsifier is built and it fires.** `audit-heartbeat-lane-attestations.ts` +
   `registry/heartbeat-lane-allowlist.json`, 38 tests, one per violation class. Run against current
   `main` with the cutover set to the lane's identity it reports **290 violations of 300 commits**;
   run as shipped it reports clean, because the cutover is in the future and nothing is armed yet.
   Both numbers are reported in section 8, including the vacuity in the second one.
5. **It found two real things while being built**, neither of which was in the design when I started:
   `docs/github/prs/manifest.jsonl` is **not append-only** — it inserts rows in sorted order, so its
   diffs show *zero deletions* while the pre-image is *not a byte prefix*. And the byte budget was
   measuring blob size rather than added bytes, which would have made every flush red. Section 8.
6. **The strongest containment property already exists and nobody has to build it.** `Branch Safety`
   (deletion, non-fast-forward) has **zero** bypass actors, and classic protection adds
   `required_linear_history` + `enforce_admins: true` with no bypass at all. Bypass actors are
   **per-ruleset**. So a heartbeat bypass actor can **append and can never erase, rewrite, or
   merge** — and an append is compensatable by revert. That is the whole safety argument, and it is
   structural rather than procedural.
7. **Recommendation: yes, with a named sequencing.** Do not open the bypass on the same day the
   audit lands. Section 12 gives four steps, the first two of which need no ruleset change at all.

---

## 1. What the PR is currently costing, measured

Not asserted — counted on `origin/main` at `44995b96b`, 2026-08-25.

| Measurement | Value |
|---|---|
| Commits on `main` in 24 h | **589** |
| Of those, `[heartbeat-batch-merge]` flushes | **59 (10.0%)** — one PR each |
| All mechanical lanes (archive + drift + metrics + heartbeat + society) | **~85%** of commit volume |
| Live `heartbeat/*` refs, never reaped | **1,631** (564 alexa / 532 otto / 514 soraya flush snapshots) |
| `gate (required)` duration | 12 s — the *rendezvous*, not the compute, is the cost |
| Blocking floor behind that one context | `build-and-test`, `lint`, `lint-typescript`, `cross-verify`, `full-verify` |

Three costs are worth naming individually, because two of them are not "slowness":

**(a) The PR route forces the lane to wear a human's identity.** The enterprise forbids the Actions
identity from creating pull requests (`409: The enterprise does not allow GitHub Actions to create or
approve pull requests`), so `flush-via-staging.ts` documents that a **fine-grained PAT owned by a
person** must open the PR. Every one of those 59 daily flush commits is authored by
`aaron_bond@yahoo.com`. The telemetry lane is, in the commit record, indistinguishable from Aaron
merging his own work. **Removing the PR removes a shared-human-credential dependency** — a direct
push needs only `contents: write`, which a dedicated machine identity can hold. This is an
accountability *improvement*, and it is the argument I did not expect to be making.

**(b) The route has grown its own detector, whose only subject is the route.**
`agent-heartbeat.yml`'s alexa leg runs `required-check-started.ts --min-age-min 20` to fail loudly
when a flush PR ages past 20 minutes with `gate (required)` never scheduled — a real, recurring
failure documented in
`docs/research/2026-08-24-the-required-check-that-never-ran-and-the-1162-tests-that-block-nothing.md`.
Auto-merge arming is *off by default* because the scoped flush PAT cannot call the GraphQL-only
`enablePullRequestAutoMerge`. A machine that pushes to a branch it already controls needs none of
this apparatus. **The PR is not merely a delay; it is a subsystem.**

**(c) The floor binds the writers, and that has already caused a five-day outage.**
`docs/research/2026-08-18-forge-agnostic-drift-checks-*.md` §2 measured the drift ledger dead for
five days — 276 green runs, zero ticks — because `git push origin main` was rejected by
`gate (required)` and the failure was swallowed by `|| echo "push race"`. That document states the
general lesson this design is an instance of: *"a blocking check is not merely a cost on the lanes it
delays; it is a capability constraint on every mechanism that needs to write."*

---

## 2. Finding 1 — path-scoped exclusion is NOT expressible (the straight answer)

**Rulesets scope by REF.** A ruleset's `conditions` object contains exactly `ref_name.include` and
`ref_name.exclude` (plus `repository_name` / `repository_property` for org-level rulesets). There is
no path condition, and `required_status_checks` takes only `required_status_checks[]`,
`strict_required_status_checks_policy`, and `do_not_enforce_on_create`. **A required status check is
all-of-the-branch or none of it.** Confirmed against the current REST documentation for
`/repos/{owner}/{repo}/rulesets` on 2026-08-25, and against the live objects on this repository.

Two near-misses deserve naming, because both look like the answer and neither is:

**`file_path_restriction` exists — wrong polarity, wrong axis.** It is a **push-ruleset** rule
(`target: push`), available to us (this org is on the `enterprise` plan, verified via
`gh api orgs/Lucent-Financial-Group`). But it *forbids* named paths for everyone the ruleset binds;
it cannot *permit only* named paths, and it cannot be scoped to one actor while others push freely.
What we want is "**this actor** may write **only these** paths". What it offers is "**everyone**
except bypass actors may write **anything but** these paths". Those are not the same statement, and
no combination of them composes into it: to confine the heartbeat actor you would have to deny the
whole repo to everyone else, which is the opposite of a carve-out.

**`commit_message_pattern` is a genuine push-time predicate — and binds every writer.** This is a
real find and it is worth keeping in view: it is a **zero-duration** rule evaluated at push, which is
the column the forge-agnostic document argues the floor should migrate to, and it could require the
attestation trailer *at the forge* rather than after the fact. Its limit is that it also binds every
ordinary squash merge to `main`, and the AgencySignature convention explicitly allows blockless
maintenance commits (`maintenance-commit-on-another-agents-branch-carries-no-block.md`). So it is a
**later hardening**, not part of the initial change, and it is section 11's open question 3.

**The general form, which is the part worth carrying:** the constraint we want is
*(actor × path × operation)*, and the forge's ruleset language is *(ref × rule)*. That is not a gap
in our understanding of GitHub; it is GitHub's extension surface, and it is the same wall the
forge-agnostic document hit when it observed that the predicate column is mostly unavailable here
short of a `pre-receive` hook, which GitHub sells only on Enterprise Server. **A remote we control
accepts a `pre-receive` hook that expresses (actor × path × operation) in ten lines of shell.** So
this finding is not a defeat; it is the sharpest concrete statement yet of what sovereign mode buys.

---

## 3. Finding 2 — the live surface is smaller than the documentation believes

Measured 2026-08-25 via `gh api`. **Five rulesets exist, not two**, and the brief I was given listed
two — so this table is the corrected baseline, not a restatement.

| Ruleset | id | Target | Rules | Bypass actors |
|---|---|---|---|---|
| `Branch Safety` | 16189060 | `~DEFAULT_BRANCH` | `deletion`, `non_fast_forward` | **none** |
| `CI Gate` | 16134995 | `~DEFAULT_BRANCH` | `required_status_checks: ["gate (required)"]` | `RepositoryRole 5`, `bypass_mode: pull_request` |
| `Default` | 15256879 | `~DEFAULT_BRANCH` | **`[]`** | none |
| `Heartbeat Branch Protection` | 16934633 | `refs/heads/heartbeat/*` | `deletion` | none |
| `Code Quality Copilot review…` | 19490341 | — | — | `enforcement: disabled` |

Plus **classic branch protection** on `main`, which is a separate mechanism and was worth checking
rather than assuming:

```
enforce_admins: true          required_linear_history: true
allow_force_pushes: false     allow_deletions: false
required_conversation_resolution: true
required_status_checks:        ABSENT
required_pull_request_reviews: ABSENT
```

**Three consequences, and the first is the one that makes this design small:**

1. **Nothing on `main` requires a pull request.** No `pull_request` rule in any active ruleset; no
   `required_pull_request_reviews` in classic protection. The *only* thing that forces a PR is that
   `required_status_checks` is evaluated **at push time against the pushed tip** — a commit that has
   never been through a check run is *missing* the check, and missing is a rejection. The PR is not
   required by policy; it is the only shape in which the check can have already run. That is why
   making `gate` faster would not help and why `[skip ci]` makes it worse.
2. **`docs/operations/branch-protection-lfg-main.json` is stale and says otherwise** — it describes
   ruleset 15256879 as carrying `pull_request` with squash-only merges and thread resolution. Live,
   that ruleset has `rules: []`. The forge-agnostic document already flagged this (§4d, "an `active`
   ruleset with no rules is the governance surface's own instance of the vacuity class"); this
   document is a second, independent confirmation. **Material consequence unchanged and still
   Aaron's call: there is currently no active rule requiring squash merges or thread resolution on
   `main`.**
3. **Bypass actors are per-ruleset, and that is the containment story.** Adding an actor to
   `CI Gate` grants it nothing in `Branch Safety`, and grants it nothing at all against classic
   protection, which has no bypass concept and `enforce_admins: true`. So the lane inherits, for
   free and structurally:
   - cannot delete `main`
   - cannot force-push or rewrite `main`
   - cannot push a merge commit (`required_linear_history`)
   - **can only append single-parent commits to the tip**

   The complete worst case of a fully compromised heartbeat credential is therefore *"unwanted
   commits appended to `main`, every one of them recorded, attributable, and revertable."* That is
   the **compensatable** class, in exactly the sense `registry/uncompensatable-floor.yaml` uses the
   word. The uncompensatable class — erasure — is guarded by two mechanisms that this change does
   not touch and that have no bypass at all.

---

## 4. What the lane RUNS before it pushes

"The agent society verifies it" is not a design. Here is the check set, its cost, and — the part
that actually carries the argument — why it is sufficient for *this* class of change and not for a
general one.

All five run on a free `ubuntu-24.04` runner against a tree that is already checked out. None
compiles anything, opens a socket, or starts a container.

| # | Check | What it refuses | Mechanism |
|---|---|---|---|
| 1 | `path-allowlist` | any changed path outside `paths.allow`, or inside `paths.deny` | `git show --name-status` + anchored regex |
| 2 | `append-only` | for an `append-only` path, a modification whose pre-image is not a byte **prefix** of the post-image; for `add-only`, any modification; **for any path, any delete / rename / copy / typechange** | two `git show` per modified path |
| 3 | `schema-parse` | any added or modified JSON / JSONL file that does not parse, or whose rows lack the lane's declared keys | `JSON.parse` per file |
| 4 | `size-budget` | > 400 files, > 2 MiB added bytes per commit, > 512 KiB added per file | arithmetic over `cat-file -s` |
| 5 | `author-roster` | any constituent heartbeat commit whose author is not on the machine-lane roster in `agency-signature-identity-roster.json` | roster lookup |

**Cost, measured rather than estimated** (the audit shares checks 1, 2 and 4 with the lane, so its
timings are the honest proxy): classifying **290 lane commits including full diff collection took
31.8 s**, i.e. **~110 ms per commit** on a 58-file flush. A lane verifying its own single flush
therefore pays about a tenth of a second. Compare `gate (required)`: 12 s of compute preceded by
minutes of queueing and scheduling and — measurably, per PR #12046 and the required-check-that-never-
ran forensics — sometimes never running at all. **The saving is not the compute; it is the
rendezvous.** I have not broken the cost down per individual check, and will not present a
made-up breakdown as if I had.

### 4a. Why this is sufficient here and not in general — say it precisely

The tempting formulation is "heartbeats are low-risk". That is a vibe, not an argument, and it does
not survive the observation that `docs/observe-events/` feeds the drift ledger, the DORA folds, and
the Pages dashboard. Here is the version that holds:

> **The five checks are sufficient because the class of change is *inert data under a fixed set of
> paths*, and the full floor exists to protect things that are *not* inert.**

Concretely, `build-and-test`, `lint-typescript`, `cross-verify`, and `full-verify` all answer one
question: *does the repository still build and agree with itself after this change?* That question
is well-posed only for inputs to a build. Not one file in `paths.allow` is compiled, imported,
executed, linked, or read by any build step — they are consumed *downstream* by folds and
dashboards, never *upstream* by a toolchain. A malformed `docs/observe-events/*.json` cannot break a
build; it can produce a wrong number on a panel, which is a **drift** finding, healed by the loop
that already exists.

The `paths.deny` list is where this argument is made mechanical rather than rhetorical. `.github/**`,
`src/**`, `registry/**`, `tests/**`, `package.json`, `bun.lock` — these are refused *even if a future
widening of `allow` would cover them*, precisely because they are the surfaces where "inert" stops
being true. **The check set is not weaker than the floor; it is the floor restricted to a domain
where the floor's questions are not askable.**

Two honest limits on that argument, stated rather than papered over:

- **`schema-parse` is shallower than it sounds.** It proves a file parses and carries the declared
  keys. It does not prove the *values* are true. A lane that faithfully records a wrong measurement
  passes every check here. That is not a gap this design can close — it is the drift ledger's job,
  and the drift ledger is downstream by construction.
- **The lane's own five checks are self-reported.** Nothing in this document proves check 3 actually
  ran on any particular push. That is the actuator-verification gap named in the forge-agnostic
  document §5b, and section 9 below is explicit that it stays open.

---

## 5. What the commit CARRIES — attestation, and the copy problem

### 5a. Does AgencySignature v1 extend to carry this? No, and the reason is structural

I evaluated extending the existing ten-key block rather than adding a second one, since a second
convention is a cost. It should not be extended, for a reason that is not stylistic:

**AgencySignature answers *who acted and under what authority*. An attestation answers *what was
checked, against which bytes*.** They differ on every axis that matters for a trailer format:

| | AgencySignature v1 | Verification-Attestation v1 |
|---|---|---|
| Subject | the actor | the **content** |
| Stable across | a whole class of commits by that actor | **exactly one commit** |
| Author | the agent making the change | the **verifier**, which should not be the writer (§6) |
| Reconciliation | some keys reconcile to the weakest claim (`Action-Mode`) | **never reconciles** — two attestations of different trees is a contradiction, not a merge |
| Absence means | honestly asserting nothing (a maintenance commit) | **the check did not run** — a violation |

That last row is decisive. `maintenance-commit-on-another-agents-branch-carries-no-block.md` makes
*silence* the honest record for AgencySignature. For a verification attestation, silence must be
*loud*. Putting a key with inverted absence-semantics inside a block whose whole discipline is
"absence asserts nothing" would corrupt both. This is DV2.0 change-rate partitioning applied to the
trailer surface: different change rate, different lifetime, different author ⇒ different satellite.

Both blocks may appear in one message. Neither parser sees the other's keys.

### 5b. The format

```
Verification-Version: 1
Verification-Lane: agent-heartbeat
Verification-Subject: <40-hex tree sha OF THIS COMMIT>
Verification-Checks: path-allowlist,append-only,schema-parse,size-budget,author-roster
Verification-Verdict: pass
Verification-Runner: github-actions/32818569388
```

Six contiguous lines, no blank line inside. Last complete block wins. `Verification-Checks` must be
drawn from the registry's `knownChecks` and must cover all of `requiredChecks` — **the required set
lives in the registry, not in the attestation**, so a lane cannot pass by naming fewer checks, and
`UNKNOWN-CHECK` refuses a lane that invents a friendlier vocabulary.

### 5c. The copy problem, and exactly how much of it `Verification-Subject` closes

`agencysignature-block.ts` records the limit honestly:

> *"the parser cannot distinguish a copied attestation from an earned one — a copy is byte-identical
> to the original, so two identical blocks pass and always will."*

That is true of AgencySignature and it is **not fully true here**, because this attestation is bound
to content the copier cannot carry with it:

- **A COPIED attestation is mechanically detected.** Lift the block verbatim from a commit that
  genuinely was verified and paste it onto a different commit: the tree sha differs, and the audit
  returns `SUBJECT-MISMATCH`. The git object model does the work — a tree sha is fixed before the
  commit object exists, so it is knowable at commit time *and* unforgeable after it. Test:
  `"SUBJECT-MISMATCH — a COPIED attestation is caught by the tree binding"`.
- **A FORGED attestation is NOT detected, and nothing parseable could detect it.** An actor holding
  the push credential computes its own tree sha and writes a fresh block claiming checks it never
  ran. Every parser on earth accepts it. **This is accepted, not solved**, and the mitigation is
  entirely outside the commit message:
  1. the credential is reachable only from code that already passed the gate (§6),
  2. the verifier is a different actor from the writer (§6),
  3. whatever it writes is append-only and revertable (§3),
  4. the forge's own bypass ledger records that it pushed (§8b).

Half a problem closed by a mechanism, half named and priced. Stating which half is which is the
whole point of writing it down.

---

## 6. WHO pushes — verifier ≠ author, and where the credential lives

This is the half that makes "the agent society verifies it" mean something, and it is a **small delta
from what already runs**, not a new architecture.

**Today:** three agents tick, each pushing its own work to `heartbeat/<agent>`. A flush job then
merges those refs to `main` via a PR.

**Proposed:** unchanged, except the last step. The writers keep pushing to `heartbeat/*` — a
ruleset-disjoint namespace with no required checks, already proven for months, and **the writers
never hold the bypass credential.** A separate **flush actor** fetches those refs, runs the five
checks of §4 against the *union diff*, writes the attestation, and pushes straight to `main`.

The separation falls out of the existing topology:

- **The verifier is not the author.** The flush actor checks refs it did not write, exactly as
  `docs/design/2026-08-13-agent-verified-merge-replacing-prs.md` requires.
- **Compromising a writer buys nothing new.** A writer can already push whatever it likes to
  `heartbeat/<agent>`; that is true today. It still cannot reach `main` except through checks it
  does not control.
- **The attack surface is one small, in-repo, reviewed program** rather than three tick jobs that
  pull Ollama models and run generated code.

**Where the credential lives, and why the answer is a dedicated GitHub App and not `GITHUB_TOKEN`:**

| Option | Bypass actor | Problem |
|---|---|---|
| `GITHUB_TOKEN` | `Integration` 15368 (GitHub Actions) | **Every workflow in the repo** gets unchecked push to `main`, including workflows on same-repo PR branches. Far too broad. |
| Machine-user PAT | `Team` | A PAT is a broad, long-lived, human-shaped credential — the thing (a) above is trying to get *rid* of. |
| **Dedicated GitHub App** | `Integration <app-id>` | **Recommended.** Installation scoped to `contents: write` on this repo only; identity is distinct in every log; revocable independently. |

Containment for the App's private key uses a mechanism the repo already has: put it in a **GitHub
Actions Environment** (`heartbeat-lane`; `copilot` and `github-pages` already exist), so a job must
declare `environment: heartbeat-lane` to read it, and set the environment's deployment-branch policy
to `main` only. Combined with the repo's `default_workflow_permissions: read` (verified live), the
result is that **the credential is reachable only from a workflow definition that has itself already
passed `gate (required)` to reach `main`.** An untrusted PR branch cannot reach it. That is not
airtight — a merged change to a workflow file could reach it — but the path to it runs through the
gate, which is the correct shape.

---

## 7. The exact ruleset change — for the maintainer's hand, not mine

Gated class. Not performed here. **Do steps 1–3 of section 12 first; this is step 4.**

```bash
# 0. Create the App (UI): org-owned, name "zeta-heartbeat-lane",
#    permissions: Repository → Contents: Read and write. NOTHING else.
#    Install on Lucent-Financial-Group/Zeta only. Note its numeric App ID.
APP_ID=<numeric app id from the App's settings page>

# 1. Snapshot the live ruleset BEFORE touching it (PUT replaces the whole object).
gh api repos/Lucent-Financial-Group/Zeta/rulesets/16134995 \
  > /tmp/ci-gate-before.json
cat /tmp/ci-gate-before.json | python3 -m json.tool | head -40   # read it

# 2. Derive the new body from the live one — never hand-write it.
python3 - "$APP_ID" <<'PY' > /tmp/ci-gate-after.json
import json, sys
d = json.load(open("/tmp/ci-gate-before.json"))
body = {k: d[k] for k in ("name", "target", "enforcement", "conditions", "rules")}
body["bypass_actors"] = d["bypass_actors"] + [{
    "actor_id": int(sys.argv[1]),
    "actor_type": "Integration",
    "bypass_mode": "always",   # NOT "exempt" — see the note below
}]
json.dump(body, sys.stdout, indent=2)
PY

# 3. Review the diff, then apply.
diff <(python3 -m json.tool /tmp/ci-gate-before.json) <(python3 -m json.tool /tmp/ci-gate-after.json)
gh api -X PUT repos/Lucent-Financial-Group/Zeta/rulesets/16134995 --input /tmp/ci-gate-after.json

# 4. Arm the audit: set cutoverIso in registry/heartbeat-lane-allowlist.json to NOW,
#    and laneIdentities.emails / forgeActors to the App's bot identity, via PR.

# Rollback is the inverse and is complete:
gh api -X PUT repos/Lucent-Financial-Group/Zeta/rulesets/16134995 --input /tmp/ci-gate-before.json
```

**`bypass_mode` must be `always`, never `exempt`.** GitHub documents three values — `always`,
`pull_request`, `exempt` — and `exempt` is specified as *"rules do not run; no audit entry is
created."* An unchecked push that leaves **no forge-side record** would delete the one input to the
audit that the pusher does not author (§8b). `always` bypasses the rule *and* records the bypass.
**Choosing the mode that produces evidence is the entire difference between a monitored hole and an
unmonitored one.**

**What this change does NOT grant**, restated because it is the safety argument: nothing in
`Branch Safety` (deletion, non-fast-forward — zero bypass actors), and nothing against classic branch
protection (`enforce_admins: true`, `required_linear_history: true`, no bypass concept). The existing
`RepositoryRole 5 / pull_request` actor is left exactly as it is.

---

## 8. The post-hoc audit — what it checks, and what it found

`src/Core.TypeScript/hygiene/audit-heartbeat-lane-attestations.ts` (+ `.test.ts`, 38 tests) reading
`registry/heartbeat-lane-allowlist.json`. Exit 0 clean / 1 violation / 2 tooling error. **Wired into
the `cross-verify` floor job in this PR**, beside `audit-proof-lineage-binaries.ts`, for the same
reason: it is offline, opens no socket, and reads only committed git objects.

Collection is **two-phase**, and that is correctness rather than speed. CI checks out at
`fetch-depth: 1`, where the tip has no parent — so `git show --name-status` reports the *entire
tree* as added (45,823 files here) and `<sha>^` does not resolve. Metadata alone decides
`NOT-LANE` / `PRE-CUTOVER-LEGACY`, so a commit the audit does not judge never enters the
parentless path. And where the parent genuinely is unreachable, `collectChanges` **refuses**
(exit 2) rather than reading a missing object as "the prefix was not preserved": a check that
cannot see its input must say so, not convict. Measured: **6.9 s for a 300-commit metadata-only
window; 31.8 s when 290 of those commits are lane commits carrying full diffs.** On a shallow CI
checkout the window is one commit.

### 8a. The twelve verdicts

Three are clean pass-throughs — `OK`, `NOT-LANE` (so the audit never touches ordinary work),
`PRE-CUTOVER-LEGACY` (grandfathering, exactly as `audit-agencysignature-main-tip.ts` does it, so
arming adds no retroactive red). Nine are violations, and **each has a test that produces it**:
`MISSING-ATTESTATION`, `MALFORMED-ATTESTATION`, `SUBJECT-MISMATCH`, `VERDICT-NOT-PASS`,
`UNKNOWN-CHECK`, `MISSING-REQUIRED-CHECK`, `PATH-ESCAPE`, `MODE-VIOLATION`, `BUDGET-EXCEEDED`.

The registry is itself treated as a claim and checked: an empty `laneIdentities.emails` (which would
match nothing and pass vacuously), an empty `requiredChecks` (which would let an attestation name no
checks), and a `requiredCheck` absent from `knownChecks` are all **refused at parse time**.

### 8b. `--online`: the one input the pusher does not author

Offline, "is this a lane commit" is decided by the author email, which the pusher chooses. `--online`
reads GitHub's **rule-suites** ledger (`/repos/{o}/{r}/rulesets/rule-suites`), verified live and
returning `actor_name`, `before_sha`, `after_sha`, and `result` ∈ `pass` / `fail` / `bypass`. Any
actor recorded bypassing a ruleset on `main` that is not a registered lane actor is a finding on its
own, regardless of what its commit contains. **This is why `exempt` is forbidden in §7.**

### 8c. What it found on current `main` — including the vacuity

**Run 1 — as shipped**, `--branch origin/main --max 300`:

```
cutover:   2099-01-01T00:00:00Z
NOT-LANE   300
clean — every lane commit in the window is attested and inside its allowlist
```

**Exit 0, and this result is vacuous, which I am reporting rather than quoting as a pass.** The lane
identity does not exist yet, so 300 of 300 commits are `NOT-LANE` and the audit examined nothing.
A green run here proves only that the audit does not fire on unrelated work. **A check that cannot
fail is not a check**, so:

**Run 2 — counterfactual**, the *current* flush identity as the lane, cutover 2026-08-01:

```
lane ids:  aaron_bond@yahoo.com
MISSING-ATTESTATION   290
NOT-LANE               10
VIOLATIONS (290)      → exit 1
```

**290 of 300.** The audit fires, at scale, on real history. And the run surfaces the identity problem
independently: the current flush credential authors nearly every squash on `main`, so a
*content-identity* lane test cannot separate "the heartbeat lane pushed this" from "Aaron merged
this". **That is a first-order argument for the dedicated App of §6**, arrived at by measurement
rather than by preference.

**Run 3 — does the allowlist actually fit?** Path/mode verdicts over the last 40 real
`[heartbeat-batch-merge]` commits, and over four other mechanical lanes:

| Lane | commits | clean | path escapes | mode violations |
|---|---|---|---|---|
| `[heartbeat-batch-merge]` | 40 | **40** | **0** | **0** |
| `archive(pr-reviews)` | 20 | **20** | **0** | **0** |
| `society: evolution tick` | 20 | 8 | 0 | 24 |
| `drift: record sweep` | 20 | 8 | 53 | 2 |
| `metrics: append tick frame` | 20 | 7 | 45 | 0 |

Max observed for the heartbeat lane: **58 files and 98,257 added bytes per commit** — the budget caps
sit 7–20× above that. The other lanes' escapes are all telemetry-shaped and none is code
(`data/tick-shards/**`, `data/drift-genome.json`, `docs/observe-events/society-index.json`,
`workitems/**`, `docs/letters/**`), so the mechanism generalises — each lane needs its own registry
rows, which is section 11's open question 2. One escape is a genuine judgement call rather than an
oversight: the drift lane writes **`workitems/**`** when it files an SLO breach, and a work item is a
governance artifact, not telemetry. That widening should be argued, not assumed.

### 8d. Two real defects the audit found in its own design

Both are recorded because they are the evidence that the checks are not decorative:

1. **`docs/github/prs/manifest.jsonl` is not append-only.** Modelled as `append-only` on the strength
   of its diffs — *N insertions, 0 deletions*, 13 times out of 40. Prefix-verification says otherwise:
   the pre-image is **not** a byte prefix of the post-image, because rows are inserted in **sorted
   order**. **Zero deletions in a unified diff does not mean append-only**, and the cheap version of
   this check (`git diff --numstat`, deletions == 0) would have passed all 13. This is why the
   implementation reads both blobs. The registry now records the path as `mutable` with the
   measurement written beside it; tightening the *producer* to a true append log is the follow-up.
2. **The byte budget was measuring the wrong quantity.** Blob size, not added bytes. `manifest.jsonl`
   is 5.6 MB and grows ~9 lines a tick, so a blob-size cap would have made every flush red or been
   set so high as to be meaningless. The unit is now **added bytes**.

---

## 9. Blast radius, and the residual risk stated plainly

**Where the path constraint lives, honestly labelled:**

| Layer | Mechanism | Is it enforcement? |
|---|---|---|
| Forge ruleset | — | **Nothing. Not expressible (§2).** |
| Lane code | reads the registry, refuses to push on violation | **No.** Code that decides not to act is a policy the same code can be changed to ignore. |
| Push-time hook | `pre-receive` running the predicate | **Yes — and unavailable on GitHub.** The sovereign-mode answer. |
| Post-hoc audit | this document's deliverable | **No — detection, not prevention.** Bounded by its run interval. |
| Erasure floor | `Branch Safety` + classic protection, **zero bypass** | **Yes. The only real enforcement in the stack.** |

**So the residual risk, in one sentence:** anything that can authenticate as the heartbeat App can
append arbitrary content to `main` without any check running, and the only guarantees that survive
are that it cannot erase, rewrite, or merge, that the forge records the bypass, and that the audit
notices within one run interval.

Named consequences, not softened:

- **Detection latency is real.** Between a bad push and the next audit run, `main` carries unchecked
  content, and everything downstream — Pages, the drift fold, any agent that pulls — has consumed it.
  Running the audit on every push to `main` (one commit, ~110 ms) reduces this to minutes; it does
  not reduce it to zero, and it never can, because it is post-hoc by construction.
- **The audit's own liveness is unguarded here.** A drift check that silently stops running is the
  exact failure the forge-agnostic document measured (five days, 276 green runs, zero ticks). This
  design does **not** add the receipt mechanism that would catch it. That gap is inherited, named,
  and open.
- **Widening the registry is the soft spot.** `paths.allow` is a PR-gated file, so widening it goes
  through review — but it is *one file*, and a plausible-looking added row is the cheapest way to
  turn this design off. The `deny` list is the second lock precisely for that reason.
- **Self-attestation is self-attestation.** §5c is the honest statement and it does not improve with
  restating.

---

## 10. Forge-agnosticism — and why a direct push is the *less* coupled option

Worth making explicit, because the instinct runs the other way — a bypass actor *sounds* like deeper
GitHub entanglement:

| | PR route (today) | Direct push (proposed) |
|---|---|---|
| Git operations | clone, push to staging ref | clone, **push** |
| Forge API calls | `POST /pulls`, `PATCH` refs, `gh pr merge --auto`, `compare`, `gh api user`, plus GraphQL `enablePullRequestAutoMerge` | **none** |
| Requires a human-owned PAT | **yes** (Actions may not open PRs) | no |
| Portable to GitLab / Gitea / a bare remote | needs a per-forge PR adapter | **`git push` — universal** |
| Verification substrate | a forge-specific check-run rendezvous | a **commit trailer** — travels in the object |

**A direct push is the most forge-agnostic operation git has.** Everything GitHub-specific in the
current lane exists to construct a pull request; removing the PR removes the coupling rather than
adding to it. The attestation lives in the commit object, so it survives `git clone` to a bare remote
with no forge at all — which is exactly `clone-at-tag-stays-sufficient`'s requirement, and exactly the
git-native evidence substrate `docs/DECISIONS/2026-05-29-git-native-event-store-spec.md` already
ratified.

The one GitHub-shaped part is the bypass actor itself, and it is **corporate-mode plumbing that
sovereign mode deletes entirely**: on a remote we control there is no `required_status_checks` to
bypass, and the `pre-receive` hook enforces (actor × path × operation) directly — turning the audit of
§8 from post-hoc detection into push-time prevention **with no change to the checks themselves**,
because they are already plain TypeScript over a git diff. The registry, the check set, and the
attestation format all port unchanged. **Only the hole ports away, because sovereign mode has nothing
to make a hole in.**

---

## 11. What this does NOT solve

1. **The other four mechanical lanes.** Society, drift, metrics, and the archive lane are ~75% of
   `main`'s volume against the heartbeat lane's 10%. The mechanism generalises (§8c measures it) but
   this design covers one lane.
2. **Per-lane registries.** `paths.allow` is currently one flat list. Four lanes with genuinely
   different path sets want four scoped rosters, or the union becomes everyone's blast radius —
   which would quietly undo the containment.
3. **`commit_message_pattern` as a push-time predicate.** The strongest available hardening (§2), and
   it collides with the blockless-maintenance-commit rule. Needs its own analysis.
4. **Actuator receipts.** Nothing proves the lane's five checks *ran*. The `DriftReceipt` interface
   sketched in the forge-agnostic document §3d is the answer and is not built.
5. **`workitems/**` classification.** The drift lane writes governance artifacts, not telemetry.
   Whether a PR-free lane may file a work item is a real question this document does not settle.
6. **The 1,631 orphaned `heartbeat/*` refs.** A PR-free lane makes flush *snapshots* unnecessary,
   which may make this problem disappear rather than need solving. Unverified.
7. **The stale governance surface.** `docs/operations/branch-protection-lfg-main.json` disagrees with
   live on whether `main` requires squash merges and thread resolution (§3). Not this document's
   change to make.
8. **Backlog row `081KSKBP80008QG0R001KK9WV6.2`** — *"Branch protection rule: path-scoped carve-out
   for `docs/agent-heartbeats/**`"* — is **not implementable as written**, and has been open since
   2026-05-27. Section 2 is the answer to it; the row should be closed as superseded rather than
   left looking merely undone. (The same row's parent also assumed heartbeats live in
   `docs/agent-heartbeats/`; measured, that folder holds **9 files, all from 2026-05-27**, and the
   live payload is `docs/observe-events/`, 5,464 files.)

---

## 12. Recommendation

**Yes — the bypass is the right call, and it is safer than it sounds because the erasure floor is a
different ruleset with no bypass at all. But not in one step, and not on the day the audit lands.**

The sequencing rule from `docs/DECISIONS/2026-07-09-*` applies directly — *removing the gate before
the replacement exists leaves neither* — and the five-day ledger outage is what the violation of it
looks like. So:

| Step | Action | Ruleset change? | Reversible? |
|---|---|---|---|
| **1** | Land the audit + registry, **wired into `cross-verify`** (this PR — both steps observed `success` on run 32822527654). Armed, green, cutover in the future. | **no** | trivially |
| **2** | Teach the *existing* PR lane to write the attestation, and run the five checks before it flushes. **The attestation is proven on the current route, where the gate still catches anything it gets wrong.** | **no** | trivially |
| **3** | Create the App, install it `contents: write`, environment-scope its key, and have it push to a **throwaway branch** to prove the identity and the check set end to end. | **no** | trivially |
| **4** | Add the bypass actor (§7), move `cutoverIso` to now, point `laneIdentities` at the App. | **yes** | one `PUT`, snapshot in hand |

Steps 1–3 need no ruleset change and no consent path, and they are where every remaining unknown
gets resolved. Step 4 is then a one-field change against a lane that has already been running
correctly for however long you want to watch it.

**The one thing I would not do** is open the bypass while step 2 is unproven. Not because the bypass
is dangerous in itself — §3 bounds it well — but because an attestation nobody has ever seen fail is
indistinguishable from an attestation that cannot fail, and this repository knows exactly what that
is worth.

---

## Pointers

- `src/Core.TypeScript/hygiene/audit-heartbeat-lane-attestations.ts` (+ `.test.ts`) — the falsifier
- `registry/heartbeat-lane-allowlist.json` — the blast radius, as data
- `docs/research/2026-08-18-forge-agnostic-drift-checks-the-gate-that-ate-the-ledger-and-what-already-exists.md`
  — the direct precursor; §2 the outage, §3d receipts, §4a the predicate/rendezvous split, §4c which
  names "a path-scoped bypass actor" as one of two routes and defers it for want of a consent path.
  **This document is that route, now that the consent exists.**
- `docs/design/2026-08-13-agent-verified-merge-replacing-prs.md` — verifier ≠ author (§6)
- `docs/DECISIONS/2026-07-09-drift-and-heal-replaces-pre-merge-gates-reconciliation-at-ai-speed.md`
  — the ratified flip and the sequencing rule (§12)
- `docs/DECISIONS/2026-05-29-git-native-event-store-spec.md` — the forge-neutral evidence substrate
- `src/Core.TypeScript/forge-host/github/flush-via-staging.ts` — the route this replaces; its header
  is the best statement of why the current one exists
- `src/Core.TypeScript/hygiene/agencysignature-block.ts` — the copied-vs-earned limit (§5c)
- `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` — *hubs are enforced, oracles are
  chosen*; `gate (required)` is the repository's last mandatory locus of deference on the write path
- `registry/uncompensatable-floor.yaml` — the erasure-class reasoning §3 leans on
