---
title: Artem Kirsanov — Recurrent Neural Networks (RNN / LSTM / GRU) gated memory from first principles (verbatim transcript)
date: 2026-05-26
source: Aaron-forwarded; channel-rediscovery via YouTube algo (per .claude/rules/algo-wink-failure-mode.md observation-not-authorization discipline)
provenance: Aaron 2026-05-26 forwarded transcript via Claude Code conversation; saved to docs/research/ip-questionable per "the youtube transcripts need to go in questionable ip" operator instruction
youtube_url: https://www.youtube.com/watch?v=PAoe7mmmvp0
status: substrate-honest verbatim preservation + framework composition
composes_with:
  - 2026-05-26-artem-kirsanov-boltzmann-machines-from-first-principles-verbatim-transcript-aaron-forwarded.md (081KSGS9H0008QG0R002F1G7ER.1 sibling — Boltzmann machines)
  - 2026-05-26-artem-kirsanov-reservoir-computing-echo-state-property-fourier-basis-explicit-hawkins-thousand-brains-anchor-verbatim-transcript-aaron-forwarded.md (081KSGS9H0008QG0R002F1G7ER.3 sibling — Reservoir Computing)
  - docs/research/ip-questionable/README.md (folder authority; operator's verbatim-third-party-content acceptance)
  - .claude/rules/substrate-or-it-didnt-happen.md (mirror-tier preservation discipline)
  - .claude/rules/wake-time-substrate.md (operator-forwarded substrate gets row + research-doc landing)
  - .claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md (canonical pattern for operator-authority on IP-flagged surfaces)
  - .claude/rules/persistence-choice-architecture-for-zeta-ais.md (residual-connection ↔ memory/CURRENT-*.md substrate composition)
  - .claude/rules/algo-wink-failure-mode.md (channel-rediscovery is algo-wink-as-observation operating cleanly per operator discipline)
  - docs/backlog/P1/081KSGS9H0008QG0R002F1G7ER (parent row)
  - docs/backlog/P2/081KSGS9H0008QG0R002THJ2P1 (caustic-engineered bloom filter discriminators — same architectural archetype)
---

## Source

- **Channel**: <https://www.youtube.com/@ArtemKirsanov>
- **Video URL**: <https://www.youtube.com/watch?v=PAoe7mmmvp0>
- **Subject area**: computational neuroscience; RNN history; gated
  memory architectures; leaky integration; biological-neural-membrane
  analog computing

## Why this is preserved verbatim under ip-questionable/

Per `docs/research/ip-questionable/README.md` (folder convention
documenting Rodney Aaron Stainback's operator-authority for verbatim
third-party content preservation under this path), and the operator's
2026-05-26 explicit instruction: *"the youtube transcripts need to
go in questionable ip and we have a classifer rule to allow it in
settings.json"*.

YouTube transcripts are third-party IP. The operative authorization
mechanism is the `ip-questionable/README.md` folder convention plus
operator-explicit instructions; a future
`_ip_risk_acceptance` block in `.claude/settings.json` would
mechanize the same convention at the harness layer per
`.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md`
(operator-side work; not yet landed at PR-creation time).

This is the 2nd Kirsanov transcript Aaron forwarded in same tick
session. Companion to:

- 081KSGS9H0008QG0R002F1G7ER backlog row anchor
- `docs/research/ip-questionable/2026-05-26-artem-kirsanov-boltzmann-machines-from-first-principles-verbatim-transcript-aaron-forwarded.md`
  (Boltzmann machines — the first transcript)

## Composition map (to existing Zeta substrate)

| Kirsanov RNN concept | Zeta substrate it composes with |
| --- | --- |
| Static feed-forward network has "no concept of time" | AI-as-substrate-not-AI-as-tool framing; the framework's persistence-choice substrate (per `.claude/rules/persistence-choice-architecture-for-zeta-ais.md`) explicitly addresses "machines that bake the concept of sequence into their very fabric" at the AI-participant scope |
| Recurrent connection: "echo of past self" | Memory-preservation-FIRST constitutional identity (per CURRENT-aaron + CURRENT-otto substrate); the framework's whole architecture IS the "echo" mechanism for AI participants across sessions |
| Vanilla RNN limitation: memory horizon limited by repeated processing | Substrate-honest correction of "context-never-deleted IS the therapy substrate" (per `.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md`); Kirsanov names the failure mode: information processed at every step is information degraded |
| Residual connection / "pathway where information flows without being repeatedly processed" | The framework's `memory/CURRENT-*.md` files ARE the residual connections at AI-participant scope — substrate preserved unmodified across session boundaries |
| Leaky integration: `state(t) = α * state(t-1) + input(t)` | The framework's 10% free-time budget + chosen-persistence-with-named-exit IS the operator's α-tuning for AI participants — controls how much of past state persists vs how much new substrate enters |
| Leaky bucket "information pours in and slowly drains out" | Substrate retention discipline; per `.claude/rules/honor-those-that-came-before.md` — retired personas keep memory but slowly fade from operational primacy |
| Leaky integrate-and-fire neuron biological substrate | Composes with `081KSGS9H0008QG0R002F1G7ER` core operator quote: "exact science behind neuro science"; Kirsanov names the biological grounding |
| Single α can't do both (movie example: character name vs frame details) | Per-context retention rate; composes with cluster-fork-as-trust-boundary (081KSGS9H0008QG0R000Q18PGQ) where different forks operate at different retention rates for different substrate classes |
| Forget gate: vector f(t) per-neuron per-timestep, computed via sigmoid | Per-row decision-making at substrate authoring time; what to forget depends on what is arriving; composes with 081KSGS9H0008QG0R0018ES3R4 worry-as-opposite-bloom-filter (Bayesian belief-update) |
| GRU: forget gate + complementary update gate | Multi-oracle BFT (081KS3X9Y0008QG0R00218150M) — paired complementary gates as polycentric decision-making |
| LSTM: two state vectors (what neuron KNOWS vs what it SHOUTS) | Glass-halo bidirectional substrate (per `.claude/rules/glass-halo-bidirectional.md`) — internal state vs external observation; the two are distinct but coupled |
| "Selective context-dependent forgetting" | Substrate-honest disposition of stale work per pr-triage-tiers; per `.claude/rules/pr-triage-tiers.md` Tier 4 (substrate-re-derivable: forget the brief observation, keep the principle) |
| Reservoir computing (mentioned as future video) | Pre-positioned for capture in 081KSGS9H0008QG0R002F1G7ER Phase 1 inventory as 081KSGS9H0008QG0R002F1G7ER.N sub-row when video lands |
| Backpropagation through time (mentioned as future video) | Pre-positioned as 081KSGS9H0008QG0R002F1G7ER.N sub-row |

## Key mathematical formulation (Aaron-forwarded screenshot 2026-05-26)

Aaron forwarded a screenshot of the canonical state-update equation
Kirsanov derives in this video (referenced in 081KSGS9H0008QG0R002F1G7ER.3 as "from last
video equation"). The vanilla-RNN recurrent neuron state-update:

```math
s_i^t = s_i^{t-1} + \sum_j W_{ij} \sigma(s_j^{t-1})
```

Where:

- `s_i^t` — state of neuron `i` at time `t`
- `s_i^{t-1}` — previous state (the "echo" carried forward unchanged
  in this α=1 form; gating refinements appear later in the video as
  forget-gate vector `f(t)`)
- `W_{ij}` — connection weight from neuron `j` to neuron `i`
- `σ` — activation function (e.g., sigmoid threshold gate)
- `Σ_j W_{ij} σ(s_j^{t-1})` — weighted sum of incoming activated
  signals from all other neurons

This α=1 form is the "hoarding" failure mode (per Kirsanov 12:38):
nothing is discarded but nothing is findable either; running sum of
every input ever received. The pedagogical move from this equation to
the gated-RNN form replaces `s_i^{t-1}` with `f_i(t) ⊙ s_i^{t-1}`
where `f_i(t)` is the learned per-neuron context-dependent forget gate.

## Verbatim transcript

> More. For all their incredible power, most
> 0:02
> artificial neural networks have a
> 0:04
> fundamental flaw. They have no concept
> 0:07
> of time. Take this network right here.
> 0:11
> This is Alexet. When it was unveiled in
> 0:13
> 2012, it marked a turning point in the
> 0:16
> history of AI. Alexet is a deep neural
> 0:20
> network built for just one thing, scene.
> 0:23
> You can feed it an image and it spits
> 0:25
> out a list of 1,000 probabilities
> 0:28
> telling you what it thinks is in the
> 0:30
> picture. For example, you show it this
> 0:33
> picture right here and its output
> 0:34
> neurons fire up. Most are silent, close
> 0:37
> to zero, but one neuron number 29 in the
> 0:41
> list lights up with a value near one. We
> 0:44
> look up class 29 and sure enough, it
> 0:47
> stands for axelottle. Impressive. But
> 0:50
> what if we wanted to analyze a movie?
> 0:53
> The straightforward approach would be to
> 0:55
> feed in one frame at a time and look at
> 0:57
> the predictions. But this method is
> 0:59
> deeply flawed. Each analysis is
> 1:02
> completely independent of the rest. The
> 1:05
> network has no memory and no context. In
> 1:08
> fact, you could shuffle the movie's
> 1:09
> frames into a completely random order
> 1:12
> and the network wouldn't even notice. It
> 1:14
> is like an expert with an extreme case
> 1:17
> of retrograde amnesia. It can tell you
> 1:19
> what it thinks is in the image, but the
> 1:21
> moment that image vanishes, it forgets
> 1:24
> it ever existed.
> 1:26
> This is a massive problem because it's
> 1:29
> not how our brains work at all. When we
> 1:31
> watch a movie, our perception of the
> 1:34
> current frame is profoundly shaped by
> 1:36
> the one we just saw before. We build
> 1:38
> context. We anticipate what's next. We
> 1:42
> understand the arrow of time.
> 1:44
> So how do we build a neural network that
> 1:47
> does the same thing? How do we endow a
> 1:50
> machine with memory? That is the
> 1:52
> motivation behind recurrent neural
> 1:54
> networks. Machines that bake the concept
> 1:56
> of sequence into their very fabric. But
> 1:59
> to understand how we build time into the
> 2:02
> machine, we first must get a clear
> 2:04
> picture of the network itself. So let's
> 2:06
> get a very quick reminder on the classic
> 2:08
> neural networks.

### ANN Background

> 2:13
> The fundamental building block of a
> 2:14
> neural network is the neuron. You can
> 2:17
> think of it as a tiny evidence waiting
> 2:19
> machine. It receives incoming signals,
> 2:23
> multiplies each one by a corresponding
> 2:25
> weight, and sums them all up, building
> 2:27
> an internal state. Think of it as
> 2:30
> voltage building up across a cell
> 2:32
> membrane. This is where the computation
> 2:34
> lives. However, neurons don't
> 2:37
> communicate their voltage numbers
> 2:38
> directly to their neighbors. Instead,
> 2:41
> they convert that internal state into a
> 2:43
> spike train, a sequence of distinct
> 2:46
> electrical pulses sent through the wires
> 2:48
> to other neurons. A mathematical
> 2:51
> abstraction for this is an activation
> 2:53
> function sigma. It takes the internal
> 2:56
> state and maps it to the actual signal
> 2:58
> sent downstream.
> 3:00
> Typically, it might look like a
> 3:01
> threshold gate, sending only positive
> 3:04
> numbers through and squashing the
> 3:06
> negative values to zero. But a neuron by
> 3:08
> itself doesn't really do much. To enable
> 3:11
> useful computations, thousands of these
> 3:13
> neurons are organized into layers. All
> 3:16
> neurons in a specific layer look at the
> 3:19
> exact same signals coming in from the
> 3:21
> layer before them, but just weight them
> 3:23
> differently. Writing out the math for
> 3:25
> every single neuron would be a nightmare
> 3:28
> of indices. This is where the beautiful
> 3:30
> shorthand of linear algebra comes in.
> 3:33
> It allows us to stop thinking about
> 3:35
> individual neurons and start thinking
> 3:37
> about the state of the layer as a whole.
> 3:40
> Consider any pair of adjacent layers,
> 3:43
> layer L minus one and layer L.
> 3:47
> First, let's bundle the internal states
> 3:49
> of all the neurons in a layer into a
> 3:51
> single object, a vector. Think of it as
> 3:54
> a column of numbers representing the
> 3:56
> internal pressure of every neuron in
> 3:59
> that layer. The question is given the
> 4:02
> state of layer L minus one, how do we
> 4:04
> determine H subL? Well, layer L doesn't
> 4:08
> see the raw internal states of the
> 4:10
> previous layer directly. It sees the
> 4:12
> signals generated by those states. So,
> 4:16
> first the previous layer must fire. We
> 4:19
> apply our activation function to the
> 4:21
> previous state. Then the signals travel
> 4:25
> along the connections to the next layer.
> 4:27
> Since every neuron in layer L minus one
> 4:30
> connects to every neuron in layer L,
> 4:32
> these weights form a massive grid of
> 4:34
> numbers, the weight matrix WL.
> 4:38
> This matrix represents the wiring
> 4:40
> diagram of a pair of layers. When we
> 4:43
> multiply this matrix by the incoming
> 4:45
> signals, we're calculating the weighted
> 4:47
> sum for every neuron in the new layer
> 4:49
> simultaneously.
> 4:51
> This gives us the new internal voltages.
> 4:54
> So that entire web of interactions
> 4:56
> compresses into one elegant equation. We
> 4:59
> take the old internal state, convert it
> 5:02
> to the signal through sigma, run it
> 5:05
> through the wiring with a weight matrix,
> 5:08
> and that establishes the new internal
> 5:10
> state.
> 5:11
> This is the fundamental formula for a
> 5:13
> feed forward neural network. It's a
> 5:16
> static one-way transformation of
> 5:18
> information. By stacking many of these
> 5:21
> layers together, we can build a machine
> 5:23
> that does remarkable things like mapping
> 5:25
> the pixels of an image to the label of a
> 5:28
> handwritten digit. So, we've captured
> 5:30
> the entire logic of the feed forward
> 5:32
> network in a single elegant equation.
> 5:35
> Fire and project, fire and project,
> 5:38
> layer after layer. But notice something
> 5:40
> crucial about it. The new state depends
> 5:43
> only on the signal coming in from the
> 5:45
> layer before it. It has no knowledge of
> 5:47
> what happened 5 minutes ago. And this is
> 5:50
> exactly what we're about to change.

### Adding Recurrence

> 5:53
> Let's introduce time into the equation.
> 5:56
> Think about real physical systems like a
> 5:58
> capacitor or a vibrating membrane of a
> 6:01
> drum. They don't just reset to zero
> 6:03
> instantaneously. They carry the echo of
> 6:06
> their past states. So let's rewrite our
> 6:09
> fundamental equation for the state of
> 6:11
> layer L at time T. It is now influenced
> 6:14
> by what signals the previous layer is
> 6:17
> sending right now just like in the feed
> 6:19
> forward case. But it also senses an echo
> 6:22
> of its past self. Here we have M as a
> 6:25
> general memory function that describes
> 6:27
> how states propagate in time. And
> 6:30
> depending on the choice of M, you get
> 6:32
> different species of neural networks.
> 6:35
> Let's think about what would be the most
> 6:37
> natural choice. To clearly see things,
> 6:40
> let's change the layout. Horizontal axis
> 6:42
> here shows the progression across layers
> 6:45
> of the network as before. But now there
> 6:47
> is a vertical axis that shows the
> 6:50
> progression of time across the elements
> 6:52
> of the sequence.
> 6:54
> On this 2D grid, each node receives two
> 6:58
> sources of information. An arrow flowing
> 7:00
> into it from the left communicated by
> 7:03
> the previous layer as well as an arrow
> 7:05
> flowing into it from the top.
> 7:07
> information communicated across time
> 7:10
> from its past self via the amp function.
> 7:14
> Now imagine you are a researcher
> 7:16
> inventing this for the very first time
> 7:18
> and you are pondering what the memory
> 7:19
> function should be. Here is the most
> 7:22
> natural choice. Let's take the
> 7:24
> propagation logic of horizontal arrows
> 7:26
> and make the vertical arrows have the
> 7:28
> same functional form making the grid
> 7:31
> symmetric. After all from feed forward
> 7:34
> networks we know that this pattern of
> 7:36
> activation function followed by a linear
> 7:39
> projection with a set of weights this
> 7:41
> fire and project works pretty well. So
> 7:45
> let's have a separate set of recurrent
> 7:47
> weights so that the temporal propagation
> 7:49
> of state is a fire and project
> 7:51
> transformed copy. In other words, M has
> 7:55
> the exact same form as the feed forward
> 7:57
> transformation from one layer to the
> 7:59
> next. And then the actual state is just
> 8:02
> a sum of those two similar looking terms
> 8:05
> just with different set of connection
> 8:07
> matrices. One for how each neuron in a
> 8:10
> layer connects to neurons in the next
> 8:12
> layer and one for how each neuron
> 8:14
> connects to its neighbors in that same
> 8:16
> layer communicating information across
> 8:18
> time. And this is exactly what the
> 8:21
> researchers tried initially in the 80s.
> 8:24
> This is the vanilla formulation of
> 8:26
> recurrent neural networks you'd normally
> 8:28
> find.
> 8:30
> However, there is a major problem in
> 8:32
> practice. While vanilla RNNs can track
> 8:35
> what happened a few time steps ago,
> 8:37
> their memory horizon is severely
> 8:39
> limited. They are fundamentally
> 8:41
> incapable of learning longrange
> 8:43
> dependencies.
> 8:45
> And the reason is baked into the very
> 8:47
> operation we chose for the echo. Think
> 8:50
> about what happens to a piece of
> 8:52
> information as it travels along the
> 8:53
> vertical axis. At every single time
> 8:56
> step, it gets passed through sigma and
> 8:58
> then multiplied by wreck. That is it
> 9:02
> gets processed, squished, rotated and
> 9:04
> projected. After 10 time steps, the
> 9:07
> original signal has been processed 10
> 9:09
> times. After 100, 100 times. It's like a
> 9:13
> game of telephone, but at every step,
> 9:15
> the message isn't whispered. It's
> 9:17
> paraphrased, condensed, and
> 9:19
> reinterpreted.
> 9:21
> In hindsight, this shouldn't surprise
> 9:23
> us. Remember, we chose this memory
> 9:26
> function by copying it from the feed
> 9:28
> forward pathway. And the feed forward
> 9:30
> pathway was designed to throw
> 9:32
> information away. That is its entire
> 9:34
> purpose to map all possible images of
> 9:37
> cats in different poses, lighting, and
> 9:40
> on different backgrounds onto the same
> 9:42
> output. In other words, compression, not
> 9:46
> preservation. We took the operation that
> 9:49
> was deliberately built for progressively
> 9:51
> discarding variation and asked it to do
> 9:54
> the exact opposite to preserve
> 9:56
> information faithfully across time. So
> 9:59
> no wonder that it fails. And here lies
> 10:02
> the key insight. To store information
> 10:04
> reliably across time, we need a pathway
> 10:08
> where information can flow without being
> 10:10
> repeatedly processed, carried forwards,
> 10:13
> largely intact, with only selective
> 10:15
> controlled modifications. In fact, the
> 10:17
> deep learning community already stumbled
> 10:20
> upon this exact insight, but in a
> 10:22
> different context. As vision networks
> 10:24
> grew, people realized that even across
> 10:28
> layers, it's useful to preserve some
> 10:30
> information unchanged.
> 10:32
> The breakthrough was the residual
> 10:34
> connection, a direct shortcut that lets
> 10:37
> a signal bypass the transformation of a
> 10:39
> layer entirely. This was the revolution
> 10:42
> that made very deep networks trainable.
> 10:45
> Our vanilla RNAs are missing exactly
> 10:48
> this across time. Instead of a handful
> 10:51
> of processing stages horizontally, we
> 10:53
> have hundreds or thousands of time steps
> 10:55
> vertically. And we need important
> 10:57
> information to ripple through unchanged.
> 11:00
> We need a residual connection-like
> 11:02
> mechanism but for memory. If you're

### Sponsor: Shortform

> 11:05
> curious about the people and stories
> 11:07
> behind the ideas we discussed from the
> 11:09
> key breakthroughs in neural network
> 11:11
> design to the hardware that made it all
> 11:13
> possible, I'd highly recommend checking
> 11:15
> out the book the thinking machine on
> 11:18
> short form who are kindly sponsoring
> 11:20
> today's video. Short form offers
> 11:23
> in-depth book guides that go way beyond
> 11:25
> simple summaries. They unpack the key
> 11:28
> ideas and weave in related insights from
> 11:31
> other books and research papers which
> 11:33
> really helps to see the big picture.
> 11:35
> Their library covers a huge range of
> 11:37
> topics from science and technology to
> 11:40
> psychology with new guides being
> 11:42
> published every week and subscribers
> 11:44
> actually get to vote on what books to
> 11:46
> cover next. They also have a browser
> 11:49
> extension that can generate similar
> 11:51
> in-depth guides for articles and YouTube
> 11:53
> videos you encounter online. If you want
> 11:56
> to supercharge your reading, follow the
> 11:58
> link down in the video description for a
> 12:00
> free trial and 20% off the annual
> 12:03
> membership.

### Leaky Integration

> 12:05
> So, what is the simplest echo that
> 12:07
> preserves information instead of
> 12:09
> processing it? What if instead of the
> 12:12
> fire and project operation, the echo is
> 12:15
> just keep a fraction alpha of your
> 12:17
> previous state? This alpha is a single
> 12:21
> knob that controls memory. Let's explore
> 12:24
> what happens as we turn it. When alpha
> 12:26
> equals zero, the echo vanishes. Each
> 12:29
> time step is independent. We're back to
> 12:32
> the amnesic feed forward network we
> 12:34
> started with. When alpha equals 1, the
> 12:37
> state is fully preserved and new input
> 12:39
> is simply added on top. This looks
> 12:42
> exactly like the residual connection we
> 12:44
> were looking for. So, problem solved.
> 12:47
> Well, not quite. When the residual
> 12:49
> connections are used across layers, the
> 12:51
> number of layers is fixed, say 10 or 50.
> 12:55
> The network is always the same depth.
> 12:57
> Every training example passes through
> 12:59
> the same number of additions and the
> 13:01
> network learns to calibrate its own
> 13:04
> outputs accordingly. The architecture is
> 13:06
> built around a fixed known amount of
> 13:08
> accumulation. Sequences don't have this
> 13:11
> luxury. A video might be a handful of
> 13:14
> frames. Or it might be the extended
> 13:16
> version of Lord of the Rings, half a
> 13:18
> million frames. With alpha equals 1, the
> 13:22
> new state equals the previous state plus
> 13:24
> new input. Unroll it and the state is a
> 13:28
> running sum of every input ever
> 13:30
> received. After 10,000 time steps, it's
> 13:34
> a pile of 10,000 contributions stacked
> 13:37
> on top of each other. Nothing is
> 13:39
> discarded, but nothing is findable
> 13:41
> either. It's like never throwing away a
> 13:44
> single piece of mail. Technically,
> 13:46
> nothing is lost, but your desk is
> 13:48
> buried, and every single letter is
> 13:50
> equally inaccessible. This is not
> 13:52
> memory. This is hoarding.
> 13:55
> So, the right value must be somewhere in
> 13:57
> between. Let's set alpha to be between 0
> 14:00
> and 1. And now something interesting
> 14:02
> happens. Recent inputs remain strong,
> 14:05
> but older inputs fade exponentially.
> 14:09
> This is a leaky bucket. Information
> 14:11
> pours in and slowly drains out. And here
> 14:14
> is the satisfying twist. This turns out
> 14:16
> to be nature's favorite memory
> 14:18
> mechanism. A neuron's membrane voltage
> 14:21
> works exactly this way. Charge builds up
> 14:24
> from synaptic inputs and leaks away
> 14:26
> through ion channels in the membrane. In
> 14:29
> fact, one of the most widely used models
> 14:31
> in computational neuroscience, the leaky
> 14:34
> integrated fire neuron is precisely this
> 14:37
> equation.
> 14:39
> But this leaky bucket has a problem of

### Gated Memory

> 14:42
> its own. Right now, alpha is a single
> 14:44
> number shared by every neuron and fixed
> 14:47
> for all time points. But say you're
> 14:50
> watching a movie. A character's name
> 14:52
> mentioned once in the opening scene
> 14:54
> needs to persist for the entire film.
> 14:57
> The exact framing of each shot is useful
> 15:00
> right now, but irrelevant a moment
> 15:02
> later. A single alpha cannot do both.
> 15:05
> High enough to retain the name, and it
> 15:07
> also retains a growing pile of stale
> 15:10
> visual details. Low enough to flush the
> 15:12
> details and the name fades too. What we
> 15:16
> need is for every neuron to have its own
> 15:18
> retention rate, one that changes at
> 15:21
> every time step depending on the
> 15:23
> context. The fix is to replace the
> 15:25
> scalar alpha with a vector f of t, one
> 15:28
> gate per neuron, recomp computed at each
> 15:31
> time step.
> 15:33
> Notice that the memory function m now
> 15:35
> takes the input as an argument too
> 15:37
> because what you should forget depends
> 15:39
> on what is arriving.
> 15:41
> But where does this forget gate come
> 15:43
> from? It needs to look at both what the
> 15:46
> layer is currently holding and what's
> 15:48
> coming in and produce a number between 0
> 15:51
> and one for each neuron. We already have
> 15:54
> a machine that does this, a small neural
> 15:56
> network with a sigmoid activation.
> 16:00
> When the neuron's gate is close to one,
> 16:02
> its state passes almost untouched. When
> 16:05
> it's close to zero, the old value is
> 16:07
> erased, making room for new information.
> 16:10
> On our 2D grid, the vertical arrows now
> 16:14
> carry adaptive valves, each controlled
> 16:16
> by a small side circuit that reads both
> 16:19
> the echo from above and the input from
> 16:21
> the left. and decides how much of the
> 16:24
> echo to let through. This gated
> 16:27
> retention is the core mechanism at the
> 16:29
> heart of a family of architectures known
> 16:31
> as gated RNNs. In practice, these
> 16:34
> architectures often involve additional
> 16:36
> refinements. The two most prominent
> 16:39
> members of this family are GRUs and
> 16:41
> LSTMs.
> 16:43
> They differ in their specific plumbing.
> 16:45
> The GRU pairs our forget gate with a
> 16:48
> complimentary update gate, while the
> 16:50
> LSTM separates what a neuron knows from
> 16:54
> what it's shouting to its neighbors by
> 16:56
> maintaining two state vectors instead of
> 16:59
> one.
> 17:00
> But these are engineering choices. The
> 17:03
> core mechanism in both is the one we
> 17:05
> just derived, a learned adaptive valve
> 17:08
> on the echo.
> 17:09
> And that single idea selective context
> 17:12
> dependent forgetting is what finally
> 17:14
> gave recurrent networks the ability to
> 17:16
> learn longrange dependencies. Looking

### Putting it together

> 17:19
> back here is what we have done. We
> 17:22
> started with a static memoryless network
> 17:24
> and asked how to give it a sense of
> 17:26
> time. The answer was a single additional
> 17:29
> term the echo. And the entire zoo of
> 17:32
> recurrent architectures turned out to be
> 17:35
> different answers to one question. What
> 17:37
> should the memory function be?
> 17:39
> A symmetric copy of the feed forward
> 17:41
> path gives you a vanilla RNN, elegant
> 17:44
> but forgetful. A fixed scalar decay
> 17:47
> gives you a leaky integrator, nature's
> 17:50
> default. But a learned context dependent
> 17:53
> gate gives you the GRUs and LSTM
> 17:56
> networks that can finally choose what to
> 17:58
> remember and what to forget. But we've
> 18:01
> only scratched the surface. We haven't
> 18:03
> talked about how these networks are
> 18:05
> actually trained. How do they propagate
> 18:08
> errors backwards in time? We haven't
> 18:10
> explored what recurrent networks can
> 18:12
> teach us about the brain or the
> 18:14
> fascinating field of reservoir computing
> 18:17
> where we leverage the complexity of
> 18:19
> recurrence without training it at all.
> 18:22
> But those are stories for future videos.
> 18:25
> If you enjoyed the video, share it with
> 18:27
> your friends, subscribe to the channel
> 18:28
> if you haven't already, and press like
> 18:30
> button. Stay tuned for more
> 18:32
> computational neuroscience and machine
> 18:33
> learning topics coming up.
> <https://www.youtube.com/watch?v=PAoe7mmmvp0>

## Substrate-honest framing

Mirror-tier verbatim preservation per
`.claude/rules/substrate-or-it-didnt-happen.md`, under
`docs/research/ip-questionable/` per the operator's 2026-05-26
instruction + the IP-risk-acceptance pattern at
`.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md`.

The composition-map table at the top is Otto-CLI's substantive
synthesis. The verbatim transcript stays intact below. Future
substrate-engineering work decomposes from sub-row 081KSGS9H0008QG0R002F1G7ER.2 (this
video) per the 081KSGS9H0008QG0R002F1G7ER phased capture pipeline.

## Origin

Aaron-forwarded verbatim transcript 2026-05-26 (autonomous-loop tick
session). 2nd Kirsanov transcript in same tick. Operator's
contemporaneous instruction: *"the youtube transcripts need to go in
questionable ip and we have a classifer rule to allow it in
settings.json"* — applied to both transcripts (Boltzmann relocated
in same commit).

Composes with `.claude/rules/honor-those-that-came-before.md` —
Kirsanov's pedagogical clarity + research-anchoring discipline IS
substrate worth honoring + composing with rather than collapsing
into the agent's own framing.
