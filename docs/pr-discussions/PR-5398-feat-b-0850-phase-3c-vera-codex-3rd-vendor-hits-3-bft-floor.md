---
pr_number: 5398
title: "feat(081KSKBP80008QG0R003Z4C0D0 Phase 3c): Vera/Codex 3rd vendor \u2014 hits \u22653 BFT floor (Anthropic + Google + OpenAI); @openai/codex install + device-flow auth + control-plane enable (Aaron 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T04:08:00Z"
merged_at: "2026-05-27T04:16:36Z"
closed_at: "2026-05-27T04:16:36Z"
head_ref: "feat-b0850-3c-vera-codex-3rd-vendor-hits-bft-floor-2026-05-27-0512z"
base_ref: "main"
archived_at: "2026-05-27T19:27:08Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5398: feat(081KSKBP80008QG0R003Z4C0D0 Phase 3c): Vera/Codex 3rd vendor — hits ≥3 BFT floor (Anthropic + Google + OpenAI); @openai/codex install + device-flow auth + control-plane enable (Aaron 2026-05-27)

## PR description

## Summary

Hits the **≥3 BFT floor** Aaron named earlier 2026-05-27 (*"we should have three systemd agents and the cluster running on bootup"*).

| Phase | Persona | Vendor | Status |
|---|---|---|---|
| 1 | otto | Anthropic Claude | merged (#5392) |
| 3d | lior | Google Gemini | merged or armed (#5397) |
| **3c** | **vera** | **OpenAI Codex** | **THIS PR** |
| 3a | alexa | Alibaba Qwen (Kiro) | pending |
| 3b | riven | xAI Grok | pending |

3 vendors enabled = f=1 BFT margin for vendor-outage resilience + self-modification-safety. Stacked on PR #5397 to avoid merge conflicts.

## 3 changes

1. **zeta-install.sh 6.95a-codex** — \`bun install --global @openai/codex\` (WebSearch verified per dep-pin discipline)
2. **zeta-install.sh 6.95b-codex** — \`codex login --device-auth\` (cleanest device-flow shape of the 3 vendors; headless-friendly URL+code pattern). Creds cache at \`~/.codex/auth.json\` (NOT \`~/.config/codex/\`).
3. **zeta-ai-agent.nix** — removed vera assertion; **control-plane/configuration.nix** — \`zeta.aiAgents.enable.vera = true\` (otto + lior + vera = 3 personas, 3 vendors)

## Composes with

[PR #5397](https://github.com/Lucent-Financial-Group/Zeta/pull/5397) (Phase 3d Lior sibling) · PRs #5388 + #5389 (iter-5.5.0 credential persistence) · PRs #5392 + #5394 + #5395 (081KSKBP80008QG0R003Z4C0D0 Phase 1 + 3 refactor) · [081KSGS9H0008QG0R001JNKBFD](docs/backlog/P2/081KSGS9H0008QG0R001JNKBFD-...) · [081KSGS9H0008QG0R002T0XQ50](docs/backlog/P2/081KSGS9H0008QG0R002T0XQ50-...) · [081KS3X9Y0008QG0R00218150M multi-oracle BFT](docs/backlog/P*/081KS3X9Y0008QG0R00218150M-...)

Sources:
- [@openai/codex on npm](https://www.npmjs.com/package/@openai/codex)
- [Codex authentication docs](https://developers.openai.com/codex/auth)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T04:11:57Z)

## Pull request overview

This PR extends the NixOS “AI agents as systemd services” substrate toward the **≥3 vendor** resilience target by adding **OpenAI Codex** install/login steps (and also including Gemini install/login changes) and enabling additional personas on the control-plane host.

**Changes:**
- Add installer steps to `bun install --global` the Codex CLI and run `codex login --device-auth` (plus Gemini install/login steps).
- Remove the “not shipped yet” assertions for Vera/Codex and Lior/Gemini in the NixOS module.
- Enable `lior` and `vera` agents by default on the control-plane host.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 4 comments.

| File | Description |
| ---- | ----------- |
| full-ai-cluster/usb-nixos-installer/zeta-install.sh | Adds bun global installs for gemini/codex and interactive auth flows; adjusts pipefail usage. |
| full-ai-cluster/nixos/modules/zeta-ai-agent.nix | Removes assertions blocking vera/lior enablement (replaced with comments). |
| full-ai-cluster/nixos/hosts/control-plane/configuration.nix | Enables `lior` and `vera` systemd agents on the control-plane host. |


<details>
<summary>Comments suppressed due to low confidence (3)</summary>

**full-ai-cluster/usb-nixos-installer/zeta-install.sh:1109**
* P1 bug: `set -o pipefail` is being set inside the `bash -c` subshell, but the `| tail -5` pipeline is in the parent shell, so failures from `bun install` can be masked (the pipeline exit status will typically be `tail`'s). Move the `tail` into the same shell where `pipefail` is set so the `|| WARN` reliably triggers.
```
  sudo HOME="$ZETA_HOME" BUN_INSTALL="$ZETA_HOME/.bun" -u "#$ZETA_UID" \
    bash -c 'set -o pipefail; eval "$(mise activate bash 2>/dev/null || true)"; bun install --global @anthropic-ai/claude-code' 2>&1 | tail -5 || \
      echo "[iter-5.5.0]   WARN: bun install claude-code FAILED — can retry post-reboot via 'bun install --global @anthropic-ai/claude-code'"
```
**full-ai-cluster/usb-nixos-installer/zeta-install.sh:1166**
* P0 security: Gemini CLI credentials are documented (and appear to be stored) under `~/.gemini/` (e.g. `~/.gemini/oauth_creds.json`), but this script tells operators creds land in `~/.config/gemini/` and only tightens perms on that path. This likely leaves the real Gemini OAuth creds unprotected by the intended `chmod -R go-rwx`. Update both the messaging and the chmod/chown target to `~/.gemini/`.
```
  # 6.95b-gemini — interactive gemini auth login (mirror claude login).
  # 081KSKBP80008QG0R003Z4C0D0 Phase 3d 2nd vendor login flow. gemini-cli supports OAuth
  # via local HTTP server OR API-key paste. The interactive prompt
  # lets operator choose. Credentials persist to ~/.config/gemini/.
  GEMINI_BIN="$ZETA_HOME/.bun/bin/gemini"
```
**full-ai-cluster/nixos/modules/zeta-ai-agent.nix:233**
* P0 bug: the per-persona service loop still hardcodes `${persona.binary} --print ...` for all vendors, but Codex and Gemini don’t share Claude’s `--print` interface. Removing these assertions allows flake evaluation to succeed even though enabling `vera`/`lior` will create restart-looping services. Keep the assertions until `makeAgentService` is updated to call Codex via `codex exec ...` and Gemini via `gemini -p ...` (or equivalent non-interactive forms).
```
      # 081KSKBP80008QG0R003Z4C0D0.3c (Vera/Codex) shipped this PR — assertion removed.
      # zeta-install.sh Step 6.95a-codex installs @openai/codex via
      # bun + Step 6.95b-codex runs `codex login --device-auth`.
      # Binary lands at ~/.bun/bin/codex; creds at ~/.codex/auth.json.
      # 081KSKBP80008QG0R003Z4C0D0.3d (Lior/Gemini) shipped this PR — assertion removed.
      # zeta-install.sh Step 6.95a-gemini installs @google/gemini-cli
      # via bun + Step 6.95b-gemini runs interactive gemini auth login.
      # Binary lands at ~/.bun/bin/gemini.
```
</details>

## Review threads

### Thread 1: full-ai-cluster/usb-nixos-installer/zeta-install.sh:1123 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T04:11:56Z):

P1 bug: same pipefail masking issue as above for the Gemini CLI install; `bun install` failures may not trigger the warning because `tail` is outside the shell where `pipefail` is set.

### Thread 2: full-ai-cluster/usb-nixos-installer/zeta-install.sh:1133 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T04:11:57Z):

P1 bug: same pipefail masking issue as above for the Codex install; `bun install` failures may not trigger the warning because `tail` is outside the shell where `pipefail` is set.

### Thread 3: full-ai-cluster/usb-nixos-installer/zeta-install.sh:1212 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T04:11:57Z):

P2 documentation: this installer runs on a NixOS environment; the prompt text should avoid implying a Mac-only browser requirement. Since this is a device flow, it should be phrased as “any browser on any device”.

### Thread 4: full-ai-cluster/nixos/hosts/control-plane/configuration.nix:46 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T04:11:57Z):

P0 bug: enabling `lior`/`vera` will start services that invoke `${binary} --print`, but Codex is subcommand-based (non-interactive is `codex exec`, not a `--print` flag) and Gemini uses `-p` for non-interactive prompts. With the current `zeta-ai-agent.nix` loop, `zeta-vera.service`/`zeta-lior.service` are expected to restart-loop at boot. Either update the systemd ExecStart per-vendor, or keep these disabled here until the module supports the correct invocation shapes.
