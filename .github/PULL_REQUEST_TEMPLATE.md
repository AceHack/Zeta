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

     Enums:
       Credential-Mode        shared | dedicated-agent | human-only | unknown
       Human-Review           explicit | not-implied-by-credential | none
       Human-Review-Evidence  chat | pr-review | pr-comment | signed-policy | none
       Action-Mode            autonomous-fail-open | human-directed | supervised
       Task                   none | #NNNN | Otto-NN | ABC-NN

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
