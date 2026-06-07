# Evan Czaplicki — "Controlling Time and Space: Understanding the Many Formulations of FRP" (Elm, Strange Loop ~2014) — verbatim transcript (Aaron-forwarded)

**Source:** <https://www.youtube.com/watch?v=Agu6jipKfYw> (Evan Czaplicki, creator of Elm).
**IP status:** auto-caption transcript of a third-party talk — DO NOT republish externally (see this
folder's README; operator has accepted personal liability for the verbatim). Substrate value is the
framework-composition analysis below, not the reproduction.

## Framework-composition analysis (the substrate value — what this means for Zeta)

Czaplicki's FRP taxonomy maps cleanly onto Zeta's reactive / time-travel / DBSP substrate:

- **FRP taxonomy (two axes).** (1) *static* signal graphs (Elm, "first-order FRP") vs *dynamic* graphs;
  (2) infinite signals (Haskell higher-order FRP) vs finite event streams (imperative async-dataflow:
  Rx / Bacon / Reactive-Cocoa) vs neither (arrowized FRP: Yampa / netwire / Elm `automaton`).
- **Static signal graph ⇒ time-travel debugging + hot-swap + replay — this IS our Evolution / COW
  time-travel.** Elm's superpower ("we know the graph at startup, so we know it in an hour → replay history,
  hot-swap code across the whole history, no complex analysis") is exactly our **fork-root + replay-log-
  prefix + deterministic-replay** (DST) story, and the COW-store "alternate timelines" capability. Elm's
  hot-swap-with-history ≈ our schema-evolution-with-replay. The lesson Zeta already lives: *a known, static
  computation graph buys replay/branch/hot-swap for free.*
- **DBSP ≈ a static signal graph over Z-sets.** DBSP circuits are static dataflow graphs with **bounded
  incremental state** (`IndexedZSet`/`Aggregate`/`Residuated`). Elm's first-order FRP is the UI cousin of
  the same idea — static graph, event-driven push, look back only at previous state (efficiency property).
- **The "infinite look-back" hazard of higher-order `join` ↔ our retraction / bounded-state discipline.**
  Czaplicki: switching to a *new* signal may need unbounded history ("memory growth linear with time"),
  fixed only by restricting which signals you may switch to (linear-types / *bounded-space FRP*). Our
  analogue: a Z-set delta stream must keep **bounded** state; the **garbage-dump rollback horizon** and
  retraction are precisely "declare/bound the history you retain." Same hazard, same cure (declare the
  retained state).
- **Model / Update / View (the Elm Architecture) = fold-over-events.** Falls out of the static graph; it's
  the reducer/`fold` shape over our Log/Z-set, and ties to app-as-DynamicValue (model+update+view as data).
- **Synchrony-by-default, opt-in async ↔ our async-all-the-way + DoP knob.** Elm: synchronous ordering by
  default (type "hello" → events arrive in order), explicit asynchrony for I/O. Same stance as our
  deterministic-at-DoP=1, async-when-needed ferry discipline.
- **Push can model pull** (Czaplicki's Q&A) — relevant to how our incremental views drive output.
- **Anchor tie-in:** **Reaqtor / Rx / IObservable (Bart DeSmet)** — already a Zeta anchor (PRIOR-ART-LIST)
  — sits in the *async-dataflow* category of this taxonomy; DBSP is the *static-incremental-graph* relative.

Net: this talk is the FRP map that situates Zeta's choices — **static incremental graph (DBSP) + bounded
retained state (retraction/dump) + deterministic replay (DST) + opt-in async** — as a principled point in
the FRP design space, with Elm's static-graph time-travel as the human prior art for our COW time-travel.

## Beacon anchors

- **Evan Czaplicki** — Elm; *Controlling Time and Space* (Strange Loop); his thesis covers first-order &
  higher-order FRP history + citations. · **FRP** origins: Conal Elliott & Paul Hudak, *Functional Reactive
  Animation* (ICFP 1997). · **Arrowized FRP / Yampa** — Hudak, Courtney, Nilsson. · **Rx / IObservable** —
  Erik Meijer / Bart DeSmet (the async-dataflow category). · **Bounded-space higher-order FRP** (linear
  types). · **The Elm Architecture** (model/update/view) → Redux lineage. Ties: DBSP (Budiu et al.),
  our DST (FoundationDB lineage), the Evolution/COW time-travel capability.

---

## Verbatim transcript (lightly cleaned from auto-captions; Aaron-forwarded 2026-06-07)

I'm Evan Czaplicki — I designed the Elm programming language. Over the course of thinking about functional
reactive programming over the past couple years I've learned some things; this talk distills those years
into ~40 minutes so you don't have to go through the same thing I did. I went with "controlling time and
space" because at the time I was feeling like some kind of Time Lord with time travel — but the real focus
is understanding what FRP is. There's quite a lot of diversity about what that term really means.

Goals: understand what FRP is, how to categorize the different things under that umbrella, and how to
evaluate them. We start with what I'm calling **first-order FRP** (what Elm looks like), then branch into
variations that build on that core.

**First-order FRP (Elm).** When dealing with FRP we want a way to deal with interaction from the world —
a user typing, looking at things, key presses, mouse events — brought into a processing system. In Elm this
is the **signal graph**; in JavaScript it might be a tangle of callbacks. FRP gives time explicit structure
you can talk about concisely, then sends things back (show this on screen, send this HTTP request).

The key part of a signal graph is **inputs from the world** — e.g. `Mouse.position : Signal (Int, Int)` —
a mouse position changing over time; `Keyboard.lastPressed` — the last key, changing over time.

On top of inputs we **transform** with `lift` (a.k.a. map): take a `Signal a` and a function `a -> b`,
get a `Signal b`. Example: `isConsonant` over key presses → a signal of booleans. We handle a *time-varying
thing* rather than event callbacks.

Next, `foldp` ("fold from the past", like fold-left/right): give a starting state and an update function;
each event updates the state. Example: count key presses → 1, 2, 3, 4, 5… You can model a to-do app's state
this way.

`merge` takes two signals and merges them. `lift2` applies a function to two signals at any point in time
(e.g. combine x and y coordinates, or window dimensions + mouse). There's lift2..lift8 (stops at 8; go
higher via tricks). So: input from the world → transform → update state → merge — the signal graph.

**Core design properties:** signals are *connected to the world* (direct connection to mouse/keyboard);
signals are *infinite* (no deleting a signal — inputs are fixed); signal graphs are *static* (known
structure from startup into the future — a source of power); *synchronous by default* (type "hello" → those
letters show in order; branching structure maintains order).

**What we get:** *efficiency* (event-driven; stateful nodes look back only at previous state). *Architecture*
(every Elm program breaks into model / update / view). *Hot-swapping* (change the program — e.g. gravity in
the Mario demo — while it runs, changes propagate). *Time-travel debugger* (pause, go back in time, inspect
data like the arrows value; change code and it re-propagates across the whole history). A lot of these
abilities come from the static signal graph: if we know the program at start, we know it in an hour / a day,
with no complex analysis.

**Higher-order FRP** ("surely higher is better"): drop the static constraint via `join` — a `Signal` of
`Signals` (pick which one to listen to). Questions: what happens to signals not in use (keep running?
pause?); adding never-before-observed signals. Bad behavior: `clicks-or-zero` — switch true→counts clicks,
false→zero. After clicking 5, false (0), click 5 more, true again — should it be 0, 5, or 10? In purely
functional / equational-reasoning languages the answer is forced: `count mouse clicks` must equal `count
mouse clicks`, so it must be the full count → **creating a new signal may need infinite look-back; memory
growth is linear with time.** The fix isn't "switching is bad" but "only switch to signals with *safe*
amounts of history" — restrict `join` with a fancier type. E.g. *Higher-order Functional Reactive
Programming in Bounded Space* uses **linear types** so you can't write a program that looks back unless you
specifically say to save that information. Trade-offs: lose easy hot-swap, straightforward time-travel,
straightforward architecture; gain a more complex API/type system.

**Asynchronous data flow** (Rx, Reactive-Cocoa, Bacon.js — "FRP in an imperative language"): drop static
graphs, drop infinite signals (signals can *end*), drop synchronous-by-default (do synchrony yourself).
Uses `flatten`. Creating a signal makes a *totally new* one (so true→count→false→0→true→count restarts at
0); garbage-cleaned as you go. Question remains: what happens when no one's listening → **hot vs cold
signals** (hot keeps producing; cold stops).

**Arrowized FRP** (Yampa; netwire; Elm's `automaton`): drop static graphs, drop *connected-to-the-world*.
`pure` makes an automaton (a little robot: in → out, e.g. +1). State via a fold-like step. Chain automata
(`a→b` then `b→c`). Switching: each automaton holds its own state; because they're **not connected to the
world**, "what happens when removed?" answers itself — it doesn't keep running. So arrowized FRP is about
*structuring code* (a library for Elm/Haskell), in competition with plain functions/modules — ask whether
it benefits your domain (success in music, netwire).

**Taxonomy.** Broad: *static* vs *dynamic* graphs. Among dynamic: infinite signals (Haskell, higher-order)
vs finite event streams (imperative, async-dataflow) vs neither (arrowized). Elm spans all three colors —
not a competition, but different complementary points in a design space.

**Evaluating:** is it synchronous by default (ordering guarantees)? does it allow asynchrony (for I/O
without blocking everything)? can I talk about inputs (vs arrowized code-structuring)? can I reconfigure the
graph? The question isn't "fanciest words on the library" but **what properties does my application need** —
e.g. a server with 10 concurrent connections wants async-by-default; an app needing Elm's debugging tools
wants the static graph. Carry the debugging story through the whole life of the app. Does the code come out
nice — async-dataflow buys features at a complexity cost; can you live without it?

**Q&A highlights.** Why keep `count mouse clicks = count mouse clicks` in higher-order FRP rather than model
signals as effectful? — That's the async-dataflow (Rx/Bacon) choice; different trade-offs. Arrowized: you
design the dynamism in, then hook it up; stepping an automaton forward returns *the value + the new
automaton* (forking reality). Modularity in a to-do app: use a higher-order style, or (Czaplicki's
preference) the **module system + functions** — a `tasks` module (model/update/view) nested inside a
`to-do-list` module; not clear one way is superior. **Push vs pull:** Elm is push (push an update, it
propagates); pull = someone at the bottom samples values through the graph; a push system can model a pull
one (at the bottom, "pull" ≡ "trigger a push") — the distinction is less important than it sounds.
Back-pressure / too-much-data: UI deals with human input so it rarely arises; Elm is UI-focused, so it's
not the major focus.
