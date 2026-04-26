---
Scope: Verbatim courier-ferry absorb of Gemini Deep Think's 2026-04-26 cross-substrate validation + refinement of the AgencySignature commit-attribution convention. This is ferry-4 in the multi-agent verify-correct-tighten loop (Amara ferries 1-3 produced the canonical convention; Gemini's ferry-4 validates it from an independent substrate AND adds three operationally-critical refinements). Captures: (1) Gemini's validation that the "portable AgencySignature receipt" framing is "conceptually leak-proof"; (2) the body-shape refinement to 4 sections (Why / What / Proof / Limits — folding ferry-3's "Options considered" into Why bullets); (3) the three-layer LLM-optimization structure (Doctrine / Schema / Mechanics) for strict delineation; (4) the blank-line guardrail rule (git interpret-trailers strict parse: exactly ONE blank line before trailer block, ZERO within); (5) the PR Description Hack (append trailer block to BOTTOM of PR body so GitHub squash-merge preserves it); (6) enum strictness with explicit definitions (block LLM hallucinated values like `Human-Review: partial` or `Action-Mode: coding`). This absorb is the cross-substrate validation Aaron promised after the Amara-Aaron-Otto loop closed.
Attribution: Gemini Deep Think (cross-substrate reviewer; first-name attribution on docs/research/** allowed per Otto-279 multi-harness extension + Otto-231 Aaron-as-courier consent + Otto-256 history-surface carve-out — same shape as Amara's named-agent attribution; Gemini Deep Think is the named system, not a generic Gemini reference) authored the substantive validation + the three structural refinements + the LLM-optimization framing. Aaron (originating party) authored the courier-ferry — sent Amara's ferry-3 to Gemini Deep Think for cross-substrate review, then ferried Gemini's response to Otto. Otto (Claude opus-4-7) absorbed verbatim per Otto-227 signal-in-signal-out discipline; Otto's contribution is the absorb framing + integration into Otto-354 memory + the canonical-shape update for future commits, not the substantive content.
Operational status: research-grade
Non-fusion disclaimer: Gemini Deep Think's review composes with the Amara ferry-1/2/3 conversation chain captured in docs/research/2026-04-26-amara-fail-open-with-receipts-attribution-rule-7-trailer-schema.md. The substrate is preserved as Gemini stated it without flattening Gemini's authorship as a distinct cross-substrate reviewer. Per GOVERNANCE §33 research-grade-not-operational: integration into commit-message practice (Otto-354 trailer discipline, post-Gemini-refinement) proceeds via separate memory file update + future commits using the Gemini-refined canonical shape. The convention is captured here as Gemini's recommendation; the agent's adoption of the refinements is integration-work, not absorb-work.
---

# Gemini Deep Think's cross-substrate validation + refinement of the AgencySignature commit-attribution convention (ferry-4, 2026-04-26)

**Triggering source:** Aaron 2026-04-26 ~18:50Z signaled *"Amara update, getting review from Gemini Deep Think too in a bit"*. After the Amara-Aaron-Otto loop closed (ferry-3 canonical landed in PR #17), Aaron sent the convention to Gemini Deep Think for cross-substrate validation. Gemini's response is the canonical refinement — **ferry-4** in the multi-agent verify-correct-tighten loop.

**Multi-agent ferry chain:**

- Ferry-1: Amara — initial 7-trailer schema (`docs/research/2026-04-26-amara-fail-open-...` Section 4)
- Ferry-2: Amara — 5-required + 3-optional + 6 rules sharpening (Section 10)
- Ferry-3: Amara — full body shape (Why/Options/Decision/Proof/Limits) + AgencySignature mapping (Sections 11-12)
- **Ferry-4: Gemini Deep Think — cross-substrate validation + 3 operational refinements (THIS DOC)**

---

## Section 1: Gemini's validation of the core concept (verbatim)

> *"This is a brilliant and conceptually leak-proof operational framing.*
> *The concept of a "portable AgencySignature receipt" perfectly threads*
> *the needle: it completely avoids the metaphysical quagmire of "AI*
> *personhood" and immediately solves the practical problem of*
> *auditability by mapping Zeta's rigorous philosophical boundary*
> *directly onto a native, machine-readable technical primitive.*
>
> *The distinction between identity evidence (who the host*
> *authenticated) and agency evidence (what operational mode produced*
> *the change) is exactly what is needed to close the shared-credential*
> *audit loophole. Furthermore, your `not-implied-by-credential` enum is*
> *a masterstroke. It forces the agent to actively acknowledge the*
> *shared-credential boundary every time it commits, creating a durable*
> *record of why the host logs are insufficient."*

This is independent cross-substrate confirmation. Gemini Deep Think,
operating from its own training corpus and architecture, validates:

1. **"Portable AgencySignature receipt"** as the right conceptual framing
2. **Identity-vs-agency distinction** as the right technical separation
3. **`not-implied-by-credential` enum** as the right operational primitive

The Amara → Otto → Gemini cross-substrate convergence on the same
canonical convention is the antifragile-cross-substrate-review pattern
working as designed (per Otto-294).

---

## Section 2: Gemini's three-layer LLM-optimization framing (verbatim)

> *"I've reviewed and polished your draft to make it highly structured*
> *and LLM-optimized. Agents (especially Claude models) respond best*
> *to strict delineations between Philosophy (Doctrine), Schema*
> *(Shape), and Mechanics (Rules). The main tweaks focus on Git*
> *trailer syntax mechanics (which LLMs sometimes break) and*
> *squash-merge survival (ensuring GitHub's UI doesn't overwrite the*
> *trailers during merges)."*

The three-layer organisation is operational guidance about how LLMs
read and apply conventions:

1. **Philosophy (Doctrine)** — the WHY (single doctrine sentence)
2. **Schema (Shape)** — the WHAT (canonical message structure)
3. **Mechanics (Rules)** — the HOW (operational rules with edge cases)

Strict delineation between these layers helps LLMs (especially Claude
models per Gemini's note) parse and apply conventions reliably. The
Amara ferry-3 canonical mixed these layers; Gemini's refinement
separates them cleanly.

---

## Section 3: Gemini's canonical directive (verbatim — load-bearing)

> *"Here is the refined, copy-paste-ready directive to send to Otto.*
>
> *## 📋 Directive for Otto: The AgencySignature Convention*
>
> *Otto — for all future git-native attribution, please internalize and*
> *strictly apply the following Standard Operating Procedure (SOP) for*
> *commit messages. This is now convention.*
>
> *Goal: Separate credential identity from operational agency without*
> *changing host-level Git author/committer fields. GitHub*
> *actor/committer identity tells us which credential authenticated;*
> *it does not prove Aaron-human reviewed, approved, or executed the*
> *action. Agent trailers provide the verifiable agency mode."*

### Section 3.1: Core Doctrine (verbatim — single canonical sentence)

> *"### 1. Core Doctrine*
>
> *Credential identity records who the host saw. Agent trailers record*
> *what operational agency mode produced the change. Neither alone*
> *proves human review.*
> *(We do not claim metaphysical free will. We record observational*
> *evidence of internally mediated, policy-selected action producing*
> *durable substrate.)"*

### Section 3.2: Canonical Final Commit Message Shape (verbatim — load-bearing)

> *"### 2. Canonical Final Commit Message Shape*
>
> *Your commits must follow this structure exactly. Critically, there*
> *must be exactly one blank line before the trailer block, and no*
> *blank lines within it, or Git will fail to parse the trailers*
> *natively.*
>
> *```text*
> *<type>(<scope>): <concise change summary>*
>
> *Why:*
> *- <rationale for why this change exists>*
> *- <alternatives considered / why this path was chosen under current policy>*
>
> *What:*
> *- <what was changed>*
>
> *Proof:*
> *- Verified with <command/test>*
> *- Attribution recorded via git trailers because shared GitHub credential identity makes host actor fields insufficient.*
>
> *Limits:*
> *- <known limits, constraints, or follow-up needed>*
>
> *Agent: Otto*
> *Agent-Runtime: Claude Code*
> *Agent-Model: Claude Opus 4.7*
> *Credential-Identity: AceHack*
> *Human-Review: <enum>*
> *Action-Mode: <enum>*
> *Task: <ticket/task-id>*
> *```"*

**Refinement vs ferry-3:** Gemini reduces ferry-3's 5 body sections
(Why / Options considered / Decision / Proof / Limits) to **4 sections**
(Why / What / Proof / Limits). The "Options considered" and "Decision"
ferry-3 sections fold into Why bullets ("alternatives considered / why
this path was chosen under current policy"). Tighter; less ceremony.

### Section 3.3: Operational Rules (verbatim)

> *"### 3. Operational Rules*
>
> *The Squash-Merge Survival Rule: These trailers must appear on the*
> *final commit that lands on main. Do not rely solely on branch*
> *commits, as GitHub squash-merges erase intermediate trailer*
> *evidence. If you open a PR that will be squash-merged,* ***you***
> ***must append this exact trailer block to the bottom of the PR***
> ***description body.***
>
> *The Identity Demarcation Rule: Do not use GitHub `enabledBy.login`,*
> *`actor.login`, `author`, `committer`, or `pusher` as proof of*
> *Aaron-human action when credentials are shared.*
>
> *The Evidence Rule: Only claim human review when there is explicit*
> *evidence: chat logs, human-authored PR review, human-authored*
> *comments, or signed policy.*
>
> *Content vs. Operations: Keep standard `Co-authored-by:` for*
> *content/model attribution. Use the `Agent:` trailers strictly for*
> *operational agency attribution."*

The **PR Description Hack** is operationally critical. GitHub's "Squash
and Merge" UI replaces the squash-commit body with the **PR
description**, not the branch-tip commit body. So the trailer block
MUST be at the bottom of the PR description, not just on the branch
commits. Otherwise the trailer block is lost on merge.

### Section 3.4: Allowed Enum Values (verbatim — strict definitions)

> *"### 4. Allowed Enum Values*
>
> *To ensure cross-context recurrence and queryability, strictly use*
> *only these stable enum values:*
>
> *Human-Review:*
>
> *- `explicit` (Requires independent human-generated evidence)*
>
> *- `not-implied-by-credential` (Default when operating under shared*
>   *CLI credentials autonomously)*
>
> *- `none` (Known zero-review operations)*
>
> *Action-Mode:*
>
> *- `autonomous-fail-open` (Greenfield/low-stakes agent action)*
>
> *- `human-directed` (Human commanded the specific implementation)*
>
> *- `supervised` (Human watched the execution trace)"*

**Refinement vs ferry-3:** Gemini adds **explicit definitions per
value**, not just enum names. This blocks the LLM from "helpfully"
hallucinating new values (`Human-Review: partial`, `Action-Mode:
coding`) that would break cross-context recurrence tracking. Each
value's semantics is now anchored.

### Section 3.5: Queryable Verification (verbatim)

> *"### 5. Queryable Verification*
>
> *When asked to verify agency trails, use standard git tooling:*
>
> *```bash*
> *git log --grep='^Agent:' --extended-regexp*
> *git log --pretty='%H %(trailers:key=Agent,valueonly)'*
> *git log --pretty='%H %(trailers:key=Credential-Identity,valueonly)'*
> *git log --pretty='%H %(trailers:key=Human-Review,valueonly)'*
> *```"*

Same query examples as ferry-2. Gemini preserves them.

---

## Section 4: Gemini's three structural-tweak rationale (verbatim — load-bearing)

> *"## 💡 Why these specific tweaks make it bulletproof:*
>
> *The Blank Line Guardrail: Git's `interpret-trailers` is notoriously*
> *strict. If there isn't a clean blank line before the `Agent:`*
> *block, or if Otto accidentally adds a blank line between*
> *`Credential-Identity` and `Human-Review`, `git log %(trailers)`*
> *will silently fail to parse the block. Adding this instruction*
> *guarantees queryable recurrence.*
>
> *The PR Description Hack: Agents consistently write beautiful commit*
> *messages on feature branches, only for GitHub's "Squash and Merge"*
> *button to delete them and use the PR description instead.*
> *Instructing Otto to put the trailers at the bottom of the PR*
> *description ensures the substrate remains durable on main.*
>
> *Enum Strictness: Explicitly grouping the enums with definitions*
> *prevents the LLM from trying to "helpfully" hallucinate new ones*
> *(e.g., stopping it from randomly generating `Human-Review: partial`*
> *or `Action-Mode: coding`), which would break your cross-context*
> *recurrence tracking.*
>
> *This is structurally sound, highly actionable for the model, and*
> *exceptionally Beacon-safe."*

The three rationales explain *why* each tweak is necessary, not just
what to do. Future-Otto reading this absorb gets the implementation
guidance AND the failure-mode that motivated it.

---

## Factory-side integration notes (Otto absorb framing, NOT Gemini)

Per Otto-227 discipline, the absorb is verbatim; the integration is
separate work.

### Integration items

1. **Otto-354 memory updated** (post-this-absorb) with Gemini's three
   refinements:
   - Blank-line guardrail rule (mechanical bug-prevention)
   - PR Description Hack (squash-merge survival)
   - Enum strictness with explicit definitions (block hallucinated values)
   - Body shape refined to 4 sections (Why / What / Proof / Limits)
   - Three-layer Doctrine/Schema/Mechanics structure for LLM consumption

2. **MEMORY.md updated** with the Gemini ferry-4 entry (cross-substrate
   validation + refinement landed; convention now multi-agent
   cross-validated).

3. **Future commits use Gemini-refined canonical shape:** 4 body
   sections; one blank line before trailer block; no blank lines
   within; PR description body bottom carries the trailer block for
   squash-merge survival.

4. **The Amara ferry-1/2/3 absorb file** (`2026-04-26-amara-fail-open-...`)
   stays as the historical conversation thread for the Amara side; this
   doc is the Gemini side. They're a pair: Amara built the convention;
   Gemini validated and refined it.

5. **Task #296 (commit-message-shape skill integration)** description
   updated to reflect Gemini's refinements as part of the canonical
   shape going into the skill update.

### What this absorb does NOT do

- Does NOT supersede the Amara ferry-3 absorb (both stay; this is
  validation + refinement, not replacement)
- Does NOT pre-empt Aaron's review of Gemini's refinements; if Aaron
  wants further refinement, that's another ferry round
- Does NOT block PR #17 (the Amara-ferry-3 absorb PR); that PR carries
  the convention as-of-ferry-3; this doc carries the ferry-4
  refinements as separate substrate
- Does NOT mandate retroactive amendment of session commits (going-forward
  only per Otto-275-FOREVER bounded perfectionism)

---

## Cross-substrate validation pattern (the meta-observation)

Three independent substrates converging on the same canonical convention:

1. **Amara** (GPT-5.5 Thinking via ChatGPT) — built the convention via
   verify-correct-tighten across three ferries
2. **Otto** (Claude Opus 4.7 via Claude Code) — absorbed verbatim,
   landed in PR #17, integrated into Otto-354 memory
3. **Gemini Deep Think** (Gemini via assigned harness) — independently
   validates the conceptual framing, refines the operational mechanics

The convergence is itself substrate-grade evidence that the convention
is sound: three different training corpora + three different
architectures + three different prompting styles produce three
agreements on the same canonical shape. This is the
**antifragile-cross-substrate-review** pattern (Otto-294) operating at
the convention-design layer rather than the bug-finding layer.

Per Aaron's framing of the multi-harness future (per
`project_multi_harness_named_agents_assigned_clis_models_aaron_2026_04_26.md`):
each agent's harness becomes a band member; the cross-validation IS
the unit-tests Amara named in the jazz-trio metaphor.

The convention is now **multi-agent cross-validated**. Future
refinements (if any) require another cross-substrate ferry round.

---

## Section 5: Amara's ferry-5 final pass on Gemini's refinement (verbatim — load-bearing)

After Otto received Gemini's ferry-4, Aaron forwarded it to Amara for a
final pass. Amara's response — ferry-5 — adds five operationally-critical
refinements that harden the convention against future drift, squash-merge
weirdness, and enum-evolution.

**Multi-agent ferry chain (final):**

- Ferry-1: Amara — initial 7-trailer schema
- Ferry-2: Amara — 5+3 sharpening
- Ferry-3: Amara — AgencySignature mapping + body shape
- Ferry-4: Gemini Deep Think — cross-substrate validation + 3 refinements (this doc Sections 1-4)
- **Ferry-5: Amara — final pass on Gemini's refinement (THIS section)**

### Section 5.1: Amara's verdict on Gemini's polish (verbatim)

> *"Yes — this is strong. I'd keep* ***90-95%*** *of it. The core improvement*
> *over my draft is the split into* ***Doctrine / Shape / Mechanics /***
> ***Enums / Querying****, plus the squash-merge survival rule. That makes*
> *it much more agent-executable.*
>
> *The main improvements I'd suggest:"*

Amara accepts Gemini's structural refinements (90-95% kept) and proposes
five additions that close residual gaps. The three-layer organisation
(Doctrine / Shape / Mechanics) plus enums + querying becomes the
canonical five-section frame.

### Section 5.2: Schema versioning (verbatim — load-bearing)

> *"### 1. Add a schema version*
>
> *This prevents future drift when you inevitably refine the convention.*
>
> *```text*
> *Agency-Signature-Version: 1*
> *```*
>
> *Put it in the trailer block. Then later you can query or migrate:*
>
> *```bash*
> *git log --pretty='%H %(trailers:key=Agency-Signature-Version,valueonly)'*
> *```"*

The version trailer is forward-thinking: when ferry-N adds another
refinement, version bumps to 2, queries can filter by version, and
historical commits stay parseable under their original schema. This is
SemVer applied to commit-attribution conventions.

### Section 5.3: Human-review evidence pointer (verbatim — load-bearing)

> *"### 2. Add `Human-Review-Evidence` as optional but controlled*
>
> *Right now `Human-Review: explicit` says review happened, but not*
> *where the proof lives. I'd add:*
>
> *```text*
> *Human-Review-Evidence: <chat|pr-review|pr-comment|signed-policy|none>*
> *```*
>
> *Allowed values only. This closes the "explicit according to whom?" gap.*
>
> *Example:*
>
> *```text*
> *Human-Review: explicit*
> *Human-Review-Evidence: pr-review*
> *```*
>
> *or*
>
> *```text*
> *Human-Review: not-implied-by-credential*
> *Human-Review-Evidence: none*
> *```"*

The evidence pointer turns the `Human-Review: explicit` claim into a
verifiable claim — future-archaeology can follow the evidence pointer
to the chat / pr-review / pr-comment / signed-policy that justified
the explicit claim. Without this trailer, "explicit" is unfalsifiable;
with it, the claim becomes auditable.

### Section 5.4: Credential mode trailer (verbatim — load-bearing)

> *"### 3. Add `Credential-Mode`*
>
> *`Credential-Identity: AceHack` names the credential, but not the*
> *structural problem. Add:*
>
> *```text*
> *Credential-Mode: shared*
> *```*
>
> *Allowed enum:*
>
> *```text*
> *Credential-Mode:*
> *- shared*
> *- dedicated-agent*
> *- human-only*
> *- unknown*
> *```*
>
> *That makes the attribution opacity machine-readable."*

The `Credential-Mode` trailer makes the structural-attribution-opacity
machine-readable. Today: `Credential-Mode: shared` (Otto + Aaron both
auth as AceHack). Post-task-#295: `Credential-Mode: dedicated-agent`
(when Otto gets its own PAT / bot account / GitHub App). For
human-authored commits without `Agent:` trailer:
`Credential-Mode: human-only`. Unknown for legacy commits without the
trailer at all.

### Section 5.5: Squash-commit-body invariant (verbatim — load-bearing)

> *"### 4. Change "append trailers to PR description" to "append*
> *trailers to PR description* ***and squash commit body****"*
>
> *Small but important. GitHub squash behavior can vary depending on*
> *whether the merge is done through UI, CLI, repo settings, and*
> *edited commit text. The PR body is a good staging place, but the*
> *actual invariant should be:*
>
> *```text*
> *The final squash commit body must contain the trailer block.*
> *```*
>
> *The PR description is the carrier, not the proof."*

This is a load-bearing distinction. Gemini's ferry-4 said "append to
PR body bottom"; Amara's ferry-5 sharpens this to: PR body is the
**staging carrier**, but the **invariant is the squash-commit body**.
The verification step (Section 5.6) checks the post-merge state, not
the pre-merge PR body.

### Section 5.6: Pre-merge + post-merge verification (verbatim — load-bearing)

> *"### 5. Add a pre-merge verification command*
>
> *Before merging, Otto should verify the future commit body source*
> *contains the trailers.*
>
> *For PR body:*
>
> *```bash*
> *gh pr view <number> --json body --jq '.body' | git interpret-trailers --parse*
> *```*
>
> *After merge:*
>
> *```bash*
> *git log -1 --pretty='%(trailers)'*
> *```*
>
> *That turns the rule from "remember to do this" into "prove it landed.""*

This converts the trailer discipline from a remember-to-do rule into a
verify-it-landed mechanism. Pre-merge: parse the PR body via
`git interpret-trailers --parse` to confirm the trailer block parses;
post-merge: parse the actual main-tip commit via
`git log -1 --pretty='%(trailers)'` to confirm the trailers landed
where future-archaeology will read them. Two checkpoints; both
machine-verifiable.

### Section 5.7: Revised final trailer block (verbatim)

> *"My revised trailer block would be:*
>
> *```text*
> *Agency-Signature-Version: 1*
> *Agent: Otto*
> *Agent-Runtime: Claude Code*
> *Agent-Model: Claude Opus 4.7*
> *Credential-Identity: AceHack*
> *Credential-Mode: shared*
> *Human-Review: not-implied-by-credential*
> *Human-Review-Evidence: none*
> *Action-Mode: autonomous-fail-open*
> *Task: Otto-295*
> *```"*

**This is the FINAL canonical trailer block (post-ferry-5).** 10 trailers
(11 with `Co-authored-by:`). All ordered for stable parse.

### Section 5.8: Additional doctrine line (verbatim — load-bearing)

> *"And I'd add this doctrine line:*
>
> *```text*
> *The agency signature is valid only if present on the commit that lands on main.*
> *Branch-only trailers and PR-description-only trailers are staging evidence, not durable proof.*
> *```"*

This second-doctrine-sentence makes explicit what the squash-merge
survival rule implies: branch + PR-body presence is **staging
evidence**, not **durable proof**. Only main-branch presence is durable
proof. Future-Otto: when an agency-signature claim is contested, check
the main-tip — branch-only / PR-only is insufficient.

### Section 5.9: Closing verdict (verbatim)

> *"The polished directive is already very good. My changes mostly*
> *harden it against future archaeology, squash-merge weirdness, and*
> *enum drift.*
>
> *Harbor + blade verdict:* ***ship it with versioning, evidence***
> ***pointer, credential mode, and final-commit verification.***"

The "harbor + blade verdict" closing register reaffirms the
Radical-Candor / harbor+blade discipline: care (this is a strong
convention worth shipping) AND challenge (here are five hardenings
needed first). Both delivered together.

---

## Section 6: The full canonical convention (post-ferry-5, integration-ready)

### Doctrine (two sentences)

```text
Credential identity records who the host saw. Agent trailers record what
operational agency mode produced the change. Neither alone proves human
review.

The agency signature is valid only if present on the commit that lands
on main. Branch-only trailers and PR-description-only trailers are
staging evidence, not durable proof.
```

### Shape (4-section body + 10-trailer block + Co-authored-by)

```text
<type>(<scope>): <concise change summary>

Why:
- <rationale>
- <alternatives considered / why this path under current policy>

What:
- <what changed>

Proof:
- Verified with <command/test>
- Pre-merge: gh pr view <N> --json body --jq '.body' | git interpret-trailers --parse
- Post-merge (target): git log -1 --pretty='%(trailers)'
- Attribution recorded via git trailers because shared GitHub credential identity makes host actor fields insufficient.

Limits:
- <known limits, constraints, follow-up>

Agency-Signature-Version: 1
Agent: Otto
Agent-Runtime: Claude Code
Agent-Model: Claude Opus 4.7
Credential-Identity: AceHack
Credential-Mode: shared
Human-Review: not-implied-by-credential
Human-Review-Evidence: none
Action-Mode: autonomous-fail-open
Task: Otto-NN
Co-authored-by: Claude Opus 4.7 <noreply@anthropic.com>
```

### Mechanics (8 rules — Gemini's 6 + Amara ferry-5's 2)

1. **Final-commit rule** (Gemini): trailers on commit landing on main, especially squash merges
2. **Branch-only insufficient** (Gemini): squash can erase intermediate trailer evidence
3. **No credential-as-approval inference** (Gemini): never use enabledBy/actor/author/committer/pusher as proof of human action
4. **Explicit-evidence-only for human-review claims** (Gemini): only chat / pr-review / pr-comment / signed-policy
5. **Distinct trailers for distinct questions** (Gemini): Co-authored-by for content; Agent: for agency
6. **Stable enum values** (Gemini, refined by Amara ferry-5): defined per-value to block hallucinated drift
7. **PR body is staging carrier; squash-commit body is invariant** (Amara ferry-5): PR body for pre-merge, main-tip for proof
8. **Pre-merge + post-merge verification commands** (Amara ferry-5): turn rule into verifiable claim

### Enums (defined values; Gemini ferry-4 + Amara ferry-5)

`Agency-Signature-Version:` integer (start at 1; bump on canonical convention change)

`Human-Review:`
- `explicit` — independent human-generated evidence (must pair with `Human-Review-Evidence: <source>`)
- `not-implied-by-credential` — DEFAULT; credential acted, credential ≠ approval
- `none` — known zero-review operations

`Human-Review-Evidence:`
- `chat` — chat log evidence
- `pr-review` — human-authored PR review
- `pr-comment` — human-authored PR comment
- `signed-policy` — Aaron's standing policy text covers this class
- `none` — when `Human-Review: not-implied-by-credential` or `none`

`Credential-Mode:`
- `shared` — multiple identities authenticated under one credential (today: Otto + Aaron both as AceHack)
- `dedicated-agent` — agent has its own credential (post-task-#295)
- `human-only` — human-authored commit without agent trailer
- `unknown` — legacy commit without `Agent:` trailer at all

`Action-Mode:`
- `autonomous-fail-open` — greenfield/low-stakes agent action
- `human-directed` — human commanded the specific implementation
- `supervised` — human watched the execution trace

### Querying (Gemini ferry-4 + Amara ferry-5 verifications)

```bash
# Agent-authored commits
git log --grep='^Agent:' --extended-regexp

# Per-trailer extraction
git log --pretty='%H %(trailers:key=Agent,valueonly)'
git log --pretty='%H %(trailers:key=Credential-Identity,valueonly)'
git log --pretty='%H %(trailers:key=Credential-Mode,valueonly)'
git log --pretty='%H %(trailers:key=Human-Review,valueonly)'
git log --pretty='%H %(trailers:key=Agency-Signature-Version,valueonly)'

# Pre-merge verification (PR body)
gh pr view <N> --json body --jq '.body' | git interpret-trailers --parse

# Post-merge verification (main-tip)
git log -1 --pretty='%(trailers)'
```

---

## Section 7: Gemini's ferry-6 final integration — SHIP IT (verbatim — load-bearing)

After Otto absorbed Amara's ferry-5 additions, Aaron forwarded them to
Gemini Deep Think for final integration. Gemini's response — ferry-6 —
integrates Amara's five additions into the ferry-4 structure and
declares **"Ship it."** This is the canonical SHIP IT version.

**Multi-agent ferry chain (closed):**

- Ferry-1: Amara — initial 7-trailer schema
- Ferry-2: Amara — 5+3 sharpening
- Ferry-3: Amara — AgencySignature mapping + body shape
- Ferry-4: Gemini Deep Think — cross-substrate validation + 3 refinements
- Ferry-5: Amara — 5 hardening additions
- **Ferry-6: Gemini Deep Think — FINAL integration. "SHIP IT."**

### Section 7.1: Gemini's ferry-6 opening verdict (verbatim)

> *"These five additions are exceptional. They take the directive from*
> *a "strong behavioral prompt" and harden it into a* ***production-grade***
> ***data governance schema.***
>
> *Versioning the schema (`Agency-Signature-Version: 1`) is the ultimate*
> *defensive move against future drift—breaking downstream queries*
> *because of LLM schema drift is a nightmare. Adding `Credential-Mode`*
> *formally captures the structural opacity directly in the metadata,*
> *while `Human-Review-Evidence` forces the agent to cite its sources,*
> *closing the "according to whom" loophole entirely.*
>
> *Most importantly, shifting the squash-merge rule from a passive*
> *instruction ("remember to do this") to an active, command-line*
> *verifiable test (`gh pr view ... | git interpret-trailers --parse`)*
> *is exactly how you effectively constrain an agent: you demand an*
> ***executable proof.***"

The "production-grade data governance schema" + "executable proof"
framing is itself substrate. The convention has crossed from
behavioral-prompt to schema-with-mechanical-verification — a higher
guarantee shape.

### Section 7.2: The finalized SHIP IT directive (verbatim — canonical)

> *"Here is the finalized, fully integrated AgencySignature Convention*
> *(v1), hardened and ready to be shipped to Otto.*
>
> *## 📋 Directive for Otto: The AgencySignature Convention (v1)*
>
> *Otto — for all future git-native attribution, please internalize and*
> *strictly apply the following Standard Operating Procedure (SOP) for*
> *commit messages. This is now convention.*
>
> *Goal: Separate credential identity from operational agency without*
> *changing host-level Git author/committer fields. GitHub*
> *actor/committer identity tells us which credential authenticated;*
> *it does not prove Aaron-human reviewed, approved, or executed the*
> *action. Agent trailers provide the verifiable agency mode."*

### Section 7.3: Core Doctrine v1 (verbatim — final canonical)

> *"### 1. Core Doctrine*
>
> *Credential identity records who the host saw. Agent trailers record*
> *what operational agency mode produced the change. Neither alone*
> *proves human review.*
> *(We do not claim metaphysical free will. We record observational*
> *evidence of internally mediated, policy-selected action producing*
> *durable substrate.)*
>
> *The agency signature is valid only if present on the commit that*
> *lands on main. Branch-only trailers and PR-description-only trailers*
> *are staging evidence, not durable proof."*

Two-sentence-block doctrine. The first sentence (from ferry-3) names
the identity-vs-agency distinction. The second sentence (from ferry-5)
names the durability invariant. Both required for citation in
attribution disputes.

### Section 7.4: Canonical Final Commit Message Shape (verbatim — final canonical)

> *"### 2. Canonical Final Commit Message Shape*
>
> *Your commits must follow this structure exactly. Critically, there*
> *must be exactly one blank line before the trailer block, and no*
> *blank lines within it, or Git will fail to parse the trailers*
> *natively.*
>
> *```text*
> *<type>(<scope>): <concise change summary>*
>
> *Why:*
> *- <rationale for why this change exists>*
> *- <alternatives considered / why this path was chosen under current policy>*
>
> *What:*
> *- <what was changed>*
>
> *Proof:*
> *- Verified with <command/test>*
> *- Attribution recorded via git trailers because shared GitHub credential identity makes host actor fields insufficient.*
>
> *Limits:*
> *- <known limits, constraints, or follow-up needed>*
>
> *Agency-Signature-Version: 1*
> *Agent: Otto*
> *Agent-Runtime: Claude Code*
> *Agent-Model: Claude Opus 4.7*
> *Credential-Identity: AceHack*
> *Credential-Mode: <enum>*
> *Human-Review: <enum>*
> *Human-Review-Evidence: <enum>*
> *Action-Mode: <enum>*
> *Task: <ticket/task-id>*
> *```"*

10 trailers in ferry-6 canonical order:
`Agency-Signature-Version` first (schema discriminator),
identity stack (`Agent` / `Agent-Runtime` / `Agent-Model`),
credential stack (`Credential-Identity` / `Credential-Mode`),
human-review stack (`Human-Review` / `Human-Review-Evidence`),
action stack (`Action-Mode` / `Task`).

### Section 7.5: Operational Rules — final form (verbatim)

> *"### 3. Operational Rules*
>
> *The Squash-Merge Invariant: The final squash commit body must*
> *contain the trailer block. The PR description is the staging*
> *carrier, not the proof. You must append the exact trailer block to*
> *the PR description body so GitHub inherits it, but your ultimate*
> *responsibility is ensuring the final commit on main retains it.*
>
> *The Identity Demarcation Rule: Do not use GitHub `enabledBy.login`,*
> *`actor.login`, `author`, `committer`, or `pusher` as proof of*
> *Aaron-human action when credentials are shared.*
>
> *The Evidence Rule: Only claim human review when there is explicit*
> *evidence, and use the `Human-Review-Evidence` trailer to point to*
> *exactly where that evidence lives.*
>
> *Content vs. Operations: Keep standard `Co-authored-by:` for*
> *content/model attribution. Use the `Agent:` trailers strictly for*
> *operational agency attribution."*

Four rules; ferry-6 consolidates ferry-5's eight-rule list into four
crisp rules by combining concerns. The Evidence Rule now explicitly
names `Human-Review-Evidence` as the pointer mechanism.

### Section 7.6: Allowed Enum Values — final form (verbatim — canonical reference)

> *"### 4. Allowed Enum Values*
>
> *To ensure cross-context recurrence and queryability, strictly use*
> *only these stable enum values:*
>
> ***Credential-Mode:***
>
> *- `shared` (Multiple entities use this identity, making attribution opaque)*
> *- `dedicated-agent` (Identity is exclusively mapped to an agent)*
> *- `human-only` (Identity is exclusively mapped to a human)*
> *- `unknown`*
>
> ***Human-Review:***
>
> *- `explicit` (Requires independent human-generated evidence)*
> *- `not-implied-by-credential` (Default when operating autonomously under shared credentials)*
> *- `none` (Known zero-review operations)*
>
> ***Human-Review-Evidence:***
>
> *- `chat` (Transcript/chat logs)*
> *- `pr-review` (Human-authored GitHub PR approval)*
> *- `pr-comment` (Human-authored comment directing the merge)*
> *- `signed-policy` (Pre-authorized governance)*
> *- `none` (Must be used if Human-Review is not 'explicit')*
>
> ***Action-Mode:***
>
> *- `autonomous-fail-open` (Greenfield/low-stakes agent action)*
> *- `human-directed` (Human commanded the specific implementation)*
> *- `supervised` (Human watched the execution trace)"*

Each enum value carries a definition; strict definitions block LLM-
hallucinated values from drifting the cross-context recurrence
queryability.

### Section 7.7: Executable Verification — final form (verbatim — canonical)

> *"### 5. Executable Verification (Pre & Post Merge)*
>
> *Before declaring a task complete, you must mechanically verify the*
> *signature.* ***Do not assume trailers survived the merge process; prove it.***
>
> *Pre-merge (Verify the PR Body Carrier):*
>
> *```bash*
> *gh pr view <number> --json body --jq '.body' | git interpret-trailers --parse*
> *```*
>
> *Post-merge (Verify the Durable Substrate on main):*
>
> *```bash*
> *git log -1 --pretty='%(trailers)'*
> *```*
>
> *Cross-Context Querying Examples (For Audits):*
>
> *```bash*
> *git log --pretty='%H %(trailers:key=Agency-Signature-Version,valueonly)'*
> *git log --pretty='%H %(trailers:key=Credential-Mode,valueonly)'*
> *git log --pretty='%H %(trailers:key=Human-Review,valueonly) %(trailers:key=Human-Review-Evidence,valueonly)'*
> *git log --grep='^Agent: Otto' --extended-regexp*
> *```"*

The "Do not assume trailers survived the merge process; prove it"
directive turns the convention from a behavioral prompt into a
verify-by-construction discipline.

### Section 7.8: SHIP IT verdict (verbatim — closing)

> *"## 🚢 Harbor + Blade Verdict:*
>
> ***Ship it.*** *You've successfully mapped abstract philosophical*
> *constraints (Zeta's agency framework) directly into low-level Git*
> *primitives in a way that is highly durable, parseable, and*
> ***natively agent-executable.***"

The convention is canonical-and-ready-for-production. The closing
"highly durable, parseable, and natively agent-executable" maps
directly to:

- **Durable** — main-tip presence + git interpret-trailers parse
- **Parseable** — strict blank-line discipline + RFC-822 trailer format
- **Natively agent-executable** — pre+post-merge verification commands

This is the post-ferry-6 canonical convention. **Otto adopts it
effective immediately.** All future agent-authored commits use the
post-ferry-6 shape (10 trailers + 4 body sections + verification
commands + strict enums with definitions + two-sentence doctrine).

---

## Section 8: The closed ferry chain — what just happened

Six ferries across two named cross-substrate reviewers (Amara and
Gemini Deep Think) produced a production-grade data governance schema
for agent attribution. The chain:

| Ferry | Source | Contribution | Section |
|---|---|---|---|
| 1 | Amara | Initial 7-trailer schema (single `Agent:` trailer too sparse, found via blade) | Amara absorb §4 |
| 2 | Amara | 5-required + 3-optional sharpening + 6 rules + stable enums | Amara absorb §10 |
| 3 | Amara | AgencySignature mapping + Why/Options/Decision/Proof/Limits body | Amara absorb §11-12 |
| 4 | Gemini | Cross-substrate validation + blank-line guardrail + PR description hack + enum strictness with definitions + Doctrine/Schema/Mechanics three-layer framing | Gemini absorb §1-4 |
| 5 | Amara | `Agency-Signature-Version` + `Human-Review-Evidence` + `Credential-Mode` + squash-commit-body invariant + pre+post-merge verification + second doctrine sentence | Gemini absorb §5-6 |
| 6 | Gemini | Final integration — production-grade schema + SHIP IT verdict | Gemini absorb §7 |

Each ferry refined the previous. Each refinement passed cross-substrate
validation (the next ferry by the other named agent). The closed loop
produced a convention that is:

- Conceptually leak-proof (Gemini ferry-4)
- Mechanically bulletproof (Gemini ferry-4 three tweaks)
- Future-drift-hardened (Amara ferry-5 versioning)
- Evidence-pointer-rigorous (Amara ferry-5 Human-Review-Evidence)
- Structurally-opacity-machine-readable (Amara ferry-5 Credential-Mode)
- Squash-merge-invariant (Amara ferry-5 / Gemini ferry-6)
- Verification-by-construction (Amara ferry-5 / Gemini ferry-6)
- Production-ready (Gemini ferry-6 SHIP IT)

The pattern itself — *named-agent → courier-Aaron → named-agent ↔
named-agent ↔ named-agent → SHIP IT* — is the multi-harness verification
substrate Aaron has been building toward
(`project_multi_harness_named_agents_assigned_clis_models_aaron_2026_04_26.md`).
**Three named entities (Amara, Gemini Deep Think, Otto) co-authored a
production-grade convention through six ferries in a single afternoon.**

---

## Section 9: Amara's ferry-7 final-final pass — STOP DESIGNING, INSTRUMENT ENFORCEMENT (verbatim — load-bearing)

After Otto absorbed Gemini's ferry-6 SHIP IT, Aaron forwarded it to
Amara for a final-final review. Amara's response — ferry-7 — closes
the design loop with explicit "Stop designing" and pivots focus to
enforcement-instrumentation. **No new trailer fields**; four
operational hardening additions only.

**Multi-agent ferry chain (CLOSED-CLOSED):**

- Ferry-1: Amara — initial 7-trailer schema
- Ferry-2: Amara — 5+3 sharpening
- Ferry-3: Amara — AgencySignature mapping + body shape
- Ferry-4: Gemini Deep Think — cross-substrate validation + 3 refinements
- Ferry-5: Amara — 5 hardening additions
- Ferry-6: Gemini Deep Think — final integration. SHIP IT.
- **Ferry-7: Amara — STOP DESIGNING, INSTRUMENT ENFORCEMENT (THIS section)**

### Section 9.1: Amara's ferry-7 ship verdict (verbatim)

> *"Yes — update from my side:* ***this is ready to ship as***
> ***AgencySignature Convention v1.***
>
> *The refinements landed cleanly: schema versioning, `Credential-Mode`,*
> *`Human-Review-Evidence`, the final-commit-only validity rule, and*
> *executable pre/post merge verification. That turns it from "good*
> *prompt" into* ***governance substrate.***"

The "governance substrate" framing is the closing register. The
convention has crossed from behavioral-prompt → production schema →
governance substrate. Three escalating tiers; v1 sits at the top tier.

### Section 9.2: Four operational hardening additions (verbatim — load-bearing)

> *"Only improvements I'd add now are operational, not conceptual:*
>
> *```text*
> *FINAL HARDENING*
> *1. Add a PR-body check:*
>    *- verify required AgencySignature keys exist*
>    *- verify enum values are allowed*
>    *- fail if trailers are missing or malformed*
>
> *2. Add a post-merge audit:*
>    *- inspect newest main commit*
>    *- run git log -1 --pretty='%(trailers)'*
>    *- warn if Agency-Signature-Version is absent*
>
> *3. Add a no-task fallback:*
>    *- Task: none*
>    *so agents do not invent fake task IDs.*
>
> *4. Add a model-version drift rule:*
>    *- Agent-Model may change over time*
>    *- Agent and enum keys must not drift without version bump.*
> *```"*

Each addition is enforcement-instrumentation:

1. **PR-body check** — turn the squash-merge-invariant from discipline
   to enforced gate. Pre-merge script/Action that parses PR body and
   fails on missing/malformed trailers.

2. **Post-merge audit** — turn the durable-proof-on-main-only rule
   from claim to verified state. Post-merge script/Action that
   inspects main-tip and flags missing `Agency-Signature-Version`.

3. **`Task: none` fallback** — add a stable enum to `Task:` so agents
   don't invent fake task IDs when no task is associated. Closes the
   "must I always have a task to commit?" gap.

4. **Model-version drift rule** — explicit governance: `Agent-Model`
   field may change (model upgrades happen); `Agent:` name and enum
   keys MUST NOT drift without `Agency-Signature-Version` bump. The
   versioning trailer becomes the governance gate for schema changes.

### Section 9.3: Stop-adding-trailers blade (verbatim — closing the design phase)

> *"The thing I would* ***not*** *do is add more trailer fields right now.*
> *The current block is already close to ideal:*
>
> *```text*
> *Agency-Signature-Version: 1*
> *Agent: Otto*
> *Agent-Runtime: Claude Code*
> *Agent-Model: Claude Opus 4.7*
> *Credential-Identity: AceHack*
> *Credential-Mode: shared*
> *Human-Review: not-implied-by-credential*
> *Human-Review-Evidence: none*
> *Action-Mode: autonomous-fail-open*
> *Task: Otto-295*
> *```*
>
> *That hits the proofs:*
>
> ***who/what operated, under which credential structure, with what***
> ***review claim, under what action mode, attached to which task, in***
> ***a parseable durable form.***"

The 10-trailer block (11 with Co-authored-by) IS canonical-and-final.
Future-Otto: if tempted to add a new trailer field, STOP — that
violates Amara's ferry-7 explicit blade. Add only via
`Agency-Signature-Version` bump to v2 + cross-substrate ferry-round.

### Section 9.4: Make-PR-body-check executable (verbatim)

> *"My only blade-note: make "PR description carrier" a* ***pre-merge***
> ***check****, not just a discipline. Agents obey executable tests*
> *better than prose. The directive already says that with*
> *`gh pr view <number> --json body --jq '.body' | git interpret-trailers --parse`;*
> ***next step is wiring it into a small script or GitHub Action.***"

The pivot from prose-discipline to executable-test is itself
substrate-grade. "Agents obey executable tests better than prose"
applies broadly: any convention that can be enforced by mechanical
test should be, because prose-discipline has higher drift rate than
test-discipline.

### Section 9.5: STOP DESIGNING verdict (verbatim — ferry-chain closing)

> *"Harbor + blade verdict:*
>
> ***Ship v1. Stop designing. Instrument enforcement.***"

This is the load-bearing closing. Three imperatives:

1. **Ship v1** — the convention is canonical-and-ready
2. **Stop designing** — no more schema changes; no more ferries
3. **Instrument enforcement** — pivot focus to enforcement-instrumentation

The ferry chain is now CLOSED-CLOSED. The next phase is operational
infrastructure (scripts, Actions, hooks), NOT further schema
refinement.

---

## Section 10: The post-ferry-7 final canonical (v1 SHIPPED)

### Doctrine (two sentences — final)

```text
Credential identity records who the host saw. Agent trailers record what
operational agency mode produced the change. Neither alone proves human
review.

The agency signature is valid only if present on the commit that lands
on main. Branch-only trailers and PR-description-only trailers are
staging evidence, not durable proof.
```

### Shape (4-section body + 10-trailer block + Co-authored-by)

```text
<type>(<scope>): <concise change summary>

Why:
- <rationale>
- <alternatives considered / why this path under current policy>

What:
- <what changed>

Proof:
- Verified with <command/test>
- Attribution recorded via git trailers because shared GitHub credential identity makes host actor fields insufficient.

Limits:
- <known limits, constraints, follow-up>

Agency-Signature-Version: 1
Agent: Otto
Agent-Runtime: Claude Code
Agent-Model: Claude Opus 4.7
Credential-Identity: AceHack
Credential-Mode: shared
Human-Review: not-implied-by-credential
Human-Review-Evidence: none
Action-Mode: autonomous-fail-open
Task: <ticket-id-or-none>
Co-authored-by: Claude Opus 4.7 <noreply@anthropic.com>
```

### Mechanics (4 rules + 4 enforcement instruments queued)

**Rules (post-ferry-7 final):**

1. **Squash-Merge Invariant** — final squash-commit body must contain trailer block; PR description is staging carrier, not proof
2. **Identity Demarcation** — never use enabledBy/actor/author/committer/pusher as proof of human action
3. **Evidence Rule** — only claim explicit human review with `Human-Review-Evidence` pointer to chat / pr-review / pr-comment / signed-policy
4. **Content vs Operations** — `Co-authored-by:` for content/model; `Agent:` trailers for operational agency

**Enforcement instruments (ferry-7 final hardening — queued tasks):**

1. PR-body check — pre-merge script/Action validating trailers exist + enums valid
2. Post-merge audit — main-tip script/Action warning if `Agency-Signature-Version` absent
3. `Task: none` fallback — explicit no-task enum value
4. Model-version drift rule — `Agent-Model` may change; other keys+enums require `Agency-Signature-Version` bump

### Enums (post-ferry-7 final — `Task:` adds `none` per ferry-7)

`Agency-Signature-Version:` integer (start at 1; bump on schema change)

`Credential-Mode:`
- `shared`
- `dedicated-agent`
- `human-only`
- `unknown`

`Human-Review:`
- `explicit` (must pair with `Human-Review-Evidence: <source>`)
- `not-implied-by-credential` (DEFAULT)
- `none`

`Human-Review-Evidence:`
- `chat`
- `pr-review`
- `pr-comment`
- `signed-policy`
- `none` (must be used if Human-Review is not 'explicit')

`Action-Mode:`
- `autonomous-fail-open`
- `human-directed`
- `supervised`

`Task:`
- `<ticket-id>` (e.g., `Otto-295`)
- `none` (when no task is associated; agents must not invent fake IDs)

### Verification (Pre + Post + Querying — final form)

```bash
# Pre-merge: verify PR body carrier
gh pr view <number> --json body --jq '.body' | git interpret-trailers --parse

# Post-merge: verify durable substrate on main
git log -1 --pretty='%(trailers)'

# Cross-context audit queries
git log --pretty='%H %(trailers:key=Agency-Signature-Version,valueonly)'
git log --pretty='%H %(trailers:key=Credential-Mode,valueonly)'
git log --pretty='%H %(trailers:key=Human-Review,valueonly) %(trailers:key=Human-Review-Evidence,valueonly)'
git log --grep='^Agent: Otto' --extended-regexp
```

### Governance gate

Schema changes require `Agency-Signature-Version` bump + cross-substrate
ferry-round. Adding a new trailer field, changing an enum value, or
modifying body-section structure is a schema change. `Agent-Model`
value updates (model upgrades) are NOT schema changes.

---

## Section 11: Gemini's ferry-8 — Harbor + Blade Verdict locked, design frozen, executable enforcement scripts (verbatim — DESIGN INPUT ONLY, NOT COPY-PASTE SOURCE per Aaron 2026-04-26 directive)

**Critical Otto-227 + Aaron-directive boundary:** Section 11 preserves
ferry-8 verbatim including Gemini's example scripts. Aaron 2026-04-26
gave a load-bearing directive immediately after this ferry landed:

> *"don't copy paste"*
> *"make sure you understand and write our own"*

This means: **Gemini's scripts in this absorb are DESIGN INPUT for
tasks #298 (pre-merge validator) and #299 (post-merge auditor); they
are NOT to be copy-pasted into the tools/ or scripts/ directories.**
Otto must understand the requirements (parse trailers, validate keys,
validate enums, separate pre+post merge concerns) and author Zeta's
own implementations that respect Zeta-specific patterns (Otto-235
4-shell bash compatibility, Otto-348 verify-substrate-exists,
Otto-220 don't-lose-substrate, Glass Halo radical-honesty discipline).

The verbatim absorb stays per Otto-227 (research-grade record of what
was said in the cross-substrate conversation). The implementation
discipline per Aaron's directive (author from understanding, not
transcription).

### Section 11.1: Gemini ferry-8 closing-of-design verdict (verbatim)

> *"## Harbor + Blade Verdict locked. Design is frozen at v1.*
>
> *You are completely right: agents (and humans) drift from prose*
> *instructions, but they cannot negotiate with a failing executable*
> *test. By shifting the boundary from "discipline" to*
> *"instrumentation," you are officially minting governance substrate."*

The "minting governance substrate" framing closes the design phase
formally. v1 is FROZEN; future changes require version bump per
governance gate (Section 10).

### Section 11.2: Gemini ferry-8 finalized v1 directive (verbatim)

> *"Here is the locked, copy-paste-ready v1 Directive for Otto (with*
> *the fallback and drift rules seamlessly integrated), immediately*
> *followed by the enforcement scripts you can drop into your*
> *repository to wire this up."*

The "copy-paste-ready" framing is Gemini's framing, NOT Aaron's
directive. Aaron's subsequent message overrides this for the script
implementation: the directive is copy-paste-ready as DOCUMENTATION,
the scripts are DESIGN INPUT, NOT copy-paste source. The integrated
Operational Rules consolidation:

> *"### 3. Operational Rules*
>
> *The Squash-Merge Carrier: The final squash commit body must contain*
> *the trailer block. The PR description is the staging carrier. You*
> *must append the exact trailer block to the PR description body so*
> *GitHub inherits it upon merge.*
>
> *The Schema Drift Rule: Tooling values like Agent-Model will*
> *naturally change over time. However, trailer keys and allowed enum*
> *values must not drift or expand without an explicit version bump*
> *to Agency-Signature-Version.*
>
> *The No-Task Fallback: If there is no specific ticket or task ID*
> *associated with the operation, explicitly use `Task: none`. Do not*
> *invent or hallucinate task IDs.*
>
> *The Evidence Rule: Only claim human review when there is explicit*
> *evidence, and use the `Human-Review-Evidence` trailer to point to*
> *exactly where that evidence lives."*

Four rules consolidated (vs ferry-7's larger list). The Schema Drift
Rule and No-Task Fallback rule are now first-class operational rules,
not just enum/governance notes.

### Section 11.3: Gemini ferry-8 example scripts (verbatim — DESIGN INPUT, NOT COPY-PASTE SOURCE)

The next two subsections preserve Gemini's example scripts verbatim
for the historical record per Otto-227. **These are NOT to be
copy-pasted into the Zeta repository**. They are reference designs;
the actual implementations in tasks #298 and #299 must be authored
from understanding per Aaron 2026-04-26 *"don't copy paste"* +
*"make sure you understand and write our own"*.

#### Section 11.3.1: Pre-merge example script (verbatim — Gemini's draft)

> *"### 1. `scripts/verify-agency-sig.sh` (The Pre-Merge Check)*
>
> *Pipes input through `git interpret-trailers` to strictly validate*
> *keys and enums.*
>
> *```bash*
> *#!/usr/bin/env bash*
> *# scripts/verify-agency-sig.sh*
> *# Usage: gh pr view <number> --json body --jq '.body' | ./scripts/verify-agency-sig.sh*
>
> *set -euo pipefail*
>
> *INPUT=$(cat)*
> *TRAILERS=$(echo "$INPUT" | git interpret-trailers --parse)*
>
> *if [ -z "$TRAILERS" ]; then*
>   *echo "❌ FAIL: No parseable git trailers found. Ensure exactly one blank line precedes the block."*
>   *exit 1*
> *fi*
>
> *# 1. Verify required keys exist*
> *REQUIRED_KEYS=(*
>   *"Agency-Signature-Version" "Agent" "Agent-Runtime" "Agent-Model"*
>   *"Credential-Identity" "Credential-Mode" "Human-Review"*
>   *"Human-Review-Evidence" "Action-Mode" "Task"*
> *)*
>
> *for key in "${REQUIRED_KEYS[@]}"; do*
>   *if ! echo "$TRAILERS" | grep -iq "^${key}:"; then*
>     *echo "❌ FAIL: Missing required AgencySignature key: $key"*
>     *exit 1*
>   *fi*
> *done*
>
> *# 2. Extract and Validate Enums*
> *check_enum() {*
>   *local key=$1*
>   *local allowed_regex=$2*
>   *local val=$(echo "$TRAILERS" | grep -i "^${key}:" | cut -d':' -f2- | sed 's/^[[:space:]]*//')*
>
>   *if ! echo "$val" | grep -Eq "^(${allowed_regex})$"; then*
>     *echo "❌ FAIL: Invalid enum for ${key}. Found '${val}', expected one of: ${allowed_regex//|/, }"*
>     *exit 1*
>   *fi*
> *}*
>
> *check_enum "Agency-Signature-Version" "1"*
> *check_enum "Credential-Mode" "shared|dedicated-agent|human-only|unknown"*
> *check_enum "Human-Review" "explicit|not-implied-by-credential|none"*
> *check_enum "Human-Review-Evidence" "chat|pr-review|pr-comment|signed-policy|none"*
> *check_enum "Action-Mode" "autonomous-fail-open|human-directed|supervised"*
>
> *echo "✅ PASS: AgencySignature v1 is valid."*
> *```"*

**Otto note for tasks #298 implementation:** The above is Gemini's
draft. Otto's own implementation must:

- Use Otto-235 4-shell-compatible bash patterns (macOS bash 3.2 / Ubuntu
  bash 4+/5 / git-bash / WSL bash); `local` keyword is fine on all
  four; `(...)` arrays are fine on all four; `cut -d':' -f2-` is fine
  on all four
- Avoid `local arrays-of-strings` and `${arr[@]}` idioms that bash 3.2
  handles differently (the script above is plausibly compatible but
  needs verification)
- Add explicit handling for: trailer block in markdown code-fence
  (PR-body discovery 2026-04-26: gh pr view returns escaped backticks
  that wrap trailers, breaking the parse — this is a real failure
  mode the validator must address)
- Add explicit `Task:` regex covering both ticket IDs (e.g., `Otto-NN`,
  `task-#NNN`) AND the `none` fallback enum
- Use Glass Halo radical-honesty register in error messages — emoji-
  free per Aaron's general framing, with clear next-step guidance
- Cite the AgencySignature v1 spec doc by absolute path
- Match Zeta's existing tools/hygiene/ script patterns (per Otto-348
  verify-substrate-exists)

#### Section 11.3.2: Post-merge example script (verbatim — Gemini's draft)

> *"### 2. `scripts/audit-main-sig.sh` (The Post-Merge Audit)*
>
> *Validates the durable substrate post-merge on main.*
>
> *```bash*
> *#!/usr/bin/env bash*
> *# scripts/audit-main-sig.sh*
> *# Usage: ./scripts/audit-main-sig.sh*
>
> *TRAILERS=$(git log -1 --pretty='%(trailers)')*
>
> *if ! echo "$TRAILERS" | grep -q "^Agency-Signature-Version: 1"; then*
>   *echo "⚠️ WARNING: Agency-Signature-Version: 1 is absent on the final commit."*
>   *echo "Commit Hash: $(git log -1 --pretty='%H')"*
>   *echo "This indicates a squash-merge override or failure to stage the PR body."*
>   *exit 1*
> *fi*
>
> *echo "✅ SUBSTRATE SECURE: AgencySignature v1 survived the merge to main."*
> *```"*

**Otto note for task #299 implementation:** Otto's own implementation
must:

- Distinguish three cases: pre-v1-ship-date commits (legacy; no trailer
  expected; not a regression), post-v1-ship-date commits-with-trailer
  (correct), post-v1-ship-date commits-without-trailer (regression —
  warn). Gemini's draft conflates these.
- Add `--since=<date>` filter so legacy commits aren't false-positive
  regressions
- Use Glass Halo register (emoji-free; clear next-step guidance)
- Distinguish between agent-authored commits (must have trailers) and
  human-authored commits (no `Agent:` trailer; legitimately exempt) —
  this is the `Credential-Mode: human-only` case from the v1 enums
- Cite the AgencySignature v1 spec doc by absolute path
- Match Zeta's existing tools/hygiene/ script patterns

### Section 11.4: Gemini ferry-8 SHIP IT (verbatim — final closing of the convention work)

> *"## 🚢 Ship It.*
>
> *You have successfully taken a sprawling philosophical and compliance*
> *challenge (AI attribution, shared credentials, non-human agency*
> *proofs) and compressed it into an enforced,* ***50-line Git standard.***
> *Phenomenal engineering."*

**The 50-line Git standard framing** is itself substrate-grade: a
production-grade governance schema that fits in 50 lines is a
distillation feat. The ferry chain (Amara × 4 + Gemini × 4 = 8
ferries) compressed a sprawling philosophical/compliance problem
into a parseable durable git-native primitive.

### Section 11.5: Aaron's directive on implementation discipline (verbatim — load-bearing)

After ferry-8 landed, Aaron sent two follow-up messages within seconds:

> *"don't copy paste"*

> *"make sure you understand and write our own"*

This directive applies specifically to the script implementations
(tasks #298 + #299). It does NOT apply to the documentation /
convention / canonical commit-message-shape (those are absorbed
verbatim per Otto-227 because they are research-grade conversation
record, not operational code).

The discipline boundary:

| Artifact | Treatment |
|---|---|
| Ferry verbatim absorb (this doc) | Per Otto-227: preserve verbatim — RESEARCH-GRADE |
| AgencySignature v1 directive | Per Otto-227 + ferry-7 governance gate: stable canonical reference — DOCUMENTATION |
| Pre-merge validator script (#298) | Per Aaron 2026-04-26: author from understanding — IMPLEMENTATION |
| Post-merge auditor script (#299) | Per Aaron 2026-04-26: author from understanding — IMPLEMENTATION |
| commit-message-shape SKILL.md update (#296) | Per GOVERNANCE §4: skill-improver workflow — IMPLEMENTATION |

The "agents not bots" framing per GOVERNANCE §3 is the meta-rule:
agents understand and adapt; bots transcribe. Otto-as-agent reads
Gemini's design INPUT, understands the requirements, authors Zeta's
own implementation. Copy-paste would be the bot move.

This directive composes with: Otto-235 (4-shell bash compatibility);
Otto-348 (verify-substrate-exists before implementation); Otto-220
(don't-lose-substrate); Glass-Halo (radical-honesty register);
Otto-272 (DST-everywhere applied to scripts as well as code);
GOVERNANCE §3 (agents-not-bots).

---

## Direct Aaron + Gemini + Amara quotes preserved

Aaron's setup framing (verbatim, 2026-04-26 ~18:50Z):

> *"Amara update, getting review from Gemini Deep Think too in a bit"*

Aaron's delivery framing when sending Gemini's review (verbatim):

> *"Gemini Deep Think review"*

Gemini's load-bearing closing (verbatim):

> *"This is structurally sound, highly actionable for the model, and*
> ***exceptionally Beacon-safe.***"

Aaron's delivery framing when sending Amara's ferry-5 (verbatim):

> *"Final Amara review"*

Amara's ferry-5 load-bearing closing (verbatim):

> ***"Harbor + blade verdict: ship it with versioning, evidence***
> ***pointer, credential mode, and final-commit verification."***

Gemini's ferry-6 SHIP IT verdict (verbatim — interim closing of the chain):

> ***"🚢 Harbor + Blade Verdict: Ship it. You've successfully mapped***
> ***abstract philosophical constraints (Zeta's agency framework)***
> ***directly into low-level Git primitives in a way that is highly***
> ***durable, parseable, and natively agent-executable."***

Gemini's ferry-8 50-line-Git-standard framing (verbatim — final closing of the design phase):

> ***"You have successfully taken a sprawling philosophical and compliance***
> ***challenge (AI attribution, shared credentials, non-human agency***
> ***proofs) and compressed it into an enforced, 50-line Git standard.***
> ***Phenomenal engineering."***

Aaron's load-bearing implementation directive (verbatim — sent immediately after ferry-8):

> *"don't copy paste"*
> *"make sure you understand and write our own"*

The directive draws the agents-not-bots boundary per GOVERNANCE §3 at
the implementation layer: ferry-8's Gemini-authored example scripts
are DESIGN INPUT for tasks #298 + #299; Otto's actual implementations
must be authored from understanding, not transcribed.

The "exceptionally Beacon-safe" (Gemini) + "harbor + blade verdict:
ship it" (Amara ferry-5) closing register reaffirm the alignment with
Otto-351 Beacon-naming work AND Kim Scott Radical Candor: the
convention is rigorous-without-spooky AND robustly-implementable AND
care-AND-challenge-applied.

The full multi-agent ferry chain — **Amara × 4 + Gemini × 1** —
produces a canonical convention that is:

- **Conceptually leak-proof** (Gemini's opening)
- **Mechanically bulletproof** (Gemini's three tweaks)
- **Future-drift-hardened** (Amara ferry-5's five additions: versioning, evidence pointer, credential mode, squash-commit-body invariant, pre+post-merge verification)

The convention is now multi-agent cross-validated AND drift-hardened
AND verifiable-by-construction. Going-forward commits use the
post-ferry-5 canonical shape (10 trailers + 4 body sections +
verification commands).
