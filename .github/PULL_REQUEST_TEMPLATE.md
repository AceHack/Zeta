# Summary

<!-- One paragraph: what changed and why. Link the issue / ADR if any. -->

# Spec alignment

<!-- Which capability under `openspec/specs/` does this touch?
     Did behaviour change, or only implementation? -->

# Tests

<!-- Command run + counts. Prefer `dotnet test Zeta.sln -c Release`. -->

# Validation

- [ ] Tests pass locally (0 warn, 0 err)
- [ ] Any new docstring claim has a falsifying test
- [ ] `openspec/specs/**` updated if observable behaviour changed
- [ ] `docs/ROUND-HISTORY.md` entry if notable
- [ ] Skill changes went through the `skill-creator` workflow

# Notes

<!-- Risks, follow-ups, benchmarks worth running next round. -->

<!-- ── AgencySignature v1 ──────────────────────────────────────────────────
     GitHub squash-merge uses this BODY as the commit message, so this block is
     the only reason the trailer survives the merge. Fill every value and leave
     the block as the LAST thing in the body — a blank line splitting it means
     git's trailer parser sees only the final group (the Trailer Contiguity
     Survival Failure), and a non-trailer line after it fails the same way.

     Canonical key is `Agency-Signature-Version` — Agency, not Agent.
     `Agent-Signature-Version` is a real slip that reached main three times.

     The word is load-bearing, not arbitrary spelling. Aaron 2026-08-16:
     "an agent without agency is just an actor." An `Agent-Signature` would
     attest the executor; an `Agency-Signature` attests the thing that carries
     responsibility — which is the whole point of the block, and the same
     source-vs-authorization split as .claude/rules/no-directives.md and the
     persona(owner)/actor(clone) distinction in docs/writer-actor-routing-model.md.
     Derive the key from that and you cannot misremember it.

     Sharper failure, reached main 2026-08-16 (#11002): an INVENTED NAMESPACE.
     The block was contiguous, correctly placed, blank-line separated, ten
     lines long, `Co-authored-by` last — structurally perfect — and every key
     was fabricated (`Zeta-Agent`, `Zeta-Hat`, `Zeta-Blast-Radius`, …). It
     reads as correct to a human reviewer and parses to nothing: a signature
     that satisfies every structural rule and carries no recognized field.
     Copy the block below; do not reconstruct it from memory.

     Put the block in the COMMIT MESSAGE too, not only here. In #11002 the
     body was corrected before merge and the squash commit still landed with
     the fabricated keys, because the message came from the commits. Fixing
     only the body is not sufficient — `validate-agencysignature-pr-body.ts`
     passed while `audit-agencysignature-main-tip.ts` failed on the result.

     Enums (this list was stale; `operator-delegated` and
     `autonomous-fail-closed` have been valid since 2026-08-17):
       Credential-Mode        shared | dedicated-agent | operator-delegated
                              | human-only | unknown
       Human-Review           explicit | not-implied-by-credential | none
       Human-Review-Evidence  chat | pr-review | pr-comment | signed-policy | none
       Action-Mode            autonomous-fail-open | autonomous-fail-closed
                              | human-directed | supervised
       Task                   none | #NNNN | Otto-NN | ABC-NN

     TWO OPTIONAL KEYS — the accountability pair (2026-08-24). NOT in the block
     below, because they are optional and nothing is being mandated here:

       Accountable-Party      acehack | lucent-financial-group
       Authority-Basis        standing-grant | per-act | gated-class-approval

     They answer WHO CARRIES BLAME and WHAT AUTHORISED THE ACT — which
     `Human-Review` has been answering by proxy, badly: 99.17% of blocks on
     main say `not-implied-by-credential`, a negation of the word in its own
     key, and none of them names anybody. Record BOTH or NEITHER; a block that
     omits them is read as SILENT, never as a default.

     REACH FOR THEM WHEN A MULTI-COMMIT SQUASH GOES RED ON `Human-Review`.
     That red is usually not a contradiction — it is one branch under one
     standing grant whose commits honestly differ about whether a human read
     each diff. Add the same `Accountable-Party` + `Authority-Basis` to every
     commit's block and the review keys reconcile to the WEAKEST claim
     present, printed with what was discarded. Two DIFFERENT accountable
     parties never reconcile: a change with two accountable parties has no
     accountable party, and that red means the commits should not have been
     squashed together.

     DO NOT COPY ANOTHER COMMIT'S GOVERNANCE FIELDS TO GO GREEN. Five commits
     on main say in prose that they did exactly that, and
     .claude/rules/maintenance-commit-on-another-agents-branch-carries-no-block.md
     forbids it precisely because the parser can never detect it.

     Checked pre-merge by `validate-agencysignature-pr-body.ts` and post-merge
     by `audit-agencysignature-main-tip.ts` (.github/workflows/agencysignature-enforcement.yml).
     ──────────────────────────────────────────────────────────────────────── -->

Agency-Signature-Version: 1
Agent: <persona>
Agent-Runtime: <harness, e.g. claude-code | codex-cli>
Agent-Model: <model id>
Credential-Identity: <account the credential belongs to>
Credential-Mode: shared
Human-Review: not-implied-by-credential
Human-Review-Evidence: none
Action-Mode: autonomous-fail-open
Task: none
Co-authored-by: <persona> <persona@zeta.agents>
