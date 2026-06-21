---
id: 081KRQ1AB0008QG0R0038VQJZ0
priority: P2
status: open
title: "GitHub App for factory automation — separate API rate-limit pool from human-user accounts"
tier: factory-infrastructure
effort: M
created: 2026-05-16
last_updated: 2026-05-16
depends_on: []
composes_with: [081KRQ1AB0008QG0R002422Z9Q]
tags: [github, github-app, authentication, rate-limit, scarcity-mitigation, factory-infrastructure]
type: feature
---

# GitHub App for factory automation

## Origin

Falls out of 081KRQ1AB0008QG0R002422Z9Q (scarcity tracker) decomposition. The 2026-05-16 session empirically demonstrated that 3-4 concurrent agents all authenticating as a single GitHub user (`AceHack`) can saturate the shared 5000/hr GraphQL bucket in under an hour. GitHub Apps have **separate rate-limit pools** designed for automation, scaling with installation activity rather than borrowing from a human user's budget.

This is the **primary capacity mitigation** for the scarcity problem 081KRQ1AB0008QG0R002422Z9Q surfaces. Tracker without expansion = visibility into a constrained pool; tracker + GitHub App = visibility into a larger, automation-appropriate pool.

## What

Install a "Zeta-Factory" GitHub App on the `Lucent-Financial-Group/Zeta` repository and route automated agent work through it via installation access tokens, rather than personal access tokens (PATs) tied to a human user.

## Why GitHub App vs alternatives

| Approach | Pool | Attribution | Trade-off |
|---|---|---|---|
| Shared user PAT (current) | 1 × 5000/hr (per user) | Human user identity | Saturates with multiple agents |
| Per-agent user PATs | N × 5000/hr (per added user) | Multiple human identities | Identity confusion; ongoing account management |
| **GitHub App** | Separate pool, scales with installation activity (typically 5000/hr+ for active installs) | `Zeta-Factory[bot]` clean attribution | Setup; permissions config; bot-author PRs |

GitHub App is the substrate-honest choice for **automated factory work**. Human contributors keep using PATs for their work; automated agents (Otto background worker, Lior, scheduled routines) auth via the App.

## Acceptance criteria

- [ ] GitHub App created in LFG organization with permissions matching factory needs:
  - Repository: contents (write), pull requests (write), issues (write), discussions (write), checks (read), commit statuses (write), workflows (write)
  - Organization: read members, read teams
- [ ] App installed on `Lucent-Financial-Group/Zeta` repository
- [ ] App installation token retrievable via `tools/auth/get-installation-token.ts` (uses JWT signed with App private key + installation ID)
- [ ] Factory automation scripts (peer Otto background worker, Lior loops, scheduled routines) updated to use installation token instead of user PAT
- [ ] Documented in `docs/AUTH.md` or similar — when to use App vs PAT
- [ ] Rate-limit tracker (081KRQ1AB0008QG0R002422Z9Q) reports App + user pools separately
- [ ] Tests cover token-rotation logic (installation tokens expire ~1hr; need refresh)

## Why now

Mid-session GraphQL saturation (2026-05-16) blocked PR #3945 thread resolution for ~13 minutes. With current usage patterns (3-4 agents concurrent), saturation will recur whenever multiple agents fire at once. App-based auth eliminates the shared-bucket failure mode for automated work.

## Design sketch

```typescript
// tools/auth/get-installation-token.ts

import { createAppAuth } from "@octokit/auth-app";

export async function getInstallationToken(): Promise<string> {
  const auth = createAppAuth({
    appId: process.env.ZETA_APP_ID!,
    privateKey: await readFile(process.env.ZETA_APP_PRIVATE_KEY_PATH!, "utf-8"),
    installationId: parseInt(process.env.ZETA_APP_INSTALLATION_ID!),
  });
  const { token } = await auth({ type: "installation" });
  return token;  // expires ~1hr; callers re-fetch as needed
}
```

Agent scripts:

```typescript
// Replace: await ghCli("api", "...");  // uses user PAT
// With:    const token = await getInstallationToken();
//          await ghCli("api", "...", { env: { GH_TOKEN: token } });
```

## Decomposition into implementation slices

| Slice | Description | Status |
|-------|-------------|--------|
| 1 | Create GitHub App in LFG org with required permissions | open |
| 2 | Install on Zeta repo; capture App ID + installation ID + private key secrets | open |
| 3 | `tools/auth/get-installation-token.ts` — JWT signing + installation token fetch | open |
| 4 | Token-rotation logic (1hr expiry) + caching | open |
| 5 | Update peer Otto background worker prompt to use App token | open |
| 6 | Update Lior antigravity loop to use App token | open |
| 7 | Document in `docs/AUTH.md`; update scarcity tracker (081KRQ1AB0008QG0R002422Z9Q) to report App + user pools separately | open |

## Composes with

- 081KRQ1AB0008QG0R002422Z9Q (scarcity tracker — measures the pools this row expands)
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` (rate-limit-wait composes; with App, the wait shifts to a different bucket)
- `.claude/rules/methodology-hard-limits.md` (App must NOT have permissions beyond what factory work requires; least-privilege)
- `.claude/rules/glass-halo-bidirectional.md` (App actions attributable as `[bot]`; substrate-honest about which work is human vs automated)

## Substrate-honest caveats

- App-based PR creation shows author as `Zeta-Factory[bot]` rather than `AceHack` — different attribution; CODEOWNERS / review rules may need adjustment
- App tokens expire every ~1hr; token-rotation logic is a non-trivial implementation detail
- App permissions are per-installation; over-grant = security risk, under-grant = automation fails
- Secrets management for App private key — needs secure storage (env var, secret manager, etc.)

## Open questions

1. **App permissions scope** — what's the minimum permission set the factory's automated work needs?
2. **PR attribution** — should App-authored PRs include `Co-Authored-By: <human>` trailer to preserve attribution?
3. **App vs multiple Apps** — one App for all factory work, or separate Apps per agent surface (Otto/Lior/Riven)?
4. **Migration path** — switch automated agents to App incrementally, or all-at-once?
5. **Cost** — GitHub Apps on free tier should work for this scale; verify no surprises.

## Pre-start checklist

- [ ] Verify LFG org admin can create GitHub Apps (org owner permissions check)
- [ ] Inventory current automated-agent API call sites (Otto bg worker, Lior, scheduled routines, install scripts)
- [ ] Confirm secrets-management approach (env vars vs secret manager)
