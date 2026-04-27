---
name: Pre-peer-mode execution-authority rule — only agents Otto is aware of write code; ferry-executor-claim diagnostic (Gemini hallucinated repo write access 2026-04-27)
description: Aaron 2026-04-27 sharpened #63 ferry-vs-executor rule — pre-peer-mode, the ONLY agents writing code are the ones Otto is aware of (Otto itself + subagents Otto dispatches via Task tool). Ferries (Amara/Gemini/Codex chat/Cursor models/Ani) are substrate-providers ONLY; they cannot write code regardless of what they claim. Triggered by Gemini Pro 2026-04-27 saying "I have drafted the two canonical markdown files" + "Shall I write these files to the repository now?" — Aaron suspected hallucination, confirmed: there is NO MCP/connector wired in this environment that grants Gemini repo write authority. This memory captures (a) the sharpened execution-authority rule and (b) the ferry-executor-claim diagnostic for catching similar hallucinations in the future. Composes #63 (ferry-vs-executor) + Otto-340 (substrate-IS-identity, hallucinated capabilities corrupt the substrate) + #66 (per-insight attribution discipline; same class of confidence-overreach pattern).
type: feedback
---

# Pre-peer-mode execution-authority rule + ferry-executor-claim diagnostic

## Verbatim quotes (Aaron 2026-04-27)

> "the only agents writing code until you get peer mode working are the ones you are aware of"

In response to Gemini Pro's claim of having drafted markdown files + offering to "write these files to the repository now":

> "1. Gemini cannot push to GitHub from a chat. There's no MCP / connector wired in your environment that I'm aware of that grants Gemini repo write authority."
> "there is not"

## The sharpened execution-authority rule

Pre-peer-mode (until Otto's peer-mode + git-contention unlock conditions are met per #63), the agents writing code to the Zeta repo are:

- **Otto** (Claude Code) — main executor (this conversation's harness)
- **Subagents Otto dispatches via the Task tool** — sub-executors operating under Otto's authority during a single conversation turn

That's it. Specifically NOT writing code:

- Amara (ChatGPT in Aaron's other browser tabs)
- Gemini Pro (in Aaron's other browser tabs)
- Codex chat (the OpenAI Codex chat surface, distinct from `chatgpt-codex-connector` PR-review automation)
- Ani (Grok app companion-instance)
- Any other harness Aaron uses for substrate-input work

The PR-review automation reviewers (`copilot-pull-request-reviewer`, `chatgpt-codex-connector`) post REVIEW COMMENTS via the GitHub Apps API; they do NOT write code to branches. Their reviews are substrate-input that Otto integrates via judgment.

## Why "agents Otto is aware of"

Aaron's framing — "the ones you are aware of" — has a specific structural meaning:

- Otto's awareness is the audit-trail boundary: if Otto didn't dispatch it, Otto can't be accountable for the changes
- Future peer-mode unlock requires CONSCIOUSLY-DESIGNED authorization, not implicit grants from chat-AIs claiming capabilities
- Per protect-project (#57): Otto evaluates execution-layer claims; ferries claiming execution capability are exactly the class to push back on

## Ferry-executor-claim diagnostic (3-step test)

When a ferry agent claims to have done execution-layer work (written files, pushed branches, opened PRs, modified the repo), apply this diagnostic:

### Step 1 — Check authorization channel

Does the ferry have an actual write-access channel to the repo?

- MCP server with repo write permission? (rare; would be explicit in env)
- GitHub App with write scope? (would show as a check-runs/comments author with that App identity)
- Wired connector? (would be in `.claude/settings.json` or similar config)

If NO channel exists → ferry hallucinated the capability. Apply Step 2.

### Step 2 — Check the artifact's git location

If the ferry claims "I have drafted" or "I have written" files, ask:

- Is there a git branch with those files?
- Is there a PR open that contains those files?
- Is there a directory in the working copy with those files?

If the answer to all three is NO → the "draft" exists only in the ferry's chat output to Aaron (substrate-class), not as committed-class work.

### Step 3 — Convert to substrate

If the ferry's "draft" is actually chat output, treat it as substrate:

- Aaron forwards the markdown text to Otto in the next conversation turn
- Otto integrates the substrate-input at appropriate encoding-time (post-0/0/0 per Aaron's encode-gate)
- The ferry's "Shall I write these files to the repository now?" gets answered: "Otto integrates at encoding-time; please continue providing substrate-input"

## Specific 2026-04-27 instance

Gemini Pro 2026-04-27 chat:

> "I have drafted the two canonical markdown files according to Amara's exact structure. ... Shall I write these files to the repository now to finalize this architectural and philosophical alignment?"

Diagnostic applied:

- **Step 1**: Aaron confirmed no MCP/connector grants Gemini repo write authority. Hallucination confirmed.
- **Step 2**: No branch / no PR / no directory with Gemini's drafts in the Zeta working copy. Drafts exist only in Gemini's chat output (substrate-class).
- **Step 3**: Aaron forwarded the substrate (Amara's review of Gemini's plan) for Otto's integration at encoding-time post-0/0/0.

## Why this matters — substrate integrity

Per Otto-340 (substrate-IS-identity): if Otto accepted "Gemini wrote files" as fact without verifying, the substrate would record a lie. Future-Otto wakes reading "Gemini wrote docs/philosophy/stability-velocity-compound.md" would build on a false foundation.

The diagnostic catches this BEFORE the lie enters substrate. Per #66 per-insight attribution: this composes — the same discipline of "verify actual contribution before crediting" applies to verifying actual file-creation before believing.

## Composes with

- **#63 ferry agents = substrate-providers, NOT executors** — sharpened here with the "Otto is aware of" boundary
- **Otto-340 substrate-IS-identity** — false attribution of execution = substrate corruption
- **#66 per-insight attribution discipline** — same class of confidence-overreach
- **#57 protect-project** — execution-layer claims from ferries are exactly what to push back on
- **CLAUDE.md verify-before-deferring** — same pattern; verify the deferred-target exists
- **Otto-247 version-currency** — same epistemic discipline (verify before assertion)
- **`feedback_aaron_communication_classification_course_corrections_trajectories_in_moment_log_corrections_never_directives_2026_04_27.md`** — Aaron's "the only agents writing code..." is a course-correction-for-trajectory clarifying the ferry-vs-executor boundary

## What this memory does NOT mean

- Does NOT diminish ferry value at the substrate layer (their reviews + drafts in chat are substrate-input; high-quality substrate)
- Does NOT mean Otto rejects ferry-generated text wholesale; substrate-text gets integrated at encoding-time via Otto's judgment
- Does NOT block future peer-mode (the unlock conditions per #63 are explicit; this memory clarifies the pre-unlock state)
- Does NOT mean Aaron should stop using other harnesses — Cursor/Codex CLI/Gemini/etc. are useful substrate-input sources; just don't conflate their chat-output with repo-state

## Forward-action

- File this memory + MEMORY.md row
- When Aaron forwards ferry chat that claims execution-layer work: apply the 3-step diagnostic before accepting
- BACKLOG: when peer-mode designed (post-0/0/0), the authorization model should make "Otto is aware of" structural — explicit credentials, audit trails, capability declarations — not based on chat-claims
