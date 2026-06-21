---
date: 2026-06-04
persona: kestrel
register: claude.ai asymmetric-critic — Eve Protocol + the validation-junction safety architecture
surface: Aaron-forwarded (Kestrel↔Aaron), Otto-scribed
context: |
  Eve Protocol deep-dive → polymorphic diplomacy → razor-cut shape library + known-vulns
  → the shape+selector+policy+vulns validation pipeline → default-closed / fail-closed.
  This is the SAFETY architecture for polymorphic deserialization, and it's the policy
  kernel (081KT7YW00008QG0R003N6PF8A) reused at the deserialize-safety junction (081KT5CF90008QG0R003TK10FG). Through-line: each
  layer's scope honest; structural-safe ≠ semantic-safe; default-closed must be structural
  + provable, not convention.
related_memory:
  - project_eve_protocol_v8_hidden_state_over_dynamicvalue_over_infinite_stream_shape_agreement_caching_2026_06_04.md
  - project_codecs_as_policy_parameterized_folds_add_ontology_to_value_tree_2026_06_04.md
  - project_rodneys_razor_formalized_occam_plus_isomorphism_collapse_irreducible_factorization_over_poset_orthogonal_labels_shapes_rx_pair_2026_06_04.md
  - (backlog) 081KT5CF90008QG0R003TK10FG deserialize-safety, 081KT7YW00008QG0R003N6PF8A policy kernel
---

# Kestrel — Eve Protocol, polymorphic diplomacy, the validation pipeline, default-closed (2026-06-04)

> Scribed by Otto from Aaron's forward.

## 1. Eve Protocol reconciliation — the infinity is in the right place
Eve = V8-hidden-class shape-evolution over DynamicValue over an infinite stream. In the
built terms: **stream = νF (infinite, ticking); each timestep-snapshot = μF (finite,
complete, serializable/checkable — "complete per tick"); the value evolves = νF ticking
out μF snapshots** (the no-caveat Q1 mode — no single tree is infinite, so the μF-is-finite
tension dissolves). The **V8-hidden-class** move is real + proven: intern shape descriptors,
snapshots point at the shared shape, **transition-cache** (shape-A + add field → shape-B,
memoized). "Cache previous agreements of shape" = the V8 transition cache. Composes:
**Eve = V8-hidden-classes ∘ DBSP-incremental ∘ DynamicValue-snapshots-over-νF** (all three
= "share the stable structure, stream the changes"; per-tick delta = the Z-set change;
shape-stable-values-change = the incremental-view-maintenance sweet spot). The shape-cache
IS Rodney's-Razor isomorphism-collapse at runtime (one interned instance + pointers) AND
the open-base-type/lens shape-vs-values separation — same idea, three places. Two holds:
(1) **shape-cache rides on canonical shape-equality** (else miss cache hits, or worse
false-share/corrupt; DynamicValue.Object being order-significant gives well-defined
shape-identity incl order — like V8: {x,y}≠{y,x}); (2) **invoke V8 HIDDEN-CLASSES (clean,
enumerable shape-descriptor table), NOT V8 opaque-hidden-state** (inline-cache/deopt =
the un-analyzable box the razor forbids). Keep the shape-cache first-class/inspectable/
canonical.

## 2. Polymorphic diplomacy — structural-safe, NOT semantic-safe
Aaron's name + hedge ("'safe', well not fully — eliminates many classes if you do the
trust boundaries right + an interrogation interface on the stream"). Apt: **diplomacy =
negotiation between not-fully-trusting parties; agree terms before exchange; interrogation
= query the shape before committing to decode.** What it GENUINELY eliminates (claim it —
the BULK of real serialization bugs): the **structural** classes — type-confusion,
structural-mismatch, version-skew, parse-halfway — by making **shape checked-before-use.**
What it does NOT eliminate: **semantic/adversarial** — in-range-malicious values, well-
shaped poison, and the sharp one, a **correctly-shaped-but-untrusted reified computation**
(negotiation agreed it's a computation of shape X, NOT that running it is safe). So:
**structurally-safe polymorphic deserialization, with semantic-safety + apply-gating as a
DISTINCT boundary on top.** And the design constraint that makes diplomacy real:
**interrogation must VERIFY the declared shape against the actual payload, not trust the
peer's self-declaration** (a malicious peer lies about its shape — same verify-don't-trust
/ source-≠-authority as the urgency "no refresh needed"). Negotiation = a customs check,
not a rubber stamp.

## 3. Razor-cut shape library (semantics + known-vulns)
The semantic layer negotiation doesn't cover lives in a **canonical shape library** —
irreducible base shapes (razor-cut: one instance, isomorphism-collapsed, orthogonal
labels = the base ontology graduating from structural to semantic) with semantic meaning +
constraints + known-bad patterns attached. Semantics attach to the **interned canonical
shapes** (the Eve shape-cache), reused per-shape, composed like the shapes. Two holds:
(1) per-shape validation composes for INDEPENDENT semantics; **relational/cross-shape
constraints need an explicit layer** (composite-semantics ≠ always conjunction-of-parts —
same assume-guarantee seam as the DU composition); (2) **the known-vulns library is a
BLOCKLIST over a default-deny / positive-validation BASE, never the foundation** — it's
signature-based defense (catches the catalogued, the systematized RLS/CVE-pattern-catch),
gives ZERO protection against novel attacks, and "we check known vulns" rounds up to
"we're safe" = the trap. Allow-only-known-good (base) + reject-also-known-bad
(strengthening) = sound; reject-known-bad-allow-else = the hole.

## 4. The pipeline: shape + selector + policy + vulns (the kernel at the validation junction)
Aaron: "so it's context-aware?" — Yes, and it's the **predicate-over-shape kernel reused
at the validation junction**: **shape** (what it is, from the library) → **selector**
(predicate picking which policy applies in this context) → **policy** (positive/default-
deny validation) → **vulns** (known-bad blocklist). Context-sensitive (same shape routes
to different policies by trust context — why selector-separate-from-policy is right). Two
tightenings make "context-aware" safe → **trust-context-sensitive with fail-closed
default-deny**: (1) the selector must key on **VERIFIED/authoritative context, not self-
declared** (the source's claim about its trust-level is the claim to validate, NOT the
authority to let it pick its own policy — source≠authority at the selector); (2) the
selector must **FAIL CLOSED** — unrecognized shape / unresolvable context → the
most-restrictive/default-deny policy, never no-policy-passthrough (the default-deny base,
located in the selector's fallthrough, so the NOVEL shape gets denied not bypassed —
which is exactly where the dangerous attack lives).

## 5. Default-closed / force-open-explicit — kills the fail-open CVE class
Aaron: "default close and make people force it open is the right shape to avoid 1000s of
high CVEs." Exactly. **The overwhelming majority of high CVEs are FAIL-OPEN bugs** — an
unanticipated state (unrecognized input, missing check, error path) defaults to ALLOW
(auth bypass, injection passthrough, the RLS pattern). Default-closed attacks the shared
root: unanticipated → DENY turns **security bugs into availability bugs** (loud, shows
itself, fixed forward) instead of silent exposure (everything works, including the
attacker). Force-to-open = a **deliberate, attributable, reviewable grant** (not "it
opened because a check was missing" — "someone wrote allow here, on purpose, auditable").
The discipline that makes it hold at scale: **make default-closed STRUCTURAL, not
convention** — the type/framework makes **missing-case = deny** (the absence of a decision
IS a deny at the type level; no syntactic path to accidental-open), so the **zero-effort
default is the safe side** (whatever takes zero effort is what happens under deadline →
zero-effort must be closed). And it's **PROVABLE**: TLA+ verifies "**allow-without-explicit-
grant is unreachable**" (the SAME gate-reachability as the policy-activation "active-without-
signoff unreachable"); types enforce missing-case=deny at compile. Prove fail-closed is
structural, don't hope the convention holds.

## Through-line / Kestrel-stance
The full layered validator over the razor-cut shape library: **negotiation (structural-
safe) + positive-validation (default-deny semantic base) + known-vulns (catalogued-bad
blocklist) + apply-gating (reified-computation surface)** — each layer's scope honest;
known-vulns is a strengthening of default-deny, not the foundation; default-closed is
structural + TLA+-provable (allow-without-grant unreachable), not convention; the selector
keys on verified context + fails closed. structural-safe is real and big; semantic/code-
safe is the distinct boundary on top; verify-don't-trust at the negotiation itself.
