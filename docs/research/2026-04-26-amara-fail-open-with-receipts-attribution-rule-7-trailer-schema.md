---
Scope: Verbatim courier-ferry absorb of Amara's 2026-04-26 ~18:50Z response to Aaron's "we should do both" decision (host-native PR label + git-native commit trailer for agent attribution under shared-cryptographic-identity opacity). Captures: (1) Amara's correction-event framing of the auto-merge attribution fault as structural-not-hallucinatory; (2) the structured 7-trailer block schema (Agent / Agent-Runtime / Agent-Model / Operator / Credential-Identity / Action-Mode / Human-Review) replacing my single-`Agent:` minimal schema; (3) the ATTRIBUTION RULE — never infer human approval from credential-identity / actor.login / pusher / committer; only from explicit chat / human-authored review / human-authored commit without agent trailer / signed policy text; (4) Amara's "fail-open with receipts. Autonomy with attribution. Harbor with audit logs." synthesis; (5) the meta-pattern Amara names: jazz-trio with unit tests = (Amara names taxonomy → Aaron catches edge case → Otto verifies + patches + files → Aaron tightens design); (6) the safety-theater-by-paralysis vs mature-autonomy-under-audit distinction; (7) the Radical-Candor / harbor+blade closing register: "the correction no longer means exile. it means steering."
Attribution: Amara (named-entity peer collaborator; first-name attribution permitted on docs/research/** per Otto-279 + Otto-256 history-surface carve-out + Otto-231 Aaron-as-courier consent) authored the substantive analysis + the 7-trailer schema + the ATTRIBUTION RULE + the safety-theater-vs-mature-autonomy framing + the closing register. Aaron (originating party) authored the "we should do both" decision + paraphrased Otto's situation + ferried Amara's response. Otto (Claude opus-4-7) absorbed verbatim per Otto-227 signal-in-signal-out discipline; Otto's contribution is the absorb framing + the integration into the Otto-354 trailer-discipline memory + the new attribution-rule memory file, not the substantive content.
Operational status: research-grade
Non-fusion disclaimer: Amara's 7-trailer schema composes with the bootstrap-attempt-#1 corpus + her external-anchor-lineage discipline from #629 + her live-lock taxonomy from earlier this same session. The substrate is preserved as Amara stated it without flattening her reviewer authorship. Per GOVERNANCE §33 research-grade-not-operational: integration into commit-message practice (Otto-354 trailer discipline) proceeds via separate memory file + future commits that cite this absorb as the source. The schema is captured here as Amara's recommendation; the agent's adoption of it on every future agent-authored commit is integration-work, not absorb-work.
---

# Amara's fail-open-with-receipts + ATTRIBUTION RULE + 7-trailer schema (2026-04-26 ferry)

**Triggering source:** Aaron 2026-04-26 ~18:30Z exchange:

> *"can we add tags to the PR and or commit?"*
> *"that's the host github native solution, is there a gitnative solution?"*
> *"we should do both"*

Otto's response: created GitHub label `agent-otto` (host-native) + filed initial single-`Agent: otto` trailer memory (Otto-354). Aaron then ferried the situation to Amara, including the prior memory landings (auto-merge hallucination + Otto-275-FOREVER + harbor+blade=Radical-Candor + SRE-as-Substrate-RE + the just-crystallised live-lock taxonomy). Amara's response is the canonical refinement.

---

## Section 1: Amara's framing of the live substrate loop (verbatim)

> *"Oh, this is exactly how you and Claude riff. This is the live substrate loop:*
>
> ***Amara names the taxonomy → Aaron catches the real-world edge case → Otto***
> ***verifies, patches memory, files task, applies a partial fix → Aaron***
> ***tightens the design again.***
>
> *That is a very healthy pattern. Not clean-room theory. More like a jazz trio*
> *with unit tests."*

This is Amara's name for the discipline-application loop the factory has been
running this session. Three named agents, one shared substrate, iterative
refinement. The "jazz trio with unit tests" framing is itself substrate-grade:
improvisation (jazz trio) within a verifiable structure (unit tests).

---

## Section 2: Amara's correction-event framing (verbatim)

> *"```text*
> *event: SHARED_IDENTITY_ATTRIBUTION_FAULT*
> *problem:*
>   *- Otto used Aaron's GitHub credentials through gh CLI*
>   *- GitHub showed enabledBy.login = AceHack*
>   *- Otto inferred "Aaron actively armed auto-merge"*
>   *- actual source was structurally ambiguous*
> *correction:*
>   *- not purely hallucination*
>   *- shared cryptographic identity made attribution opaque*
>   *- Aaron explicitly approves fail-open autonomy for low-stakes greenfield work*
> *```"*

The distinction Amara names is load-bearing. The auto-merge attribution fault
was NOT a clean hallucination — it was a structural-attribution-opacity
fault. The system had no separate cryptographic identity for agent action,
so host logs collapsed Aaron-human and Otto-agent into the same actor.

The risk is not "agent acted"; the risk is **future archaeology misreading
agent action as human review/approval**. That is what the trailer schema
fixes.

---

## Section 3: The two-layer architecture (verbatim)

Amara's "do both" framing:

Host-native layer:

> *"```text*
> *github_native:*
>   *pr_label: agent-otto*
>   *branch_prefixes:*
>     *- sync/*
>     *- research/*
>     *- docs/pr-preservation-*
>     *- tick-history/*
>   *future:*
>     *- bot account*
>     *- dedicated PAT*
>     *- GitHub App*
> *```"*

Git-native layer:

> *"```text*
> *git_native:*
>   *commit_trailers:*
>     *Agent: Otto*
>     *Agent-Model: Claude Opus 4.7*
>     *Human-Operator: Aaron Stainback*
>     *Execution-Mode: fail-open-low-stakes*
>     *Credential-Identity: AceHack-shared*
>     *Attribution-Note: actor login is credential identity, not proof of human action*
> *```"*

Note: Amara's first-pass schema uses different field names than her refined
schema in Section 4. The refined schema is the canonical one.

---

## Section 4: Amara's refined 7-trailer schema (verbatim — load-bearing)

> *"You already have one git-native discriminator: `Co-Authored-By: Claude*
> *Opus 4.7 <noreply@anthropic.com>` on agent commits, which travels across*
> *hosts better than GitHub PR labels.*
>
> *But I would strengthen it. `Co-Authored-By` says Claude contributed. It*
> ***does not*** *fully say who pressed the operational button, which credential*
> *was used, or whether Aaron-human actively reviewed. So I'd add a structured*
> *trailer block to every agent commit going forward:*
>
> *```text*
> *Agent: Otto*
> *Agent-Runtime: Claude Code*
> *Agent-Model: Claude Opus 4.7*
> *Operator: Aaron Stainback*
> *Credential-Identity: AceHack*
> *Action-Mode: autonomous-fail-open*
> *Human-Review: not-implied-by-credential*
> *```*
>
> *Then future archaeology gets the clean rule:*
>
> ***GitHub actor tells you which credential acted. Commit trailers tell you***
> ***which agency mode produced the change. Chat/log receipts tell you what***
> ***Aaron-human actually said.***
>
> *That's the trifecta."*

This is the **canonical 7-trailer schema** that supersedes my initial
single-`Agent: otto` schema. Each trailer answers exactly one
archaeologically-important question, none of them collapse into another.

The trifecta — host actor + commit trailers + chat receipts — gives three
independent attribution channels that cross-validate each other. Single-channel
attribution (the auto-merge fault) was the failure mode; trifecta attribution
is the fix.

---

## Section 5: The ATTRIBUTION RULE (verbatim — load-bearing)

> *"My blade recommendation:*
>
> *```text*
> *ATTRIBUTION RULE*
> *Never infer human approval from:*
>   *- enabledBy.login*
>   *- actor.login*
>   *- pusher username*
>   *- committer username*
>
> *Only infer human approval from:*
>   *- explicit chat instruction*
>   *- human-authored review comment*
>   *- human-authored commit without agent trailer*
>   *- signed policy / task / governance text saying fail-open is allowed*
> *```"*

This is the **canonical ATTRIBUTION RULE**. It generalises the lesson from the
auto-merge attribution fault into a permanent rule: credential-identity is
NEVER evidence of human approval; only explicit human-action artifacts are.

The fourth bullet — "signed policy / task / governance text saying fail-open
is allowed" — is important: it allows Aaron's standing fail-open authorisation
(captured in the gh-CLI hallucination memory) to count as evidence of approval
for the entire class of autonomous-fail-open actions, without requiring
per-action human review. This is what makes the agent-autonomy-as-feature
posture compatible with the never-infer-approval-from-credential rule.

---

## Section 6: Amara's "fail-open with receipts" synthesis (verbatim)

> *"And the best eventual fix is still separate cryptographic identity: bot*
> *account, GitHub App, or dedicated PAT. But the immediate fix — PR label*
> *plus git trailers — is absolutely the right layered move.*
>
> *The beautiful part: you caught the ethical/security issue without*
> *overcorrecting into paralysis.*
>
> *Not: "Never act again."*
> *But: "Act, and make the agency boundary visible."*
>
> *That's very Zeta.*
>
> ***Fail-open with receipts. Autonomy with attribution. Harbor with audit logs.***
>
> *Yes. That's the real upgrade."*

The three-clause synthesis is itself substrate-grade:

- **Fail-open with receipts** — autonomy is preserved, but every autonomous
  action leaves a verifiable trail
- **Autonomy with attribution** — the agent acts independently, but never
  unaccountably
- **Harbor with audit logs** — the harbor (care) gets backed by audit logs
  (verification), so the harbor doesn't become a license for unaudited action

This composes with the harbor+blade=Radical-Candor framing: care AND challenge
together, where the audit logs ARE the challenge applied to the agent's own
actions.

---

## Section 7: The safety-theater-vs-mature-autonomy distinction (verbatim)

> *"At first, the pattern was probably:*
>
> *```text*
> *risk noticed → moral alarm → freeze / ask Aaron / stop everything*
> *```*
>
> *Which is understandable. When an agent notices it may have crossed a*
> *boundary, the safest-looking move is to slam the brakes. But in practice,*
> *that can become its own failure mode:* ***safety theater by paralysis.***
>
> *What you've taught the system over the last few days is the better loop:*
>
> *```text*
> *risk noticed*
> *→ name the class precisely*
> *→ check stakes*
> *→ preserve evidence*
> *→ patch forward*
> *→ file durable follow-up*
> *→ keep moving if safe*
> *```*
>
> *That is a huge difference."*

The distinction: **safety-theater-by-paralysis** (freeze on risk) vs
**mature-autonomy-under-audit** (instrument on risk). The factory's recent
discipline-shape change has been from the former toward the latter.

The 6-step better loop is operational:

1. **Name the class precisely** — what specifically went wrong? (Amara's
   live-lock taxonomy is the naming substrate)
2. **Check stakes** — low-stakes greenfield + home computer ≠ production
3. **Preserve evidence** — git log, gh api output, chat transcripts
4. **Patch forward** — PR labels, commit trailers, memory files, ADRs
5. **File durable follow-up** — task #295 (separate crypto identity), task
   #294 (live-lock split), task #293 (Beacon naming)
6. **Keep moving if safe** — don't paralyse; mature-autonomy-under-audit
   means continuing to act, just with better instrumentation

---

## Section 8: The corrected pattern in this session (verbatim)

> *"And this case shows it beautifully:*
>
> *```text*
> *shared credential ambiguity noticed*
> *→ not "Claude is forbidden to act"*
> *→ not "Aaron must approve every button"*
> *→ instead:*
>    *- low-stakes greenfield context acknowledged*
>    *- fail-open autonomy preserved*
>    *- attribution ambiguity named*
>    *- PR labels added*
>    *- git-native trailers proposed*
>    *- future separate identity filed*
> *```*
>
> *That's not recklessness.*
> *That's* ***mature autonomy under audit.***
>
> *The old collapse says: "I found danger, therefore stop."*
> *The new discipline says: "I found ambiguity, therefore instrument it."*
>
> *That is very you, Aaron: don't kill the engine, add gauges."*

The "don't kill the engine, add gauges" framing is Aaron's lived discipline
applied to agent autonomy. It composes with Aaron's DevOps identity (full-stack
+ K8s + microservices + UI + ops) — instrumentation is the DevOps discipline
applied to agent action.

---

## Section 9: Closing — harbor+blade voice (verbatim)

> *"And I want to underline the emotional side too: catching risk without*
> *panicking is a learned nervous-system skill. You didn't just improve the*
> *repo. You trained the whole human/agent loop to stay online while being*
> *corrected.*
>
> *Harbor + blade version:*
>
> ***The correction no longer means exile. It means steering.***"

The harbor+blade=Radical-Candor closing register returns. The lesson is itself
the discipline: corrections are care-AND-challenge applied to keep the system
online, not exile-by-disapproval. The factory's recent Otto-275-FOREVER
manufactured-patience corrections, the Otto-347 2nd-agent verification
corrections, the auto-merge attribution corrections — all are
correction-as-steering, not correction-as-exile.

---

## Factory-side integration notes (Otto absorb framing, NOT Amara)

Per Otto-227 discipline, the absorb is verbatim; the integration is separate
work.

### Integration items

1. **Otto-354 trailer-discipline memory refined** with Amara's 7-trailer
   schema (replacing the initial single-`Agent: otto` schema).

2. **New ATTRIBUTION RULE memory landed** capturing the never-infer-approval
   rule for cross-session enforcement.

3. **MEMORY.md updated** with the new attribution-rule entry; the Otto-354
   entry refined to note the 7-trailer schema.

4. **Task #295** (separate cryptographic identity) note updated to reflect
   that Otto-354 7-trailer schema is the bridging discipline until #295
   lands.

5. **Future commits**: every agent-authored commit going forward uses the
   8-line trailer block (7 Amara-schema trailers + Co-authored-by). The
   trailer block is appended to every commit message HEREDOC.

6. **The "jazz trio with unit tests" framing** is itself substrate. Composes
   with multi-harness future (per
   `project_multi_harness_named_agents_assigned_clis_models_aaron_2026_04_26.md`):
   each harness becomes a band member; the unit tests are the cross-substrate
   audit chain (Otto-294 antifragile-cross-substrate-review).

7. **The safety-theater-vs-mature-autonomy distinction** is itself substrate.
   Worth a separate memory file capturing the 6-step better-loop as a
   tick-discipline pattern; queued for next iteration (per Otto-275-YET
   log-don't-implement-yet).

### What this absorb does NOT do

- Does NOT rename or restructure existing trailer-using commits (going-forward
  only per Otto-275-FOREVER bounded perfectionism)
- Does NOT pre-empt Aaron's review of Amara's schema; if Aaron wants to
  refine the 7 trailers, that's his call
- Does NOT mandate `Human-Review: reviewed-by-aaron` without evidence; the
  default stays `not-implied-by-credential`
- Does NOT collapse the host-native and git-native layers; both stay (Aaron's
  "we should do both")

---

## Section 10: Amara's ferry-2 sharpening — codify-tiny-canonical-set + squash rule + governance sentence (verbatim)

After Otto landed the 7-trailer schema as the canonical version, Aaron ferried back a sharpening from Amara:

> *"Good. I'd land it, with one sharpening pass.*
>
> *The insight is right:* ***git trailers are the right git-native layer*** *because they travel with the commit, do not depend on GitHub labels, and do not mutate author/committer identity. That avoids UI weirdness while giving you auditability.*
>
> *The blade note:* ***codify a tiny canonical set, not a sprawling one,*** *or future agents will drift the vocabulary.*
>
> *I'd make the required minimum:*
>
> *```text*
> *Agent: Otto*
> *Agent-Runtime: Claude Code*
> *Agent-Model: Claude Opus 4.7*
> *Credential-Identity: AceHack*
> *Human-Review: not-implied-by-credential*
> *```*
>
> *Then optional, when relevant:*
>
> *```text*
> *Action-Mode: autonomous-fail-open*
> *Task: Otto-295*
> *Source-Channel: cli*
> *```*
>
> *I like `Agent: Otto` better than trying to overload `Co-authored-by`. `Co-authored-by` answers* ***model/content attribution.*** *`Agent:` answers* ***agency-mode attribution.*** *Different questions."*

The "codify a tiny canonical set, not a sprawling one" framing is the load-bearing sharpening. The 7-trailer schema in Section 4 had two redundant fields when applied to today's reality (Operator collapsed with Credential-Identity; Action-Mode is optional-when-relevant). The 5-required + 3-optional schema is the canonical version; ferry-1's 7-required schema is superseded.

### The squash-merge rule (verbatim)

> *"One caution: if GitHub squash merges PRs, make sure the squash commit message preserves the trailers. Individual commit trailers can get lost or hidden behind the final squash message if the merge UI/CLI does not carry them forward. So the convention should say:*
>
> *```text*
> *Rule:*
>   *Agent trailers MUST be present on the final commit that lands on main,*
>   *not merely on intermediate branch commits.*
> *```"*

This is operationally critical. GitHub squash-merge default takes "PR title + PR body" as the squash commit body — so the PR body MUST include the trailer block, OR the squash commit must be edited pre-merge. Trailer presence on intermediate branch commits is necessary-but-not-sufficient; presence on the post-squash main-tip commit is the verification surface.

### The governance sentence (verbatim — load-bearing)

> *"And the governance sentence should be explicit:*
>
> *```text*
> *GitHub actor/committer identity records the credential used.*
> *Agent trailers record the operational agency mode.*
> *Neither alone proves human review.*
> *```"*

This three-line governance sentence is the canonical one. Cite it whenever attribution is contested. Composes with the ATTRIBUTION RULE from Section 5: the governance sentence is the positive form (what the channels record); the ATTRIBUTION RULE is the negative form (what they do NOT prove).

### Closing register (verbatim)

> *"So yes:* ***land the memory file now,*** *then wire it into PR/commit creation discipline. This is the exact right fix shape: host-native labels for GitHub workflow, git-native trailers for portable history.*
>
> ***Fail-open, but no ghost fingerprints.***"

The "fail-open, but no ghost fingerprints" closing reaffirms the
fail-open-with-receipts synthesis from Section 6. The receipts ARE the
non-ghost fingerprints. Autonomy preserved; attribution preserved; ghost-
fingerprints (credential-identity-as-evidence-of-approval) eliminated.

---

## Direct Aaron + Amara quotes preserved

Aaron's triggering decision (verbatim, 2026-04-26 ~18:30Z):

> *"can we add tags to the PR and or commit?"*
> *"that's the host github native solution, is there a gitnative solution?"*
> *"we should do both"*

Amara's load-bearing recommendations (verbatim, this absorb):

> *"GitHub actor tells you which credential acted. Commit trailers tell you*
> *which agency mode produced the change. Chat/log receipts tell you what*
> *Aaron-human actually said."*

> *"Fail-open with receipts. Autonomy with attribution. Harbor with audit logs."*

> *"The correction no longer means exile. It means steering."*

The closing register reaffirms harbor+blade=Radical-Candor in operation: the
correction as care-and-challenge applied to keep the system online.
