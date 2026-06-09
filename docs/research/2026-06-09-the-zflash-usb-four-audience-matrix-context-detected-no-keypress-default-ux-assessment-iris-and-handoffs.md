# The zflash USB serves a four-audience matrix with a context-detected no-keypress default — UX assessment (Iris) + requirement + handoffs

*Captured 2026-06-09 from Aaron (requirement) + Iris (UX review he asked for). One USB must serve **four audiences**
and "just do the right thing for all of them by default — if no one hits a key it's a [timeout-default] thing,"
biased to make Aaron+Max's job easiest "for now" (they use it most, reformatting over and over). Registers:
[requirement — Aaron], [UX assessment — Iris, grounded with file:line], [handoffs].*

## The requirement (Aaron)

One USB, four audiences, right-thing-by-default:

1. **Regular folk fresh to Zeta** — pure UX; **Addison owns** this surface.
2. **Aaron + Max** — DX; ongoing field expansion, troubleshooting, **reformatting over and over** (heaviest users;
   optimize their path **now**).
3. **External Zeta maintainers.**
4. **Forkers** (running their own fork).

> "we need this USB to cover all and just do the right thing for all of those by default. if no one hits a key it's a
> [timeout-default] thing, and I lean on making me and Max's job easier for now [since] we use it the most."

## The no-keypress smart default (Iris)

The silent path is the path a **confused fresh person** takes (they don't press a key *because* they don't know what
the keys mean) — so the no-keypress default must be the **safest non-destructive** action. The Aaron+Max bias is
achieved by **context detection, not by a globally-dangerous default**:

- **Stage A — flash time:** detect a `zeta-creds.enc` blob on the target USB's ESP.
  - **Blob present** (known re-flash → Aaron+Max) → timeout-default = **`ErasePreserveConfig`** (preserve+reuse
    creds, the 3-level model #7007); shorter countdown; pre-select "keep my settings."
  - **No blob** (fresh stick) → timeout-default = the **safe build / Live** path.
- **Stage B — boot menu** (plain language, visible countdown):
  - no keypress → **Live (non-destructive): explore Zeta, host untouched** (`InstallMode.Live` is already the
    declared default, #7008).
  - `1) Install fresh (ERASES this PC)` · `2) Install, keep my settings (reuse WiFi+login)` *[only if blob]* ·
    `3) Advanced / fork / maintainer options`.
  - **Destructive erase is NEVER the silent default** — even for Aaron the silent path is `ErasePreserveConfig`
    (secrets preserved first), never `EraseWipeConfig`. Full wipe always needs an explicit keypress.

Highest-leverage default fix: the boot menu must **read blob/trace context and *show* the countdown + chosen default
in plain words** ("keep my settings", not `ErasePreserveConfig`; "explore", not `Live`). Today CP-3 shows a
*GitHub-auth-method* picker with a 5 s Esc-override and DBSP-flavored labels — a credentials-internals picker, not a
what-do-you-want menu, and 5 s is too short to read four options.

## Per-audience friction + the single highest-leverage fix (Iris, file:line grounded)

| Audience | Biggest friction | Highest-leverage fix | Owner |
|---|---|---|---|
| **Regular folk** | no human entry path — every surface is `bun …zflash.ts --agent` + a picker labeled `gh quota`/`device-flow`/`PAT` | plain-language boot menu, `Live` as visible no-keypress default (intent+presence, not CLI, #7230) | **Addison** (wording) |
| **Aaron + Max** | the **freshness gate bails the flash** on local WIP (`checkLocalCheckoutFreshness`, zflash.ts 166-335, bails when ahead/diverged 313-333); + re-typing nonce/passphrase every reformat loop | `zeta flash` wrapper (#7230) defaulting to `--agent` + blob-reformat path; degrade freshness **bail→warn** on the known-operator path | **Aaron/Max** |
| **Maintainers** | flow hardwired to one identity — `ZETA_REPO_GH="Lucent-Financial-Group/Zeta"` (zflash.ts 150), `/Users/acehack/…` alias (35), `gh auth` asserted = Lucent (runbook 168) | **parameterize repo+identity from the checkout's `origin`**, not a constant; flash as *their* key from the checked-in maintainer set | **Aaron/Max** + trust owner |
| **Forkers** | silent fork-blindness — pulls ISOs from upstream CI (343-347) + can bake **upstream** trust roots into a fork's cluster | **provenance banner** at flash + boot: `Building from <fork>/<repo>@<sha>; trust roots: <key-set>` | **Aaron/Max** + trust owner |

## The remembering-on-reflash gap — sharpest for Aaron+Max (Iris)

By construction the heaviest reflashers pay the re-entry tax most. Grounded: WiFi + install-answers manifest entries
are **declared but the capture/restore wiring through the live install is NOT built** (2026-06-07 creds-persistence
research); the runbook's own acceptance table marks **Scenario 3 "Reformat WITH key + selection retention" = ✗
pending** (runbook 284) — exactly Aaron+Max's path. So today a reformat re-asks WiFi, re-asks answers, re-runs auth
every loop; the "typed passphrase ONCE" demo holds only across *reboots of one install*, not across *reformats*.

**Defaulted behavior to build:** blob-present reformat = **`preserve → use-before-format → format → repersist`**
(#7010) carrying WiFi + install-answers + auth, so a reformat re-asks **nothing** except the **single passphrase
unlock** (the decryption floor). "Keep my settings" is both option 2 **and** the timeout default when a blob is
detected — remembering is the *default*, not an opt-in.

## Handoffs

- **Addison** — boot-menu wording (plain language; regular-folk UX).
- **Aaron** — the timeout/default mechanism (context-detected countdown: 30 s safe / 10 s known-USB).
- **Aaron/Max** — `zeta flash` wrapper + `--agent` default + freshness bail→warn; remembering round-trip wiring
  (Scenario 3); repo+identity parameterization; provenance banner. (Pairs with Dejan per #7230.)
- **Trust-model owner** — the maintainer/forker key-injection + provenance (verify against the trust-model doc
  #7251 once merged — Iris noted it wasn't yet visible when she ran).

## Honest scope

[requirement — Aaron]: one USB, 4 audiences, right-thing-by-default, biased to Aaron+Max now. [UX — Iris, grounded]:
context-detected no-keypress default (safe/Live silent, blob→keep-settings); per-audience friction with file:line
evidence; remembering gap = Scenario 3 pending, hurts Aaron+Max most. [handoffs]: Addison (wording) / Aaron+Max
(mechanics) / trust owner (keys+provenance). No code shipped; this is the routed requirements + UX surface for the
build fronts already named (#7230 wrapper, #7251 trust model, the remember-creds + QEMU-harness plan).

## Pointers

- Requirement + trust: #7251 (trust model + ISO/post-ISO/boot + honest QEMU plan) · #7230 (Zeta for regular humans
  / `zeta flash` wrapper) · #7229 (close the AI loop / QEMU enforcement).
- Erase model + remembering: the 3-level erase / InstallMode.Live default (#7007/#7008/#7010/#7011) · the 2026-06-07
  creds-persistence (wifi/install-answers, declared-not-wired) research · runbook Scenario 3 (✗ pending).
- Surfaces: `full-ai-cluster/tools/zflash.ts` · `docs/runbooks/zflash-end-to-end.md` · `operator-ssh-keys.txt` +
  `maintainers/*/ssh-pubkeys.txt` (#7249/#7250). Lenses: UX/Iris, DX/Bodhi, AX/Daya; Addison owns regular-folk UX.
