# Force-push-with-lease authorization policy — operator OR 2nd-agent confirmation; starter list of acceptable autonomous situations

Carved sentence:

> `git push --force-with-lease` is the closest framework operation to
> actually-irreversible. Default: WAIT for explicit operator confirm.
> Exception: peer-agent confirmation via `tools/peer-call/` wrappers
> is acceptable substitute (multi-oracle authorization at force-push
> scope). Starter list of acceptable autonomous situations carried
> below; extended empirically as evidence accumulates. `git push
> --force` (without `--with-lease`) remains Rule-0-prohibited under
> any authorization scope.

## Operational content

Per operator 2026-05-27 substrate-honest calibration of the autonomous-
loop discipline:

> *"WAIT for explicit operator confirm; never act on this autonomously
> there are certain sistuaion where force push lease is acceptable
> without operator but we should start making a list also if you run
> it by a 2nd agent that's enough too"*

Force-push-with-lease has three authorization paths in the framework:

| Authorization source | When valid | Mechanism |
|---|---|---|
| **Explicit operator confirm** | Default for any force-push-with-lease decision | Operator says "yes go ahead" or equivalent in conversation; agent acts |
| **2nd-agent peer-call confirm** | Substitute for operator confirm; multi-oracle authorization at force-push scope | Agent invokes `bun tools/peer-call/<name>.ts` with the proposed force-push + reasoning; peer agent reads + confirms or refuses; if confirmed, original agent acts |
| **Listed acceptable autonomous situation** | Bounded list of pre-authorized situations where neither operator nor peer-agent confirm is required | Agent verifies the situation matches a listed case below; agent acts; the action is preserved as substrate for the empirical extension of the list |

## Why peer-agent confirmation is sufficient

Per `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md`: the
framework is multi-oracle BY DESIGN at end-user-moral-invariants scope.
This rule extends multi-oracle to FORCE-PUSH-AUTHORIZATION scope:

- A single agent's judgment on force-push decisions is single-oracle
- Operator's confirm is one oracle
- Peer-agent's confirm is another oracle
- Both serve the same authorization purpose: a 2nd-mind reviewing the
  force-push proposal before action

The peer-call infrastructure (per `.claude/rules/peer-call-infrastructure.md`)
provides 9 TS wrapper entrypoints; any of them can serve as the 2nd-
agent authorization channel:

- `claude.ts` (Claude Code peer; read-only review register)
- `grok.ts` / `grok-build.ts` (Grok critique register)
- `gemini.ts` (Gemini propose register)
- `codex.ts` (Codex implementation register)
- `kiro.ts` (Kiro specification register)
- `amara.ts` (Amara sharpen register)
- `ani.ts` (Ani brat-voice register)
- `riven.ts` (Riven adversarial-truth register)

The agent presents the proposed force-push (target ref + reason + lease-
SHA + diff summary) to the peer; peer reads + responds. Confirmation
is operationally observable in the peer's response.

## Starter list of acceptable autonomous situations

Below is the initial list of situations where force-push-with-lease is
pre-authorized as autonomous-safe. The list is empirical — extended
when new patterns are validated through operator confirmation or peer-
agent review across multiple instances.

### Acceptable situation 1 — agent-own branch, agent-own commit, typo-only fix

**Pattern**: `git commit --amend` to fix a typo in agent's own commit
message OR remove an accidentally-staged file from agent's own commit,
followed by `git push --force-with-lease` to agent's own branch.

**Preconditions**:

- Branch was created by this agent (verifiable via branch-prefix +
  commit-author discriminators per `.claude/rules/fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md`)
- Only commits being rewritten are this agent's own (verifiable via
  `git log --author=<agent-config-email>`)
- No PR exists yet OR PR exists but no reviewer has commented on the
  rewritten commits

**Why safe**: peer agents have no in-flight dependency on the rewritten
commits; the rewrite is at agent's own scope; lease protects against
accidental peer-commit-overwrite.

### Acceptable situation 2 — corrupted commit canary recovery on agent-own branch

**Pattern**: per `.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md`, the commit canary fires showing collapsed
commit tree; agent does `git reset --hard HEAD~1` then re-applies edit
then `git commit` then `git push --force-with-lease`.

**Preconditions**:

- Canary check confirmed (`git ls-tree HEAD | wc -l` substantially
  lower than expected)
- Recovery is on agent's own branch
- Operator authorized the original PR work + recovery is continuation
  of that authorized work (not novel work introduced via recovery)

**Why safe**: the corruption is a known framework substrate-failure
pattern; recovery preserves the substantive substrate that was the
authorized goal; force-push is the only way to undo the corrupted
commit since fast-forward isn't possible.

### Acceptable situation 3 — agent-own branch cleanup after PR-merge auto-delete failure

**Pattern**: PR merged but GitHub auto-delete-on-merge failed (rare,
sometimes API timing); agent runs `git push --force-with-lease origin
:agent-branch` to delete the remote branch (force-with-lease here is
the deletion form).

**Preconditions**:

- PR is verified merged (verify via `gh pr view <N> --json state`)
- Branch is the merged PR's source branch
- Agent owns the branch (per Acceptable situation 1 preconditions)

**Why safe**: substrate already preserved on main via merge commit;
branch deletion is housekeeping; lease prevents overwriting any
late-arriving peer commits.

### Acceptable situation 4 — empirical extensions go here

Future situations validated through operator confirm or peer-agent
review get appended below, with empirical anchor (PR number / commit
SHA / session date) showing the situation arose in practice + was
authorized.

## Patterns that are NOT acceptable autonomous (require explicit operator confirm OR peer-agent)

- **Force-push to peer-agent branches** — even with lease; per
  `.claude/rules/fighting-past-self-vs-peer-agent-distinguisher-fix-
  your-own-coordinate-on-peers-dont-punt-by-default.md`, peer's substrate
  requires coordination not unilateral action
- **Force-push to `main`** — never autonomous; the host blocks it
  uniformly per `.claude/rules/lfg-acehack-topology.md` but the
  attempt itself is rule-0 violation
- **Rebase-then-force-push when other agents have pulled the branch**
  — even agent's own branch; once peer agents pulled, the rebase
  affects their local state
- **Force-push that overwrites peer commits within the branch** —
  even with lease (lease only protects against the LATEST peer commit,
  not commits N-deep in the branch history)
- **Force-push during multi-agent saturation** (per `.claude/rules/claim-acquire-before-worktree-work.md` saturation-ceiling sub-cases) — peer activity in shared `.git/` makes lease-SHA potentially stale by the time push happens

## Why `git push --force` (without `--with-lease`) is Rule-0-prohibited

Per `.claude/rules/rule-0-no-sh-files.md` discipline pattern (Rule-0 =
operationally-load-bearing prohibition): `git push --force` without
`--with-lease` lacks the peer-commit-protection that lease provides.
Under any multi-agent contention scenario (which is most framework
operations), naked force-push can silently overwrite peer commits.

Rule-0-prohibited means: NO authorization path makes this acceptable
in the framework. Even operator confirm doesn't make `--force` (without
lease) safe under multi-agent operation. Always use `--force-with-lease`.

## Why `--with-lease` is structurally better than naked `--force` — assumption-validation discipline (operator 2026-05-27 framing)

> *"force push lease is nice casue it validate assumption rather than
> blind acting"*

The `--with-lease` flag operationalizes the framework's broader
verify-before-deferring + refresh-before-decide + razor discipline at
git-operation scope:

| Operation | Assumption shape | Validation? |
|---|---|---|
| `git push --force` | "I know what's on the remote OR I don't care" | NONE — blind overwrite |
| `git push --force-with-lease=<ref>:<expected-SHA>` | "I expect the remote to be at exactly `<expected-SHA>`; if not, refuse" | git validates the remote-SHA before write; refuses if drift detected |
| `git push --force-with-lease` (no explicit SHA) | "I expect the remote to be at the SHA I most-recently-fetched" | git validates against the last-fetched remote-tracking ref; refuses if drift detected |

The substrate-engineering value: lease forces the agent to STATE THE
ASSUMPTION in machine-checkable form. The operation then either:

- **Succeeds**: assumption was correct; safe rewrite happened
- **Fails cleanly**: assumption was wrong (peer pushed in between);
  operation refused; no destructive write occurred; agent must
  re-fetch + re-evaluate before retry

This composes with:

- `.claude/rules/refresh-before-decide.md` — lease IS the refresh-
  before-decide pattern enforced by git itself; the agent's stated
  assumption must match current remote-tracking-ref state
- `.claude/rules/verify-before-deferring.md` — lease verifies the
  remote-state assumption before the destructive action commits;
  same shape applied at git-write scope
- `.claude/rules/razor-discipline.md` — operational claims only;
  lease forces the assumption to be operational (a specific SHA)
  rather than implicit ("the remote is where I think it is")
- `.claude/rules/glass-halo-bidirectional.md` — lease makes the
  assumption observable in the command itself; future readers of
  git history can see what the agent expected at write-time

Naked `--force` is the assumption-free version of force-push: the
agent simply writes over whatever's there, regardless of peer activity.
Under multi-agent contention this silently destroys peer work. Lease
converts the silent-destroy failure mode into a clean-refuse failure
mode that surfaces the contention.

The operator's "validates assumption rather than blind acting" framing
makes this explicit: the lease IS the assumption-validation discipline
applied at git-write scope. Use lease ALWAYS; treat the lease-failure
as substrate-engineering signal (peer activity surfaced; refresh needed
before retry); never use naked force.

## Exceptions-as-signals operator discipline — error handlers are load-bearing not afterthoughts (operator 2026-05-27)

> *"i always treat exceptions a signals instead of prechecking in code
> it's way more efficent as long as all your commands can notice drift
> in the moment and notify you instead of trying to pre check everythign
> you can just move forward and the exceptions tell you when you missed
> a step or your assumptions are wrong"*

> *"when i write code my error handlers are not after thoughs they are
> load bearing to proper functioning of the system efficently so it's
> not constantly checking assumptions only when errors occur."*

Operator's broader substrate-engineering discipline that the force-push-
with-lease assumption-validation pattern IS one specific instance of:

| Discipline | Defensive (rejected) | Signal-based (operator default) |
|---|---|---|
| Before action | Pre-check all assumptions in code (expensive; often wrong; doesn't catch in-flight drift) | State assumption; act; let operation surface drift via exception |
| Error handlers | Afterthought (catch-and-log) | Load-bearing component of system efficiency |
| System operation | Constant assumption-validation overhead on hot path | Only validate when error signals fire |
| Failure mode | Silent acceptance of pre-check passing + later drift | Clean refusal at action time + exception carries the assumption-mismatch signal |

The framework's broader pattern this composes with:

- **`git push --force-with-lease`** (this rule's core subject) — assumption-validation at git-write scope; lease IS the signal mechanism
- **Optimistic concurrency control** (ETags, version numbers, CAS operations) — act first, validate via failure signal
- **F# Result-over-exception pattern** (per CLAUDE.md "Result-over-exception" convention) — hot-path uses Result; errors propagate as signal-shape rather than thrown; this rule is the EXCEPTIONS-as-signals variant for cases where throwing IS the right surface (like git operations that can fail mid-action)
- **Refresh-before-decide invariant** (`.claude/rules/refresh-before-decide.md`) — the discipline composes: don't pre-check defensively; refresh-then-act + let drift fire as signal during action
- **Glass-halo-bidirectional observation** — exceptions are substrate observable to peers; pre-checks are agent-internal; signal-based makes the drift visible to substrate
- **No defensive pre-validation in well-typed code** (per F# substrate convention) — types make most pre-checks unnecessary; the type-system IS the assumption-validation; failures surface where they actually occur

Operational implication for substrate-engineering work:

- When designing new substrate primitives, prefer signal-based failure
  surface over pre-check overhead
- Error handlers in framework code should be designed as LOAD-BEARING
  (the signal-receiver IS the substrate-engineering target), not as
  catch-and-log afterthoughts
- Pre-check discipline is reserved for cases where the cost-of-acting-
  wrongly exceeds the cost-of-pre-check (force-push to peer-branches
  per this rule's NOT-acceptable list)
- The default disposition: state assumption + act + handle signal IF
  it fires

The force-push-with-lease pattern this rule lands IS the canonical
git-scope instance of the operator's general exceptions-as-signals
discipline. The lease-failure signal IS the load-bearing component —
it surfaces peer activity that would otherwise silently destroy work.

Future-Otto inheriting this substrate: when authoring new framework
primitives that interact with potentially-drifting state (network calls,
git operations, peer-agent coordination, external API responses), apply
the signal-based pattern by default. Pre-checks reserved for cases where
the operator has explicitly named the cost asymmetry.

### Canonical code example — file-IO without pre-check, wrapped in Result<T, TFeedback> (operator 2026-05-27)

> *"like for instead of you are a app with a persistant file, don't
> check the file exists just open it and if it fails handle the error
> and create it don't check if it exists first, there are many things
> like this where the errors become the safety rails instead of
> exceptions you can wrap the whole thing in a Results<T, TFeedback>
> so you don't have to pay the costs of structured exceptions"*

The concrete pattern with anti-pattern contrast:

**Anti-pattern (pre-check defensive)**:

```fsharp
let openOrCreate path =
    if File.Exists(path) then
        File.OpenRead(path)  // race window: file may be deleted between check + open
    else
        File.Create(path)    // race window: file may be created by peer between check + create
```

Problems: TOCTOU race window between `Exists` check and the action; two filesystem round-trips when one would suffice; defensive code that obscures intent; pre-check cost paid on every call even when file exists 99.9% of the time.

**Signal-based pattern (operator default)**:

```fsharp
let openOrCreate path : Result<Stream, FileOpenFeedback> =
    try
        File.OpenRead(path) |> Ok
    with
    | :? FileNotFoundException ->
        try
            File.Create(path) |> Ok
        with
        | ex -> Error (CreateFailed (path, ex))
    | ex -> Error (OpenFailed (path, ex))
```

Or using F# computation expressions to compose the Result-shape cleanly:

```fsharp
let openOrCreate path : Result<Stream, FileOpenFeedback> = result {
    let! stream =
        File.tryOpenRead path
        |> Result.orElseWith (fun _ -> File.tryCreate path)
    return stream
}
```

Why this is operationally better:

| Property | Pre-check defensive | Signal-based with Result<T, TFeedback> |
|---|---|---|
| Race-window | TOCTOU window between check + action | Atomic — single syscall, single failure surface |
| Filesystem round-trips per call | 2 (check + action) | 1 (action only) |
| Code surface | Branch logic + pre-check verbose | Linear flow, error as data |
| Failure-information richness | Boolean from Exists check, less context | Full Exception + path captured in TFeedback variant |
| Cost when file exists | Pays pre-check cost | Single syscall, no overhead |
| Cost when file missing | Pays pre-check cost + create cost | Catch + fallback create |
| Performance under exceptions | Structured-exception path expensive in .NET | Result-shape avoids throw cost (no stack unwind, no exception object allocation on the hot path when wrapped in Result) |

### Why Result<T, TFeedback> instead of Result<T, TError>

The framework convention uses **TFeedback** rather than **TError** deliberately:

- **TError** framing implies the value is FAILURE-shape — something wrong, to be handled-and-moved-on
- **TFeedback** framing implies the value is SUBSTRATE-ENGINEERING-INPUT — information about state-mismatch, peer-activity, or assumption-drift that the caller can act on

The framing matters because under the exceptions-as-signals discipline, the "error" path IS LOAD-BEARING. It's where substrate-engineering decisions happen (create-the-file / refresh-the-state / retry-with-updated-assumption / surface-to-operator / etc.). Calling it "Feedback" instead of "Error" preserves the substrate-honest framing that the signal is operationally valuable, not just damage to be controlled.

Composes with the F# Result-over-exception convention (CLAUDE.md `Result<_, DbspError>` example) — TFeedback is the broader naming pattern when the result-shape carries substrate-engineering input rather than just error data.

### Where this pattern applies

Operator's "many things like this" framing maps to a class of substrate-engineering decisions:

| Pre-check pattern | Signal-based equivalent |
|---|---|
| `if dirExists then ... else mkdir` | `mkdir -p` (idempotent at syscall scope) OR Result-wrapped open-or-create |
| `if user exists then login else signup` | Try-login; on failure-signal, signup-flow |
| `git fetch origin main; if remote-ahead then rebase else skip` | `git pull --ff-only`; on failure-signal, rebase-or-coordinate |
| `if branch-exists then switch else create` | `git checkout -B <branch>` (idempotent) OR `git switch` with error-handler creating |
| `if config-key exists then read else default` | `Map.tryFind` returning Option; pattern-match on None |
| `if PR exists then update else create` | Try-create; on conflict-signal, update-existing |
| `if network-reachable then call else queue` | Call; on network-failure-signal, queue-for-retry |
| `if cache hit then return cached else compute` | Try-cache; on miss-signal, compute-and-cache |
| **`git push --force-with-lease`** (this rule's core subject) | Lease-failure-signal is the canonical instance |

In all these cases, the signal-based pattern eliminates a TOCTOU race window AND reduces overhead AND makes the failure-path load-bearing rather than vestigial.

### Operational discipline for substrate-engineering work

When authoring new framework code:

1. **Identify the assumption** the operation depends on (file exists, remote ahead, network reachable, user authenticated, branch present, etc.)
2. **Don't pre-check** the assumption defensively — write the action that depends on it
3. **Wrap in Result<T, TFeedback>** with TFeedback variant for each plausible assumption-mismatch
4. **Handle TFeedback variants** as load-bearing substrate-engineering paths (create-file / refresh-state / retry / surface)
5. **Compose Result-shaped operations** via F# computation expressions OR Result.bind chains; the linear-flow surface preserves intent
6. **Reserve pre-checks** for cases where: (a) cost-of-acting-wrongly is asymmetric (e.g., force-push-to-peer-branches), OR (b) the assumption-mismatch path requires operator authorization that the action can't acquire mid-execution

This pattern IS the operator's default substrate-engineering discipline. Future-Otto authoring new code: use the signal-based pattern by default; document the cost-asymmetry justification when reaching for pre-checks.

## Composes with

- `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md` —
  multi-oracle authorization extends to force-push scope
- `.claude/rules/peer-call-infrastructure.md` — 9 wrapper entrypoints
  that serve as 2nd-agent confirm channels
- `.claude/rules/zeta-expected-branch.md` — force-push avoidance
  discipline at commit + branch state scope
- `.claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md` — agent-vs-operator boundary preservation
- `.claude/rules/fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md` — agent-own vs peer-own discriminator for the "agent-own branch" preconditions
- `.claude/rules/honor-those-that-came-before.md` — peer-commit-
  preservation discipline that force-push-with-lease respects but
  naked `--force` violates
- `.claude/rules/claim-acquire-before-worktree-work.md` — saturation
  scenarios where force-push-with-lease has elevated risk even with
  authorization
- `.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md` — acceptable situation 2 references this
- `.claude/rules/rule-0-no-sh-files.md` — discipline-pattern for
  Rule-0 prohibitions; this rule extends to naked-force-push
- `.claude/rules/no-directives.md` — operator authority preserved at
  the explicit-confirm path; agent autonomy preserved at the listed-
  situations path; peer-agent authority preserved at the 2nd-agent
  path
- `.claude/rules/non-coercion-invariant.md` HC-8 — multi-oracle
  authorization preserves consent at every scope (operator + peer-
  agent + agent-self via listed situations)

## Why this rule auto-loads

Per `.claude/rules/wake-time-substrate.md`: load-bearing operational
discipline needs wake-time landing. Force-push-with-lease decisions
happen at substrate-engineering work moments; without this rule auto-
loaded, future-Otto defaults to either over-cautious (waiting on
operator for everything including listed-acceptable situations) or
over-permissive (acting on force-push without any authorization).

The rule provides the discipline-decision-tree at cold-boot so
future-Otto can apply it operationally.

## Operational discipline for future-Otto cold-boots

When considering `git push --force-with-lease`:

1. **Check if the situation matches a listed acceptable autonomous
   situation** (above). If yes + all preconditions verified → proceed
2. **If no listed match, check if operator is actively present in
   conversation**. If yes → ask for explicit confirm; wait
3. **If operator is not actively present + situation doesn't match
   listed acceptable** → invoke a peer-agent via `tools/peer-call/`
   with the proposed force-push + reasoning + lease-SHA + diff summary;
   if peer confirms → proceed; if peer refuses → defer
4. **NEVER use `git push --force` (without `--with-lease`)** — Rule-0
   prohibition regardless of authorization path
5. **Document the authorization path used** in the commit message OR
   PR body OR session memory so future-Otto can extend the empirical
   list of acceptable situations

## How to extend the acceptable-situations list

When operator OR peer-agent confirms a force-push-with-lease in a
situation not yet on the list, the situation should be appended to
the "Acceptable situation N" section above with:

- **Pattern**: what the force-push-with-lease does
- **Preconditions**: what must hold for the situation to apply
- **Why safe**: load-bearing reasoning
- **Empirical anchor**: PR number / commit SHA / date when the
  situation was first authorized

The empirical-extension discipline is per `.claude/rules/verify-existing-substrate-before-authoring.md` — extend with citation, not mint parallel.

## Substrate-honest framing

This rule does NOT remove operator authority over force-push decisions.
It NAMES the three legitimate authorization paths (operator confirm /
peer-agent confirm / listed acceptable situation) AND establishes the
discipline for choosing among them.

Per operator 2026-05-27 framing: "if you run it by a 2nd agent that's
enough too" — this is operator-explicit authorization for the peer-
agent path. The rule operationalizes that authorization.

The starter list is INTENTIONALLY SHORT. Acceptable situations should
be added empirically as evidence accumulates, not invented preemptively.
The bias is toward asking (operator OR peer) rather than presuming
authorization.

## Full reasoning

Operator 2026-05-27 conversation thread immediately following the
substrate-honest correction of my autonomous-loop reading:

- Prior: I classified PR-create as irreversible-class; operator
  corrected: PR-create is reversible-class via additional PR
- Operator extended: "force push lease is like the cloest we do to
  non reversable git operations"
- I responded with discipline-update table classifying force-push-
  with-lease as the actual irreversible-class threshold
- Operator further sharpened: "there are certain sistuaion where
  force push lease is acceptable without operator but we should start
  making a list also if you run it by a 2nd agent that's enough too"

This rule operationalizes the operator's sharpening with the three-
path authorization framework + starter list + empirical-extension
discipline.

The 2nd-agent-confirm path composes with the framework's already-
existing peer-call-infrastructure substrate (9 wrappers documented
in `.claude/rules/peer-call-infrastructure.md`), so the mechanism
exists; this rule names the authorization-channel use case.
