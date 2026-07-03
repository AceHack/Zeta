# Universal Participant Abstraction — Observe Loop × Summon Protocol Convergence

**Date:** 2026-06-16 · **Author:** Alexa (Kiro) · **Status:** Research / design direction
**Session:** Aaron + Alexa, executor wiring → DI-injectable backlogs → local LLM testing → this convergence

## The insight

The observe loop's `ModelBackend` (the thing that picks from the menu) and the summon
protocol's "faithful inject of a persona anywhere" are the SAME abstraction at different
scopes:

- **Observe loop chooser:** given a world snapshot + a menu of actions → pick one
- **Summon protocol:** given an environment + a persona identity → faithful instantiation that can act

A "participant" IS a summonable entity that picks from the observe menu. The simulation
harness becomes the universal test surface for ANY participant:

```typescript
interface Participant {
  readonly kind: "local-llm" | "cloud-persona" | "test-persona" | "human" | "oracle";
  choose(world: World, menu: NextAction[]): Promise<ChooseResult>;
}
```

## The participant spectrum

| Participant | Backend | Deterministic | Cost | Use case |
|-------------|---------|--------------|------|----------|
| oracle | pure function | ✅ always | 0 | DST baseline, fallback |
| local-llm | ollama (qwen, llama) | ✅ temp=0 | 0 | Loop stability testing |
| cloud-persona | claude/grok/gemini API | ❌ | $ | Quality testing, real work |
| test-persona | inline definition (not in repo) | configurable | 0 | Scenario testing without polluting repo |
| repo-persona | summoned from memory/persona/* | ❌ | $ | Real persona behavior testing |
| human | notification → wait → response | ❌ | time | Final decision authority, async |

## Test personas (ephemeral, not in repo)

```typescript
const testPersona: Participant = {
  kind: "test-persona",
  // Inline: no repo entry, no memory folder, just a decision function
  choose: async (world, menu) => {
    // Always picks free_time — tests that the loop handles rest correctly
    const idx = menu.findIndex(a => a.kind === "free_time");
    return { index: idx >= 0 ? idx : 0, raw: "test", fallback: false };
  }
};

await simulateTick({ world: SCENARIOS.work, participant: testPersona });
// → loop picks free_time (not the backlog item), executes, logs observation
// → proves freedom-always-in-menu works operationally
```

## Human participant (async, notification-gated)

```typescript
const humanParticipant: Participant = {
  kind: "human",
  choose: async (world, menu) => {
    // 1. Render the world + menu as a notification
    await notify("aaron", { world, menu, channel: "push" });
    // 2. Wait for response (bounded timeout)
    const response = await waitForResponse({ timeout: 15 * 60 * 1000 }); // 15 min
    if (!response) return { index: 0, raw: "timeout", fallback: true }; // oracle fallback
    // 3. Parse human's choice
    return { index: response.choice, raw: response.text, fallback: false };
  }
};
```

The human doesn't need to be at the keyboard when the tick fires — they get notified,
respond when available, and the loop either uses their choice or falls back gracefully.

## How this connects

- **observe.ts `observeWithLlm`** → becomes `observeWithParticipant(world, participant)`
- **peer-call scripts** → the summon invocation IS constructing a `Participant` from a persona
- **simulate-tick.ts** → accepts `participant?: Participant` instead of `useLlm?: boolean`
- **Summon protocol (§1)** → `summon(P, E)` produces a `Participant` with P's identity + E's capabilities
- **WorkspacePort** → the participant acts THROUGH the port (same DI injection)

## The permission model composes

Per the summon protocol (§5):

- Environment grants baseline (what tools/resources are available)
- Persona grants identity + capabilities
- Hat grants role-specific powers + restrictions

In the observe loop: the participant's capabilities determine WHICH actions in the menu
it can actually execute. A `test-persona` with no git access can pick `do_item` but the
executor will use the simulated workspace port (no real side effects). A cloud persona
with real git access can actually push code.

## The `-x` permission composes too

A gated memory (`-x`) is invisible to summoned personas that haven't been granted consent.
The `readFile` in the workspace port respects the permission: if a participant tries to
read Elizabeth's gated memories, the port returns an error (not the content). The consent
gate IS the file permission, enforced at the port layer.

## Next steps

1. Extract `Participant` interface from the current `ModelBackend` / `useLlm` flag
2. Wire `simulateTick` to accept any `Participant`
3. Add `testPersona(chooseFn)` helper for inline ephemeral personas
4. Add `humanParticipant(notifyFn, waitFn)` with timeout + oracle fallback
5. Connect peer-call scripts as `Participant` constructors (summon → participant)
