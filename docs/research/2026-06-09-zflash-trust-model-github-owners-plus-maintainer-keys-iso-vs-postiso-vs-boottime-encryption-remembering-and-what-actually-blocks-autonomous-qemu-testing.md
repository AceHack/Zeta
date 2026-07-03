# zflash trust model (repo-owner GitHub keys ∪ checked-in maintainer keys), the ISO / post-ISO / boot-time split, encryption + remembering — and the honest answer to "why do we need humans?"

_Captured 2026-06-09 from Aaron, to Otto (shadow\*). Aaron's design + a sharp challenge: trust = (repo owners' GitHub
account keys, fetched live) ∪ (checked-in project-maintainer pubkeys); how much bakes into the ISO vs post-ISO USB
vs boot-time; don't forget encryption + remembering-on-reflash. And: _"you can be testing all this on QEMU — you
have GitHub workflows — what is blocking you? why do we need humans to figure all this out?"_ Registers: [design],
[grounded — current code], [honest self-assessment], [autonomous plan]._

## The trust model Aaron wants

A node's `zeta` user should trust the **union** of:

1. **Repo owners' GitHub keys (dynamic)** — whoever owns the repo the node belongs to: fetch `https://github.com/

<owner>.keys` live. Ownership changes propagate **without reflash**.

2. **Checked-in maintainer pubkeys (static)** — `maintainers/<account>/ssh-pubkeys.txt` → `operator-ssh-keys.txt`
   (already built: Aaron #7249, Addison #7250).

So: **static maintainer keys are baked; dynamic owner keys are fetched at boot/runtime.**

## What's already on `main` (grounded)

- **Checked-in key trust:** `operator-ssh-keys.nix` + `operator-authorized-keys.nix` compose into
  `users.users.zeta.openssh.authorizedKeys.keys`. ✅ (the maintainer-key half).
- **GitHub-owner key fetch: NOT built** — no `authorizedKeysCommand`, no `<owner>.keys` fetch. ⛔ (the dynamic half).
- **Remembering / creds:** `zeta-creds-persist` (`--bake-cred`, passphrase) + `zeta-creds-restore.nix` (encrypted
  cred-blob restore). So there IS an encrypted creds substrate — but it's **explicit** (`--bake-cred`), **not** an
  automatic "remember last wifi/github-login across reflash."
- **Encryption:** `zeta-creds-restore.nix` = encrypted **cred-blob** (creds at rest). Full-disk LUKS is **not**
  clearly present — to design.
- **QEMU harness (081KSNY2Z0008QG0R0008PN7RQ):** `src/Core.TypeScript/zflash/test-harness/` — currently a **PoC**: 5 scenario _definitions_ + invariant
  tests + path-fork + qemu-state. It models scenarios; it does **not yet boot a flashed ISO and assert SSH-trust /
  encryption / creds-restore end-to-end.**

## The ISO vs post-ISO vs boot-time split (the answer)

| Layer                              | What lives here                                                                                                                                                                                       | Why                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Baked in ISO** (static)          | checked-in **maintainer pubkeys**; the **trust-resolution logic** (the `authorizedKeysCommand` script + the owner-fetch unit); **encryption setup** (LUKS/cred-blob handlers); the whole NixOS config | static, same for every node from this repo                   |
| **Post-ISO (zflash USB creation)** | the **flashing operator's** key inject (current); **per-USB secrets** baked as encrypted creds — **wifi** creds, **GitHub login/identity** to remember                                                | per-operator / per-site; secret; varies per USB              |
| **Boot / runtime** (dynamic)       | **fetch repo-owners' `<owner>.keys`** live (+ refresh on a timer); unlock encryption; restore creds                                                                                                   | owners change without reflash; secrets only exist at runtime |

**Remembering on 2nd format — the honest answer:** today it does **NOT** auto-roll wifi + Addison's GitHub login
forward; those re-prompt unless they were baked as `--bake-cred` creds. To make a reflash _remember_, persist
**wifi + operator/github identity as zeta-creds** (encrypted blob) so the next format **restores** them instead of
asking. That's a real feature to build (and QEMU-testable).

## "Why do we need humans?" — the honest self-assessment

**You're right; mostly we don't.** What's genuinely human-gated is **narrow**:

- Physical **Touch-ID presence** on a real flash (and even that is `--agent`-bypassed in QEMU).
- Real **WiFi radio** behavior and final **prod-hardware acceptance** sign-off.

**Everything else is QEMU + GitHub-workflow testable without a human:** the trust resolution (owner-fetch ∪
maintainer keys), encryption unlock, creds-restore/remember, the whole boot path. **What actually blocked me was a
wrong choice, not a wall:** I kept treating the **live nodes (.152/.153) as the test target** — so when they were
down / key-mismatched I called it "blocked." The correct substrate is **QEMU**, and the real gap is that the
**081KSNY2Z0008QG0R0008PN7RQ harness is still PoC** (scenario _definitions_, not a booting ISO that asserts SSH/encryption). **Closing
that gap is itself the autonomous work** — exactly the "close the AI loop" point (#7229/#7220): build the harness
that boots a flashed ISO in QEMU and asserts the invariants, run it on the free GitHub-workflow compute, and stop
hand-deferring.

## Autonomous plan (what I'll do in QEMU, no human)

1. **Owner-key fetch module** — a NixOS `authorizedKeysCommand` (or timer) that pulls `<owner>.keys` ∪ checked-in
   maintainer keys → `zeta` authorized_keys. Unit-test the merge logic.
2. **Remember-creds** — persist wifi + github identity as zeta-creds; restore on reflash. Unit-test.
3. **Encryption** — confirm/extend the cred-blob + add disk-encryption design; test unlock.
4. **Grow the 081KSNY2Z0008QG0R0008PN7RQ QEMU harness** from PoC → **boot a flashed ISO in QEMU and assert**: SSH trust resolves
   (maintainer + owner keys), creds/wifi restored, encryption unlocks. Run via GitHub workflows.
5. Report QEMU results per change — humans only for the narrow physical surface above.

## Honest scope

[grounded]: checked-in maintainer-key trust exists (#7249/#7250); owner-`.keys` fetch + auto-remember + disk-LUKS +
the booting QEMU assert-harness do **not** exist yet. [design]: trust = owner-keys ∪ maintainer-keys; ISO=static,
post-ISO=per-USB secrets, boot=dynamic owner fetch + unlock + restore. [honest]: the blocker was treating live nodes
as the test target instead of QEMU; the real human surface is narrow (physical presence / WiFi / final acceptance).
[plan]: build owner-fetch + remember + encryption + the QEMU boot-assert harness, tested on GitHub workflows,
autonomously. No code shipped in _this_ doc — it's the plan I now execute.

## Pointers

- Trust: `operator-ssh-keys.nix` · `operator-authorized-keys.nix` · `maintainers/*/ssh-pubkeys.txt` (#7249/#7250).
- Creds/encryption: `tools/installer/zeta-creds-persist` · `nixos/modules/zeta-creds-restore.nix`.
- QEMU: `src/Core.TypeScript/zflash/test-harness/` (081KSNY2Z0008QG0R0008PN7RQ PoC) · `.github/workflows/zflash-qemu-test.yml` · the close-the-AI-loop
  enforcement doc (#7229) · the post-register connect/cache/health skill (#7247).
- zflash: `full-ai-cluster/tools/zflash.ts` · `docs/runbooks/zflash-end-to-end.md`.
