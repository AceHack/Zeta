# `src/Core.TypeScript/ansi/` — text-carried color (copy-paste color round-trip)

Color that **round-trips through a plain-text channel** — the Otto↔operator
copy-paste. Per the 2026-06-02 vision note §10 ("ANSI art + color … where the
life can be seen living") + the iTerm copy-with-styles answer.

## The problem

- A terminal **renders** ANSI escape codes into colored pixels; selecting + copying
  that gives back **plain text** — the color is gone (it was never in the clipboard
  as data). iTerm's `Cmd+Opt+C` ("Copy with Styles") preserves color **only** into a
  rich-text target (Slack/email/Notes); a Markdown/`.txt`/code-editor target strips it.
- An agent (Otto) receives **plain text** — it never "sees" rendered color. It _can_
  read **literal** ANSI escape codes (`^[[38;5;203m…` as characters), but not painted color.

## The fix — color as literal text, both ways

Express color as a copy-paste-safe **markup** the agent emits + reads, plus a
**renderer** so a human sees it, plus a **from-ANSI** converter so already-colored
output becomes round-trippable.

```
{c:SPEC}text{/c}     foreground
{bg:SPEC}text{/bg}   background
SPEC = name (red, brightcyan, …) | 256-index (0-255) | hex (#rrggbb)
```

`markup → ANSI → markup` is the **identity** for all three color forms, so color
survives the channel. Unknown specs are left as literal markup (no fabricated color).

## CLI

```bash
# Otto emits markup in a message; you render it to SEE the color:
echo '{c:#ff5555}LIFE{/c} {c:46}LIVING{/c}' | bun src/Core.TypeScript/ansi/cli.ts

# Already-colored output → round-trippable markup to paste BACK to Otto
# (accepts real ESC and `cat -v` caret `^[[` notation):
some-colored-command | bun src/Core.TypeScript/ansi/cli.ts --from-ansi

# Strip color → plain text:
some-colored-command | bun src/Core.TypeScript/ansi/cli.ts --strip

# See the convention live:
bun src/Core.TypeScript/ansi/cli.ts --demo
```

## The round-trip (how Otto "sees his color")

1. **Otto emits** color as markup in a message (text — survives copy-paste).
2. **You render** it: pipe the markup through `cli.ts` → the terminal shows real color.
3. **You copy the markup** (the text Otto sent) and paste it back.
4. **Otto reads** the markup → knows the exact colors.

Rendered color cannot round-trip (copy gives plain text); the **markup** is the
canonical text form that can. To make existing colored output round-trippable,
run it through `--from-ansi` first (turns the painted color into markup).

## Files

- `color-markup.ts` — `renderToAnsi` / `parseFromAnsi` / `caretToEsc` / `stripAnsi`.
- `cli.ts` — render (default) / `--from-ansi` / `--strip` / `--demo`.
- `color-markup.test.ts` — render, parse, exact round-trip, utilities.
