# Trajectory - USB / zflash Installer

Status: active — shipped + iterating; first surfaced as a trajectory 2026-05-29 from substrate inventory (the flashing mechanism works on `origin/main`; this surface was missing, so the workstream lived head-only)
Last refreshed: 2026-06-20
Type: workstream (current-focus) — a trajectory the operator is *actively powering*. Many trajectories can be tracked; only a few are workstreams at once (finite-focus / WIP-bounded — a workstream is a trajectory under sustained thrust, and thrust budget is finite, so most trajectories coast). (Genus = "trajectory"; "workstream" is the species: a trajectory under sustained thrust toward a deliverable, vs. emergent-posture trajectories like `anti-infection`. See [`factory-trajectory-surface`](../factory-trajectory-surface/RESUME.md) for the genus/species taxonomy.) One of the operator's three current cluster workstreams (encryption / usb-zflash / ts-workflow-engine).
Eventual encoding (design-stage — the human maintainer 2026-05-23 genetic-ID substrate + Clifford/HKT): this trajectory's state is trackable as a 128-bit genetic-ID seed (discrete, reversible via parser-combinator ↔ generator-function) → Clifford-space path (continuous, eventual). Mirrors the three-lane I8-lattice / I9-manifold split.
Current blocker: QEMU phase-3 wired (opt-in workflow_dispatch); society proof run next.
Next concrete action: dispatch build-iso with QEMU_FIRST_SESSION_PHASE3=1; physical WiFi out-of-band

## Why This Exists

The "usb/zflash" workstream is the **flashing mechanism** for getting NixOS
onto cluster hardware: the USB NixOS installer + the `zflash` tool (Touch ID +
random nonce + SSH-key auto-inject + control-plane/worker role-picker). It is
the sibling of `cluster-encryption-credential-substrate` (which owns *what*
secrets get injected); this trajectory owns *how the bits get onto the metal
and boot into a joinable node*.

**Deeper purpose — self-healing hardware (the human maintainer 2026-05-29):**
the USB is not only first-install; it is the *self-healing repair* mechanism for
the local accelerator cluster. A human's only job is to plug in the USB — any
failed node in the K8s / GPU-accelerator cluster re-images, re-joins, and
re-credentials itself. This gives Zeta **local + free-cloud both**: the
self-healing local accelerator cluster (owned metal, GPU compute, sovereignty)
composing with the free GitHub-Actions cloud swarm (B-0874, zero-marginal-cost
because open-source). The workflow engine
(`ts-workflow-engine-du-state-machine` trajectory) is portable across both
substrates; usb/zflash keeps the local one alive with minimal human-in-the-loop
(physical-only — plug in the USB, everything else automated).

## Grounding (on `origin/main`)

Shipped artifacts:

- [`src/Core.TypeScript/zflash/cli.ts`](../../../src/Core.TypeScript/zflash/cli.ts) — the flashing tool (Touch ID + nonce + SSH auto-inject)
- [`full-ai-cluster/usb-nixos-installer/`](../../../full-ai-cluster/usb-nixos-installer/) — the installer ISO substrate + first-boot role-picker
- [`.claude/skills/flash-cluster-iso/SKILL.md`](../../../.claude/skills/flash-cluster-iso/SKILL.md) — operator + agent-driven (expect) flashing skill

Grounding backlog:

- [`B-0844`](../../backlog/P1/081KSGS9H0008QG0R001EZKNCB-zflash-agent-mode-native-implementation-close-doc-vs-impleme.md) — zflash agent-mode native implementation (**closed** — `--agent` in `cli.ts`)
- Workitem `081KV1PY2H308QG0R00347547K` — `zeta flash` MCP router (**done** #8104)
- [`B-0831`](../../backlog/P1/081KSGS9H0008QG0R0011BC7T2-ci-cascade-6-full-install-plus-cluster-auto-join-eliminate-r.md) — CI cascade-6: slices 1–3 landed (#8126, #8129, #8139); scenarios 1 + 2 hard gate (scenario 2 green run 27602908527 after #8478 initrd virtio)
- [`B-0835`](../../backlog/P1/B-0835-installer-config-bugs-cluster-hostname-not-unique-gh-auth-not-respected-banner-password-disclosure-empirical-aaron-2026-05-26.md) — installer config bugs (hostname-not-unique, gh-auth, banner)
- [`B-0792`](../../backlog/P1/B-0792-iter5-wifi-credentials-injection-via-usb-esp-for-zero-typing-cluster-bringup-without-ethernet-load-bearing-for-homelab-persona-aaron-2026-05-26.md) — iter-5 WiFi-credentials injection via USB ESP (zero-typing bringup without ethernet)
- [`B-0789`](../../backlog/P1/B-0789-iter4-ssh-key-and-hashedpassword-substrate-for-cluster-bringup-2026-05-26.md) — iter-4 SSH-key + hashedPassword substrate (shared seam with encryption)

## Composes with

- `cluster-encryption-credential-substrate` trajectory — shares the B-0789 / B-0852 creds-on-USB seam
- B-0846 (installer WiFi reproducibility / nixos.org timeouts / cachix mirror) + B-0832 (installer nmtui WiFi rescan) — physical-hardware-tested WiFi hardening (verify on-disk; cite once row paths confirmed)

## Current Rule

The happy path is zero-typing: flash with zflash, boot, pick role, join. Every
manual step at the physical machine is debt — drive it toward the B-0831 CI
full-install path so a human never has to babysit a USB stick for a routine
bringup.

## Current Next Action

QEMU scenarios 1–4 green ([run 27854227014](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/27854227014)); 3+4 hard gate on `workflow_dispatch`. **Post-login:** [FIRST-SESSION.md](./FIRST-SESSION.md) slice 3 — profile.d adventure + gh executor on installed nodes.

## Society validation (not PR-centric)

Per [`docs/BUILD-GATES.md`](../../BUILD-GATES.md): local `preflight` before push; peer replay; CI is signal. Tiers S0–S6 in FIRST-SESSION.md. Full QEMU cascade = society cadence, not per-edit tax.
