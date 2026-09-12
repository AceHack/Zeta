// stderr.ts — ace's ONE diagnostic-output door.
//
// WHY THIS EXISTS. `console.error` is not a byte-exact primitive: Bun styles its
// stderr output in ANSI red (`\u001b[0m\u001b[31m…\u001b[0m`) and Node does not, and
// Bun does it even when stderr is a PIPE rather than a TTY. So the *same* ace source
// emitting the *same* message produces different bytes on the two runtimes. That is
// precisely the divergence `ace-node-runtime-parity.test.ts` exists to catch, and it
// made that test red on `main`: the message text was byte-identical, the colour codes
// were not.
//
// The fix is at the PRODUCER, never at the assertion. Stripping ANSI inside the test
// would weaken a comparison whose whole value is that it is raw — it would hide the
// next, real divergence along with this cosmetic one.
//
// `process.stderr.write` is the un-styled path: neither runtime decorates bytes handed
// to the stream directly. It is already the established stderr idiom elsewhere in
// `src/Core.TypeScript/`, so this helper adopts the house pattern rather than inventing
// one — it only makes ace's use of it singular, so there is exactly one place a future
// styling decision could enter.
//
// FAITHFULNESS. `console.error(msg)` appends a trailing newline; so does this. Every
// one of ace's call sites passes a SINGLE string argument (measured, 156 of 156), so
// the multi-argument space-joining behaviour of `console.error` is not something any
// caller depends on and is deliberately not reproduced — a caller that needs it should
// build the string itself, where the join is visible.

/**
 * Write one diagnostic line to stderr, byte-identically under Bun and under Node.
 *
 * Use this instead of `console.error` everywhere in ace. A trailing newline is
 * appended, matching `console.error`'s behaviour; nothing else is added.
 */
export function aceErr(message: string): void {
  process.stderr.write(message + "\n");
}
