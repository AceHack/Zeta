#!/usr/bin/env bun
/**
 * src/Core.TypeScript/ansi/cli.ts — render/round-trip color markup ⇄ terminal ANSI.
 *
 * The copy-paste color round-trip (Otto↔operator), per the 2026-06-02 vision §10:
 *
 *   # Otto emits markup in a message; you render it to SEE the color:
 *   echo '{c:#ff5555}LIFE{/c} {c:46}LIVING{/c}' | bun src/Core.TypeScript/ansi/cli.ts
 *
 *   # Already-colored output → round-trippable markup you can paste back to Otto:
 *   some-colored-command | bun src/Core.TypeScript/ansi/cli.ts --from-ansi
 *   #   (also accepts `cat -v` caret notation, e.g. `^[[38;5;203m…`)
 *
 *   # Strip color → plain text:
 *   some-colored-command | bun src/Core.TypeScript/ansi/cli.ts --strip
 *
 *   # See the convention live:
 *   bun src/Core.TypeScript/ansi/cli.ts --demo
 *
 * Markup: {c:SPEC}…{/c} foreground, {bg:SPEC}…{/bg} background; SPEC is a name
 * (red/brightcyan/…), a 256-index (0-255), or hex (#rrggbb). Exact round-trip
 * for all three forms. Unknown specs are left as literal text (no fabricated color).
 */
import { renderToAnsi, parseFromAnsi, stripAnsi } from "./color-markup";
async function readStdin() {
    const chunks = [];
    for await (const chunk of Bun.stdin.stream())
        chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf8");
}
function demo() {
    const sample = "{c:#ff5555}LIFE{/c} {c:46}LIVING{/c} {c:cyan}menu{/c}={c:cyan}unem{/c} " +
        "{bg:#202020}{c:brightyellow} the life can be seen living {/c}{/bg}";
    const ansi = renderToAnsi(sample);
    return [
        "markup (what Otto emits / you paste back — round-trippable text):",
        "  " + sample,
        "",
        "rendered ANSI (what you SEE in the terminal):",
        "  " + ansi,
        "",
        "round-trip check (render → parse → markup):",
        "  " + parseFromAnsi(ansi),
    ].join("\n");
}
async function main(argv) {
    const args = argv.slice(2);
    if (args.includes("--demo")) {
        console.log(demo());
        return 0;
    }
    const input = await readStdin();
    if (args.includes("--from-ansi")) {
        process.stdout.write(parseFromAnsi(input));
        return 0;
    }
    if (args.includes("--strip")) {
        process.stdout.write(stripAnsi(input));
        return 0;
    }
    // default: render markup → terminal ANSI
    process.stdout.write(renderToAnsi(input));
    return 0;
}
if (import.meta.main) {
    void main(process.argv).then((code) => process.exit(code), (error) => {
        console.error(error);
        process.exit(1);
    });
}
