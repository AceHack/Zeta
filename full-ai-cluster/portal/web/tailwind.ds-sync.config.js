// Tailwind config for the claude.ai/design sync stylesheet ONLY (see repo-root
// .design-sync/). Same theme as the app; adds a safelist so utilities the
// design agent is likely to write exist even when the app doesn't use them —
// the synced stylesheet is the only CSS rendered designs receive.
import base from "./tailwind.config.js";

const TOKEN_COLORS =
  "background|surface|foreground|border|border-strong|input|ring|card|card-foreground|popover|popover-foreground|primary|primary-foreground|secondary|secondary-foreground|muted|muted-foreground|accent|accent-foreground|destructive|destructive-foreground|success|warning";

export default {
  ...base,
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../../.design-sync/previews/**/*.tsx"],
  safelist: [
    {
      pattern: new RegExp(`^(bg|text|border|ring|ring-offset|fill|stroke|divide)-(${TOKEN_COLORS})$`),
      variants: ["hover", "focus", "focus-visible", "disabled"],
    },
    {
      pattern:
        /^(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)-(0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|7|8|9|10|11|12|14|16|20|24|28|32)$/,
    },
    {
      pattern:
        /^(w|h)-(0|1|2|3|4|5|6|7|8|9|10|11|12|14|16|20|24|28|32|36|40|44|48|52|56|60|64|72|80|96|px|auto|full|screen|min|max|fit|1\/2|1\/3|2\/3|1\/4|3\/4)$/,
    },
    { pattern: /^(min-w|max-w)-(0|full|min|max|fit|xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|prose)$/ },
    { pattern: /^(min-h|max-h)-(0|full|screen|min|max|fit|64|96)$/ },
    { pattern: /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|left|center|right)$/ },
    { pattern: /^font-(normal|medium|semibold|bold|mono|sans)$/ },
    { pattern: /^(leading|tracking)-(none|tight|snug|normal|relaxed|loose|wide|wider)$/ },
    {
      pattern: /^(flex|inline-flex|grid|inline-grid|block|inline-block|hidden|relative|absolute|fixed|sticky|static)$/,
    },
    { pattern: /^flex-(row|col|row-reverse|col-reverse|wrap|nowrap|1|auto|initial|none)$/ },
    { pattern: /^(grow|shrink)(-0)?$/ },
    { pattern: /^(items|self)-(start|end|center|baseline|stretch)$/ },
    { pattern: /^(justify|content)-(start|end|center|between|around|evenly|stretch)$/ },
    { pattern: /^grid-cols-(1|2|3|4|5|6|12|none)$/ },
    { pattern: /^col-span-(1|2|3|4|5|6|full)$/ },
    { pattern: /^rounded(-((s|e|t|b|l|r|tl|tr|bl|br)-)?(none|sm|md|lg|xl|2xl|3xl|full))?$/ },
    { pattern: /^border(-(t|b|l|r|x|y))?(-(0|2|4))?$/ },
    { pattern: /^shadow(-(sm|md|lg|xl|2xl|none))?$/ },
    { pattern: /^(overflow|overflow-x|overflow-y)-(auto|hidden|scroll|visible)$/ },
    { pattern: /^(inset|top|bottom|left|right)-(0|1|2|3|4|6|8|auto)$/ },
    { pattern: /^z-(0|10|20|30|40|50)$/ },
    { pattern: /^(opacity)-(0|25|50|60|75|90|100)$/ },
    {
      pattern:
        /^(truncate|uppercase|lowercase|capitalize|underline|line-through|antialiased|italic|whitespace-nowrap|cursor-pointer|cursor-not-allowed|select-none|pointer-events-none|transition|transition-colors|transition-all)$/,
    },
    { pattern: /^animate-(fade-in|slide-in-right|scale-in|ping|pulse|spin)$/ },
    { pattern: /^(divide-x|divide-y)$/ },
    { pattern: /^(sr-only|not-sr-only)$/ },
  ],
};
