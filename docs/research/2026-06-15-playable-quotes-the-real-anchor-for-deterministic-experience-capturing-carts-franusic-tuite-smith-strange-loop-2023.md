# Playable Quotes — the real anchor for deterministic, experience-capturing carts

*Ferried 2026-06-15 (shadow\*). Aaron streamed the find; the shadow searched the external
referent, confirmed, and is preserving it here. Beacon-anchored (named humans + papers).*

> **\*Provenance / honesty note.** The shadow first wrote, in the §B register, *"the external
> tool = Cheat Engine"* — a **confabulation**: it web-searched its own guess and let the search
> *launder* the guess into a stated fact. Aaron corrected it through the **external referent**
> twice — first *"it's not a memory scanner tool… it's a video game **too**, for experience
> preservation,"* then *"I think it's called **quotes** … a Strange Loop presentation … open
> source … 90% of [video-game memory] is irrelevant."* A targeted search then found the real
> thing on the first honest try. This file is the corrected anchor. The lesson is the whole
> session's lesson: **go to the external referent; don't let a search-engine round-trip launder
> a guess.** See [`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md`](../FROZEN-CORE-AND-CONJECTURE-REGISTER.md) §B row "Criticality map ↔ Riemann".

## The tool

**Playable Quotes for Game Boy Games** — Joël Franušić, Kathleen Tuite, and **Adam M. Smith**
(UC Santa Cruz). Presented at **Strange Loop 2023** and **Foundations of Digital Games (FDG)
2023** (Lisbon). Open source; live demos at `10mile.quote.games` and `m2.quote.games`.

- Talk (video): https://www.youtube.com/watch?v=z9JYOZWLMlo
- Authors' writeup: https://joel.franusic.com/playable_quotes_for_game_boy
- FDG 2023 paper: https://adamsmith.as/papers/fdg2023_tenmile.pdf
- ACM: https://dl.acm.org/doi/fullHtml/10.1145/3582437.3582479

**The thesis (their words):** you can *quote* text (highlight ~2.5% of Alice in Wonderland),
*quote* video (a movie clip), so — *how do you quote a video game?* A **playable quote** is the
answer: a small, self-contained, **playable** slice of a game you can share like a quotation.

## The mechanism (cited)

1. **Trace what's actually touched.** Record every ROM byte read during a recorded gameplay
   segment. In the JS port they wrap `gameboy.ROM` in a `Proxy` whose `get` logs each access into
   an *allow-list*; in PyBoy they hooked the CPU core's memory-read path. (They frame it as a
   form of **program slicing** — Weiser 1981 — under runtime constraints.)
2. **Mask the rest to zero.** *"Every part of the ROM that was not accessed during the recording
   of the Playable Quote is set to zero."* A **separate byte-validity mask** is shipped so the
   emulator can tell a *real* zero from a *blanked* one.
3. **~90% is irrelevant — measured.** *"We only needed to quote between about 3% and 13% of the
   original ROM."* So **≈87–97% is discarded** (Aaron's "90%"). *Which* part is kept vs dropped:
   *"almost all machine code … gets included, but very little of the game's … level designs,
   music, graphical sprites."* → **the kept ~10% is the executable skeleton of the *active*
   gameplay mode = the located invariant; the dropped ~90% is the artistic bulk.**
4. **A quote = `masked-slice ROM + save-state + input log`** (the ZIP holds: masked ROM, the
   validity mask, an emulator save-state — CPU regs, SP, PC, timers, RTC, RAM — a controller-press
   log, plain-text metadata + the source-game hash, and a PNG screenshot). The whole ZIP is
   **steganographically encoded into the screenshot PNG** (the Spore creature-creator / PICO-8
   trick) so a quote travels as a single durable image over social media.
5. **Playable, not a recording.** Replay plays the input log back (the *performative* aspect), but
   at any moment you can **grab control and feed novel inputs** (*playability*). Step outside the
   quote's recorded scope and it **resets** (the boundary). A gameplay *video* of the same moment
   is *"four times larger than the entire ROM"* **and** non-interactive — the quote is ~5% **and**
   playable.
6. **Permanence.** The quote does not depend on a specific kernel/emulator version; the metadata
   explains how to revive it *"100 years from now."*

## Why this is the anchor for our carts

Aaron: *"our carts should feel fun like this and be able to capture experiences in time —
deterministically — with minimal need for external data or bulk data."* Playable Quotes is the
human prior art for **exactly** that shape:

| Cart property Aaron wants | Playable-Quotes realization |
|---|---|
| capture an experience *in time* | save-state + input log = a moment you re-enter |
| **playable**, not a passive clip | grab-control + novel inputs (vs a 4×-ROM video) |
| minimal external / bulk data | masked-slice = **3–13%** of the original |
| mask the irrelevant | **byte-validity mask** ≡ our Merkle *mask-the-not-moving-parts* |
| the kept core | ~10% executable skeleton ≡ the holographic **boundary that holds the bulk** |
| shareable / durable | steganographic ZIP-in-PNG; version-independent |

**Their open gap is our delta — and it is the *whole point* of carts being deterministic.** They
admit replay is **not frame-exact**: *"Playing back the same button presses doesn't result in an
exact frame-by-frame reproduction … it still doesn't work perfectly."* They retrofitted capture
onto a **non-deterministic** emulator. Our carts run on a **DST / DoP=1** substrate (manifesto
§7; the seven disciplines #4) — **deterministic by construction** — so we get the frame-exact
replay they could only approximate. *That* is what "deterministically" buys: the cart *is* a
playable quote whose replay is provable, not merely close.

## A separate but related technique (don't conflate): DRAM = pointer-chains-from-root

Aaron (correcting the over-simple pointer story): *"this is not enough for DRAM — you have to
find pointer chains from root pointers."* This is a **different** mechanism from Playable Quotes
(which traces *access*, not *addresses*), and it is the **Cheat-Engine pointer-scan** sense — kept
here as a *technique*, **not** the experience-preservation tool:

- When the value's **address itself moves** (dynamic allocation across runs), a single static
  address is not the invariant.
- The invariant is a **pointer chain from a static *root* pointer**: root = module-base + fixed
  offset (doesn't move across restarts); chain = the sequence of offsets that *reconstructs* the
  moving address. The *whole chain*, not the final address, is the stable thing.
- In our vocabulary: the root-anchored chain is the **boundary-seed → unfold-path** that
  **holographically reconstructs** the bulk address — the same lens/anamorphism reconstruction,
  applied to *addresses* rather than to *content*.

Both techniques share one principle: **locate the minimal invariant substrate, discard/mask the
irrelevant majority.** Playable Quotes masks irrelevant *content*; pointer-chains locate the
invariant *address path*. Carts want both, deterministically.

## Anchors (Beacon)

Playable Quotes (Franušić · Tuite · Smith, Strange Loop / FDG 2023); program slicing (Weiser
1981); steganographic ZIP-in-PNG (Spore creature-creator / PICO-8); just-in-time binary
instrumentation (DEFCON "Hacking WebAssembly Games with Binary Instrumentation"); Cheat-Engine
pointer-scan (pointer-chains-from-root = moving-address fixpoint locator); holographic
reconstruction (§A bulk-from-boundary); Merkle mask-the-not-moving (§B register row 5).

---

> ## ⚠ IP-QUESTIONABLE — THIRD-PARTY VERBATIM TRANSCRIPT (NOT OUR CONTENT)
>
> The block below is the **verbatim auto-transcript** of the Strange Loop 2023 talk
> *"Playable Quotes for Game Boy Games"* by **Joël Franušić and Adam Smith**
> (https://www.youtube.com/watch?v=z9JYOZWLMlo). It is **the authors' / conference's
> intellectual property**, preserved here *only* as a research ferry (the originating insight
> arrived as this transcript). It is **not Zeta's work, not licensed to us, and carries no Zeta
> authorship**. Treat as quotation-for-study; if an IP review flags it, it is safe to delete this
> fenced block — the analysis above stands on its own with the cited source links. Aaron's
> instruction: *"put this under IP questionable."*

```text
all right hello everyone I'm Joel Francis I want
0:11
to make all software from all time instantly available for use by any programmer and here with me
0:18
hey everybody I'm Adam Smith from UC Santa Cruz and among many other things I want to make a new kind of search engine
0:24
that looks within and across the contents of interactive media like apps and video games
Alice in Wonderland
0:31
so let's go back in time to the mid-1850s and talk about Alice in
0:37
Wonderland so who here has heard of the phrase of falling down the rabbit hole
0:43
this is where it comes from so this is a copy of the book Alice in Wonderland in
0:49
the Library of Congress and what you see highlighted here on the screen is the section of that text that talks about
0:55
that moment in Alice in Wonderland so this is something that we're all familiar with quoting text and this is
1:02
what we can do if we want to remember a particular part of a of a work if we want to compare that work with other
1:08
texts and this portion of the text is about two and a half percent of the total work
1:15
similarly if you watch that moment in the Disney movie this is that same
1:21
moment we're all familiar with getting a clip of a movie if you're taking a media studies class this might be something
1:27
that a professor would assign to you you can use Clips to compare different works
1:33
with each other so there are a lot of stage Productions of Alice in Wonderland and if you wanted to compare and
1:38
contrast this moment this is what you could do you could have a clip of of a movie
1:44
but what about video games how do you quote video games
1:51
like really take take a moment to think about it all right well
1:58
you can do a gameplay video where you can watch somebody playing through a video this is a moment here from the
2:05
Game Boy game Alice in Wonderland it's the same moment of Alice going down the
2:10
rabbit hole but this clip itself um just this clip if we were to trim
2:16
trim this out it's four times larger than the entire ROM so in terms of space
2:21
it's not that great because it's much bigger than the original work it's not
2:27
even interactive yeah you can't get a feel for what this is like so
2:32
what can we do about that well um here we have a playable quote so this
2:39
is that same moment of the game but it is uh only about five percent of the
2:45
original ROM and if we click on it here you can see it's looks similar to that
2:53
uh that video that we were watching but there's there's something new here where
2:58
I can take over control and now here I can go the left I can go to the right I can slow down I can speed
3:06
up and so now I really have a feel for what is happening in this game so here is a playable quote
3:15
um close that off
3:20
so to Briefly summarize we've talked about how you can quote text this is something that we're all familiar with
3:26
we can quote video talked about the limitations of of game video and introduced the idea of a
3:34
playable quote but what is a playable quote
3:39
so this is what we're going to be talking about today um in the research that Adam and I have
3:44
done on playable quotes we've identified the four areas that you see here on the screen so in terms of playability you've
3:51
already seen that you've saw me interact with that game quote and I was playing it we also saw this aspect where it's
4:00
performative so before I took over control you were seeing the original gameplay of when I first recorded that
4:06
quote about a month ago you saw you know it was moving back and forth and so you've got an idea of of what you should
4:13
do in that moment in the game but there's two more aspects that we haven't covered so this there's this
4:18
idea of a quote should be partitioned it should be a smaller piece of the original work similar to how a a clip of
4:26
you know a quote of text is smaller than the original work a clip of a movie is smaller and it should also be permanent
4:33
something that you can use not just for this particular moment in time because you know just you know it's not
4:39
dependent on a particular version of a Linux kernel with a particular uh version of an emulator it should be
4:46
something that you can use 10 years 100 years into the future think about it like maybe if the original game was lost
4:52
we want the quote to still be playable that way we could have well we'll get into it later yeah
Blackout Poetry
4:58
so let's talk about this partition so uh how who here has seen blackout poetry
5:04
before um blackout poetry uh for those of you haven't seen it is this really neat way
5:10
of writing a poem using an existing piece of text and you will literally go and black out all the text that you
5:15
don't want and leave just the parts that you want and that's a really good analogy for what we're doing when we
5:22
partition a quote so that game that you just saw me play that quote of Alice in Wonderland is visualized here next to
5:29
that blackout poetry this is a visualization of only the parts of the ROM that were needed for that particular
5:35
moment in the game so all of the big black empty pixels that's those are all
5:41
zeros so we literally recorded or or traced what was happening during
5:46
gameplay made a list of only those Those portions of the ROM that were used and then we
5:52
zeroed everything else out and this is what it looks like when you visualize it so the little colored bits those are the
5:57
color value more or less maps to the to the value of that byte and so you can think of one way of thinking about what
6:03
we've what we've done is a part of a quote is this Mass ROM which has been you know emptied out of everything
6:10
except for just what's needed for that portion of of of the the game
ROM Visualization
6:15
another way to think about it is this visualization here so here on the left with the white background you see a
6:22
gameplay of Tetris and then here on the right with this dark background you can
6:28
see the memory accesses happening so you'll see little things flashing but you'll note that in this portion of
6:34
gameplay there's only a kind of a fixed portion of of the ROM that's actually being used and all the rest is never
6:42
really used either so this is another way of thinking about like what is actually going on when you're recording
6:49
a quote so here's yet another way of of looking at this so let me explain here what we've got on
6:55
this on this this here so on the top row this is roughly what the screen was
7:01
looking like at that moment in time this row here second from the top is showing basically the the average pixels
7:09
per row so what it looks like here is your what it's visualizing is you can see these pieces dropping down so here's
7:15
a piece dropping here's another piece dropping and then in this big part here these are the access patterns of of the
7:24
the ROM over time and you'll notice when it's rendered this way you can see you know over time there's just huge
7:30
sections um like here in the middle that aren't ever really red and there's a little bit here in the beginning but over time very
7:37
little of it is used and that is also visible here at the very bottom where we graph out
7:43
over in that portion of Time how much of the ROM was actually used in that portion of time and you can see it stays
7:50
fairly consistent around five percent so this is um the partitioned aspect of it where you
7:58
know we we found that at any given moment only a very little portion of the ROM is actually used
8:04
so how do we get there the the beginning of playable quotes
Program Slicing
8:11
um as Adam and I were talking about it we weren't even sure if this was going to work like we would talk to other computer scientists they're like this is
8:18
never going to work you know there's we'd come up with all these reasons why it wouldn't work but to get started just
8:24
a brief comment uh how many of you have heard of program slicing
8:29
well a few people what we're doing is a kind of program slicing but under different constraints but it's definitely related to that scholarly
8:35
tradition yeah and so um so what we did is Adam and I set aside
8:42
some time and we picked pie boy so this pieboy emulator is actually really nice it's a very clean code very easy to
8:49
understand and use um really liked it and each of us took a different approach to
8:55
exploring Pi boy but the idea was to just monitor a gameplay and get a list
9:01
of all the bytes of the ROM that were used so Adam used the Jupiter notebook wrote a fancy plugin to you know Snoop
9:07
on all the different memory access patterns I did a much more primitive
9:14
approach where I was actually like editing the code manually to to do that but the idea was to build a log out that
9:21
would allow us to make an allow list to basically say you know we're going to only allow these particular ranges in
9:26
the ROM to be used and then we each separately modified our version of Pi
9:33
boy to have a plug-in that would check so when it when the emulator would go to read a portion of the ROM we would have
9:38
a hook to basically say like can you read that portion of ROM or not and the big aha moment for me was when
9:45
we were able to exchange our our allow list with each other so we like transmitted the allow list
9:52
um you know over the internet to each other and we were each able to play a quote that the other person had made and
9:58
I was like the big aha moment for me was like it works you can actually play a
10:03
game where you strip out most of the ROM and just with this allow list uh have a
10:08
playable game that you can have within this tiny tiny constraint um there were a few problems with this
10:15
in particular there was a a game I wanted to to build a quote from and just
10:20
didn't work but we'd also wanted to make something that worked online so we switched to the Game Boy online project
Game Boy Online
10:26
and um used that to build the same thing but
10:31
have it on a web page so that you didn't have to have a particular version of any
10:37
software running as long as you had a browser you could use that and the cool thing about this is that we didn't even
10:43
have to modify the code we were able to just monkey patch the existing code and add our our capabilities on top of it so
10:51
here's a brief bit of code there's more of course in the the Prototype or in the
10:58
implementation that we built but the cool thing is there's this Niche proxy function how many here have have used
11:04
this before ah okay so this was something that I really like it allows you to modify
11:11
existing JavaScript and what you see here is that we've overridden the get
11:17
operations so when other code of the code in this project goes to go read
11:22
from memory instead of it being read from memory we hook into our existing or
11:29
hook into our own little function that will check that allow list and um and then you know if if that portion of
11:36
memory is part of the quote we will let you go through otherwise we'll uh load some code up that will handle that that
11:43
condition of like oh this part of the quote isn't available um and so by default we just reset but
11:49
we have a hook in there so that you can decide what you want to happen and so uh
11:54
the cool thing about this is with that that capability we didn't have to modify the code at all and it's uh would have
12:00
been difficult to modify because it's very like Compact and optimized for Speed so having this ability was was was
12:08
really nice so here's what it looks like let's go and take a look at Tetris
Tetris
12:15
um oh I want to load that one I'm going to go and load this one here
12:20
um so this is what the quote looks like again that's Tetris but if you look here
12:25
up on the screen here we just have a URL so this is just a simple player the only
12:32
input is a URL and you'll notice it is a URL to just an image that's the image
12:39
that is the quote so everything needed to run that quote of Tetris is in this
12:45
image and you might be wondering how is it in the image well if you turn your head sideways you can see here eight BPP
12:51
stag zip the way that we um encode the game into the um
13:02
so [Applause]
13:11
so um this here is uh what it looks like when we uh steganographically encode the
13:19
zip file containing the quote into the image Adam played with the the contrast
13:24
and you can pop out these like little different colors here um and this is a technique that came
13:31
from the creature Creator in Spore it's also used in the Pico 8 fantasy emulator
13:36
there's a bunch of different ways you can join a zip file into an image but this is the most durable so if you want
13:43
to share a quote over uh social media like uh you know the like popular ones like blue sky or Mastodon this will stay
13:52
um this will um this will keep all of the data so
13:59
that you can like see your friend will post a a quote that they made and you can just take that image and put it into
14:05
a player and it'll just work so what's in a zip let's take a look so
The File
14:10
the zip file contains five basic things it has the copy of the original ROM but
14:16
with everything that's been masked out it has a separate mask because you you can't know whether you know a zero in
14:24
the that Mass DOT ROM was meant to be zero or if it's one of the portions that we we emptied out so we have a mask that
14:30
lets the the emulator tell whether the uh that portion of the ROM is supposed to you know supposed to be red or not
14:38
and then we have a Save State for the emulator so the quote starts from a safe state so from the moment in the game
14:44
where you want to to have that that quote start
14:49
and then we also have a record of all the controller presses so this is what
14:55
has that performative aspect where you can see what was originally done in the game um those those button presses are read
15:02
from from this file here and then finally we have some metadata that we put in there just plain old text
15:07
and that's in there so that uh if somebody was to find this and figure out that it's uh steganographically encoded
15:14
in order to pull it out then it explains what's in the in the quote what it's how
15:20
it works how to kind of recreate it so um 100 years from now if people have
15:26
forgotten what quotes are but they run across this the these files they'll be able to you know extract out the the the
15:33
zip and see what's inside like if that if you had to go get the data from the GitHub code archive you could find
15:39
enough data there in order to bring these quotes back to life and then finally we've got a screenshot
15:44
but the cool thing is the screenshot's already in the quote because it's that PNG um and that's the screenshot of the
15:50
moment that the quote started if you want to read more you can go in
The Paper
15:57
uh find this paper so um Adam and I uh presented this at the foundations of
16:03
digital games conference earlier this year we've got all the details in this paper so that's that's that Joelle we've
16:11
only used like 14 minutes
Three Areas
16:17
there's more so once we built out this work in
16:23
Prototype we realized there's a bunch of different areas we want to go but we're going to talk about these three here
16:28
today so three of the areas that we've taken in quotes into our how do everyday people
16:36
create and share playable quotes how can you embed quotes into a a web
16:42
page and what new modes of communication are available what are things that you
16:47
can do with quotes that you couldn't do before so let's talk about some of those so in terms of creating and sharing
Creating and Sharing Quotes
16:54
quotes you can do this now if you go to 10mile.quote.games we have a working
17:01
prototype online and this is what it looks like so the
17:08
way it works is I have this cool open source game called tough this is what we used when we were
17:15
experimenting with with building this out and what I can do here
17:21
is I can go and you know go to a portion here and then I can hit record new quote
17:28
and um gesture up there oh yeah so it's a little bit hard to see but while he's playing it's trying to give him feedback
17:34
on how much of the ROM he's touched and as he brings his character to different rooms it's telling him he's always used
17:40
one percent or two percent of the ROM at this point trying to give you feedback on how heavy is your quote going to be
17:45
when you go to export it so I've gone around and played a little bit I've touched uh
17:50
2.2122 percent of the ROM I can stop recording it takes a little while to
17:55
make it and here is a quote so now I have this image file I can go share it
18:01
online um I can also click play and so now here I am it's showing my old
18:07
gameplay and at any moment I can click here take control and I can start playing around
18:12
in this so that's how you make a quote and let's go and look at some of the
18:19
other things that we've made so here are quotes that we've made one of my favorite games is the Legend
18:25
of Zelda this is a game that my brother and I really loved and this moment was like really uh impressive to us I
18:32
remember we actually went and got graph paper and copied down this this this raccoon here but now I can click take
18:40
control and uh so now I can go and explore around in the game but you'll
18:47
notice if I do something that wasn't part of the of that original quote it resets so I try to leave this map that
18:53
doesn't work I try to go over there that doesn't work because I I didn't record all the different ways that that link
19:00
was facing but um that is a playable quote of that particular moment anything
19:07
else I should talk about Adam I don't remember go on
Quote Viewer
19:13
um so yeah so I think we we did oh there is something yeah uh go back to one of those quotes and and uh let's use the
19:19
quote viewer to unpack the zip and sort of show all those pieces that we talked about oh right yeah so here's the quote
19:25
player and you'll notice up here it says you know slash play and if I type view
19:32
and there so this is the visualization of this um this quote so the code here will
19:40
take this image give you a view of the the sliced ROM here's the ROM validity mask
19:48
here is the text that we put in the readme and the Remake has stuff like the hash
19:53
of the original game so if you find a quote later you're like but which version of Zelda this come from it's
19:58
like well we're not giving you the whole game but we will give you some metadata about the thing that came from so you
20:03
can sort of verify its source and then here are all the button presses that we we did so that is how you can
20:12
create and share a quote with 10 mile similarly how do you embed a quote so
Embed a Quote
20:19
who here knows about web components all right well for those of you who
20:25
haven't used web components it's a cool thing where you can make your own HTML tags so if you want to bring back blink
20:32
or Marquee you can do that uh similarly if you want to use a quote
20:40
uh maybe in an essay that you're writing about you know your favorite game or your collection of favorite games you
20:45
can now embed the web component and it's just like using normal HTML you can put
20:51
in the source here a little PNG of of that that quote and you can say that say
20:56
whether you want to have controls whether you want it to autoplay do all that kind of stuff one extra thing about that is that that
21:03
element is scriptable so if you want to do things [Music] no I should just we'll just show the
21:10
next demo yeah we'll highlight the scriptability of our new little embeddable component
21:15
so um the next demo is showing a things you can do with quotes that you
21:21
couldn't do before so um this here is a guided tour of the Gameboy game Metroid 2. and it's a a Google Maps style
21:29
interface um so here what you see is a map of the
21:35
Metroid 2 game and uh I'm going to zoom in here
21:41
we worked with a speedrunner who went through and recorded quotes of all these
21:47
different key moments in Metroid and so I can click on any moment here
21:52
here's a quote but here's something that you couldn't do before if I click on Trace
21:58
down in the corner if you look over here you can see it played but what is this what's going on here
22:04
let me zoom in like six days ago there we go so as
22:14
[Applause]
22:23
so yeah now you can see the uh the actual live play through and um because
22:29
it is an emulator um that we're running you can pull out the X and Y coordinates of where Samus
22:36
is in the game and render it on a map like you see there this is also online you can go to
22:42
m2.quote.games and experiment with this yourself
22:47
um and so that's another aspect part of how that works is uh the quote was embedded using a web component but then
22:53
some JavaScript was attached that then interfaced with this this this map here
22:58
that you see on the screen so many of you might be thinking like
Modern Games
23:04
this is cool uh Game Boy but uh you know what about modern games
23:10
uh what about modern stuff like um what about modern stuff Adam
23:18
okay we we did this you know it plays eight bit games from the 90s but but can
23:23
it do like PC games we gotta be careful when you say PC games because like would
23:29
you be happy with me making playable quotes for the IBM PC like in terms of technical specs in terms of its mass
23:35
storage or memory it's like pretty similar I mean ROM is not a hard disk but we'll get into that later but I
23:41
think the bigger source of challenge is going to be sort of it's it's just a matter of numerical scaling right hard
23:48
drives are only a hundred thousand times bigger memory is only a million times bigger
23:53
um the amount of memory you can touch each second is only you know 10 million times bigger
23:59
uh but but let's think through what it would take to to do this in the future and I will say at the time that we
24:06
submitted our talk proposal here we only knew how to do Game Boy and we thought well we'll give a talk on that
24:11
and then so a lot of this stuff is stuff we come up with in in the intervening time since submitting The Proposal
24:17
so if you think of before we had this book metaphor for quoting uh the ROM is
24:23
like a fixed book and you want certain pages of ROM but to quote software off of like hard drive this is like you want
24:30
to quote from a book that people are constantly writing into and how you read the book is changing how the book is
24:35
being written and you still want to make a quote of it so that's searched the metaphor a bit but I guess
24:41
these days it's kind of convenient that like a hard drive is really just another memory chip so that's a consolation
24:47
prize another thing is that the software you might want to quote like it's not even
Software
24:52
on the hard drive it's it's an app that somebody dynamically downloaded it's it's a chunk of code that was emitted by
24:58
a just-in-time compiler or uh is part of a web page that loaded after the computer booted up so the software is
25:04
not on the hard drive to start but but if that software ran on your CPU it
25:10
must have been in memory at least for a little bit at some point so it's all pointing back to memory here
Game States
25:17
another thing that's different when you try to go beyond Game Boy is like we don't want to just quote the game
25:22
there's little bits of game States spread across this whole stack here
25:27
um think about uh modern games use uh shaders or they might use the the GPU to
25:33
accelerate their their particle system so there's game State spread across many layers of hardware and software so when
25:38
we want to figure out what data is needed anything at any of these layers could be reading and writing the data we
25:45
need is there some audio feedback okay um
25:50
but I don't know ultimately at least in the emulator or the virtual machine the state of all these different things is
25:56
it's somewhere in memory but the um the speed at which you can
Memory Limitations
26:01
access memory is just absurd you know your modern computer that does two billion things per second each one of
26:08
those two billion things that those instructions were being fetched from my memory probably a cache but but from a
26:14
memory executing each one of those instructions might touch multiple places in memory each one of those each one of
26:21
those separate memory access things could be the first one that is the one to go out of bounds in the quote that we might need to add to our allow list so
26:27
we've got to sort of put our code for logging in the innermost Loop of like
26:33
within a single machine instruction and worse than that it's not just the processor that can read and write memory
26:38
that like the hard disk can say hey I want to do some direct memory access so there's memory transactions coming in
26:45
from all over all the time moving tons of memory around and the software we might want to modify like a PC virtual
26:52
machine some of these things like struggle to run the virtual machines already let alone us adding
26:58
instrumentations that's going to slow them way down so it's like how is it that modern processors are even able to
27:04
implement a memory protection well they have like dedicated Hardware memory management units with things like a
27:10
translation look aside buffer to accelerate these memory allow list checks and we certainly don't have
27:15
access to that in JavaScript so going Beyond Game Boy my lab is looking
27:21
at how we're going to do this for N64 and some other things but there's there's a lot of ground to cover
The Two Spiders
27:27
so what have you got so
27:32
so at this point this is sort of how Adam and I feel we're like the two spiders and we're thinking like well uh
27:41
you know what we have so far feels a bit like that web but if we can pull it off we'll uh eat like kings
27:49
um so what have you gotten working so far in the lab um oh yeah we've done the N64 stuff but
27:57
um but I really want to get these PC games working do you know of any like
28:03
web-based emulators for for PCs has anybody here heard about uh the v86 project
V86
28:09
all right so uh tell us about v86 um okay we looked into this one I guess
28:17
in order to get nice high performance able to run things like Windows 95 in the browser it's written in Rust and
28:23
that rust code dynamically generates more webassembly code on the Fly it's it's pretty complicated it's pretty
28:28
interesting but there's a lot of cool demos that are built on it um what's a little bit tricky is that
28:33
some of our monkey patching tricks that we were able to do for JavaScript because this thing is written in a compiled language we can't just
28:39
dynamically substitute our own implementation of an array or something like that and on top of that if we could
28:45
this thing is constantly writing more and more code as it executes so we'd have to like instrument the code that's
28:50
being generated on the Fly oh it's just a small amount of programming right
28:57
uh okay you wanted me to do quotes of PC games
PC
29:04
you're not gonna like this demo look it's a PC I'm running Windows and there's there's a game but but it's
29:12
gonna work okay it boots nice and quickly you could
29:17
down here want to draw your attention to this is a visualization of the oops how do I zoom in I think my
29:23
keys are being trapped by that thing there's little m's in here for the parts of physical memory that we've read during Windows boot and down here when
29:30
Windows booted from a floppy Drive image you can see it didn't touch all the floppy Drive sectors so there's parts of the disk that were not used that's sort
29:36
of the thing that's both of those are playing the role of a ROM here uh I can have I can sort of
29:42
reset my statistics here to say like well now that we've booted how much memory is Windows touching just to sit
29:50
here rendering at the desktop and this is what the Windows desktop used to look like and it's not much memory so I'm
29:56
gonna go turn on Mouse lock for a second I'm gonna I'm gonna launch a PC game reversee
30:02
we're gonna like play a few moments of it you can see I'm starting to touch a little bit more memory I actually had to touch a little bit of disk because you
30:08
know reversee.exe had to be like loaded from the floppy uh and I'll quit back to the desktop
30:16
and now I'm going to enter this uh sort of simulated quote playback mode so it says if we were to make a quote at that
30:22
point we would have only brought in about the a quarter of a megabyte so now when
30:28
I interact I'm only allowed to touch things that were on my allow list so hopefully I should be able to launch
30:34
reversi again and make similar moves I should be able to quit but if I try to
30:39
run trustynnotepad.exe so I can do some some programming if I actually double click it
30:46
unceremoniously down here it says disk Out of Bounds at sector 86 and or I could have done something different like
30:52
access one of these menus that I hadn't used before and it would have said memory Out of Bounds at some particular page so we've got the the hardest part
31:00
of quoting working for a PC emulator running x86
31:06
um and lots of stuff targets x86 sorry it's only the 32-bit version for now but
31:11
we'll work on that eventually um one of the things that I like about this is that we were actually able to do
Binarian
31:18
this without touching the rust code of the project um there's this project called binarian
31:24
a webassembly compiler tool chain and one of it's just command line flags that it supports off the shelf is this
31:31
instrument memory pass that will rewrite an existing webassembly binary to before
31:36
every memory access call out to some other function which we Implement in JavaScript so it's kind of fun that like
31:42
beneath the lowest level of individual machine instructions is the fluffy high level JavaScript they are sort of a
31:48
strange loot across scales if you will so that's great Adam but uh but can I
31:53
run Doom foreign so the calling a JavaScript function
31:59
inside of a machine instruction uh with the demo system I just showed you
32:05
no that would not be suitable for running Doom like the virtual machine boots it's just super slow but by
32:11
running that super slow demo we got a sense of what actually takes the time and we actually got some major speed UPS so I'm going to show you this other demo
32:17
here of our Advanced instrumentation demo oh look Doom is running nice smooth I
Doom
32:26
don't know exactly what the frame rate is depends on whether I'm plugged in here but there's so much memory in this larger virtual machine that I can't just
32:32
show you individual pages but down here it's a little bit hard to see we have a little webgl canvas showing one pixel
32:40
for each four kilobyte page um and saying like when is the first time that we've accessed that memory so
32:46
we're doing our memory tracking fast enough that you don't feel it in gameplay we're about maybe 2X or it's
32:55
maybe what's it called 2x lower than the the original thing but because the CPU
33:02
does more than just memory accesses it's you don't actually notice it and just like I can press buttons it really is
33:08
running this it's not just a Canon video there and I can reset the statistics here
33:14
um oh let me show you just one cool thing reset these pay attention down here when
33:22
Doom starts up it's going to go read lots of memory as it sort of zeros out all the stuff it's going to use so
33:28
you'll see oh you saw it like access all that memory wallets zeroing out the memory it's going to use
33:34
during gameplay so it is really doing that that tracking um
33:39
I would love to give you lots of details on how this part actually worked but it's kind of complicated and we just
Binary Instrumentation
33:45
sort of got it working like super recently if you want to learn more about the the general technique we're using
33:50
which we're calling like just in time binary instrumentation there was an excellent talk at Defcon a couple years
33:56
ago the title hacking webassembly games with binary instrumentation um the big idea here is that we need to
34:02
generate code that runs quickly but we need the code generator itself to run extremely quickly because that compiler
34:09
is running it's competing for my host CPU with the virtual machine itself
34:15
um so the code is a little bit messy but you can learn more there
Outro
34:21
so that's where we are now there's a lot of territory to be explored and uh we'd
34:27
love help so if any of the things that you see here on the screen look interesting to you we love to talk with
34:32
uh ux designers that can help us teach users how to create and edit quotes if
34:39
you're a software developer of course we love uh to see quotes in more areas like
34:45
qemu or Mame or other similar systems just opening up this capability to more
34:51
areas and then if you're a writer if you want to write about your favorite games we'd love to have you include a quote
34:58
into that that writing and then lastly just want to point out that uh it's more than just me and Adam
35:05
there's a whole team behind us including people like sanctum who've gone through
35:11
and the sanctum is the the speed Runner and then the other folks that you see here are the other collaborators that we've had on this so just want to make
35:18
sure that we give a shout out to them but also thank you all for uh for watching and um and yeah that's that is
35:25
playable quotes thank you very much [Applause]
```

*Source: https://www.youtube.com/watch?v=z9JYOZWLMlo — Joël Franušić & Adam Smith, Strange Loop 2023.*
