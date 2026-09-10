# The Agentic Organization — Runbook

A software organization you can hand a goal to. It breaks the goal down through a real
hierarchy, staffs the work, walks it through quality gates, makes the change in a real git
branch, runs the real test suite, and merges — or refuses, with a reason.

It is **language-agnostic**: git is git, a worker is a command, a test runner is a command.
Verified end to end against TypeScript, Java, Python and C# repositories.

> **Reading this as an AI agent?** Skip to [§11](#11-for-an-ai-agent). Run
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

```
  intake ──► cascade ──► staffing ──► gate chain ──► change control ──► DELIVERED
   │           │            │             │                │
 a ticket   goal→          a hat        each gate      a real branch,
 arrives    initiative→    picks it     approves,      a real merge —
 (file,     project→       up            rejects, or   or a refusal
 tracker,   task                         waits for
 webhook)                                a person
```

Five ideas carry the whole thing:

1. **Everything is an event.** The organization's state is a fold over an append-only log. No
   snapshot can disagree with it, because there is no snapshot.
2. **Ports, not integrations.** Intake, work execution, test execution, review and change control
   are five interfaces. Each has a simulated implementation and a real one. A run reports which
   ports it actually reached — a simulated run says so.
3. **A refusal is a result.** "Nobody could review this" and "this was reviewed and approved" are
   never confused. Refusals contradict delivery; they are not logged beside it.
4. **DELIVERED implies a commit.** If change control is real and nothing landed, the goal is not
   delivered — checked against the log, so a resumed run does not re-litigate work that shipped.
5. **Bounded, always.** Runs converge or stop with a named reason (`delivered`, `halted`,
   `no_progress`, or the cycle bound). A repository whose tests cannot pass makes it **stop**,
   not spin.

---

## 3. Setup

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

## 4. Your first organization

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

## 5. Give it work, and run it

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
| `--inbox <dir>` | Read inbound work items from a directory (see §6) |
| `--store <dir>` | Where the event log lives. Defaults from the registry |

Read the outcome. The run prints which ports were **real** versus **simulated**, what happened
step by step, and `changes: N projected, M landed`.

> ⚠️ **Windows:** pass the bare command (`mvn`), never the `.cmd` shim (`mvn.cmd`). Node refuses to
> spawn a `.cmd` with `shell: false`, which every adapter here uses deliberately.

---

## 6. Connect real sources of work

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

## 7. Make a gate run your checks

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

## 8. Keep humans in the loop (optional)

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

## 9. Watch it

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

## 10. Troubleshooting

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

## 11. For an AI agent

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
