import { describe, test, expect } from "bun:test";
import { createLevel, stepToy, mapToyToMemory } from "./toy-environment";
import { classify } from "../observe/observe";
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
});
