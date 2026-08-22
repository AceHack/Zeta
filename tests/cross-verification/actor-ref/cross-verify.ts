#!/usr/bin/env bun
// actor-ref cross-verify.ts — the harness oracle for the shared invalid class
// (081M00J1EWW). cwd = this directory. Exit non-zero if any row is accepted.
//
// WHY cross-verify.ts and not compare.ts: the oracles already live in
// actor-ref.test.ts (TS) and ActorRef.Tests.fs (F#). This file is the
// toolchain-free CI entry so `cross-verify-all.ts` does not treat the
// directory as an unchecked primitive. Adding a row to vectors.json with
// no parser change must exit 1 here.
import { readFileSync } from "node:fs";
import { parse, parseSpiffe } from "../../../src/Core.TypeScript/identity/actor-ref";

const vec = JSON.parse(readFileSync("vectors.json", "utf8")) as {
  invalid: readonly { input: string; door: "parse" | "parseSpiffe"; why: string }[];
};

if (!Array.isArray(vec.invalid) || vec.invalid.length === 0) {
  console.error("actor-ref cross-verify: vectors.json has no invalid rows");
  process.exit(1);
}

let accepted = 0;
for (const row of vec.invalid) {
  const door = row.door === "parseSpiffe" ? parseSpiffe : parse;
  try {
    door(row.input);
    console.error(`actor-ref cross-verify: ACCEPTED ${row.door} ${JSON.stringify(row.input)} (${row.why})`);
    accepted++;
  } catch {
    // rejected — the required verdict
  }
}

console.log(
  `actor-ref cross-verify: invalid=${vec.invalid.length}, ${accepted} accepted (want 0).`,
);
process.exit(accepted === 0 ? 0 : 1);
