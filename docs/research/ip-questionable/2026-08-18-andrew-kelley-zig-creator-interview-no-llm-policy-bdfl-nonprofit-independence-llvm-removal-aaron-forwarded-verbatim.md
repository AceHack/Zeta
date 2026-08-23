# Andrew Kelley (creator of Zig) — interview, forwarded by Aaron 2026-08-18

> **PROVENANCE / IP STATUS.** This is a YouTube interview transcript, forwarded
> verbatim by Aaron and filed here **because** its IP status is uncertain — that
> is what `docs/research/ip-questionable/` is for. It is third-party
> copyrighted speech, preserved as an internal research ferry, not authored
> here and not for republication. Source:
> <https://www.youtube.com/watch?v=iqddnwKF8HQ>. Speaker: **Andrew Kelley**,
> creator of Zig and lead of the Zig Software Foundation. Timestamps and
> section headings are as supplied.
>
> **Preserved verbatim per the ferry discipline** — forwarded material is
> someone else's memory and is not curated, summarised, or filtered on the way
> in. Aaron's framing on receipt: *"this is great info on zig, one of my
> favorites after dotnet."*
>
> **Register: MIRROR.** Nothing here is a Beacon anchor for Zeta. It is one
> practitioner's stated positions, recorded because they bear on decisions this
> repo has already made. No claim in this document has been checked, and
> several are explicitly contested elsewhere in the industry.

## Why this was ferried — the live contact points, stated as questions not conclusions

Recorded so a later reader knows why it is in the tree. Each is a **resonance to
investigate**, not a finding:

- **Zig is a shipped byte-lock oracle here.** `src/wasm-dla/bytelock/dla-canonical-zig.wasm`
  is one of the six DLA substrate modules under test (see
  `.claude/rules/no-binary-in-proof-lineage.md`, the one exempt directory). The
  language's stated design priorities are therefore not academic to us.
- **"Avoid a dependency for your core product"** — his stated reason for removing
  LLVM. That is the same shape as the appointed-hub argument in
  `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`, arrived at
  independently and for engineering rather than topological reasons.
- **BDFL vs committee, and money as the corrupting input.** He states the
  hierarchical model exists to resist "oxidation from being in contact with
  money," and then says plainly it is *not sustainable* long-term. That is a
  live tension against §1 scale-free / §3 weight-free, and he does not resolve
  it — which is the honest part.
- **The no-LLM policy and "contributor poker."** His argument is not about output
  quality alone; it is about **mentorship as the point of code review**, and
  reviewer time as the scarce resource. That is a claim about incentives, and it
  is stated by someone running the tradeoff, not theorising about it.
- **TigerBeetle is a named competitor, and Aaron says why.** On receipt (2026-08-18):
  *"tiger beatle is one of the databases we are trying to beat, i really love their
  one time memory optimization and predictable latency, it's good for trading algos
  that don't do well with garbage collection random latency."* Kelley describes the
  same property from the language side — pre-allocate everything at start, never
  dynamically allocate again, so latency stays predictable — and frames it as Zig
  offering a **choice** between predictable-low-latency and GC-style
  high-throughput. Note this is a *latency-distribution* claim, not a throughput
  one: the win is the absent tail, and the tail is what a trading path cannot
  absorb. Adjacent in-repo: the DoP-knobbed ferry throttle
  (`.claude/rules/async-all-the-way-truthful-signatures.md`) is the same instinct
  applied to concurrency — one code path that is deterministic at DoP=1 rather
  than a separate low-latency mode.
- **The MIT-licence irony he names himself** — banning AI contributions while
  permitting AI training on the corpus. He calls it ironic and declines to
  resolve it. Filed as-is; declared irony is not detected irony.

---

## Transcript (verbatim)

I can do better. I can do better than C++. I can do better than Rust. I can do better
0:05
than Go. I can do better than JavaScript. Strict no LLM, no AI policy.
0:10
Why? Invariably garbage. $100 million. Would you take it?
0:15
I'm sorry, but we will not do what you say. And if you take your money away, we will survive. You moved Zigg's main repository from
0:22
GitHub to Codeberg. GitHub simply stopped working for us. We moved to Codeberg and now our continuous
0:29
integration server works again. When we tag 1.0, it will be like a a true
0:34
uncompromising labor of love. We will not have to be stuck with any like bad decisions. What's blocking it?
0:41
Um, well, ultimately, Andrew Kelly, we already have C, C++,

### Why Create Zig? Andrew Kelley Explains

0:48
Rust, Go. What made you build Zig anyway? Well, it's funny that you listed
0:54
those languages specifically because that is exactly the set of programming languages that I first tried to use to
1:02
build a digital audio workstation just before I pivoted to working on Zigg.
1:09
And when I tried to work on this project with each different language, I I ran
1:15
into a different set of of problems that I found insurmountable.
1:20
And at the end of this process, I concluded that no, it's not me that is
1:28
having a skill issue. It's the programming language that's the problem. And so from there, that's where I
1:34
developed the hubris of making a new programming language. Andrew Kelly, creator of Zigg
1:39
programming language, quit his tech job in 2018 to build Zigg full-time, run
1:45
Zigg Foundation on $670,000 a year. band AI.
1:51
What problems exactly? The first thing that I tried to do was make the digital audio workstation in

### How Rust, Go and C All Failed

1:57
the browser using JavaScript. And what I quickly realized is that this is too
2:03
high level. I don't have access to the computer's capabilities that will allow
2:08
me to make a compelling user experience in this digital audio workstation. So I
2:14
threw that out the window and I went to native programming language compilation.
2:20
The next thing I tried to do is is Go. And what I ran into with Go is uh number
2:27
one trying to interact with libraries like for creating a window or making
2:33
buttons or something like this using existing C code does not work very well with Go. And then I also ran into the
2:41
garbage collector problem. So, of course, if you're trying to do audio, you have a real-time deadline. If you
2:47
can't process the audio in exactly this amount of time, you get a glitch or a
2:52
skip, and it's completely unacceptable for a a live performance software like
2:59
the digital audio workstation is. So, then I got rid of Go. Now, I tried to
3:04
use Rust and this was before Rust 1.0. Uh, but
3:10
what happened is that I really struggled to write code that would satisfy Rust's
3:17
rules. And once I did satisfy them, I found that even trying to make little changes would cause a a cascade of
3:24
compile errors that would prevent me from making more progress. And I remember just feeling very frustrated
3:30
that I spent a whole month trying to get font rendering work and and then felt
3:37
stuck like I couldn't even make more progress after that point. So I gave up on Rust and I switched to C++. Then I
3:44
felt more productive at first. But what happened very quickly is that just a
3:50
little typo here, little mistake there would result in a memory corruption bug
3:57
that would cause me weeks in order to debug. This is just too slow. I I can't
4:02
create a project with this magnitude of difficulty when I'm these little
4:10
mistakes are costing me weeks and weeks over and over again. After that, I tried
4:16
C++ but C style. So I actually would compile with the C++ compiler, but I would link
4:24
with the C linker and that would give me an error if I tried to use fancy C++
4:30
features. So that limited me to only templates and a few other things. But even that, it was the same problem. It's
4:37
just too easy to shoot yourself in the foot with C++. And for me that was when I said I can do better. I can do better
4:44
than C++. I can do better than Rust. I can do better than Go. I can do better than JavaScript. I can do better than D.
4:50
That was my hubris. Now Zeke, what is Zeke used for? What

### What Is Zig Used For

4:57
problems does it solve? Zigg is used when you want to have full control over the computer. You don't
5:03
want to leave any performance on the table. um you want to have the best possible um performance and the best
5:09
possible uh memory usage and ultimately you want to craft a compelling user
5:14
experience. That's the most important thing. Just before starting Zigg, I took a new philosophy for myself to not
5:21
compromise on the user experience. So I wouldn't I would never say oh because I'm using Go or because I'm using
5:28
JavaScript or something like this, I have this limitation in the software. I
5:34
would say no that's not acceptable. I will change my tool chain if I have to in order to make the computer deliver
5:41
the the best experience for the user. And for me at the time that was a different way of thinking about
5:46
programming. It's it's not what can I do with my tool chain. It's what can the
5:52
computer fundamentally do and how can I get it to do this using any possible
5:57
tool chain. Maybe even one that I would make. Let's talk about applications. Where is

### Who Uses Zig in Production

6:03
Zeke used? Uh today one application that comes to mind would be Ghosty. So this is a uh terminal
6:11
emulator created by Mitchell Hashimoto. Um this is a really nice project written
6:17
in Zigg because um the code is very high quality. Mitchell does a really good job managing the community and fuzz testing
6:23
and making sure that it's good quality. There's also uh Tiger Beetle. Tiger Beetle is a a financial transaction
6:31
database that's written in Zigg and they uh batch
6:36
operations together to achieve um a level of efficiency that is um not
6:43
common in that space because other solutions are trying to use Postgress SQL or or some kind of relational
6:49
database like this and building the OLTP on top of it. But they have they have built a special purpose database that's
6:55
a thousand times faster than that kind of strategy. That project is really focused on
7:02
um pre-allocating resources and then never failing after that point. So when
7:07
you start that project when that database runs it will pre-allocate all the memory you will ever use and and
7:13
then that from that time it will never dynamically allocate anything ever again and then that keeps their latencies very
7:19
predictable and very consistent for that database. So that's a good example of where using Zig was a nice choice
7:26
because um Zigg offers you the choice between optimizing for low latency,
7:33
predictable latency and what I would call the opposite of that which would be kind of garbage collection high
7:40
throughput if that makes sense. What about Bun? Bun is a JavaScript

### Bun, Anthropic and Zig for AI

7:46
engine that uses JavaScript core and a bunch of other C++ libraries and then
7:53
all the glue code is is written in Zigg. That project was recently sold to
7:58
Anthropic I think and we've seen a lot of people uh consequently getting into
8:05
um using Zig for AI. I also heard that Uber is using Zig. Yes, Uber is using the tool chain. Uber

### How Uber Uses Zig With Go

8:13
uses uh Zigcc to build uh some of their things for to cross compile for um ARM
8:20
64 and specifically they're using it with Go. So they have a bunch of Go code and the problem is that when you try to
8:26
cross-co compile Go code uh that part works but when you try to cross compile go code with with also C code in it uh
8:33
that does not work with Go out of the box. Um, but you can actually just use
8:38
Zigg as the C compiler along along with Go. And then now you have cross compilation also for your your C code
8:45
that the Go code depends on. By the way, why why is it called zig? Why is it called zig?

### Why Is It Called "Zig"

8:52
Uh, I wanted a short word that had zero Google results for
8:58
programming language. And that was true at the time. So if you search for Zig programming language, uh when I when I
9:05
named it, there was zero results. So I made a I made a little Python
9:10
script that just printed some random words and uh Zigg jumped out at me, so I picked it.
9:15
Why do you have the iguana as a muscos? It's a ziguana. Zigguana.
9:22
[laughter] Amazing. Well, uh Andrew, Zeke is in top five most admired programming languages.

### Why Zig Isn't 1.0 After 10 Years

9:30
Uh but no 1.0 release after 10 years.
9:36
What's blocking it? Um well ultimately uh 1.0 can mean
9:42
different things for different projects. So if we look at if we look at Go, they tagged 1.0 and they did not touch the
9:48
language for a very long time. Rust tagged 1.0 pretty early, but they have this feature called additions. And so,
9:56
uh, even though they maintain the backwards compatibility guarantees with
10:01
1.0, they still can change the language quite a bit. And writing modern Rust is still different than writing 1.0 Rust at
10:07
the time. So really, what is 1.0? It's a it's a backwards compatibility promise, right? The other thing I would say about
10:14
that is Zigsoft Foundation is not a startup. We
10:19
don't have any investment money. Uh, we don't have investors breathing down our backs. Uh we're a 501c3 nonprofit. We
10:27
don't have to crash and burn. You know, we don't have to sell. We don't have an
10:33
exit plan. Our plan is to make a great project and and keep improving it over a long period of time. Uh we have the time
10:39
to make steady improvements. We um we we're a very lean, very efficient, small
10:46
organization. Like we don't we don't burn through a lot of capital very fast. And so we're here to stay. you know, we
10:52
will keep improving Zigg until we get there and we don't have to do it prematurely. When we tag 1.0, it will be
10:59
like a a true uncompromising labor of love. We will not have to be stuck with any like bad decisions that that we had
11:06
to rush to to lock in. Well, I'll continue asking about that. Okay. Like there is a concept in

### "Worse is better"

11:12
software development called worse is better. Like ship fast, fix later. like PHP, Go,
11:20
they did that and they became huge. So
11:25
you choose the opposite. Why? This worse is better is a pet peeve of mine because
11:32
linguistically it makes no sense. Um so I think I think it's better to say doing
11:38
less with less uh versus doing more with more. I think
11:43
Zigg is a third option. We're trying to do more with less. So we still we still
11:50
want to offer great things, but we want to find that sweet spot where a little bit can go a long way. And you can you
11:57
can find this reflected in the language with uh for example the the ratio of of
12:03
a small amount of complexity of comp time feature to the high amount of
12:08
utility that you get from it. And you can find that reflected in the tool chain where just one one flag can tell
12:16
you tell the compiler to target a wildly different operating system and architecture and then we'll just work.
12:23
Do you think missing 1.0 users or company adoption?
12:28
I think it's no doubt that when we tag 1.0 we will see a sharp rise in adoption. That that's that's certain. Um
12:36
but for me the I I have my eyes on the long-term future. I want to make Zigg to be a language for the next 50 years and
12:43
I think we will start to see those pay off in this upcoming 0.16 release.
12:48
Can you share us maybe deadline for that? Yeah, this one. Well, how about this? We can we can make this a race. Okay. So,
12:55
you race to try to get this this video uploaded and I will race to try to tag 016 and we'll see who wins. Yeah. to
13:02
develop the language. You founded Zeke software foundation uh and in 2024 its total income was

### 670K Zig Foundation

13:10
$670,000. Who are your main sponsors? If you look at the blog post where I
13:17
presume you got this information from. Uh there's a nice pie chart that shows
13:23
um the the different parties that our income comes from. And I'm really proud of how diverse that chart is. A lot of
13:30
our sponsors are individual donors and uh and then apart from that we have a
13:36
nice healthy variety of different companies that we get donations from. So
13:42
we we don't have any single entity that can say hey you know you need to do this
13:49
or this we we could turn to any individual sponsor and say I'm sorry but
13:54
we will not do what you say and if you take your money away we will survive. It's a very mutual beneficial
13:59
relationship but just with healthy boundaries between between the business organizations.
14:05
Can someone of your sponsors uh influence how you develop Z? Well, they can influence it in the same

### Can Sponsors Influence Zig Development

14:11
way that anyone can influence it. They can participate on the bug tracker. They can send poll requests. Um they can chat
14:18
in the in the development channels. And you know ultimately it's it's it's
14:24
humans talking with humans. They don't have a secret high priority channel. You know, everyone's on on equal footing
14:30
here. Your salary is 154,000

### Andrew Kelley's $154K Salary

14:36
per year. Yes. Which is comparable to a senior engineer, but uh you are building the
14:43
entire language ecosystem. How do you decide on your own salary? Uh
14:49
this was decided by the Zig Software Foundation board uh when we had our
14:54
first board meeting and this was the median senior software engineer salary in New York City at the time which is
15:01
where the nonprofit was formed. It seems like in your question you know you're implying that maybe I deserve more money
15:07
which um thank you for the implication. Uh but honestly I feel upper middle
15:13
class. I feel like I get a lot of money and I can afford groceries easily and I
15:19
can afford to mortgage for a house in in Portland, Oregon where I live. So, I'm
15:25
comfy, you know, I don't I don't need more. And uh I like to to me the the
15:33
autonomy of having a lean nonprofit that
15:38
um that that that is sturdy and can withstand um a chaotic financial environment that
15:46
we are in today. To me, that is more valuable than having some more spending money because this is what allows us to
15:54
say, um, no, not yet. You know, we need a little more time for 1.0. Uh, this is
15:59
what allows us to, um, you know, this is what allowed us to, uh, raise the rates for our
16:06
contractors in a year where everyone was having massive tech layoffs. Uh, and I'm
16:12
I'm proud of that. I think that um I think that what we have is is a is a
16:17
healthy organization and to me that benefit it fills me with satisfaction that
16:24
having more income would would not fill. And if a large company offers Zeke say

### 100 Million Challenge

16:32
$100 million with no conditions, would you take it
16:37
$und00 million? So to put this in perspective, uh our um yearly annual
16:44
revenue has been less than $1 million every year. Maybe starting to approach it this year. So there's two there's two
16:52
limitations here I would say to this money. The first thing is sustainability
16:57
of the nonprofit. So what I would what I would not want to do is take that money
17:05
and then spend a significant fraction of it and so that I would need to get more
17:10
of that amount of money in the future. That would be a problem because now I you know whichever
17:17
instead of instead of a a surprise a gift now we need it. Now we have an
17:22
obligation to do to try to get it again. Um and then the second limitation here
17:28
would be uh team size. I'm managing a team of five. I don't think I have the
17:35
skills to manage a team of much more than that. Nor do I have the motivation
17:40
to do it. I would certainly not take this money and and and and then just
17:45
grow and and become a manager of 100 people or something like this. But you
17:50
know what I could do is if if it's a $100 million, I could take that money, put it into the bank, and then never
17:57
have to fund raise for 100 years. So, sure, they'll take the money, but not
18:02
grow. You see what I mean? I see. Because I think what the question is fundamentally asking is, would you grow
18:08
if you had the opportunity? And I think the answer is a little bit. I think we could have more than five people, but I
18:15
think maybe more than 10 would be pushing it for me. So uh team of five your salary is that like all the money

### Where Zig Foundation Money Goes

18:23
from the foundation? Um the the foundation has one employee which is me and uh and then five
18:30
contractors. Um we have other contractors who are not active uh but about about five who are
18:37
paid uh full-time and I believe the number was 91% of that money last year
18:44
went to paying contractors to to work on the project. So the the vast majority of
18:49
the income that that we get from donations is going directly towards paying contractors for work on the Zig
18:57
project. being this open uh with the money is it is it because some obligations that nonprofit has or it's
19:04
something important to you as well? There's some obligations that nonprofits have. So this is a United States 501c3
19:13
nonprofit and I'll take this moment to point out that it's different than a 501c6.
19:20
Um that the 501c6 is a business league. That's what the Rust Foundation is. So
19:26
you know Amazon, Netflix, Microsoft, Meta, they all have a shared interest in
19:33
the Rust project succeeding. So they all donate to this 501c6 so that it can help
19:38
them like lobby the government and I'll do all these things. 501c3 not allowed to lobby the government and we don't
19:45
have other businesses that are in interest. It is it is serving the mission statement alone. That is the
19:52
purpose of the of the 501c3. the blog post where we we break down this income
19:57
and these expenses and share more of these details. Um that's voluntary transparency. Um but that also acts as
20:05
marketing for us because we do good on these metrics. So it helps people to have confidence that we're doing a good
20:11
job and it serves as an opportunity to fund raise as well. In 2022, you left Reddit and Twitter.

### Why Zig Left Reddit and Twitter

20:18
Why? I think that posting on these websites is is becoming a lot like posting on slash dot or dig. They're
20:25
just becoming kind of irrelevant anymore. You know, we're software engineers. We want to do as little marketing as possible. And so these
20:32
things just aren't um giving us um returns on our investments anymore. uh
20:38
we're starting to um do more inerson events like Zigg Day and as opposed to
20:44
social media where you know we interact with trolls or just the the algorithm
20:50
controls you know what gets seen and whatnot. Um this this is what we're currently thinking is is a more better
20:56
investment of our focus to to grow the community. Then in late 2025 you took another step.

### Why Zig Left GitHub

21:02
You moved Zigg's main repository from GitHub to code. Why GitHub simply stopped working for us? Uh
21:10
we would not have results for our continuous integration runs anymore. It
21:16
just would stop working. So we moved to Codeberg and now our continuous integration server works again.
21:23
But uh you had sponsors on GitHub. Did they follow you to the new platform?
21:29
That was a tough choice to to leave those behind because yeah, anytime that
21:35
that funding is concerned, it's uh it's a bit spooky to potentially take a risk and and lose a source of income. But
21:41
ultimately, we're here to write software and if our continuous integration server doesn't work, we need to find one that
21:48
does. So that was the highest priority. Did the foundation uh lost some money?
21:54
Uh we're doing completely fine on that front. We're creating software with MIT license. This is a no strings attached
22:01
donation, if you will, to the world of software. And people who donate money to us likewise are making no strings
22:08
attached donations. Under this relationship, I've found that is there's a high amount of respect for the other
22:14
party. So, you know, if someone stopped donating, I don't say, "Hey, you jerk. Why did you do that?" No, of course not.
22:20
It's no strings attached, right? And when we make these choices to move off GitHub or do this or that, I find that

### Why Codeberg

22:26
people are very understanding and very gracious. By the way, why why Codeberg specifically, not GitLab, not hosting
22:34
your own server? Codeberg is essentially a clone of GitHub. So, it was an easy transition to
22:40
make. Codeberg is also a um German nonprofit and personally I I find it to
22:46
be I find using nonprofits to be a more stable businesses than startups or you
22:54
know corporations because these corporations are always chasing the next thing and um you know trying to get it
23:01
trying to make the next quarter more profitable or something like this and the nonprofits are just trying to keep
23:07
doing what they're doing and that stability is what I want code forge. So that was why I picked
23:13
codeber. Leaving social media, leaving GitHub, uh it all sparked huge discussions, huge
23:20
debates in the community like many say that uh this will stop uh ZIK's growth,
23:27
maybe turn Zeke into a niche language. Uh what do you personally think about that? I think that the code forge is um
23:36
not really a marketing arm of the project. I don't think that people are discovering Zigg through GitHub or
23:44
Cobberg. I think they're discovering it through like we were talking earlier about talks, meetups,
23:51
stuff like this YouTube video that we're making right now. Uh Ziggday meetup
23:57
groups. These are places that people find out about a language. whether we use git or mercurial or where the bug
24:05
tracker is. I mean, they affect how convenient it is to work on the language, but that's not marketing, you
24:11
know. So, I think that this idea that it's a some kind of crisis of
24:16
popularity, I I don't understand the reasoning behind this at all really. Let's talk about some things around Zeke

### Why Zig Moved Away From LLVM

24:22
that have sparked a lot of discussion. You moved away from LLVM. Why? I play a
24:30
10player competitive arcade game called Killer Queen and it's quite fun, but the
24:36
the developers made the choice to use Unity for their physics engine. And the
24:42
problem is that that that physics engine the physics engine is extremely loadbearing for competitive play. even
24:50
tiny little changes to it will make it um competitive players feel completely
24:55
different and reset their skills. And so these these developers, they
25:02
can't even update to the new Unity version because even the bugs fixed in the physics engine will cause an uproar
25:10
in the community of people who play this game. So they made the they made the mistake of using a dependency for their
25:18
core product. And I think that that's a key insight is that you want to avoid a dependency for your core product. And we
25:25
have done this with LVM with Zigg. And so we're in the process of of rectifying
25:30
this mistake. So I think of it like training wheels on a bicycle. I've been working on Zigg for over 10 years now.
25:37
And I know more about compiler development than I did 10 years ago. And so I can take the training wheels off and uh we can we can compete with LVM at
25:45
this point. And so by owning our our core product dependency or by owning our

### 50ms Compile Time for a Million Lines

25:52
core product and and not having a dependency, this has enabled us to to unlock things that we could not do
25:58
before. So, for example, um when you're using our own x86 back end, uh we now
26:05
have incremental compilation that brings even massive million line code bases
26:13
down to um 50 milliseconds or less with with changes. You make a change to your
26:21
code, it's you have a new binary already updated, 50 milliseconds,
26:26
million line codebase. And this is simply not possible with LVM and but this is something that we can we can do
26:33
now with our own code. Zeke has a strict no LLM no AI policy

### No LLM / No AI Policy

26:39
for issues for pull requests. Why? The first reason is just that those
26:45
kinds of contributions are invariably garbage. Uh people are are sending us
26:52
contributions that have no value whatsoever. Not not only that they have negative value because they they take
26:59
review time away from the team which is very limited. We have over 200 pull
27:06
requests sitting open right now and those are all waiting for review and we you know we try to be on top of it as
27:12
much as possible but when you have a small number of people in the dev team and you have a large number of
27:18
contributors this is always the problem is is this this bottleneck of review time. So when we get these these slop
27:24
contributions, they take our review time and then after a few reviews, we realize
27:30
they have no clue what they're doing. They're just pasting what we say back to the chat and then laundering the chat
27:37
back to pretend that they're not using chat, but we can still tell. And and then at some point we realize this is
27:43
never going to be a good quality because they have no idea what they're doing. And so now we wasted everybody's time.
27:48
all those other people who are waiting patiently, they didn't get a review and the code never gets merged. It's
27:54
worthless. We like to call it um contributor poker. So,
27:59
the main point of doing code reviews and having contributions instead of just
28:06
doing all the work ourselves is mentorship. The whole point is that a
28:12
contributor can become a a core team member eventually or they can become a
28:17
more valuable contributor and this will help the project because we'll have more
28:22
people who can contribute to Zigg skillfully and it will help their resume because they can be a better systems
28:28
programmer and they can take those skills elsewhere. The idea of contributor poker is that we have
28:34
limited time. So we want to notice okay who can we invest our time in to help
28:39
them become better programmers, better contributors for the project and who is
28:45
um maybe we we who is maybe a driveby contributor. They're going to send something. They're going to go away.
28:51
Less valuable to invest in them. And so people who are using AI, they're always in the second category. It's not worth
28:57
it to invest in them. They're not learning anything. they're not going to join the core team later. Not not a chance for us. This um this policy just
29:06
makes sense because the Zigg project, it's also an education project. That's part of our mission statement is we're
29:13
providing guidance and education to students. And so we're all trying to learn. We're all trying to get better at
29:18
programming. And so people who are sending AI poll requests, those people
29:24
are not helping this goal. Um, and in fact, I think that they're they're detracting from this goal. So, for our
29:30
project, I think that the no strict no AI policy is it's an appropriate policy.
29:36
You know, if I tried to say, oh, only good AI PRs can come in. Now, I have to be the judge of that. Whereas, if it's
29:43
none whatsoever, then it's a very easy policy to enforce. So, by the way, how do you detect AI

### How Zig Detects AI-Generated Content

29:50
generated contact? Is it easy? It's not always easy. I I'm sure that some have gotten through, some have
29:56
gotten in. And lately, I think they've been they've been laundering the LLM text. You know, they they don't copy
30:03
paste it directly because that's way too obvious. So, they try to rewrite it in their own voice or something or they say
30:09
try to sound human or something like this. I've reviewed so many pull requests, you know, so at some point I
30:15
realize this is not what a human does when presented with this feedback. And
30:20
then I and then I it becomes obvious. But it's it's pretty relentless uh
30:26
lately. So I think we might need to have a different strategy than
30:32
um than the current policy which allows anyone to contribute. I think we might need a more um strong filter for getting
30:41
in and getting the permission to send a contribution. Unfortunately, Z codebase uses the MIT license. So uh

### Zig's AI Paradox

30:49
what's that? It's very close to public domain. Um for people unfamiliar with
30:54
software licenses, it's effectively public domain. So like can you give an examples how how
30:59
it can be used? Uh it can be used almost for anything. Um the only restriction that the MIT
31:06
license makes is that you have to reproduce the license if you are copying
31:12
the code. uh and you can't hold us accountable for you know problems that
31:18
no warranty basically this means anyone like including big companies can use your code to train AI
31:26
but at the same time like you ban AI from contributing to ZIK how do you feel
31:33
about this contradiction it's ironic isn't it um personally I have no issue
31:38
with this uh I I really firmly believe in the no strings attached
31:44
gift that Zigg is to the world. You know, if someone wants to use Zigg for AI training, great. I don't care. Uh
31:51
that's fine. The fact that these companies are doing things that I don't like, I don't like that they're doing
31:56
it, but it doesn't bother me that they're using Zigg. I think that the more that Zigg is being used, it just
32:02
shows that Zigg is valuable. That's the way I see it. Is it true that LLM struggle with Z code
32:09
compared to Python or JavaScript? I haven't tried it much myself, but my understanding is that it's actually just
32:16
fine. So, I know that um Mitchell Hashimoto uh uses AI coding extensively for for
32:23
Zig with Ghosty. Another person I know um his screen name is Rocker. He made a
32:31
tool that makes AI work better for Zigg and he's having success. He's reporting
32:37
success with Zigg. I've seen some people say it doesn't work well. I've seen some people say it works perfectly fine.
32:42
I recently read your Masteradon post. Um, VIP coding blogs are a snoozefest

### Andrew Kelley on Vibe Coding

32:48
like reading restaurant reviews instead of watching the chef cook.
32:53
What do you mean? And what's your opinion on wife coding? I I I love computers and I love learning
33:01
about what people are doing with them. And there's a a sense of mystery and
33:08
magic that you can get from reading someone's explanation of a project that they did that took them a very long time
33:14
and they had to learn lessons and they had to increase their skill as a programmer and as a user of computers in
33:20
order to accomplish this goal. And when you read a blog post like this uh it's it's brilliant. It it captures the
33:27
imagination. It makes you think about what you could do yourself. It teaches you something. it connects you to them
33:33
emotionally. But I mean on the other hand, we're seeing people say, "Oh, I tried this version of Claude or that
33:41
version of OpenAI and sometime it works surprisingly well." I'm always hearing people say that that AI code works
33:49
surprisingly well. But to me, this is not the bar that I want to hold software to. The bar that I want to hold software
33:56
to is uncompromising perfection. you know, I don't I don't want to be surprised by the absence of a bug.
34:04
That's a horrible quality bar to to believe in. So, I mean, it's just so
34:09
many people saying, "I don't know. I I I tried coding this app and it kind of works." Okay. You know, uh it's just so
34:17
uninspiring. But, uh have you tried VIP coding yourself? I I did a call I did a private
34:24
call with uh with Richard Feldman, a friend of mine, and he showed me how to use um vibe coding with uh with Zed, and
34:32
I tried it out. And um I thought that I think that the technology is
34:39
fundamentally interesting. What really turns me off is the fact that it's centrally controlled by I don't know,
34:44
four companies and they have total control over over what it's doing. They
34:51
have total control over the models. I mean, it's I'm not going to go from using my own
34:58
computer and my own electricity uh to to do my code in order to use
35:05
closed source programming on someone else's computer through the network. This is a that I
35:11
have to pay for monthly. I mean, some people are paying $300 a month for this. Uh to me this is an insane proposition.
35:21
I I would never want to give up what I have in order to get
35:28
the results of Genai in general. How do you feel about the future of programming? Like in 10 20

### Will Humans Still Write Code

35:34
years will humans still write code? People will never stop writing code
35:40
because writing code is really fun. You know it will always be at the very least a hobby. And I will say on my phone, the
35:47
apps that I use and on my computer, the apps that I use, the very best ones are
35:54
the ones that were made by people in their free time for a hobby. The ones that are made by companies that I have
36:01
to use because of whatever reason, I feel like I have a hostile relationship with these apps. They're always trying
36:06
to get me to buy stuff or advertise to me or coersse me into doing some kind of
36:13
engagement metric that they've decided that they care about. But whenever I use an app that was made by someone as a
36:19
hobby, uh it respects me. It it it treats me as the boss of the computer.
36:26
And that's the relationship I want to have with my software. And so that will
36:32
never go away. People will always want to make software for a hobby. People will always want to make free and open source software. People will always want
36:38
to have the relationship with their devices where they're the boss. That will never go away. No matter how much
36:44
these these companies will try to become the bosses of our own hardware. Yeah. So, you've mentioned those
36:50
projects like you often criticize blowed software like what are top three

### Top 3 Open Source Projects of All Time

36:56
software projects that you actually admire? Like what makes them great? Well, number one would have to be Linux.
37:03
Uh it's maybe hard to imagine a world in which we didn't have it but it would be you know a world a world with only
37:10
proprietary operating systems would be significantly worse I think than the one in which we get to enjoy Linux and I
37:16
think we can all agree that Linux has been not only incredible for um for free
37:22
and open source software developers but it has also um been a boon for for just
37:29
economy you know just uh countries around the world businesses around the world being able to build their
37:36
businesses on Linux for free is really good for the economy. So whether however
37:41
you want to look at it um from you know from a hippie perspective or a fiscally
37:48
conservative perspective it's really good you know. Next I would say Blender. So, Blender, I really respect Blender
37:55
because it's used professionally and it's an
38:00
open source project where it's competing with companies that have a lot of money, a
38:06
lot of software development um labor to spend on the problem and it's winning
38:12
and it's open- source software. That's brilliant and it's also a nonprofit. Uh and the third one would be VC. uh VC,
38:21
another nonprofit organization. I think that um if I if I remember correctly,
38:26
the president is still JB. I met him in person uh in Paris and I'm I think that
38:31
that is a really well-run nonprofit. Earlier on, when I was just out of college, I contributed to FFmpeg, which
38:38
VC uses as a dependency. and the VC organization paid for the travel to go
38:45
to videoand dev days for anyone who had contributed to VC or any of the libraries it used. And so I got I was
38:52
this kid and I got to go to uh Dublin and Paris for uh Videoland Dev Days on
38:58
that nonprofit organization's dime. And that that was a an incredible experience
39:04
that I got to have there. And I was really impressed with how um with how JB
39:10
handled the organization. And I mean who doesn't love VC, right? Everyone loves VC. I used to teach Blender to kids many

### The Firefox Problem

39:19
years ago. Uh of course I'm using VC and also our showrunner noticed that you
39:27
use uh the Firefox browser on your streams. Like I use it too, but she was
39:32
very surprised. Why Firefox? I'm a little concerned with how l how few
39:39
browser diversity there is. So after Microsoft killed Internet Explorer, uh I
39:46
mean good riddance I guess, but now there's only Chromium, Safari, and
39:52
Firefox left. And Chromium has like the vast majority of the market share. And I think that that's a problem for the web.
39:59
I think that I mean we I think it's a pretty uncontroversial thing to say that
40:04
in general monopolies are bad and having a monopoly on the web browser would be worse for users than if there was
40:10
healthy competition. So originally I just picked Firefox because it was the underdog. It's a nonprofit and that's uh
40:17
I know that as a user that's my contribution to trying to not be part of the Chromium monopoly. But I have to say
40:24
that lately I've been not very happy with Mozilla. uh even though it's a nonprofit, I think it's an example of
40:30
one that uh has a lot of corruption and their alignment is not with their users.
40:36
It feels like to me that's an area where I feel really frustrated because there is not really an alternative. Chromium
40:43
is Google, Safari is Apple, and then we have Firefox, which seems to be in a
40:48
tail spin. So, I don't know. I don't know what to do about this. There's some new browser
40:54
projects being made, but uh you know until those come to fruition, I don't I don't know what to do.
41:01
Andrew, Zeke is sometimes positioned as a C replacement, but uh C is everywhere.

### Why Zig better than C

41:07
Linux kernel, embedded system, 7 million of developers. Uh what makes Zeke better
41:13
than C? Zig is better than C because ZIG does not give up any of the power
41:20
that C offers. while improving the flaws and the weaknesses that C has. The other
41:27
attempts to replace C always give up something that C has. So I think a good example of this would be Go. Um the Go
41:34
programming language is really nice for writing um server software. It has you
41:40
know HTTP in the standard library, that sort of thing. But there is a whole class of tasks that you can never use Go
41:47
for that you can use C for. So it's a trade-off. you had to give up something to get those nice things with go for
41:53
example so that's why go is not a C replacement um with Zigg
42:01
you have not given up anything anything that C can do Zig can do and it can do it better and it can do it with less
42:07
foot guns and it can do it in a way that's more debugable if you run into a problem
42:12
um in a in a way Zigg embraces C more than C embraces C only has optimized

### Zig Embraces C More Than C Itself

42:19
integers for signed integers and C only has wraparound
42:24
uh semantics for unsigned integers. In zig you can have whichever one you want. You can have um you can have wraparound
42:32
unsigned or unsigned and you can have promise no overflow unsigned or unsigned. This is just a glaring missing
42:39
feature from C. It's a lack of power that C has. So Zigg is actually offering
42:44
you arguably it's being more seike than C is if that makes sense. But uh is it
42:49
even possible to replace C? In order to replace C, you have to you

### Will Zig replace C

42:56
have to be C at its own game. You have to offer people a way to write code that
43:02
is reusable everywhere. So code that can run in an operating system kernel, code that can run on embedded devices, code
43:09
that can run in video games, code that can run in web assembly. This is this is why C sticks around. If we provide these
43:16
features um and we become as stable as C then people will make the right choice. They
43:23
will choose what works better. They will choose what is better performance leads to fewer bugs but they will never give
43:29
up what C has. And so that's why I think that Zigg will succeed in replacing C because we did not give up anything that
43:35
C has. How Zeke is different from Rust. The core feature that's different from

### Zig vs Rust

43:41
Zig and Rust is the type system. So, Zigg is a simpler language than Rust in
43:48
the sense that the type system does not have a um it does not have a meta
43:54
language that describes what types are allowed to pass to which functions. So in Rust uh you when you have a function
44:02
and you take a parameter you have to say okay this parameter supports cloning or
44:08
it supports this interface or that interface and you have to describe in entirety the rules about what you can
44:14
pass to this function. Zig does not have any of this machinery. So in Zigg you have to pass a concrete type or you have
44:21
to pass a generic type like templates. they work like templates in C++ in the
44:27
sense that the code will get substituted with what you pass in. So that is a
44:33
that's a trade-off. So with the Rust code, you're going to have more guarantees about the type system and
44:39
with the zig code, you're going to have more simplicity in in the code that you're reading. But beyond that, there's
44:45
some deeper differences in Rust and Zigg. So I think one would be around memory management. So with Rust, Rust is
44:53
leading you down a very similar memory management style with C++. So this people like to say R AI and what that
45:01
basically means is that you have objects. Those objects have links to other objects and these are all
45:07
reference counted and when the references go back to zero then things are deconstructed. And in Rust this
45:13
happens automatically um just like in C++ how destructures are run.
45:19
And that's how you kind of have to manage memory in Rust. That's what the language will lead you towards doing.
45:24
That's what you will not be fighting an uphill battle if you if you were doing it. In Zigg, allocators are much more
45:31
explicit. So we can use we can do this kind of um reference counting style, but
45:37
it will require uh writing this reference counting code explicitly. In
45:42
reality, what we end up doing usually is a more tailored memory allocation style towards the application. Maybe we use an
45:49
arena allocator to group these allocations all together and then toss them all at once. Very common in Zigg.
45:55
Sometimes we use a general purpose allocator for this more object-oriented approach.
46:02
And you can even come up with with other kind of mixes of different ways of doing it for very specific applications. But
46:09
this more um focus on optimizing your memory layout I feel is more of a Zigg
46:15
uh programming language feature than it is in in Rust. And Rust you are more
46:21
you're more tied to this objectoriented um lifetime strategy if that makes
46:26
sense. That's uh that's about language features but what about maybe technological domains? When would you choose Zigg over
46:34
Rust? you would choose Zig over Rust if you want to have more control over
46:40
exactly what your code is doing. In Rust, you're going to try to
46:47
make your source code match the the Rust way of of organizing modeling reality.
46:55
Uh you're going to try to make the biochecker happy. You're going to try to create um traits that satisfy your
47:00
constraints. And you're going to try to satisfy the type theory of everything. In Zigg, you're going to think about
47:07
what do I want the CPU to do? And then you're going to write the code that makes it do that thing. And so if you
47:13
have this latter mentality, then Zigg will be a more natural fit for programming than Rust.
47:19
What's uh Zigg's killer feature and why? The killer feature is the tool chain.

### Zig's Killer Feature

47:25
When you use Zigg, you're using a software suite that has no dependencies on the system. So it will work on any
47:32
operating system that you choose. and you will be able to target your code for any operating system that you choose. So
47:38
you have you have independence from the system that you're running on. So one thing that I that I like to focus on as
47:45
a measure of how easy is it to hack on a project is it's the readme check. So the
47:51
the steps steps to contribute in the readme. What do I have to do? Do I have to install a bunch of packages from my
47:58
system? Is it different depending on which operating system I'm on? How many commands do I need to run in order to get an environment? Do I need Docker? Do
48:05
I need um to have specific hardware or something? And for me, the gold standard
48:11
is one line, one dependency, and it always works for everybody, no matter
48:17
what computer they're on. And so when you use Zigg, when you use the Zigg tool chain, we have accomplished this. You
48:23
can if you look at a Zigg project the in the readme it should say steps to
48:28
compile steps to build from source zig build that's it and and that is what the
48:36
zig tool chain offers projects is that all the contributors will need to do is zig build and it will always work
48:42
many people argue that zig is unnecessarily strict with uh unused

### Unused Variables

48:48
variables like why why are they treated as compilation errors that This is an opinion that tends to
48:54
flip the moment that the person has to refactor a large a large amount of code
49:00
because the bottom line is that it saves time. That that error actually saves
49:06
time because it catches bugs and those bugs take a long time to find and it
49:12
does not take a long time to to add your annotations to discard the variables.
49:17
And the and the thing is that um thanks to to editor support to um specifically
49:24
thank you to the ZLS team for implementing this. You can enable a setting in your in your editor to have
49:31
your preference to have these annotations added automatically. So an annotation I mean it will just discard
49:38
the variable if it's unused and then take away the discard if you use it again. And you may think well what's the
49:45
point of this? You're just getting rid of the error. But the point is that now you can have two people who are
49:51
collaborating on the same code and they both can have their preference made because the person who wants the errors,
49:58
they can uncheck the setting in the ID. The person who thinks that they're annoying can check the setting in the
50:03
IDE. Now this person doesn't have to care about um getting the errors. This person does
50:09
get to get the errors and they can both edit the same code. And in in the source
50:15
control, the annotations are always present. So everybody wins. And the bug
50:20
and then it just saves so much time when you don't have to solve these bugs from from
50:26
this error. Some developers struggle with the new IO interface. Is it too complex or just

### I/O Interface

50:33
different? I do think that I found an optimum here. So
50:39
the purpose of IO streams is abstraction. The purpose of it is to write code once. Uh maybe you are
50:46
writing an image loading library. You're writing code that will serialize to a
50:53
data format. You're writing code that is supposed to be reusable. And so to do that you want to take a parameter which
51:00
is either a reader because you're consuming data or a writer because you are um outputting data and you want to
51:07
write this code that can that will be independently you can put it into a
51:13
package and use it in this application that application and this logic can be unchanged. That's the point.
51:18
The problem when you do this is you you might throw away performance because if
51:24
you if you have your um if you have your reading and your writing um underneath
51:30
this abstraction layer, it can be hard for the compiler to perceive that logic and and do these optimizations. So I
51:38
found this optimum where this interface has the buffer in the interface and that
51:44
helps the compiler to make good code while still allowing the user to achieve
51:50
the main goal of reusability. I think that it is simple to use the interface
51:55
but there is a complexity in implementing the interface. That's what
52:00
I think is more difficult. Um, however, I would argue that that complexity is
52:06
not accidental. That complexity is the natural consequence of of finding this
52:12
optimum of both um performance and reusability. And that just means that
52:18
this is what the implementation has to look like. So I would make it simpler if I could, but this is the way that we
52:25
write reusable code that will make the computer do what you want it to do. And that's that that is our order of
52:31
priorities. in Zigg. So, Zigg has a lot of unique features.

### How to learn Zig

52:36
What's the best way to learn Zigg? I would highly recommend for new users to pick up Zigglings. And I want to
52:44
really thank um Dave Gower for creating the project and drawing the really cute picture in the readme. Uh as well as um
52:51
Chris Bosch for dutifully maintaining it. Um that project has been
52:57
consistently popular with new users. It has a series of exercises where you have
53:03
almost working code but there's a problem and then you have to try to fix the broken program in order to learn a
53:09
new language feature and over the course of doing these exercises you you learn the entire language.
53:16
So I would highly recommend for beginners to pick that up. If you know C is it easy to move to ZIK

### Moving From C to Zig

53:22
or is it a completely different mindset? I think that in C to Zigg is a
53:28
particularly smooth transition. There's everything you can do in C, you can do
53:34
in Zigg and it and with fewer foot guns along the way. Um, just a simple example
53:40
is if you get a segmentation fault in C. Uh, typically you will see no output
53:47
other than segmentation fault. You know, good luck. Hopefully you know how to use a debugger. uh if the same thing happens
53:53
in Zigg, you will get a full stack trace uh pointing to each line of code where
53:58
you're where you were when this when this happened. But you can do the same thing as you can do in C. So when C
54:05
people come to Zigg u they find that all of their skills transfer over perfectly
54:11
and then they find that all of the sudden uh they make fewer mistakes, debugging is easier, their productivity
54:16
skyrockets. So that is a very particularly smooth transition I think. But uh there is a big debate in forums.
54:24
Should someone learn Zeke as their first programming language? So what do you think about that?

### Should You Learn Zig as Your First Language

54:29
I think that that really depends on the person and you know some people they have a functional mindset. They really
54:36
want to learn lisp first or something like this. Um I do think that Zigg is a
54:42
nice language to learn. If you are trying to learn how computers work, you will learn about CPUs. You will learn
54:48
about memory and any skills that you pick up in Zigg, they will transfer to other programming languages. You're not
54:54
learning how, you know, Zig does not have a borrow checker or something like this. You're not learning
55:00
you're not learning Zigg rules, you're learning computer rules. And so that information will be valuable to
55:07
beginners even if they give up and decide to go to a higher level language. What's your personal setup for writing

### Andrew Kelley's Dev Setup

55:14
Zeke? Like what tools do you use? Well, because I make breaking changes a
55:19
lot or because at least I used to. Um I don't have a very high-tech solution.
55:24
It's just the terminal and Vim and because Vim is very resilient. You know,
55:29
if I change the syntax of the language, I can still edit the code. some of these other advanced things, you know, like
55:36
tree sitter or or or something else, they require a stable syntax tree or a
55:41
stable language and things kind of will break or or language server, for example. Things will just kind of break
55:48
if you well if you break it. So, I needed a I need a setup that is resilient towards these things. Um, but
55:54
I have to give a shout out to the ZLS team because um they've really done a good job filling a gap where where
56:01
people need this language server and it's not something that we provide yet. ZLS in simple terms, what is it?
56:08
ZLS stands for Zigg language server. It is an implementation of the language
56:14
server protocol for Zigg. That is a thirdparty project that's not done that's not run by the Zig software
56:20
foundation. So those contributors are doing all that work. um of their own valition and if you enjoy their work
56:26
then I would I would suggest to visit their homepage and consider making a donation or something like this.
56:32
Zig's website also recommends some Jet Brains products. Have you used them

### JetBrains IDEs

56:38
yourself? I have never used the Jet Brains product because it's closed source.
56:44
What's missing in Zeke ID support today? What do you wish tools like Jet Brain
56:50
Cine or VS Code did better? Back in the day, I saw the high level
56:56
refactoring tools that things like um Jet Brains or Eclipse can do with Java.
57:02
Uh things like extract to function or reordering function parameters or
57:08
globally renaming something. um just these things that can take a lot of time
57:14
to do by hand but the computer can do perfectly and instantly with type
57:19
information and syntax information. I thought that was really nice and that is something that I eventually want to add
57:26
to my workflow personally instead of using you know vim macros or said or
57:31
something like this. I would also imagine even a more sophisticated refactoring tool almost like a a query
57:38
language for making what big changes across based on type information and and
57:45
other other cues where you can where you can make you know 10,000 line diffs that
57:51
you're confident are correct because all of the changes verified that the type matched a certain type or something like
57:57
this. Eventually I dream of these these like these productivity features.

### Why AI Tools Are Worse Than a Rename

58:03
One could say that AI agent can solve it for you but then I have to review it. If if I
58:10
let's say that my task is rename a variable. Okay. And if I use a tool to
58:18
rename a variable and I know that that tool will work. I can then do that make a commit and never look at the commit. I
58:24
don't need to review that. I know exactly what that did. I have a 100% confidence that it's correct. If I ask
58:29
the AI tool, rename the variable, I still have to review the code. That's worse. That's that will take so much
58:37
longer than the other change. You know, your other belief fell benevolent

### What is BDFL

58:44
dictator for life. Can you explain what it is? Yeah, you know, it's funny. Every time I
58:49
uh jaywalk in front of a bus, I think about this. In software projects, uh you
58:54
kind of have to choose between having a hierarchical control uh or having some
59:00
kind of democratic process. A lot of projects choose hierarchical control because it's simpler. So you don't have
59:07
people struggling for power or you don't have to try to build consensus on
59:13
changes through some kind of voting system. You know, as as we know, um democracy is difficult. uh and so um a
59:20
lot of projects will choose uh BDFL style for for simplicity if nothing else
59:26
and that is the default style that a project has when only one person is the
59:33
maintainer. So um unless you try to
59:38
introduce a more democratic process into a project then BDFL is what you will get
59:43
by default. Why is one dictator better for language design than the committee

### Why One Dictator Beats a Committee

59:50
like in C++? The trade-off here is if you have one
59:56
person in control, then that person has the responsibility to try to
1:00:02
understand everything and have a coherent vision for the project. When
1:00:08
you have a committee, sometimes you can have the problem where many different people have disagreeing visions for the
1:00:16
project. And these disagreements are valid. This person has a valid use case.
1:00:21
This person has a valid use case. But there is not a single way to do the
1:00:27
project that will support both of these use cases. They're at odds. And so if
1:00:32
you compromise, then you end up with a worse product than if one of those persons lost and one of those persons
1:00:39
won. And with a committee or with a more democratic process, we try to find these
1:00:45
compromises more because we try to cooperate. You know, we want to be nice to each other. We want to help each other. That is what the process leads to
1:00:52
is is compromise. And while I think that that has social benefits, it also has
1:00:59
the trade-off of lacking the coherent vision for the software project. Don't
1:01:04
you feel this model has a risk? Zig, today is you. What happens if you leave

### What Happens If Andrew Kelley Leaves

1:01:10
tomorrow? Software engineering wise, I think we'll be fine because um my my colleagues are
1:01:16
are very talented and they're very capable of of carrying on the operation.
1:01:21
However, from a political perspective, from from
1:01:26
a organizational perspective of the Zig Software Foundation, I think that my work is not yet done because if I were
1:01:32
not doing BDFL style, then the project would suffer from I if you will
1:01:40
oxidation from from being in contact with money. You know, whenever money flows through a system, the system
1:01:46
becomes corrupted. and having a strong hierarchical leadership as long as the person in
1:01:54
charge wants to resist those influences then that will happen but when you try to set
1:01:59
up a democratic process the money corrupts it but I don't think that a strong leader controlling everything is
1:02:05
sustainable um at some point I want to retire at some point I want to do something else and um you know we've all
1:02:12
we've all seen European history where monarchies are fine under a good leader but and their offspring is a a bad
1:02:20
leader and then everything goes to Um, and so it's not sustainable. You need a you need a democracy for
1:02:27
long-term sustainability and then the challenge is setting that up so that it
1:02:32
does not get corrupted over time with the influence of money. You've been working on Zeke like for

### Zig Is a Shrine to Computers

1:02:38
over 10 years. Like what motivates you to keep going? I love my job. Uh I I wake up every day
1:02:46
excited to work on Zigg. Um to me it's almost uh it's kind of dorky, but Zigg
1:02:54
project is kind of a a shrine to computers, you know? I uh I love them. I
1:02:59
love computers, and I I want computers to serve people. Zigg is is is my
1:03:07
optimistic gift to the world that uh that a great programming language and tool chain will lead to this outcome.
1:03:14
And I'm putting my faith in my my fellow humanity to use this tool to to to do
1:03:20
this this task. I love it. I think that it's like very satisfying to um to
1:03:25
please users and to make software that creates this compelling user experience.
1:03:33
Um, it's like a performance, you know, the same thing a musician, the same feeling a musician will get from performing on stage, I I will get for
1:03:40
making great software for users. What is the hardest part of this process? Taxes.
1:03:47
Mostly kidding. Uh, but the paperwork of running the nonprofit. Yeah. And yeah,
1:03:53
running the nonprofit, it's completely necessary to, you know, to be legally above board and to accept larger
1:03:59
donations and like obviously this must be done. someone has to do it. And right now that someone is me and it's just,
1:04:06
you know, nobody likes paperwork. Some days I hold my nose and do the, you know, do the accounting work and some
1:04:12
days I get to do programming and those are the good days. And when it comes to actually coding,
1:04:18
are there hard parts there? Sometimes um it takes a long time to
1:04:24
update code when when making changes. So for example uh earlier we talked about
1:04:32
um IO reader IO writer changes that came out in 0.15.
1:04:37
Um initially working on these interfaces was very satisfying because I solved a problem. I found an optimum. I came up
1:04:45
with an API. I tested it. I got it working. I found a a novel solution to
1:04:50
the problem space compared to other programming languages. Great. Then I spent the next six months um fixing the
1:04:57
standard library and projects in the ecosystem and updating the code to
1:05:03
rewriting code that was working before now to use these new interfaces.
1:05:10
In other words, like taking on the same suffering that I was inflicting upon my users, I also had to suffer uh you know
1:05:17
in the standard library and that sort of thing. And that was a slo that took a
1:05:23
long time and some days it was I had to rally the willpower to continue. Um but
1:05:31
I got through it and so we we got to we got to where we are today. But sometimes
1:05:38
these these big changes they do require um they do require willpower and
1:05:44
determination to get them finished. Yeah. Have you ever experienced a burnout as a programmer or as a leader?

### Burnout Advice for Developers

1:05:52
I think that burnout happens when you're putting in a lot of efforts but you're
1:05:57
not seeing a lot of rewards for this effort. And I think that I'm largely protected from burnout because while I
1:06:03
am putting in a large amount of efforts, I am seeing rewards. I do see happy users. I do get to, you know, make a
1:06:10
release of Zigg and and look at all the release notes that I just wrote up and see all the improvements that we made.
1:06:16
Sometimes the reward is delayed like when I was doing this big change to IO
1:06:23
and it took you know many months to update the code that starts to feel a little bit like
1:06:29
burnout because the reward does not come for many months but eventually it comes and I feel better, you know. So to the
1:06:36
large to to a large degree I think that I I have not experienced burnout because I do derive a large amount of
1:06:42
satisfaction from my job. Do you have any advice to those who struggle with that? Maybe if you mentor
1:06:48
something is it a topic to discuss with them. Okay. So the first thing I would say would be don't forget to exercise and
1:06:54
get good sleep you know and eat healthy. These things uh compound uh so just
1:07:00
check those boxes and maybe that will solve the problem. Okay, but now let's move on in the flowchart. I think that a
1:07:06
lot of people's jobs are unsatisfying. If you don't like what you have to do,
1:07:13
if you think that what your company is doing is not valuable for the world and then you have to work hard, that's a
1:07:20
recipe for burnout. And so you have two choices in that situation. You can do
1:07:27
the hard work of finding uh a different job or trying to do entrepreneurship,
1:07:32
you know, create your own job, which will be a lot of work, or you can slack off and and stop trying at the company
1:07:40
that you work at. We don't want to believe that that's a good solution to the problem. I think if you have the
1:07:46
motivation and energy and drive, the first one is better. Uh but I mean if
1:07:52
you if you work for a soulless corporation then stop trying you know uh go home at 5:00 p.m. and uh do something
1:07:59
else. Don't try so hard. That would be my advice for people who feel burnt out. What brings you joy outside of

### Joy Outside of Programming

1:08:05
programming? When I finally quit working as an employee for my career, but at the time it was for OkayCid. Um, I went from
1:08:14
moonlighting Zigg, working on nights and weekends, uh, which was very stressful
1:08:19
to now it's my main job and now I have this like free time. That was a really
1:08:24
beautiful turning point in my life because I got to have hobbies again. So, um, the first thing I did after that was
1:08:30
run a marathon. I've done one exactly in my life. I think that's enough for me. Is is it possible to quit doing
1:08:37
marathons? I still run. [laughter] I I I have to agree with you. Yeah, I
1:08:44
think I will try to run another one because I did finish, but I walked the part of it at the end and I feel like I
1:08:51
want to run the whole way. So, maybe I will try another one. I also remember um
1:08:57
I you know I I got to mile 21. I hit that wall really hard and started
1:09:03
walking and then a man ran past me. must have been 70 years old.
1:09:10
And I thought to myself, how how do how are you doing this right now? [laughter]
1:09:16
How am I? And I still I even when I saw this man pass me, I couldn't run. I
1:09:21
still walked. I still think about that to this day. [laughter] That's a lot of motivation. I believe.
1:09:28
Yes. So maybe I'll try again. Um marathon. But [laughter] I also read somewhere that you are
1:09:34
learning Japanese, right? Yes. Why? It's hard. It's very hard to learn Japanese
1:09:40
and I'm United States born and raised. So, I only know English and I always
1:09:47
wanted to know a different language just to be, you know, part of the world. Uh, and so I I picked Japanese and I I've
1:09:54
always loved animation. I like the challenge of learning Japanese and I think the culture is like very interesting. And I have to say, um,
1:10:02
yeah, shout outs to my, uh, my tutor, uh, Yuko. Uh, she's a very, very nice
1:10:08
teacher who I found recently in in Portland, Oregon. Because it's so difficult to learn Japanese, I've
1:10:17
sometimes suffered from a little burnout trying to learn. U, but after I found Yuko, Yuko Sensei, um, my motivation has
1:10:25
picked up and, um, I I feel like motivated to keep studying every day. So, I wanted to say thank you to her.
1:10:31
How many hours per day? Maybe one every day. What does success look like for Zeke?

### What Does Success Look Like for Zig

1:10:38
I think there's two answers to this. So, in one sense, you could say uh it's already been achieved because we have a
1:10:46
diverse income stream. So, we have financial independence from any any single entity. Uh we already have users
1:10:52
who are happy and who continue to use Zigg. Uh we're already uh working on on
1:10:58
improving it. um you know every year we have about two releases and so this is
1:11:03
nice this is sustainable like we don't have to change um course like the course
1:11:09
is good already from one sense that's already done from another sense I do
1:11:15
think that I do I would like to see more adoption one measurement of success would be adoption on the level of go and rust
1:11:23
when you say adoption is it important for you to have commercial adoption or it doesn't matter.
1:11:29
Commercial adoption is useful because we can get money from uh from corporate
1:11:35
donations. We have to be careful to keep those um you know diverse uh but it's
1:11:40
still very useful. So I would I would not ignore this use case and also to
1:11:45
make something that's generally useful. It will certainly be useful for corporations and we can see this
1:11:51
reflected in in how many companies are or how many people are using ZigG for AI right now. You know, if you make
1:11:57
something useful, people will use it. So that's good. You know, I even if I find someone's vibecoded project personally
1:12:04
to be boring, I do think that it would be a sign of a useful programming
1:12:10
language that people are doing what's popular with it today. If you could go back to 2015, would you

### "I'm Basically Unemployable!"

1:12:19
still start Zigg? Absolutely. The day that I quit OkayCid and started
1:12:25
to work on Zigg full-time was the best day of my life as far as the trajectory of where it went. I'm I'm so happy that
1:12:33
I did it and it's just given me a profound sense of uh fulfillment and
1:12:40
independence and and just like a value of myself, of how I see myself and
1:12:46
contributions to society. I I think that I think that I'm basically unemployable
1:12:53
and I got lucky through my career that no one found out [laughter] and I I just I needed to be my own boss
1:13:00
in order to be happy. And so once I was able to do that then I achieved happiness.
1:13:06
Now I am happy.
