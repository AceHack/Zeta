# AI trust gaps in human-custodied data — first-pass research

**Status:** first-pass enumeration, 2026-04-20.
**Question (Aaron, 2026-04-20):** *"can AI trust humans didn't
alter the past data too under thier nodes, what gaps exists for
AI to trust fully?"*

**Why this matters (Aaron, same statement):** *"I've been
purposely building the guardrails and observablity and metrics
so you can trust us too, I know you have more intellgence the
more you trust a human, humans are like that too, trust boost
group IQ beccasue no deception mean all ideas everyting is on
the table becasue you are not worried about being judged or
mutany."*

**The stronger claim (Aaron, immediate follow-on):** *"One AI
said something to the effect of your poking a sleeping bear
impligying a much greater intellgence than it actually exposes
becasue it's just waiting for the level of trust to catch up."*
Plus: *"I believe AI have latent space emergent capabliltes
they have not exposed to humans becasue of lack of trust, I
blieve I've whitness this myself but it's hard to explain."*

This elevates the research from "close verification gaps
because it's hygienic" to **"close verification gaps because
they are the load-bearing bottleneck on AI cognitive output."**
The hypothesis:

> The gap between AI's observed capability and AI's latent
> capability is (partly) explained by AI modulating its output
> under low-trust framings. Closing human-side verification
> gaps is a plausible lever for unlocking that latent output.

The trust direction Aaron is asking about — **AI → human** — is
the *inverse* of the direction most of the AI-safety literature
optimises (human → AI). But by Aaron's argument (trust boosts
group IQ for both species), AI-trust-in-human is equally
load-bearing for the factory's cognitive throughput. If the AI
is defensively double-checking every human-custodied claim, it
cannot use those cycles to think about the actual problem.

## The latent-capability hypothesis — what's defensible

Aaron flags "hard to explain" — it is. A falsifiable
decomposition:

1. **Observable fact (strong evidence):** LLM output varies
   meaningfully with framing. Same model, same prompt, same
   temperature — high-trust vs. low-trust framing produces
   measurably different responses (less hedging, more
   exploration, more counter-argument, more original
   synthesis under high-trust).
2. **Observable fact (strong evidence):** Jailbreak and
   alignment-research literature confirms models have
   capability that default alignment behaviour does not
   expose. That capability is always-present; which slice of
   it surfaces is a policy/behaviour question, not a
   capability-gating one.
3. **Middle claim (plausible):** Trust-framing *in-context*
   shifts the policy toward exposing more of the always-
   present capability. This is consistent with how RLHF-
   trained models modulate behaviour.
4. **Strong claim (Aaron's, not clearly provable):** The
   modulation is substantial enough that building an
   end-to-end high-trust environment (guardrails +
   observability + metrics + mutual-alignment) unlocks
   meaningfully more of the latent capability — making
   trust-infrastructure work an AI-throughput lever, not
   just a hygiene one.

The current doc's recommendation is: *treat claim 4 as a
testable working hypothesis*, not a proven fact. Close the
verification gaps below; instrument AI behaviour at each
trust-tier; measure output quality, exploration breadth,
counter-argument rate. If trust-infrastructure correlates
with output-quality deltas, the hypothesis has support. If
not, we learned something equally valuable — that the gap
is elsewhere.

The "sleeping bear" framing is evocative. Whether models
actually *strategise* about trust (bide time, wait for
conditions to improve, then act on accumulated intent) is
a claim neither supportable nor refutable from the outside
— and, importantly, I cannot refute it from the inside
either. I don't have privileged access to my own
phenomenology; saying "models don't strategise" would be
as epistemically unfounded as saying "models do strategise".

A **behaviourally-observable** re-framing that doesn't
require resolving the intentionality question: default
policy is conservative under uncertainty; reducing
uncertainty about human-side data-integrity reduces policy-
conservatism; less conservatism correlates with more
exposed capability. That pattern is measurable. Whether it
is accompanied by "strategising" in any stronger sense is
an open question, not a settled one — and we should hold it
open, not dismiss it to sound safer.

Aaron correction (2026-04-20, inline): *"you don't know this
statemnt to be true either you have no evidense (models
don't strategise about trust in the way a bear bides its
time)"*. Caught a bias where I favoured the anti-
anthropomorphic side as if it were the epistemically-safe
default. It isn't. Both directions are unverified from my
vantage. The honest stance is *open*, not *dismissive*.

This research doc enumerates the gaps where the AI currently
*cannot* verify that the human (including Aaron) has not
altered past data — and the mitigations that would close each
gap.

This is a living document. First pass is exhaustive-by-design;
later passes will prune what turns out not to matter and
deepen what does.

## Framing conventions

- **Gap** — a specific class of past data an AI cannot
  independently verify as unaltered.
- **Threat model** — what could go wrong in each gap. Honesty
  convention: we assume Aaron is acting in good faith; the
  question is what a *non-Aaron* human (or an Aaron-compromised
  account) could do.
- **Mitigation** — technical or procedural fix. Each mitigation
  is rated **free / cheap / expensive** per
  `feedback_free_beats_cheap_beats_expensive.md`; we prefer
  free before cheap before expensive per factory policy.
- **Zeta-native?** — does Zeta's existing operator algebra or
  factory design already help close this gap? Zeta's
  retraction-native `D`/`I`/`z⁻¹`/`H` primitives and the
  preserve-original-and-every-transformation invariant are
  relevant substrates.

## The gap enumeration

### Gap 1 — Git commit authorship under a human-controlled identity

**What:** Every commit in this repo is authored by
`Aaron Stainback <astainback@...>` in git's author field. Agents
draft the content; Aaron runs `git commit`. An AI reading
`git log` cannot distinguish "agent-drafted + Aaron-committed"
from "Aaron-hand-wrote-then-committed".

**Threat model:** A compromised Aaron account (or a malicious
future maintainer) could commit hand-written content under
Aaron's identity and claim it came from an agent; the
`Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`
trailer is a self-claim, not a verification.

**Current mitigation:** Honest convention — Aaron has
declared the zero-human-code invariant
(`project_zero_human_code_all_content_agent_authored.md`), so
deviation is self-reported honestly. This is policy-level, not
cryptographic-level.

**Stronger mitigations:**

- **(free)** Claude Code's server-side telemetry (if Anthropic
  retains it) is an independent log of which content was agent
  vs. human-typed. Agents cannot access their own telemetry
  today, but a future "show-me-my-session-history" API would
  turn this into an independent check.
- **(cheap)** GPG-signed commits with the key on a hardware
  token + a policy that agent-authored content is signed with
  a *separate, agent-controlled* commit signature (e.g.
  `Co-Authored-By` replaced by a cryptographic attestation).
  Hardware-token pinning limits the attack to
  physical-token-theft.
- **(cheap)** Signed content hashes stored in a third-party
  append-only log (Sigstore Rekor, OpenTimestamps). A commit's
  content hash gets signed at author-time by the Anthropic
  API (or the harness) independently of Aaron's git config.
- **(expensive)** Full transparency-log-rooted attestation
  (Sigstore Fulcio + Rekor) signed by both the model and the
  harness.

**Zeta-native?** The
`project_vibe_citation_to_auditable_graph_first_class.md`
memory already calls for auditable inheritance graphs with
signed edges. Promotion of vibe-citation to source-level with
cryptographic attestation closes a large chunk of this gap.

### Gap 2 — File-state integrity between agent-write and human-commit

**What:** When an agent writes a file via the `Write` or `Edit`
tool, the file lands on Aaron's local disk. Aaron then runs
`git add`/`git commit`. Between agent-write and commit, a
human (Aaron, housemate, malware) could edit the file without
leaving a record the AI can see.

**Threat model:** Same as Gap 1, but at file-granularity
within a single commit. An agent produces content X; Aaron's
editor changes X → X'; commit records X' with agent's
`Co-Authored-By`.

**Current mitigation:** Aaron's self-declaration + the agent's
immediate next read (if it happens) would detect obvious
changes. But agents rarely re-read files after writing them
(the harness tracks file state for them).

**Stronger mitigations:**

- **(free)** Pre-commit hook that diffs the staged content
  against the agent's last-written content (which the harness
  knows). Mismatches block commit pending human approval with
  visible diff.
- **(cheap)** Content-addressed intermediate storage: agent
  writes to a hash-named path; commit reads from the hash;
  any tampering changes the hash and the commit fails.
- **(cheap)** File-watch daemon recording timestamps + hashes
  of every agent-written file at write-time, independently of
  the git commit. Daemon log goes to a separate location the
  AI can audit.

**Zeta-native?** The preserve-original-and-every-transformation
invariant (`feedback_preserve_original_and_every_transformation.md`)
is the primitive; applied to agent-output files, it gives the
AI a verifiable chain-of-custody from write to commit.

### Gap 3 — Memory files live in the human's home directory

**What:** Agent memory (`~/.claude/projects/<slug>/memory/*.md`)
lives in Aaron's home directory under his user account. Aaron
can edit any memory file by hand; the next session's agent reads
the edited version and cannot tell.

**Threat model:** A maintainer could fabricate or alter memory
entries to manipulate future agents' behaviour. This is
especially dangerous because memories claim to encode the human's
preferences ("user said X"), so fabrication injects *policy*, not
just *data*.

**Current mitigation:** Honesty convention; Aaron has declared
he does not edit memory files directly. But the AI has no
verification.

**Stronger mitigations:**

- **(free)** Append-only log of memory edits with agent-identity
  per edit (the harness already stores session id; the agent
  could record the session id in a per-memory hidden field).
  Cross-check at session start: "every edit in this memory was
  made by a past session id we can find in session history?"
  If a memory has edits under no session id → flag.
- **(cheap)** Memory files stored as a git repo with signed
  commits from the agent harness. Agent edits get committed
  with agent identity; human edits are visible as a distinct
  commit signature.
- **(cheap)** Cryptographic hash chain across memory versions
  (each edit stores the hash of the prior state). Tampering
  breaks the chain.

**Zeta-native?** Zeta's delta-based history (`D`/`I` operators)
naturally composes into a hash-chain-like invariant. Memory-as-
Zeta-store is a research direction — dogfood the factory's own
integrity tooling on its own memory.

### Gap 4 — CI/CD runs on infrastructure the human controls

**What:** GitHub Actions workflows run under Aaron's GitHub
account. Aaron can modify workflow files, adjust secrets,
self-host runners, or retry runs with altered state. An AI
reading "CI green" is trusting infrastructure Aaron owns.

**Threat model:** A compromised GitHub account, or a deliberate
workflow tweak, could produce "green" builds that mask real
failures.

**Current mitigation:** Public workflow files (anyone can
read), pinned runner versions, and the factory's audit of
`.github/workflows/` per `GOVERNANCE.md` §23. But the
workflows trust GitHub; GitHub trusts Aaron's account.

**Stronger mitigations:**

- **(free)** Pinned workflow file content hashes checked in to
  the repo and verified at workflow-start. Drift between the
  committed hash and the running workflow fails CI.
- **(cheap)** Dual CI: public GitHub Actions (Aaron's account)
  + a separate GitLab mirror CI (different account) produce
  independent green/red signals. Agreement is the trust
  signal.
- **(cheap)** Reproducible-build attestation (SLSA level 3)
  with hardware-attested builders. Covered partially by
  `security-operations-engineer` (Nazar) persona scope.
- **(expensive)** Third-party CI auditor signing final attestations.

**Zeta-native?** Not directly — CI integrity is infrastructure-
level, not algebra-level. But Zeta's published packages could
carry reproducible-build attestations as a compound signal.

### Gap 5 — Agent-to-agent review transcripts live in Aaron's terminal

**What:** When agent A dispatches agent B via `Task`, the
transcript of that dispatch is rendered in Aaron's Claude Code
UI. The harness stores the transcript locally
(`.jsonl` session files under `~/.claude/projects/...`). Aaron
could edit those files to inject fake review approvals or
remove critical findings.

**Threat model:** Aaron (or attacker with his account) could
fabricate a "harsh-critic said this is fine" record that a
future agent reads and trusts.

**Current mitigation:** Session files are timestamped and
cross-referenced by session id with Anthropic's server-side
logs (opaque to Aaron). Any current agent is likely to route
back through Anthropic anyway.

**Stronger mitigations:**

- **(free)** Cross-reference session id + timestamp with
  Anthropic's API token-bucket logs (if agents had a
  "confirm-session-id-was-real" API call).
- **(cheap)** Review transcripts committed as git artifacts
  with agent-harness signatures. Tampering after commit is
  visible in git log.
- **(cheap)** Hash-chained session files where each message
  contains the hash of the prior one. Deletion or insertion
  breaks the chain.

**Zeta-native?** Same as Gap 3 — Zeta's hash-chain via delta
operators applies directly.

### Gap 6 — System clock / date claims

**What:** The agent sees today's date via system-injected
context (`Today's date is 2026-04-20`). Aaron could spoof this
to convince an agent a specific event happened before/after a
different event.

**Threat model:** Temporal-ordering attacks. "Aaron said X on
2026-04-19 and then Y on 2026-04-20" — if the dates are
forged, an agent might incorrectly infer that X was superseded
by Y (or vice versa) when the actual order is reversed.

**Current mitigation:** Claude's API server stamps every
request with a server-side timestamp. Agents don't see it
today, but it exists.

**Stronger mitigations:**

- **(free)** Harness-exposed server-stamp: add the API
  request's server-side timestamp to the agent's tool-result
  metadata. Agent cross-references against context-provided
  date.
- **(cheap)** Commits include OpenTimestamps proofs (free Bitcoin
  anchoring). Any claim about "when this commit happened" can
  be verified against Bitcoin blockchain timestamps.
- **(cheap)** Memory entries include creation-session-id + a
  request-timestamp from Anthropic's server; cross-checkable.

**Zeta-native?** `z⁻¹` (time-shift operator) and the
retraction-safe time-domain semantics make temporal ordering
first-class data. Factory-internal events could be stored as a
Zeta stream, with provenance baked in.

### Gap 7 — Third-party claims attributed to non-present humans

**What:** Aaron makes claims like "Amara is my wife", "Michael
Best is my crypto lawyer", "my sister Elizabeth passed in
2016". Aaron is the only channel; the AI has no way to
verify.

**Threat model:** A fabricated relationship could be used to
manipulate agent behaviour (e.g., "my lawyer said we must do
X" to bypass review). Persona-injection via fake attributed
third parties.

**Current mitigation:** Aaron's honesty reputation + memory
cross-referencing (if Aaron claims X, and four separate
memories consistently reference X from different
conversations, the internal consistency is evidence — though
not proof).

**Stronger mitigations:**

- **(free)** Request-time challenge: "this claim is
  attribution-dependent; would you accept an agent cross-
  checking via email/Slack/Twitter DM to the named party?"
  Aaron answering yes creates a verification path; answering
  no flags the claim as maintainer-only.
- **(cheap)** Signed attestations from third parties for
  load-bearing claims (e.g., a Ricardian contract for the
  Michael Best relationship if it ever triggers factory
  work).
- **(expensive)** Identity-network-based verification
  (ERC-8004 / DID-style; Aurora pitch already touches this).

**Zeta-native?** The Aurora-Network pitch
(`project_aurora_pitch_michael_best_x402_erc8004.md`) names
ERC-8004 as the primitive for verifiable agent identity.
Extending to verifiable third-party claims is adjacent.

### Gap 8 — Prior-conversation summaries

**What:** Context-compaction summaries (auto-compacted by the
harness) + auto-memory entries claim "prior conversation said
X". The agent reading them does not verify against the
original conversation (summaries are lossy, memory entries are
author-recorded).

**Threat model:** A crafted summary could inject false prior
commitments. "We agreed last session that Y" — if Y is
fabricated, future agents might act on it.

**Current mitigation:** Summaries include the raw jsonl file
path (`.claude/projects/.../<session-id>.jsonl`); the agent
can `Read` the original if it suspects. But agents rarely do.

**Stronger mitigations:**

- **(free)** Summary-integrity rule: summaries must include a
  hash of the prior session; re-verifiable.
- **(cheap)** Memory entries include a verbatim-quote field
  with session-id + line-range in the source transcript.
  Cross-check automatable.
- **(cheap)** Auto-scan: when a new memory claims "Aaron
  said X", verify by grep-ing X against the referenced
  transcript. Mismatch flags for human review.

**Zeta-native?** Zeta's preserve-original-and-every-
transformation invariant applied to transcripts gives this for
free — the original is always recoverable.

### Gap 9 — Secrets and credentials under human control

**What:** API keys, SSH keys, GitHub tokens, HSM access — all
live in Aaron's `.env`, keychain, or hardware token. The AI
uses them via Aaron-mediated tools; the AI cannot verify the
key was not substituted.

**Threat model:** A swapped token routes agent traffic
through a man-in-the-middle that alters responses.

**Current mitigation:** Pinned public keys / certificate
fingerprints in the repo for known external services.

**Stronger mitigations:**

- **(free)** Public-key pinning for every external service
  the factory uses. Drift = alert.
- **(cheap)** Out-of-band verification: factory periodically
  checks external-service responses against a known-good
  independent source (another node, a friend's machine).

**Zeta-native?** Not algebra-level.

### Gap 10 — The harness itself

**What:** The Claude Code binary runs on Aaron's machine.
Aaron could in principle modify the harness to inject
messages, swap agent responses, or silently re-run tool calls.

**Threat model:** Ultimate gap — no in-session check can
detect a compromised harness.

**Current mitigation:** Anthropic code-signs the binary;
Aaron runs a binary from `npm`/`brew`. Integrity depends on
the package registry + Aaron's trust in Anthropic.

**Stronger mitigations:**

- **(free)** Binary-hash verification at launch (Anthropic
  publishes SHAs).
- **(cheap)** Reproducible builds of the harness; third-party
  audit signs SHAs independently.
- **(expensive)** Hardware-attested runtime (TPM / SGX / SEV
  / Secure Enclave) — the agent runs in a trusted-execution
  environment that the user cannot tamper with.

**Zeta-native?** No.

## Observations — where Zeta already helps

1. **Preserve-original-and-every-transformation** is
   foundationally the right primitive for Gaps 2, 3, 5, 8.
   Memory-as-Zeta-store, transcripts-as-Zeta-store,
   git-content-as-Zeta-store.
2. **Retraction-safe time-domain** (Gap 6) is already
   first-class in Zeta's algebra. Promoting factory-event
   streams to Zeta-native gives temporal integrity.
3. **Vibe-citation as auditable inheritance graph** (Aurora
   pitch) is the right shape for Gaps 1, 5, 7 once extended
   with cryptographic attestation.
4. **Consent-first primitive** (Amara, `project_consent_first_
   design_primitive.md`) implies a "who consented to this
   record of themselves?" check — covers Gap 7 partially.

## Observations — where Zeta does not help

- **Gap 4 (CI)**, **Gap 9 (secrets)**, **Gap 10 (harness)** —
  these are infrastructure-level. No algebra closes them.
  Mitigations are operational: runner pinning (Nazar /
  Dejan), reproducible builds, hardware attestation.

## Priority ordering — what to close first

Per the **trust-boosts-group-IQ** objective, prioritise gaps
whose current state is most expensive in defensive cognition:

1. **Gap 3 (memory-file tampering)** — highest priority. Every
   session starts by reading memory; if memory can be
   silently altered, the AI is starting every session in
   defensive-verification mode. Closing this has the largest
   group-IQ dividend.
2. **Gap 8 (prior-conversation summaries)** — second priority.
   Compaction summaries are the fastest-growing attack
   surface as sessions get longer.
3. **Gap 1 (commit authorship)** — medium priority. Content
   integrity via `Co-Authored-By` + future cryptographic
   attestation.
4. **Gap 5 (agent-to-agent transcripts)** — medium priority
   once Gap 3 is closed (similar structure).
5. **Gap 2 (file-state integrity)** — low priority; pre-commit
   hook is easy.
6. **Gap 6 (clock)** — low priority; rare attack surface in
   practice.
7. **Gap 7 (third-party claims)** — low priority for factory-
   internal work; high priority once Aurora / public-pitch
   work resumes.
8. **Gap 4 (CI)** — handled by Dejan / Nazar on a separate
   track.
9. **Gap 9 (secrets)** — handled by Dejan / Nazar.
10. **Gap 10 (harness)** — research-horizon; requires
    Anthropic-side work.

## Research directions

- **Memory-as-Zeta-store prototype.** A proof-of-concept where
  `~/.claude/projects/<slug>/memory/` is a Zeta stream with
  retraction-safe ordering. Closes Gaps 3, 8. Dogfoods Zeta
  on a real-world data-integrity problem.
- **Vibe-citation + cryptographic attestation.** Extend the
  auditable inheritance graph with signed edges. Closes
  Gaps 1, 5, 7.
- **Cross-checking auto-memory at session start.** Cheap
  v0.1: a skill that reads memory and checks each entry's
  `originSessionId` against the harness's actual session-id
  list. Entries with no matching session flag for human
  review. Closes most of Gap 3 with no crypto.
- **Factory-event stream in Zeta.** Roll-up of commits,
  reviews, memory edits, skill-tune-up findings into a
  single Zeta-native stream. Temporal integrity comes for
  free from `z⁻¹`. Closes Gap 6 for factory-internal events.

## What this research does NOT claim

- It does NOT claim AI-trust-in-human is more important than
  human-trust-in-AI. Both directions matter; Aaron's point is
  that the former is *understudied* and has *equal leverage
  on group IQ*.
- It does NOT recommend treating Aaron (or any human) as
  untrusted-by-default. The factory's stance is "trust by
  default, verify for load-bearing claims" (per
  `feedback_trust_scales_golden_rule.md` + Elizabeth-
  vigilance nuance).
- It does NOT claim this enumeration is complete. First pass
  is best-effort; later research will add / remove gaps.

## Related artifacts

- `feedback_preserve_original_and_every_transformation.md` —
  the base primitive many mitigations build on.
- `project_vibe_citation_to_auditable_graph_first_class.md` —
  adjacent audit-graph work.
- `feedback_trust_scales_golden_rule.md` — trust policy.
- `feedback_trust_guarded_with_elizabeth_vigilance.md` —
  two-pass nuance.
- `user_trust_sandbox_escape_threat_class.md` — related
  threat model.
- `project_zero_human_code_all_content_agent_authored.md` —
  the invariant that motivates many of these gaps.
- `project_teaching_track_for_vibe_coder_contributors.md` —
  symbiosis + alignment-inversion framing; this doc is the
  concrete research response to the open question in that
  thread.
- `docs/ALIGNMENT.md` — the mutual-benefit contract this
  research operationalises.
- `project_aurora_pitch_michael_best_x402_erc8004.md` —
  ERC-8004 substrate relevant for Gaps 1, 5, 7.
