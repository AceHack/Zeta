# Abstraction Agent — "LLM Engineers New State Space Geometry" (video transcript)

> **THIRD-PARTY CONTENT — Zeta claims no authorship and asserts no license.**
> Quotation-for-study with attribution, per `docs/ip-questionable/README.md`.
> On a good-faith request this single file is deleted; no analysis of ours depends
> on the verbatim text remaining here.

## Provenance

- **Source:** YouTube video, <https://www.youtube.com/watch?v=7pyQyyTxjkM>
- **Title as given:** *Abstraction Agent: LLM Engineers New State Space Geometry*
- **Speaker/channel:** not named in the material supplied; the channel self-describes as
  covering "EI" / AI research explainers. **Attribution is therefore INCOMPLETE and is
  recorded as `unknown` rather than guessed.**
- **Underlying paper discussed:** an "abstraction agent" preprint attributed in the talk to
  **Tsinghua University** (rendered "Chingua" by the auto-transcript), dated in the talk as
  **2026-09-07**, with a GitHub repository mentioned but not named.
  **Neither the paper's title nor its authors are stated in the transcript** — do not cite this
  file as the paper. It is a secondary account.
- **Captured:** 2026-09-10, ferried by Aaron.
- **Form:** machine-generated captions with timecodes, verbatim including transcription errors
  ("Chingua" for Tsinghua, "EI" for AI, "sover" for solver). Preserved unaltered —
  `always-preserve-ferries` — because normalising someone else's words is editing the record.

## Why it is here

Aaron 2026-09-10: *"this is very close to what i'm trying to automate, it's taking LLM weight
and turning them into parameters of a smaller math model ... a good way for AI plus human
interaction to design the old school 'expert systems' or bayesian like EP/BP with expert priors
jointly."*

Our own analysis lives in `docs/research/` and links here; it does not reproduce this text.

---

## Transcript (verbatim, machine captions)

```text
Hello community. So great that you are back. Yesterday we looked at the most complex scientific
paper in 2026. Today we look at the most simple paper here that I've read here this year. But
this simple paper my goodness it has a depth that is just amazing. Let me show you

0:07  invents variables. You might say what a boring title. Come on. You really don't want to make
a video about this. No. But let me tell you this is here from Chingua University. So our MIT here
in China and the authors here go and build an abstraction agent as you see September 7, 2026.

0:39  This is interesting and here this is here the intelligence lab here from Chingua University
and they have a simple paper a simple experiment but if you think about it your brain will start
to hurt. Let's start. Yeah, we do have a GitHub of course last week 14 minutes here watching.
Nobody understands here really what's behind this paper, but you will. So, here we go. An
abstraction agent. An abstraction agent reuses here an LLM. It says, you know, LLM, let's try it
in a different way. Let's use an LLM to discover some score strategic features for an information
abstraction. And we go here with a natural language description. And in the paper they go with
some game manuals but of course you can go with a financial manual a medical inscription
strategic option scenario in finance when you're working whatever but you know we are back to the
main topic of EI that I started AI more than four years ago EI to find a hidden pattern in an
extreme data complexity that my simple brain cannot analyze. It's just too much data. I need an
artificial intelligence, a computer intelligence, a machine intelligence to find hidden patterns.
And now we are spot on.

1:56  So let's go. Now this algorithm doesn't learn from demonstration, not from run simulation,
not traverse the game tree or use domain specific evaluators while constructing nothing. Nothing
at all. It is so simple. The authors call this a structured knowledge elicitation. extracting
here qualitative knowledge stored in the LLM, our parametric knowledge of the LLM and converting
it into explicit numerical features and those numerical features and then those object that some
other object later like a numerical solver like lean 4 or Python or C++ program can take up and
consume and evaluate and compute and you would say but wait a minute why let's think about it
mostly I problems no or complex complex it is begin you start to solve it you start to write code
after the mathematical representation has already been chosen you decided like I showed you in my
last video no you build now a vector representation so you have maybe a state vector or you have
the features already defined that you're looking for like accuracy or end to end something or a
similarity the cosign similarity it has to be in a mathematical vector space no or an optimization
objective is already available is already a mathematical representation in a particular
mathematical complexity in a mathematical space.

3:20  Now, now we say wait a minute. But who decided which variables should describe here the
world that I want to solve my problem in? And now this idea by Chingua University is now to build
an abstraction agent an LLM that gives this particular job to decide which variable will describe
my world to the LLM. Not anymore to the human, not anymore to the human experience. But we have so
much data about the world and we humans we tend to look at it in a coherent way. Yeah, but if you
have a huge amount of data where you won't have no access anymore because it trillions of data
points, then we need a machine intelligence and now we give it to the LLM. So the LLM is therefore
not predicting an answer X token prediction. You know what the LLM is now doing in its inherent
functionality? It is now constructing the coordinate system in which those states of the system we
want to analyze can be compared. And if you're going to construct a coordinate system, you need
axis. And you ask what is the x-axis? What is the yaxis? What feature is it? Temperature,
pressure, what? Gravity.

4:37  And now now it gets interesting because the LLM the abstraction agent is analyzing now a
huge amount of data and telling us this this feature would be would qualify as an axis in the
coordinate system to describe the complexity of your system and Chingai University in the paper
showed this on a game theoretical level. Now if you are into the mathematics of game theory please
read the paper. I will ignore it completely because there's a much stronger message hidden in the
in the last pages here where they show here that the LLM is doing something even better.

5:15  Now of course you might say hey as a subscriber of this channel I want to see the physics and
here we are. Imagine a microscopic system may contain enormous number of states. But a useful
computation becomes possible once we discover some variables that describe now the complete
dynamics of the complete state in a simplified way. Now we have here if you want here the the
generative functionals of a Hamiltonian or whatever we have variables like temperature, pressure,
magnetization, whatever you have in your particular domain. So let's find those special
parameters, special variables that describe the system in the best way. And suddenly we say, hey,
the most important intelligence of a machine may not be finding an answer. Next token prediction,
write the email here, but maybe it will be to invent the variables after having calculated through
trillions of data points. invent the very specticular variables that are best suited to calculate
now the answer to my problem in this domain.

6:28  So here with this blue ribbon here on the right hand side this is the complete system. So the
LLM let's say creatively proposes now some candidate strategic dimension on one dimensional two
dimensional more complex then every feature receives some concrete anchors representing let's say
three points I will explain this in a third example the LLM scores every state against this fixed
anchors and features with little variation of removed and highly correlated dimensions are also
eliminated what we are left with are feature vectors and those standardized feature vectors
grouped using K means and a conventional solver lean whatever you have uses then this abstraction
after we found the coordinates after we found here a mathematical space to find a mathematical
representation in this new space that is best for the calculation this will be then done and then
the abstraction will be solved

7:25  now you will see in the paper that there's a lot about poker and whatever video games. This is
not so important because they did an experiment where they said, "hm listen poker you can find on
the internet." No, we want to see the emergence of this pattern finding in the machine
intelligence. So they decide here a rover experiment and this is easy. Now rover trials is here the
preprints principle construction versus memorization test. This test is invented brand new. It's
not in the internet. It's not here in the pre-training data. That is not a memorization effect.
This is really that this will be constructed from scratch by the LLM. So the artist invented a new
world and in this new world or think about astrophysics. Think about the discovery of new I don't
know planets. Now this new world contains now rovers the classical rovers Mars rover and they are
characterized just by three elements. The power the grip and the terrain affinity.

8:28  Let's have a look. Yes, one of my famous AI generated computer graphics. I know such beautiful
things. So we have here on the one hand side here on the left hand side we have the rules the
textual description of what this thing can do or a textual description of a particular game or a
textual description how to do some financial calculations or some financial complexities from what
the hell I know. And the LLM is now given this verbal English rules here trying to understand it
with its own parametric knowledge and it is trying to understand let's say how to play the game but
not inventing here the same mathematics here of pure game theory but we stay in the eye we build an
abstraction agent and the abstraction agents now says listen in this rover world there are two
rovers a rover A and a rover B now it turns Without the rover A, if we test it on the terrain, on
rock, sand, ice, mud, and volcanic, it performs absolutely perfect here, the same. It's an absolute
generalist. But rover B is a highly specialized rover. And this rover was built for volcanic
terrain. If we have some world volcano, this is your rover.

9:46  Of course, if you take the mean, the average performance data, both are at six, as you can see
in the simple examples. Yeah, so this is now if we have here if you want here the classical
representation of the terrain affinity we just have some parameter and we sum up we like an EI no
and statistics and we get here both six years as a results are the same and you might say hey are
those two states now equivalent because we have two rovers now and this colar evaluator based on
the mean parameter says yes look six in both cases but you know exactly the future behavior of that
system because if suddenly put here the specialist rover B on a volcano you will see a complete
different behavior. So the future behavior says no and this is exactly the lens what we need
because they say the problem is not a pure calculation. The problem for this is a pure mathematical
representation not understanding that here there is a dimension volcanic that is where this element
where this rover is outstanding.

10:52  You see what we are going for. So every solver then needs someone to decide hey which
variables matter in the description of this system. How the similarity is measured. Is it really a
cosine similarity in a vector structure? what information may be safely be just ignored because
it's not important for the mission or whatever. Now traditionally the human expert build all this
representation evaluation simulation handcrafted features human knowledge test experimenting but
now Chinga says hey can an LLM do this can an LLM substitute here this particular human role and
they have an idea

11:32  somehow the LLM has to calculate this or a solver has to calculate this so they say let's go
from rules like we have here on the left hand side the rule book for this particular game to
coordinates And coordinates are simple, beautiful to calculate. Look what they do. They say now
okay we have now let's say three parameters mean performance f_sub_1 terra volatility f_sub_2 and
stability f3 of these two rovers. No and then you see we have here for row a here in a matrix this
representation and for rover b in a matrix this representation. And you see of course that F2 the
terrain volatility where the specialist has its volcanic strength changes for a generalist for zero
now to absolute powerful this is the volcanic rover. So if we have now a coordinate system f_sub_1
f_sub_2 f3 you see that in f2 the terrain volatility the difference between our points here rover a
and rover b.

12:35  Now you might immediately say hey wait a minute something happened here. Yes I know but let's
talk about this later. So we have achieved that we built a coordinate system just by noticing that
in the rules or the description of this external world there are differences there are different
states that this external system can be in and we found a new numerical mathematical
representation. But how do we find the best?

12:59  Now you're not going to believe it. We use now the L&M as a coordinate system generator. So
the model the LLM reads now the laws of the domain, the rules of the game or whatever and proposes
now a small set of continuous variables in order to understand the dynamics of this extra world
dynamics.

13:21  So the abstraction agent turns the LLM into a representation engineer. It reads a
specification verbally, proposes some mathematical variables given its parametric understanding of
the LLM itself, constructs in the way I just showed you a numerical state space and lets an exact
algorithm algorithms here of I don't know thermodynamic module here in C++ or some lean force over
determine whether the state space is useful or not. And guess what? Yes, we are looping. So okay,
you got it.

13:53  So this means the future AI suddenly is not anymore about some social media answer to the
email but it can maybe really contribute to science but not by solving equation which is nonsense.
Therefore we have numerical solver like lean four but by inventing the variables of a complex
dynamic system in which the right equations are found and then can be solved by our current
mathematical understanding or physical understanding or financial understanding or medical
understanding. Let me give you an example.

14:28  Two rovers on five possible terrains. No, we have just I've just showed you this now. Stable
general list performance 666 mean performance 6 volatile specialist on volcanic 22. You got it. Now
you know strategically both robots are completely different built for different things and
therefore we won't have a representation that really brings this out. No. And you know now that the
average performance index this metric that we have now normally on our systems is absolutely
unsufficient. It hides some details here from the dynamic of the system for us and this is
happening quite a lot of EI description of systems. So this is not this is here a simplified
example but think about some real complex economic system where you want to take EI and have a deep
analysis of thousands of players here in some international economic scenario.

15:24  But let's add just here another variable. So if we say hey the average performance is not good
enough let's go with the terrain volatility and you know what we are spot on because rover B is
especially built for volcanic terrain. So the terrain volatility is now exactly the parameter we are
looking for to distinguish that we have a specialist in our system dynamics. So the two rows great
average here both 05 or 06 but then in the volatility you have suddenly two extremes. So we found
the parameter we found the axis in a mathematical representation to identify hey this is your
specialist that is available in my system.

16:06  If you go now and you put this simple on the second axis. Now the first rover here general
list is zero for the terrain. Every every terrain is identical six. But if the the second rover B
with volcanic now here we have this is here with 22 outstanding specialist on volcanic rocks. So
this second or this two-dimensional plane now with the second axis this is now the newly constructed
numerical state space of the system of the complexity of the system that allows us now to
differentiate understand that there's a difference in the object that live in this particular
environment. So the LLM has exposed now a distinction that a one-dimensional representation or an AI
maybe a 750 dimensional representation destroyed just averaged over. Sometimes we have to find
mathematical representation of complexities that are really really high complexities 2,000
dimensional vector spaces and more.

17:12  Now, how does the LLM know that this volatility here for the terrain matters? Well, it found in
the rule that there's a description that rover B has some particular features. Now, it noticed the
other LLM just reading the rule book. Let's go with this game theoretical approach that it notice
three facts. The terrain affects the performance, the velocity or whatever. The terrain is initially
unknown and the terrain becomes your public after later decisions. So it can now reason the LLM. Hm.
A rover average performance is absolutely not sufficient to describe here how to solve a particular
mission here going up a volcano. The timing of the information means that the performance variation
across the terrains also affects the strategy.

18:00  So the LLM decides okay the terrain now becomes an important parameter for my particular job.
And therefore the LLM now proposes hey I propose now a new dimensionality a new let's go with a
one-dimensional axis here terrain dependence and this terrain dependence has minima and maxima so we
have our calibration anchors given here the dynamic of the system and now the anchors define what the
different position on this new axis of the second axis mean the LM then receives every rover
configuration from either the game description or whatever and scores it relative to those anchors to
those extremal points. Guess what this is in AI? In AI we call this feature engineering because we
have a function of a certain volatility and we position it as a number in the interval between zero
and one. So those are really features.

18:56  We talked about this. What does it really mean constructing a state space in this way? Now think
about it. We have if you a little bit closer three different mathematical representation. We have the
raw state. The representation is the original object and this is here a rover with a power of four a
grip of two and a strong affinity. Let's go with ice. No something else. Then we have the numerical
state that we built from this raw state. No. Now the representation is the rover changes from an
original object into a mathematical feature vector in a particular mathematical space that we built
to describe exactly the feature of the object. And here we have now this let's go with four dimension
numerical description a vector and what Chinua did if you have not only two rovers but if you have
20,000 rovers here on this world exploring Mars for example you have to find abstract states where
you can say there's a certain cluster assignment so I take all the 20,000 feature vectors and what I
do I want to simplify the complexity therefore I build clusters everything that is real close
together will form one cluster and I will only talk about one cluster representative but not about
all 612 elements that form one cluster and they go down and call this here a bucket forget about
bucket and poker this is not important they form an abstract state so after they found particular
feature vectors and they build a particular feature engineering space state space they go and
abstract it and say if we have multiple objects in this let's call it an abstract state. Beautiful.

20:45  Now you're not going to believe it. This abstract state space has a particular representation as
a mathematical matrix. What a surprise. Now so suppose there are let's say n states and we have here
m variables. No n * n. You see it here in the matrix. No. So its course here the LM every state on
every variable and this matrix S as I told you is the explicit numerical state space. So this means
every row is one state. Each column is one LLM proposed variable and every row is also a point in an
M dimensional space like I just showed you here before. Careful S is now something that we built
outside of the classical learning methodology. S is not at all a transformer activation space. This is
now really a new way to find a learning algorithm that is based on an abstraction a new job of
learning for the LLM.

21:46  Now let's say we have another game and this game has different rules and the abstraction agent
here has also but now we have 1 2 3 four five different elements that live in this world. Yeah, in
this game world and you have to use one particular element for each specific task and you have to
figure out what is the best gaming strategy and you are not a human player but you are an AI machine.
So this is exactly what you do. You take the game book here with all the rules. You let the LLM, the
abstraction agent analyze the rules, find new strategy based on the specific of these five objects
that you can move within this world or use or apply in this world. You assign particular mathematical
or numerical values to this. after you decided that you have 1 2 3 variables that describe this the
dynamic of this state best. Now if you have five elements you see in our f_sub_1 f_sub_2 f_sub3 in our
three-dimensional vector representation suddenly you have five points. Now you could argue h maybe
these two points live together maybe these two points live together. So you see exactly if you have
20,000 elements here for an strongly interactive game play you now know now why we have to do the
clustering

23:04  and at this point you might say but wait a minute where is now the actual intelligent is it the
LLM but the classical LLM what is it think about it the ordinary mathematics of this paper by Jingua
is rather simple yeah no you find a methodology to remove constant variables Then you remove the
highly correlated variables because you want you have unique features. Then you normalize these
features and then you cluster these features to have here a perfect mathematical reduced mathematical
um description. So you see the difficult part here is deciding wait a minute which question has the
LLM to ask about every specific state about the dynamic of every specific state about the let's say
expected gameplay characteristic of every state what is the goal of this particular game as mentioned
in the game rule book so the LLM must infer from the rules that the future uncertainty the
vulnerability ility in the conditional strength or the stability also matter.

24:12  The LLM reading now the the rule book here the game rules here understands what are my elements
that I can build my strategy on. And if you want this is here the paper's new rule for the LLM. The
LLM is now translating here some qualitative semantic understanding of all these single sentences
describing here the rules for the game into explicit numerical axis but not every semantic word not
every semantic sentence only the one that are characteristic for the description of the dynamic of the
system or yeah financial dynamics you got it so this means it converts knowledge such as the railways
is dangerous only after favorable terrain reveal. This is now that we can put it now in simple
mathematical terms.

25:04  So the right variables for this particular game means the variables that preserve the distinction
needed for the downstream solver because I told you we have to evaluate the system. We have to test it.
We have to really have here mathematical sover numerical sole lean for that says okay and now I try to
compute here the dynamics having my understanding and my uh physical libraries about thermodynamics or
whatever you got it yeah talking about thermodynamics this is here a thermodynamic example

25:36  So this means coming to an end the abstra abstraction agent reads the verbal rule description and
proposes now a semantically plausible set of variables for the dynamic of the system and it then
assigns approximate scores with an LLM and their usefulness. Hey, is temperature really a parameter
here? Their usefulness is tested indirectly through the resulting strategy exploitation via numericals
over Python programming whatever you remember mathematics gives us here an immediate validation.

26:05  So you can also say the abstraction agent searches for strategy relevant microscopic variables
just as physics searches for the collective variables in a thermodynamic problem that allow enormous
numbers of micro state think of molecules to be treated as the same effective macroate termamic
description here of a gas.

26:29  Yeah, there are a lot of results from poker and I'm not so into poker or video games, but the
ideas or the results show it works. But it works only for real powerful LLMs like a GPT 5.5. So this is
you have really to have the how to say this the capacity of the LLM to go for real complex topic to
have an extreme huge amount of free trainable parameters like the latest GPT or the latest OPUS or
whatever you prefer. It will not work with a 27B or 48 billion uh open-source model here. You really
have to go for the big ones. the inside the LLM converts here a verbal description. Hey, this is the
rule book of how a world works, how the game works or how I don't know the atmosphere on Jupiter works
into an explicit geometry over that world state. So what we do is amazing. We built a mapping of
different worlds here where we have we start with a verbal description and we end up with a geometric
representation of a particular dynamic of particular components in a dynamic world state.

27:50  So the scientific insight is not simply hey Chingua tested an LLM and the LLM could find features.
We know this for 10 years. But this it converts a verbal description of how a world works into an
explicit geometry over that world states. This is the beauty of this paper.

28:15  So again let's make this absolutely clear. What is the complete idea? The world already contains
many raw state that are in this verbal description. The LLM reads now the description or the rule book
or the rules of a game or you got it. It proposes then numerical questions that expose strategically
important differences. Is this rover B really so good on some volcanic terrain? It answers those
questions for every state. Those answers turn every state into a multi-dimensional vector representation
or a point in a three-dimensional or two-dimensional plane. nearby points are grouped into the same
let's quotation mark abstract state and then we have a classical numerical solver tests this computes
this verifies this where are those groupings preserved the distinction that matters to describe really
the state the system dynamic the state dynamic

29:11  so the entire scientific challenge of the paper is therefore if you go a little deeper is therefore
to create a feature space where the states requiring similar strategy end up close enough to enter the
same cluster group or the same bucket as Chinua calls it

29:31  and if we have an outlook using this idea using this technology now guess what we just find another
loop idea no so because if the LLM proposes now system specific dynamic microscopic variables to describe
here these particular dynamics and the solver finds maybe some counter examples let's loop it back to the
LLM the LLM revises Now it's very specific uh feature axis in its own coordinate system builds maybe a
different coordinate system maybe just in 312 dimension and validated abstractions are eventually distant
back into the model and maybe we even have a learning where we change now the tensor weight of the LLM
itself. So you see this is just here another loop another improvement of the intelligence a self-arning
AI system but remember this LLM is now doing something complete different this LLM is now finding hidden
patterns and this is the reason why I wanted to show you this study this preprint this is the amazing
insight although the paper is about poker and games I don't care about this but go a level deeper
understand what it means understand the mathematics and understand the general generalization of what
they found in Chingua because this is the beauty of this paper. I hope you enjoyed it. See you in my next
video.
```

---

## Comment thread (ferried 2026-09-10, partial — see the elision note)

Video metadata as displayed: channel **Discover AI**, 91.1K subscribers, 5K views, posted
1 day before capture, tags `#airesearch #aiexplained #aitechnology`, description line
*"Abstraction Agent: AI Invents the optimal State Space. all rights w/ authors: …"*,
17 comments.

> **ELISION DECLARED, not silent.** Two comments in this thread are personal attacks between
> two commenters. Their *technical* content is reproduced below; the ad hominem passages are
> **not**, and this note is here so the record shows an omission was made rather than
> pretending the thread was shorter than it was. Reason: this repository is public, and
> `engagement-profiles-public-work-only-not-surveillance-dossiers` licenses compiling a
> person's chosen-public **work**, not republishing insults directed at a named handle into a
> permanently-indexed public tree. Nothing an argument below depends on was cut. Handles are
> reproduced as published.

```text
@HELIX_ANTITHESIS (1 day ago)
Going to blow it up this week. Thx for the mention

@thatchinaboi1 (10 hours ago)
Thanks for reviewing all of these papers. Every single one of them (over the past few weeks)
have been directly relevant to the Truth Preserving Cognitive OS that I am designing. I will
implement all the ideas from these papers directly into my Cognitive OS. Keep up the good work!

@derekw8195 (23 hours ago)
Ty so much for this content and ty ai algorithm for blessing my feed. Hello!

@ambamichal (1 day ago)
Enable auto dubbing please ; )

@Cyberladen (22 hours ago)
It's 3 state information triangulation it works like topographical triangulation with SIGNIT
to approximate your target data

@hajaani6417 (1 day ago)
If your brain start to hurt then mine will stop to work

@westernheritagenetwork1858 (1 day ago)
Nice but this is the wrong approach to this solution.

@animeplustrance (1 day ago)
Oh really, then what's your ' correct' approach

@westernheritagenetwork1858 (1 day ago, replying to @animeplustrance)
[opening two sentences elided — personal characterisation of the other commenter]
This published article like many are purely for the sake of being published. Making the
assumption that an article from Tsinghua University must be worthwhile would be an ignorant
stance. I would say I hope they understand why this approach is both needless and inaccurate,
but as my team has already gone well past this limitation I am glad they are behind. As for
the better solution I will put it simply so you can understand. The solution is to stop trying
to make the harness do everything The model has a design flaw and currently everyone is
constantly compensating for it. Changing the model design fixes that problem as well as a
large number of others. The harness codebase should be reduced by 90 percent.

@thatchinaboi1 (10 hours ago, replying to @animeplustrance)
[elided in full — personal characterisation of another commenter, no technical content]

@AceHack00 (at capture time)
@westernheritagenetwork1858 Changing the model design seems irrelevant for this problem; it's
turn-based. What's needed is model context design and model context window compression that
keeps long-running context and ontologies. We should try to come up with an ontology reduction
over either model or harness upgrades.
```

Aaron's own comment is quoted and engaged in
`docs/research/2026-09-10-abstraction-agent-elicits-variables-not-weights-and-falsifier-latency-sets-the-proposers-value.md` §4a.
