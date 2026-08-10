# Threshold signature verification — the N=3 combine

**Date:** 2026-08-09 · **Derivations:** `derivation-a/threshold-sig-verify`,
`derivation-b/threshold-sig-verify`, `derivation-c/threshold-sig-verify` — three F#
implementations of
[`threshold-signature-verification-cleanroom-spec.md`](threshold-signature-verification-cleanroom-spec.md),
each in an isolated worktree, none having seen the others.

**This is generation 1** of the N-version protocol — the first run *designed* from
[the blueprint](../../.claude/skills/code-review-and-quality/blueprints/n-version-derivation.md)
rather than improvised. Generation 0 was the key-custody run.

---

## 0. The headline: three correct implementations that cannot verify each other

All three independently identified that **the spec never fixes the canonical signed bytes** —
and then diverged along **three independent axes**, each defensible against the text:

| | domain tag | length prefix | payload length |
|---|---|---|---|
| **A** | `"zeta.threshold-signature.v1"` | 4-byte **little**-endian | **prefixed** |
| **B** | `"zeta.threshold-sig.v1"` | `u32be` — **big**-endian | — |
| **C** | **none** | 4-byte **big**-endian | **not** prefixed (trailing) |

**No two produce the same signed message.** This is the deepest defect in the spec and it is
mine: "over the request's scope and payload" reads as a complete requirement and is not one.

Two consequences that **only N=3 could surface**:

### 0a. C omits domain separation — and is fully compliant

A and B both added a domain tag. C reasoned only about *injectivity*, which is the only
property the spec's rationale argues for — and length-prefixing alone achieves it. So C is
correct against the text and **materially weaker in practice**: domain separation is what
prevents a signature valid in another Zeta context being replayed into this one
(cross-protocol reuse). A two-way run of **A ∥ B** would have shown both carrying tags and
looked settled. **The absent third opinion was the informative one.**

### 0b. A prefixes the payload length; C leaves it trailing — and both are right

C's own comment justifies the scope prefix as removing the `("ab","c")` / `("a","bc")`
collision, and with a *trailing* payload that argument does hold. A prefixes both for
symmetry. Same requirement, two sound readings, incompatible bytes.

## 1. Co-discovered defects — found independently, therefore real

The N-version signal is **co-discovery**. A single derivation naming an ambiguity is a
hypothesis; two naming it independently is evidence.

| defect | A | C |
|---|---|---|
| canonical signed bytes unspecified | D2 | #3 |
| window boundary inclusive vs half-open — **diverges at exactly one epoch, silently, mid-cutover** | D4 | A8 |
| R9's input list is incomplete | D9 (adds `epoch`) | A12 (omits threshold + policy) |
| R8's bound does not guarantee satisfiability | D10 | A10 |

## 2. Found by one derivation only — and serious

### 2a. The title names a different object than the requirements (A only)

**"Threshold signature"** is the term of art for the Desmedt–Frankel / Shamir construction: an
*aggregated single signature* against *one group key*. But R3/R4/AC3 — count signers,
de-duplicate submissions, report unknown signers — are only meaningful for a **k-of-n
multi-signature**, where each signer signs separately.

**A cryptographer reading only the title builds the wrong primitive.** All three implementers
built multi-signature because the requirements forced it, so the spec is *internally* coherent
and *externally* misnamed. This is the single most dangerous defect found, and it is a naming
error — exactly the class the etymology thread has been circling.

### 2b. R7's migration window is not enforceable (C only)

R5 binds a signature to *scope and payload*. R7 wants a bounded overlap window. The house rules
forbid a wall clock. Therefore the epoch is **caller-supplied and unsigned** — so an adversary
replays a retired-scheme signature by asserting an in-window epoch.

**R7's mechanism does not achieve R7's rationale, and no implementation can fix it from inside
R5's stated coverage.** Folding the epoch into the signed material contradicts R5's text. C
marked R7 `partial` for this; A added `epoch` as a fourth input to R9 (D9) without flagging the
replay consequence. **Same observation, one treated it as a security hole and one as a
completeness gap** — that divergence in *severity* is itself a finding.

### 2c. Acceptance criterion 5 is unsatisfiable as written (C only)

Identical bytes cannot verify under two genuinely different schemes; if they could, one is a
wrapper of the other and R6 is void. Satisfiable only under the reading "same request *shape*
and call site, different schemes."

### 2d. Acceptance criterion 3 is vacuous at threshold 1 (C only)

Duplicate collapse cannot be demonstrated when one signer suffices.

## 3. Coverage, as declared — nobody rounded up

| | R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 | R10 |
|---|---|---|---|---|---|---|---|---|---|---|
| **A** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **partial** | **partial** | ✅ |
| **C** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **partial** | ✅ | **partial** | ✅ |
| **B** | *not reported — see §4* | | | | | | | | | |

Acceptance: A has AC7 `partial`; C has AC5 `partial`. **Both declared `partial` where they
could have claimed `implemented` and been believed.** Compare generation 0, where one
derivation claimed twelve of twelve and four claims did not survive execution. **The A5
amendment worked.**

Note the R7/R8 pattern: **each marked partial exactly where the other marked implemented.**
Neither is wrong — they hit different edges of the same under-specification.

## 4. B: the code survived, the analysis did not

B committed three times (report skeleton → core + adapters → 21 acceptance tests) and then
**wedged before pushing and before filling in its report.** Its worktree was clean; the
dispatching session pushed its commits unchanged.

So B's *implementation* is available — and it contributed to §0, since its encoding is a third
distinct choice — but **B's ambiguity list and coverage table are lost.**

The incremental-report rule (generation-1 fix #3) **half worked**: B wrote the report skeleton
first, as instructed, which is why we know what it intended to record and can be certain it is
missing. Writing the *skeleton* incrementally is not the same as writing the *findings*
incrementally.

> **Generation-2 fix:** require each ambiguity to be appended to the report **at the moment it
> is resolved**, not collected into a section at the end. A skeleton proves intent; it
> preserves nothing.

## 5. Spec amendments required (additive — the original text stays for the record)

1. **Rename.** The spec describes **k-of-n multi-signature verification**, not threshold
   signatures. Retitle and say so explicitly in the preamble.
2. **Fix the canonical encoding as a constant**, byte-for-byte: domain tag string, endianness,
   and whether the payload length is prefixed. **Mandate domain separation** and state the
   cross-protocol-reuse reason, so no compliant implementation can omit it.
3. **Resolve R7 or withdraw it.** Either the epoch enters the signed material (contradicting
   R5 as written, so R5 must change too) or R7's rationale is unachievable and the window must
   be described as advisory rather than enforcing.
4. **Pin the window boundary** — half-open `[start, end)`, matching `PhaseWindow` in
   `KeyCustody`.
5. **Restate AC5** as "same request shape and call site, different schemes."
6. **Restate AC3** with threshold ≥ 2.
7. **Complete R9's input list** — include threshold, policy, and epoch.
8. **Strengthen R8** — a configuration must be rejected when it *cannot ever* authorize, not
   merely when the threshold exceeds the roster size.

## 6. Recommended disposition

**Adopt A as the base.** It is `implemented` on 8/10 with mutation-checked tests (four mutants
applied, rebuilt, all killed — self-verification nobody asked for), and it carries domain
separation.

**Graft from C:** the R7 replay analysis, the AC5/AC3 corrections, and its explicit
big-endian-for-determinism argument, which is the better justification even though A's guarded
little-endian is also correct.

**Keep B's tests** as an independent battery against the merged implementation — 527 lines
written without sight of either other suite.

**Amend the spec first (§5).** A fourth derivation against the unamended text reproduces every
divergence above.

## 7. Did N=3 pay for itself over N=2?

**Yes, and the evidence is specific rather than a feeling.**

- **A ∥ B alone** would have shown two domain-tagged encodings differing only in a string, and
  would likely have been read as a naming nit. **C's tagless implementation is what proved the
  spec permits omitting domain separation entirely.**
- Four defects were **co-discovered** by A and C. Under N=2 each would have been a single
  opinion; the third derivation is what converts *hypothesis* into *evidence*.
- The **severity divergence** on R7 (security hole vs completeness gap) is only visible with
  more than one report to compare.

Cost: one additional implementation, plus real machine contention — three concurrent Release
builds pushed load average past 28 and were the dominant wall-clock cost. **Generation-2
should stagger builds**, since worktree isolation isolates the filesystem and not the CPU.


---

# CORRECTION — B reported after this combine was merged

The coordinator judged derivation B wedged (flat transcript, zero CPU, an unanswered nudge),
pushed its three commits, and recorded in §4 that **"B's ambiguity list and coverage table are
lost."** That was wrong. B was slow, not dead, and delivered a full report: **14 ambiguities and
a complete coverage table.** §4 stands as written for the record; everything it concluded about
B is superseded here.

## B strengthens the headline from two-way to THREE-way co-discovery

B's **D1** is the canonical-signed-bytes defect — so **all three derivations found it
independently**, and B stated the consequence before any combine existed:

> *"Any two derivations answering D1 differently cannot verify each other's signatures, **and
> every derivation's own tests pass regardless** — start the combine there."*

B predicted §0 from inside its own isolation. That is the protocol working exactly as intended.

B's **D2** also independently reaches C's R7 epoch problem — and names the attack: a
requester-supplied epoch is a **downgrade attack**, so B chose verifier-supplied and made
`verify` 4-ary. **C found the hole, B found the same hole and its mitigation, A treated it as a
completeness gap.** Three-way co-discovery of the security issue, with three different severity
readings.

## What only B found

- **D5 — first-wins duplicate handling enables signer SUPPRESSION.** An attacker injects a junk
  submission under a target's identity; if the first copy wins, the target's genuine signature
  never counts. B chose any-valid-counts. **A denial-of-participation attack nobody else saw.**
- **D12 — R2 forbids a global roster, but does it forbid a global registry?** B's reasoning is
  the sharp part: migration windows must live on the *verifier*, not the registry, **or you
  recreate the cutover coordinator R7 exists to deny.** That is this repo's central argument,
  rediscovered from the inside.
- **D4 — must every multi-scheme verifier state an end date?** B chose strict and flagged it as
  its **least-confident call**, noting that permanent hybrid classical+PQ is real practice. It
  is right to doubt it: my spec assumed migration is always transitional, and that assumption is
  false for hybrid deployments.
- **D14 — key rotation (two keys, one scheme) is undefined**; B made it a config error and
  deferred the alternative.

## B's coverage — also no rounding up

`R9` and `AC7` declared `partial`, with the reasons named: no property-based/DST harness, "on
any machine" untested, and **the port contract *permits* an impure adapter** — a hole in R6's
design, not merely in B's tests. So **all three derivations declared R9 partial**, which makes
R9 the most reliably under-specified requirement in the document.

## Environment findings (generation-2 infrastructure)

B hit two host-level blockers and named them rather than working around them silently:
`.mise.toml` untrusted in a fresh worktree (so the pinned SDK did not resolve), and a
machine-wide **"Too many open files in system"** during the first solution build. Both are
worktree/host issues, and the second corroborates the build-contention finding with a concrete
failure mode: **N concurrent worktree builds exhaust host file descriptors, not just CPU.**

## What this correction does to §7

The N=3 argument **strengthens**. It was made on A ∥ C with B's implementation as a silent
third data point; with B's report, three of the run's most important defects are three-way
co-discoveries rather than two-way, and B contributed one attack (D5) and one architectural
argument (D12) that neither other derivation found.
