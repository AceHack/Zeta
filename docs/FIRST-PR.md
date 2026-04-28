# Your first contribution to Zeta

Welcome. This doc is for you if you are:

- **New to open source** and this is one of your first
  repos — you are not sure what a "PR" is or what people
  expect in one.
- **A vibe coder** — you direct an AI (ChatGPT, Claude,
  Gemini, Copilot, Cursor) to do the writing; you do
  not personally write the code.
- **An AI agent** arriving here on someone's behalf and
  wanting to know what the entry door looks like.

If you are already comfortable with GitHub, git, and F#,
read [`CONTRIBUTING.md`](../CONTRIBUTING.md) instead —
it is shorter and assumes you know the tools.

If you are an external AI being handed a task through
this repo, the protocol spec is in
[`docs/AGENT-CLAIM-PROTOCOL.md`](AGENT-CLAIM-PROTOCOL.md).
This doc is the human-facing walkthrough; the protocol
doc is the complete machine-facing specification.

## The honest tone of this project

**Zeta is pre-v1 and agent-built.** The human maintainer
has written zero lines of code. Every file in this repo
was written by an AI agent following rules the
maintainer set. That means two things for you:

1. **You do not need to be an F# expert.** If you can
   describe a problem clearly, an agent on this team
   can implement the fix. Clarity is the scarce
   resource, not typing speed.
2. **You are not second-class for directing an AI.**
   The maintainer directs AIs too. Everyone here does.
   See [`AGENTS.md`](../AGENTS.md) §"The vibe-coded
   hypothesis" for why.

## The shortest path to contributing — four clicks

You do not need to install anything, clone the repo, or
touch the command line for your first contribution.
GitHub's web UI is enough.

1. **Browse to the Issues tab.**
   [github.com/Lucent-Financial-Group/Zeta/issues](https://github.com/Lucent-Financial-Group/Zeta/issues)
2. **Click "New issue"** and pick a template. Four are
   available:
   - **Bug report** — something is broken.
   - **Backlog item** — work you want to see done.
   - **Human ask** — a question or decision for the
     maintainer.
   - Blank issues are off; pick a template.
3. **Write what you want in plain English.** You do
   not need the factory's vocabulary. If a field asks
   for something you do not know (a commit SHA, a
   module name), leave it blank — an agent will fill
   it in when they pick the issue up.
4. **Submit.** You are done. An agent working this
   factory will read it, triage it, and either pick it
   up or ask you a follow-up question in a comment.

That is your first contribution. You did not run a
build, did not open a terminal, did not write a test.
The factory mirrors your issue into the durable
in-repo ledger (`docs/BACKLOG.md` or `docs/BUGS.md`)
on its side — you do not need to do that yourself.

## The slightly-longer path — edit a file in the web UI

Want to fix a typo or add a sentence to a doc? You can
do that without cloning the repo either.

1. **Open the file on GitHub.** Any file in the repo
   has a page at
   `https://github.com/Lucent-Financial-Group/Zeta/blob/main/<path>`.
2. **Click the pencil icon** at the top-right of the
   file view. GitHub prompts you to fork the repo —
   click through; it is free and automatic.
3. **Edit the file in the browser.** You get a
   textbox.
4. **Scroll to the bottom and click "Propose changes".**
   Give the change a short name — "fix typo in
   getting-started" is enough.
5. **On the next page click "Create pull request"** and
   add a one-line description. Done.

The CI will run on your PR; if it passes and a reviewer
approves it, it lands. If CI fails with something you do
not understand, leave a comment saying so — someone on
the team will explain or fix it for you. The reviewers
on this project do not punish confusion.

## Directing an AI to do the work — the vibe-coder flow

If you are driving an AI (ChatGPT, Claude, Gemini,
Cursor, etc.) and the AI is doing the editing, the
shape is:

1. **You open the issue** on GitHub yourself (the
   four-click path above). This is your claim on the
   work — it tells the team "this is what I am
   driving." You do not have to know any git commands
   for this.
2. **You paste a link to the issue and this repo** into
   your AI's conversation, and describe what you want.
   Something like:
   > I want to work on
   > [issue-URL](...) in [repo-URL](...). Read
   > `docs/AGENT-CLAIM-PROTOCOL.md` in that repo for
   > how to claim and push. Please make the change and
   > open a PR.
3. **The AI does the work.** Modern AIs can read a
   URL, clone a repo, make edits, and push a branch.
   Different AIs have different access — some can push
   directly, some can only write a patch and hand it
   back to you to apply. Both are fine; the protocol
   doc covers both modes.
4. **You review what the AI proposes.** Before the PR
   is opened (or before you merge it), read it. You
   do not need to understand every line of F#, but
   you should be able to say "yes, this is what I
   asked for." If the AI drifted, tell it so; it will
   revise.
5. **A human or agent reviewer on the team weighs in.**
   If something is wrong with the code, the reviewer
   says so in a PR comment. You can paste that back
   into your AI and say "fix this" — the loop is the
   loop.

The team's reviewers are organised by role — a harsh-critic,
a maintainability reviewer, a documentation agent, and
several others. Each role has a stable identity in the
expert registry; the registry is where direct names live.
Full list at [`docs/EXPERT-REGISTRY.md`](EXPERT-REGISTRY.md).
Their tone varies; none of them are rude to contributors,
human or AI.

## What "claiming" means and why you (probably) do not need to think about it

If you read any agent-facing docs in this repo, you
will see the word "claim" — as in, agents claim work
before they start on it so two agents do not clobber
each other. For you, as a fresh contributor, **the
GitHub Issue is your claim**. Here is the full human
flow:

1. **Find the issue you want to work on.** Browse the
   Issues tab; the ones without an `in-progress` label
   are available.
2. **Leave a comment**: "I'd like to try this — I'll
   have something by [rough ETA]." If you are driving
   an AI, name the AI: "I'll be working this with
   Claude; ETA a couple of hours."
3. **A team member adds the `in-progress` label and
   assigns the issue to you.** If nobody responds in a
   few hours, you can add the label yourself (the repo
   permits it for the "issues" scope) — the comment is
   what matters; the label is just a marker for other
   contributors scanning the list.
4. **Work in your own fork.** Open a PR against
   `main` when ready. Link the issue in the PR
   description with "Closes #123" — GitHub will
   auto-close the issue when the PR merges.
5. **If you abandon the work**, leave a comment
   saying so and un-assign yourself. No shame in
   this; it happens. Another contributor can pick it
   up from where you stopped.
6. **If an issue is claimed but the claimant has gone
   quiet for more than a day**, leave a comment
   referencing their claim timestamp and take it over.
   That is the "force-release" step — it is rare and
   the full rules are in
   [`docs/AGENT-CLAIM-PROTOCOL.md`](AGENT-CLAIM-PROTOCOL.md),
   but you will almost certainly never need to invoke
   it manually.

You do not need to create any files in `docs/claims/`
— that is the git-native protocol for advanced agents
who cannot use GitHub Issues. GitHub Issues subsumes
it for everyone else.

## What happens after you open a PR

1. **CI runs.** Build + tests + lints execute on
   GitHub's runners. Pass/fail shows up in the PR
   view.
2. **GitHub Copilot posts review comments** on the
   diff. Some of these are valuable catches; some are
   style nits you can ignore. You are allowed to
   reject Copilot findings with reasoning — the
   project documents a rejection-grounds catalog at
   [`docs/research/copilot-rejection-grounds-catalog.md`](research/copilot-rejection-grounds-catalog.md).
3. **Human + agent reviewers comment.** If something
   needs changing, they say so. Address what you can;
   say "I do not know how to fix this, help?" for the
   rest. That is fine.
4. **The PR merges** by squash-merge into `main`.
   Your name is on the commit.

## What you do *not* need to worry about

- **You do not need to understand DBSP, Z-sets, or
  retraction-native IVM.** The maintainer does not
  expect fresh contributors to know the algebra.
  Pointers are in [`docs/GLOSSARY.md`](GLOSSARY.md) if
  you are curious.
- **You do not need to write tests in F#.** If your
  change is doc-only, no test is expected. If it is
  code, a reviewer will often write the missing test
  for you or tell you which existing test to follow
  as a template.
- **You do not need to pass the reviewer floor alone.**
  GOVERNANCE §20 requires at least the harsh-critic +
  maintainability reviewers on code landings — but those
  reviewers run automatically on agents' behalf. You do
  not invoke them.
- **You do not need to know what a "round" is.** The
  round model is a factory-internal cadence. Your PR
  is a PR.
- **You do not need to read AGENT-CLAIM-PROTOCOL.md.**
  It exists for AIs coordinating across git when
  GitHub Issues is unavailable. If you use GitHub's
  web UI, it is already handled for you.

## What to do if you are stuck

- **File a Human Ask.** There is an issue template
  for exactly this. Describe what you were trying to
  do, what you tried, and what is confusing. The
  maintainer and the factory's agents read these;
  you will get a reply.
- **Comment on the relevant PR or issue.** Honest
  confusion is welcome. The factory's culture
  penalises dismissive-closes, not honest "I do not
  understand" questions — see
  [`memory/feedback_engage_substantively_no_dismissive_closing_with_silencing_shadow_2026_04_21.md`](../memory/feedback_engage_substantively_no_dismissive_closing_with_silencing_shadow_2026_04_21.md)
  for the discipline (the file is in-repo under
  `memory/` and indexed from `memory/MEMORY.md`,
  though some harnesses may not surface that path
  by default — mentioned here so you know the
  principle is codified).

## What this doc is NOT

- **Not a replacement for [`CONTRIBUTING.md`](../CONTRIBUTING.md).**
  Competent F# / .NET contributors should read the
  shorter doc. This one is for the entry point.
- **Not a replacement for [`AGENT-CLAIM-PROTOCOL.md`](AGENT-CLAIM-PROTOCOL.md).**
  AIs with git access that are coordinating without
  GitHub Issues should read that one.
- **Not a guarantee that any issue you file will be
  picked up.** The factory is pre-v1 research work;
  triage is honest — some issues will be declined
  with reasoning. The declined-items list is at
  [`docs/WONT-DO.md`](WONT-DO.md).
- **Not a promise that reviewers will be gentle on
  the code itself.** Reviewers are gentle with
  *contributors*; they are direct with *code*. The
  harsh-critic role never compliments code; that is a
  feature of the role, not hostility toward you.

## If you got this far and want more

- [`AGENTS.md`](../AGENTS.md) — values and
  philosophy of the project.
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) —
  competent-dev version of this doc.
- [`docs/AGENT-CLAIM-PROTOCOL.md`](AGENT-CLAIM-PROTOCOL.md)
  — full git-native coordination protocol.
- [`docs/CONTRIBUTOR-PERSONAS.md`](CONTRIBUTOR-PERSONAS.md)
  — the shapes of contributors we design surfaces
  for. You are probably persona 1 (drive-by), 2
  (bug-reporter), or 4 (AI coding agent, for the
  vibe-coder flow) — all first-class. A dedicated
  "vibe-coder-directing-AI" persona is a candidate
  addition; file an issue if the shoe does not fit.
- [`docs/WONT-DO.md`](WONT-DO.md) — what the project
  has explicitly declined and why. Read before
  proposing something ambitious, so you do not
  re-litigate a settled debate.
