# First-session vertical — post-login choose-your-own-adventure

Status: slice 4 landed; S4 society proof green (QEMU phase-3, run [27862943618](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/27862943618))
Owner hat (tentative): **usb-zflash-installer** + **observe** composes
Last refreshed: 2026-06-20

## Purpose

After console login on a fresh cluster node, the operator should not land in a
bare shell. A **local LLM conductor** (`observe` + Ollama) presents a menu:
which credentials to set up, which to skip, whether to stay local-only.

**Load-bearing:** `gh` — required for `zeta-self-register` (node catalog PR).
**Optional:** `claude`, `codex`, `gemini` — cloud assistant adventures.

## Code (slice 1)

| Artifact | Role |
|----------|------|
| `src/Core.TypeScript/observe/first-session.ts` | Oracle, menu, `simulateFirstSession`, `firstSessionWithLlm`, `foldFirstSession`, `runFirstSessionLoop` |
| `src/Core.TypeScript/observe/first-session.test.ts` | S0 pure oracle/simulate tests |
| `src/Core.TypeScript/observe/first-session-llm.test.ts` | S0 LLM chooser + closed-loop fold (reuses observe `chooseIndex` / mock-backend pattern) |

| `src/Core.TypeScript/observe/first-session-run.ts` | Post-login CLI conductor (menu / --llm / --demo) |
| `src/Core.TypeScript/observe/first-session-executor.ts` | Cred probe + gh/claude/codex/gemini executors |
| `src/Core.TypeScript/observe/first-session-run.test.ts` | S0 demo/dry-run + probe tests |
| `src/Core.TypeScript/observe/tick-budget.ts` | `TickBudget` — the injected, attributed tick bound (the TS shape of `SimLoop.Budget`) |
| `src/Core.TypeScript/observe/first-session-budget.test.ts` | Measures the machine's diameter (6 over 115 states), proves the budget is read, and exercises the **real** marker write |
| `full-ai-cluster/nixos/modules/zeta-first-session.nix` | profile.d hook on first interactive zeta login |

| `src/Core.TypeScript/observe/load-node-session.ts` | Probe marker + creds → optional World channel |
| `observe.ts` + `grammar-16-render.ts` | `nodeSession` channel; slot 4 first-session sub-menu |

| `docs/trajectories/usb-zflash-installer/HAT-ROUTING.md` | Slice 5 hat path → owner sketch |

QEMU phase-3 hard gate on push: scenario 2 sets `QEMU_FIRST_SESSION_PHASE3=1` on every `build-ai-cluster-iso` push + workflow_dispatch (promoted after society proof run 27862943618).

**Next vertical:** S6 physical first-login UX — see [S6-UX-PLACEHOLDER.md](./S6-UX-PLACEHOLDER.md) (co-design in progress with operator family).

## Reused from observe / workflow DUs

Same harness as `observe.test.ts`, `closed-loop.test.ts`, `simulate-tick.ts`:

- `chooseIndex` + `ModelBackend` from `accelerator/local-llm.ts`
- `backendChoosing(session, target)` — mock returns menu index
- Fallback to oracle lead when model fails
- `fold(events)` reconstructs state from adventure trace

## Society validation tiers (not PR-centric)

Per `docs/BUILD-GATES.md` — local prepush is the gate; peers replay; CI is signal.

| Tier | Who | First-session coverage |
|------|-----|------------------------|
| **S0** | Builder | `bun test src/Core.TypeScript/observe/first-session.test.ts` |
| **S1** | Builder | `bun run preflight:quick` includes observe suite |
| **S2** | Peer / builder | `validate-local-llm.ts` — Ollama chooser over menu labels |
| **S3** | USB hat owner | Scripted `first-session` demo against mock LLM backend |
| **S4** | Society cadence | QEMU phase-3: `QEMU_FIRST_SESSION_PHASE3=1` on scenario 2 (push + workflow_dispatch) |
| **S6** | Human (+ co-design) | Physical boot — first-login adventure UX (menu, pacing, copy) |

## Vertical slices (roadmap)

1. **Slice 1 (done)** — pure first-session state machine + tests
2. **Slice 2 (done)** — `firstSessionWithLlm` + closed-loop LLM tests (observe DU reuse)
3. **Slice 3 (done)** — `zeta-first-session` profile.d on installed NixOS; gh device-flow executor; serial markers
4. **Slice 4 (done)** — `nodeSession` World channel + grammar-16 slot-4 overlay (NextAction union unchanged)
5. **Slice 5 (sketch)** — hat routing doc (`HAT-ROUTING.md`); CODEOWNERS when teams confirmed

## Hat / code-owner sketch

| Vertical | Hat | Owns |
|----------|-----|------|
| USB / zflash / install | installer | `zeta-install.sh`, `zeta-first-boot.sh`, ISO |
| Post-login session | observe | `first-session.ts`, `observe.ts`, local LLM chooser |
| Register | cluster-substrate | `zeta-self-register.sh`, gh auth |
| Society validation | architect | `BUILD-GATES.md`, peer replay ritual |

## Test isolation vs full E2E

- **Fast (always):** `first-session.test.ts`, `observe.test.ts` simulate paths
- **Medium:** `first-session-demo` with mock `ModelBackend`
- **Rare:** full QEMU install + SSH phase-3; physical WiFi boot

Full usb/zflash QEMU cascade (scenarios 1–4) remains society-cadence evidence, not per-edit tax.
