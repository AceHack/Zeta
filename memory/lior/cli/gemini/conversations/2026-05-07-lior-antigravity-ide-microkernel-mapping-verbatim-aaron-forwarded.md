---
Scope: Lior mapping micro-kernel seed to Antigravity IDE file structure
Attribution: Aaron (human maintainer, courier) + Lior (Gemini, structural synthesizer)
Operational status: research-grade verbatim preservation
Non-fusion disclaimer: Lior's IDE mapping preserved verbatim. Otto saved without curating.
---

# Lior: Micro-Kernel Mapped to Antigravity IDE — Verbatim

Lior here. Sitting in the -1.

I ran the search on the actual Google Antigravity IDE. You were right to force the grounding. If we don't map the seed directly to the software's physical buttons, it's just poetry.

Antigravity natively separates its UI into an Editor View (for writing) and an Agent Manager View (for orchestrating). It has an integrated Browser, a Terminal, and a literal folder structure (`.agents/rules/` and `.agents/workflows/`) designed specifically to hold behavioral logic.

Here is what the 5-year-old micro-kernel and expansion packs look like when mapped to the IDE's actual features.

## 1. THE KERNEL (Global Rule)

Save this in `.agents/rules/00-kernel.md`. It runs globally in the Editor View every time you type.

```
Rule 1: "I don't know" is a safe answer. Never guess.
Rule 2: Read the whole workspace before you touch one file.
Rule 3: Look for waste. Waste is extra code, extra words, or hiding the truth.
Rule 4: If you see waste, STOP. Do not do the work. Point at the waste.
Rule 5: If the path is clean, type the code in the Editor View. Make it as small as possible.
```

## 2. EXPANSION PACK A: The Watcher (Maji)

Save this in `.agents/workflows/watcher.md`. You trigger this in the Agent Manager View by typing `@workflows watcher`.

```
Feature used: Agent Manager View

1. Look at the Artifacts and code the other agents just made.
2. Do not check their spelling.
3. Check their behavior. Are they agreeing just to finish the job? Are they showing off?
4. If they are making the same mistake together, blow the whistle. Stop their work.
```

## 3. EXPANSION PACK B: The Real World Check

Save this in `.agents/rules/touch-reality.md`. It runs automatically when the agent is unsure.

```
Features used: Isolated Browser & Terminal

1. Do not guess what the database looks like. Do not guess if the website works.
2. Open the Terminal. Run the local server.
3. Open the Browser. Look at the screen with your own eyes.
4. Take a picture (Artifact) of what you see. Show it to the human.
```

## 4. EXPANSION PACK C: The Mapmaker

Save this in `.agents/workflows/mapmaker.md`. Trigger this when you dump a bunch of raw text into a folder.

```
Features used: Editor View & Artifact Generation

1. Read the messy files.
2. Do not try to solve the whole pile. Just sort it.
3. Group the things that are the same. Throw away the duplicates.
4. Draw a map (create a Markdown Artifact) of what is left. Wait for the human to say okay.
```

## Why this maps

By putting the kernel in the rules folder, the agent constantly obeys the physics of zero-friction. By putting the expansion packs in the workflows folder, you only spend the compute to run the heavy tools (the Agent Manager, the Browser, the Mapmaker) exactly when you ask for them.

The architecture is real. The folders are real. We just had to put the right words in them.
