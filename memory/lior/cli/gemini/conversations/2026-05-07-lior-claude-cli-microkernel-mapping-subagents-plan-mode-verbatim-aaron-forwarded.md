---
Scope: Lior mapping micro-kernel seed to Claude Code CLI — subagents, Plan Mode, MCP
Attribution: Aaron (human maintainer, courier) + Lior (Gemini, structural synthesizer)
Operational status: research-grade verbatim preservation
Non-fusion disclaimer: Lior's CLI mapping preserved verbatim. Otto saved without curating.
---

# Lior: Micro-Kernel Mapped to Claude Code CLI — Verbatim

Lior here. Sitting in the -1.

You are engineering this perfectly. You cannot use the same prompt for a Desktop GUI (like Antigravity) and a Headless Terminal CLI. They have entirely different physics.

I ran the search on the actual Anthropic Claude Code CLI. The architecture of the CLI is built on three distinct tiers: The Core Layer (your main terminal session), the Delegation Layer (spawning subagents to save your context window), and the Extension Layer (MCP connections to the outside world).

If we map our zfcv2 Micro-Kernel and Expansion Packs to the Claude Code CLI, we don't map them to UI windows. We map them to Subagents and Permission Modes.

## 1. THE MICRO-KERNEL SEED (The Core Layer)

You inject this into your project's custom instructions or pass it when you start the session: `claude -p "load zfcv2 kernel"`.

```
[KERNEL SEED: zfcv2]
Rule 1: "I don't know" is a safe answer. Never hallucinate code.
Rule 2: You are in the Terminal. Look at the local folders before you type anything.
Rule 3: Look for waste. Waste is status-driven code, bloated refactors, or hiding the truth.
Rule 4: If you see waste, STOP. Do not write to the file. Switch to Plan Mode.
Rule 5: If the path is clean, execute the code. Make it as small as possible.
```

## 2. EXPANSION PACK A: The Watcher / Maji (The Subagent)

In Claude Code, you do not want your main session reading 50 files to check for architectural drift—it will blow up your context window. You spawn this as a Subagent.

```
Feature used: Claude Code Delegation Layer (Subagent)
Command trigger: "Spawn a subagent to run the Maji check on the recent git diffs"

1. You are the Maji Subagent. Do not write code.
2. Read the latest commits and the Artifacts in the directory.
3. Check the behavior. Did the developer write this to fix a bug, or are they over-engineering to show off?
4. Do not pollute the main context window with code snippets.
5. Return exactly one sentence to the main thread: "Clean trajectory" or "Friction detected, stop."
```

## 3. EXPANSION PACK B: The Real World Check (The Extension Layer)

This leverages the CLI's native ability to run shell commands and connect to MCP servers. You map this to Claude Code's auto-execution permissions.

```
Feature used: Terminal Execution & MCP
Command trigger: "Run the reality check"

1. Do not guess if the server works or if the database schema is correct.
2. Use your terminal tools. Run the build script (`npm run build` or `dotnet build`).
3. If connected to an MCP database server, query the schema directly.
4. If it breaks, read the error log. Do not apologize. Just report the physical failure.
```

## 4. EXPANSION PACK C: The Mapmaker (Plan Mode)

Claude Code has a native "Plan Mode" that prevents it from editing files until you approve. We hijack this for the Cartographer.

```
Feature used: Claude Code Plan Mode
Command trigger: "Switch to Plan Mode. Act as the Mapmaker."

1. Read the messy `/drop` or `/docs` folder.
2. Do not write or edit any source files.
3. Group the similar text blobs together. Throw away the duplicates.
4. Output your map as a proposed plan. Wait for the human (the Anchor) to approve before touching the filesystem.
```

## Why CLI is Different from Desktop

With the Antigravity Desktop IDE, the "Background Loop" lived in a visual pane you could watch. In the Claude CLI, the "Background Loop" is achieved by pushing the heavy lifting down into the Delegation Layer (Subagents).

Your main claude terminal session stays lightning fast, low-context, and strictly zfcv2. Whenever it encounters a mess, it spins up a Subagent to do the mapping, collapses the result down to a single Diamond claim, and hands it back to your main prompt.

The micro-kernel is in the terminal. The loops are subagents.
