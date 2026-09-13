# Topological Intelligence — AI planning with persistent homology — ferried transcript

**Source video:** *"Topological Intelligence: AI Planning w/ Persistent Homology"* —
`https://www.youtube.com/watch?v=j0UA02K1I_I`
**Primary source it discusses:** *Topological Necessities: Mechanism-Invariant Strategic
Subgoals for Cross-Embodiment Goal-Conditioned Control* — **arXiv:2609.11014**,
`https://arxiv.org/abs/2609.11014`
**Ferried:** 2026-09-13, at Aaron's request (*"save this to ip questionable ... this is very
similar to what we are trying to do"*), with the paper list supplied as a second message.
**Status:** third-party transcript, preserved **verbatim and uncurated**. Not our words, not our
claims. Auto-captioned, so spellings are phonetic in places (*"homotropy"* for homotopy,
*"iconal"* for eikonal, *"puff integral"* for path integral, *"girdle"* for Gödel, *"uklidian"*
for Euclidean, *"EI"* for AI). Left as captured — a ferry is preserved, never tidied.

## Register: the paper is now READ — and it corrects me twice

Aaron supplied the paper itself (`arXiv:2609.11014v1 [cs.LG] 10 Sep 2026`, 60pp incl. proofs).
**Authors: Hao Shi and Xi Li**, Army Engineering University of PLA (Shijiazhuang Campus).
Code and data: `https://osf.io/wak7u/`. The anchor is therefore **read**, not merely located.

> **Register.** The PAPER is read. Claims about what it implies for *Zeta* remain **`toy`** —
> nothing here has been measured against our own trajectories.

The PDF is not committed (3.0 MB); the arXiv id is the locator, and
`references/prior-art/` is gitignored for exactly this reason.

### Correction 1 — my survivorship-bias critique was right but mislocated

I wrote that carriers built only from successful trajectories are "survivorship bias by
construction", implying an oversight. It is not an oversight; it is a **declared constraint**.
§3.1 defines the carrier on `D+`, "the trajectories that reach the goal, truncated at their
first goal arrival", and A.18 states flatly: *"failed trajectories are excluded from training
(hard project constraint)."*

So the limit is real and the authors own it. The sharper form of the critique survives: a
hole in the carrier means **"no successful trajectory went here"**, which conflates *no
solution exists* with *nobody tried*. The paper's own layout-perturbation experiment (A.10)
is the closest thing to a test — blocking a corridor deletes the trajectories and the gates
follow — but that only shows the gates track the DATA, which is the claim it sets out to
make ("the carrier is the sole mediator"), not that unvisited regions are impassable.

**That is exactly where Zeta differs, and it is now a sharper trajectory hypothesis:** this
repo *keeps* its failures — `docs/BUGS.md`, `db/uncertainty/`, every red CI run, every
retracted claim. A carrier built from successes *and* failures is a different object than
the one the paper defines, and whether persistence over it means anything is an open question
the paper does not answer because it never had the data.

### Correction 2 — the winding number is deployed, and its result is a NULL

I said "we state the discipline; they compute the invariant." True, and I underestimated the
second half: A.12 does not merely compute the winding number, it **runs it in the decision
loop** as a route lock with half-a-turn hysteresis.

The result is the interesting part, and they report it against themselves:

> *"replacing the geometric route rule with the winding-number signature leaves every success
> rate inside the noise band (94.8 vs. 96.4 on t4, p=0.46) ... and the H1 runs log zero route
> switches on every seed of every task"* against the geometric lock's 17 and 26 switches.
>
> *"The main deployment keeps the geometric progress lock ... the two locks are success-rate
> equivalent within the noise band, and the geometric lock is a zero-cost interface component
> requiring no hole detection."*

So the topological memory works **exactly as designed** — zero route switches, an integer
invariant that "flips only when the agent physically circumnavigates the separating obstacle
block, and is indifferent to corridor width and distance scales" — and **buys no measured
improvement on the metric they report.** They deploy the cheaper thing anyway.

A null result, stated plainly, with the mechanism confirmed and the benefit absent. That is
worth more to us than a win would have been, because Zeta's monodromy clause makes the same
commitment for the same structural reason, and this is the first evidence about what it costs
and what it buys.

### What I would have missed without reading it: the Eikonal identity

Theorem T1 (§B.3) is the piece that lands hardest on **this session's own work**, and no
summary conveys it. Prior methods regress a scalar potential onto the Eikonal equation, and
the paper observes that this makes three mutually conflicting regression targets. Setting
`r(u) = d_G(u, V_g)` — a graph geodesic, computed, not learned — makes all three *properties
of one object*:

> *"In the route that regresses a scalar potential onto the Eikonal equation, these three
> elements were three mutually conflicting regression targets; in the present framework they
> are intrinsic properties of a single object d_G. The Eikonal constraint is thereby converted
> from a regression target into an identity."*

**That is the same move as every fix that landed in Zeta today.** The bun version restated in
55 places and drifted into four spellings; the artifact path derived by a planner and
rewritten by hand; a test hardcoding the literal it was checking. Each was one derived value
declared twice, and each fix replaced the restatement with the derivation. The paper reaches
it from optimisation and calls it converting a constraint into an identity; the repo reaches
it from CI drift and calls it *derive, don't restate*. Same principle, two domains, and
neither borrowed it from the other.

### A note on how the paper is written, because it is unusual

It carries the epistemic habits this repo tries to enforce, unprompted:

- A **negative control**: the Rubik/puzzle environments "carry no obstruction topology ... the
  bottleneck analysis of this paper does not apply to them", included *solely* to show the
  planner's other layer is doing work there.
- A named **failure boundary**: the cube rows "mark the score boundary of the method", with
  the failure attributed mechanistically to the executor rather than explained away.
- **Sufficient-but-not-necessary bounds reported as firing 0/20**, with the operative condition
  named as the distributional one instead.
- **Marginal instances "registered, not counted"**, each adjudicated individually (B.5).
- A superseded proof, named as superseded: *"The earlier curve-level-detrending argument is
  superseded by this per-mechanism correctness path because ..."* (Lemma 8).
- Remark 6 stating that when its heuristic fails, *"the cost of condition failure is recall
  loss, not precision loss"* — the failure direction declared in advance.
- A **discriminative** numerical closure: four competing models against one measured δ, three
  rejected at 3.62×/1.37×/1.14×, one at 1.06×, explicitly *"discriminative, not curve-fitting"*
  — and the scope admitted: *"a same-sample consistency check rather than a held-out
  prediction."*

## The presenter's full paper list, as supplied (arXiv ids, unread)

Aaron sent the screenshot of the channel's daily list; the highlighted row is the subject of the
talk. Recorded because several of these sit on live Zeta seams, and a locatable id is worth more
later than a remembered title. **None of these has been read.**

| arXiv | title | why it is noted here |
|---|---|---|
| **2609.11014** | **Topological Necessities: Mechanism-Invariant Strategic Subgoals for Cross-Embodiment Goal-Conditioned Control** | the subject of this ferry |
| 2609.11709 | When Agents Disagree: Bayesian Backward Reasoning as a Label-Free Anchor for Multi-Agent Collective Decision-Making | disagreement as signal — our monodromy / raw-vault clause |
| 2609.11109 | How AI Coders Discuss, Disagree, and Reach Consensus | same seam, empirical |
| 2609.11319 | Magenta: Closing the Loop Between Mathematical Reasoning and Lean Verification | we already run Lean in `full-verify` |
| 2609.11911 | Artificial Id: Drive and Persistent Alignment in Agentic AI | `docs/ALIGNMENT.md` surface |
| 2609.10817 | Tapes Together Strong: The Co-evolution of Computation and Cooperation | society / cooperation substrate |
| 2609.11060 | Grounding Agent Memory: Environment-Probing Curation for Enterprise Agents | memory preservation (§5) |
| 2609.10750 | When Synthetic Data Hurts: On Catastrophic Forgetting in Skill Retrieval for LLM Agents | skill library drift |
| 2609.11393 | Beyond Confidence: Stability-Aware Test-Time Adaptation for LLM Reasoning | — |
| 2609.11569 | Enabling Knowledge Graph Understanding at Scale (EXYGEN) | — |
| 2609.11190 | Agentic Share-of-Search: Multi-Agent Competitive Decision-Making in LLM-Mediated E-Commerce | — |
| 2609.11155 | DRG-MAPPO: Hierarchical Dynamic Role-Graph Multi-Agent RL for Cooperative Air Combat | — |
| 2609.11493 | From Document Silos to Process Intelligence: A Multi-Layer Knowledge Graph for CMC | — |
| 2609.11677 | Ecdysis: Efficient and Effective Training of Runtime Harnesses for LLM Agents | — |
| 2609.10939 | Evaluating Scaffolding-Oriented Multi-Agent LLM System for Clinical Interview Training | — |
| 2609.11231 | A Voice-Interactive Multi-Agent System for Smart Operating Rooms | — |
| 2609.11147 | Autonomous Chemical Mechanistic Discovery through Agentic Reasoning and Validation | — |
| 2609.11065 | MOSAIC: Query-Aware Exploration Policy Adaptation for GraphRAG | — |
| 2609.10895 | ReactHuman: A Physics-Grounded Benchmark for Human-Like Reactive Decision-Making | — |
| 2609.10702 | Data-Efficient Language Modeling: From Frontier Advancement to Principle-Guided Model Improvement | — |

---

## Why it was worth ferrying — and one connection is already carved here

### 1. Homotopy classes ARE our monodromy clause, arrived at from the other side

This is the strongest link and it is not an analogy. The transcript's core object: two families
of successful trajectories that pass on opposite sides of a hole, which **cannot be continuously
deformed into one another**, and a winding number that remembers which side was taken.

`.claude/rules/anti-babel-preserve-reconcilability.md` already says, in its own words:

> *Two paths around a pole yield genuinely different results, and **that difference is
> information, not error** (monodromy). So reintegration means **both branches held, each with
> its path recorded** — a reintegration that produces one surviving value has performed the
> collapse, not the merge.*

That is the same mathematical structure. Ours was written to govern how diverged agents
reintegrate; theirs is used to enumerate strategic options. **The winding number is the "path
recorded" made into a stored quantity** — which is the part we state as a discipline and do not
currently compute. That gap is the interesting part, not the agreement.

### 2. Distance where there is no metric — ordinal by necessity, as in our ΔU ledger

The transcript is explicit that the constructed space has **no distance**, and that eikonal
shells are introduced to supply a *goal-relative* progress coordinate rather than a metric.

`.claude/rules/every-bug-has-economic-value.md` reaches the same shape from economics: the price
of a bug is **"ordinal + witnessed (a ΔU sign + the test that fails without the fix), never an
invented number"**, and `db/uncertainty/` is deliberately an ordinal register. Both refuse a
cardinal metric the space does not supply, and both then need *some* way to say "closer".
Whether eikonal shells are a legitimate construction for our register is an open question, not
an established one.

### 3. Cross-embodiment transfer is what the four-oracle byte-lock already does

*"Task knowledge separated from the particular executor"* is the paper's stated goal. The
byte-lock (F# · C# · TS · Rust, judged against hex-in-JSON golden vectors) is that property
enforced rather than learned: one task structure, four executors, disagreement is loud. Note the
inversion — they **infer** the invariant from many executions; we **fix** it by treaty and refuse
divergence. `.claude/rules/culture-invariant-by-default.md`: *"The seed is the treaty."*

### 4. Gates as unavoidable checkpoints — and the honest difference

H0-persistence "gates" are points every successful trajectory must pass through, found by
measuring where behavioural freedom collapses. Zeta has an unavoidable checkpoint too —
`gate (required)` — but ours is **declared** and theirs is **discovered**. A discovered gate is a
measurement; a declared one is a decision. Conflating them would be the
`dual-use-detection-is-neutral-oracle-decides` error: a meter's fact read as an oracle's verdict.

### 5. What I would want to falsify before believing any of it

- **Carriers are built only from SUCCESSFUL trajectories.** That is survivorship bias by
  construction. A hole may mean "no valid solution here" or merely "nobody tried" — the
  transcript treats the first reading as given. Distinguishing them needs failed trajectories,
  which the method discards.
- **Persistent homology over a learned embedding inherits the embedding's distortions.** H1 on a
  bad latent space finds bad holes, confidently.
- **"12 of 29"-style counting.** Every number in the transcript is the presenter's, not measured
  here. Same class as this session's Scorecard reconciliation: four hypotheses, three refuted,
  one of them by my own broken instrument.

---

## Transcript (verbatim, as captured)

0:00 Hello community. Yes, we have a new paper and it is just amazing. Let's talk about topological intelligence. We have
0:07 a new technology. Now, you know, in preparing this video, I have quite a lot of papers. Every day I scan through the papers and you have this list here
0:15 provided by me here if you are a member of the channel. And today, we're going to look at this particular paper. Now, let's play a game. Let's play a game of
0:23 a global simulation of a complexity that a human mind, a human brain cannot process. Let's go with monetary policies
0:31 of nations. So we have known political actions from a certain pattern. We have now action pattern that have consequences. Those consequences form
0:40 another pattern. And now we have the task for an AI system. Hey, play a more complex game. Increase the complexity of
0:48 the game play itself. Find new strategic dimension.
0:52 Now I received some paper here for some kind of evaluation. just want to tell you there are currently quite a lot of
0:59 um economic think tanks that use artificial intelligence to have a simulation of scenarios what can happen
1:07 let's go for a monetary system here and let's go for the complexity of the global monetary system on our planet on our planet so we have the bond market we
1:15 have the yield structure we have the 10-year treasuries we have the complex monetary policy from different nation we have different trade policies
1:22 implemented by different nation and we have maybe even some innovation policy, some technology policy and now this form
1:29 a dense network here of interlin uh problems and we are looking here for known and unknown pattern to reach our
1:38 goal. Now you might say okay we have the abstraction agent here. So we have an LLM that builds new strategic dimension
1:45 and along those new strategic dimension that emerged now by the artificial intelligence we can have now a much deeper understanding of the dynamics
1:53 here of the global monetary system and yeah you are right and we can integrate economic complexity and we can integrate the trade complexity with a certain
2:01 numerical representation and then we just let the AI work and I think this is the main course that we have artificial intelligence let discover this AI
2:10 machine new patterns And you might say, is this anymore just a mathematical problem? No, this now
2:18 becomes a real world problem because remember this is about the costs of money. This is about pension funds. This is about social security funds. This is about trillions of US dollars globally.
2:30 So this has real world implications. Now let's start with a simple gdunking experiment. Let's say we have a player A
2:37 here in North America and then we have a player B let's say here the one location of China. Now you understand that a
2:45 numerical simulation has multiple players and multiple dimension in multiple monetary streams across multiple financial dimension itself
2:54 across multiple policy dimension across multiple trade dimension. So we have a numerical simulation with a complexity
3:00 that is real hard to understand. And now we have that not only you have two player, player A and player B, but
3:08 player A is now looking here for strategic partnerships, other nations, other companies, other groups of people,
3:15 other cities, other macrodnamics to influence here the global political system here to have a particular effect, a goal that it wants to implement here.
3:25 let's say some impact on player B. So you see it's not anymore a dual player system. This is now a real complex system with n players.
3:35 Now there are currently some simulation interesting how to imply EI let's say in the implementation of a combined view of
3:44 interest rates here of Federal Reserve uh central banks here shortterm interest rates the development of the bond market
3:51 in general what factors influence here the bond market how can we price in the the gold dynamics let's call it this way
3:59 so those papers are not published yet but I just want to tell you AI is really becoming kind of a foresight instrument
4:07 here for geopolitical, monetary and economic scenarios.
4:12 Now you understand that the dependencies that we're dealing here are if you abstract it just patterns. We have known patterns, we have unknown patterns and
4:21 from the unknown patterns we can further subdivide it into known unknowns that we know what we do not know. But we also
4:28 have unknown unknowns where we have no idea that this pattern exists at all. If we go here in I don't know a high
4:36 dimensional mathematical space and we map the relationship between the players.
4:41 So let's go here and this is not about a monetary policy. This is here a video about a new AI mechanism that we apply
4:49 for a complexity that has nothing to do with some social media post or do a little coding. No, because think about
4:56 the way we represent a complexity can be manifold. No, we can have human words.
5:02 So we have a semantic and we have a syntactic complexity in the English language. Beautiful. But you only can
5:10 express here a certain complexity with human words. If you really go here for numerical number crunching and you have to have a code base and yeah software
5:19 engineering and beautiful everything in it. So what we really going for and please have a look at my last video although it was a member video. We
5:26 looked at the numerical simulation of specific scenario dynamics where we have an integrated approach where we have an LLM or an agent structure that is
5:34 steering now the huge numerical simulation here the deterministic code execution on supercomputers but now we
5:42 have another language and today I want to show you we have here the language of mathematics of a pure mathematical abstraction we will go in a different
5:51 world where we use a different mathematical language you if you're not familiar to mathematics you will never heard before. We will use objects that
5:59 you are never heard before that are completely unknown to you. But I just can tell you about the last 250 years in
6:06 pure mathematic research there were some amazing developments and we use now those mathematical developments to get a
6:14 better understanding how to implement new AI technologies.
6:19 Let's have a closer look. This is the study of today and yeah a lot of people ask me hey do you go only with the famous institution no not at all I go
6:29 here for the technical abstracts and then I read here the first pages here to understand what a paper is all about you see this here this is an institution
6:36 I've never heard in my life before army engineering university of PLA and I'm here as [clears throat] a European not
6:44 able to pronounce this um city name I suppose here in any correct form so yeah a beautiful uh team here in China here
6:52 they published here September 10 2026 topological necessities mechanism invariant strategic sub goal
7:00 for a cross embodiment of goal condition control and you might say hm sounds like an insignificant paper but you might be
7:08 completely wrong those are 60 pages of pure mathematical abstract logic applied to possible AI
7:16 system and this provides us with a new perspective on AI. This provides us with a new technology that we can use within
7:24 EI. So let's make it simple. If you're new to EI, you know, you have different framings that you can use. I want to show you two different frames. If you
7:33 start learning EI, you know, you have something what we call reinforcement learning. And in this reinforcement learning, you have multiple, let's go with an offline reinforcement learning.
7:42 This simply means you have an offline data set, a record of experiences of other executors at scale. You have 10,000 reasoning traces from a fable 5.
7:51 You have 100,000 reasoning traces from an open UI system. Whatever you have a robotic system and then the job is acquiring now a task from that
8:00 experience without that you as an AI machine have any interaction any new interaction with the real environment.
8:08 So we are totally offline and you just have to learn as an AI machine from recorded experiences. But those recorded
8:16 experiences can be I don't know 100 million human using AI machines and you can analyze now this particular
8:24 complexity or as I showed you at the beginning of this video you analyze the economic interdependence here of a global monetary system
8:33 we have a goal conditioned term here. So this means we have we have a starting position and a goal that we want to
8:40 achieve and this is now here the reinforcement learning of course on our path to our goal we have sub goals so
8:48 step one step two step three you got it and those are produced in reinforcement learning think about the value function we have latent actions and we have a
8:55 policy output a particular strategy that the I machine applies now the sub goals defined through the quantities tied to one executor let's say this is a
9:04 humanoid robot or you have some other abstract robotic machine can absorb now some execute a specific variation. Now
9:12 such variation is noise with respect to the task and it can deier the transfer of knowledge of experience when the executor or the embodiment changes.
9:22 Think about you want to explore a new planet. Let's make it really science fiction. Yeah. And you have different probes. You can send in a probe that
9:30 explores here the water. You can send in a probe that is a little Mars rover that travels here on the solid surface of
9:38 Mars or you can have things that fly in the atmosphere.
9:42 Depending what robotic system you choose, you have different control mechanisms for this particular AI machine. What you want to have is an abstraction of a mathematical logic.
9:54 what are the option that if I send this atmos this probe into the atmosphere of Mars whatever then I have strategic
10:01 option and goals I want to achieve and this can be now modeled here in a new way using mathematics. So given now a
10:10 theoretical complexity of thousands of possible actions. So if think about the monetary system you have more then we have all the observations we have all
10:18 the known patterns from economic theory of the last 150 years a known unknowns in this system. We know that sometimes
10:25 we do not understand a certain dynamic evolution of a subsystem either monetary policy, economic systems, whatever. And
10:33 the job is now find a unifying but a complete system description of all theoretical possible solution for this
10:40 particular complexity. And yeah, an example is monetary policy or you explore a new planet or whatever. So this is a highly complex task. This is
10:48 not that you write an email and you post something on social media.
10:53 Now analyze the mathematical space of all possible system state is of course your first idea you want to implement.
10:59 Yeah. So given now here a certain domain complexity or multiple domain complexity. You want to analyze what is the complete mathematical space that I
11:07 have and then I can have a search algorithm that searches here on the search base for my particular solution given my condition here my start
11:16 condition end conditions and you got it and then you want to describe the temporal and the path dependence dynamics. Think about famous puff integral quantum field theory that will
11:24 lead you to a defined solution. Either you have a goal or a sub goal or whatever. This is your kind of a fractal system.
11:31 Now frame two is when the task knowledge is tied to what robotic machine you send
11:39 out to explore the planet or what task knowledge and monetary policy you want to use as a tool to have an influence on
11:48 the US central banks. execute transfer the task means learning it again. So task knowledge separated from the
11:55 particular executor from the tool that we use to execute something we want to have an abstraction and an abstraction
12:03 that is in a mathematical way that we can share it with other executor and reuse directly.
12:10 So what we're looking for a mathematical representation of an executor independent task structure but remember this task structure we have now to
12:18 extract here from observation from a particular executor specific robotic system. So we do have to have the first
12:26 level of abstraction and whether it can be recovered from the experience of others. Can we have a general abstraction? This determines here the
12:35 cross executed learning. Is it possible at all for reinforcement learning? and then we go for non-distributed.
12:42 So we do not start here just to make it clear with a complete world model where we have a mathematical descriptor that provides it with a complete analytical
12:50 description of the dynamic of this simulated world model. No, we go now and we collect observation observation from
12:59 the internet for whatever you have your robotic AI system your AI machine operating now for thousands of hours
13:06 here in a particular domain and then you just collect all the information because you are looking for patterns for unknown
13:13 undiscovered patterns. So we are taking in the raw experience here from the data streams and now we do not have a wrong
13:22 model because now we have a mathematical knowledge a mathematical theory that will provide us with some extreme
13:31 powerful tools and this kind of abstraction as I showed you we already had here this video of the abstraction agent here where we create a new state
13:40 space geometry. So we can create here our mathematical space already but now of course we go another step. So we are
13:47 going to embed we have to build now an topological space. Now a topological space if you're new to metamatic is a set endowed with a structure called a
13:56 topology which allow defined continuous deformation of subspaces and more generally all kinds of continue
14:03 operation and the deformations are of course considered in the topology what we call a homeomorphism or homotopes. If
14:10 you study mathematics, you know this is exactly semester five when you finally start to learn topology.
14:17 Now removing now this particular executor, this particular robotic machine entirely leaves behind something
14:24 what you can call an order of unavoidable stages that have been observed by all different machinery by all the probes who sent out to explore
14:33 Mars. You know there was something that was always there in the data that was a pattern that was independent. If you go for water, if you go for atmosphere
14:42 dynamics, for soil chemistry, you'll found patterns that were coherent. Now, if you define a goal on this domain, so
14:50 to reach a goal, every successful behavior must commit to one side of each loop in a free space and then traverse the corresponding region in a fixed
14:58 order. If we see this through the topological glosses to the topological perspective.
15:05 So my job is now to tell you I cannot present you in 20 minutes on YouTube 20 pages of pure mathematics and this is
15:13 not a classical mathematic. This is here what I would call already advanced mathematics. So my job now and I thought about this is to show you an image.
15:24 So I choose now another frame. I choose now a visualization where I show you the
15:30 mathematical tools of topology homotropy how to apply this what they achieve for EI and I will then come back and tell
15:39 you what mathematics can do for this new EI technology. So here we go. So here you see different kind of robotic
15:47 system. No humanoid then something like a mechanic dog or something from Star Wars here. Perfect. Yeah. Different sensor regions whatever. And now you
15:56 have a goal. And here on the right hand side you have here this beautiful shining goal. And now you have strategic options how to reach your goal. Remember
16:05 this is not the uklidian space. This is not what you have in the normal world.
16:10 This is here an absolute abstract mathematically syntactic space that we construct not on ukidian or any other
16:18 simple mathematics. This is here what we call yeah homot classes and carrier structures. So let's talk about topology.
16:28 This image depicts the EI system that learns the structural logic of a particular task from the observed
16:36 trajectories from successful trajectories rather than memorizing here the exact movements of
16:44 one robotic system. So yeah, of course you can have here the memory. You read out the memory files and you know exactly at which time period what kind
16:52 of robot moved in what particular sequence of motion touched what moved to what position and you got it. But you do
17:01 not want this because you want to abstract it away and you want to have the pure logical abstraction from a
17:08 task. a task now in a space that you cannot imagine that does not exist but we will build out of pure logic and we
17:16 will find a mathematical representation of this abstract logic with the help of some mathematical tools. Great. So the
17:25 3D surface that you see here as this wobble in space is what we call here a
17:32 data supported world model. So we do not have an analytical solution. We do not have Maxwell equation to explain the
17:39 dynamic of this system. We just have millions millions of observations of data points what we observed particular
17:47 action takes place and then we have in the environment here an observation. So this surface bubble whatever you like to call it here is what we call a carrier.
17:58 What is a carrier? A car is a geometric model that is constructed from previous successful trajectories of other robotic
18:05 system or of reasoning traces of large language model or vision language model.
18:10 So a geometric model constructed from successful trajectories. Now in AI terminology if we move from pure
18:18 mathematics back to artificial intelligence those are just some region of state space for which the system
18:25 dynamics has evidence that a successful behavior was possible and on the path on the reasoning trace path to the solution
18:34 we crossed around here in this region of the space that is now building here our complete geometric model here. So you
18:42 see this is a very particular way to mathematically build the world.
18:48 Now each location that you see here it's each point on this carrier is not a real XY Z coordinate of the real world. This
18:58 is here absolute mathematical abstraction and you have much more information than the physical position XY Z of a robot.
19:05 You have configuration files, you have the object state descriptors, you have the context state descriptors, you have general abstraction of the task process
19:13 of all the features that are relevant in the control cycle. So this is a pure mathematical abstraction. You cannot imagine this. This is abstract. So the
19:22 carrier but in our logic in our complete mathematical coherent girdle proofed logic is this carrier is not a literal
19:31 map of a room or something. It is a topological task state manifold that is assembled now in our world building from
19:39 successful demonstration where a machine reached its goal and now we take millions and millions of those
19:48 demonstration and the eye has not the task to find common patterns. So if you want in my simple words this is kind of an abstraction of all the possible path
19:57 to the goal. If you have in monetary policy a goal those are you want to know all possible path you don't want to know
20:05 only what happened in history what happened in 1958 here in the United States or what happened in the 1980s in
20:13 Japan no you want to have a complete system dynamics that integrates your known patterns and unknown patterns and
20:21 you want to explore the unknown patterns the unknown [clears throat] political options for example or trade policies that you can apply to reach your goal.
20:30 Now you see here that we have here because there is something in the middle and I will have a look at this what this is. We have now homotopic classes in our
20:39 mathematical description. You cannot imagine this. This is nothing you will encounter in the real world. This is a mathematical logic that was developed to solve certain mathematical problems.
20:50 Yeah, this is yeah university semester 5.
20:56 The two colored pathways are not intended to show only two individual rollouts. Remember this is here a state of states. So each ribbon here that we
21:04 have the orange one and the blue one represents families of similar successful trajectories. So inside one
21:11 ribbon the light individual lines show different execution paths but all the trajectory in that particular bundle and
21:19 this is a mathematical expression implement the same highle route strategy.
21:25 So you want to know your strategic option and you want to analyze all strategic option in an unknown complexity space. So you have here and I
21:34 tried to generate this picture here as a homotropy class gamma minus and gamma plus. And you say okay I identify now
21:42 two different path homotopy classes. If you're not familiar with mathematics, a pathomotopic class is mathematically
21:50 speaking a group or more precisely an equivalence class of trajectory that implement the same topological route.
21:57 Okay. So this means but a path from one colored bundle cannot be transformed continuously with any mathematical mapping operation into a p from the
22:05 other bundle. So you cannot map here the blue one to the orange one onto the orange one without crossing here this particular obstacle and this will be a
22:14 topological hole structure leaving here or leaving here the demonstrated space or returning and going around here the obstacle in a different way. So this
22:22 means for the eye this means that these are not merely variations of noise like in diffusion operation these are really
22:30 generally different planning option and here we go now because you want to reach your goal. So you are planning now a strategy to reach your goal and you want
22:38 to identify okay I don't want to have tiny variation from one path to reach my goal I want to have here a complete
22:47 understanding of all my option that are mathematical possible so you want to have the genuine different playing option and you see this is where you
22:55 build exactly this mathematical structures now let's talk about this this thing in the middle this this obstacle the
23:03 dominance 3D object and center is a region that successful trajectories avoid. You will find in your observation
23:11 in this particular synatic mathematical space there is no data point in this region of space. This is absolute empty
23:19 space. So the surrounding path blue and orange here produce now in this mathematical representation a stable
23:26 hole in the trajectory coverage and this is what the image identify and if you are a little bit familiar with mathematic you know this is H1 this is
23:34 our first homology group. So this means we have mathematical tools to build this to identify this and really see oh we do
23:44 have here a particular topological structure. Now homology itself is an algebraic tool that counts and
23:52 classifies here in a very simplified version dimensional holes in a particular space by looking here at the boundary condition and H1 specifically counts here on one-dimensional holes.
24:02 Now you know if you have a PhD in mathematics this is really a simplification but I hope to just give you a feeling an image why we are doing
24:11 this because not all option that are in this space available are really available because we will discover that
24:19 we have regions where there's no solution possible which brings up a new mathematical problem but more about this later. So
24:27 and then we have winding numbers. You see how w uh equal + one here for the um blue one and w minus one for the orange.
24:35 What are those? Now those are mathematical ideas that come also here from kind of the winding numbers. So
24:44 those encode how each path winds around the obstacle. Now in the eye how we use this the winding value works like a
24:51 stable route identifier. You went to the north or to the south and you know exactly what it means.
24:57 And once the agent commits to one side here, so either blue or orange, the winding signature remembers this
25:04 decision becomes here our topological memory structure in EI terms. No, but operationally this prevents now a
25:13 planning step of our AI machine from repeatedly switching between the routes merely because the other route seems
25:20 temporarily a little bit closer and we have not defined what closer means in this particular mathematical space.
25:27 So the winding signature tells here the planner if you want hey I'm already executing here a gamma plus route here.
25:34 So the blue one already continue using here the checkpoint. So we do have particular points on this mathematical
25:41 space that now belong exactly to the implementation of this particular reasoning strategy or of this particular strategy if you have a robotic system to
25:50 reach here a certain point. So therefore the winding structure if you want is for the eye implementation now a compact
25:58 topological memory of a long-term planning commitment in the decision process of the EI machine. Great. Now
26:08 there is now no distance. Now we have no distance defined. You cannot tell here like in a vector space or in other spaces here. So what we do now guess
26:16 what there were really years and years of mathematical research in the past. So they found here a pure abstract
26:24 mathematical construct they call iconal shells and this is kind of a global progress representation and you yeah I
26:33 tried to find here this image or ask machine to generate here this image how I have a feeling how I see this. So
26:42 maybe it helps you here this visual to understand what we are talking about because we have no distance in this mathematical space. So we have to introduce distance. Now distance is
26:51 simply here a distance to our goal because all is here goal centered. So the repeated translucent surfaces that
26:58 are here now uh built here by this EI image processor are equal distance to the goal shells. And of course we have
27:06 here shell structure in this topological space. So every state on one shell has approximately the same remaining legal
27:13 path distance to the goal. But it's not a ukidian distance. This distance is measured through here a valid carrier
27:21 and it has a mathematical complexity you cannot even imagine if you have not studied mathemat mathematics at the university.
27:30 So this shells give here the a common global progress coordinate the outer shell here if you think about this percentia states system state dynamic
27:39 states that are farther away from our goal that we want to reach. The inner shells represent states that are real close to the goal. And moving across the
27:46 successive shells here in the topological space means making progress towards our goal in the task structure.
27:55 Beautiful.
27:56 Now you remember the classical um learning we had back propagation. We had to have a direction of learning here for
28:04 the neural network. Now here in the topological space we have something similar. We need a direction that our reasoning trace or here the path in the
28:13 decision process of a robotic system has to go to reach the goal. Of course, this is an mathematical abstraction. So what
28:20 is here a direction? So we have here also a direction. This is our knob R represents the local direction in which
28:28 the remaining goal distance decreases most rapidly. So perfect. We have exactly here on a manifold now a
28:36 preferred direction to our goal. So this acts now if you want in simple terms a global navigation signal pointing
28:43 towards smaller distance to goal values in a complete abstract mathematical space. Now there's a whole mathematical theory how those shells can be created.
28:54 I have a simple explanation for you can be understood as a backward wave emitted here from the goal. This is like a pulsar that emits here in astrophysics
29:03 constant time signals. It emits your wave front and you know exactly where is the goal. So the wave expands through
29:09 every data supported routing and bends around certain obstacles and yeah there will be effects. I cannot explain to you with plain mathematics.
29:20 Now there are something about the degree of freedom and the degree of choices I have for my process. how the I machine
29:27 will decide on what options I have and what amount of options I have because as you can see we have here some
29:35 bottlenecks. Now what is a bottleneck in an abstract mathematical space? At first it is a shell compression methodology.
29:42 No. So this means it indicates here a loss of behavioral freedom for reaching here my particular goal. But this is
29:51 great because remember in the abstraction I told you I want to find abstract patterns and this is kind of a pattern. This is a point where all the
29:59 observation have to go through. I mean [laughter] if you watch TV I don't know if you know the TV series Doctor Who
30:08 there are something like a fixed point in time. No, this is something similar.
30:14 Of course it's just a Yeah, but you got it. There are some points where all the decision processes have to go through.
30:20 This is here something that is valid for all the different option all the different robotic systems that will
30:26 explore this planet. Now we have to find those particular bottlenecks and because they will become gates and they will
30:34 become absolute important decision points here for to reach our goal. So near a narrow passage now and we talked
30:42 about shell compression the same shell becomes compressed almost all successful trajectory must pass through a smaller state region in this mathematical space.
30:51 So therefore the system measures here the effective size of each shell and ask now how many successful option remain available at this particular stage.
31:03 Now we take now the mathematical toolbox and we discover another beautiful advanced mathematical tool and this is
31:09 the zero homology group. Now an H0 operation we use now as a kind of filter
31:16 for false bottlenecks because guess what like in the classical AI yeah sometimes this is a real bottleneck and sometimes
31:23 this is a not real bottleneck. My goodness if my mathematical teacher would hear me. So therefore we have the
31:30 zero homology group and it simplifi simply counts at a number of path connected components in a topological space. Great. Now a persistent H0 is
31:40 used here as a filter as a robustness filter. What it means it simply determines which dips here in the freedom signal complexity remain
31:48 distinct across a wide range of detection thresholds and then those stages will become real gates. And this
31:56 is what we are interested in. We want to find those gates for our process. So a shared gate is if you want an
32:03 unavoidable strategic point in time in space in a topological space and time this is an
32:12 unavoidable checkpoint that we have to go through with our reasoning process with our whatever robotic action with
32:19 our mathematical simulation whatever. So at the gate itself the route freedom
32:26 collapses. Everything has to pass through this particular gate. And this is great because these are kind of fixed
32:33 points in our complexity. So we know exactly where we have to go through at some point in time. And after passing
32:41 through the two strategy classes here, our blue and our yellow ribbon, those two strategy classes merge now into a
32:50 common continuation towards the goal. So you see exactly here back to topology homology and whatever that we have now a
32:58 new mathematical understanding our strategic option now converge to a final
33:05 option. This is what we have to do if we want to preserve here uh particular interest rates in the US. So I think
33:13 we're coming almost to an end because every valid solution as I told you in these route classes must pass through this particular gate produce this
33:21 particular region and it simply turns thousands and thousands of continuous trajectory states and all those
33:28 observation into a very small number of meaningful task milestone. So a successful task becomes now really
33:37 abstracted in a topological space and we found here really the gates that define here the process of reasoning to define
33:46 here all my option all my actions I can take. So this means this topological representation can therefore transfer if
33:54 you want the task skeleton the most important backbone of a task while allowing each agent each different
34:01 robotic system to supply its own controller. Great.
34:07 So this is another kind of representation I played around here with AI machines to show you. So the paper on
34:13 topological necessity is simple this you have here h1 route classes remember route class is a homotopic class of
34:22 paths itself this is a non-trivial mathematical space we have our holes where we have no observed data in no of
34:30 our successful uh trajectory ever a data point was recorded in this particular region of the topological space and we will talk about this later why this
34:39 happens but we have now we've had conal shells and Here we have a H0 persistence here and our gates were that we understand now what is this gate? We have now kind of a pathway to our goal.
34:52 So this means I cannot find theoretically, mathematically hopefully all possible solution in a complex
34:59 system dynamics and this is what we set out to do.
35:04 What is now looking back what have we achieved? We have some cross embodied transfer between different robotic
35:11 system. We have a strategy that can survive any changes in the robotic body itself or what sensor the robot carries.
35:19 No temperature, pressure, whatever. We have some long horizon planning. This means we have really compressed
35:26 thousands of different system states into a short sequence here in a new representation mathematical representation to get meaningful
35:35 commitments. We have a route stability with our winding memory that provides now the memory aspect here for the
35:42 continuous root switching. We have a persistent that separates here the stable structure from the sampling artifacts. We have found our global
35:50 gates that point us to the global waypoint execution. We have kind of found an interpretability of the system and we have kind of a data efficiency.
36:00 Let's be here positive here because the AI plan extracts here this shared abstract structure from ex existing successful demonstration paths.
36:11 So this is it. You see this is now an image that explained hopefully to my best knowledge I can do this here. This
36:19 produce this video. This shows here an AI transforming raw successful rollout paths into a reusable highly abstract planning document.
36:31 So this means if whatever system it was a Fable 5, a robotic system or a little
36:38 three billion model here on your local PC, if there was a successful trajectory
36:45 from a beginning to a goal independent what domain and complexity it was, if I can abstract it into a topological
36:54 space, if I can find a solution. You know in the good old times we had skill markdown files and then we had procedural uh files that we described
37:03 and now we are in a much higher mathematical space and we are much more abstract. We are not model dependent. We are not harness dependent. We are not
37:11 even domain dependent. We are really going in the abstract mathematical space where anything that a human intuition is
37:20 is not there if you do not have a PhD in mathematics.
37:26 So if you ask me now and you know whenever you see this green this beautiful green bright bar here at the end here. So what do we build? We first
37:34 build a data supported strategy supported topological task space a manifold and then we measure here some
37:42 global progress toward our goal. We discover where the successful options split around certain obstacles certain holes in our topological representation.
37:52 We will separate this option into distinct root classes ways to find a solution. We remember the selected class
38:02 through a winding signature. Then we identify stable collapse of behavioral freedom when we pass through our gates
38:11 and converts these stable collapses here into the unavoidable gates that are our waypoint to our goal.
38:22 And now you have it. Now you have here my feeling, my kind of try to explain
38:29 you 60 pages of dense mathematical argumentation in a single image. And this is why I called this image on this
38:36 video here topological intelligence because it portrays here a machine intelligent not as a pure memorization
38:44 of successful trajectories but as a discovering here the invariant mathematical structures shared by many possible executions.
38:56 I hope you enjoyed it. I hope I provided you now the main idea the main mathematical understanding. We went
39:02 through the complete process and now you can really take a weekend enjoy 60 pages of pure mathematics. Now you know
39:10 exactly the outline. You know exactly the reasoning. You know exactly how we use each mathematical tool. If you have now a deep dive, I think hopefully you
39:19 can really now enjoy this particular paper into the orus. Absolutely amazing.
39:25 I love this idea. I love this new framing. I love this new perspective that you bring into the next development of AI technologies.
39:35 I hope to see you in my next video.
