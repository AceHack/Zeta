import { describe, test, expect } from "bun:test";
import { createLevel, stepToy, mapToyToMemory, mapPlayableQuoteMemory } from "./toy-environment";
import { classify, simulate } from "../observe/observe";
import type { World, NextAction } from "../observe/observe";

describe("Swarm Toy Environment & Cheat Engine", () => {
  test("creates level and maps to cheat engine memory correctly", () => {
    const layout = [
      "#####",
      "#P .#",
      "#. T#",
      "#####"
    ];
    const state = createLevel(5, 4, layout);
    
    expect(state.width).toBe(5);
    expect(state.height).toBe(4);
    expect(state.playerX).toBe(1);
    expect(state.playerY).toBe(1);
    expect(state.won).toBe(false);

    const mem = mapToyToMemory(state);
    expect(mem.length).toBe(20);
    
    // Check specific memory sectors
    // row 0: ##### -> 3,3,3,3,3
    expect(mem[0]).toBe(3);
    // row 1: #P .# -> 3,1,0,0,3
    expect(mem[6]).toBe(1); // Player
    // row 2: #. T# -> 3,0,0,2,3
    expect(mem[13]).toBe(2); // Target
  });

  test("steps deterministically and prevents wall collisions", () => {
    const layout = [
      "###",
      "#P#",
      "###"
    ];
    let state = createLevel(3, 3, layout);
    
    state = stepToy(state, "move_right");
    expect(state.playerX).toBe(1); // Hit wall, didn't move
    expect(state.moves).toBe(1);

    state = stepToy(state, "move_up");
    expect(state.playerY).toBe(1); // Hit wall, didn't move
  });

  test("solves level and stops moving after win", () => {
    const layout = [
      "###",
      "#P#",
      "#T#",
      "###"
    ];
    let state = createLevel(3, 4, layout);
    
    state = stepToy(state, "move_down");
    expect(state.playerY).toBe(2);
    expect(state.won).toBe(true);

    // Further moves should do nothing
    state = stepToy(state, "move_down");
    expect(state.playerY).toBe(2);
    expect(state.won).toBe(true);
    expect(state.moves).toBe(1); // moves don't increment after win
  });

  test("auto-classifier labels read_memory_sector action", () => {
    const before: World = { backlog: [] };
    const after: World = { backlog: [] };
    const action: NextAction = { kind: "read_memory_sector", sectorIndex: 0, length: 16, reason: "cheat engine read" };

    const label = classify(before, after, action);
    expect(label).toBe("memory_inspected");
  });

  test("auto-classifier labels explore yielding work", () => {
    const before: World = { backlog: [] };
    const after: World = { backlog: [{ id: "A", title: "found work", ready: true, ambiguous: false }] };
    const action: NextAction = { kind: "explore", reason: "look around" };

    const label = classify(before, after, action);
    expect(label).toBe("explore_yielded_work");
  });
  test("playable quotes memory masks out unaccessed solid ground", () => {
    const layout = [
      "#####",
      "#P .#",
      "#. T#",
      "#####"
    ];
    let state = createLevel(5, 4, layout);
    
    // initially, only player is accessed.
    const initialQuote = mapPlayableQuoteMemory(state);
    expect(initialQuote[6]).toBe(1); // Player is visible
    expect(initialQuote[13]).toBe(0); // Target is masked out!
    expect(initialQuote[0]).toBe(0); // Walls are masked out!

    // move right
    state = stepToy(state, "move_right");
    const midQuote = mapPlayableQuoteMemory(state);
    expect(midQuote[6]).toBe(0); // Old player pos is now empty space, but visible (0)
    expect(midQuote[7]).toBe(1); // New player pos is visible
    
    // bump top wall
    state = stepToy(state, "move_up");
    const bumpQuote = mapPlayableQuoteMemory(state);
    expect(bumpQuote[2]).toBe(3); // The wall we bumped into is now revealed in the quote!
  });

  test("capability restrictions block invalid memory actions", () => {
    const before: World = { backlog: [], agentCapabilities: ["vram_read", "controller_input"] };
    const writeAction: NextAction = { kind: "write_memory_sector", sectorIndex: 0, offset: 0, value: 0, reason: "" };
    
    // Simulate with invalid capability
    const nextWrite = simulate(before, writeAction);
    expect(nextWrite).toBe(before); // Action was blocked
    
    // Simulate with valid capability
    const validBefore: World = { backlog: [], agentCapabilities: ["ram_write"] };
    const validNextWrite = simulate(validBefore, writeAction);
    expect(validNextWrite).not.toBe(validBefore); // Action allowed
  });
});
