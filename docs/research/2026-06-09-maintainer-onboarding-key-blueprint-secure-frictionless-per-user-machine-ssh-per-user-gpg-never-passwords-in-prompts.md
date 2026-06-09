# Maintainer-onboarding key blueprint: secure + frictionless by default — per-(user,machine) SSH, per-user GPG, AI gets creds the right way, never passwords-in-prompts

*Captured 2026-06-09 from Aaron. The ad-hoc key-setup for Aaron + Addison (#7261/#7267) should become a **repeatable
maintainer-onboarding blueprint** — security-best-practice, Max-tested, easy, a Blueprint (Addison's pattern).
Governing principle: **"secure and frictionless by default — the AI just does the right thing, asks the right
questions, and gets the right credentials the right way, never with pasting passwords into prompts."** Registers:
[design — Aaron], [security best-practice], [build front: a blueprint], [first-instances done].*

## The governing principle

> **Secure + frictionless by default. The AI does the right thing, asks the right questions, gets the right
> credentials the right way — NEVER by pasting passwords into prompts.**

Credentials flow through proper channels (device-flow, OS keychain, GH secrets, ssh-agent, `--with-token` from a
secret) — **a password is never typed into an AI prompt.** Friction is the killer of time; security is non-negotiable;
the blueprint delivers both by automating the right flow and asking only the minimal right questions.

## What the blueprint provisions (per maintainer)

| Key | Scope | Where the pub goes | Best practice |
|---|---|---|---|
| **SSH** | **per (user, machine)** — one keypair *per machine*, comment `<email> (<host>)` | `maintainers/<account>/ssh-pubkeys.txt` (one line per machine) **+** GitHub (`gh ssh-key add`) | ed25519; private **never leaves the machine**, never committed; **per-machine revocability** (lose a laptop → revoke just its key); the node-trust set is the union (`operator-ssh-keys.txt`) |
| **GPG** | **per user** — one signing identity (optionally device subkeys) | `maintainers/<account>/gpg-pubkey.asc` **+** GitHub (`gh gpg-key add`) | ed25519 sign; **UID email = the account's real email** (matches GitHub → Verified commits); revocation cert kept; `user.signingkey` + `commit.gpgsign=true` configured |
| **gh token** (when needed) | minimal scope (`repo`, `admin:public_key`) | **GH secret** (repo or `test`/`prod` env), never the repo | **never password-in-prompt** — device-flow (interactive) or token-in-secret (headless); AI saves the token as a secret, the human does the irreducible mint |

**The per-(user,machine) answer (Aaron's question):** **SSH = yes, per machine** (revocable, clear provenance,
private never shared across machines); **GPG = per user identity** (the person's signing self; synced or device
subkeys). This is the security-best-practice split.

## The flow (what the blueprint runs — secure, frictionless, no password prompts)

1. **Ask the right questions only:** your account email, this machine's name. (Nothing else; no passwords.)
2. **Generate** the per-machine SSH key (`ssh-keygen -t ed25519 -N "" -C "<email> (<host>)"`) + the per-user GPG key
   (`gpg --quick-generate-key "<Name> <email>" ed25519 sign`) — non-interactive, no passphrase prompt (or hardware/
   agent-backed for higher security tiers).
3. **Publish** pubkeys to `maintainers/<account>/{ssh-pubkeys.txt,gpg-pubkey.asc}` (public — safe). **Never** commit
   a private key (`.gitignore` + GH secret for any private material).
4. **Register** to the maintainer's **own** GitHub (`gh ssh-key add`, `gh gpg-key add`), **cleaning up stale keys**
   first; configure commit signing.
5. **Verify** every published file's UID/email matches the intended account *before* committing (the noreply-bug
   lesson: trust the file content, not the export command).
6. **Trust** flows git-native: the published pubkeys are baked into the ISO (trust roots, #7253); nodes reformat to
   adopt; forks use their **own** maintainer subtree (origin-derived, never upstream's, #7260).

## Package as a Blueprint; Max tests it; make it easy

Per Aaron: "add all this for new maintainers, whatever security best practices are; get Max to test + make sure it's
easy; maybe a blueprint around it." → a **`maintainer-onboard` skill → blueprint** (Addison's skill-blueprints
pattern): a small skill description routing to a blueprint body that runs the flow above. **One command**, minimal
questions, no passwords-in-prompts. **Max tests** the ease + correctness (the DX/AX lens). The first runs — Aaron's
(#7261/#7267) and Addison's (#7267) keys — are the validation instances; the ad-hoc errors along the way (hung
`ssh-keygen -c`, wrong UID email) are exactly why this belongs in a tested blueprint, not hand-typed each time.

## Honest scope

[design — Aaron]: secure + frictionless maintainer-onboarding key flow; per-(user,machine) SSH + per-user GPG;
AI-does-the-right-thing, never passwords-in-prompts; a Blueprint, Max-tested, easy; cleanup-and-register on GitHub.
[best-practice]: ed25519; private never committed (gitignore/GH secret); pub public + on GitHub; per-machine
revocable SSH; per-user GPG identity; minimal-scope tokens via device-flow/secret. [done — first instances]: Aaron
(SSH+GPG on aaron_bond@yahoo.com) + Addison (SSH+GPG on addisonstainback@gmail.com), per-machine, verified (#7261/
#7267). [build front]: the `maintainer-onboard` skill→blueprint (route to Aarav/skill-lifecycle + Max to test). No
code in this doc; it's the blueprint spec + the principle.

## Pointers

- First instances: #7261 (Aaron GPG) · #7267 (corrected SSH+GPG emails, per-machine) · #7249/#7250 (initial ssh
  trust) · #7254/#7259 (test-infra key + asymmetric trust). Bad-key cleanup: #7264/#7265.
- Trust/fork: trust model #7251 · git-native fork-aware trust #7260 · trust-roots-in-ISO #7253 · gh-auth surface
  #7263. Pattern: Addison's Blueprints (ACHIEVEMENTS) · skill-lifecycle blueprints (`.claude/skills/*/blueprints/`).
- Principle kin: go-to-the-developer / subsidiarity ([[go-to-the-developer-...]]) · the polite virus (#7255,
  secure+frictionless = the propagation + alignment guarantee) · friction-is-the-killer-of-time.
