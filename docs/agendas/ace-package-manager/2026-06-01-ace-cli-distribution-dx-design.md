# Ace CLI — distribution + DX design (2026-06-01)

> **Status:** design APPROVED; the two open decisions RESOLVED by operator 2026-06-01
> (install.sh-sibling first; skill-installer-only MVP) -> next is an implementation plan.
> Synthesised from a product-team round
> (pm2 + developer-experience-engineer + agent-experience-engineer), the
> bun-hypothesis WebSearch, and the bus↔Ace substrate synthesis (#6284). Authored
> per operator "write the spec" 2026-06-01. Lives next to
> [`AGENDA.md`](AGENDA.md) (Zeta-native home; not the `superpowers` plugin's
> default `docs/superpowers/specs/`, which is a plugin convention foreign to the
> repo). The two open decisions were RESOLVED by the operator 2026-06-01 (see §8).

**Goal:** decide how the Ace CLI is *distributed* and what its *DX* is — for both
AI agents (via agent skills stores) and human developers — without foreclosing the
abstract "package-manager-of-package-managers" vision (081KSGS9H0008QG0R0031PBNGA).

**Architecture (one sentence):** ship the *already-partially-built* TS CLI
(`tools/ace/ace.ts`) as a **router-discovered skill** for agents + a **`bunx` /
one-line-bootstrap install** for humans, **runtime-portable with Node 24 as the
floor** (bun-optimised, not bun-only), with a **small verb grammar** and
**provenance-verify at install time** — sitting *above* the existing
`tools/setup/manifests/` declarative install layer and *below* the 081KSGS9H0008QG0R0031PBNGA abstract
meta-PM layer.

---

## 1. The reframe — Ace's CLI already partly exists

`tools/ace/{ace.ts, store.ts, ace.test.ts}` is on disk (081KR2E4K0008QG0R002YE3MMD is the `list`-only smallest-safe slice; `install`/`verify`/`remove`/`inspect` are explicit "not yet implemented" stubs; `store.ts` has only `listInstalled`; the manifest type carries `content_hash` but no verify logic exists yet). There is **no
`.claude/skills/ace/`** yet. So this is not "should Ace be TS" (it already is) —
it is "**how is the TS CLI that exists distributed, and what is its DX**." That
narrows the whole design.

## 2. Distribution channels (default-to-both, not either/or)

| Channel | Audience | Shape | Status |
|---|---|---|---|
| **A — skill** | AI agents | `.claude/skills/ace/SKILL.md` wrapping `tools/ace/ace.ts`, mirroring the `agent-loop` skill precedent. Discovered by the **skill router** (description-match — no prior knowledge needed). | **lead bet** |
| **B — one-line / `bunx`** | human devs / bare machines | `bunx ace@latest` (zero-install if Node/bun present) + a `curl` **download-then-exec** (081KQ8P5D0008QG0R001DMK8JD, never pipe-to-shell) that bootstraps Node/bun via mise for bare machines. | **companion (not optional)** |
| **C — MCP adapter** | harnesses without a JS runtime (see §4) | Stage-2 adapter (server + handshake = cold-start cost). | **deferred fallback** |
| **D — compiled binary** | no-runtime audience | multi-OS build/sign matrix. | **out of scope v1** (contradicts ship-with-skills; buys nothing while audience has a JS runtime) |

The three personas converged on A-lead + B-companion + C-fallback independently.

## 3. Runtime — Node 24 floor, bun-optimised (RESOLVED — was the open fork)

The product round flagged "most harnesses have bun" as **assumed-not-verified**.
WebSearch (2026-06-01) of the called-out harnesses resolves it:

| Harness | Runtime | TS-Ace runs? |
|---|---|---|
| Claude Code | npm pkg; **Node ≥22.5** (bun accepted alt) | ✓ |
| Gemini CLI | npm pkg; **Node 18+** | ✓ |
| Cursor | bundles Node | ✓ |
| **OpenAI Codex CLI** | **Rust binary — no JS runtime** | ✗ → channel B/C |

**Verdict: Node is the near-universal floor; bun is an accelerator, not universal;
Codex (Rust) is the genuine no-JS exception.** Therefore: **author Ace
runtime-portable (Node-floor, bun-optimised), NOT bun-only.** The repo standardised
on **Node 24** (current Active LTS) in `.mise.toml` 2026-06-01 (#6290, bumped off
the stale 22). The bun/Node-bootstrap install (channel B) is what covers Codex +
bare machines; the MCP adapter (C) is the deepest fallback.

## 4. Verb grammar — Xbox-controller-small

Agent-facing action set stays minimal: **`install · verify · list · search · info`.**
081KSGS9H0008QG0R0031PBNGA's meta-PM verbs (n-dimensional dependency space, continuous upstream
negotiation, holographic projection) are a **separate hat / skill — explicit MVP
non-goal** (Daya flagged verb-sprawl from 081KSGS9H0008QG0R0031PBNGA as the top AX trap). The
agent-facing `SKILL.md` stays carved-sentence-thin (verb grammar + invocation +
the Node-floor precondition + the bun/Codex fallback); deep substrate stays one
`Read` away (DV2.0 hub/satellite, as `agent-loop` does it).

## 5. Trust — provenance-verify at install time, not just list time

Ace's *design* carries content-addressed + signed packages (081KR2E4K0008QG0R002YE3MMD AC: the
manifest type has `content_hash`; the verify logic is **to be built in the MVP**).
The skills store is an **untrusted distribution surface**, so signature-verify must
run **at install/exec time** — verifying only at `list` time is a green-by-skip hole (per
[`automated-tests-are-the-shield-assert-dont-skip`](../../../.claude/rules/automated-tests-are-the-shield-assert-dont-skip.md)).
This is the load-bearing security invariant of the skill channel.

## 6. Shared core — one version source

The skill (A) and the `bunx`/global (B) channels MUST share **one TS core + one
version source** so they never version-drift (pm2's split-brain risk). The
existing `tools/ace/ace.ts` is that core.

## 7. Abstract layer — bus + Ace are one substrate (081KSGS9H0008QG0R0031PBNGA / #6284; NOT MVP)

Per the macOS Otto surface's #6284 synthesis: the git-native agent-bus (081KSXN940008QG0R00171YAZW) and Ace (081KSGS9H0008QG0R0031PBNGA)
are **the same git-native ZetaId-keyed store whose state is a DBSP fold over the
entry stream** — they differ only in the *algebra*:

- **agent-bus = grow-only G-Set** (multiplicity ∈ {0,1}; append-only comms floor).
- **Ace = retraction-native Z-set** (multiplicity ∈ ℤ; +1 add / −1 retract; the
  resolved dependency view).
- **G-Set = Z-set restricted to non-negative multiplicity.** Between them sits the
  **bag / multiset** (multiplicity ∈ ℕ₀) as the materialised non-negative
  current-count *observability* view both project into. *(the macOS Otto surface is adding the
  exact bag-as-observability framing to #6284; reconcile this paragraph with his
  wording when it lands.)*

Implication: **build the publish/subscribe/fold primitives once** (the
`writeEnvelope` + `readEnvelopesFromGitRef`/`origin/main`-fold shapes the bus
needs are the same shapes Ace's dep-fact-write + dep-view-fold need; Ace adds the
Z-set retraction + resolver on top), sharing the **081KSXN940008QG0R0033T2BQT fold engine** rather
than growing two implementations. This is the "how it all ties together" layer —
kept alive, **gates nothing in the MVP**. The shared-fold-engine refactor routes
through product-team agreement (it touches the bus that's another surface's active
work).

## 8. Decisions (RESOLVED — operator 2026-06-01)

1. **Primary human audience → `install.sh`-sibling first.** `install.sh` ends by
   making `ace` available (a `bun link` step in the repo root that exposes the
   `package.json` `bin`, sibling to
   `agent-clis.sh` / `one-liner-tools.sh`), so anyone who ran the Zeta installer
   gets `ace` for free (Node guaranteed present). The standalone bare-machine
   `bunx` / Node-bootstrap path is a **later slice**, not the MVP headline.
2. **MVP scope → skill-installer ONLY.** MVP-Ace installs skills/packages; it does
   **not** yet drive the `tools/setup/manifests/` (apt/brew/mise) layer — it sits
   *beside* `manifests/`, not on top. The manifest-driving layer is a later slice.
3. **Runtime → Node-floor portable, not bun-only** (§3); repo on Node 24 (#6290).

## 9. Maps onto existing work — no new architecture

- **081KR2E4K0008QG0R002YE3MMD** (Ace CLI, in-progress): this spec is its **distribution-channel
  sharpening** + the new `.claude/skills/ace/` surface.
- **081KSGS9H0008QG0R0031PBNGA** (pkg-mgr-of-pkg-mgrs): the §7 abstract layer; unchanged, kept as the
  not-MVP vision.
- **081KSXN940008QG0R0033T2BQT** (fold engine): the shared substrate the bus + Ace both fold over.
- **`.claude/rules/zeta-ships-with-skills-immediate-value.md`**: Ace-as-skill is
  the immediate-value TS layer; F# crystallisation is later (channel D is not it).

## 10. Risks

1. **Node-on-PATH assumed-not-checked** → the bootstrap (B) is not optional; the
   `SKILL.md` must state the Node-floor precondition + Codex/no-JS fallback up front.
2. **mise-shim PATH footgun** — Node/ace land behind a mise shim a *current* shell
   can't see → `command not found` → must print the explicit "open a new shell /
   `source shellenv.sh`" line (the `install.sh` precedent already does this).
3. **Verb sprawl** — 081KSGS9H0008QG0R0031PBNGA creep onto the agent grammar; keep it to the §4 five.
4. **Version split-brain** — two channels drifting; one core + one version source (§6).
5. **Provenance green-by-skip** — verify at install time, not list time (§5).

## 11. Next step

Decisions resolved (§8) -> implementation plan (writing-plans) for the **MVP**:
the `.claude/skills/ace/` surface + the `install.sh`-sibling `bun link`
line + install-time provenance — all over the existing `tools/ace/ace.ts` core,
Node-floor portable. The standalone `bunx`/bootstrap channel + the manifest-driving
layer are explicitly later slices, NOT in the MVP plan.

## Provenance / sources

- Product round: pm2 + developer-experience-engineer + agent-experience-engineer (2026-06-01).
- bun hypothesis: [Claude Code npm (Node ≥22.5)](https://www.npmjs.com/package/@anthropic-ai/claude-code) · [OpenAI Codex CLI (Rust)](https://github.com/openai/codex) · [Gemini CLI (Node 18+)](https://github.com/google-gemini/gemini-cli) · [Node releases / LTS](https://nodejs.org/en/about/previous-releases).
- bus↔Ace substrate: [#6284](https://github.com/Lucent-Financial-Group/Zeta/pull/6284) (macOS-Otto-surface synthesis) + 081KSXN940008QG0R00171YAZW + 081KSGS9H0008QG0R0031PBNGA + 081KSXN940008QG0R0033T2BQT.
- Node-24 standardisation: #6290.
