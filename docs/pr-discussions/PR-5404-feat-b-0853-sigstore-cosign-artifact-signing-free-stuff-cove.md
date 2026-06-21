---
pr_number: 5404
title: "feat(081KSKBP80008QG0R000Y2B7HC): sigstore/cosign artifact signing \u2014 free-stuff coverage for ISO + containers + tarballs + Nix substitutes (Aaron 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T05:57:06Z"
merged_at: "2026-05-27T05:58:51Z"
closed_at: "2026-05-27T05:58:51Z"
head_ref: "backlog/b-0853-sigstore-cosign-artifact-signing-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T19:25:25Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5404: feat(081KSKBP80008QG0R000Y2B7HC): sigstore/cosign artifact signing — free-stuff coverage for ISO + containers + tarballs + Nix substitutes (Aaron 2026-05-27)

## PR description

## Summary

- Free-stuff signing substrate authorized by Aaron after asking about Let's Encrypt (LE explicitly out-of-scope for code signing)
- Phase 1 = container path: cosign keyless via GitHub OIDC → Fulcio CA → Rekor transparency log; zero key management; zero cost
- Phase 2-5 = ISO blob signing + tarballs + Nix substitutes + install-path verification + SLSA attestations
- Commercial CAs deferred for proprietary OS surfaces (Windows Authenticode, macOS notarization, EV code signing); Aaron-funded when load-bearing

## Composes with

- **081KSGS9H0008QG0R0012R8ZWS** — artifact attestation; sigstore IS the primitive provider
- **081KSKBP80008QG0R003Z4C0D0** — cluster substrate the signed artifacts deploy into
- **081KSGS9H0008QG0R0011BC7T2** — CI cascade 6 full-install path; consumes signed artifacts
- **081KSKBP80008QG0R003AX2A69** — credential persistence; per-AI identity binding composes with sigstore OIDC identity
- **081KSGS9H0008QG0R003JNSVR5** — installer creds discipline; cosign verify-blob in zeta-install.sh composes with no-creds-on-ISO floor
- **081KSGS9H0008QG0R00126RHQR** (deferred) — release-attach work; sig + pem attach to GitHub release

## Outreach channel (Aaron 2026-05-27)

Aaron / Addison / Max available for future form-filling: SignPath Foundation OSS app, Apple Developer Program enrollment, commercial CA EV liaison. Sigstore needs zero outreach (open community substrate).

## Sub-rows enumerated

081KSKBP80008QG0R000Y2B7HC.1-8 in row body. Order: container path (1→2) → ISO + install verify (3→5) → Nix substituter (4) → cluster verify + SLSA (6→7) → substrate landing (8).

## NCI floor preserved

Per .claude/rules/non-coercion-invariant.md HC-8: keyless OIDC model defeats single-key-loss failure mode; identity binding at OIDC issuer + Fulcio CA root scope. NixOS substituter key stays operator-controlled where operator-must-own.

## Test plan

- [ ] Backlog index regen verified (BACKLOG.md shows 081KSKBP80008QG0R000Y2B7HC at P1)
- [ ] Composes_with reciprocity check (081KSGS9H0008QG0R0012R8ZWS + 081KSKBP80008QG0R003Z4C0D0 + 081KSGS9H0008QG0R0011BC7T2 + 081KSKBP80008QG0R003AX2A69 + 081KSGS9H0008QG0R003JNSVR5 + 081KSGS9H0008QG0R00126RHQR)
- [ ] Phase 1 implementation sub-rows (081KSKBP80008QG0R000Y2B7HC.1-8) filed when implementation work claims parent row

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-27T05:57:11Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
