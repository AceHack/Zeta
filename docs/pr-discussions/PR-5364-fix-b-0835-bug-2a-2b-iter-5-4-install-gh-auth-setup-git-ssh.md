---
pr_number: 5364
title: "fix(081KSGS9H0008QG0R00120EEHM Bug 2a + 2b): iter-5.4 install \u2014 gh auth setup-git + ssh-key scope discrimination"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T00:33:18Z"
merged_at: "2026-05-27T00:36:02Z"
closed_at: "2026-05-27T00:36:02Z"
head_ref: "fix-b0835-bug2ab-gh-auth-setup-git-ssh-key-scope-handling-otto-cli-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:29:00Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5364: fix(081KSGS9H0008QG0R00120EEHM Bug 2a + 2b): iter-5.4 install — gh auth setup-git + ssh-key scope discrimination

## PR description

## Empirical anchor — 2026-05-26 2nd physical hardware-support test

Aaron's screen photo (verbatim console output from re-flashed USB run after Bug 1 + Bug 3b fixes landed):

\`\`\`
[iter-5.4.0] Run gh auth login now? [Y/n]: Y
[iter-5.4.0]   running 'gh auth login' (interactive)...
! First copy your one-time code: D30B-468F
Open this URL to continue in your web browser: https://github.com/login/device
■ Authentication complete.
! Authentication credentials saved in plain text
■ Logged in as AceHack
[iter-5.4.0]   gh auth login: SUCCESS
[iter-5.4.0]   fetching operator's SSH pubkeys via 'gh ssh-key list'...
[iter-5.4.0]   WARN: 'gh ssh-key list' failed; no keys written
[iter-5.4.0]   (gh auth succeeded but the user has no SSH keys
[iter-5.4.0]   registered with GitHub, OR the jq/tee pipe broke)
[iter-5.4.1] ── self-registration commit+push (081KSGS9H0008QG0R0037H3W4T) ──
[iter-5.4.1]   maintainer:  AceHack
[iter-5.4.1]   node-name:   node-efe404
Switched to a new branch 'register-node-efe404-20260527T0005332'
Username for 'https://github.com': acehack
Password for 'https://acehack@github.com':
\`\`\`

Two sub-bugs surfaced (both new — beyond Bug 1 / Bug 3 already fixed this session).

## Bug 2a — CRITICAL — git push prompts HTTPS basic-auth despite gh auth login

Root cause: \`gh auth login\` stores token in gh config but does NOT configure git's credential helper. Without setup-git, \`git push\` goes through the default credential-store chain which doesn't know about gh's token.

Fix: insert \`gh auth setup-git\` immediately after successful \`gh auth login\` in zeta-install.sh Step 6.8. Configures \`credential.helper\` to delegate to \`gh auth git-credential\` so all github.com git operations automatically use the gh token. Failure is non-fatal (warning only).

## Bug 2b — degraded — gh ssh-key list returns empty / fails

Root cause discrimination: \`gh auth login\` default scopes (\`repo, read:org, workflow, gist\`) do NOT include \`admin:public_key\` or \`read:public_key\` required by \`gh ssh-key list\`. Empty result could also mean operator has no SSH keys at GitHub.

Fix: capture stderr from \`gh ssh-key list\`; if empty result + stderr mentions scope, print substrate-honest recovery commands (\`gh auth refresh -s admin:public_key\` + populate + rebuild). If empty without scope-error, point to https://github.com/settings/keys.

Defers opt-in \`--with-ssh-key-scope\` flag to future B-NNNN (security tradeoff: don't ask for elevated scope by default).

## Files

- \`full-ai-cluster/usb-nixos-installer/zeta-install.sh\` — \`gh auth setup-git\` after login; stderr-capturing ssh-key-list with 3-way discrimination (success / empty-with-scope-error / empty-no-scope-error / pipe-broke)
- \`docs/backlog/P1/081KSGS9H0008QG0R00120EEHM-*.md\` — Bug 2a + 2b verbatim empirical anchors + fix specs + acceptance criteria for 3rd physical test

## Acceptance for next physical test cycle

- iter-5.4.1 \`git push\` completes silently without basic-auth prompt
- Self-registration PR URL is printed + browseable on github.com
- If operator has SSH keys: writes operator-authorized-keys with key count
- If operator has no SSH keys at GH: substrate-honest WARN points to settings/keys
- If scope-error: substrate-honest WARN provides recovery commands

## Composes with

- 081KSGS9H0008QG0R00120EEHM (this row — Bug 2a + 2b empirical anchors land in body)
- 081KSGS9H0008QG0R0037H3W4T iter-5.4.1 self-registration (the step Bug 2a blocks)
- 081KSGS9H0008QG0R002K93MWX iter-5.4.2 ArgoCD reconciliation (downstream of self-reg)
- 081KSGS9H0008QG0R001RR3ZXQ install log preservation (would have diagnosed Bug 2a faster — composes)
- 081KSGS9H0008QG0R003JNSVR5 auth tension (Bug 2a is concrete instance of the interactive-login vs token-baked tension)

## Substrate-honest framing

This is a continuation of the autonomous-loop physical-test fix cycle. Per Aaron's "great iteration we learned a lot" the loop is: test → bug → fix → re-flash → re-test. Bug 1 + Bug 3a + Bug 3b shipped in prior PRs this session; Bug 2 was diagnosis-dependent; the 2nd test surfaced it as two distinct sub-bugs (2a + 2b) with concrete fix paths.

Per \`.claude/rules/verify-existing-substrate-before-authoring.md\`: substrate-inventory pass found 081KSGS9H0008QG0R00120EEHM already names "gh login not respected" at Bug 2 scope; this PR extends with 2 specific sub-bugs rather than minting parallel substrate.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-27T00:33:24Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
