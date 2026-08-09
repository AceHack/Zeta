---
id: 081KZKV16YF08QG0R003CYZX8S
type: bug
state: backlog
priority: P2
slug: from-installer-vendor-clis-are-fetched-and-exec-d-with-no-ha
title: "from-installer vendor CLIs are fetched and exec'd with no hash pin — verifySha256File exists but is never called"
created: 2026-08-09T18:02:18.959Z
depends_on: []
composes_with: []
---

# from-installer vendor CLIs are fetched and exec'd with no hash pin — verifySha256File exists but is never called

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZKV16YF08QG0R003CYZX8S-*.md` glob. -->

## The gap

Found by **Mateo** (security-researcher) reviewing the nix-ld PR (#10196); verified by Otto.

`src/Core.TypeScript/ace/setup-realizers/curl-fetch.ts:40` **exports `verifySha256File`** —
and `src/Core.TypeScript/ace/setup-realizers/from-installer.ts` **never calls it** (verified:
0 references). The only trust anchor on that path is a scheme check,
`from-installer.ts:70` → `if (!url.startsWith("https://"))`.

`tools/setup/manifests/from-installer` fetches-then-execs six vendor installers with **no hash
pin**:

```
grok          https://x.ai/cli/install.sh
cursor-agent  https://cursor.com/install
hermes        https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh
forge         https://forgecode.dev/cli
agy           https://antigravity.google/cli/install.sh
```

## Why it matters more than it looks

The chain of privilege, all verified in-repo:

- `zeta-install.sh` sets `ZETA_INSTALL_FULL=1` on the **unattended first-boot** path, which
  un-gates the `from-installer` manifest — so this runs on every node bringup, with no operator
  watching.
- Those installers run as `zeta`, who is in `extraGroups = [ "wheel" … ]` (`common.nix`), and
  `nix.settings.trusted-users = [ "root" "@wheel" ]` (`common.nix`). **A Nix trusted user is
  root-equivalent** — it can add substituters and inject arbitrary store paths.
- `zeta-creds-restore.nix` has already decrypted `gh` / `claude` / `gemini` / `codex`
  credentials into that home by the time they execute.

So a compromise of any one of those five URLs is a root-equivalent, credential-adjacent
compromise of every node, unattended, on first boot.

## Prescribed fix (already written, just unwired)

`docs/security/SUPPLY-CHAIN-SAFE-PATTERNS.md` already prescribes exactly this: after
SHA-256 pinning, `curl <pinned-url> | bash` becomes acceptable. The verification function is
already implemented. The work is:

1. Wire `verifySha256File` into `from-installer.ts` with **per-entry pins** in the manifest
   (same content-pin discipline `MISE_SHA256_*` already uses in `tools/setup/linux.sh`).
2. Add the `from-installer` class as a row in the `SUPPLY-CHAIN-SAFE-PATTERNS.md` ingress
   table — it currently covers `{brew, apt, dotnet-tools, uv-tools, verifiers}` only, so this
   ingress class is **undocumented**.
3. Bumping a vendor CLI then becomes "update URL + hash together", like the mise pin set.

## Relationship to nix-ld (#10196) — pre-existing, NOT caused by it

Mateo's framing, worth preserving: before nix-ld, these prebuilt dynamically-linked vendor
binaries **could not execve** on installed NixOS nodes. That was an **accidental** control (it
was the bug being fixed), never a designed mitigation. #10196 moves the fleet from
"accidentally inert" to "working as designed" — and the designed state is the one that needs
this pin. Route the concern to the design, not to the loader.

## Sibling findings from the same review (separate rows if taken)

- `nixos/modules/zeta-ai-agent.nix` has **zero** systemd sandboxing (no `NoNewPrivileges`,
  `RestrictSUIDSGID`, `ProtectSystem`, `PrivateTmp`, …) on the units that execute these
  binaries. Near-zero functional cost for user-level CLIs; also structurally closes Mateo's
  `AT_SECURE` watch item (nix-ld does not honour `AT_SECURE`; currently unreachable because
  no foreign setuid binary exists — detector: `find / -xdev -perm -4000 -type f ! -path
  '/nix/store/*'` must stay empty).
- `MISE_PYTHON_GITHUB_ATTESTATIONS=0` (`common.nix`) — already tracked in `SECURITY-BACKLOG.md`,
  but nix-ld makes those unverified artifacts executable, i.e. "deferred and inert" →
  "deferred and live".
- Reconsider `nix.settings.trusted-users` including `@wheel` given `zeta` runs unpinned
  third-party code (has real operator-ergonomics cost — needs Dejan's judgement).

## Owner

Security (Mateo/Malik) + devops (Dejan, GOVERNANCE §24). Mateo offered to write these up as
`docs/BUGS.md` P0-security rows rather than backlog — Aaron's call on severity.
