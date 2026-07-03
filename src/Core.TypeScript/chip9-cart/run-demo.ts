#!/usr/bin/env bun
// run-demo.ts — compile a capture to a chip9 cart, execute it, verify it redraws itself.
import { compile, parseGrid, renderRows, verify } from "./capture";

const capture = `
77777770
00000700
00007000
00070000
00700005
77777770
22222222
`;
const grid = parseGrid(capture);
const cart = compile("z-glyph", grid);
const rawBytes = Math.ceil((cart.width * cart.height * 3) / 8);
console.log(`\nchip9-cart capture v1 — "${cart.name}" (${cart.width}x${cart.height}, 8 colors)`);
console.log(`cart: ${cart.romHex.length / 2} ROM bytes, ${cart.steps} instructions (raw pixels would be ${rawBytes} bytes)`);
console.log(`verify (re-execute + byte-compare golden render): ${verify(cart) ? "PASS" : "FAIL"}\n`);
for (const row of renderRows(cart)) console.log("  " + row.replace(/0/g, "."));
console.log("\nThe stored artifact is the PROGRAM (hex text), not pixels — it redraws itself on the treaty VM.");
console.log("v1 generator is the degenerate blit-list; 081KTH5N5ZJ upgrades it to real generators.\n");
