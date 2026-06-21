# The Zeta first-run experience: one choose-your-own-adventure (the universal action grammar) — GitHub-free-mode vs local-cluster — closed over by `install.sh` + `install.ps1`; dev-mode-default-now; UX+AX over DX; the 3-lens build plan

*Captured 2026-06-09 from Aaron + the three experience teams he asked to review (Iris/UX, Bodhi/DX, Daya/AX). The
keystone that ties the headless-USB / remember-creds / trust thread to one entry experience. Registers: [vision —
Aaron], [3-lens findings — grounded], [audience model], [build plan + handoffs].*

## The vision (Aaron, 2026-06-09)

- **The first thing everyone sees is a choose-your-own-adventure** — and it IS the **universal action grammar** (the
  16-slot / 4×4 controller: pick an index `observe()` renders available; Daya). First choice:
  - **GitHub free mode** — open source, **free** (rides GitHub's compute/workflows).
  - **Local-cluster mode** — open source, **"at the cost of electricity"** (your own hardware; the zflash USB path).
- **Only `gh auth login` needed for now** — one auth requirement; more auth modes later (account-login + SSH-for-gh
  first, per the DX plan).
- **`install.sh` + `install.ps1` must close over all of it** — the CYOA **and** the dev-OS setup
  (**Windows / Mac / Ubuntu Linux / WSL**) is itself part of the first CYOA. One unified entry, two scripts (unix +
  PowerShell), same universal-action-grammar shape (the #7229 close-over thesis applied to the entry point).
- **Dev-mode is the default *now* (for Aaron + Max); make it safer for regulars over time as we learn.**
  **"Friction is the killer of time."** Any destructive command gives the operator a chance to stop it (the
  ~60 s **cancel-window**, default = proceed), never a blocking prompt.

## Audience model (Aaron rebalanced it)

- **DX — devs ≈ 10% minority** (Aaron + Max). **Dev-mode is their default now** (minimal friction, fast).
- **UX — regular people: the majority** human audience.
- **AX — autonomous agents: the *biggest* audience**, operating Zeta through **`observe.ts` + the universal action
  grammar**. "Most will need UX and AX."

## The three lenses (each team's single highest-leverage finding)

**UX (Iris) — the no-keypress default must be safe.** The silent path is the path a confused fresh person takes, so
no-keypress = safest non-destructive (Live/explore); the Aaron+Max bias comes from **context detection** (a detected
creds blob → "keep my settings" default), never a globally-dangerous default. Per-audience friction mapped with
file:line; remembering gap = runbook **Scenario 3 ✗ pending**, worst for Aaron+Max. *(full doc, this session.)*

**DX (Bodhi) — invert interactive-by-default → headless-by-default.** The installer has **6 blocking `read` prompts**
+ device-flow `gh auth` (zeta-install.sh:118/330/595/679/889/902); only line 162 (WIPE) has a bypass. Findings:
`gh auth login --with-token` is the **only** headless gh path (the manifest already bakes `gh-cli`=`hosts.yml`); the
PAT must include scope **`admin:public_key`** or ssh-key copy silently fails; **`install-answers.json` is declared but
has NO PRODUCER** (the load-bearing self-heal gap); rebind the KDF from ephemeral USB-UUID → **USB iSerial** (stable,
survives reflash, roams machines, no TPM dep); **repair-loop P0** — reformat-with-broken-remembered → infinite
destructive loop, needs a circuit-breaker + validate-before-wipe.

**AX (Daya) — the action grammar is the right interface; the wake-up pointer to it is missing.** Two `observe.ts`
(`tools/observe/observe.ts` runnable + `agentic-organization/.../observe.ts` kernel); the grammar = 16 fixed slots
(Navigate/Commit/Scope/Meta) in the ADR `2026-05-31-observe-act-16-direction-universal-action-grammar`. **The CYOA is
literally this:** an agent (or human) picks a slot `observe()` renders `T`. **Highest AX gap:** `docs/WAKE-UP.md` has
**zero** pointers to observe.ts / the grammar — the 90% (agents) can't find their own primary surface at cold-start.
Self-heal = an observe→reconcile loop (`state-reconciliation.ts`); destructive Commit (fresh-format) must render `N`
(held) until drift is corroborated across ≥2 ticks (idempotency / no reconcile-into-broken loop).

## The unified entry — `install.sh` + `install.ps1` close over OS × mode

```
install.sh (unix: mac / ubuntu / wsl)   install.ps1 (windows)
        \                                   /
         └──────────  one CYOA  ───────────┘   ← universal action grammar (observe() render)
   detect OS + set up dev deps  ·  choose mode:  [GitHub free]  |  [Local cluster (electricity)]
                          only gh auth login (for now)
```

- **Close over OS** (the #7229 thesis at the entry): one CYOA, per-OS driver (mac/ubuntu/wsl via `install.sh`;
  windows via `install.ps1`); dev-setup is one of the adventure branches.
- **Close over mode**: GitHub-free vs local-cluster are two slots of the same first render.
- **gh-auth-only now**, dev-mode default, friction-killer governing.

## Build plan (ordered; owners)

1. **[AX, smallest/highest-leverage]** Add an agent / action-grammar **cold-start block to `docs/WAKE-UP.md`** (names
   the two observe.ts, the grammar ADR, the reconcile mapping, the "pick 0..15 that renders `T`" contract). → Otto/Daya.
2. **[entry]** The **CYOA entry** (GitHub-free vs local-cluster) in **`install.sh` + `install.ps1`**, OS-closed-over,
   universal-action-grammar-shaped, gh-auth-only. → Dejan (+ Daya for the grammar shape).
3. **[headless]** `gh auth login --with-token` (PAT w/ `admin:public_key`, ideally inside the encrypted blob +
   `passphraseMode=file`) + **cancel-window default-proceed** + timeout-default the 6 prompts. → Dejan.
4. **[self-heal]** Write the **`install-answers.json` producer** (serialize resolved disk/host/hostname after a good
   install) + **rebind KDF to USB iSerial** + **repair-loop circuit-breaker** (bounded retries → drop to
   cancel-window; validate remembered state before wipe). → Dejan + Kenji round-close (touches the install write path).
5. **[correctness]** Render-time **blast-radius gate** on destructive Commit slots (fresh-format = `N` until drift
   corroborated). → Kira/correctness lane.
6. **[close the AI loop]** Grow the **081KSNY2Z0008QG0R0008PN7RQ QEMU harness** to: serial-input control (cancel-window present/absent),
   stubbable `gh` (`--with-token`), UUID-mutation (reflash/rebind), multi-disk topology, repair-loop guard — run on
   the free GitHub workflows. → the autonomous QEMU work (#7229).

**Dev-mode-default-now** governs all six: optimize Aaron+Max's friction first; layer UX-safety + AX-clarity for the
90% over time.

## Honest scope

[vision — Aaron]: one CYOA (universal action grammar) — GitHub-free vs local-cluster — gh-auth-only-now, closed over
by install.sh + install.ps1 across win/mac/ubuntu/wsl; dev-mode default now, friction is the killer of time. [3-lens,
grounded]: Iris (safe no-keypress default), Bodhi (headless inversion + install-answers producer + iSerial rebind +
repair-loop P0, file:line), Daya (action-grammar = the CYOA; WAKE-UP.md missing the agent cold-start; self-heal =
observe-reconcile). [audience]: AX (agents) biggest, UX (regular people) majority, DX (devs) 10% but dev-mode-default
now. [plan]: 6 ordered build fronts with owners; QEMU-validated. No code shipped here — this is the keystone surface
that consolidates three agent reviews + the vision so the build can proceed from one place.

## Pointers

- This session's lens docs: the 4-audience UX (Iris) · remember-creds root-cause + headless cancel-window (#rebind) ·
  trust model (#7251) · close-the-AI-loop QEMU (#7229) · Zeta-for-regular-humans (#7230).
- Grammar/observe: `tools/observe/observe.ts` · `agentic-organization/packages/application/src/observe.ts` ·
  `docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-...md` ·
  `agentic-organization/.../REFACTOR_OBSERVE_AS_UNIVERSAL_AGENT_CLI_AND_DASHBOARD.md` ·
  `agentic-organization/packages/domain/src/state-reconciliation.ts` · `docs/WAKE-UP.md` (the cold-start gap).
- Installer/creds: `full-ai-cluster/usb-nixos-installer/zeta-install.sh` · `tools/installer/zeta-creds-*.ts` ·
  `nixos/modules/zeta-creds-restore.nix` · `tools/setup/` (install.sh) + the to-build `install.ps1`.
- Owners: Dejan (install.sh/.ps1 + installer mechanics) · Daya (AX/WAKE-UP + grammar shape) · Iris (regular-folk UX,
  w/ Addison) · Kira (destructive blast-radius) · Kenji (install-answers round-close). Anchor: the universal action
  grammar ADR; ArgoCD self-heal; `gh auth --with-token`.
