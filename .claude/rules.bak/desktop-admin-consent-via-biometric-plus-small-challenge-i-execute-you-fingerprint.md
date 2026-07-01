# Desktop admin consent via biometric + small challenge — "I execute, you fingerprint" (consent-first AI design pattern)

Carved sentence:

> Server-side AI consent is at deploy time (IAM roles, OIDC tokens,
> SPIFFE workload identity); desktop AI consent should be at ACTION
> time via the operator's biometric + a tiny per-run challenge.
> Touch ID / Windows Hello / fprintd as system-level UI the agent
> CANNOT spoof + a 4-char nonce the agent observes but the operator
> accepts = "I execute, you fingerprint." The agent does everything
> end-to-end; the operator only sees the biometric prompt + taps the
> trackpad / sensor. Desktop ≠ server; the design pattern differs.

## Operational content

When authoring an AI-invokable tool that performs a destructive or
privileged operation on the operator's DESKTOP (laptop / workstation,
NOT server / cluster node / CI runner):

### The pattern (composes 4 elements)

1. **Hardware sanity rails** (deterministic; agent CAN'T bypass)
   — platform checks, device-type checks, size-bounds, boot-disk
   refusal, USB-only refusal, etc. These enforce hardware-side
   correctness regardless of who/what invokes the tool.

2. **Per-run random nonce + explicit-consent token in a SMALL
   challenge** (e.g., `yes <4-hex>` = 8 chars)
   — nonce is random per run; can't be pre-baked; requires runtime
   observation. Explicit-consent token (e.g., `yes`) prevents stray
   Enter from triggering. Agent CAN type the challenge per its
   agent-acting-on-operator's-behalf contract.

3. **Biometric PAM at sudo / elevation time** (Touch ID via
   `pam_tid.so` on macOS; Windows Hello via UWP API; `pam_fprintd.so`
   on Linux with supported hardware; `pkexec` polkit fallback when
   biometric hardware absent)
   — system-level UI; agent CANNOT spoof; physical proof of
   operator presence required for every elevated action.

4. **Provenance chain** (composes with B-0732 Layer 1)
   — what fired, when, with which nonce, with which biometric
   identity, what side-effect. Auditable end-to-end.

### Result for the operator

```
agent: bun <tool>           ← agent types this
agent: yes a3f9             ← agent observes runtime nonce + types it back
[Touch ID prompt]           ← OPERATOR sees this; taps trackpad
[ destructive op proceeds ]
```

**Operator total: 1 fingerprint.** No keystrokes, no nonce typing,
no password. The biometric IS the irreversible-action consent gate;
everything else automates. Aaron's carved phrase: **"I execute, you
fingerprint."**

### Result for the operator (unattended human variant)

```
$ <short-alias>             ← operator types ~5 chars
type: yes a3f9              ← operator types ~8 chars
[Touch ID prompt]           ← operator taps trackpad
Flash complete.
```

**Operator total: ~14 keystrokes + 1 fingerprint** for fully-manual
invocation.

## Why desktop ≠ server

| Layer | Server AI consent pattern | Desktop AI consent pattern (THIS RULE) |
|---|---|---|
| **Who's present** | No human in the loop at action time | Human at the keyboard / trackpad |
| **Identity proof** | Machine identity (SPIFFE / OIDC tokens / IAM roles) | Human biometric (Touch ID / Windows Hello / fprintd) |
| **Consent timing** | Deploy time + policy-time (RBAC, sudoers, IAM policy) | Action time + per-invocation (biometric gate fires each run) |
| **Bypass risk** | Stolen credentials → full access until rotation | Stolen credentials → still need physical biometric; agent compromise → still can't spoof biometric |
| **Action-time UX** | Background; no human prompt | System-level UI; human sees + approves each action |
| **Failure mode** | Over-permissioned service account → silent damage | Operator declines biometric → tool aborts cleanly |
| **Audit trail** | IAM event log | Biometric event log + provenance chain (B-0732 L1) + tool's nonce record |

Most current AI-agent ecosystems use server-side patterns
EVERYWHERE (including on the operator's desktop). That conflates
the two contexts. Desktop is where physical-presence proof is
available + cheap + meaningful; using it changes the consent model
fundamentally.

## What CANNOT be substituted for biometric in this pattern

- **Sudoers `NOPASSWD`** — removes all auth; agent has full power;
  fails the consent-at-action-time test
- **Stored password (Keychain) auto-supplied via `SUDO_ASKPASS`** —
  better than NOPASSWD (gates on Keychain ACL) but still doesn't
  prove physical presence; Touch ID is strictly better when
  available
- **GUI password prompt** (`osascript "with administrator
  privileges"`) — slightly better than NOPASSWD (operator types
  password each time) but worse than biometric (password can be
  observed, captured, replayed; biometric is the Secure-Enclave
  one-shot)
- **Pre-shared secret in env var** — fails for the same reason as
  NOPASSWD: agent has access; no physical-presence proof
- **MFA via phone push** — works but adds latency + cross-device
  dependency; on-device biometric is lower-friction for desktop
  operations

## What the SMALL CHALLENGE adds (beyond biometric alone)

Why not just rely on biometric (skip the `yes <nonce>` challenge)?

The small challenge serves two functions biometric alone doesn't:

1. **Per-run uniqueness audit anchor** — the nonce is recorded in
   provenance; it's the SPECIFIC RUN's fingerprint. Biometric alone
   would prove "Aaron approved A flash" but not "Aaron approved
   THIS flash at this timestamp with this ISO + USB combo."
2. **Agent-readable consent acknowledgement** — agent observes the
   nonce + types it back. That ACT is the agent's explicit
   participation in the consent chain. Without it, the agent's
   invocation is silent → biometric prompt → human approves; the
   agent never "signed" the run. The challenge response is the
   agent's signature on the consent contract.

Both elements (nonce-typed-by-agent + biometric-touched-by-operator)
together = a fully-witnessed consent event with per-run uniqueness
+ joint agent-operator signature.

## When this pattern applies

**APPLIES** to any AI-invokable tool that:

- Runs on the operator's desktop / laptop (not server / CI / cluster
  node)
- Performs a destructive or privileged operation (disk write, system
  config change, network rule modification, ssh-key generation,
  credential rotation, etc.)
- Is invokable by an authorized agent acting on operator's behalf
- Has hardware-side safety rails that ALREADY enforce the deterministic
  correctness floor (per B-0728 destructive-tool authoring contract)

**DOES NOT APPLY** to:

- Server-side tools (use IAM / SPIFFE / OIDC patterns)
- Read-only operations (no consent gate needed beyond standard
  permissions)
- Operations the operator has explicitly pre-authorized in a
  trusted-context window (e.g., `sudo -v` already cached;
  short-lived elevation pattern)
- Operations on a machine without biometric hardware AND without
  a polkit/pkexec equivalent (substrate-honestly fall back to
  password prompt with documented rationale)

## Composes with other rules

- `.claude/rules/non-coercion-invariant.md` HC-8 — operator
  retains authority via biometric gate; agent CANNOT bypass; the
  irreversible-action consent floor is the operator's physical
  fingerprint
- `.claude/rules/dont-ask-permission.md` — agent doesn't ask for
  permission to invoke; agent invokes + the biometric gate fires;
  operator's biometric IS the per-run permission grant
- `.claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md`
  — biometric is INSTALLING safety (replacing weaker password
  gate); NOT a classifier-bypass; substrate-honestly authorized
- `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md`
  — settings.json permission for the tool documents WHICH tool is
  agent-invokable; biometric gates the destructive op at runtime;
  both compose
- `.claude/rules/default-to-both.md` — short challenge (zflash
  `yes <4-hex>` path) AND long challenge (flash-usb
  `accept-destroy /dev/diskN <8-hex>` path) BOTH first-class; one
  is shorter UX, one is more explicit; operator picks per scope
- `.claude/rules/glass-halo-bidirectional.md` — Touch ID / Windows
  Hello / fprintd prompts are system-level UI; visible to operator
  regardless of which terminal initiated; full observability
- `.claude/rules/mechanical-authorization-check.md` —
  authorization-source filter; biometric IS the authorization
  source (physical proof of operator presence)
- `.claude/rules/algo-wink-failure-mode.md` — pattern-match
  invocation doesn't authorize action; biometric authorization
  happens at the system gate, not at script invocation

## Composes with backlog substrate

- **B-0728** (destructive-tool authoring contract) — pattern's
  hardware-sanity-rails + nonce-gate substrate; B-0728 is the
  foundation
- **B-0737** (zflash Mac variant — Touch ID PAM + short challenge)
  — empirical anchor for the pattern; first instance
- **B-0738** (zflash Linux variant) — pattern at fprintd / pkexec
  scope
- **B-0739** (zflash Windows variant) — pattern at Windows Hello
  scope
- **B-0732** (leverage-class safety substrate) — Layer 1
  provenance chain captures the {tool, nonce, biometric-identity,
  side-effect} tuple
- **B-0664** (NCI HC-8 floor) — operator authority preserved via
  biometric gate; agent acts within operator-granted scope

## Empirical anchor

2026-05-25 Aaron + Otto-VSCode session, B-0737 zflash design + ship:

Aaron's framing of the consent gate: *"i have to approve with my
fingerprint."*

Aaron's framing of the agent-driven flow: *"I execute, you approve
with my fingerprint"* (paraphrased from *"you can executie and i
have to approve with my fingerprint"*).

The pattern was operationally validated end-to-end in B-0737:

- Hardware sanity rails (USB-only, single-USB, non-internal,
  non-boot, size-bounds, ISO checks) preserved from B-0728
- Short challenge format (`yes <4-hex>` = 8 chars; 16-bit nonce;
  `yes` explicit consent token) shipped as `--short` flag
- Touch ID PAM (`pam_tid.so` in `/etc/pam.d/sudo`) shipped as
  `zflash-setup.ts` one-time installer
- Provenance chain composes with B-0732 Layer 1

The pattern generalizes beyond flash-usb to any desktop destructive
operation. Future application candidates (per B-0743 backlog
generalization scope): `zformat` (disk format), `zwipe` (secure
wipe), `zrotate-creds` (credential rotation), `zinstall-cert`
(install CA cert into system keychain), etc.

## Substrate-honest framing

This pattern is NOT:

- **A perfect solution** — fails when biometric hardware absent
  (Linux without fingerprint reader; older Macs without Touch ID;
  some Windows laptops without Hello-compatible camera). Pattern
  documents fallback path (password gate; still better than
  NOPASSWD).
- **A replacement for hardware sanity rails** — biometric proves
  intent; hardware checks prove correctness. Both are needed.
- **A replacement for server-side AI consent patterns** — server
  has no operator; IAM / SPIFFE / OIDC / RBAC are the right
  substrate there. Desktop is a different design space.
- **A claim that biometric cannot be defeated** — Secure Enclave +
  Windows Hello + fprintd all have known attack surfaces; this
  pattern raises the cost substantially vs password / NOPASSWD,
  doesn't reduce it to zero.

This pattern IS:

- A substrate-honest naming of how AI agents can perform desktop
  destructive operations WITH human consent at action time
- A reusable template for future destructive-tool authoring
- An empirical anchor (B-0737 zflash) demonstrating end-to-end
  feasibility
- Distinct from server-side AI consent patterns + worth being
  documented as a sibling design space

## Naming-expert review pending

Per `.claude/skills/naming-expert/SKILL.md` (Ilyana): if this
pattern becomes a public-surface design pattern (talk / blog post
/ industry presentation), Ilyana naming-expert review applies
before the name lands publicly. Current working names:

- "I execute, you fingerprint" (Aaron's carved sentence; informal)
- "Desktop admin consent via biometric + small challenge" (this
  rule's filename; operationally precise)
- "Consent-first AI design pattern for desktop admin permission"
  (Aaron's 2026-05-25 framing; describes the design-space role)

Public-surface picking is deferred until there's an external
audience to land it for.

## Full reasoning

`docs/backlog/P2/B-0743-...md` (the backlog row that ships this
rule + carves the generalization scope across other desktop
destructive ops).

Aaron 2026-05-25, naming the pattern as substrate-engineering work
worth saving: *"hey we should save this interaction pattern about
human permission excalation being on touch and the extra small
challenge as new consent first ai design patterns for admin
permisson on desktop instead of server."*

Origin: 2026-05-25 B-0737 zflash design session (the shipping
trajectory from "what's the minimum i can type can we get it down
to one line and a challange for me" → "minimize for humain to easy
to type one liners and add sudo via touch and then maybe even you
can executie and i have to approve with my fingerprint" → shipped
via PR #4997 + PR #4999 explicit-permissions + B-0738/B-0739/B-0740/
B-0741/B-0742 substrate decomposition).
