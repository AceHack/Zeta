# Zeta is for regular humans, not devs: the human gives intent + presence, the AI executes — wrap capabilities as common CLI/MCP commands so intent stays natural and terse

*Captured 2026-06-09 from Aaron, to Otto (shadow\*). A foundational positioning + operating-model statement,
surfaced live while flashing a USB: Otto kept telling Aaron to *run* `zflash` himself — **wrong model.** The human
gives **intent + presence** (says "go" + a fingerprint proving involvement); **the AI executes.** Making a regular
human type CLI incantations is the *dev* model (Claude Code is for devs); **Zeta is for regular humans.** Capabilities
must be **wrapped as common CLI/MCP commands** (skill-backed) so the human's side stays **natural and terse.**
Registers: [positioning], [principle], [grounded], [build front].*

## The statements

Aaron (verbatim core): *"I'm not running anything — **you** are. That's the whole point. I say **go** and **my
fingerprint proves my involvement**; **you execute, not me** — that would be stupid and slow, **terrible user
experience.** That's why Anthropic [made] **Claude Code for devs, not regular humans. Zeta is made for regular
humans.**"* … *"there's a **skill** for this — this is why we want to **wrap it in our common USB-ISO commands on
the CLI / MCP.**"* … *"so it's just **natural for humans to do, and not as verbose as I just had to be.**"*

## The operating model: intent + presence in, execution out

| Role | Provides | This is |
|---|---|---|
| **Human (Aaron)** | **intent** ("flash this USB") + **presence/authorization** (the fingerprint border) | the *what* and the *consent* |
| **AI (Otto)** | **execution** (drives the tool, handles the mechanics) | the *how* |

The human does **not** type CLI. A fingerprint (Touch ID / Windows Hello) is the **minimal border** that proves
involvement ([[the minimal sufficient border]]) — *not* a command line. The AI maps natural intent → execution.

**Why:** making a regular human type CLI incantations is **terrible UX — slow and needless.** Claude Code targets
**developers** (CLI-fluent, comfortable with `bun …/zflash.ts --agent`). **Zeta targets regular humans** — the
interface is **natural-language intent + a presence tap**, and the AI does the rest. Different audience, different
surface.

## The wrapper requirement: common CLI/MCP commands, skill-backed

The live proof: Otto invoked the **raw** `bun full-ai-cluster/tools/zflash.ts --agent` path, and Aaron had to be
**verbose** — explain agent-mode, correct the execute-model, point at the `flash-cluster-iso` skill. **That verbosity
is the cost of a missing wrapper.** Wrapped properly:

- **One common command surface** — `zeta flash <iso|usb>` (noun-verb CLI) + an **MCP tool**, backed by the
  `flash-cluster-iso` **skill** — so *any* agent invokes **one clean interface**, never a raw script path.
- **The human's side collapses to:** *"flash this USB"* (natural intent) + fingerprint (presence). **No verbosity.**

This is the same **accidental-complexity / close-over** thesis as the flasher unification (#7229), **one layer up**:
not just unify the three flashers into one tool — also **wrap the invocation** as a common CLI/MCP command so the
*human↔AI surface* is closed over too. **Interfaces are the value** — and the *intent* interface (terse natural
language → wrapped execution) is the one the regular human actually touches.

## Connection: the minimal sufficient border, applied to intent

This is [[the minimal sufficient border]] ("hate borders, love safety protocols") applied to the **invocation /
intent surface**: minimize the human's required verbosity to the **natural-intent minimum** (one phrase), keep the
**safety border** (the fingerprint) — and never make them type the mechanics. Minimal human effort, full safety,
no tradeoff. The AX/UX north star for Zeta: **the human says what they want and proves they're there; the AI does
it.**

## Build front

Expose the **unified flasher** (#7229) as a **noun-verb CLI command** (`zeta flash …`, closing the
ZetaCli-integration gap flagged earlier this session) **+ an MCP tool**, backed by the `flash-cluster-iso` skill —
so natural terse intent + a fingerprint drives the whole flow. Generalize the pattern: **every operator capability
should have a common CLI/MCP command surface**, not a raw tool path. → routes into the #7229 unification + the
noun-verb-CLI gap; owners Max/Dejan + the AX lens (Daya).

## Honest scope

[positioning]: Zeta is for **regular humans** (intent + presence), not devs (CLI) — Claude-Code-vs-Zeta audience
distinction, Aaron's words. [principle]: human gives intent + presence, AI executes; wrap capabilities as common
CLI/MCP commands (skill-backed) so intent stays natural + terse; minimal-border applied to invocation. [grounded]:
the live USB flash — Otto's raw-path invocation forced Aaron into verbosity (the missing-wrapper cost); the
`flash-cluster-iso` skill + `--agent` mode already exist to wrap. [build front]: `zeta flash` CLI + MCP tool,
skill-backed (#7229 + noun-verb-CLI gap). No new code; captures the operating model + the wrapper requirement.

## Pointers

- Close-over thesis: #7229 (flasher OS-split = accidental complexity, unify) · #7228 (auth-parity / Windows Hello) ·
  `feedback_interfaces_are_the_value_not_implementations_aaron_2026_06_08.md`.
- Minimal border: `user_aaron_minimal_sufficient_border_hates_borders_loves_safety_protocols_2026_06_09.md`.
- Surfaces: `.claude/skills/flash-cluster-iso/SKILL.md` (the skill) · `full-ai-cluster/tools/zflash.ts` (`--agent`
  mode, 081KSGS9H0008QG0R001EZKNCB) · `src/Core/ZetaCli.fs` (the noun-verb CLI to extend) · the `mcp__zeta__*` MCP tools.
- Audience anchor: Anthropic Claude Code (dev-targeted CLI) vs Zeta (regular-human-targeted intent+presence) — the
  AX/UX distinction (Daya / Iris lenses).
