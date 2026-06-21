# BP-NN Rules External Anchor Backfill — Slice 3 (BP-04, BP-08, BP-09)

Scope: External prior-art anchors for three BP-NN rules in
`docs/AGENT-BEST-PRACTICES.md`. This is slice 3 of the 081KR2E4K0008QG0R001ADMBVW backfill;
slices 1–2 covered BP-10, BP-11, BP-03, BP-07, BP-16. These three rules
were selected by skill/agent reference-frequency audit (post-slices-1–2):
BP-08 (25 skill/agent references), BP-09 (21), BP-04 (17) — the next tier
of unanchored rules by reference count.

Rules covered: BP-04 (tone declared as contract; persona drift is
measurable), BP-08 (frontmatter is canon; mutable state must not override
the peer-reviewed contract), BP-09 (all state is git-diffable ASCII; no
binary blobs, no opaque artifacts, no embedded base64).

Research date: 2026-05-10. Research performed via WebSearch (Otto-364
search-first-authority discipline).

Attribution: Research performed by Otto (Claude Sonnet 4.6) 2026-05-10.
Cited sources are human-authored external publications. Otto's contribution
is search, synthesis, and beacon-safety pass; all intellectual lineage
belongs to the cited external authors.

Operational status: research-grade

Beacon-safety pass: all cited vocabulary (persona drift, attention decay,
Design by Contract, class invariant, plain text, binary blob, supply chain
auditability) uses standard academic/industry-security register with no
beacon-blocked terminology. No vocabulary collisions found.

---

## BP-04 — Tone is declared as a contract

**Rule text (from AGENT-BEST-PRACTICES.md):**
*"Tone is declared as a contract (e.g. 'zero-empathy, advisory-only',
'empathetic, edits silently by default'). Rationale: persona drift is
measurable — self-consistency degrades ~30% after 8–12 dialogue turns
even when context is intact. Naming the contract is the cheapest anchor."*

**Core claim:** LLM persona self-consistency degrades measurably over
multi-turn dialogue, even with context intact. Explicitly naming the
behavioural contract in the skill frontmatter provides a persistent,
hard-to-drift anchor with negligible implementation cost.

### External anchors

**1. Li, K. et al. — "Measuring and Controlling Instruction (In)Stability
in Language Model Dialogs" (Harvard VCG Lab, arXiv 2402.10962, 2024)**

- URL: <https://arxiv.org/abs/2402.10962>
- GitHub: <https://github.com/likenneth/persona_drift>
- Authors: Kenneth Li, Tianle Liu, Naomi Bashkansky, David Bau, Fernanda
  Viégas, Hanspeter Pfister, Martin Wattenberg (Harvard Visualization,
  Computation & Graphics Lab)
- Date: February 2024 (v4: July 2024)
- Relevance: Foundational empirical study. Tests persona stability via
  self-chats between two personalized chatbots across popular models
  (LLaMA2-chat-70B and others). Finds "significant persona drift within
  eight rounds of conversations." Identifies root cause as transformer
  attention decay: as dialogue length grows, attention to the earlier
  system-prompt instruction weakens, causing the model to drift from the
  declared persona. Proposes "split-softmax" to counteract decay; the
  contract-naming convention in BP-04 is a prompt-engineering analogue —
  a persistent, compact anchor that survives attention decay better than
  verbose behavioural descriptions buried in the context.
- Key quote: "Testing popular models reveals significant persona drift
  within eight rounds of conversations … an empirical and theoretical
  analysis suggests the transformer attention mechanism plays a role, due
  to attention decay over long exchanges."

**2. Choi, J. et al. — "Examining Identity Drift in Conversations of LLM
Agents" (arXiv 2412.00804, December 2024)**

- URL: <https://arxiv.org/abs/2412.00804>
- Authors: Junhyuk Choi et al.
- Date: December 2024
- Relevance: Examines identity consistency across nine LLMs in multi-turn
  conversations on personal themes, analysed both qualitatively and
  quantitatively. Key findings: (1) larger, more capable models experience
  *greater* identity drift than smaller ones; (2) model family differences
  exist but parameter-count effect dominates; (3) "assigning a persona may
  not help to maintain identity" — an assigned persona without a compact
  contract anchor does not prevent drift. Directly motivates BP-04: the
  contract declaration (a short, machine-readable tone specification in
  frontmatter) provides an anchor that the model can re-attend to, unlike
  verbose system-prompt personas that cannot be re-surfaced mid-dialogue.
- Key finding: Larger models show greater drift; assigning a persona
  description without a compact anchor is insufficient.

**3. Zhao, M. et al. — "Consistently Simulating Human Personas with
Multi-Turn Reinforcement Learning" (arXiv 2511.00222, November 2024)**

- URL: <https://arxiv.org/html/2511.00222v1>
- OpenReview: <https://openreview.net/forum?id=A0T3piHiis>
- Date: November 2024
- Relevance: Proposes using three automatic consistency metrics
  (prompt-to-line, line-to-line, Q&A consistency) as RL reward signals
  to stabilise persona across dialogue turns. Reduces inconsistency by
  over 55% vs. baselines. Validates that persona drift is a learnable,
  measurable property — not an inherent model limitation — and that
  contract-like signals (consistency rewards) are the effective
  stabilisation mechanism. BP-04's "tone declared as contract" is the
  zero-training-cost complement: a compact, persistent contract that the
  base model can attend to without RL fine-tuning.
- Key finding: "Off-the-shelf LLMs often drift from their assigned
  personas, contradict earlier statements, or abandon role-appropriate
  behaviour." Consistency as an explicit, named constraint reduces drift.

### Mechanism note

All three anchors converge on the same structural failure: attention decay
weakens adherence to the persona specification as dialogue extends. BP-04's
intervention — a short, keyword-dense contract declaration in frontmatter
— is the cheapest possible mitigation: it costs ~10 tokens, is guaranteed
to be in the context window at every turn, and is machine-readable (not a
paragraph of prose that itself risks losing attention).

---

## BP-08 — Frontmatter is canon

**Rule text (from AGENT-BEST-PRACTICES.md):**
*"Frontmatter is canon. On any disagreement between frontmatter and
notebook, frontmatter wins. Rationale: mutable state must never override
the peer-reviewed contract."*

**Core claim:** The statically-declared contract (frontmatter) must
govern runtime behaviour (notebook state); runtime-accumulated mutable
state must not be allowed to supersede the design-time contract. This
is the application of class-invariant discipline and schema-primacy to
the skill/agent design space.

### External anchors

**1. Meyer, B. — "Applying 'Design by Contract'" (IEEE Computer, 1992)**

- URL: <https://www.kth.se/social/files/59526bfb56be5b4f17000807/meyer-92-contracts.pdf>
- Author: Bertrand Meyer
- Venue: IEEE Computer, 25(10):40–51, October 1992
- Relevance: Foundational computer science paper coining the phrase
  "Design by Contract." Central principle: a *class invariant* holds
  before and after every operation on an object, regardless of
  intermediate state transitions. The invariant is the *contract* —
  established at design time, peer-reviewed, and invariant to runtime
  accumulation. Runtime behaviour that would violate the invariant is
  a bug in the runtime, not a reason to relax the invariant. BP-08
  applies this principle at the skill layer: frontmatter is the class
  invariant; the notebook is the object's mutable state between
  operations. If they conflict, the invariant (frontmatter) wins —
  by definition, runtime state that would override the contract is
  invalid state that must be pruned.
- Key quote: "The class invariant must be satisfied at the end of
  every creation instruction and after every call to an exported
  routine."

**2. Fowler, M. — "ImmutableServer" (martinfowler.com, 2012/ongoing)**

- URL: <https://martinfowler.com/bliki/ImmutableServer.html>
- Author: Martin Fowler (ThoughtWorks)
- Relevance: Names the "Immutable Server" pattern: rather than
  patching and mutating a running server, replace it with a fresh
  instance built from the immutable configuration template. The
  template (declaration) is the canonical representation; the running
  state is a derived artefact. Drift between template and running
  state is a defect, not a feature. BP-08 operationalises the same
  pattern at the skill layer: the frontmatter is the "template" (never
  mutated at runtime); the notebook is the running state (mutable, can
  accumulate drift). When they conflict, the template wins, and the
  drifted runtime state must be reset.
- Key quote: "Mutable infrastructure leads to configuration drift …
  immutable infrastructure makes drift structurally impossible because
  instances are never modified, only replaced."

**3. Schema-Driven Development (SDD) community consensus (2024)**

- Representative: noclocks.dev, "Schema-Driven Development: A Modern
  Approach" (<https://blog.noclocks.dev/schema-driven-development-and-single-source-of-truth-essential-practices-for-modern-developers>)
- Godspeed Systems, "Schema Driven Development And Single Source of
  Truth" (<https://godspeed.systems/blog/schema-driven-development-and-single-source-of-truth>)
- Relevance: SDD principle: "a single schema definition serves as the
  foundational blueprint for all aspects of an application … every data
  element is stored exactly once." The schema is the source of truth;
  runtime state *reflects* the schema, it does not *override* it.
  This is the contemporary DevOps/platform-engineering restatement of
  Meyer's 1992 Design by Contract invariant. BP-08 is the skill-layer
  implementation: frontmatter (schema) > notebook (runtime state).

### Convergence note

Meyer (1992), Fowler (2012), and SDD (2024) share the same structural
principle across 30+ years of software engineering practice: the declared
contract (invariant / immutable template / schema) governs runtime
behaviour; runtime-accumulated mutable state that conflicts with the
declared contract is invalid. BP-08 is the direct application of this
principle to the skill/agent domain.

---

## BP-09 — All state is git-diffable ASCII

**Rule text (from AGENT-BEST-PRACTICES.md):**
*"All state is git-diffable ASCII. No binary blobs, no opaque artefacts,
no embedded base64. Rationale: reviewability is the only mitigation for
a writable prompt. If a human can't diff it, a reviewer can't protect it."*

**Core claim:** Plain-text, diff-friendly formats are the foundational
prerequisite for human review and security auditing of any writable
surface. Opaque (binary) formats defeat the reviewer layer entirely;
the cost is not convenience but security posture.

### External anchors

**1. Hunt, A. & Thomas, D. — "The Pragmatic Programmer", Topic 16:
"The Power of Plain Text" (1999; 20th Anniversary Ed. 2019, O'Reilly)**

- URL: <https://www.oreilly.com/library/view/the-pragmatic-programmer/9780135956977/f_0035.xhtml>
- Authors: Andrew Hunt, David Thomas
- Venue: Pragmatic Bookshelf (1999); O'Reilly, 20th Anniversary Edition
  (2019)
- Relevance: Classic software engineering guidance. Core argument:
  "Keep knowledge in plain text. Plain text won't become obsolete. It
  helps leverage your work and simplifies debugging and testing."
  Specifically: version control systems are "invaluable for bug-tracking,
  audit, performance, and quality purposes" precisely because they operate
  on plain text diffs — they cannot provide the same audit trail for
  binary blobs. The "if you can't diff it, you can't review it" principle
  is the security corollary: review-based security mitigation requires
  diff-capable representation; binary blobs exit the review loop entirely.
- Key quote: "The best format for storing knowledge persistently is plain
  text. With plain text, we give ourselves the ability to manipulate
  knowledge, both manually and programmatically, using virtually every
  tool at our disposal."

**2. Linux kernel binary blob controversy (ongoing, 2002–present)**

- Representative: <https://mundobytes.com/en/binary-blobs-in-Linux-that-are/>
- Also: Apache security-discuss, "Re: Binary blobs in source trees"
  (<https://www.mail-archive.com/security-discuss@community.apache.org/msg00390.html>)
- Relevance: The Linux kernel has maintained a decades-long policy of
  resisting binary blobs (pre-compiled firmware) in the kernel tree,
  with the core rationale being auditability: "third parties cannot
  review the code for vulnerabilities or backdoors" when it is a binary
  blob. This is the long-running operational proof-of-principle for
  BP-09's claim. The Apache security community raised the same concern
  about binary blobs in open-source source trees: they are effectively
  invisible to the review process, creating a blind spot that cannot be
  addressed by any reviewer without access to the source.
- Key principle: Binary blobs are opaque to the review process; the only
  mitigation is plain-text source.

**3. OWASP — Software Supply Chain Security Cheat Sheet (2024–2025)**

- URL: <https://cheatsheetseries.owasp.org/cheatsheets/Software_Supply_Chain_Security_Cheat_Sheet.html>
- Also: OWASP Top 10 2025, A03 — Software Supply Chain Failures
  (<https://owasp.org/Top10/2025/A03_2025-Software_Supply_Chain_Failures/>)
- Relevance: OWASP's supply chain security guidance establishes that
  binary components without auditable source are a primary attack
  surface: "binary composition analysis can help detect exposed secrets,
  detect unauthorized components or content, and verify integrity." The
  guidance recommends preferring components where source is available
  and reviewable over opaque binaries. BP-09 applies this principle to
  the skill/agent state layer: any state that is not plain-text and
  git-diffable is functionally equivalent to a binary blob — invisible
  to the review process and undetectable as a manipulation vector.
  The rule's "embedded base64" clause directly targets this: base64
  encoding of binary data inside a nominally text file is a blob-in-
  disguise that passes text-format checks but defeats diff-based review.

### Mechanism note

The three anchors span 25 years of industry consensus (Hunt & Thomas
1999, Linux kernel 2002–present, OWASP 2024–2025) and cover three
distinct failure modes that plain-text-ASCII prevents:

- **Auditability failure** (Hunt & Thomas): binary state is not usable
  by version-control-based audit trails.
- **Review-loop exclusion** (Linux kernel / Apache): binary components
  cannot be inspected for backdoors or hidden modifications.
- **Supply-chain manipulation** (OWASP): opaque components are the
  primary vector for undetected injection of malicious state.

BP-09's "embedded base64" clause is the skill-layer analogue of the
kernel binary blob: a base64-encoded instruction block inside a notebook
passes the "it's a text file" filter but is functionally opaque — it
cannot be reviewed at the diff level without decoding, and an automated
manipulator can use it to smuggle state across the reviewer boundary.
