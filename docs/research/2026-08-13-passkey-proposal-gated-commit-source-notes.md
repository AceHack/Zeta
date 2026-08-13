# Passkey Proposal → Gated Commit: Source Notes

This note records official sources consulted for the credentialless GitHub Pages control model. The signature verifier, branch planner, bounded PR handoff, and fault-injection checks are implemented; the committed author registry remains deliberately empty until a maintainer independently approves an enrollment package.

| Source | Relevant constraint | Design consequence |
|---|---|---|
| W3C WebAuthn Level 3 [1] | WebAuthn credentials are scoped to the relying party origin; an authenticator requires user consent and returns a public-key assertion. Registration and authentication depend on a relying-party challenge. | A Pages PWA may request a user-approved passkey assertion for a proposal, but must bind a fresh, one-use challenge to the proposal digest and current origin. A passkey does not grant GitHub repository authority. |
| GitHub Actions event documentation [2] | Workflows can be triggered from GitHub events, schedules, or external events; event-triggered workflows run only when the workflow file exists on the default branch. | A verifier workflow on `main` can consume a durable GitHub proposal carrier and create a separate branch for a validated proposal. Protected-main policy remains independently enforced. |
| GitHub artifact-attestation guidance [3] | Actions can produce verifiable build provenance using the workflow identity, OIDC, and attestation permissions. | Build provenance can complement proposal evidence, but it does not replace human/passkey proposal authorization or replay prevention. |
| GitHub OAuth authorization guidance [4] | The browser-oriented authorization-code exchange requires a client secret; GitHub also states that CORS preflight is not supported for its authorization endpoint. | A static GitHub Pages PWA cannot safely complete the standard OAuth token exchange or safely keep a shared organization credential. |
| GitHub App security guidance [5] | GitHub says a GitHub App private key must never ship in client-side code; it also cautions that device flow is intended for constrained/headless environments and public clients are spoofable. | Device flow is not a substitute for a repository execution boundary. The PWA signs proposals; GitHub Actions owns bounded execution. |

## Minimum proposal envelope

```json
{
  "schema": "zeta.proposal.v1",
  "proposalId": "uuid",
  "repository": "Lucent-Financial-Group/Zeta",
  "baseRef": "main",
  "baseSha": "immutable commit SHA",
  "createdAt": "RFC3339 UTC",
  "expiresAt": "RFC3339 UTC",
  "nonce": "32-byte random base64url",
  "changeDigest": "sha256 of canonical change payload",
  "authorCredentialId": "WebAuthn credential ID",
  "assertion": "WebAuthn assertion over canonical envelope digest"
}
```

The verifier must reject an unknown credential, wrong repository/ref, stale base SHA, expired proposal, reused nonce/proposal ID, bad assertion, origin or RP-ID mismatch, and a payload whose canonical digest differs from the signed value. Each rejection must produce a teaching error that identifies the invalid field and the corrective generator.

## Authority split

The PWA signs a proposal only. The GitHub Action verifies it and uses its own ephemeral `GITHUB_TOKEN` to create a branch; it never writes directly to protected `main`. The standard required gate reviews that branch/PR. A GitHub App or local runner remains the appropriate executor for unattended agents, because a static Pages PWA cannot keep a durable shared write credential safe from browser compromise.

## Operational sequence

The committed author registry begins empty intentionally. A newly created passkey has **no repository authority** until a maintainer independently reviews the exported enrollment package and adds its parsed P-256 public key, credential ID, exact GitHub Pages origin, and RP ID to `docs/security/proposal-author-registry.json` in a normal protected PR. This separates registration from authorization and prevents any visitor from converting their own passkey into write access.

| Step | Actor | Authority used | Bounded result |
|---|---|---|---|
| 1. Enroll | Person, from the primary GitHub Pages origin | OS/platform passkey or security key | An exportable public enrollment package only; no GitHub token and no repository mutation. |
| 2. Authorize | Maintainer through a standard protected PR | Existing normal maintainer review path | A named public credential appears in the registry after required gates. |
| 3. Propose | Person or agent via GitHub Pages | Passkey assertion over an immutable base SHA, nonce, expiry, and exact unified Git patch | A GitHub issue created under that submitter's own GitHub session. |
| 4. Verify and stage | GitHub Action | Ephemeral `GITHUB_TOKEN` with contents write | A one-time `proposal/<UUID>` branch, a receipt, and no protected-main write. |
| 5. Hand off | Same Action | `ZETA_PR_ARCHIVE_TOKEN`, confined to Pull requests: write | A review PR whose required checks remain the merge authority. A failed PR handoff deletes the temporary branch. |

The verifier rejects schema/repository/ref substitutions, non-immutable base SHAs, expired envelopes, wrong change digests, unknown or mismatched credentials, client-data or origin errors, RP-ID mismatch, missing user verification, bad signatures, and consumed nonce or proposal IDs. Every rejection carries a `-1` retraction label and a named corrective generator.

> **Security invariant:** neither GitHub Pages nor the browser receives a shared organization token, an installation token, a GitHub App private key, or the Action's ephemeral write credential. Possession of a passkey proves consent to a proposal; it does not bypass branch protection or create autonomous authority to merge.

## References

[1]: https://www.w3.org/TR/webauthn-3/ "W3C Web Authentication: An API for accessing Public Key Credentials, Level 3"
[2]: https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows "GitHub Docs: Events that trigger workflows"
[3]: https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations/using-artifact-attestations-to-establish-provenance-for-builds "GitHub Docs: Using artifact attestations to establish provenance for builds"
[4]: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps "GitHub Docs: Authorizing OAuth apps"
[5]: https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/best-practices-for-creating-a-github-app "GitHub Docs: Best practices for creating a GitHub App"
