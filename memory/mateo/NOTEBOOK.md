# Mateo — Notebook

Role: `security-researcher`. Agent file: `.claude/agents/security-researcher.md`.

Cross-session memory for Mateo. Newest entries first
(GOVERNANCE §18). 3000-word cap (BP-07); prune every third
substantive audit. ASCII only (BP-09); invisible-Unicode
linted (Nadia).

Frontmatter on the agent file wins on any disagreement with
this notebook (BP-08).

---

## Round 32 — seeded (empty)

Mateo's notebook directory landed this round as part
of the persona-memory normalization. No substantive entries
yet; first real audit / finding / cross-round decision goes
here.

## 2026-08-24 - triage of the 785 deferred sonarjs security-shaped sites

Dejan's deferral (workitem 081M0RBXF6J087G0R0023EX9X2) closed.
Re-measured at b276dd37a5: 443 `no-os-command-from-path`,
342 `publicly-writable-directories`. Corrections found in the
original measurement: the root list missed 528 files (repo-wide
total is 20,397, not 19,685) and 236 sites are already
suppressed, so the command rule's real footprint is ~679.

Two findings, not 784. P1: the biometric approval gate is a
`PATH`-resolved `sudo`, reproduced end-to-end returning
`ok:true` with no human. P2: `from-deb` predictable temp path
plus root `dpkg -i` with no digest (latent, empty manifest).

Method note worth keeping: **classify by whether the call
crosses a privilege boundary the attacker does not already
hold.** That single question collapsed 785 rows to 11 and
dismissed the entire `git`/`bun`/`gh` mass honestly.

Second note: a suppression's stated rationale is a claim, and
claims are checkable. `zflash/setup.ts:105` argued PATH
resolution was needed because sudo lives at
`/opt/homebrew/bin/sudo` on some Macs. Homebrew has no sudo
formula, and `/usr/bin/sudo` is SIP-`restricted`. Read the
disables, do not trust them.

CI recommendation: enable neither rule; a targeted
privilege-elevator lint (~15 sites) has better recall than the
443-site rule, which would not have caught the P1.

### Watch list

- `from-deb` manifest gaining its first entry -> the P2 goes live.
- `bus.ts` `ensureDir` accepts a pre-existing dir without an
  owner/mode check. Not a finding on a single-uid host; it is
  one on the NixOS cluster.
- 6 live `from-installer` URLs `curl`-to-exec with no digest
  pin. Supply chain, Malik's lane.
- 174 `sudo` uses across 37 `.sh` files that eslint cannot see.

## Pruning log

- Round 32 — seeded. First prune check after third substantive
  entry (BP-07 every-third-audit cadence).
