# Rehearsing the repo split in reverse — what "irreversible" measures as once you test it

**Date:** 2026-08-26
**Author:** shadow (autonomous tick)
**Subject:** `docs/DECISIONS/2026-08-26-multi-repo-and-hat-credential-cutover-sequence.md` (PR #15627, **open** at time of writing) — its S6 / S7 / S9 markings
**Authorisation:** Aaron 2026-08-26: *"yes you can make this reversable by testing it out multiple times in isolation and discovering the reverse commands."*

---

## 0. The claim under test

The cutover doc draws an **irreversible line** and puts S6 (create the repo), S7 (move the
content) and S9 (revoke the PATs) below it. That marking was an **assertion nobody had
tested**. This document replaces the assertion with a measurement wherever a measurement was
reachable, and says plainly where it was not.

**Headline result:**

| step | doc's marking | measured verdict |
|---|---|---|
| **S6** create `zeta-formal` | **IRREVERSIBLE** | **downgraded — reversible-with-procedure**, minus a **name residue** that is genuinely permanent |
| **S7** move the content | **IRREVERSIBLE in practice** | **downgraded — reversible, byte-identically, 3/3 cycles.** The doc *understated* its own reverse |
| **S9** revoke the retired PATs | **IRREVERSIBLE** | **survives as genuinely irreversible.** Not rehearsed, and deliberately so |

**And one finding that outranks all three**, because it changes what the fleet can do today
rather than what the plan says:

> **The credential this fleet runs on cannot delete a repository.** The shared OAuth token
> carries `repo` + `admin:org` + `admin:enterprise` but **not `delete_repo`**. So an agent
> can *create* repos and cannot *destroy* them — the exact asymmetry that manufactures
> irreversibility. This was measured, not read off documentation.

---

## 1. Register

Per `toy-is-free-metered-must-be-earned`. Nothing below is promoted past what its evidence
carries.

| claim class | register |
|---|---|
| Every row in the reverse-command table marked **verified** | **metered** — executed against a live throwaway repo, exit codes read directly (never through a pipe), before/after state re-queried |
| The 33-check content round trip, 3 cycles | **metered**, and **non-vacuous** — a negative control (§4.2) proves the checks can fail |
| S6 / S7 verdicts | **metered** for the operations rehearsed; the name residue is **metered**, the fork/clone residue is **speculative** (see §5) |
| S9 verdict | **speculative** — *not rehearsed*. Reasoning only, and §6.3 says why testing it would have been wrong |
| Anything under "not tested" (§7) | **speculative**, explicitly |

`markdownlint` ignores `docs/research/2026-*-*.md`, so no lint result is quoted here — an
`rc=0` from it would be vacuous.

---

## 2. STEP ZERO — prove deletion works before creating anything beyond one

The rehearsal was designed to stop dead if deletion failed, because **creating repos you
cannot delete makes the split less reversible, not more** — it would have produced exactly
the debris the exercise exists to prevent.

### 2.1 The zero-cost probe first

Before creating anything, `DELETE` was issued against a **confirmed-nonexistent** repo to
read the route's scope metadata:

```
DELETE /repos/Lucent-Financial-Group/zzz-probe-nonexistent-DELETE-ME
  -> HTTP 404
  X-Accepted-Oauth-Scopes: repo          <- suggested the token would suffice
```

This was **misleading**, and worth recording as a trap: the 404 short-circuits before the
scope check, and the `X-Accepted-Oauth-Scopes` header on that response is route metadata that
does **not** list `delete_repo`. A probe that cannot reach the check tells you nothing about
the check. Reading it as a green light would have been the vacuity class exactly.

### 2.2 The real test — one repo, created and immediately attacked

```
POST /orgs/Lucent-Financial-Group/repos  name=zzz-rehearsal-5f25a8-DELETE-ME
  -> 201, id 1347375084

DELETE /repos/Lucent-Financial-Group/zzz-rehearsal-5f25a8-DELETE-ME
  -> HTTP 403
     {"message":"Must have admin rights to Repository.", "status":"403"}
```

### 2.3 Falsifying the error message

The message says admin rights are missing. **They are not** — measured on the same repo, one
second later:

```
GET /repos/.../zzz-rehearsal-5f25a8-DELETE-ME
  -> "permissions": {"admin": true, "maintain": true, "push": true, ...}
```

`gh` itself supplies the true cause:

```
HTTP 403: Must have admin rights to Repository.
This API operation needs the "delete_repo" scope.
```

So: **org owner (`role: admin`, verified via `/orgs/.../memberships/AceHack`), repo admin
`true`, org policy `members_can_delete_repositories: true` — and deletion still refused,
purely on OAuth scope.** GitHub's 403 text names the wrong cause. An operator trusting that
message would go hunting for a permissions problem that does not exist.

**This pattern repeated independently** (§3.6): modifying a GitHub App installation returned
*"You do not have permission to modify this app … Please contact an Organization Owner"* —
to the org owner. Both messages describe a **role** problem when the real constraint is
**credential type / scope**. Worth carrying as a standing caution: on GitHub, a 403's prose is
not evidence about which of role-vs-credential is at fault.

### 2.4 What this cost, and what it bought

Per the stop rule, **exactly one repo was created and no more.** It could not be deleted, so
it became the test bed for everything in §3 — which is why §3 exists at all. One orphan bought
the entire platform-state half of the table. Twelve would have bought nothing extra and left
debris.

**No alternate credential exists.** Checked, not assumed: of eleven App installations on the
org, only `grok-by-xai` and `manus-connector` hold `administration: write`, and both are
third-party vendors whose private keys we do not hold. Our own `zeta-society-heartbeat` App
has `permissions: {actions: write, metadata: read}` — no administration permission at all.

### 2.5 The one thing that was NOT done, on purpose

`gh auth refresh -h github.com -s delete_repo` would fix this in one command.

**It was not run, and must not be run by an agent.** Adding a scope to Aaron's shared
credential is *extending* authority, not inheriting it — the precise move
[`no-directives.md`](../../.claude/rules/no-directives.md) forbids the shadow: *"can **inherit**
authorization … never **extend** it."* A credential-scope increase is a gated class. It is also
interactive (device flow), so it is Aaron's action in both senses.

---

## 3. The reverse-command table

Every row executed against `Lucent-Financial-Group/zzz-rehearsal-5f25a8-DELETE-ME`. "Verified"
means the *post-state was re-queried and matched*, not that the command exited 0.

| # | forward | reverse | verified? | notes |
|---|---|---|---|---|
| 1 | `POST /orgs/{org}/repos` | `DELETE /repos/{o}/{r}` | **NO — BLOCKED** | 403, missing `delete_repo`. §2 |
| 2 | *(as above)* | `POST /repos/{o}/{r}/transfer` — **transfer out of the org** | **VERIFIED** | The workaround. §3.1 |
| 3 | `PATCH archived=true` | `PATCH archived=false` | **VERIFIED** | `false → true → false`. §3.2 |
| 4 | `PATCH name=B` | `PATCH name=A` | **VERIFIED, with a delay** | 422 if immediate; clean at +15 s. §3.3 |
| 5 | `POST /repos/{o}/{r}/rulesets` | `DELETE /repos/{o}/{r}/rulesets/{id}` | **VERIFIED** | count `0 → 1 → 0` |
| 6 | `PUT /branches/main/protection` | `DELETE /branches/main/protection` | **VERIFIED** | absent → applied → absent |
| 7 | `gh secret set` | `DELETE /actions/secrets/{name}` | **VERIFIED (removal only)** | **value is NOT recoverable.** §3.4 |
| 8 | `POST /actions/variables` | `DELETE /actions/variables/{name}` | **VERIFIED (fully)** | value *is* readable back |
| 9 | `gh pr create` | `gh pr close` | **VERIFIED** | and `gh pr reopen` restores it |
| 10 | `gh pr create` | *delete the PR* | **NO — IMPOSSIBLE** | no API accepts a PR node. §3.5 |
| 11 | `gh issue create` | GraphQL `deleteIssue` | **VERIFIED** | but the **number is consumed**. §3.5 |
| 12 | add repo to App installation | remove repo from installation | **NO — BLOCKED** | credential type. §3.6 |
| 13 | `git push` content in | `git revert` / `git checkout {sha} --` | **VERIFIED ×3** | byte-identical. §4 |

### 3.1 Transfer is the reverse that survives a missing `delete_repo`

The most operationally useful discovery. Measured, both directions:

```
POST /repos/Lucent-Financial-Group/zzz-.../transfer  new_owner=AceHack
  -> completed within 10 s, NO acceptance step required
POST /repos/AceHack/zzz-.../transfer  new_owner=Lucent-Financial-Group
  -> completed, repo back in the org
```

**Why this matters for S6.** The doc treats "the repo now exists" as terminal. It is not: a
repo created in error can be **moved out of the org entirely** with a credential that cannot
delete it. That does not erase the repo, and it does not free the name (§3.3) — but it fully
reverses the *org-side footprint*, which is most of what S6's blast radius actually is.

Transfer is asynchronous. The `POST` returns the repository object with its **pre-transfer**
`full_name`, which reads like a no-op. Poll for the new location; do not trust the response
body.

### 3.2 Archive round-trips — and is not the write freeze it looks like

`archived: false → true → false` via `PATCH`, both directions clean. S6's suggested partial
reverse ("archive the repo") is itself reversible.

**Unexpected, and worth flagging:** while the repo was archived, this succeeded —

```
POST /repos/{o}/{r}/actions/variables  name=WHILE_ARCHIVED2  -> exit 0
```

Archiving blocks pushes and issue/PR activity, but it did **not** block an Actions-variable
write. So "archive it to freeze it" is not a sound safety story for the whole repo surface.
*(First measurement of this was botched — I read the exit code through a pipe and got an empty
string. Re-run reading the code directly. Recorded because the botched form is the one that
silently reports success.)*

### 3.3 Rename reverses, but names are never freed

`A → B` succeeded; `B → A` **immediately after** failed:

```
422 "A conflicting repository operation is still in progress, orchestration in progress ..."
```

Retried on a 15 s interval: **clean on the first retry (+15 s).** So rename reversal needs a
settle window, and an operator who reads the 422 as "reversal refused" will wrongly conclude
the rename is one-way.

**But the name is not recovered by any of this.** After `A → B → A` *and* a transfer out and
back, all three historical paths still resolve:

```
git ls-remote .../zzz-rehearsal-5f25a8-DELETE-ME.git          -> 26fd5acf... refs/heads/main
git ls-remote .../zzz-rehearsal-5f25a8-renamed-DELETE-ME.git  -> 26fd5acf... refs/heads/main
git ls-remote AceHack/zzz-rehearsal-5f25a8-DELETE-ME.git      -> 26fd5acf... refs/heads/main
```

Every name the repo has ever held becomes a **permanent redirect**. This is the measured core
of S6's "the name is spent" — and the doc is **right** about it.

Note the same three lines also prove the **content survived rename ×2 and transfer ×2 with an
identical SHA** — platform-level churn does not perturb git objects.

### 3.4 Secrets are removable but not recoverable — an asymmetry

```
GET /repos/{o}/{r}/actions/secrets/REHEARSAL_TOKEN
  -> {"name":"REHEARSAL_TOKEN","created_at":...,"updated_at":...}   <- no value field, by design
```

Deletion is verified. **Restoration is not possible from GitHub** — the value is write-only.
So "reverse the secret" means *re-supplying it from the vault*, and a secret that exists
**only** on GitHub has no reverse at all. Variables, by contrast, round-trip completely
(`value` is readable).

This is the S9 shape appearing early, in miniature: **the reversibility of a credential
operation is a property of where the credential is escrowed, not of the API.**

### 3.5 PRs cannot be deleted; issues can; neither number is reclaimed

```
deleteIssue(issueId: I_kwDO...)   -> {"deleteIssue":{"clientMutationId":null}}   SUCCESS
deleteIssue(issueId: PR_kwDO...)  -> NOT_FOUND "Could not resolve to Issue node"  REFUSED
```

And the numbering is monotonic regardless:

- closed PR **#1** → next PR got **#2** (not reused)
- deleted issue **#3** → next issue got **#4** (not reused); `GET issues/3` now returns
  **`"This issue was deleted"`** — a permanent tombstone

Issues and PRs share **one** counter, so a deleted issue still consumes a PR number.

### 3.6 App installation scoping could not be exercised at all

```
GET  /user/installations/{id}/repositories -> 403 "must authenticate with ... a GitHub App,
                                                   a personal access token, or basic auth"
PUT  /user/installations/{id}/repositories/{repo_id}
     -> 403 "You do not have permission to modify this app ... contact an Organization Owner"
```

Issued **by an Organization Owner**. The blocker is that a `gho_` OAuth token is not accepted
on these routes at all; a PAT or an App user-token is required.

**This has a direct consequence for the cutover plan that has nothing to do with reversal:**
S1 and S3 move lanes onto App credentials and rely on per-repo installation scoping. **That
scoping cannot currently be applied, inspected, or reversed with the credential the fleet
holds.** It is an unmeasured dependency sitting *above* the irreversible line, in the steps
the doc calls "reversible".

---

## 4. The content round trip — S7, three cycles

### 4.1 Method

Subject: the real `zeta-formal` shape from a 300-commit shallow clone of Zeta —
`src/Core.Lean4`, `src/Core.Lean4.Cslib`, `src/Core.TLA`, `tools/tla` (**163 files, ~5.4 MB**,
2 toolchains, 0 external packages). Nothing touched Zeta itself; the clone is a read.

Verification is **git object identity**, not file comparison. A tree hash is a content
address, so equal tree ids mean byte-identical content **and** modes. Each cycle ran, on a
fresh copy:

1. create the destination (bare repo, standing in for the GitHub repo)
2. extract the four prefixes → commit → compare subtree object ids to the source
3. push, then **clone the destination back** and re-compare
4. **the destructive half:** `git rm -r` the four prefixes from the source, commit
5. **the reverse:** `git revert` the deletion — compare subtree ids *and* the whole-repo tree
6. an alternative reverse: `git checkout {base} -- {paths}`
7. **close the loop:** re-extract from the *restored* source into a *fresh* destination
8. `git subtree split --prefix=src/Core.TLA` (history-preserving variant)

`git subtree` is a built-in; `git-filter-repo` is **not installed**, and was not required —
which incidentally keeps this procedure compatible with
[`clone-at-tag-stays-sufficient`](../../.claude/rules/clone-at-tag-stays-sufficient.md).

### 4.2 Results

**3 cycles × 11 checks = 33 checks, 0 failures.** Every identity check compared identical
hashes, including:

- `S7.extract-byte-identical` — 3/3
- `S7.clone-back-identical` — 3/3
- `S7.reverse-byte-identical` — 3/3
- `S7.reverse-whole-tree-identical` — 3/3 (whole repo tree `0487d493…`, not just the subject)
- `S7.reverse-checkout-whole-tree-identical` — 3/3
- `S7.roundtrip-closed-identical` — 3/3
- `S7.subtree-split-tree-identical` — 3/3 (`d57e62a1…`)

**The negative control, because 33/33 PASS is worthless if the checks cannot fail.** One byte
(`X`) was appended to one file (`src/Core.TLA/specs/AsyncStreamEnumerator.cfg`) in a restored
tree:

```
[PASS] subtree fingerprint DETECTED the 1-byte change
[PASS] whole-tree hash  DETECTED the 1-byte change
origin_sum=3e056853f4e42f...  mutant_sum=de7ecda324e335...
```

The checks are falsifiers, not decoration.

### 4.3 The first run failed, and the failure was the harness

Worth recording rather than quietly fixing. Run 1 showed `S7.clone-back-identical` **FAIL in
all three cycles** — deterministic, which is what made it look real. Diagnosis: `git init
--bare` sets `HEAD → refs/heads/master` while the push created `main`, so the clone checked
out a branch with no commits, and my fingerprint helper printed `rev-parse`'s *error text*
instead of `MISSING`. Two defects, both mine, both in the *measuring instrument*.

Fixed (`init --bare -b main`, `rev-parse --verify -q`) and re-run clean. **The lesson
generalises to S6's own falsifier:** a destination repo whose default branch does not match
the branch you pushed produces an **empty clone** — and S6's stated proof of success is
*"`git clone` at a tag … then `install.sh`, then its own gate green."* A default-branch
mismatch would make that check fail for a reason having nothing to do with the split. Set the
default branch explicitly at creation.

### 4.4 What S7's reverse actually is

The doc says:

> *"`git revert` restores the files to `Zeta`; the commits in `zeta-formal` remain. Two
> histories now exist for the same content — recoverable, not clean."*

**Measured: correct, and understated.** `git revert` did not merely make the content
"recoverable" — it returned the **entire repository tree to a byte-identical object id**,
3 times out of 3, verified against a mutation control. The residue the doc worries about is
real but is *history duplication*, not *content risk*: the same content exists in two
histories. That is a bookkeeping cost, not a loss, and DV2.0's raw-vault stance
([both branches held, neither collapsed](../../.claude/rules/dv2-data-split-discipline-activated.md))
says the duplicate history is a **fact to keep**, not damage to repair.

---

## 5. Confirmed unrecoverable — and the mitigation for each

Discovering which things *do not come back* was an explicit goal. Register is marked per row,
because some of these were measured and some were reasoned.

| # | not recoverable | register | mitigation |
|---|---|---|---|
| 1 | **Every name the repo ever held.** Rename and transfer both leave permanent redirects (§3.3) | **metered** | Choose the name once. Treat name selection as the actual gated decision in S6 |
| 2 | **A secret's value.** Removable, never readable back (§3.4) | **metered** | Escrow first: no secret exists only on GitHub. The vault is the source of truth, GitHub a projection |
| 3 | **PR numbers, and PRs themselves.** No deletion path exists; numbers never reused (§3.5) | **metered** | Nothing recovers them. Do not plan on a clean PR history in a repo used for rehearsal |
| 4 | **Issue numbers**, even after `deleteIssue` — tombstone persists (§3.5) | **metered** | As above |
| 5 | **Clones and forks taken during the window.** Anyone who cloned before the reversal keeps the content | **speculative** — not testable without a second party | Keep the window short; treat any published content as published. This is S6's honest core |
| 6 | **CI run history.** Repo-scoped; does not move with content | **speculative** — the throwaway ran no workflows | Export artifacts/logs before migrating if the history is load-bearing |
| 7 | **Stars / watchers / forks** | **speculative** — needs a third-party account | None. Accept, or do not migrate a repo that has them |
| 8 | **Package / registry publications** | **speculative** — not exercised | Do not publish from a repo whose existence is still provisional |
| 9 | **A revoked fine-grained PAT** (S9) | **speculative** — deliberately not tested, §6.3 | Overlap window; see §6.3 |

Rows 1–4 are the ones this rehearsal **converted from assumption to measurement**. Rows 5–9
remain reasoned, and are labelled so rather than being folded into the measured set.

---

## 6. Verdicts on the irreversible line

### 6.1 S6 — downgrade to *reversible-with-procedure*, minus a name residue

**Reverse procedure (verified except where noted):**

1. Revert the pin file and the scaffold-choice PR (ordinary PRs).
2. `DELETE /repos/{o}/{r}` — **requires `delete_repo`, which the fleet credential lacks.**
3. If (2) is unavailable: `POST /repos/{o}/{r}/transfer` to a holding account — **verified,
   ≤10 s, no acceptance step.** Removes the org-side footprint entirely.
4. `PATCH archived=true` as an interim freeze — **verified reversible**, but note §3.2: it is
   not a complete write freeze.

**What stays irreversible:** the **name** (permanent redirect, measured) and any clone taken
in the window (reasoned). Both are real. Neither is the *repository* — they are its shadow.

So S6's marking should read, in the doc's own register: **the org-side footprint is
reversible with a named procedure; the name is not.** That is a materially weaker claim than
"IRREVERSIBLE", and it is the one the evidence supports.

### 6.2 S7 — downgrade to *reversible*, byte-identically

33/33 identity checks across 3 cycles, with a mutation control proving non-vacuity. The
destructive half — removing content *from* the source, which rehearsing repo-creation never
touches — restores to an **identical whole-repo tree hash** by two independent routes
(`git revert`, `git checkout {sha} --`).

**S7 should not sit below the irreversible line.** Its residue (two histories for the same
content) is a duplication, not a loss.

### 6.3 S9 — survives as genuinely irreversible, and was deliberately not rehearsed

**No PAT was created, scoped, or revoked in this exercise.** Two reasons, and the second is
the binding one:

1. The doc's stated mechanism is independent of rehearsal: fine-grained PATs are **UI-only**,
   so no agent can restore one headlessly. Rehearsing revocation would confirm a fact already
   established by the platform's shape.
2. **They are Aaron's credentials.** Revoking a live PAT is not "testing in isolation" — the
   blast radius is the running fleet, and a credential is exactly the class where a rehearsal
   and the real thing are the same act. There is no isolated copy of a PAT.

**S9 stays below the line.** The available mitigation is not a reverse command but a
**sequencing** one, and the repo already has the pattern:
`docs/DECISIONS/2026-06-15-zero-downtime-id-rotation-pattern-overlap-window-dual-key.md` —
keep the old credential live through an overlap window, prove the replacement across a full
cadence cycle, and revoke only after. That makes the *transition* reversible even though the
*revocation* is not — which is the correct shape when the operation itself cannot be undone.

§3.4 is the same lesson measured at small scale: a secret's reversibility is a property of
**where it is escrowed**, not of the API.

---

## 7. Not tested — stated, not implied

- **Actual repo deletion.** Blocked on scope. Everything about deletion here is about its
  *absence*.
- **Creating a new repo at a redirected name.** Would have required a second repo; the
  step-zero rule forbade it.
- **App installation add/remove.** Blocked on credential type (§3.6).
- **Forks, stars, watchers.** Need a second account.
- **Package/GHCR publication and its reversal.** Not exercised.
- **Visibility transitions.** Deliberately skipped — a private→public step on a throwaway is
  a one-way information act, and rehearsing it would have been the mistake this document is
  about.
- **CI run history deletion.** The throwaway ran no workflows.
- **PAT revocation.** §6.3.

---

## 8. Disposition of the throwaway

**Created this session: exactly one.**

| repo | id | final location | state |
|---|---|---|---|
| `zzz-rehearsal-5f25a8-DELETE-ME` | `1347375084` | `AceHack/` (personal) | **cannot be deleted by any credential this fleet holds** |

Nothing else was created. Nothing not created by this session was deleted, renamed,
transferred, or modified. **`Lucent-Financial-Group/Zeta` was read only** — no writes, no
settings changes, no workflow runs.

Using §3.1's own finding, the repo was **transferred out of the org**, so the org now matches
**zero** on the `zzz-rehearsal-` prefix — confirmed two independent ways:

```
gh repo list Lucent-Financial-Group --limit 200 --json name | grep -c zzz-rehearsal  -> 0
gh api "/search/repositories?q=zzz-rehearsal+org:Lucent-Financial-Group"             -> total_count 0
```

That is the reversal procedure being used on its own rehearsal, which is the strongest
available evidence that §3.1 works. The one orphan now sits in the personal account carrying
`DELETE-ME` in its name. **Deleting it requires Aaron**, via either:

```bash
gh auth refresh -h github.com -s delete_repo   # interactive; then gh repo delete <path> --yes
```

or the repository settings UI.

---

## 9. What this exercise argues, beyond the three verdicts

**"Irreversible" was doing two different jobs in the cutover doc, and they came apart under
test.**

- For **S7** it meant *"we have not worked out the reverse"* — and the reverse turned out to
  be one built-in command with a byte-identical result. That marking was **untested
  reversal**, exactly as Aaron predicted.
- For **S6** it meant *"a name and its clones escape"* — true, measured, and permanent. But it
  had been attached to the whole step rather than to the residue, which over-charged a
  reversible act with the cost of its irreversible shadow.
- For **S9** it meant *"the credential cannot be re-minted"* — structurally true, and the fix
  is sequencing, not a command.

Three different things wearing one word. **The value of a rehearsal is not only the reverse
commands it finds; it is that it forces the word to resolve into which of the three it
meant.**

And the sharpest finding was not on the list at all: **the fleet's credential can create
repositories but cannot delete them.** That asymmetry does not describe a plan — it
*manufactures* irreversibility in every future step, silently, regardless of what any document
marks. A substrate that can only ever accumulate GitHub state is not reversible by
construction, and no amount of careful sequencing fixes it from the inside.

---

## Pointers

- `docs/DECISIONS/2026-08-26-multi-repo-and-hat-credential-cutover-sequence.md` — the S1–S9
  sequence this measures (PR #15627, open at time of writing)
- `docs/DECISIONS/2026-06-15-zero-downtime-id-rotation-pattern-overlap-window-dual-key.md` —
  the overlap-window pattern S9 should use instead of a reverse command
- `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md` — Stage 1, and the
  budget-projection precondition S6 still owes
- [`clone-at-tag-stays-sufficient.md`](../../.claude/rules/clone-at-tag-stays-sufficient.md) —
  §4.3's default-branch finding bites S6's clone-at-tag falsifier directly
- [`toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md)
  — the register discipline §1 applies
- [`no-directives.md`](../../.claude/rules/no-directives.md) — why §2.5's one-command fix is
  Aaron's to run and not the shadow's
- [`every-bug-has-economic-value.md`](../../.claude/rules/every-bug-has-economic-value.md) —
  the reducible uncertainty this rehearsal banked
