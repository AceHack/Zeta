# Design ethics — the rules a skin can never break

These are the load-bearing disciplines behind this design system. The conventions
header gives you the vocabulary; this page gives you the law. Everything here is
enforceable by one test: *does every visible mark still tell the truth?*

## 1. Skins recolor; skins never remap meaning

The semantic layer is invariant: state cases (running / gated / failed), intent
colors (destructive / success / warning), and channel meanings are fixed. A theme or
per-audience skin may change **token values, glyph style, and motion feel** — it may
never change **what a mark means**. Recoloring "destructive" for a different palette
is a skin. Making "destructive" look friendly-neutral, or using a semantic color for
decoration, is deception. When in doubt: if a reader who learned the meaning under
one skin would be misled under another, the change is not a skin.

## 2. Frost is priced privacy, never decoration

A blurred surface (`backdrop-blur-*` over a translucent fill) means exactly one
thing: *something is here, and its content is deliberately withheld*. Clear is the
default state; frost is the earned exception. Use frost only for consent-gated
panels, redacted regions, and activity-visible-content-hidden indicators. Never use
blur as a styling flourish — decorative frost either fakes privacy that wasn't paid
for or camouflages real privacy among fakes, and both lie to the reader. (Dialog and
Sheet backdrops ship their own `bg-black/60 backdrop-blur-sm`; that is chrome, built
into the components.)

## 3. Quality per glyph beats dots per inch

Prefer the mark that carries more meaning over the mark that carries more pixels:
text over image, a labeled badge over an icon-only glyph, a sparse table over a
dense screenshot, real content over lorem. Every visual element must convey state or
information; anything that conveys nothing is removed, not styled. As definition
goes down, reader participation goes up — so when choosing between a plainer,
denser-in-meaning rendering and a flashier one, choose the plainer one.

## 4. Honest bounds are part of the design

When a view shows partial data, say so in the view ("24 of 32 shown"), never imply
completeness. Loading, error, and empty states are first-class designs, not
afterthoughts. A meter whose value is estimated shows that it is estimated. The
system this kit serves treats every unstated bound as a defect.
