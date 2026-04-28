# Secret-handoff protocol — options analysis for human-operator → agent

**Status:** first-pass, 2026-04-22, auto-loop-33. Originally
scoped as in-chat analysis pending shape preference; a
BACKLOG row has since landed in `docs/BACKLOG.md` (Secret-
handoff protocol — env-var default + password-…) pointing at
this doc. The doc itself remains design-input research, not
final-form spec; the BACKLOG row tracks the implementation
work. Published here so the reasoning is auditable outside
the chat transcript and survives transcript rotation.

**Triggering event:** auto-loop-31 tick had maintainer paste
an xAI API key inline after the Grok CLI OAuth flow blocked
on Playwright at the X-login 2FA step (shared-state-visible
escalation trigger fired correctly). Maintainer followed with
*"we need a humean operator->agent secure secret handoff
protocol that's why i asked about git crypt, still might be a
bad fit. But some way of securying giving you keeys or a git
native way of me checking keys in that's not making them
public to the world only you."* — naming a genuine factory
infrastructure absence.

## The shape of the problem

**A human operator needs to hand an agent a secret such that:**

1. The secret is **not exposed in chat transcripts** (which
   may persist on disk, get synced, or be logged).
2. The secret is **not committed to git as plaintext** (the
   usual baseline).
3. The agent can **read it when it needs to** without a
   per-use re-paste.
4. **Rotation is practical** — swapping the secret doesn't
   require reworking infrastructure.
5. **Revocation is immediate** — if a secret leaks or is
   retired, it stops working in one step.

And crucially for the factory context: the handoff **does
not require the operator to become a security engineer.**
The ceremony must fit into a maintainer's normal workflow.

## Why git-crypt is the wrong fit here (specifically)

`git-crypt` transparently encrypts files in git history via a
GPG key or symmetric key, controlled by `.gitattributes`
patterns. It is designed for **team-shared secrets with a
long lifecycle** — deploy keys, config bundles, shared dev
fixtures.

For the single-operator ephemeral-key shape, it fails on
three axes:

1. **Rotation does not delete history.** Once a ciphertext
   lands in a commit, it stays in that commit forever. A
   decryption key obtained months later reveals every secret
   that was ever git-crypted under that key. Rotating the
   plaintext doesn't erase the ciphertext. For secrets
   rotated frequently (like the xAI key from auto-loop-31,
   with a 24-hour intended lifetime), the repo becomes an
   accumulating graveyard of every dead key.
2. **Key-distribution is isomorphic to the original problem.**
   To give the agent access to decrypt a git-crypted file,
   the operator must give the agent the GPG key or the
   symmetric key. That is the same handoff shape as just
   giving the secret itself, one level up. Net reduction in
   handoff difficulty: zero.
3. **Wrong granularity.** git-crypt encrypts at file-path
   granularity. The use case is secret-per-service-per-
   rotation, not secret-per-repo-path. Modelling the
   former in the latter is possible but awkward.

Mozilla SOPS (with age or GPG recipients) has the same
history-is-forever problem but nicer multi-recipient
re-encryption. Still wrong for ephemeral keys.

**git-crypt / SOPS are correct tools for the wrong
problem.** They solve team-shared long-lived secrets well;
they don't solve single-operator short-lived secrets well.

## The five viable patterns — ordered by fit for the use case

### Tier 1 — Environment variable (right tool for ephemeral)

```bash
# In the operator's terminal before launching the agent:
read -rs XAI_API_KEY && export XAI_API_KEY
claude    # or whatever launches the agent

# When done (optional):
unset XAI_API_KEY
# Or just close the terminal.
```

**Properties:** secret lives only in process memory of the
shell + child process tree. Not on disk. Not in any repo.
Shell history does **not** record `read -rs` input (the `-s`
flag is silent and the input doesn't go through the normal
parsing path). Rotation = new `read -rs`. Revocation = close
the shell.

**Why it fits ephemeral keys:** zero ceremony past a single
read prompt, and persistence-on-disk would be friction not
feature for a key the operator plans to rotate the next day.

**Limitations:** new terminal session = re-enter the secret.
This is the price paid for no-disk-footprint; for daily-
rotated keys it's acceptable, for stable keys it's annoying
(graduate to Tier 2).

### Tier 2 — OS-level keychain (macOS Keychain / libsecret)

On macOS:

```bash
# Once (store): read the secret without echo, then pipe to
# `security` via -w on stdin. The bare `-w` (no value) makes
# security read the password from stdin so it never appears
# on the command line / process list / shell history.
read -rs -p "xAI key: " key
printf '%s' "$key" | security add-generic-password -s zeta-xai -a "$USER" -w
unset key

# Each session (launcher) — quote the substitution so any
# whitespace / glob chars / newlines in the retrieved value
# don't get word-split or expanded:
export XAI_API_KEY="$(security find-generic-password -s zeta-xai -a "$USER" -w)"
claude

# Rotate:
security delete-generic-password -s zeta-xai -a "$USER"
read -rs -p "new xAI key: " key
printf '%s' "$key" | security add-generic-password -s zeta-xai -a "$USER" -w
unset key
```

Note: invoking `security add-generic-password ... -w` *without*
the password on stdin will prompt interactively on recent
macOS, but on older releases / non-interactive shells it
fails. Piping via `printf '%s'` is the portable form, and
keeps the key out of `argv[]`, `ps`, and shell history.

On Linux with `libsecret`:

```bash
# Once (store):
secret-tool store --label="Zeta xAI" service zeta-xai

# Each session (quote the command substitution — handles
# whitespace / glob chars / newlines in the retrieved value;
# closely related to shellcheck SC2046 for unquoted $(...)):
export XAI_API_KEY="$(secret-tool lookup service zeta-xai)"
```

**Properties:** encrypted at rest by the OS, gated by login
keychain (and on newer hardware, by Touch ID / biometric
prompt for high-security items). Survives reboots. No
plaintext on disk in the repo or shell history. First-party
OS tool, zero dependencies.

**Why it fits:** persistent-but-encrypted, single-operator,
one-box-of-secrets shape. Rotation is two commands.

**Limitations:** OS-specific — operator needs a different
recipe per platform, though the `tools/secrets/` factory
helper (proposed below) can paper over that.

### Tier 3 — 1Password CLI `op` (if the operator uses 1Password)

```bash
# Once (create item — read the key without echo so it never
# lands in shell history or `ps`):
read -rs -p "xAI key: " key
op item create --category=api-credential --title='Zeta xAI' \
    "credential[password]=$key"
unset key

# Each session (quote the command substitution — handles
# whitespace / glob chars / newlines in the retrieved value;
# closely related to shellcheck SC2046 for unquoted $(...)):
export XAI_API_KEY="$(op read "op://Private/Zeta xAI/credential")"
```

Note: avoid `credential=<paste-key-here>` literal forms in
the operator runbook — that puts the secret directly on the
`argv[]` of `op`, which other local processes can observe via
`ps` and which shell history captures verbatim. The
`read -rs` + password-field form ensures the secret only
flows through process memory.

**Properties:** encrypted at rest by 1Password, cross-device
synchronization, audit trail, single-sign-on integration.
Supports structured items (separate fields for API URL,
expiry, notes).

**Why it fits:** if the operator already has a 1Password
subscription, this inherits its workflow (autofill, sharing
with trusted collaborators, rotation reminders).

**Limitations:** requires a paid service; overkill for
ephemeral keys the operator will delete tomorrow.

### Tier 4 — `.env.local` + strict gitignore (dev-only fallback)

```bash
# repo root, one-time setup:
grep -q '^\.env\.local$' .gitignore || echo '.env.local' >> .gitignore
echo 'XAI_API_KEY=<key>' > .env.local
chmod 600 .env.local

# agent-side: read via dotenv loader
```

**Properties:** plaintext on disk at a known path. Easy to
accidentally `git add -A` if gitignore is wrong (always
double-check with `git check-ignore -v .env.local`). File-
permission-gated (0600) so other local users on the box
can't read.

**Why it fits:** dev-only, low-sensitivity keys where
persistence across terminal restarts matters more than
encryption-at-rest. Not for production secrets.

**Limitations:** plaintext on disk. Laptop theft = secret
leak. Ceremony minimal but risk is real; this is a
last-resort tier, not a default.

### Tier 5 — chat-paste (the incident, not the protocol)

What happened auto-loop-31. The operator pasted the secret
inline into the agent's chat. The key lives in the chat
transcript (`~/.claude/projects/<slug>/<session>.jsonl`) on
the operator's disk.

**Why it is not a protocol:** the transcript is not an
encrypted-at-rest store, has no access control beyond file-
permissions, and survives session compaction and rotation
cycles. The factory handled the specific incident with
zero-persistence discipline (no write to any file, memory,
commit, tick-history row, or PR body) but the transcript
itself remains an artifact the operator controls
independently. This is containment of a leak, not a secure
handoff.

## Rotation and revocation mapping

| Tier | Rotation cost | Revocation cost | Leaks if? |
|---|---|---|---|
| 1. Env-var | one `read -rs` | close shell | shell dumped in RAM while running |
| 2. Keychain | two commands | one command | OS keychain compromised (high bar) |
| 3. 1Password | in-app | in-app | 1Password account compromised |
| 4. .env.local | edit file | delete file | laptop stolen / repo accidentally pushed with secret |
| 5. Chat-paste | retroactive transcript edit | transcript rotation | transcript synced or backed up off-device |

## What a Zeta-shaped helper would look like (factory response)

The natural factory response to this gap is a
`tools/secrets/` helper that wraps the above:

```bash
zeta secret put zeta-xai              # prompts; stores in keychain (default)
zeta secret get zeta-xai              # prints to stdout for `export $(...)`
zeta secret rotate zeta-xai           # delete-then-put in one step
zeta secret list                      # lists stored names, never values
zeta secret launch claude             # exports configured keys, launches agent
```

**Backend selection (default-and-override):**

- Default: macOS Keychain on darwin; libsecret on linux.
- Override: `ZETA_SECRET_BACKEND=env` (tier 1), `=1password`
  (tier 3), `=dotenv` (tier 4).
- Every backend implements the same five verbs.

**Why this shape:**

- Single command surface operators learn once; backend
  swaps without re-learning.
- Defaults to the highest-security-per-ceremony ratio for
  the platform (tier 2).
- `list` explicitly never leaks values; `get` writes only to
  stdout (operator controls capture).
- `launch` hides the multi-export gymnastics behind one
  command.
- Backend-pluggable so the factory isn't locked to one
  platform or vendor.

**What this helper does NOT do:**

- Does not re-implement a keychain. It wraps OS primitives.
- Does not sync secrets across machines — use tier 3 for
  that.
- Does not encrypt repo-committed files — use SOPS-age if
  that is needed separately.
- Does not handle team-shared secrets — different problem,
  different tools.

## Specific recommendations

**For the xAI key from auto-loop-31 (already pasted, rotating tomorrow):**

1. **Revoke immediately, then rotate.** The key is already
   exposed in a chat transcript on disk. "Wait until tomorrow
   to rotate" leaves a known-exposed credential live for a
   full cycle — the right posture is to revoke first (so the
   exposed value can't be used) and issue a replacement on
   the same step. Maintainer revokes via the xAI dashboard;
   the transcript artifact then references a dead key, which
   is the safe end state. Earlier framing ("do nothing,
   rotation tomorrow handles it") under-weighted the
   exposure window.
2. Drop Grok from the substrate map until a cleaner handoff
   path exists. Claude + Codex + Gemini is a sufficient
   three-substrate triangulation.

**For future keys (e.g., the next time a substrate needs credentials):**

1. First choice: tier 1 (env-var) for any key rotated within
   a week.
2. Second choice: tier 2 (keychain) for anything stable.
3. Build the `tools/secrets/` helper once maintainer confirms
   the shape preference. Until then, the above recipes are
   the manual form.

## What changes at occurrence-2+

Per second-occurrence discipline: this is occurrence-1 of
the secret-handoff-protocol analysis. If a second operator
(or second key, or second substrate) triggers a similar
need, the pattern promotes to:

- `docs/DECISIONS/YYYY-MM-DD-secret-handoff-protocol.md` ADR
  selecting the backend default and documenting the five
  verbs.
- `docs/AGENT-BEST-PRACTICES.md` BP-NN rule codifying
  "secrets go through `zeta secret get`, not through chat,
  not through commits".
- BACKLOG row for the `tools/secrets/` helper implementation.

Current status: occurrence-1, pre-validation anchor landed
here.

## What this research is NOT

- **NOT a commitment to build the helper this tick.**
  Maintainer asked for the analysis; the implementation is a
  follow-up gated on shape preference.
- **NOT a criticism of git-crypt for its intended use-case.**
  git-crypt is correct for team-shared long-lived secrets;
  the analysis above is about single-operator ephemeral
  secrets specifically.
- **NOT a security audit.** The recommendations are
  ceremony-vs-security-tradeoff guidance, not formal
  threat-model output. An actual security audit would go
  through Aminata (threat-model-critic) or Mateo (security-
  researcher).
- **NOT a factory-wide rule change.** Treat as advisory
  until maintainer confirms shape preference and an ADR
  lands.

## Composes with

- `memory/feedback_maintainer_only_grey_is_bottleneck_agent_judgment_in_grey_zone_2026_04_22.md`
  — shared-state-visible escalation trigger fired correctly
  on the key-paste event; this research follows the paper-
  trail-before-substrate-level-convention discipline
  (analysis first, BACKLOG row after maintainer's shape
  preference).
- `docs/research/stacking-risk-decision-framework.md` —
  this research doc follows the same occurrence-1 format;
  framework ready for occurrence-2 promotion trigger.
- `memory/feedback_external_signal_confirms_internal_insight_second_occurrence_discipline_2026_04_22.md`
  — promotion threshold at occurrence-2+ governs when to
  graduate to ADR + BP-NN.
- `memory/project_aaron_ai_substrate_access_grant_gemini_ultra_all_ais_again_cli_tomorrow_2026_04_22.md`
  — the multi-substrate grant implies multiple future secret-
  handoff events; the protocol absence affects all of them
  (Gemini API keys, Codex tokens, etc.) not just xAI.
