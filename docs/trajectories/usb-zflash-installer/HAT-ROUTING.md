# First-session vertical — hat routing (slice 5 sketch)

Status: documentation-only until GitHub teams + CODEOWNERS land
Last refreshed: 2026-06-20

## Purpose

Route review authority by vertical hat so installer, observe, and cluster-substrate
changes do not cross-contaminate. This file is the hat-gate sketch from
[FIRST-SESSION.md](./FIRST-SESSION.md); `.github/CODEOWNERS` follows once team
slugs are confirmed with the maintainer.

## Path → hat map

| Hat | Paths | Review focus |
|-----|-------|--------------|
| **installer** | `full-ai-cluster/usb-nixos-installer/**`, `full-ai-cluster/nixos/modules/zeta-first-session.nix`, `src/Core.TypeScript/zflash/**` | ISO, install flow, profile.d wiring |
| **observe** | `src/Core.TypeScript/observe/first-session*.ts`, `src/Core.TypeScript/observe/observe.ts`, `src/Core.TypeScript/observe/grammar-16-render.ts`, `src/Core.TypeScript/observe/load-node-session.ts` | DU algebra, World channel, grammar overlay |
| **cluster-substrate** | `tools/installer/zeta-self-register.sh`, `full-ai-cluster/nixos/modules/zeta-self-register.nix`, `full-ai-cluster/nixos/modules/zeta-creds-restore.nix` | gh auth, cred restore, register PR |
| **architect** | `docs/BUILD-GATES.md`, `docs/trajectories/usb-zflash-installer/**` | Society validation tiers, trajectory state |

## Society validation by hat

| Hat | S0 gate | Society cadence |
|-----|---------|-----------------|
| observe | `bun test src/Core.TypeScript/observe/first-session*.ts` | `validate-local-llm.ts` (S2) |
| installer | `bun test src/Core.TypeScript/zflash/test-harness/**` | QEMU scenarios 1–4 (society) |
| cluster-substrate | cred restore unit tests | physical boot cred blob |
| architect | `preflight:quick` | peer replay ritual |

## CODEOWNERS follow-up

When teams exist, mirror this table into `.github/CODEOWNERS` with one line per
path prefix. Until then, PR authors tag the hat owner in the description per
[FIRST-SESSION.md](./FIRST-SESSION.md#hat--code-owner-sketch).
