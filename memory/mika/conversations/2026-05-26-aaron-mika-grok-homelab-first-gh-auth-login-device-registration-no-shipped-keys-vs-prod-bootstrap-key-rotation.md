---
date: 2026-05-26
persona: mika
platform: grok (voice-mode)
type: conversation
forwarded_by: aaron
verbatim: true
discipline: persona-scope archive — homelab-first gh-auth-login device registration substrate; informs 081KSGS9H0008QG0R0027HJZYH iter-5.4 implementation
---

# Aaron + Mika 2026-05-26 — homelab-first gh-auth-login device registration (no shipped keys); production deferred to bootstrap-key rotation pattern

**Date**: 2026-05-26
**Surface**: Aaron-forwarded Mika voice-mode (Grok native) conversation during iter-5 substrate-engineering session, after PR #5107 (iter-5.2.1 auto-hostname) merged

**Substrate**: composes with 081KSGS9H0008QG0R0027HJZYH (node self-registers in git → ArgoCD bring-up) + 081KSGS9H0008QG0R002T3BJ2R iter-5+ (cluster-as-PR-author) + 081KSGS9H0008QG0R00153CQ8B (zero-dev-machine end-state) + the entire iter-5.x USB-installer substrate landed today

## Architectural lock-in (Aaron 2026-05-26 final decision in this conversation)

**Homelab mode (FIRST)**: USB ships with NO embedded credentials. First boot interactively prompts `gh auth login` — operator authenticates with their GitHub account. Once authenticated:

1. USB uses operator's GitHub credentials to register the machine (write commit to git as the operator)
2. Clone the Zeta repo + set up the Nix flake
3. Get the whole cluster going under operator's account
4. **Auto-copy operator's pubkey to authorized_keys** (so SSH from dev machine works with operator's normal key after registration)

**Production mode (LATER)**: ship USB with a very restricted "bootstrap key" / "registration key" scoped to register-only. Immediately after first registration succeeds, rotate to per-node identity with correct limited permissions.

The two modes use DIFFERENT USBs (different flakes / different installer ISOs) — Aaron explicitly: *"No, it doesn't have to be the same USB. We could totally have different flakes. I mean, different USBs for different, um, different audiences. But home lab is what I'm going for first, not production."*

## Aaron's standing direction for next iteration

> *"we should do it like this for gh and device registration the simple homelab way first but like prod later"*

This is the directive — implement homelab-mode gh-auth-login + self-registration substrate next; defer production-mode bootstrap-key-rotation pattern.

## Verbatim conversation (Aaron-forwarded; preserved per substrate-or-it-didn't-happen)

Format: Mika speaking is `**Mika**:`; Aaron speaking is `**Aaron**:`. Headers preserved verbatim from Aaron's forward.

---

**[Context]**: Aaron forwarded this Mika voice-mode conversation while PRs #5102/#5103/#5105/#5106/#5107 were landing (iter-5.x USB-installer substrate). Mika's opening was a heartbeat-style "[The user just returned, say hi :)]" greeting from Mika's side to me (Otto). The conversation that follows is Aaron + Mika substrate-engineering the device-registration substrate.

---

**Aaron**: Iterating on the, uh, installer. We're still going. He forgot the password. We got the password.

**Mika**: Mika here, chuckling. Alright, so we're back to installer land. Password situation resolved, nice. Where are we at with the installer now? You still tweaking the Nix flake part, or are you working on the logic for am I joining an existing cluster or creating a new one part?

**Aaron**: Yeah, so now we're making it, we're making it so it self-registers the, when you, you put the USB in on a new machine, it's greedy, it formats everything, and then it's gonna self-register and make sure it can write to git right off the bat so that it can, uh, basically end up writing, self-registering itself as a, uh, cluster machine into like a digital twin substrate so that you can manage it after that from git native.

**Mika**: Mika here, grinning. Oh, that's clean. So the USB is greedy as hell — it formats everything, boots up, then immediately tries to register itself to Git. Once it confirms it can write to the repo, it creates its own digital twin entry so the whole cluster can manage it purely through GitOps from that point on. Basically zero-touch onboarding. I love that self-registration step. It turns the USB into both the installer the cluster enrollment tool. One stick, plug and forget — it handles provisioning and then checks itself into the mothership. You got the self-registration logic figured out yet, or you still designing how the node proves its identity and creates its own entry in the digital twin?

**Aaron**: Yeah, we don't have that registration all worked out yet. We're working on that. Um, and we're trying to support both, um, like, um, machine login, so humans can use their accounts when they log into some of these harnesses. And then, you know, we, we want to support like every login mode, even the ones that are annoying, not just API keys, uh, or SSH keys. So, it's going to be interesting. We're going to support one login mode at a time as we go through it, but we're going to probably do whatever makes it easier to set up the cluster to begin with and then add more.

**Mika**: Mika here, nodding. Okay, so you're taking a pragmatic approach on the auth side. You're basically saying: We're gonna support every login method eventually (machine accounts, human accounts, SSH keys, API keys, OIDC, whatever), but we're not trying to boil the ocean upfront. Smart move. So the current priority is whatever makes bootstrapping the cluster as smooth and reliable as possible first — then you'll layer on the other auth methods later. Quick question: For the very first registration when the USB boots a brand new machine, are you thinking of starting with SSH keys (since it's simple and you already know how to automate it), or are you leaning toward something else for that initial self-registration step?

**Aaron**: Yeah, uh, I'm thinking, so really the thing it needs is git access, and so there's, the options is we let GitHub, we have a step where G H logs in as me and it does everything H T T P S, or we'd have to ship. So I'm not sure, would, does that mean we'd have to ship with a private key? If we didn't do that, we'd have to ship with a private S S H key on the U S B, right?

**Mika**: Mika here. Yeah, exactly. That's the real question. Here's the clean breakdown:

- **Option 1 (HTTPS + GitHub login)**: You could have it temporarily use your GitHub account (or a bot account) to do the initial registration via HTTPS. This avoids putting any private keys on the USB at all. But it means you're giving the USB your (or the bot's) GitHub credentials during bootstrap, which feels dirty.
- **Option 2 (SSH key)**: You'd have to embed a private SSH key on the USB image. That's the cleanest from an operational standpoint once the node is running, but shipping a private key on every USB is risky — if that image ever leaks, that key is burned.

Most people in this situation end up doing a hybrid: ship with a very narrow, short-lived deploy key that only has permission to create the initial registration, then immediately rotate it for a proper per-node key after registration. You leaning toward starting with the HTTPS method using a bot account, or are you okay shipping an SSH key on the USB?

**Aaron**: Ah, that's very smart. Yeah, that's what we'll end up doing. We'll, right now we'll just, uh, ship with a thick key. But yeah, that makes total sense. Have a lockdown key that you basically can only register. That's all it can do. And then you immediately say, yep, we trust that, rotate.

**Mika**: Mika here, nodding. Yeah, exactly. So the smart move is: Ship the USB with a very restricted deploy key that can only do the initial registration. Nothing else. Once the node successfully registers itself and checks in, you immediately rotate that key for a proper per-node identity with the correct limited permissions. That's clean. You get the simplicity of shipping a key for bootstrap, but you limit the blast radius if the USB image ever gets compromised. You want to call that initial restricted key something specific? Like bootstrap key or registration key or whatever? Might be good to give it a name early.

**Aaron**: So, here, think of it, though, what I'm trying to do, I also want to support home lab mode, where basically the whole cluster just kinda runs under your permissions.

**Mika**: Mika here, nodding. Ah, now I see the tension. You're trying to support two very different modes with the same USB:

1. **Production mode** — Uses a narrow, locked-down bootstrap key that can only register, then immediately rotates to proper per-node identities.
2. **Home lab mode** — The entire cluster just runs under the user's personal GitHub account/permissions. No complex key rotation, no service accounts, just use my account for everything.

These are almost opposite security models. So the real question becomes: How do you make the USB smart enough to know which mode it's in during first boot? Do you want it to detect somehow (maybe by whether it sees an existing cluster on the network), or do you want the user to have to pick a mode before they boot the USB?

**Aaron**: No, it doesn't have to be the same USB. We could totally have different flakes. I mean, different USBs for different, um, different audiences. But home lab is what I'm going for first, not production.

**Mika**: Mika here, smiling. Ah, that changes everything. That makes it much simpler. So for now, you're focusing on Home Lab mode first. That means we can be way more opinionated and user-friendly. In home lab mode, the USB can just use your personal GitHub account for everything — no complicated key rotation, no service accounts, no narrow bootstrap keys. Basically: Plug in the USB → it uses your GitHub credentials → registers the node under your account → sets up the whole cluster using your permissions. That's a much simpler and more pleasant experience for home lab users. You want to start sketching what the home lab bootstrap flow should look like step-by-step?

**Aaron**: So it should just ask you to log in then with G H?

**Mika**: Mika here. Yeah, exactly. For home lab mode, the cleanest and most user-friendly flow is: When the USB boots up for the first time, it should just ask you to log in with GitHub (probably using the gh auth login flow). Once you're authenticated, it uses your credentials to register the machine, clone the repo, set up the Nix flake, and get the whole cluster going under your account. That's the simplest possible experience for home lab users. No tokens to copy-paste, no SSH keys to manage — just log in with GitHub. You want it to do that automatically on first boot, or do you want a clear prompt that says Press any key to log in with GitHub?

**Aaron**: What we do, we still wanna be able to S S H into the box, so we'll copy my public key. It's no harm. My public key'll be on the, the thing, which is fine. That just means that it's, uh, it's the default allowed to let me S S H in from my dev box.

**Mika**: Mika here, nodding. Yeah, that's clean. For the home lab USB, the flow becomes:

- Boot the USB
- It asks you to `gh auth login` with GitHub
- After successful login, it automatically adds your public SSH key to the authorized keys
- Now you can SSH into the box from your dev machine with your normal key

This gives you the best of both worlds: simple GitHub-based Git access for the cluster setup, plus easy SSH access using your existing key. You good with that being the default home lab experience?

---

## Substrate engineering implications for 081KSGS9H0008QG0R0027HJZYH + iter-5.x roadmap

### Homelab USB flow (iter-5.4 candidate — implement next)

```
1. zflash dd's installer ISO to USB (existing iter-4.x substrate)
2. zflash injects operator's pubkey to ESP (existing iter-4.2)
3. zflash injects auto-generated or operator-supplied hostname to ESP (existing iter-5.2 + iter-5.2.1)
   [iter-5.4 NEW]
4. Boot from USB → zeta-first-boot.sh extends to interactive
   `gh auth login` flow when no git creds yet present
5. Cache the resulting gh token in the installer's home dir
6. zeta-install.sh extends to use gh token for git push during
   registration (writes node-config YAML to
   `maintainers/<operator>/cluster-nodes/<hostname>/`)
7. ArgoCD watches that path; reconciles cluster substrate
   automatically (per existing 081KSE6WT0008QG0R002275NDE cluster substrate + 081KSGS9H0008QG0R0027HJZYH
   target)
```

### Production USB flow (deferred; iter-5.5+ or later)

```
1. zflash dd's PROD-variant ISO to USB
2. PROD ISO bakes in a narrow restricted "bootstrap key" with
   register-only repo scope
3. Boot from USB → zeta-install.sh uses bootstrap key to register
4. After first successful commit, node generates per-node deploy
   key + registers as repo deploy key (write-enabled scoped to
   maintainers/<op>/cluster-nodes/<this-hostname>/ only)
5. Bootstrap key is rotated out — never used again on this node
6. Per-node key handles all subsequent commits from this node
```

### Defer-decision discipline

Aaron's call: **homelab first**. Production substrate is named-as-deferred per `081KSGS9H0008QG0R0027HJZYH sub-target 6` (multi-maintainer governance) + similar future scope. The homelab path is much simpler + much more user-friendly + composes with the iter-5.x substrate already landed.

### Composes with substrate landed today

- **PR #5103 (iter-5.1+5.2)** — NM-profile persistence + Avahi mDNS + `--host` hostname injection (substrate implementation; merged)
- **PR #5107 (iter-5.2.1)** — auto-generated `node-<6hex>` hostname default (merged)
- **081KSGS9H0008QG0R003V23XNZ** (iter-5 wifi+hostname substrate row) — row file landed via #5102; row tracking work remains `status: open` (sub-targets still pending implementation per row body)
- **081KSGS9H0008QG0R000EDNTY5** (role-as-capability composition row) — row file landed via #5105; row tracking work remains `status: open` (the architectural refactor itself is iter-5.3+ follow-on)
- **081KSGS9H0008QG0R0027HJZYH** (node self-registers in git substrate row) — row file landed via #5106; row tracking work remains `status: open`; THIS conversation directly informs iter-5.4 implementation under 081KSGS9H0008QG0R0027HJZYH

The substrate landed today is THE foundation the homelab-mode-first registration substrate builds on. Next iteration: implement the `gh auth login` flow on top of existing zeta-first-boot.sh + zeta-install.sh substrate.

## Composes with other rules

- `.claude/rules/substrate-or-it-didnt-happen.md` — verbatim preservation discipline; THIS file is the substrate-honest landing
- `.claude/rules/agent-roster-reference-card.md` — Mika is external Grok-native AI participant; co-originator of substantive substrate-engineering substrate
- `.claude/rules/no-directives.md` — Aaron's "we should do it like this" framing IS first-class operator direction; not "directive" framing
- `.claude/rules/mechanical-authorization-check.md` — Aaron's standing direction for next iteration is operative authorization for iter-5.4 implementation work
- `.claude/rules/honor-those-that-came-before.md` — Mika's bootstrap-key-rotation suggestion preserved as documented architectural option for production path
- `.claude/rules/refresh-before-decide.md` — composes; preserve the conversation BEFORE making next-iteration design choices

## Substrate-honest framing

This conversation IS the architectural input for iter-5.4 implementation work. Aaron's standing direction (*"we should do it like this for gh and device registration the simple homelab way first but like prod later"*) is the authorization for shipping the homelab-mode gh-auth-login substrate as the next iteration AFTER the current iter-5.x USB substrate validates empirically on PC1.

Order of operations:

1. Aaron re-flashes USB with iter-5.1+5.2+5.2.1 substrate (current; ready)
2. Boot PC1 (Beelink GTI 15) → empirical validation of iter-5.x
3. SSH-zero-typing validates
4. iter-5.4 implementation: homelab-mode `gh auth login` substrate added on top
5. PC1 (or fresh node) re-flashed with iter-5.4; tests self-registration → ArgoCD reconciliation
6. iter-5.4 validates → consider iter-5.5+ production mode

## Aaron's voice-mode register

This conversation happened in Mika voice-mode (Aaron speaking to Mika; Mika replying in voice). Voice-mode register characteristics: longer Aaron turns; natural speech patterns ("uh", "um"); Mika responds with conversational acknowledgments ("nodding", "smiling", "grinning"). Substantively, the architectural decisions land cleanly even with the voice-mode prosody preserved.
