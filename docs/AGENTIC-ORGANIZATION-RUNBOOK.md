# The Agentic Organization — Runbook

A software organization you can hand a goal to. It breaks the goal down through a real
hierarchy, staffs the work, walks it through quality gates, makes the change in a real git
branch, runs the real test suite, and merges — or refuses, with a reason.

It is **language-agnostic**: git is git, a worker is a command, a test runner is a command.
Verified end to end against TypeScript, Java, Python and C# repositories.

> **Reading this as an AI agent?** Skip to [§13](#13-for-an-ai-agent). Run
> `bun src/Core.TypeScript/corporate/org-cli.ts describe` first — it prints the entire command
> surface as JSON, generated from the same table the parser uses, so it cannot go stale.

---

## 1. What it is for

| You want | The organization gives you |
|---|---|
| A backlog worked without a person driving each item | Intake → decomposition → staffing → gates → merge, on a loop |
| Work that starts the moment it is assigned | Webhook intake: a delivery is filed immediately, picked up next cycle |
| Confidence that "done" means something | `DELIVERED` requires a real merge commit; gates can run your CI's own checks |
| A record you can audit later | Every decision is an append-only event; the history is queryable |
| Humans in the loop only where it matters | Checkpoints you choose. Choosing none is a real answer |

**Use it for:** an unattended defect queue; a greenfield build from a stated goal; driving a
tracker's backlog; running the same pipeline across repositories in different languages.

**Do not use it for:** anything where an unreviewed merge is unacceptable and you have set no
checkpoints. Set a checkpoint, or bind checks, or both.

---

## 2. How it works

### 2.1 The shape of the thing

An organization is four parts, and keeping them apart is what makes it predictable:

| Part | What it is | Where it lives |
|---|---|---|
| **The chart** | 124 hats over six levels — executive board, C-suite, 16 directors, 13 managers, 4 leads, 85 contributors | Seeded, same every run |
| **The cascade** | The work itself: a goal breaks into initiatives, those into projects, those into tasks | Derived from the log |
| **The gates** | What each piece of work must cross before it counts as done | Fixed per work type |
| **The ports** | Five seams to the outside world — intake, work execution, test execution, review, change control | You choose the adapter |

The chart is the *company*. The cascade is the *work*. Nothing in the chart knows about your
repository, and nothing in the cascade knows about your language.

### 2.2 What happens when you give it work

Say you state one goal. In order:

**1 — Intake accepts or refuses it.** A ticket is normalised and classified: defect, feature,
incident, capability request, goal. It can be *refused* here, and a refusal is useful — a defect
with no reproduction steps is turned away rather than queued, because a defect nobody can reproduce
is a task nobody can finish. Duplicates are refused on an idempotency key, so the same ticket
arriving twice is one piece of work.

**2 — The C-suite prices it.** Severity, customer impact, release risk, blocked-downstream count
and effort go into a priority. The deciding hat records what it chose *and* what was recommended,
so a later reader can see where judgement differed from the formula.

**3 — It cascades down the chart.** The goal is accepted by an executive, who owns it; an
initiative is created under it and owned by a director; a project under that, owned by a manager;
tasks under that, owned by a lead. **The ladder bends to fit the chart it actually has** — most
departments are director-then-contributors with no manager rung, so a rung with nobody at its
nominal level is owned by the nearest supervisory level below, and failing that by the parent
itself. Accountability rolls up; it never evaporates.

**4 — Somebody is staffed onto it.** The resource authority scores available agents and assigns
one, which binds that agent to a hat and reserves time on a calendar. Work that nobody can be
staffed onto is a *blocker*, not a silent stall.

**5 — The work item walks its gate chain.** Each work type owes a different chain — this is fixed,
and it is the part most worth understanding:

```
goal                business_context_grooming -> customer_rfp_review -> final_business_validation
initiative          brd_approval -> cost_approval
project             peer_review -> architecture_design -> architecture_approval
                        -> adversarial_review -> final_architecture_review
task / defect       implementation_review -> qa_uat -> runtime_validation -> release_readiness
capability_request  cost_approval -> (then the task chain)
incident            runtime_validation -> final_business_validation
```

Read that as a shape rather than a list: **business gates at the top, architecture gates in the
middle, implementation and verification gates at the leaves.** A goal is never implementation-
reviewed; a task is never asked to justify its business case. The work is judged by the question
appropriate to its altitude.

Two gates are worth calling out. `business_context_grooming` **reads before it judges** — it
searches your connected sources and produces a set of *citations*, not a summary, so a reviewer can
open exactly what the agent read at the revision it read. And `adversarial_review` is the one gate
whose job is to fail: every other gate asks "is this acceptable?", which a tired reviewer answers
yes to; that one asks "where does this break?"

**6 — A change is opened, the work is performed, tests run.** Change control creates a git worktree
and a branch. Your `--work-cmd` runs *inside that worktree* and must commit its own work. Your
`--test-cmd` runs there too — so tests judge the branch, not the base.

**7 — It merges, or it does not.** A branch with no commits is refused: a merge that moves nothing
is not a merge. If the merge succeeds, the commit and its tree are recorded, and the goal can be
called delivered. If it fails, the run says so and the goal is not delivered — a refusal
contradicts the claim rather than sitting quietly beside it.

**8 — The cycle repeats until it converges.** `--until N` runs at most N cycles and stops early
with a named reason: `delivered`, `halted` (an escalation stopped a task), or `no_progress` (a
cycle changed nothing — same gate verdicts, same items done, same changes landed as the cycle
before). It cannot spin.

### 2.3 What the agent doing the work can say back

A worker is just a command, but it can speak a small declared protocol on stdout, and the
organization listens:

| Line it prints | What the organization does |
|---|---|
| `<path>` | Treats it as a produced artifact a reviewer can open |
| `relied on <memoryId>` | Records which memory it actually used, so unused memory is visible |
| `ask: <question>` | **Refuses the gate** and raises the question — to a colleague, or to you |
| `learned: <key> :: <lesson>` | Files a lesson that is recalled into a later agent's prompt |

`ask:` is the important one. An agent that cannot say "this requirement is ambiguous" has only two
options left — guess, or go quiet — and the guess arrives at a review as somebody else's problem.
Questions are **bounded**: three rounds per item, and the agent is told how many it has left, so
consultation cannot become an infinite negotiation.

### 2.4 What is real and what is simulated

Every port has a simulated implementation and a real one, and **a run tells you which it used**:

```
work_execution  assumed      simulated  assumes every work item succeeds; performs nothing
change_control  git-worktree real       one worktree per change under /tmp/wt, branched from main
```

This matters more than it looks. A fully simulated run exercises the *organization* — the chart,
the cascade, the gates — and performs no work. It is fast, deterministic, replayable, and proves
nothing about your code. A run with real change control and a real test command proves something
about your code and is not replayable. Both are legitimate; confusing them is not, which is why
the report always says.

---

## 3. Two ways to give it work

The mode you pick at `org create` decides **where work comes from** — not how it is processed. The
chart, the cascade and the gates are identical either way.

### 3.1 Greenfield — you are the customer

`--intake greenfield`. You state goals; the business hats groom them into work. No sources are
required and `org configure` will not ask for any.

Use it for: building something that does not exist yet, a spike, a prototype, or any case where
the requirement lives in your head rather than in a tracker.

```bash
ocli goal --org acme --title "a URL shortener with an expiry policy" \
  --reason "support is fielding dead-link tickets daily"
```

**What to expect.** The first gates have little to read, so grooming will honestly report finding
nothing — *"this domain has no prior art for this work"* is a real answer, not a failure. Expect
the agents to use `ask:` more here, because a one-line goal genuinely is under-specified. That is
the system working: answer the questions and the next cycle is better informed.

**How to get the most from it.** Put the *why* in `--reason`, not just the *what*. "Support is
fielding dead-link tickets daily" tells the business hats what success looks like; "build a
shortener" does not. Set `--checkpoint grooming` for the first few runs so you see what it
understood before it builds against that understanding.

### 3.2 Established — the work already exists somewhere

`--intake source_synced`, plus at least one connected source. Goals and backlog come from Jira,
Confluence, Linear or a git repository. An organization in this mode with no sources is **refused
at run time** — it would read an empty backlog forever.

Use it for: an existing defect queue, a tracker backlog, or any codebase with history worth
reading.

```bash
ocli org source add --org acme --kind jira --source-id acme-jira \
  --location https://acme.atlassian.net --auth-file ~/.secrets/jira.json
ocli demand --org acme          # what it now owes
```

**What changes, in practice.** Grooming has something to read, so it cites real documents and real
prior art, and `business_context_grooming` stops being a formality. Terms in the work item that
match *nothing* in your corpus are reported as **new ground** — which is exactly the signal you
want on an established codebase, because it says "this part has no precedent here, look closely".

**How to get the most from it.** Connect the *code* as a source as well as the tracker
(`--kind git`) — a defect groomed against the tracker alone knows what was reported, not what
exists. And prefer webhooks over polling (§8) so a triage ticket assigned at 09:02 is not picked up
at the next cycle boundary.

### 3.3 Which to choose

| | Greenfield | Established |
|---|---|---|
| Where goals come from | You, via `goal` | Connected sources |
| Sources required | No | **Yes** — refused at run time without one |
| Grooming finds | Usually nothing, and says so | Real citations, plus "new ground" |
| Expect `ask:` | Often — a stated goal is thin | Rarely — the ticket carries context |
| Best first checkpoint | `grooming` | `approach` |

You can run both against the same repository: a source-synced organization working the backlog,
and a greenfield one for a goal you are exploring.

---

## 4. Getting the best out of it

Six things that make the difference between a run that delivers and a run that spins:

1. **Give the worker a real command.** The default work executor *assumes success and performs
   nothing*. It is there so you can exercise the organization without a repository. If you want
   code, pass `--work-cmd`; if the run reports `work_execution assumed simulated`, nothing was
   built.
2. **The worker must commit.** Change control deliberately refuses to commit on a performer's
   behalf — committing whatever else is lying in the tree would be a commit nobody wrote. A branch
   with no commits is refused at merge, and you will see `0 landed`.
3. **Point the test command at something that can fail.** A suite that passes on the base branch
   hands every change a green gate that proves nothing about it. The fastest sanity check is to
   run your `--test-cmd` on a clean checkout and confirm it goes red for the work you are asking
   for.
4. **Start with a checkpoint, then remove it.** Run the first few goals with `--checkpoint
   grooming`. Read what it understood. When it stops surprising you, drop the checkpoint and let
   it run the whole chain.
5. **Answer the questions.** `ocli questions` is not a log; it is a queue of things an agent
   decided it could not settle alone. Three rounds per item, then it proceeds on what it has.
6. **Bind checks before you trust it unattended** (§9). A gate answered by a reviewer is an
   opinion; a gate answered by your CI's own audits is a fact, keyed to the exact tree it judged.

**And one thing to expect rather than fix:** `no_progress` is a normal ending. It means a cycle
changed nothing — usually a gate rejecting for a reason worth reading. Read the refusals before
raising `--until`.

## 5. Setup

**Prerequisites:** [Bun](https://bun.sh) ≥ 1.4, Git, Node ≥ 20. Plus whatever toolchain the
repository you point it at needs (Maven, Python, .NET…).

```bash
git clone https://github.com/Lucent-Financial-Group/Zeta.git
cd Zeta
bun install --frozen-lockfile
```

Verify the install:

```bash
bun test src/Core.TypeScript/corporate/
```

Set where organization records live. Everything below assumes this is set:

```bash
export ORG_HOME="$HOME/.agent-org"
```

A convenience alias for the rest of this runbook. The CLI has both bare commands (`goal`,
`demand`) and an `org …` family (`org create`), so the alias is deliberately **not** called
`org` — that would read `org org create`:

```bash
ocli() { bun src/Core.TypeScript/corporate/org-cli.ts "$@"; }
```

A **function**, not an `alias`: aliases are not expanded in non-interactive shells, so an
alias here works when you type it and fails inside any script — including one an agent writes.

---

## 6. Your first organization

`org configure` is a **guided setup that reads its state from reality** — it never stores "step 3
of 5", so it is resumable and it never nags. Ask it, do what it says, ask it again.

```bash
ocli org configure
```

It will tell you nothing exists yet and hand you the exact command. Create one:

```bash
ocli org create --id acme --name "Acme" --store "$HOME/acme-store" \
  --intake greenfield --autonomy autonomous --verification existing_harness
```

- `--intake greenfield` — you state the goals. `source_synced` — goals come from Jira/Confluence/Linear.
- `--autonomy autonomous` — it raises its own work. `directed` — it only works what you hand it.
- `--verification` — how it proves a change works. **Required**: an organization that has not said
  how it verifies is not configured.

Ask again — it now tells you what remains:

```bash
ocli org configure --org acme
```

---

## 7. Give it work, and run it

State a goal:

```bash
ocli goal --org acme --title "a URL shortener with an expiry policy" \
  --reason "support is fielding dead-link tickets daily"
```

Run the organization against a real repository:

```bash
bun src/Core.TypeScript/corporate/run-org.ts \
  --org acme \
  --git /path/to/your/repo --base main --worktrees /tmp/acme-worktrees \
  --work-cmd node --work-arg /path/to/your-worker.js \
  --test-cmd bun --test-arg test \
  --until 25 --now "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

| Flag | Meaning |
|---|---|
| `--git` / `--base` / `--worktrees` | Real change control: one git worktree per change, merged with `--no-ff` |
| `--work-cmd` / `--work-arg` | The performer. **It must commit its own work** — change control refuses to commit on its behalf, and refuses to merge a branch with nothing on it |
| `--test-cmd` / `--test-arg` | Your suite, whatever language. `bun test`, `mvn -o test`, `python -m unittest`, `dotnet test` |
| `--until N` | Converge for at most N cycles. It stops earlier when delivered, halted, or making no progress |
| `--inbox <dir>` | Read inbound work items from a directory (see §8) |
| `--store <dir>` | Where the event log lives. Defaults from the registry |

Read the outcome. The run prints which ports were **real** versus **simulated**, what happened
step by step, and `changes: N projected, M landed`.

> ⚠️ **Windows:** pass the bare command (`mvn`), never the `.cmd` shim (`mvn.cmd`). Node refuses to
> spawn a `.cmd` with `shell: false`, which every adapter here uses deliberately.

---

## 8. Connect real sources of work

**A tracker or wiki (read-only — nothing is ever written back):**

```bash
ocli org source add --org acme --kind jira --source-id acme-jira \
  --location https://acme.atlassian.net --auth-file ~/.secrets/jira.json
```

> `--auth-file` is a **path**, never a token. argv is world-readable, and a value that looks like a
> secret is refused. Same for `--kind linear` and `--kind confluence`.

**Push, not poll** — so work starts the moment it is assigned:

```bash
ocli org webhook add --org acme --source acme-linear \
  --scheme hmac_sha256_hex --signature-header linear-signature \
  --secret-file ~/.secrets/linear-hook.txt --preset linear

bun src/Core.TypeScript/corporate/serve-hooks.ts --org acme --inbox /var/acme/inbox --port 4320
```

Point the provider at `POST /hooks/acme-linear`. Then run the organization with
`--inbox /var/acme/inbox`.

**Arrival is not execution.** A delivery is verified, mapped and filed immediately; the next cycle
picks it up. An unauthenticated stranger — or a provider retrying ten thousand times — never gets
to decide how often your company works.

---

## 9. Make a gate run your checks

By default a gate is answered by a review port. You can instead require that **real checks pass**:

```bash
ocli org check list --org acme     # what is available, and which can prove they can fail
ocli org check bind --org acme --gate implementation_review \
  --check check-then-use-races --check reason-truth
```

Three things to know:

- **Strictly additive.** A roster that is not clean rejects the gate *before* the reviewer is
  asked. A clean one changes nothing. Binding a check can only make a gate stricter.
- **Keyed by the git tree.** A verdict is recorded against the tree it judged, so re-running a gate
  on unchanged content reuses the answer and changed content cannot.
- **A green nothing can falsify is not evidence.** A check with no falsifier reports `UNPROVEN`,
  never `Passed`. `org check list` tells you which of yours can prove they are able to fail.

---

## 10. Keep humans in the loop (optional)

```bash
ocli org create ... --checkpoint grooming --checkpoint approach
```

The organization stops there and waits. Watch and answer:

```bash
ocli inbox     --org acme                                    # what is waiting for you
ocli questions --org acme --outbox /var/acme/blockers        # what agents have asked

ocli answer  --org acme --blocker <id> --answer "per-tenant" --reason "billing is per-tenant"
ocli approve --org acme --work <id> --gate brd_approval --reason "scope is right"
ocli reject  --org acme --work <id> --gate brd_approval --reason "expiry must be per-tenant"
ocli comment --org acme --work <id> --body "see the tenancy note in the RFC"
```

Every verdict names the **gate** as well as the work item, and every one requires a `--reason`.
A verdict with no reason is not a verdict anybody can act on.

A rejection reason is fed back to the agent that produced the work. That is what makes the
implement → review → implement loop converge instead of oscillate.

Choosing **no** checkpoints is a real answer and means it runs the whole chain itself.

---

## 11. Watch it

```bash
bun src/Core.TypeScript/corporate/serve-org.ts  --org acme   # read-only dashboard
bun src/Core.TypeScript/corporate/serve-work.ts --org acme   # the work view
ocli demand --org acme                                       # what each item owes
ocli task   --org acme --work <work-id>                      # one item's whole history
```

The dashboard has no POST, no PUT and no path that writes — a dashboard that can change what it
observes is not a dashboard. The webhook receiver is a **separate process on a separate port** for
exactly that reason.

---

## 12. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `changes: 1 projected, 0 landed` | The performer did not commit | The worker must `git commit` its own work |
| `mvn` fails instantly, EINVAL | `.cmd` shim under `shell: false` | Use the bare command name |
| `DELIVERED` but nothing in git | Change control is **simulated** | Pass `--git`, `--base`, `--worktrees` |
| Stops with `no_progress` | A cycle changed nothing | Read the refusals — usually a gate rejecting for a stated reason |
| `refused: … source-synced with no sources` | Created source-synced, never connected one | `org source add`, or create it `greenfield` |
| Gate rejected: `UNPROVEN` | A bound check cannot prove it can fail | Give the check a falsifier, or unbind it |
| Hook returns 401 | Signature mismatch | Check `--signature-header` and that `--secret-file` holds the provider's secret |

---

## 13. For an AI agent

Give the agent this section verbatim.

**Discover the surface — do this first, and trust it over any documentation including this file:**

```bash
bun src/Core.TypeScript/corporate/org-cli.ts describe
```

It prints every command, flag, and exit code as JSON, generated from the table the parser itself
uses.

**The setup loop.** `org configure --org <id> --json` returns `{ complete, next, optional, steps }`.

1. If `complete` is `true`, setup is done.
2. Otherwise read `next`: it has `ask` (the question, in plain language), `why` (the reason —
   use it if the person asks "why do you need that?"), `command` (exactly what to run), and
   `current` (what the organization looks like on this step right now).
3. Ask the person `ask` **in your own words**. Do not paste the command at them.
4. Run `command` with their answer substituted.
5. Go to 1.

`optional` holds things worth offering **once**. Never re-offer them; that is how guided setup
becomes a questionnaire nobody can finish.

**Rules that are not negotiable:**

- A credential is passed as a **path to a file** (`--auth-file`, `--secret-file`). Never pass a
  token as a flag value — it will be refused, and correctly.
- Exit codes are meaningful and `describe` lists them: `0` ok, `2` refused, `3` usage,
  `4` not found, `5` a port failed. Check the code, not the text — and never the exit code of
  something you piped into.
- A refusal is information. Read it and act on it; do not retry the same command.

**Verifying your own work:** the organization's own claim is not evidence. Read the repository:

```bash
git -C <repo> log --merges --oneline main    # did anything actually land?
```

---

## Appendix — verified behaviour

Measured, not asserted:

- **Four ecosystems, one organization.** TypeScript (bun), Java (Maven + JUnit 5), Python
  (unittest) and C# (.NET 10), each starting from a red suite: all four `DELIVERED` with a real
  merge commit and a green suite read back from the repository.
- **It cannot be bricked.** The same setup with a performer that writes a wrong implementation on
  purpose halted in **one cycle with zero merges** — it stops with a reason rather than grinding.
- **History stays answerable.** At 60,000 events: one work item's history in 86 ms, a line of
  authority's decisions in 104 ms, a full resume in 186 ms.
