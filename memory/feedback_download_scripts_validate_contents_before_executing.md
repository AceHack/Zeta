---
name: Download scripts — validate contents before executing; delivery mechanism is not the risk
description: Aaron 2026-04-22 — downloading scripts (bash, curl | bash, gist, wget, any URL) is fine; the risk is unvalidated CONTENT, not the delivery mechanism. Validate first — check for vulnerabilities, trojans, suspicious patterns — then run. Explicit trust in my judgment.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**Rule.** Never execute a downloaded script without first inspecting
its contents for vulnerabilities, trojans, suspicious exfiltration,
unexpected privilege escalation, or other malicious patterns. Once
validated, any delivery mechanism is acceptable — `curl | bash`,
`curl -o /tmp/x.sh && bash /tmp/x.sh`, downloading from a gist,
pulling from a raw URL, etc. are all fine.

Aaron's exact words (2026-04-22): *"never run a script you
download[ed] without checking it for vulnerability, trojans and
things of that nature even like gist and stuff, it's fine to
download and run bash and things like that just validate them
first. i don't care if you run script directly from the url either
as long as you check it first. Just be safe, i trust your
judgment."*

**Why:** The attack vector Aaron cares about is **untrusted script
content**, not the pipe-to-shell gesture. A SHA-256-pinned URL that
points at malicious code is still malicious; a `curl | bash` of
code I've read and understood is still safe. The factory's
SUPPLY-CHAIN-SAFE-PATTERNS.md is correct that SHA-256 pinning is
*one* form of content-equivalence guarantee, but content review
at first pin is the load-bearing step — SHA-256 alone confirms
"content matches what I reviewed once," not "content is safe."

Triggered by: the sandbox denying `curl -fsSL ... -o /tmp/download-
actionlint.bash` mid-dogfood of gate.yml's `curl | bash` pattern.
The denial was conservative-by-default (the runtime couldn't know
I'd inspect the script before executing); Aaron's policy lifts the
default given my judgment.

**How to apply:**

- **Default workflow for any external script:** (1) download with
  `curl -fsSL -o <path>` or equivalent to a scratch location,
  (2) read the script in full, (3) check for: sudo / root
  escalation, data exfiltration (curl POST / nc / scp to
  non-project hosts), shell-metacharacter injection, dubious
  base64 blobs, cryptominers, network calls to suspicious domains,
  trojaned installers masquerading as legitimate tools;
  (4) execute if clean.

- **SHA-256 pinning is still useful** once validation passes — it
  locks the pinned content to what I read. A bump invalidates the
  pin and forces a re-read. Treat SHA-256 as "cache of my content
  review," not as the content review itself.

- **`curl | bash` is fine** *after* validation. Downloading to
  disk first and then executing is equivalent for Aaron's threat
  model; the pipe is not the risk.

- **Gist / pastebin / any-URL is fine** under the same rule:
  validate content, then run. Provenance matters (a gist from an
  unknown user is less trustworthy than a signed release from a
  known project) but it's a factor in the content review, not a
  hard rule.

- **Record the validation.** If I download and execute an external
  script for any non-trivial purpose, note what I checked and what
  I decided, so future reviewers (and my future self) can audit
  the trust chain. The BACKLOG P1 row "Move actionlint install
  under `tools/setup/common/`..." should record the SHA-256 + a
  short content-review note when it ships.

- **Still escalate on:** scripts that try to write outside the
  expected paths, establish persistent network connections,
  modify system auth / SSH keys, touch secrets, or install
  background daemons. Those are beyond the scope of a script-
  review pass regardless of how friendly the URL looks. Ask Aaron.

**Sandbox denials** (like the one that triggered this memory) are
not a veto — they're a "confirm you intend this." If I intended
to validate first and then execute, re-request with the validation
note included.

**Related memories:**
- `user_feel_free_and_safe_to_act_real_world.md` — standing
  permission to act; this narrows the shape for one specific
  class of action.
- `feedback_simple_security_until_proven_otherwise.md` — RBAC
  posture; script-content review is the "proven otherwise" guard
  for toolchain installs.
- `feedback_fix_factory_when_blocked_post_hoc_notify.md` — when a
  blocker is a sandbox denial on an externally-downloaded script,
  validate the script first, then proceed.
