# "The Hidden Structure of Rule 30" — YouTube transcript, forwarded by Aaron 2026-08-18

> **PROVENANCE / IP STATUS.** This is a YouTube transcript, forwarded verbatim by
> Aaron and filed here **because** its IP status is uncertain — that is what
> `docs/research/ip-questionable/` is for. It is third-party copyrighted speech,
> preserved as an internal research ferry, not authored here and not for
> republication. Source: <https://www.youtube.com/watch?v=HcGjCcLEgN4>. Title
> verified from the page: **"The Hidden Structure of Rule 30"**. Timestamps and
> section headings are as supplied.
>
> **Speaker attribution is UNVERIFIED and recorded as a match to check, not a
> fact.** The channel name did not resolve from the fetched page. The speaker
> self-identifies as the author of *"the very first research paper I wrote, about
> 20 years ago"* which coins the term **"local nested structure"** — and that
> term titles Eric Rowland, *Local Nested Structure in Rule 30*, Complex Systems
> **16** (2006). Two independent invariants agree (the coined term; the date), so
> this is a structural match rather than a coincidence of one number — but it has
> not been confirmed against the channel, and until it is, this document does not
> assert who is speaking. **Miles Wilson** is credited *in the transcript* for the
> 2025-era extension terms.
>
> **Preserved verbatim per the ferry discipline** — forwarded material is someone
> else's memory and is not curated, summarised, or filtered on the way in.
> Aaron's framing on receipt: *"Interesting backwards time, not sure if it's
> relevant to any of our work but it's simple rules expanding into apparent
> complexity."*
>
> **Register: MIRROR.** Nothing here is a Beacon anchor for Zeta yet. The
> mathematics described is real published work, but no claim below has been
> checked against a source by us, and the contact points in the next section are
> resonances to investigate, not findings.

## Why this was ferried — live contact points, stated as questions not conclusions

Aaron's own note says he is unsure this touches our work. That uncertainty is
kept rather than resolved; what follows is why it *might*, each phrased so it can
fail.

- **Left permutivity ⇒ information preservation ⇒ time-symmetry.** The
  transcript's central argument is that flipping one input square flips every
  square below it on that diagonal, so *information is not lost*, and therefore
  *"there's nothing special about the direction of time"* — the rule runs
  backward as well as forward. That is the same shape as emit/retract in the
  Z-set fold, where a retraction (−1) is what makes history recoverable rather
  than overwritten. **The question to ask is whether the shapes are actually the
  same mechanism or only the same sentence.** Rule 30 preserves information *on
  the left half* and provably *destroys* it elsewhere (§ "Middle blue squares are
  bad for reversibility"), which is a sharper claim than "the fold is invertible"
  and may not transfer at all.
- **Reversibility is CONDITIONAL, and the condition is a boundary assumption.**
  The backward history is unique only *under an assumed black background*; drop
  that and an alternate history exists. A reversible law whose reversibility
  rests on an unstated boundary condition is worth holding next to
  `local-time-never-enters-the-shared-fold.md`: there too, the guarantee is real
  and the assumption smuggling it in is where it breaks.
- **Local nested structure — the initial state recurring inside its own future.**
  Every black triangle on the right boundary is claimed to be a
  mini-recapitulation of the initial state, so *"every finite region that appears
  reappears infinitely many times, and not only in the future but also in the
  past."* Self-similarity at every magnification is manifesto §10 stated as a
  theorem about a specific rule rather than as a design preference. Whether the
  correspondence is more than verbal is untested.
- **Simple generator, unpredictable output — with a priced falsifier.** Three open
  questions about the centre column carry a **$30,000** bounty. That is
  `every-bug-has-economic-value` running in the wild: reducible uncertainty,
  ordinally priced, by someone else.
- **The honest negative result at the end.** Asked whether initial states exist
  that realise the branching left-half possibilities, the speaker says *"I don't
  know. But my guess is that yes."* Guess labelled as guess. That is the register
  discipline this repo asks for, in a source that owes us nothing.
- **Cost of the computation, as a metering datum.** 14 months of compute for one
  batch of terms; a later implementation reaching 2^46 rows and ~9 quadrillion
  bits for four more. A concrete price for "we could not find the structure" —
  useful the next time we estimate what an exhaustive search buys.

## Caution — the one place this is easy to over-read

`numerology-vs-number-theory.md` applies directly. "Rule 30 is time-reversible
and so is our fold" is a **matching property name**, not an identification: many
systems are reversible, and the invariants that distinguish them (which
information is preserved, under what boundary condition, at what cost) are the
part that would have to agree. Aaron's own hedge — *"not sure if it's relevant"* —
is the correct register, and it is preserved here rather than upgraded.

---

## Transcript (verbatim)

### Rule 30 universe

```
0:00
This is a toy universe. 
0:02
It's just a row of squares,  each one blue or black.
0:06
As time moves forward, the  universe evolves down the page. 
0:10
And at every step in time, the colors get updated  
0:12
according to a certain rule. The color that a square becomes next 
0:16
only depends on the colors of itself  and its left and right neighbors, 
0:21
in a specific way that I'll  write it out in a minute.
0:24
The rule is called "Rule 30", and it functions as the fundamental  
0:28
law of physics in this universe, completely determining its behavior. 
0:32
These are the first 32 steps it generates, at the very beginning of the universe.
0:37
If we let time keep running forward, 
0:39
we start to see new features  that weren't obvious before.
0:43
On the left, there's a lot of order. There are these striking diagonal  
0:47
structures that repeat over and over again. So something relatively simple is going on here.
0:52
The rest of the picture looks complicated though. It's hard to see much structure. 
0:56
Small black triangles appear throughout, but they don't follow any apparent pattern.
1:01
... except on the far right boundary. In this thin sliver, 
1:06
the triangles seem to be spaced regularly. So something simple is going on here, too.
1:12
In this video, we'll discover why the left and  right sides of this universe behave like they do. 
1:17
They'll tell us quite a bit about Rule  30 as a fundamental law of physics, 
1:21
specifically about whether we can run  it backward in time as well as forward. 
1:25
This is work I did in the very first  research paper I wrote, about 20 years ago.
```

### Underlying rule

```
1:30
Okay, so what is "Rule 30" actually?
1:33
Here it is. 
1:34
What this says is there are 8 cases. Whenever we see blue blue blue, 
1:39
we get a black square on the next step. That's what happens right here, for example: 
1:43
We have three consecutive blue squares, and the middle one turns black.
1:48
Whenever we see blue blue black, 
1:50
we get a black square, and so on.
1:52
That's all of physics in this universe. It's extremely simple.
1:56
Why is it called "Rule 30"? Well, there's a natural way to encode the rule 
2:00
by interpreting the blue and  black squares as 1s and 0s. 
2:05
This sequence of 1s and 0s is the  binary representation of some number. 
2:10
The four 1s are in the 2s place, the 4s place, 
2:13
the 8s place, and the 16s place. 
2:16
So add them up and... you guessed it.
2:20
This universe that Rule 30 generates  is an example of a cellular automaton. 
2:25
The "cells" are the squares, and an "automaton" just is a self-running machine.
2:30
Rule 30 was discovered by Stephen Wolfram in 1983 as part of a systematic  
2:35
study of cellular automata. If you consider all rules of its type, 
2:38
where there are 2 colors and the color of each square depends  
2:42
on 3 squares on the previous step, there are 256 of them. 
2:46
To give you a sense of what they  look like, here are first half. 
2:51
I should say that I'm starting all of these  from a single blue square on black background, 
2:56
although of course you could use other  configurations for the initial state.
2:59
Most are pretty boring -- simple lines  or stripes or other repeating patterns. 
3:04
Some of them generate self-similar  patterns, like Rule 90 here. 
3:08
But even for those, it's fairly easy  to work out the general behavior.
3:12
There are just a handful that  are doing something complex -- 
3:15
generating arrays where it's not  obvious what's about to happen next. 
3:18
Rule 30 is one of them. And it resists attempts  
3:21
to work out its overall behavior. It's like the digit expansion of pi; 
3:25
you can compute it all day long, but you don't see a pattern.
```

### Center column

```
3:28
Take the center column, for example. There are basic questions  
3:31
about it that we can't answer. Does it end up in a repeating cycle? 
3:35
Probably not, but no one knows how to prove it. Is the distribution of blue versus black  
3:40
squares exactly half and half? Again, this seems to be the case, 
3:45
but we don't know how to prove it. And is it possible to compute it 
3:49
more quickly than the cellular automaton does? If there's structure in the center column, 
3:53
we should be able to determine the  color of, say, the trillionth square 
3:57
without running the whole  automaton a trillion steps. 
4:00
But we don't know about any such structure. Even though it's created by a simple rule, 
4:04
it's statistically random  as far as anyone can tell.
4:07
By the way, each of these questions is worth  
4:09
$10,000 if you can answer it. $30,000 for all three.
4:14
So why is this picture so complicated? It's hard to say. 
4:17
The behavior of the automaton is  an emergent property of the rule; 
4:21
knowing what's happening on one level 
4:23
doesn't really tell you what's  happening the next level up.
4:26
But some aspects of the behavior can be traced directly back to the rule.
```

### Right boundary

```
4:31
The Right Boundary
4:33
Why are there black triangles  in this array at all? 
4:36
Take this triangle. The top row is a  
4:38
block of 8 consecutive black squares. These are bookended by blue squares.
4:43
Let's follow the rule from there.
4:45
Since three consecutive black squares produce a black square on the next step, 
4:49
a long block of black squares will produce 
4:51
another block of black  squares, just possibly shorter. 
4:54
In fact, that's what's happening in  what we think of as the background: 
4:58
A long block of black squares stays black. What about the two endpoints of the top  
5:04
row of the triangle? On the left, blue black black becomes blue, 
5:08
so the block of black squares  shrank by 1 on the left. 
5:12
And on the right, black  black blue also becomes blue, 
5:16
so the block also shrank by 1 on the right. Over the next several steps, the block gets  
5:21
smaller and smaller, until it disappears. So that's one triangle.
5:26
Further down along the right  boundary, we see a bigger triangle. 
5:29
It's formed in the same way, kicked  off by a block of 14 black squares.
5:34
And if we keep going, here's another triangle. Its width is 8.
5:38
And this one has width 15.
5:41
If we keep going even more, the next widths are 8, 14, 8, and 23. 
5:48
Will we keep getting bigger and bigger triangles? 
5:51
Next we get 8, 14, 8, 15, 8, 14, 8, 24.
5:58
This sequence of triangle widths  seems to have some structure. 
6:01
For example, at the first appearance of 15, what came before? 
6:05
8, 14, 8. And that's exactly what we get next: 
6:09
8, 14, 8. Then we get a new number, 23. 
6:13
And after that we get a copy of  everything leading up to the 23. 
6:18
And then another new number. 
6:20
So whenever a new number  appears for the first time, 
6:23
what happens next seems to be a repetition of the entire sequence we've  
6:27
seen up till that point. It's a beautiful structure.
6:31
Actually, you may have noticed that we skipped 
6:33
a bunch of smaller triangles  on the right boundary. 
6:36
So we should really fill those in. Here's the top of a width-6 triangle. 
6:40
Here are two 5s. These are little 3s that  
6:44
only last two steps before disappearing. And in this context it makes sense to  
6:48
call these blocks width-2 triangles, 
6:51
and they're just too narrow for the  triangle to span more than one row.
6:55
This sequence of numbers includes the previous sequence but is more natural, 
7:00
since now we're capturing  
7:01
information from a lot more rows -- actually every other row.
7:05
But you know what would be even more natural? 
7:08
Capturing some information about every row. And there's a great candidate for this 
7:12
if we ask about where the triangles  themselves are coming from. 
7:15
Just above each block of black  squares that begins a triangle 
7:18
is a block of blue squares that  kicks off the block of black squares. 
7:23
And indeed blue blue blue goes to black. These blue blocks are 1 longer  
7:28
than the black blocks they produce. If we focus on them and their lengths, 
7:32
now, on every row, we can record the  length of rightmost block of blue squares. 
7:38
All the lengths we don't  have yet turn out to be 1s.
```

### Rightmost blue blocks

```
7:42
So, starting at the initial state,  the lengths of the blue blocks are 
7:46
1, 3, 1, 4, 1, 3, 1, 6, 1, 3, 1, 4, 1, 3, 1, 7, 
7:52
and so on. This sequence still  
7:54
has the same repetition structure. So to completely describe it, 
7:58
and thereby predict the  behavior on the right boundary, 
8:00
we would just need to identify the new  number that appears after every repetition. 
8:05
The new numbers are 1, then 3, 
8:08
then 4, 6, 7, 9, 
8:12
and we can get more terms by computing more rows.
8:15
To try to see a pattern, we  should get as many as we can. 
8:18
And the nice thing is that we don't have  to compute the whole array to do it. 
8:22
If we want to know the colors of these 10 squares, 
8:25
we only need to look at the squares  that can possibly affect them. 
8:28
That's these 12 on the previous step, and these 14 on the step before that. 
8:33
Tracking this light cone backward  in time to the initial state, 
8:37
we find all the squares that  can possibly have an effect. 
8:41
Most of them are part of the background, which stays black, so we don't  
8:44
need to bother computing them. That leaves just these squares. 
8:48
So these 10 squares in the initial state determine the 10 squares we're interested in. 
8:53
And in fact they determine the rightmost  10 diagonals of the entire automaton.
8:58
Using that fact, I was able to  compute these additional terms. 
9:01
And my code took 14 months to run that far out. In the process of making this video, 
9:07
I found out that just last year someone computed 4 more terms just in a few days, 
9:12
using code that's extremely efficient. These are due to Miles Wilson. 
9:17
And the amount of computation here is ridiculous. 
9:20
It required running Rule 30  down to the (2^46)th row. 
9:24
That's 70 trillion rows. And computing the rightmost  
9:28
128 diagonals in each row, overall that's 9 quadrillion bits.
9:34
Sooo do you see the pattern? Yeah, me either. 
9:38
No one knows a fast way to compute these numbers. So forget the center column... 
9:43
We can't even tell what's happening 130 squares from the boundary.
9:46
But even if we can't predict  these numbers in advance, 
9:49
we should still be able to see why  the sequence we extracted them from 
9:52
-- the lengths of the rightmost blue blocks -- has the repetition structure we saw.
9:57
So why is that? When we see 1 3 1 at the beginning, 
10:01
why must see a repetition of 1  3 1 almost immediately after?
10:06
It's related to the fact that  the diagonals are periodic. 
```

### Diagonal periodicity

```
10:10
This is easier to see if we shear the array 
10:12
so that the diagonals are rendered as columns. The boundary diagonal is blue on every step, 
10:18
these two diagonals repeat every 2 steps, and this diagonal repeats every 4 steps.
10:24
In particular, these rightmost 4 diagonals, as a group, repeat every 4 steps. 
10:30
On the first 3 rows, these diagonals completely  
10:32
determine the block lengths because we see a black square 
10:35
after 1 blue square, after 3, and after 1. So 4 steps later, these block lengths repeat.
10:43
But on the fourth row, we  don't see a black square yet, 
10:46
so all we know is that the  block length is at least 4. 
10:49
Here it turns out to be exactly 4. But the next diagonal to the left 
10:53
hasn't necessarily started repeating yet, so 4 steps later we may see something different. 
10:58
And in fact we do.
10:59
This is how new numbers appear  in the sequence of block lengths. 
11:03
And where they appear is determined by  the period lengths of the diagonals.
11:08
The next diagonal repeats every 8 steps, this one also repeats every 8 steps, 
11:13
then 16, 
11:15
and then 32, although there aren't enough  rows on the screen to see two full periods.
11:20
The period lengths seem to be powers of 2! 
11:23
That would explain the repetitive  structure in the block lengths: 
11:26
A new number can only appear at a power of 2, and after that new number appears, 
11:31
we get a repetition of all the block  lengths we've seen up to that point.
11:35
Great! 
11:37
Buuuuut why are the diagonals  periodic in the first place? 
11:40
And why are the period lengths powers of 2? Let's look at how the diagonals are constructed, 
11:45
because this is where the details  of the rule come into play. 
11:48
Since we've sheared the automaton,  let's shear the 8 cases to match.
11:52
Every diagonal receives information  
11:54
from three diagonals -- itself and the previous two.
11:58
The reason the boundary  diagonal is blue on every step 
12:01
is that everything to its right is black and blue black black goes to blue.
12:07
The next diagonal receives information from 
12:09
itself, the blue boundary,  and the black background. 
12:13
So only piece that can change is  the color in the diagonal itself. 
12:18
There are two possible colors. They both happen to occur, 
12:22
And, once one of them occurs for the second time, everything that follows repeats as well.
12:27
That's a pretty simple example, but the same idea works for every diagonal: 
12:30
There are only finitely many different  states that a group of 3 diagonals can have, 
12:35
so at some point one of those  states must show up a second time. 
12:39
If the previous two diagonals are periodic, then from that point on 
12:43
the third diagonal proceeds in exactly  the same way as it did the first time.
12:47
That explains why every diagonal  enters a repeating cycle eventually. 
12:51
But why are they periodic from the start?
```

### Left permutivity

```
12:54
There's a special property of Rule 30: 
12:57
If we flip the color of the left  input square in any of the 8 cases, 
13:02
it flips the color of the output. For example, take blue blue blue. 
13:07
It outputs black. But if we flip the left square, 
13:11
we're in this case, black  blue blue, which outputs blue. 
13:15
These two cases differ in their left square, and they differ in their output. 
13:19
The same is true for this pair: blue  blue black and black blue black. 
13:24
Different outputs. Also true for blue black  
13:27
blue and black black blue. Different outputs. 
13:30
And for blue black black and black black black. Again, different outputs. 
13:35
Actually you can see this just  by looking at the outputs. 
13:38
Flipping these 4 outputs gives  you exactly these 4 outputs.
13:43
This property is called "left permutivity" because each pair of cases corresponds 
13:48
to a permutation of the  two colors, blue and black.
13:51
Let's think about what it means for the automaton. What happens if we take a square in  
```

### Direction of time

```
13:56
the initial state and flip its color? 
13:59
Ignore everything to the left  and just focus on its diagonal. 
14:02
That flip causes the square  directly below it to also flip. 
14:06
And that flip causes the square below it to flip. And so on and so on, in a cascade reaction, 
14:13
completely predictably all  the way down the diagonal.
14:16
In other words, the information  in the initial state 
14:19
has a long-term effect on its diagonal, 
14:22
because if we flip the color of a square it changes every square below it.
14:26
So the information about the color  of a square in the initial state 
14:30
is preserved on every subsequent row. That information isn't lost.
14:35
And this is a really cool property, because if information isn't lost 
14:40
then there's nothing special  about the direction of time. 
14:44
If information is preserved going forward in time, then it's also preserved going backward in time. 
14:50
If we wanted to force a different  color of a square down here, 
14:53
we would have to flip the square up here.
14:56
So we can flip our whole argument around in time 
14:59
and conclude that, from any row, each diagonal is eventually  
15:03
periodic going up the page. That's why the diagonals  
15:09
don't just enter repeating cycles eventually. So they start repeating from the very first row.
15:16
We'll get back to why the period  lengths are powers of 2 in a minute, 
15:19
but first I have to tell you my favorite  consequence of the diagonals being periodic.
```

### Running backward in time

```
15:24
If we're tracking periodicity up the automaton, 
15:27
why stop at the first row? Just keep going periodically backward in time. 
15:32
And not just this diagonal. We can continue all diagonals backward in time. 
15:37
This gives a history of the  universe before the initial state.
15:42
So does this mean that, as a  fundamental law of physics, 
15:45
Rule 30 is reversible in time? In other words, is this history unique? 
15:51
Well, not quite. All the diagonal  
15:54
periodicity we've been talking about traces back to the black background. 
15:58
And we made an implicit assumption that  the background diagonals are periodic. 
16:02
Under that assumption, yes, the history is unique. But the black background doesn't need to stay  
16:08
black as we move backward in time, because a block of black squares  
16:12
doesn't necessarily come from  another block of black squares. 
16:15
It can also come from a block of blue squares. So an alternate history looks like this instead.
16:23
But let's go back to assuming  the background stays black, 
16:27
because there's one more  amazing conclusion to draw. 
```

### Local nested structure

```
16:30
If we undo the shear, we see what the  history looks like in the original layout. 
16:35
And, because we can, let's run it  backward in time a little further.
16:40
Now, imagine we hadn't said anything  about running Rule 30 backward in time. 
16:45
What would you say this is a picture of? This looks like a huge but finite black triangle. 
16:52
And the amazing thing is, we can't tell the difference locally, 
16:56
because when we run Rule 30 forward in time, 
17:00
eventually we'll see exactly this picture. Periodicity of the diagonals means that 
17:05
certain rows have to look more  and more like the initial state. 
17:09
Since the initial state has infinitely many black  squares to the left of the single blue square, 
17:14
the black triangles along the right  boundary do actually get bigger and bigger. 
17:19
So this picture of the initial state along with some of the history, 
17:22
appears again way down along the boundary every time we get to a sufficiently big triangle.
17:29
In fact all the black  triangles along right boundary 
17:32
are mini-recapitulations of the initial state. 
17:35
Here Rule 30 is starting over again inside itself. This is what I call "local nested structure". 
17:43
And it implies that every  finite region that appears 
17:46
reappears infinitely many times, and not only in the future but also in the past.
```

### Powers of 2

```
17:54
Before we wrap our exploration  of the right boundary, 
17:56
let's finally figure out why the period  lengths of the diagonals are powers of 2. 
18:01
It also comes from the left  permutivity of the rule, 
18:04
and the reason is quite nice. Suppose 2 consecutive diagonals, as a group, 
18:09
repeat every 2^n steps for some n. 
18:12
We'll see that the period length of  the next diagonal divides 2^(n+1).
18:17
Since the only numbers that divide  a power of 2 are powers of 2, 
18:21
this will give us what we want.
18:24
Periodicity is about certain  squares being the same color. 
18:27
Let's look at three specific  squares in that diagonal: 
18:30
the top square, the square 2^n steps later, and the square 2^n steps after that, 
18:36
which is 2^(n+1) steps down from the top square. These 3 squares can't be 3 different colors, 
18:42
because the only options are blue and black. So 2 of them have to be the same color.
18:47
If it's the first and the second, 
18:49
then at the second square the diagonal will behave just like it behaved from the beginning, 
18:54
so the period length divides 2^n. If it's the first and the third, 
18:58
then at the third square the diagonal will behave just like it behaved from the beginning, 
19:02
so the period length divides 2^(n+1). And if it's the second and third, 
19:07
then the diagonal behaves  the same at those two steps, 
19:10
so the period length divides 2^n, and since we can continue upward periodically 
19:15
in fact the first square also has the  same color as the second and third.
19:20
So either way, the period length divides 2^(n+1).
19:24
So along the right boundary,  the diagonals are periodic, 
19:28
with period lengths that are powers of 2.
19:31
The reason this doesn't stand out  visually when we look at the array 
19:34
is that the period lengths just grow too quickly for our eyes to be able to pick up the structure.
19:40
But on the other side, it's a different story. The Left Half.
```

### Left half

```
19:44
On the left, visually it's clear that  the diagonals enter repeating cycles. 
19:49
But they're not actually periodic from the start. We can see this better by rendering  
19:53
these diagonals as columns. The repetition doesn't start at the initial state.
19:58
And this means that information  down these diagonals can be lost 
20:02
because if it were preserved then the repeating cycles would continue 
20:05
backward in time all the  way up to the initial state. 
20:08
So flipping a square in the initial state may not have a long-term effect on its diagonal.
20:13
Let's see what happens when we flip the square just to the right of the initial blue square 
20:18
from black to blue. Did you catch it? 
20:21
Now I'm toggling that square back and forth, and you can barely tell a difference. 
20:26
Not only does it not affect its own diagonal; it hardly affects the rest of the automaton. 
20:32
Only at the right boundary  is there any difference.
20:35
But of course there are lots more  possibilities for the initial state. 
20:39
Some of them do have more dramatic  effects on the right half. 
20:43
But the left half is pretty unfazed. The structures shift up and down, 
20:47
but they appear to be  completely unchanged otherwise.
20:51
So, aside from these shifts, 
20:52
does any information from the initial state actually have a long-term effect on the left half? 
20:58
Or is there essentially just  one left half of Rule 30?
```

### Repeating cycles

```
21:03
Let's extract the eventual  repeating cycle from each diagonal, 
21:06
because we'll see a pattern if we look  at where the period lengths change. 
21:10
The boundary diagonal is solid blue. The next diagonal -- also eventually blue. 
21:16
Then we get an eventually black diagonal. Then alternating between black and blue, 
21:22
so here the period length increased. Then back to solid blue. 
21:27
Then two more alternating. Solid black. 
21:31
And now a longer cycle -- with length 4. Then solid blue. 
21:36
Then a bunch with length 4, one alternating, 
21:40
some more 4s, solid black, 
21:44
and then a longer one -- with length 8. 
21:47
Then back to a blue diagonal. And a bunch of 8s.
21:51
If we look at the first  appearances of 2, 4, and 8, 
21:56
we can actually tell what causes the  period lengths to increase there. 
22:00
Interestingly, they're sandwiched on  both sides by solid-color diagonals: 
22:05
The previous diagonal is solid black, and the next diagonal is solid blue.
22:10
We'll work through the first appearance of 8 to see why the previous diagonal must be black. 
22:15
There's also a nice explanation  for why the next diagonal is blue, 
22:19
but I'll leave this to you to  work out for yourself if you want. 
22:22
Some extra copies of the previous two cycles 
22:25
will help us see how they affect  the diagonal we're interested in.
22:29
Let's bring up the rule one last time. And shear the 8 cases to match. 
22:34
We're only going to need these 4 cases, where the middle input square is black, 
22:39
since the middle of the three  diagonals is solid black. 
22:43
And there's something special about these 4 cases. 
22:46
In the first pair, the left input  square is blue in both cases. 
22:51
So the inputs only differ in the right square. And what do the outputs do? 
22:56
If the right square is blue,  then the output is black. 
22:59
If the right square is black,  then the output is blue. 
23:03
So in both cases, the diagonal flips  its color from one step to the next.
23:08
That's what we see at the top here. The left and middle squares are blue black, 
23:13
so the right diagonal flips from black to blue. Same on the next step: 
23:19
Again the previous two diagonals are blue black, so the right diagonal flips again.
23:24
But now the left square is black, so we need to look at the second pair. 
23:29
Again the two inputs only  differ in the right square. 
23:33
If the right square is blue, the output is blue. If the right square is black, the output is black. 
23:39
In both cases, the diagonal keeps the  same color from one step to the next.
23:44
So in our computation, 
23:45
the right diagonal keeps  its color and stays black.
23:49
Now the left square is blue again, so we flip.
23:53
At this point we've gone through the  entire cycle of the two previous diagonals, 
23:57
because remember, as a group,  they repeat every 4 steps. 
24:01
But in the right diagonal, we haven't  returned to where we started yet. 
24:04
The right diagonal began as  black, but now it's blue. 
24:08
And why? 
24:09
Because the number of times  it flipped its color is odd, 
24:13
one flip for each blue  square in the left diagonal.
24:17
So over the next 4 steps, it'll  flip again an odd number of times, 
24:22
and then we'll be back to where we started.
24:24
So when there's a solid black diagonal, the period length doubles precisely when 
24:29
the diagonal to its left has an odd number of blue squares in its cycle.
24:35
What about if we don't have  a solid black diagonal? 
24:37
Well, if we see a blue square  in the middle diagonal, 
24:40
then we're in one of the other 4 cases. 
24:43
In this pair, again the two inputs  only differ in the right square. 
24:47
But look what happens: The outputs are the same. 
24:50
So here the automaton loses information  about what was in that right diagonal. 
24:55
Since both outputs are black, we can't recover  whether the previous square was blue or black.
25:00
And in this pair, the outputs are also the same, 
25:03
both blue. So the automaton loses information here too.
25:08
Middle blue squares are bad for  reversibility in these diagonals. 
25:12
If a repeating cycle contains  even a single blue square, 
25:15
it causes the next diagonal to its right  to forget all information about itself. 
25:20
And this means that its  repeating cycle only depends 
25:23
on the cycles of the previous two diagonals 
25:26
and therefore can't possibly  be longer than those cycles.
25:30
That's why the first appearances of 2, 4, and 8 occur right after black diagonals. 
25:36
Anywhere else and the period length  couldn't increase from the previous two.
```

### Multiverse

```
25:41
Okay, so does this tell us whether  there's only one left half of Rule 30, 
25:45
completely independent of the initial state? If we're going to see some variation, 
25:49
then, at the very least, 
25:51
information in the initial state needs to  have a long-term effect on some diagonal. 
25:55
We just saw that the only place information is  preserved is to the right of a black diagonal, 
26:00
so that's our only hope. But is that enough? 
26:03
We know the period length can double there. And if it doubles, the second half of the  
26:08
repeating cycle is a flipped  copy of the first half, 
26:12
so the entire cycle doesn't actually carry  any information about the initial state 
26:16
because either way we would  see those same two halves.
26:20
But must it double?
26:22
At the first appearance of 8, 
26:23
the period length doubled because of an  odd number of blue squares in this cycle.
26:29
If there had been an even  number of blue squares instead, 
26:32
then the period length wouldn't have doubled, and there's a possibility that 
26:35
information from the initial state would determine which of the two possible cycles we get.
26:40
So we're looking for a solid black diagonal with an even number of blue  
26:44
squares in the cycle to its left. But instances of this turn out to be hard to find.
26:50
The good news is that we don't need to  search naively through initial states. 
26:54
We can work directly with the cycles themselves, 
26:57
using each consecutive pair to determine  the possibilities for the next cycle.
27:02
It takes almost 400 more diagonals  to get to another black cycle. 
27:06
In the cycle just before it, the number of blue squares is 3. 
27:10
Since 3 is an odd number, no luck there. 
27:13
The period length doubles, and we get the first appearance of 16.
27:18
After that, we don't get another  black cycle until Diagonal 53208. 
27:24
How many blue squares are in the previous cycle? 6! An even number! 
27:29
So instead of the period length  doubling, it'll stay at 16, 
27:33
and there are two possibilities  for what happens next. 
27:36
If the top square in the next cycle is black, then the trajectory of cycles continues like this. 
27:42
But if the top square is blue, then it continues like this instead.
27:47
And if you keep computing these trajectories, 
27:50
thousands of diagonals later  you see more black cycles. 
27:53
And in fact these are also both preceded  by even numbers of blue squares, 
27:58
so they branch into two more possibilities. After that, in 3 of the 4 branches  
28:04
the period lengths double, but the fourth branches again. 
28:09
And presumably the branching keeps occurring, so that conceivably there are infinitely many  
28:14
different possibilities for  the left half of Rule 30.
28:18
Now, do initial states exist  that actually give rise 
28:21
to any of these other possibilities? I don't know. 
28:25
But my guess is that yes, they do exist. And if that's the case, then it's pretty nice. 
28:30
Because it means that, 
28:31
even though the left half is extremely regular, it's still performing an interesting computation.
```

### More rules

```
28:39
Rule 30 isn't the only cellular  automaton rule with left permutivity. 
28:43
I put together a bonus video showing  several others, like this one. 
28:47
It's free to watch on Patreon. And if you'd like to support videos like this, 
28:51
consider becoming a member. Thanks so much for watching.

All

Physics

Science

Information
```
