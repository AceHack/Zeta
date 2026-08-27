# Level1Techs — model routing, Switchyard, and the data flywheel (auto-transcript)

> **Third-party content — quarantined for study.** Zeta claims **no authorship** and asserts **no
> license** over the material below. It is preserved verbatim, with attribution, as
> quotation-for-research under the policy in [`README.md`](README.md). On a good-faith request the
> whole file is deleted; no analysis of ours depends on it remaining present.

| field | value |
|---|---|
| **Source** | YouTube — <https://www.youtube.com/watch?v=-IGB6Avxwgo> |
| **Channel / author** | Level1Techs (Wendell Wilson) |
| **Nature** | Machine-generated auto-transcript with timecodes, as captured |
| **Ferried by** | Aaron, 2026-08-27 — *"this is very important and very close to exactly what we are doing"* |
| **Our analysis** | `docs/research/2026-08-27-the-data-flywheel-is-our-architecture-and-our-corpus-is-the-part-nobody-else-has.md` |

Timecodes and transcription errors (`Neotron`/Nemotron, `Quinn`/Qwen, `Laura`/LoRA, `omnisient`,
`seuite`/C-suite) are **left exactly as captured** — correcting them would make this a paraphrase
rather than a preserved artifact.

---

```text
0:00
Your company is burning money. It's
0:02
literally setting money on fire on your
0:04
AI tooling. You know it. I know it.
0:07
Your boss probably doesn't know it.
0:11
Maybe you should send him this video.
0:12
It's kind of an oblique and subtle
0:14
suggestion that maybe they pump the
0:16
brakes on the AI stuff. The trap isn't
0:20
just paying $25 for only a million
0:23
output tokens. I mean, that should have
0:25
cost pennies. The bigger trap is turning
0:28
the judgment over to the AI because
0:30
increasingly what the tooling encourages
0:32
you to do is to just turn it loose and
0:36
let it do the thing. Can you tell he's
0:38
not happy with the codec updates? Uh,
0:42
more on that in a minute. [music]
0:49
As software engineers, of course, of
0:51
course we want labor augmentation. There
0:54
has never been enough labor to do
0:56
everything that we want to do in
0:57
software engineering. I mean, give me
1:00
another programmer who can read every
1:02
file and work all night and never gets
1:04
bored and costs almost nothing long as
1:08
you're not sending it to the cloud. And
1:09
we probably, you know, we probably do
1:11
get roped in at least a little bit
1:13
helping the rest of the company adopt
1:16
this AI thing as software engineers for
1:18
the company. And that probably turns
1:20
into, well, just go buy this thing and
1:22
turn it loose. No, no, no, no, no.
1:25
That's the aforementioned burning money
1:27
for warmth that I'm warning you about.
1:29
So, yeah, turn over nothing. We devs, we
1:34
still want to supervise. We want to
1:36
structure. We want to be confident that
1:38
in our brains, we have built an
1:40
understanding so that we can understand.
1:41
We want to know what problem we're
1:43
trying to solve. We want to do work that
1:46
that ultimately others value. I mean,
1:49
folks, this is very, very basic stuff.
1:52
It applies to AI. And I've seen some
1:54
disasters where almost everyone has lost
1:57
sight of this really basic stuff. Now,
2:00
for AI tooling, I want to know what it
2:02
did. I want to know what what reasoning
2:03
it had, what led to the next step, what
2:04
information it used when it failed. I
2:06
want to know what circumstances led to
2:09
that failure and then what happened
2:10
next. What corrective actions did the
2:11
humans take to help the AI? That is a
2:13
process that we have to build. That is
2:15
not a product. But today some of the
2:18
most important software components that
2:19
lets anyone build a robust type of
2:21
process like that around AI adoption in
2:24
their company that is getting a major
2:26
upgrade and that is what you in the
2:28
janitorial and IT forces the the
2:31
janitorial core should know. Switchyard
2:34
switchyard is a key component of that
2:35
from Nvidia. It's a supervision
2:37
architecture for routing user requests
2:40
to different AI models. it it's kind of
2:43
like task router specialized local
2:47
worker or a specialized worker or a
2:49
customized worker or a small model or
2:51
something an observable result tool
2:53
trace or an evaluator and then you can
2:56
accept or escalate that to a stronger
2:58
model. It's
3:00
human supervision is a big component of
3:02
this and that is important to me and I
3:06
think that's probably important to you
3:06
too. That's probably why you're watching
3:08
this video. Nvidia is also launching
3:10
Neotron 3.5 Lightning, which is a 30
3:12
billion parameter model that's meant to
3:13
help companies with this kind of
3:16
observational structural flywheel. Or at
3:18
least I found that it fits really well
3:20
here. The model isn't the news, though.
3:23
It's the software tooling that Nvidia is
3:25
providing that companies can take and
3:27
customize and run with this. And you can
3:30
customize the model. It's never been
3:31
easier. The model that's customized
3:34
that's small can beat a Frontier model
3:36
because the Frontier model is never
3:37
going to be omnisient. I promise you. So
3:40
what I'm saying is you take the small
3:41
model, you customize it based on how
3:43
your user users are using it or the data
3:44
or whatever and then that is going to
3:46
beat the frontier model every time
3:48
because you can't expect the frontier
3:49
model to be omnisient. That's not how
3:50
that works. So when I say you need an
3:53
organizational structure here to
3:55
incorporate this and something clicks
3:57
for you immediately, you spot three
3:59
advantages. Cost, don't spend opus money
4:01
on a task that Quinn can do.
4:03
observability. You know what component
4:05
did what where in your organization and
4:09
organizational learning. Every routing
4:11
decision, every escalation, every
4:13
interaction that your users have or your
4:15
other fellow devs have, this is a
4:17
secondary data set that you capture to
4:20
understand how your folks are using AI.
4:22
And this imho is the only path to
4:25
sanity. really can't underscore how
4:27
important the easy customizability
4:29
aspect of this is because with this tool
4:32
you're building a data set. This is it's
4:34
kind of secondary to the task. But the
4:36
data set about how your folks are using
4:37
AI really it's the only path to sanity.
4:40
And with the easy customizability of
4:42
local models and the data set that
4:46
you're building based on how people
4:48
actually use stuff, something magical is
4:51
going to happen for your organization in
4:53
terms of cloud token cost.
4:56
and spend. Oh, incidentally, I think
4:58
we're getting really close to the high
4:59
water mark where the finance bros pump
5:01
the brakes a little bit on this AI
5:02
spending, which may lead to relief in
5:04
other sorts of scenarios because
5:07
finally, your company does not need to
5:08
spend all of this money on frontier
5:11
models for just every little task. I
5:14
mean, it makes sense intrinsically when
5:16
you say it like that. Yeah, helping Bob
5:18
with his PowerPoint presentation, do we
5:19
really need a $25 per million token
5:22
model helping with that? No. No, we
5:25
don't. But how do we manage that? Goes
5:27
for software engineering tasks, too. You
5:30
already know it's lunacy that we would
5:33
use the frontier model for everything.
5:35
But let me give you the context and
5:36
vocabulary to really drive that point
5:39
home with this new stuff. Now, [snorts]
5:42
that the the cloud tokens, they probably
5:44
get spent on other things ultimately,
5:46
robots,
5:48
designer drugs, cancer research. Maybe
5:50
that part doesn't slow down. But the
5:51
days of Opus helping you remember the
5:54
order that the arguments should go in,
5:56
those days should be over. And it's
5:58
important to your corporation's bottom
5:59
line that those days should be over. So,
6:00
let's take a look at this at a piece at
6:02
a time. This machine behind me is
6:04
running a dual RTX Pro 6000. This is the
6:07
HP Z8 Fury that I reviewed previously.
6:09
There's some forum writeups and how-tos,
6:10
and there's been fun stuff we've been
6:12
doing with this platform. This platform
6:14
can accommodate up to four high-end
6:16
GPUs. Right now, it's got two RTX Pro
6:19
6000s in it, 96 gigs of VRAM a piece,
6:21
but this platform will do 384 gigs of of
6:24
GPU memory right in the box. Check out
6:26
my other videos in the forum posts if
6:28
you're more curious about our HPZ
6:30
workstation and you want to go down that
6:31
rabbit hole. Right now though, this
6:33
machine is a literal flywheel connecting
6:36
all of these pieces together. It's
6:38
running the model router Switchyard from
6:41
Nvidia. It's running two AI models, a
6:44
small model and a much larger model. Uh,
6:46
but these models are customizable
6:49
without full retraining. And that's kind
6:53
of becoming table stakes for these open
6:55
models. And that's part of how a small
6:57
model can beat a frontier model at
7:00
specific tasks. And I've got the
7:02
research papers to back that up in the
7:04
forum thread. You should check that out.
7:06
Conceptually, this thing plugs into
7:09
something that Nvidia has been working
7:10
on here for a while. The data flywheel.
7:13
It's it's a structural concept. It's not
7:15
even really about Nvidia or Nvidia
7:17
products or or anything like that, but
7:20
more about how you can structure process
7:22
changes with the new advanced fancy
7:24
pants AI tools in your company, but
7:26
without the setting money on fire for
7:29
warmth aspect of that.
7:32
Their architecture is almost comically
7:34
explicit about this. instrument the AI
7:37
application, which means log the
7:38
production traffic, build evaluation and
7:41
fine-tuning data sets from those logs,
7:43
and then evaluate smaller models,
7:45
customize them, and promote the ones
7:46
that work. The original blueprint
7:49
implementation is now uh deprecated for
7:52
new production deployment on GitHub, but
7:55
it's still useful conceptually, like for
7:57
me mentally, working on this and then
8:00
building my own thing with Switchard is
8:01
kind of how I got here. But that's not
8:03
the part that's running on the
8:04
workstation behind me anyway. I mean the
8:06
workstation also like the router has
8:08
still has access to the Frontier model
8:10
subscription that's in the mix. The
8:12
router here can reach it but also if my
8:14
team springs for some giant GB300 class
8:17
system somewhere else you know bigger
8:19
local AI fine the router that's on here
8:22
can reach that too. It's still local to
8:24
the organization. It's just not local on
8:26
this machine but that router can reach
8:28
all of those components wherever they
8:30
are. the application. Ideally, our users
8:34
and what they're doing don't really care
8:36
about where the intelligence came from.
8:38
It's all routed through here. In my
8:40
case, Nvidia has clearly seen the
8:42
structural implications of this coming
8:43
and I think probably also the economic
8:46
implications, the ones that I was kind
8:47
of hinting about about demand and AI and
8:50
all this other sort of thing. That's why
8:52
I'm strongly encouraging you to tool up
8:54
on this and learn to self-service. Even
8:56
if you you just want to throw money at
8:59
cloud AI, it would be irresponsible not
9:02
to build something like this just to get
9:03
visibility into what your users are
9:06
doing. And if that structure can also
9:09
save you a ton of money with no extra
9:11
effort really on top of that, I think
9:14
that speaks to the mind of the seuite
9:17
does it not? Now Nvidia also has emotron
9:21
orchestrator 8B which was running on
9:23
here too. I was using that previously
9:26
that's older but there's a lot of useful
9:29
diagrams and explanation with the their
9:31
tool exh orchestrator and you should
9:33
check that out to understand more about
9:35
how this kind of thing running locally
9:37
like you can just download this and run
9:39
this on your own hardware. This is not
9:40
cloud stuff. This thing is 8 billion
9:43
parameters. It's tiny. It'll run on a
9:46
laptop. Not super fast but it definitely
9:49
will run on a laptop. And so even though
9:51
it's 8 billion parameters, we're not
9:53
asking the 8 billion parameters to know
9:56
everything. It's an orchestrator. It can
9:58
call search. It can call code tools. It
10:01
can call other specialist AI models. It
10:03
can call giant general purpose models
10:05
including GPT5 and claude opus. On uh
10:08
humanity's last exam, which is a
10:09
benchmark, Nvidia reports the
10:11
orchestrated system scored a 37.1%
10:14
versus 35.1% on GPT5. Now keep in mind
10:17
this is 2025 but at 30% of the cost and
10:20
two and a half times faster. So that
10:22
little model was better at the task
10:24
because it was in a tool calling
10:27
ecosystem
10:28
like is on this. It's not trying to be
10:31
omnisient like the next version of GPT
10:33
or claw. Now the orchestrator 8 billion
10:36
in 2025. It's still useful but now we
10:39
have Neotron 3.5 lightning that is 30ish
10:42
billion parameters. It's fast. It's fast
10:45
like the 8 billion parameter model. It's
10:47
local. And according to Nvidia's
10:49
pre-release material, and I got to play
10:50
with it a little bit ahead of time.
10:52
They're not just throwing weights over
10:53
the wall. What they're doing here is
10:55
they're giving you the full LoRa, the
10:57
the supervised fine-tuning,
10:59
reinforcement learning. It's recipes and
11:01
training data. This is the machinery
11:03
that you need to turn that generic model
11:07
into your model with customizations
11:09
without full retraining. Now, Nvidia
11:12
didn't mention Orchestrator 8B in their
11:14
release or, you know, I may be off base
11:17
in here, like connecting those in my
11:19
brain, but because I was trying to build
11:20
practical useful things for business, I
11:23
sort of connected the dots here. And for
11:25
business use cases where I'm doing a
11:26
little bit of customization and tool
11:28
calling in my early testing, Lightning
11:31
3.5 behaves much more like what I want
11:33
here. Speed and, you know, a relatively
11:38
sophisticated model, but that is capable
11:41
for routing tasks, route it to the
11:43
appropriate model and tool calling for
11:45
the work that I want to do. And so you
11:47
add in retrieval, augmented generation,
11:48
and a vector database, which are things
11:50
that I can't really get into in this
11:52
video, but all of that will live happily
11:55
here on our HP workstation. And the
11:57
generic model, you know, it doesn't
11:59
magically know your your current
12:01
internal documentation or your inventory
12:04
or customer state or whatever changed
12:06
yesterday. But we give the system
12:08
retrieval and tools so that it can get
12:11
the authoritative information that it
12:13
needs.
12:15
And uh even if there were a path to do
12:17
that with a frontier model, do I really
12:19
want Open AI to have access to all of
12:20
that or or anthropic? No. No. No one
12:23
wants that. So on this local machine,
12:26
this is an enormous intelligence and
12:28
utility multiplier over simply handing
12:31
every problem to one generic model and
12:34
expecting it to somehow have gone full
12:36
veger and learned everything that was
12:38
learnable. No, this is a system of
12:41
systems and that system assembles the
12:44
resources it needs to serve the request
12:47
to find the answer and anything else is
12:49
akin to asking that gigantic cloud model
12:52
to cosplay as an omnisient intelligence.
12:54
Um
12:57
I guess that's actually what the current
12:58
seuite implementation strategy with
13:00
codeex CLI or cloud desktop might
13:03
actually be. I mean that's certainly
13:05
that's the impression that I get from
13:07
some emails I've been copied on. I mean
13:08
is that is that what you think folks
13:11
engage below? So that can become the
13:14
power of model routing and this is where
13:16
sophisticated buyers are moving in the
13:18
industry and even outside of Nvidia
13:20
stack take Quinn 3.6 how smart is the
13:24
27B Quinn 3.6 six, you know, how's the
13:26
35B A3B stack up? Can it code? Yeah.
13:30
Yeah, that's all fine, but no, that's
13:33
not what I mean. I mean, it's good, but
13:35
but also no. That's not the part that I
13:36
want to look at and squeal with
13:38
excitement about Quinn 3.6. Quen 3.6 is
13:40
disruptive because it's insanely well
13:44
documented for customization. Far under
13:47
reportported is how approachable the
13:48
customization ecosystem has become with
13:52
modern open models like this. And Nvidia
13:55
is leading in some respects and uh
13:58
embracing the openness in other respects
14:00
which is exactly what most businesses
14:03
need to embrace this and run
14:06
you know run with custom like run with
14:08
cool stuff. I mean you got full fine
14:09
tuning Laura Qura SFT GRPO Megatron you
14:13
know multiGPU reusable data formats
14:15
runnable examples. The Quinn
14:17
documentation literally gives you the
14:19
data set structure and starts walking
14:21
you through commands, you know, MS Swift
14:25
supports full parameter tuning, Laura,
14:27
Q, Laura, you know, distributed
14:29
training, reinforcement learning
14:32
methods, including uh GRPO, DPO, PO.
14:35
Nvidia has done exactly the same kind of
14:37
thing with their playbooks and the
14:40
models that they've released recently.
14:42
We We don't need a machine learning PhD
14:46
for AI customization projects anymore. I
14:48
can do it myself right here. We, the
14:50
unwashed IT masses, the lowly computer
14:52
janitors can reach this level of
14:54
functionality for our organizations on a
14:57
workstation like this sitting on a desk.
14:59
And that's important. I mean, my go-to
15:02
has always been building observability.
15:04
I mean, that's kind of fundamentally an
15:06
IT problem. That's fundamentally where
15:07
it starts. The CIOS and the CTO's are
15:09
worried about that. We need to
15:11
understand what the users are actually
15:12
doing. How does it, you know, service
15:16
the customer or make a better customer
15:17
experience. So now we can take
15:18
observability on how the AI is actually
15:20
being used, evaluate it and
15:22
reinccorporate it into the system
15:23
serving those same requests. Suppose on
15:26
day one I have to send 80% of the
15:28
requests through the model router here
15:29
to a frontier model and pay $25 per
15:32
million tokens. Okay, fine. But if the
15:34
workloads contain repeatable patterns
15:36
and I'm capturing and evaluating those
15:38
prop those patterns properly, I should
15:41
be able to start moving those classes of
15:42
requests downstack so that we're not
15:45
sending all of those to the frontier
15:46
model, maybe a different cloud model,
15:48
maybe a different local model. Where
15:49
does the frontier model succeed where my
15:51
local model fails? That's potentially a
15:53
training example. Human corrects the
15:55
result. Another useful signal. Uh the
15:58
same task that users are asking for
16:00
10,000 times. Maybe the generic model
16:03
shouldn't keep relearning how our
16:05
company does stuff from a system prompt
16:07
and we should customize it. We can
16:09
evaluate. We can curate. We can
16:11
fine-tune. We can deploy. We can measure
16:12
again because you know what's the
16:14
saying? It's like you can't improve
16:16
anything you're not measuring. That's
16:18
what's going on here. That's kind of the
16:20
flywheel of intelligence. And you also
16:22
get free token savings or you get token
16:24
savings out of that because it's always
16:26
going to be cheaper for the smaller,
16:28
less intelligent local model to be able
16:30
to do things. So this is what our
16:32
process becomes. And the outcomes are
16:33
twofold. Like I say, economic the
16:37
frontier inference becomes an exception
16:40
instead of the default. And
16:41
organizationally the company stops
16:43
renting all of its intelligence but also
16:46
starts accumulating some of its own. I
16:48
mean the the finance bros are maybe
16:51
starting to get clued into that. And you
16:53
it folks can probably focus on the
16:55
economic aspect of what I'm saying
16:58
because you retain capital. um and
17:02
capture institutional knowledge if you
17:04
implement this process where you weren't
17:06
before. I mean, this is a this is a
17:08
win-win that really will speak to your
17:10
seuite. Now, I promised we'd get into
17:13
the brass tax of how the customization
17:17
happens and uh that sort of stuff. So,
17:20
check this out. This is Laura. Think of
17:23
Laura as basically a small patch for a
17:26
big AI model. That's really all it is
17:29
here. here and the model is set up to
17:30
handle this. Neatron 3.5 Lightning is
17:32
already I mean it's a 30 billion
17:33
parameter model mixture of experts. It
17:35
only has three billion parameters active
17:36
at any given time. Nvidia is explicitly
17:39
pitching it as a model that you're
17:41
supposed to customize. Smaller models
17:44
fine-tune faster, cheaper, and on much
17:47
more modest hardware. I mean, I know
17:50
it's expensive, but it's not, you know,
17:52
a quarter of a million dollars. Come on.
17:54
You freeze the base model and you train
17:56
a comparatively tiny set of additional
17:58
weights to teach the small model your
18:00
particular job. And operationally,
18:02
Nvidia has already built the other half
18:05
of this. So, NIM can keep one base model
18:08
resident and dynamically load and unload
18:11
the Laura adapters while it's running
18:13
and serve multiple specialized adapters
18:15
from that same model that conserves
18:17
resources and produces a better user
18:19
experience. So maybe there's one capable
18:21
base model here and accounting gets the
18:23
accounting adapter and software
18:25
engineering gets the code review adapter
18:28
and maybe support you know end user
18:30
support or customer support gets the
18:31
support adapter. That weird internal
18:34
product that hasn't been documented
18:36
since 2017. It gets the adapter that
18:38
contains the dark knowledge known only
18:40
to Gary. Gary can finally go on
18:43
vacation.
18:45
Maybe the interesting part is the system
18:49
around the model around switchyard and
18:53
all of the componentry that's feeding
18:54
switchyard. It's the secondary effect
18:56
you get from that. The data set that you
18:57
accumulate showing how people actually
19:00
use the system is ultimately probably
19:03
the most important thing. It's it's not
19:06
I don't even think it's accurate to call
19:07
it AI telemetry. It's institutional
19:09
knowledge and it shows what people are
19:11
actually asking the system for because
19:13
their expectations in reality uh
19:17
probably not great. And I guarantee you
19:19
a vast majority of those those requests
19:21
users are making do not need to be
19:22
served by a model that costs $25 per
19:25
million tokens. and the IT folks, you
19:27
get a clear accounting of where users
19:29
get stuck, what workflows repeat, what
19:31
the organization thinks is simple and
19:34
they're like trying to do with AI, but
19:36
isn't because of reasons that you'll
19:38
have insight into. But most importantly,
19:41
which processes are actually producing
19:43
useful results for staff and customers.
19:45
That's the lowhanging fruit. All this
19:47
internal corporate knowledge is, you
19:48
know, at almost every company is usually
19:51
uh captured very badly, if it is
19:53
captured at all. But this facility like
19:56
building this in as a process to capture
19:58
this that is what I'm telling you to do
20:00
because now you've basically got all of
20:02
the components right here to build that
20:04
paint by numbers style. So this blog
20:06
post from February also helps explain
20:09
and fill in some of the gaps a little
20:11
bit more. It's a complete pipeline for
20:12
taking small amounts of domain
20:14
information, generating structured
20:17
synthetic training examples and
20:19
automatically evaluating them. you could
20:22
filter them down and produce a data set
20:23
that's ready for fine-tuning or
20:25
distillation. NVIDIA's explicit pitch is
20:28
that the workflow is making the model
20:31
specialization accessible without
20:32
requiring enormous data sets or machine
20:35
learning PhDs working on this. This is
20:37
literally the flywheel. The structure
20:39
here saves tokens and actually tells
20:41
you, you know, what model your
20:42
organization actually needs for the
20:44
problem at hand instead of just
20:46
shoveling dollars into the AI black hole
20:48
and hoping for a good outcome. just, you
20:50
know, spam the the giant AI with a
20:52
million context with all the stuff.
20:54
Another way I know I'm right here is
20:56
that there's been a recent CodeCli
20:57
update. That's what I was complaining
20:58
about in the beginning. In my own use,
21:00
I'm seeing much less useful insight into
21:02
why the agent is doing particular
21:04
things. I'm not alone in noticing this.
21:06
Uh there's a visibility problem here.
21:08
There are open issues on the Codeex
21:10
repository where reasoning summaries
21:13
that were present in the session log uh
21:16
are not being surfaced to the UI.
21:18
they're they're not showing up and so
21:19
it's like okay well maybe I need to
21:21
capture the session log and I'm not even
21:22
sure that the session log always
21:24
captures everything that I'm expecting.
21:25
Now I have a hypothesis about why that's
21:27
happening and it's kind of a dark
21:28
pattern. Highquality model outputs and
21:31
task traces are extraordinarily valuable
21:34
if you're trying to train a cheaper
21:36
specialized model which is exactly what
21:39
everybody that spends money on cloud
21:40
tokens should be trying to do at this
21:41
point. That's that part's not
21:43
controversial. OpenAI has a product
21:45
called model distillation that's built
21:47
around taking outputs from Frontier
21:48
models and using them to fine-tune
21:51
cheaper models for specific tasks.
21:54
[laughter] You know, those Halcon days
21:56
of like a year and a half ago, they were
21:57
encouraging customers to do that. So, I
21:59
think there's at least an economic
22:00
incentive for Frontier providers not to
22:03
make every useful internal signal
22:04
trivially exportable to somebody
22:06
building this kind of flywheel where we
22:08
want to run stuff locally and maximize
22:11
value. And again for the seauite
22:13
listening here the path to ruination is
22:16
to abdicate your you your human
22:18
reasoning your wetwware reasoning and
22:21
just offload all of that to the cloud.
22:23
The smartest folks in your organization
22:25
want the execution to be observable.
22:27
They want to know what resources were
22:29
used. They want to know what was
22:31
decided, how the users corrected after a
22:34
failure. And they want to know
22:35
ultimately what worked. And
22:39
you need to build something like this to
22:41
capture that kind of information. I
22:42
mean, besides being the responsible way
22:43
to supervise automated labor, the
22:45
information here will feed the system,
22:47
which makes the next version of the
22:49
system better, which will make, you
22:51
know, your company a more functional
22:53
company. I've got a full write up to go
22:54
with this video with references to what
22:56
I remember reading over the last few
22:58
months and the new launches and
23:00
everything else on the forum that that
23:01
is linked below because there are
23:03
academic papers that you know suggest
23:05
things like if we you know like the LLM
23:08
router paper and some other things to
23:10
back up what I'm saying and also expand
23:12
on it and give you some ammunition for
23:14
the the boardroom or or uh the seuite or
23:18
the rest of your tech team depending on
23:20
what it is that you're you're trying to
23:21
build for for integration.
23:23
I think that with these pieces, this
23:25
structure is how you can responsibly
23:27
integrate this, but with also you know
23:31
like there is a real danger I think of
23:33
of AI psychosis in the seauite if I'm
23:36
not overstating that for comedic effect
23:40
and building this kind of structure
23:42
gives you some observability and that's
23:44
really the bottom line here. It's like
23:46
you can't fix what you don't measure.
23:48
And it's like, well, this this answer
23:50
from this system feels really good, but
23:53
then if you don't do an accounting of
23:55
like, okay, well, we tried to take that
23:56
answer and we took it apart and it fell
23:57
apart under scrutiny and reinccorporate
23:59
that into the system, then you you're
24:01
not learning, you're just spinning your
24:03
wheels. So very excited why the
24:06
switchyard updates and Nemo Neotron 3
24:09
lightning, but more importantly that the
24:12
um state-of-the-art for local and open
24:15
models is changing in terms of both
24:17
documentation and implementation to make
24:19
it easier for non-machine learning PhDs
24:22
to pick it up and customize them and
24:24
modify them and get a useful result from
24:27
a model that is under a 100red billion
24:29
parameters. So it'll it'll basically run
24:31
on anything and that's exciting. I
24:33
wonder this level one. It's been a a bit
24:35
of a ramble, but also I think that, you
24:37
know, this might be the high water mark
24:38
and like now those cloud tokens may be
24:40
used for robots and other things, but I
24:42
think this is going to be the high
24:43
watermark for where we see those tokens
24:46
being used in a cloud context because it
24:48
literally does not make sense for these
24:49
kinds of tasks to run in a cloud
24:50
context.
24:52
Yeah. Well, we can chat about that on
24:54
forum. I'm wonderless level one. I'm
24:55
signing out. I'll see you there. [music]
```

---

## Aaron's framing when ferrying this (2026-08-27)

Recorded here because it is the reason the file exists; the analysis develops it.

> *"the dataset we are using are our pr archives and our shadow logs and any decorrelation between
> agents, our dataset is based on dataset which is very different than most because of our sheer
> number of adversarial conversations and our focus on decorrelation, most training data ignores
> this almost completely."*
