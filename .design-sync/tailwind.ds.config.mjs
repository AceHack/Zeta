// Design-sync Tailwind config: the app's config + a safelist so the compiled
// stylesheet carries the utility vocabulary a design agent composes with —
// not just the classes the app happens to use. Referenced by cfg.buildCmd.
import base from "../full-ai-cluster/portal/web/tailwind.config.js";

export default {
  ...base,
  safelist: [
    // Semantic token colors (bg/text/border/ring), incl. -foreground pairs and common opacity steps
    { pattern: /^(bg|text|border|ring)-(background|surface|foreground|card|popover|primary|secondary|muted|accent|destructive|success|warning|border|input|ring)(-(foreground|strong))?(\/(5|10|15|20|25|30|40|50|60|70|75|80|90|95))?$/ },
    { pattern: /^(bg|text|border)-(transparent|current|white|black)$/ },
    // Display + flex/grid layout
    { pattern: /^(flex|inline-flex|grid|block|inline-block|inline|hidden)$/ },
    { pattern: /^(flex-(row|col|wrap|nowrap|1|auto|initial|none)|grow(-0)?|shrink(-0)?)$/ },
    { pattern: /^(items|justify|content|self)-(start|end|center|between|around|evenly|stretch|baseline|auto)$/ },
    { pattern: /^grid-cols-(1|2|3|4|5|6|12|none)$/ },
    { pattern: /^col-span-(1|2|3|4|5|6|12|full)$/ },
    // Spacing
    { pattern: /^(gap|gap-x|gap-y|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|space-x|space-y)-(0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|7|8|9|10|11|12|14|16|20|24)$/ },
    { pattern: /^-(mt|mb|ml|mr|mx|my)-(1|2|3|4)$/ },
    // Sizing
    { pattern: /^(w|h)-(0|1|2|3|4|5|6|7|8|9|10|11|12|14|16|20|24|28|32|36|40|44|48|56|64|72|80|96|full|screen|auto|fit|min|max|px)$/ },
    { pattern: /^(size)-(3|3\.5|4|5|6|8|10|12|16)$/ },
    { pattern: /^(min-w|max-w)-(0|none|full|min|max|fit|xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|prose)$/ },
    { pattern: /^(min-h|max-h)-(0|full|screen|fit)$/ },
    // Typography
    { pattern: /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|left|center|right)$/ },
    { pattern: /^font-(normal|medium|semibold|bold|mono|sans)$/ },
    { pattern: /^(leading|tracking)-(none|tight|snug|normal|relaxed|loose|wide|wider|widest)$/ },
    { pattern: /^(truncate|whitespace-nowrap|whitespace-pre-wrap|break-words|break-all|uppercase|lowercase|capitalize|normal-case|italic|not-italic|underline|no-underline|line-through|antialiased|tabular-nums)$/ },
    // Borders, radius, shadows, rings
    { pattern: /^rounded(-(sm|md|lg|xl|2xl|3xl|full|none))?$/ },
    { pattern: /^rounded-(t|b|l|r)(-(sm|md|lg|xl|full))?$/ },
    { pattern: /^border(-(0|2|4|8|t|b|l|r|x|y))?$/ },
    { pattern: /^(divide-y|divide-x)(-(0|2|reverse))?$/ },
    { pattern: /^shadow(-(sm|md|lg|xl|2xl|inner|none))?$/ },
    { pattern: /^ring(-(0|1|2|4|8|inset|offset-1|offset-2))?$/ },
    // Position, z, overflow, misc
    { pattern: /^(absolute|relative|fixed|sticky|static)$/ },
    { pattern: /^(inset|inset-x|inset-y|top|bottom|left|right)-(0|1|2|3|4|6|8|auto|full)$/ },
    { pattern: /^z-(0|10|20|30|40|50|auto)$/ },
    { pattern: /^(overflow|overflow-x|overflow-y)-(auto|hidden|scroll|visible)$/ },
    { pattern: /^(opacity)-(0|10|20|25|40|50|60|70|75|80|90|100)$/ },
    { pattern: /^(cursor-pointer|cursor-default|cursor-not-allowed|select-none|pointer-events-none|sr-only|transition|transition-colors|transition-all|duration-150|duration-200|duration-300)$/ },
    // The DS's own keyframe animations + generic ones
    { pattern: /^animate-(fade-in|slide-in-right|scale-in|pulse|spin|none)$/ },
    // Frost channel (GlassHalo/RoomBoundary semantics): frost density = privacy-budget
    // spend rendered as backdrop blur; clear is the default, frosting is earned.
    { pattern: /^backdrop-blur(-(none|sm|md|lg|xl|2xl|3xl))?$/ },
    { pattern: /^blur(-(none|sm|md|lg|xl|2xl))?$/ },
    { pattern: /^backdrop-brightness-(50|75|90|100|110)$/ },
  ],
};
