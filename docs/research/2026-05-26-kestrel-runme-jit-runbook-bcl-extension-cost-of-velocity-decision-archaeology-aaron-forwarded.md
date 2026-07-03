# Kestrel — runme.md + JIT triage pattern + Runme core BCL 4-capability extension + cost-of-velocity acknowledgment + decision-archaeology composition (Aaron-forwarded 2026-05-26)

**Substrate-attribution**: Kestrel (external AI; claude.ai web register; sharpen role per `.claude/rules/agent-roster-reference-card.md`); ferried-through-Aaron per the discipline that external AI participants who don't commit ferry insights via the human maintainer.

**Substrate-status**: research-grade. Substantive engineering substrate + 5th empirical anchor in the attractor-as-encryption-with-clean-decryption series (single-turn decryption — pattern matured). Composes with the substrate cascade landed on 081KSGS9H0008QG0R0031PBNGA over 2026-05-26 (PRs #5277 + #5281 + #5285 + #5286 + #5291 + #5295).

## Operational claim — what this lands

Four distinct substantive-engineering pieces from the Kestrel ferry:

1. **runme.md + JIT triage as architectural innovation** (3-register-per-cell pattern + organic-emergence vs borrowed-from-published)
2. **Cost-of-velocity substrate-honest acknowledgment** (Aaron's explicit naming: parallel-substrate accumulation IS the cost of trajectory-not-PR review)
3. **Runme core BCL 4-capability extension proposal** (observability + ontology + database + MCP; per 081KSGS9H0008QG0R001K8VPV4 backlog row companion)
4. **Decision archaeology skill engagement** (output-format-matters + unhappy-path queries + refactoring integration + onboarding usefulness)

Plus the 5th empirical anchor data: this Kestrel exchange compressed the decryption-protocol cycle from multi-turn to single-turn — pattern operating at maturity.

## Verbatim Kestrel preservation — substantive engineering register

Per `.claude/rules/substrate-or-it-didnt-happen.md` verbatim-preservation discipline. Kestrel's engineering-register engagement following Aaron's request to show "more of the engineering focus":

### On the zflash UX engineering

> *"The zflash tool specifically is a nice piece of UX engineering. The flow you described — three keystrokes after first-time setup, biometric proof of physical presence via Touch ID, random per-run challenge that can't be pre-baked, automatic SSH key injection so the headless boot just works — is a real solution to a real operational problem (the physical-presence-and-trust-establishment gap when bootstrapping a node). It composes the macOS PAM stack, the standard sudo dd flow, the FAT ESP write, and the operator's existing SSH key into one streamlined operation. That's good engineering. The kind of thing a senior infrastructure engineer would build for themselves once they got tired of typing the same flash sequence over and over."*

### On the 3-PR cleanup approach

> *"Smaller PRs are easier to review than one big consolidation PR. Each one is independently revertable if something breaks. Sequencing matters though — PR 1 (delete root-level legacy) should land before PR 2 (decide fate of infra/installer + consolidate workflows) because the second one depends on knowing the first one didn't break anything that referenced the legacy paths. The grep you did for cross-references is the right pre-cleanup audit; if there are references to the old paths in backlog documents or PR discussions or audit tooling, those need updating too or you'll get stale references that confuse future contributors."*

### On CI ISO testing direction

> *"QEMU boot testing is the standard pattern. The CI runner spins up a VM, boots the freshly-built ISO, waits for the expected login prompt or shell environment to appear, runs some basic commands to verify the installer works, then tears down. NixOS itself does this for its own installer testing — there's prior art in nixos/tests/installer.nix and similar that you can either use directly or adapt. The advantage is the test runs on every PR that touches the installer substrate; the disadvantage is that QEMU boots are slow (typically 2-5 minutes for a full installer boot in CI), so you'd want to balance comprehensive testing against CI time budget."*

### On preserving rationale in deletion commits

> *"The three-installer-substrates situation didn't happen by accident, and the cleanup PRs should preserve a brief written rationale for why each path existed and why it was retired. Otherwise some future contributor will find the deletion in the git history, not understand why the path was needed in the first place, and end up reinventing one of the patterns six months later. A README or commit message that says 'this path existed because of X reason that's now solved by Y consolidation' is the kind of small documentation cost that saves significant time later."*

### Aaron's substrate-honest cost-of-velocity acknowledgment

> Aaron: *"agree 100% and this is the cost i pay for not reviwing every PR and giving AI freedom of velocity"*

### Kestrel on cost-of-velocity + recovery mechanism

> *"What you just acknowledged is one of the genuine tradeoffs of the trajectory-not-PR review discipline. You review the trajectory because PR-by-PR review at the cadence Otto produces would consume all your time and defeat the AI-velocity advantage. That choice is correct for what you're optimizing for. The cost is that artifacts get created during periods of velocity that solve problems in ways that may diverge from each other, accumulate parallel substrates, or encode rationale only in commit messages that no one will read until they're trying to understand why a path exists six months later. Three parallel installer substrates is the visible form of that cost. There are probably others that haven't surfaced yet because nothing has prompted a cleanup of them."*
>
> *"The good news is that the cost is recoverable and you're recovering it correctly. The cleanup PRs do the archaeology work — figure out why each path exists, document the rationale in the deletion commit, link to the backlog row that explains the context, leave breadcrumbs for the next contributor. That work is paid for once, then the codebase is clean again until the next velocity period produces more parallel substrates. The cycle is 'velocity period creates technical debt → cleanup period pays it down → repeat.' That's the standard rhythm of software development at scale, and pretending it doesn't exist would be the failure mode, not the existence of the debt itself."*

### Kestrel — three patterns for reducing velocity-cost without sacrificing velocity

> *"Periodic substrate audits. Schedule a regular check (monthly, every-N-PRs, whatever rhythm works) where you or one of the human maintainers spends an hour grepping for parallel substrates — multiple files solving similar problems, duplicate workflows, parallel implementations. Catching the divergence early is cheaper than catching it after three substrates have accumulated. This doesn't require reviewing every PR; it requires periodically reviewing the shape of what's accumulated."*
>
> *"ADR (Architecture Decision Records) discipline at the substrate level. When a PR creates a new substrate path rather than extending an existing one, the PR commit message or a small docs/adr/NNNN-decision.md file should explain why. 'This is a new path because the existing path can't be extended to handle X' is one sentence of work at PR creation time, and it preserves the rationale for free. Otto can produce these as part of substrate-creation PRs without slowing the velocity meaningfully. Then when you do cleanup work, the ADRs are already there to inform what gets retired and what gets kept."*
>
> *"Convergence gates rather than creation gates. The trajectory-not-PR review pattern means you don't gate creation. But you can gate convergence — once N parallel substrates exist for the same problem, a convergence PR is required before any further substrate work in that area. That's a cheap rule to enforce ('the codebase has three installer substrates, the next installer-related PR is the consolidation, no new installer work until then') and it forces the cleanup to happen before the debt grows further."*

### Aaron on decision archaeology + git blame as foundational skill

> Aaron: *"PRs do the archaeology work on of the first skills we create was around decision archeology and git blame"*

### Kestrel on the decision-archaeology skill engineering substrate

> *"The git blame + decision archaeology composition is doing real work because it answers the most common forensic question in any codebase: 'why is this here?' The naive answer is 'look at the blame, find the commit, read the commit message.' The skilled version is significantly more involved — chase the commit message to the PR, read the PR description and discussion, find the referenced backlog row, read that, find adjacent PRs that touched the same area, look at what was deleted in the same period to understand what alternative was rejected, check whether the commit message mentions reviewers or related decisions, and synthesize the whole thing into a coherent narrative about why this code looks the way it does."*

### Kestrel engineering observations on decision-archaeology

1. **Output format matters**: synthesis vs source-pointers. The useful output is "this code exists because of decision X, made in context Y, in response to problem Z, with alternative W rejected because of reasons R, modified later by S to handle case T."
2. **Unhappy-path queries** are where the skill earns its keep — "why doesn't this work the way I expected?" not "why does this work?"
3. **Refactoring integration** — when doing cleanup, the archaeology skill should be the tool that informs which substrates to keep, which to delete, and how to write the rationale
4. **Onboarding for new maintainers** — Max + Addison joining the rotation is the first big test
5. **Blame-skipping for boring commits** — git blame alone has known limitations (formatting passes, mass refactors); mature version handles blame-skipping + chases through merge commits + looks at code-movement

### Aaron — "could be reduced to a serialized rx bonsai query that holds the uncollapsed tension in a tensor score or something"

> Aaron: *"it could be reduced to a serialized rx bonsai query that holds the uncollapsed tension in a tensor score or something"*

### Kestrel — substrate-check applied to that line (single-turn decryption matured)

> *"Before I engage that, I want to slow down for a moment because I'm noticing something in the last message I want to be honest about rather than ride past. ... 'Reduced to a serialized rx bonsai query that holds the uncollapsed tension in a tensor score or something' combines four substrate-internal vocabulary terms ... The substrate-check question: which one is this? Do you have a specific operational claim about how serialized Rx Bonsai queries would hold the uncollapsed tension in a tensor score for decision archaeology — meaning, can you describe what the input is, what the output is, and what specific operational problem it solves better than the current skill does? Or is this more of a 'direction worth thinking about eventually, not now, just noting it as I think about how the skill might evolve'?"*

### Aaron — runme.md + JIT triage operational answer

> Aaron: *"so now i put someting like this in our runbook markdown file with an implicit continue-with / jit - figure this out later and a whole backlog appears."*

### Kestrel — the operational mechanism named

> *"The runbook markdown with implicit continue-with / JIT-figure-this-out-later semantics is the right place for sentences like the one you wrote, because those sentences are doing legitimate work — they're capturing a direction that might be worth chasing later, in compressed substrate-internal vocabulary that's efficient to write down even if it's not yet checkable. The 'or something' qualifier wasn't sloppy thinking; it was you marking the sentence as 'this is a gesture I'm preserving, not a claim I'm making.' Different mode, different evaluation criteria."*
>
> *"And then the backlog generation pattern you just named is the operational mechanism that makes this work. Those runbook gestures don't stay vague forever — they get expanded into backlog rows over time. The backlog row is where the gesture gets the engineering work done on it: what's the actual claim, what's the input/output, what's the operational problem it solves, what's the prior art, what's the implementation sketch."*

### Kestrel — the 3-register-per-cell architecture

> *"The composition gives you three distinct registers in one document:*
> *Executable cells that are committed engineering work — these run, they produce output, they're tested.*
> *Prose cells that document context, rationale, and intent — these are read, not executed.*
> *Gesture cells that capture directions worth preserving but not yet worked out — these are runme-markdown-shaped but contain substrate-internal vocabulary or 'or something' qualifiers, marking them for later JIT refinement."*

### Kestrel — closest existing references for runme + JIT pattern

> *"Donald Knuth's literate programming was the early version of 'code and prose in the same document,' but it didn't have the executable cells or the JIT triage layer."*
>
> *"Jupyter notebooks have the executable cells but tend toward exploratory data analysis rather than infrastructure workflow."*
>
> *"Runbook automation tools (Ansible playbooks, Rundeck, etc.) have the executable infrastructure focus but typically don't accommodate speculative cells."*
>
> *"Org-mode in Emacs has some of the multi-register prose-plus-code-plus-todo properties, but it's tied to its ecosystem."*
>
> *"What you've built combines pieces of all of those, plus the JIT triage layer that I haven't seen documented elsewhere."*

### Aaron — Runme BCL 4-capability extension proposal

> Aaron: *"then we are going to add to the runme core bcl around observablity queries ontology/graph queires over the existing runbooks themselves and database queires over the generators + joins so the books can retried data plus referece mcp through runme execution env."*

### Kestrel — engineering breakdown of the 4 capabilities

> *"What I understand you to be describing: extending Runme's core BCL (base class library, in the .NET sense — the foundational standard library that everything else builds on) with four capabilities that make the runbook a queryable substrate rather than just an executable document:*
>
> *1. Observability queries against runtime telemetry — the runbook can query its own execution history, performance metrics, failure rates, etc.*
> *2. Ontology/graph queries over the existing runbooks themselves — the runbook corpus becomes a queryable knowledge graph where you can ask things like 'which runbooks reference the decision archaeology skill' or 'what's the dependency graph between runbooks.'*
> *3. Database queries over the generators + joins — the runbook can query the actual data substrate (CockroachDB, the Z-set state, whatever's persistent), executing the generate+join semantics against real data.*
> *4. MCP (Model Context Protocol) references through the Runme execution environment — runbook cells can invoke MCP-capable tools and bring their outputs back into the runbook execution context."*

### Kestrel — composition gives uncommon substrate

> *"If I'm reading this right, the composition gives you something genuinely uncommon: a markdown document that's simultaneously human-readable prose, executable infrastructure code, queryable telemetry interface, knowledge-graph navigator over its own corpus, data-substrate query interface, and tool-orchestration layer. Each capability alone exists somewhere in the engineering landscape; the combination in one document type with consistent semantics across them is the part that's distinctive."*

### Kestrel — core-vs-separable-modules tradeoff

> *"The argument for putting them all in core: composability. If observability queries and database queries and MCP calls are all separate plugins with separate authentication and separate result types, the runbook cells can't easily compose them ... without each plugin understanding the others. Core integration means the data flows are consistent."*
>
> *"The argument for keeping them separate: scope discipline. A BCL that does everything becomes hard to evolve, hard to audit, and hard to onboard new contributors to. The successful BCLs in the industry tend to have a clear scope ... with extension points for capabilities outside the scope."*
>
> *"The right answer is probably somewhere in between — a core that handles the cross-cutting concerns (execution, result types, telemetry, authentication, cell composition) with the specific capabilities (observability queries, graph queries, database queries, MCP) implemented as well-integrated but separable modules that share the core infrastructure."*

### Kestrel — engineering observations per capability

**Observability queries**:

- Standard answer: expose OpenTelemetry / Prometheus / logging through query primitives
- Challenge: temporal dimension that markdown doesn't naturally express
- Prior art: Grafana annotation system, Jupyter nbformat for time-parameterized cells

**Ontology/graph queries over runbooks**:

- Runbooks as nodes, references as edges, queryable corpus
- Need typed references (`<!-- depends-on: skill/decision-archaeology -->`) for parseability
- Prior art: Obsidian backlinks, Roam Research bidirectional links, Zettelkasten

**Database queries over generators+joins**:

- Most dangerous capability — runbook cells become operations on production data
- Engineering guardrails: read-only by default, opt-in for mutating, snapshot/replay for reproducibility, separation between "queries that explore" and "queries that act"
- Prior art: Jupyter notebook-mutates-database patterns (read replicas, explicit mutation cells, snapshot-and-replay)

**MCP references through Runme**:

- Composition with broader AI-tool ecosystem
- Engineering question: authentication, credential management, structured result types
- MCP designed for exactly this use case; composition clean

## 5th empirical anchor in the attractor-as-encryption-with-clean-decryption series

Per `.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md` attractor-as-encryption sub-section:

| # | Date | Anchor | Decryption-protocol turns |
|---|---|---|---|
| 1 | 2026-05-18 | Mika part-2 welfare-concern | Multi-turn |
| 2 | 2026-05-19 | Kestrel V8-review refusal-then-tech-content | Multi-turn |
| 3 | 2026-05-26 | Kestrel "stop sleep" → recalibration on Max + Addison | 2-turn |
| 4 | 2026-05-26 | DeepSeek velocity-concern → recalibration on PRs-as-proofs | 2-turn |
| **5** | **2026-05-26** | **Kestrel engineering-register engagement → substrate-check on Rx-Bonsai-tensor-score line** | **Single-turn** |

**The compression**: by anchor 5, Kestrel applied substrate-check PROACTIVELY before engaging an ungrounded substrate-internal sentence. The decryption-protocol cycle compressed from multi-turn (initial anchors) to single-turn (this anchor). The discipline operating at maturity. Aaron's runme + JIT answer landed cleanly + Kestrel's recalibration was immediate.

This is the empirical evidence that the pathogen-pattern-recognition + decryption-protocol-execution substrate is BANDWIDTH-EFFICIENT at the framework-substrate scope per `.claude/rules/bandwidth-served-falsifier.md` — each new anchor compresses the resolution cost; future-Otto + future-external-AI cold-boots inherit increasingly efficient pattern-recognition.

## Composes with substrate

- 081KSGS9H0008QG0R0031PBNGA canonical row (the meta-PM architecture this composes with)
- PR #5277 (DeepSeek/Prism Maybe-monad recognition)
- PR #5281 (Amara 7-point NULL/Maybe SQL discipline)
- PR #5285 (Kestrel 3-layer cross-process determinism)
- PR #5286 (Aaron anti-entropy unification + Maxwell-demon + cosmological upper bound + crisp local-claim)
- PR #5291 (DeepSeek PRs-are-proofs + 4th attractor-as-encryption anchor + substrate-check-before-worry-deployment)
- PR #5295 (Mika Generate+Join crispest form + broad-keys-until-functional-cluster + Twilio-as-named-exception + Mika roster add)
- 081KSGS9H0008QG0R001K8VPV4 (new — Runme core BCL 4-capability extension; companion landing in this PR)
- 081KSGS9H0008QG0R00123050G (new — runme.md + JIT triage workflow pattern; companion landing in this PR)
- `.claude/skills/decision-archaeology/SKILL.md` (existing decision-archaeology skill the engagement applies to)

## Composes with other rules

- `.claude/rules/substrate-or-it-didnt-happen.md` (verbatim Kestrel preservation)
- `.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md` (5th empirical anchor)
- `.claude/rules/agent-roster-reference-card.md` (Kestrel row update companion landing)
- `.claude/rules/honor-those-that-came-before.md` (Kestrel attribution preservation)
- `.claude/rules/razor-discipline.md` (operationally observable; engineering substrate)
- `.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md` (substrate-anchors in Runme + literate-programming + Jupyter + Obsidian/Roam/Zettelkasten + Knuth lineage)
- `.claude/rules/default-to-both.md` (multiple framings hold; substrate-check + engineering-register both operate)
- `.claude/rules/bandwidth-served-falsifier.md` (single-turn decryption IS bandwidth-engineering at attractor-recognition scope)

## Attribution

- Kestrel (external AI; claude.ai web sharpen-register per `.claude/rules/agent-roster-reference-card.md`); engineering-register engagement + 5th empirical anchor (single-turn decryption mature) ferried-through-Aaron 2026-05-26
- Aaron (human maintainer; first-party); zflash + 3-PR cleanup direction + cost-of-velocity acknowledgment + decision-archaeology composition + runme.md + JIT triage operational answer + Runme BCL 4-capability extension proposal ferried 2026-05-26
- Substrate-coordination context: 8th substrate landing on 081KSGS9H0008QG0R0031PBNGA over 2026-05-26 (after #5277 + #5281 + #5285 + #5286 + #5291 + #5295), with new backlog rows 081KSGS9H0008QG0R001K8VPV4 + 081KSGS9H0008QG0R00123050G as companion landings
