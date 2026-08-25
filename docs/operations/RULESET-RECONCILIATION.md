# Ruleset-as-code reconciliation

> **Carved sentence.** A repository's protection rulesets are **desired state
> committed in-tree**, converged by an automated reconciler that **diffs before
> it writes, verifies after it writes, and refuses to widen** without a
> content-hashed approval. Changing a protection is a reviewed PR to a JSON
> file — never a click in a settings UI, and never an unrecorded API call.

Owner: automated (`.github/workflows/ruleset-apply.yml`) · plan half rides
`.github/workflows/github-settings-drift.yml` · desired state lives under
`docs/operations/rulesets/<owner>/<repo>/`.

---

## 1. Why — the drift is measured, not hypothesised

The repo already had the *detect* half of settings-as-code and no *apply* half.
The predictable result is that the committed files describing desired state
drifted from reality, unnoticed, for months. Measured 2026-08-25 against
`Lucent-Financial-Group/Zeta`:

| committed file | last touched | what it claims | live |
|---|---|---|---|
| `docs/operations/branch-protection-lfg-main.json` | **2026-04-26** (4 months) | ruleset `15256879` carries `pull_request` (squash-only, `required_review_thread_resolution: true`), `copilot_code_review`, `code_quality`, `required_linear_history`, `deletion`, `non_fast_forward` | ruleset `15256879` has **`rules: []`** |
| `src/…/hygiene/github-settings.expected.json` → `rulesets` | **2026-06-20** (2 months) | `16134995` "CI Gate" is `enforcement: disabled` with **5** required checks (`build-and-test`, `lint (actionlint)`, `lint (markdownlint)`, `lint (semgrep)`, `lint (shellcheck)`) | `enforcement: **active**`, **1** check (`gate (required)`), and a bypass actor (`RepositoryRole` 5, `pull_request`) |
| same | | `16189060` "Branch Safety" has `deletion`, `non_fast_forward`, **`required_linear_history`** | `required_linear_history` is **gone** |
| same | | `16934633` "Heartbeat" targets **`refs/heads/agent-heartbeats`** with `deletion` + **`non_fast_forward`** | targets `refs/heads/heartbeat/*`, `deletion` only |
| same | | four rulesets | **five** — `19490341` "Code Quality Copilot review" (disabled) is absent from the snapshot entirely |

**Read the first row carefully, because it is the argument.** No live ruleset
carries a `pull_request` rule at all. Squash-only merges and required thread
resolution *are* still enforced on `main` — but by **classic branch protection**
(`required_conversation_resolution: true`, `required_linear_history: true`,
`enforce_admins: true`) and by the **repo-level merge settings**
(`allow_merge_commit: false`, `allow_rebase_merge: false`), not by the ruleset
the file names. The enforcement survived by a different mechanism while the
file kept describing the old one. That is the worst shape of drift: the
*outcome* still looks right, so nothing prompts anyone to notice that the
*control* moved and the record went stale.

There is also a second, hidden gap: **the expected snapshot does not capture
`bypass_actors` at all.** The single most safety-relevant field on a ruleset —
who is permitted to skip it — is invisible to the existing detector. The live
`CI Gate` bypass actor above could have been added at any time and no check
would have said a word.

### 1a. A live click-op happened during the writing of this document

At **2026-08-25T13:20Z** ruleset `16934633` read
`conditions.ref_name.exclude: []`. At **13:21:57Z** it read
`exclude: ["refs/heads/heartbeat/*-flush-*"]`, and the transient ref count began
falling (1637 → 1359 within ten minutes). The change was correct. It was also
**unversioned, unreviewed, unattributed, and unrevertable** — no diff, no PR, no
record of the prior state anywhere except this document, which captured it by
accident.

This is not offered as a criticism of whoever made it; under the pre-existing
arrangement there was no other way to make it. It is offered as the clearest
possible statement of the problem: **the most sensitive configuration surface in
the repository had no version control at all.** The pre-incident state is
preserved at
`docs/operations/rulesets/Lucent-Financial-Group/Zeta/rollback/16934633.prior-2026-08-25T13-20-00Z.json`,
which is now the only copy that exists.

---

## 2. The trigger: 1,612 undeletable refs, and the fix that would not have worked

Ruleset `16934633` globbed `refs/heads/heartbeat/*` with `rules: [deletion]`,
`bypass_actors: []`, and `current_user_can_bypass: "never"`. Repo admins do not
bypass an empty bypass list — a delete attempt on a fully-verified-safe branch
returned `HTTP 422 — Cannot delete this branch`. 1,612 legacy
`heartbeat/*-flush-*` snapshot refs were therefore undeletable by anyone.

The forward half was already fixed by PR #15309 (`SNAPSHOT_REF="heartbeat/$AGENT-flush"`
— one fixed ref per agent, force-updated in place), so no new snapshot refs are
minted. What remained was releasing the legacy ones.

### The near-miss worth recording

The obvious exclude pattern is **`refs/heads/*-flush-*`**. Measured against the
1,637 real ref names, it releases **zero refs**:

```
exclude refs/heads/*-flush-*            -> covered after  1637  released     0
exclude refs/heads/heartbeat/*-flush-*  -> covered after    25  released  1612
exclude refs/heads/**/*-flush-*         -> covered after    25  released  1612
```

GitHub matches ref names with Ruby's `File.fnmatch` under `File::FNM_PATHNAME`,
and the documentation is explicit: *"the `*` wildcard does not match directory
separators (`/`)."* So `refs/heads/*-flush-*` has three path segments and
`refs/heads/heartbeat/otto-flush-abc` has four. **The pattern matches nothing.**

Applied by a naive reconciler, it would have produced a green run, a clean
`PATCH` round-trip, a "successfully applied" log line, and **no behavioural
change whatsoever** — a check that did not run, wearing the costume of a fix.
The correct pattern is segment-anchored: **`refs/heads/heartbeat/*-flush-*`**,
which releases exactly 1,612 and keeps all 25 live lanes protected, including
the two new fixed refs `heartbeat/alexa-flush` and `heartbeat/soraya-flush`
(they end in `-flush`, with no trailing `-`, so `*-flush-*` cannot match them).

This is why the reconciler does not treat "GitHub stored the JSON I sent" as
verification. See §4.

---

## 3. Shape

```
docs/operations/rulesets/<owner>/<repo>/
  manifest.json                       # repo, default_branch, managed_ruleset_ids (ALLOWLIST)
  <id>-<slug>.json                    # desired state, canonical JSON, one per managed ruleset
  approvals/<id>.approval.json        # content-hashed authorisation for a WIDENING change
  rollback/<id>.prior-<stamp>.json    # pre-apply live state — re-apply to revert
```

- `src/Core.TypeScript/hygiene/ruleset-model.ts` — the **pure** half: glob
  semantics, canonicalisation, classification. No I/O, no clock, no network, so
  the entire safety argument is unit-testable (§7).
- `src/Core.TypeScript/hygiene/reconcile-rulesets.ts` — the CLI: plan, gate,
  apply, verify.

```bash
# read-only; this is the DEFAULT, so an accidental run does nothing
bun src/Core.TypeScript/hygiene/reconcile-rulesets.ts --repo Lucent-Financial-Group/Zeta

# converge
bun src/Core.TypeScript/hygiene/reconcile-rulesets.ts --repo … --apply
```

| exit | meaning |
|---|---|
| 0 | in sync (plan), or applied **and verified** (apply) |
| 1 | changes pending — a signal, not an error |
| 2 | tooling error **including "could not read live state"**. Never silently green: a check that did not run is not a check that passed. |
| 3 | **REFUSED** — ungated widening, or a structural violation |
| 4 | **APPLIED BUT VERIFICATION FAILED** — the loudest outcome |

**The reconciler never creates and never deletes a ruleset.** Both are out of
scope by construction, not by policy: there is no code path. A managed id that
is absent live is a refusal, not an implicit create.

---

## 4. The loop, and why each step is load-bearing

```
read live → normalise → diff → classify → gate → snapshot rollback → PATCH → RE-READ → verify
```

**Idempotent (requirement 1).** `normalizeRuleset` projects a ruleset onto its
*writable* fields and sorts rules, actors, and ref patterns ordinally, dropping
server bookkeeping (`node_id`, `created_at`, `updated_at`, `_links`, `source`,
`current_user_can_bypass`, per-rule `ruleset_id` echoes). Without that
projection every comparison would drift on GitHub's own metadata and no run
would ever be a no-op. With it, a re-run with no file change sends **zero**
`PATCH` calls and prints `NO-OP — live state already matches the committed
desired state`. Verified live: exit 0.

**Diff-before-apply, always logged.** The plan — verdict, every individual
change, and the coverage delta — is printed before anything is written, and the
apply workflow runs the plan as its own step so the diff lands in the run log
independently.

**Exit 4 leaves live MUTATED — read this before you need it.** A failed
verification does not auto-revert, deliberately: an automatic revert on a
disagreement the tool does not understand is one more unreviewed write in the
opposite direction, and it can loop. So on exit 4 the ruleset is in whatever
state GitHub actually stored, the run log carries `want:` and `got:` in full,
and the pre-apply snapshot is in `rollback/` and in the run's artifacts.
Recovery is manual and one step: re-apply the rollback file.

**Verify the write, not the request.** After `PATCH` the reconciler **re-reads**
the ruleset, re-normalises, and compares to intent. A mismatch is exit 4, the
loudest code in the set. The falsifier for this is a fake API that stores
something other than what it was sent; the test asserts `verified === false`.

**Verify the *meaning*, not just the bytes.** A round-tripped `PATCH` proves
GitHub stored your string; it does not prove the string means what you thought.
So when `conditions` change, the reconciler re-derives the actual covered-ref
sets from the live ref list on both sides and reports
`released` / `newly covered`. That is what makes the §2 near-miss visible: the
naive pattern reports `released 0`.

**Rollback (requirement 5).** Before any write the pre-apply live state is
written to `rollback/<id>.prior-<stamp>.json`, and the write **fails closed** if
that snapshot cannot be created — an irreversible change is not an improvement
over an unmade one. Reverting is re-applying that file. Beyond the first apply,
git history of the desired-state file is itself the rollback log.

---

## 5. Refusing to widen (requirement 3) — the safety crux

A reconciler holding `administration: write` can remove every guard in the
repository. So every change is classified, and **the verdict of a change set is
the verdict of its loosest member**. Netting a bypass actor against an added
rule is precisely how a hole rides in on a fix.

**Widening** — the change reduces enforcement, or increases who escapes it:

| # | condition |
|---|---|
| W1 | `enforcement` moves down the ladder `active` → `evaluate` → `disabled` |
| W2 | a rule present live is **absent** in desired (rule removed) |
| W3 | a `bypass_actor` is **added**, or an existing one moves `pull_request` → `always` |
| W4 | a `conditions.ref_name.include` entry is **removed** (coverage lost) |
| W5 | a `conditions.ref_name.exclude` entry is **added** (refs carved out of coverage) |
| W6 | a `required_status_checks` context is **removed**; `strict_required_status_checks_policy` true→false; `do_not_enforce_on_create` false→true |
| W7 | `required_approving_review_count` **decreases**; any of `required_review_thread_resolution` / `require_code_owner_review` / `require_last_push_approval` / `dismiss_stale_reviews_on_push` goes true→false; `allowed_merge_methods` **gains** an entry |
| W8 | `target` changes, or any parameter change the classifier does not recognise — **fail-closed** |

**Tightening** is the mirror of each. **Neutral** is a rename. W8 is deliberate:
an unrecognised knob is treated as dangerous, so a future GitHub rule type
cannot slip a loosening past a classifier that predates it. The cost is that a
harmless new parameter needs an approval once; that is the right trade.

Note W5: **the heartbeat fix itself is a widening change.** It removes deletion
protection from 1,612 refs. The design does not carve an exception for the
change that motivated it.

### The gate

A widening change requires a committed
`approvals/<id>.approval.json` that satisfies **three independent** conditions —
all of them load-bearing:

```json
{
  "ruleset_id": 16934633,
  "desired_sha256": "<sha256 of the canonical desired JSON>",
  "expected_released_refs": 1612,
  "reason": "release transient pre-#15309 snapshot refs; lanes stay protected",
  "approved_by": "acehack",
  "approved_at": "2026-08-25T…Z"
}
```

1. **It exists.** No approval, no widening.
2. **It is bound by content hash to the exact desired state.** Editing the file
   after approval re-closes the gate. *An approval that survives an edit is not
   an approval, it is a licence* — and the repo's own rules already name
   scope-free exceptions as the failure. Without the hash, one approved
   widening would silently authorise every later one.
3. **It declares the exact number of refs that lose protection, and the number
   must match what the matcher computes.** This is the metered half. It turns
   "I approve this pattern" into "I approve releasing exactly 1,612 refs", and
   it is what catches a pattern meaning something other than intended — including
   the §2 pattern that means *nothing*, which arrives at the gate as
   `approval declares 1612 refs released, but this change actually releases 0`.

**There is no runtime `--allow-widening` flag, on purpose.** A CLI flag lives in
whoever invokes the tool; the approval lives in the reviewed tree. The human
control is PR review of a diff, which is what "no manual human intervention"
asks for — nobody clicks anything in a settings UI, and the automation still
cannot loosen a protection on its own.

### The allowlist

`manifest.json`'s `managed_ruleset_ids` is a second, independent boundary: the
reconciler refuses to touch any ruleset not listed, and refuses to run at all if
a desired-state file exists for an unlisted id (a file nothing applies
constrains nothing) or if a listed id has no file. Today it manages exactly
one ruleset, `16934633`. Widening the blast radius therefore means editing a
reviewed file, in a PR, on purpose.

---

## 6. The privilege question — stated plainly

**The blast radius is the whole repository's administration.** A credential with
`administration: write` can delete every ruleset, disable every branch
protection, add itself as a bypass actor, change merge settings, alter
visibility, and — for a fine-grained token — delete the repository. This is the
most dangerous scope in the repo, and the reconciler needs it to do its job.
There is no version of this work that does not create that credential.

**What actually constrains it:**

- the committed desired-state file — the reconciler applies *that*, reviewed in
  a PR, versioned, diffable, revertable;
- the manifest allowlist — one ruleset today;
- the widening gate — content-hashed and ref-count-metered;
- no create / no delete code path;
- the rollback snapshot, written before every mutation and retained 90 days;
- trigger separation — the credential is unreachable from any
  `pull_request`-triggered workflow (§3 of `ruleset-apply.yml` explains why the
  plan and apply halves are deliberately in different files);
- the audit trail — every apply is a workflow run with the plan in its log.

**What does NOT constrain it, and must not be claimed to:**

- **Nothing stops a compromised token from doing whatever it likes.** The
  in-tree file constrains the *reconciler*, not the *token*. An attacker holding
  the secret does not run `reconcile-rulesets.ts`; they call the API directly,
  and every safeguard above is bypassed in one request.
- **A PR that edits `reconcile-rulesets.ts` or `ruleset-model.ts` can subvert
  the gate.** The classifier is code in the same repo it protects. CODEOWNERS on
  the tool and the desired-state directory raises the cost; it does not remove
  the class.
- **The approval file is only as good as the review of the PR containing it.**
  A reviewer who does not read `expected_released_refs` gets no protection from
  it. The gate makes the number *visible and checked*; it cannot make it *read*.
- **`enforce_admins`-style self-protection does not apply.** A ruleset cannot
  protect itself from an administration-scoped token.

**Least-privilege recommendation — a GitHub App, not a user PAT.** A
fine-grained PAT inherits a human's identity, expires on their schedule, and is
revoked by touching their account. A GitHub App installed on **only this
repository**, with **`Administration: Read and write` and nothing else**, is
strictly better on five counts: it is not tied to a person; it is revocable
independently; it cannot reach the user's other org access; the workflow mints a
**short-lived (~1 h) installation token per run** via
`actions/create-github-app-token` rather than storing a long-lived credential;
and app installations are separately auditable. The residual is that the app's
private key is still a repository secret — see §8.

---

## 7. Falsifiers

`bun test src/Core.TypeScript/hygiene/ruleset-model.test.ts src/Core.TypeScript/hygiene/reconcile-rulesets.test.ts`
— 71 tests, no network (the GitHub seam is an injected interface). The ones that
carry the design:

- the naive `refs/heads/*-flush-*` releases **zero** refs; the segment-anchored
  pattern releases exactly the snapshot refs and keeps the `-flush` lanes;
- every W1–W8 condition classifies as `widening`, and a widening component
  **poisons** an otherwise-tightening change set;
- an approval whose `desired_sha256` no longer matches is **refused**;
- an approval declaring 1,612 releases against a computed 0 is **refused**;
- post-apply verification **fails** when live does not end up matching intent;
- a no-op plan sends **zero** `PATCH` calls, and applying twice sends exactly one;
- an unwritable rollback directory aborts **before** any `PATCH`;
- an unknown flag exits non-zero and writes nothing — with a **positive control**
  proving the fixture could have detected a write;
- a read failure is exit **2**, never a silent 0.

**Mutation-checked** with the repo's own catalogue (`mutation-runner.ts`
mutations applied to both sources): **6/6 and 3/3 killed, 0 survivors.** The
first run had 2 survivors and both were real gaps — a trailing `**` that must
consume all remaining segments, and an untested malformed-character-class
fail-closed arm. Both now have tests.

---

## 8. The one-time bootstrap the operator must perform

**Nothing below has been done.** No token, secret, app, or ruleset was created
or modified by this work — the desired-state file records live state exactly as
it already is, so the first reconciler run is a verified no-op. Perform these
once, in this order:

**Step 1 — create the GitHub App** (org `Lucent-Financial-Group`):
`Settings → Developer settings → GitHub Apps → New GitHub App`.
Name `zeta-ruleset-reconciler`; homepage anything; **uncheck Webhook Active**.
Repository permissions: **`Administration: Read and write`**, and **nothing
else** — no contents, no actions, no metadata beyond the mandatory read.
Then `Install App` → **Only select repositories** → `Lucent-Financial-Group/Zeta`.
Generate a private key and note the App ID.

**Step 2 — store the credentials as repository secrets:**

```bash
gh secret set RULESET_APP_ID   --repo Lucent-Financial-Group/Zeta --body '<app id>'
gh secret set RULESET_APP_KEY  --repo Lucent-Financial-Group/Zeta < /path/to/private-key.pem
```

**Step 3 — switch `ruleset-apply.yml` to mint a short-lived token.** The
workflow currently reads a `RULESET_ADMIN_TOKEN` secret so it is runnable
without an app; the app path is preferred and is a two-line change:

```yaml
      - id: apptoken
        uses: actions/create-github-app-token@<pinned-sha>  # v2
        with:
          app-id: ${{ secrets.RULESET_APP_ID }}
          private-key: ${{ secrets.RULESET_APP_KEY }}
      # …then in each step:  GH_TOKEN: ${{ steps.apptoken.outputs.token }}
```

**Step 4 (optional, for the plan half)** — a read-only credential so the weekly
plan is not permanently INDETERMINATE. `GITHUB_TOKEN` cannot read rulesets
(`administration` is not one of its scopes), which is the same limitation
`github-settings-drift.yml` has carried since it was written. Either install a
second app with `Administration: Read`, or reuse the app above:

```bash
gh secret set RULESET_READER_TOKEN --repo Lucent-Financial-Group/Zeta --body '<token>'
```

Until this exists the plan job reports
`ruleset plan INDETERMINATE — this check DID NOT RUN` rather than passing.

**Step 5 — CODEOWNERS.** Add to `.github/CODEOWNERS` so the gate's own code and
the desired state require the maintainer's review:

```
/docs/operations/rulesets/                            @acehack
/src/Core.TypeScript/hygiene/reconcile-rulesets.ts    @acehack
/src/Core.TypeScript/hygiene/ruleset-model.ts         @acehack
```

**Nothing else is required.** From then on, changing a protection is: edit the
JSON, open a PR, get it reviewed, merge. The workflow converges live and
verifies itself.

---

## 9. Residual risk that could not be removed

1. **A compromised `administration` credential defeats everything here.** Named
   in §6 and unavoidable; the mitigation is short-lived app tokens and a
   single-repo install, which shrink the window and the reach but not the
   ceiling.
2. **The classifier protects a repo it lives in.** A PR editing the classifier
   can widen the gate. CODEOWNERS raises the cost; nothing closes it.
3. **Approval quality is human.** The gate makes the released-ref count checked
   and visible; it cannot force a reviewer to look at it.
4. **Only one ruleset is managed.** The other four remain click-op surfaces
   covered by an advisory, admin-blind, currently-stale snapshot. Bringing them
   under management is a manifest edit plus a desired-state file each — but each
   addition also widens what the credential is pointed at, so it should be done
   deliberately rather than in one sweep.
5. **`bypass_actors` are still invisible to the weekly detector.** The
   reconciler classifies them for the ruleset it manages; `github-settings.expected.json`
   does not record them for any ruleset. That gap is named here and not fixed.
6. **The plan half is INDETERMINATE until step 4.** It reports that honestly
   rather than passing, but an honest "did not run" is still not coverage.
7. **Classic branch protection and repo-level merge settings are out of scope.**
   As §1 shows, they currently carry enforcement that the ruleset files claim —
   so a complete picture of "what protects `main`" still spans three surfaces,
   only one of which is now reconciled.
8. **`git` refs are not the only thing a ruleset covers.** Tag rulesets and
   org-level rulesets exist and are unmanaged.

---

## Pointers

- `src/Core.TypeScript/hygiene/ruleset-model.ts` · `reconcile-rulesets.ts` (+ tests)
- `.github/workflows/github-settings-drift.yml` (plan) · `.github/workflows/ruleset-apply.yml` (apply)
- `docs/operations/rulesets/Lucent-Financial-Group/Zeta/` — desired state, approvals, rollback
- `docs/GITHUB-SETTINGS.md` · `docs/FACTORY-HYGIENE.md` row #40 (the detect-only sibling) and #64
- PR #15309 — the forward fix (`heartbeat/$AGENT-flush`, one fixed ref per agent)
- **Anchors (Beacon):** Ruby `File::FNM_PATHNAME` / `File.fnmatch` — the matcher
  GitHub documents for ref names. Mark Burgess, *Computer Immunology* (LISA 1998)
  — convergent operators over declared desired state. The Kubernetes controller
  `observe → diff → act` loop — reconciliation as a levelled rather than
  edge-triggered operation, which is what makes re-running safe.
