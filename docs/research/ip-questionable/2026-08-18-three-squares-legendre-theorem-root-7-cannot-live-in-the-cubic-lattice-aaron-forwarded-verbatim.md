# "What's up with √7?" — Legendre's three-square theorem, forwarded by Aaron 2026-08-18

> **PROVENANCE / IP STATUS.** YouTube transcript, forwarded verbatim by Aaron and filed here
> because its IP status is uncertain — that is what `docs/research/ip-questionable/` is for.
> Third-party copyrighted speech, preserved as an internal research ferry, not authored here and
> not for republication. Source: <https://www.youtube.com/watch?v=prIw_2NiDhw>. Presenter and
> channel not resolved from the page; the speaker states he begins a PhD in October on a topic
> using Legendre's three-square theorem. Timestamps and section headings are as supplied.
>
> **Register: MIRROR.** Unusually for this directory, the *mathematics* here is settled, published,
> and 2,000 years old — it is not contested. What is unearned is any connection to our work, and
> the Relation section below is careful about which links are real.

## The mathematical content, compactly

- **The hook.** The viral "double cube" realises `√1 … √6` as segments between integer points.
  `√7` never appears, however many unit cubes you add.
- **Why.** A segment between lattice points has length `√(x² + y² + z²)`, so the question is whether
  `7` is a sum of three integer squares. Squares below 7 are `{0, 1, 4}`; one `4` is forced (zeros
  and ones cap at 3), two `4`s overshoot, and `4 + 1 + 1 = 6`. No.
- **Diophantus → Descartes → Bachet → Fermat.** Successively larger excluded families: `24b + 7`,
  then `8b + 7` (the 3 was never used), then `32b + 28`, then Fermat's unification
  **`4^a(8b + 7)`** — resting on the lemma that `4n` is a sum of three squares iff `n` is.
- **Legendre (1798).** `n` is a sum of three squares **iff** `n` is *not* `4^a(8b + 7)`. Fermat
  proved only the exclusion half; the converse resisted Euler, Lagrange and Goldbach, and
  Dirichlet's 1850 proof needs quadratic reciprocity, Dirichlet's theorem on primes in arithmetic
  progressions, and the theory of ternary quadratic forms.
- **The Eureka corollary (Gauss).** `n` is a sum of three *triangular* numbers **iff** `8n + 3` is a
  sum of three squares — and `8n + 3` is never of the excluded form, so it always is.

## Relation to our work — what is real, what is coincidence

Aaron asked whether this connects to today's Ihara-zeta result (`K_{8,8}`, spectrum `{8, −8, 0¹⁴}`,
non-trivial poles at `±i/√7` on the critical circle `|u| = q^(−1/2)`). Two links are genuine; the
most eye-catching one is a trap.

### [COINCIDENCE — and it is the striking one] `√7` appears on both sides for unrelated reasons

Our Ramanujan critical circle has radius `1/√7`. The video is entirely about `√7`. **Same number,
unrelated origins:**

| | where the 7 comes from |
|---|---|
| **our graph** | `q = degree − 1 = 8 − 1 = 7`. The graph is 8-regular because the code has length 8; `q` is the branching factor of the non-backtracking walk. |
| **Legendre** | `7` is the smallest residue class mod 8 not representable as a sum of three squares — a **2-adic obstruction**, nothing to do with any degree. |

**One is a valency minus one; the other is a residue class.** Per
`.claude/rules/numerology-vs-number-theory.md` this is a legitimate *generator* — it is why this
document exists — and an illegitimate *conclusion*. Recorded as a coincidence **with the register
attached**, so it never silently becomes a belief; if structure is ever found, the entry gets
promoted and the promoting argument named.

The same caution kills the tempting `8 − 1 = 7` reading: our `8` is the code length, Legendre's `8`
is the 2-adic modulus. Both being "one less than eight" is one coincidence dressed as two.

### [REAL, worth pursuing] Both sit in 2-adic quadratic form theory

Legendre's exclusion is a **2-adic** obstruction — `x² + y² + z²` fails to represent `4^a(8b+7)`
over `Z₂`, and the video's mod-8 argument is that obstruction computed by hand. The mod-8 condition
governing **even unimodular lattices** — the one letting the `[8,4]` code generate **E8** by
Construction A, recorded in `src/Core/CliffordPeriodicity.fs` — is *also* a statement about integral
quadratic forms with a 2-adic component (Hasse–Minkowski local invariants; the oddity formula).

**Both eights are quadratic-form eights over `Z₂`.** That is a common ancestor rather than a shared
digit, and it is checkable (Conway–Sloane, *SPLAG* Ch. 15; Serre, *A Course in Arithmetic* Ch. IV–V).
**NOT established:** that the Clifford `8` (Atiyah–Bott–Shapiro) is the same eight. ABS periodicity
is representation theory over `R`; its relation to the 2-adic one needs a proof, not an observation.

### [REAL, and the concrete next step] Theta series is the shared instrument

`r₃(n)` — the count of representations as three squares — has a **theta series** as its generating
function. Lattices have theta series too, and **E8's is the Eisenstein series `E₄`**. Gauss's
class-number formula for `r₃(n)` is the classical bridge between the video's subject and modular
forms.

That yields a falsifiable follow-up rather than a vibe: **compute the theta series of the lattice our
`[8,4]` code generates and check it is `E₄`.** If it is, that is an independent confirmation that
Construction A landed on E8 — reached by *counting* rather than by the Gram-matrix check
`CliffordE8Roots.fs` already performs. If it is not, something upstream is wrong and we want to know.

### [NOT a connection] The Ihara zeta cannot see any of this

Today's zeta is a function of the **adjacency matrix alone** — it cannot see the dashing or the
height assignment, and equally cannot see any arithmetic of the code beyond the graph the code
produces. Its `√7` is a graph-theoretic constant. **Nothing in Legendre constrains it and nothing in
it constrains Legendre.** Saying so plainly is the point of this section.

## Why it was worth ferrying regardless

1. **A worked example of our own discipline, from someone with no stake in it.** The video states it
   outright: *"everything we've done so far can only ever rule numbers out, not create a
   representation."* The exclusion half took Fermat; the construction half took another 160 years and
   three heavy theorems. That is exactly the asymmetry between a falsifier and a proof.
2. **Fermat's margin.** He announced the general polygonal theorem, said the proof depended on
   *"numerous and abstruse mysteries of numbers"*, promised a book, and never wrote it — and the
   claim carried his name unproved for over a century. Worth keeping beside any of our own §A rows
   reading PROVEN on an evidence line nobody has re-derived.

---

## Transcript (verbatim)

```
0:02
This picture went viral a few years ago for obvious reasons. Like come on, look
0:05
at this thing. It's a very simple double
0:08
cube and we focus on those six lines.
0:11
They magically happen to create this nice sequence of roots from one to six.
0:17
Root one is just an edge of a cube. Root
0:20
two is the diagonal of a face. Root
0:23
three is the diagonal of the whole cube
0:25
and so on.
0:27
It's great and all, but mathematicians tend to be greedy. Maybe we
0:32
could extend this sequence and do better
0:34
than that. Let's add another cube.
0:40
Okay, we have square root of 9 10 11.
0:44
But it leaves a gap and the gaps are not
0:47
good. We are still missing seven and eight.
0:51
Well, maybe we could add a cube to its bottom.
0:57
Okay, that's progress. We've got square
0:59
of 8, but where is square of 7? Sure, we
1:03
could keep piling on those cubes and it
1:05
would keep producing new lengths, but no
1:08
matter how many we add, square of 7 is
1:10
never going to show up. And the general
1:13
reason for square root of 7 and for a
1:15
whole lot of other numbers too isn't
1:18
some quick observation. It's one of
1:20
those long-running puzzles in mathematics.
1:23
This exact question, how many numbers
1:25
can be found in such cubic solids, kept
1:27
mathematicians awake at night for over
1:30
2,000 years. And it gave rise to the
1:33
field now known as additive number
1:35
theory. So, let's jump into this rabbit
1:37
hole and find out what map is hiding
1:40
behind this double cube.
```

### 1. What's up with √7

```
1:45
Take another look at the viral double
1:47
cube. Let's start by proving that square
1:49
root of seven really can't be the length
1:51
of a segment sitting inside this or any
1:54
other solid built out of unit cubes. But
1:57
what does that even mean? Which segments
2:00
are we even talking about here? Look at
2:03
those six lines. Each one starts and
2:05
ends at a vertex of one of the cubes.
2:08
And that's exactly the property we want.
2:11
This segment here doesn't count because
2:13
it lands on an edge instead of a vertex.
2:17
A much better way to look at this is to
2:19
drop the double cube into a 3D
2:22
coordinate system. The key observation
2:24
is that the vertices of the unit cubes
2:26
are exactly the points with integer
2:29
coordinates. It allows us to drop the
2:31
cubes entirely and restate the problem.
2:34
Can you find two points in 3D space with
2:37
integer coordinates whose distance is
2:39
exactly square root of 7?
2:41
So take two such points, lattice points as
2:44
they're called, with general integer
2:47
coordinates k and m and a b c —
2:51
the distance between them comes from
2:53
this formula related to Pythagorean
2:55
theorem. If that were to be equal to
2:57
square root of 7 the expression under
2:59
the square root would have to be equal
3:01
to 7 itself. And since all of those
3:04
differences are integers, we can rename
3:06
them and simply write 7 is equal
3:09
to x² + y² + z².
3:14
So even though this problem is geometric
3:16
by nature, the solution is going to come
3:19
from algebra.
3:21
To rule out square root of 7 as a
3:23
distance between two lattice points, all
3:25
we need is to prove that 7 cannot be
3:28
written as a sum of three integer
3:30
squares. And that part turns out
3:32
to be surprisingly easy.
3:36
The fastest route is to look at which
3:38
squares are even available to us. The
3:41
first three are zero, 1, and four. All
3:45
are fine. But now take a look at three
3:48
squared. That's nine, already bigger than
3:51
seven. So it's useless to us.
3:54
And every square after that is bigger.
3:57
So the only squares we can use are 0, 1,
3:59
and four.
4:01
Now we want to pick three of those
4:03
numbers with possible repeats that add
4:06
up to seven, can we? First of all, we
4:10
have to use at least one four because
4:12
zeros and ones alone give us the maximum
4:15
of three. But we can't use two of them
4:18
either because two fours already give us
4:21
eight, which overshoots. So it must be
4:24
exactly one four. And then the best we
4:27
can do is 4 + 1 + 1 which is 6 —
4:31
not enough. Therefore 7 cannot be written as
4:34
a sum of three perfect squares.
4:38
So just to recap we proved that square
4:41
of 7 cannot be found in such cubic-like
4:44
shape which means that we cannot do
4:46
better than that. Now we could call it a
4:49
day but as a fellow mathematician I want
4:52
more. Seven is not a sum of
4:54
three squares, but numbers 1 through six
4:57
are. So, a natural question occurs.
5:00
Which numbers can be split into three
5:02
squares and which ones can't? What do
5:05
those numbers look like? Is there a
5:07
pattern or is it messy like with primes?
5:10
In fact, this question has a
5:12
neat short answer and it is so so hard
5:16
to prove that it absorbed the minds of
5:18
the greatest mathematicians.
5:20
Euler, Gauss, Legendre, Diophantus. To
5:24
fully understand this story, we need to
5:26
go way back to ancient times.
```

### 2. Ancient polygons

```
5:32
The Pythagoreans placed great importance on
5:34
number theory, in particular on parts
5:37
related to geometry.
5:39
This led to their interest in
5:41
triangular, square, and more generally
5:44
polygonal numbers which come from
5:46
geometric constructions. For
5:48
example, we can build a triangle with
5:50
side two out of just three dots. Side
5:54
three takes six dots since we add a new
5:57
row of three to the previous triangle
6:00
and so on. That's why the second
6:03
triangular number is three, the
6:05
third is six, and the fourth is 10. We
6:09
also define the first one to be one and
6:11
the zero one to be zero.
6:30
In similar fashion, you can define
6:32
square numbers, pentagonal numbers and
6:35
so on. Oh, and the square case is
6:38
genuinely interesting because those are
6:40
exactly the perfect squares. 1 4 9 16
6:45
and so on.
6:50
They and many other mathematicians over
6:53
the years discovered or maybe invented a
6:56
lot of identities tying polygonal
6:58
numbers together. For example, that the
7:01
sum of two consecutive triangular
7:03
numbers is a square number.
7:06
or that 8 * any triangular number plus
7:09
one is a square number as well. Then
7:13
much much later in the 17th century to
7:15
be precise Claude Gaspar Bachet who was
7:18
also into the topic took a different
7:20
approach to those numbers and proposed
7:22
what we now call Bachet's conjecture. It
7:25
says that every natural number can be
7:28
written as a sum of at most four
7:30
squares. And that's the turning point of
7:33
our story.
7:35
Let's focus on the number four here. Is
7:38
it optimal? Maybe three squares are
7:40
enough. Well, we've seen already that
7:43
some numbers can be represented as a sum
7:46
of three squares. The seven for
7:48
instance. But are there more? In fact,
7:52
Diophantus proved that there are infinitely
7:54
many of those. And he did it without
7:57
even trying to.
```

### 3. Diophantus for the help

```
8:00
In his Magnum Opus arithmetica,
8:04
Diophantus solved a whole bunch of self-posed
8:06
problems, but I want to focus on this
8:09
particular one. Problem 11 from book five.
8:14
In this problem, we want to split the
8:16
number one into three parts such that
8:18
each of them after adding a given number
8:21
a becomes a rational square. Add those
8:24
three squares together and you get an
8:27
equivalent formulation of this problem.
8:29
We want three rational squares each
8:31
greater than a adding up to 3a + 1.
8:36
Nice. That kind of looks like our
8:38
problem. And while solving his, he
8:41
solved a part of ours too. You see, he
8:45
stated that the number a here cannot be
8:47
of the form 8b + 2. Since integer
8:51
squares sit under the umbrella of
8:52
rational squares, his result also tells
8:55
us something about which numbers can't
8:57
be written as a sum of three perfect
9:00
squares. Plugging this 8b + 2 into 3a
9:04
+ 1, we get that numbers of the form 24
9:07
b + 7 are not representable as three
9:10
squares. And that really is true, which
9:12
we are going to prove right now. To do
9:16
that, we need one simple tool,
9:18
modular arithmetic. It might sound
9:21
fancy, but it's really just another way
9:23
of writing division with remainder, where
9:26
you only care about the remainder
9:27
itself. Imagine dividing a number n by
9:31
8. You write that n is equal to 8b +
9:35
remainder r. In modular arithmetic, we
9:38
would say that n is congruent to r
9:41
modulo 8. As simple as that.
9:44
Now our numbers 24b + 7 are of the form
9:48
8 * 3b + 7. So all of them leave a
9:52
remainder of 7 when divided by 8. In
9:56
other words, 24b + 7 is congruent to 7
10:00
modulo 8. For us, this means that if
10:03
such a number were a sum of three
10:05
squares, that sum would also have to be
10:08
congruent to 7 modulo 8. And here's the
10:11
fun part. Remember our proof that seven
10:14
cannot be written as a sum of three
10:15
squares. Almost the same line of
10:18
reasoning does the job here as well.
10:21
The key is to notice that a perfect
10:23
square can be congruent to only 0, 1 or
10:27
4 modulo 8.
10:29
Take any square, call it x².
10:33
Divide x by 8 with remainder. So that
10:36
x² becomes (8y + r)². expand it and
10:41
group everything that's divisible by 8.
10:44
Those grouped terms vanish under modulo
10:47
8, which leaves x² congruent to just r².
10:50
Nice. Now we only have to check the
10:54
different remainders x can leave when
10:56
divided by 8. And there are only eight
10:59
of them. The integers from 0 to 7.
11:02
Running through all of them, modulo 8
11:05
gives exactly what I promised. Three
11:07
options and that's it. Every perfect
11:10
square, no matter how big, leaves a
11:12
remainder of 0, 1, or four when divided
11:15
by eight.
11:18
Now take any three squares and add them
11:20
up. The remainder of the sum depends
11:22
only on the remainders of the parts and
11:25
each of those is 0, 1 or 4. So all we
11:28
have to check is whether you can build a
11:31
7 modulo 8 out of them. The biggest sum
11:34
possible here is 4 + 4 + 4, which is 12,
11:38
while the next number leaving a
11:40
remainder of seven is 15. Way out of
11:43
reach. So the only way to get a
11:46
remainder of seven is to hit the number
11:48
seven exactly.
11:50
But that's precisely what we ruled out earlier.
11:54
Which means a sum of three squares
11:56
simply cannot leave a remainder of seven
11:58
when divided by 8. While every number of
12:01
the form 24b + 7 does.
12:04
Therefore we arrive at a contradiction.
12:07
Diophantus was indeed right.
12:11
This proof actually shows something
12:13
more. Notice that we never used the
12:16
three hiding inside that 24.
12:18
So the number 24 in Diophantus's result can
12:21
be replaced by 8 and everything still
12:24
works. Therefore, no number of the form
12:27
8B + 7 is a sum of three squares.
12:33
This is something that Descartes noticed
12:35
many years after Diophantus's results were
12:37
published. And Bachet, yes, the
12:40
same one as in Bachet's conjecture,
12:42
spotted that even the Descartes condition
12:44
wasn't enough since numbers of the form
12:46
32b + 28 also can't be represented as
12:50
three squares.
12:52
But even both families don't give us the
12:55
whole picture here. There are far far
12:58
more natural numbers that can't be
13:00
represented as a sum of three squares.
13:02
And the first person to notice this was Fermat.
```

### 4. Fermat and his damn margins

```
13:09
Pierre de Fermat was one of those
13:10
mathematicians that touched a lot of
13:12
subjects and stated a lot of conjectures
13:15
some of which you may know very well
13:18
like Fermat's last theorem. And
13:20
the three squares problem was no
13:22
exception. Fermat shows here too. But
13:25
unusually for him, he contributed quite
13:28
massively.
13:30
Fermat noticed something brilliant. The
13:34
two families we just met, Descartes' 8b +
13:37
7 and Bachet's 32b + 28 are secretly
13:41
interconnected.
13:43
The second one is just the first one
13:45
multiplied by 4. And Fermat claimed we
13:48
can multiply not only by four but by any
13:51
power of four. And the property still holds.
13:55
This essentially follows from this one
13:57
very simple statement. If 4n splits into
14:01
three squares, then so does n.
14:04
To prove it, we will use the same
14:06
modular arithmetic tricks as before,
14:09
only with four instead of 8. An even
14:12
number squared is 4r². So it leaves a
14:16
remainder of zero when dividing by 4.
14:18
An odd number squared is 4(r² + r) + 1.
14:22
So it leaves a remainder of 1
14:27
and these are the only options which
14:29
means that this time the remainder
14:31
depends only on the parity of squared number.
14:35
So suppose 4n can be split into three
14:38
squares x² + y² + z². The left side
14:43
is divisible by 4. So the three
14:45
remainders on the right have to add up
14:47
to something divisible by four.
14:50
And out of zeros and ones, the only way
14:53
to do so is by choosing three zeros,
14:55
which means that all three squares are
14:58
even. And we can write them as (2a)² + (2b)²
15:01
+ (2c)². Then divide everything by
15:05
four. And that's it. Here's the
15:07
representation for n.
15:11
Implication works in the way that we can
15:13
just read it backwards. But we need to
15:14
negate everything. So if n can't be
15:18
written as a sum of three squares, then
15:20
4n can't either. And it means that
15:24
neither can 16n or 64n all the way up.
15:28
And since numbers 8b + 7 can't be
15:31
represented as a sum of three squares,
15:33
neither can numbers of the form 4 to
15:36
the power of a * (8b + 7).
15:40
Fermat with this simple observation
15:43
generalized those two results into a
15:45
whole family of numbers that cannot be
15:48
written as a sum of three squares and he
15:50
claimed that these are the only
15:52
ones. The problem is Fermat is Fermat. He
15:56
liked to make empty promises and yes
15:59
you've guessed it he didn't prove it
16:01
entirely, only the part we already
16:04
covered which is that those numbers
16:06
can't be represented as a sum of three
16:08
squares. Fermat never found out why every
16:11
other number not of this form is
16:14
representable as a sum of three squares.
16:16
And honestly, this doesn't surprise me
16:19
at all. Not because Fermat liked to
16:21
complain about margins being too small,
16:24
but because even the hardest proof of
16:26
this theorem is still brutally hard to
16:29
comprehend. And the original one from
16:31
the 18th century absorbed the mind of
16:34
about every great mathematician of the era.
```

### 5. GOATs meetup

```
16:41
This conjecture stated by Fermat in 1636
16:44
gathered the finest mathematicians of
16:46
the 17th and 18th centuries. 
16:49
Descartes and Lagrange worked on it ticking
16:53
off smaller cases and so did Euler who
16:56
honestly did a ton of work on this
16:58
topic. For instance, he found a
17:01
connection between the 8m + 3
17:03
case and triangular numbers which he
17:06
couldn't quite use.
17:08
In fact, Gauss picked it up 66 years
17:11
later in a theorem now called Eureka theorem.
17:16
Euler also corresponded with Lagrange and
17:19
Goldbach and together they got
17:21
really really close to the final proof.
17:24
But the one who crossed the line was
17:27
Legendre who with some ridiculous brute
17:31
force method finally proved the whole
17:32
thing in 1798.
17:35
That's why we now call it Legendre's three
17:38
square theorem.
17:41
This result is a culmination of over
17:44
2,000 years of hard work done by
17:47
hundreds if not thousands of
17:49
great mathematicians. It's a beautiful
17:52
story, but a bittersweet one. Bitter
17:55
because modular arithmetic is nowhere
17:58
near enough to finish the job.
18:00
Everything we've done so far can only
18:02
ever rule numbers out, not create a
18:04
representation.
18:06
Sweet. Because the refined proof, the
18:09
one that mathematicians reach for today,
18:11
published by Dirichlet in 1850, pulls out
18:14
some absolutely exquisite machinery.
18:18
The first ingredient is the theorem that
18:20
has famously been proved in over 240
18:23
different ways, the law of quadratic
18:26
reciprocity.
18:28
The second thing Dirichlet needed was his own
18:30
theorem on arithmetic progressions which
18:33
says that if a and b share no common
18:35
factor then the sequence an + b
18:38
contains infinitely many primes.
18:41
And the third and last ingredient were
18:43
ternary quadratic forms plus the entire
18:46
theory built around them. Every single
18:49
one of those is hard to prove on its
18:51
own. This is the cost of proving
18:54
Legendre's three square theorem. So no,
18:57
sadly I cannot show you the whole proof
18:59
today because that would make this video
19:02
like 3 hours long,
19:04
but that doesn't mean it's over.
```

### 6. EYPHKA

```
19:10
Surprisingly, Legendre's three square
19:12
theorem is not the last chapter of this
19:15
story. Fermat's polygonal number theorem is —
19:19
for context we'll need to go back to
19:21
Bachet who as I've said earlier
19:23
conjectured that every number can be
19:25
written as a sum of at most four squares
19:29
but there was one detail I deliberately
19:32
left out. Fermat jumped on this result
19:35
and stated a much more general
19:38
conjecture and I quote, "I was the first
19:42
to discover the very beautiful and
19:44
entirely general theorem that
19:46
every number is a sum of at most three
19:49
triangular numbers. Every number
19:50
is a sum of at most four squares. Every
19:53
number is a sum of at most five
19:55
pentagonal numbers and so on ad
19:58
infinitum, whether it is a question of
20:00
hexagonal, heptagonal or any polygonal
20:03
numbers. Oh, and here's the fun part. I
20:06
cannot give you the proof here which
20:08
depends upon numerous and abstruse
20:11
mysteries of numbers for I intend
20:13
to devote an entire book to this
20:16
subject." Spoiler, he never did and other
20:20
mathematicians had to finish the job for him.
20:23
We'll start from the end. The pentagonal
20:26
and higher cases were handled by our
20:28
lord and savior Cauchy in 1813.
20:32
The four squares case was done by Lagrange
20:35
in 1770.
20:38
But the three triangular numbers case is
20:40
something I want us to prove. We are
20:43
in for a treat. Just to make
20:46
sure we're on the same page, we want to
20:48
prove that every natural number can be
20:50
written as a sum of three triangular
20:53
numbers. We defined those back at the
20:55
start of this video, but I never gave
20:57
you the algebraic definition. The nth
21:00
triangular number is the number of dots
21:02
in a triangle with side n, which is just
21:05
1 + 2 + 3 and so on up to that final row
21:10
of n dots.
21:12
As per anecdote from Gauss's childhood,
21:14
to find an explicit formula for the sum,
21:17
one just needs to double it and sum it
21:20
in reverse order.
21:23
Now we can see that each column here
21:25
sums up to n + one and there are exactly
21:28
n columns like that. So the whole thing
21:31
adds up to n * (n + one). And since we
21:34
calculated two such sums, we just need
21:36
to divide by 2. And here we go. The
21:39
algebraic definition of the nth
21:41
triangular number is n * (n + 1) / 2.
21:47
The first person to actually prove that
21:49
every number can be written as a sum of
21:51
three triangular numbers was actually
21:53
Gauss himself because who else? And we
21:56
are going to follow his line of
21:58
reasoning.
22:00
It comes down to showing that
22:01
representing a number with three
22:03
triangular numbers is equivalent to
22:05
something we already know. Let's write n
22:09
as a sum of three triangular numbers
22:11
using our fresh algebraic definition.
22:14
Now we do something rather unintuitive,
22:17
so you got to trust me. We multiply both
22:19
sides by eight and then add three to
22:23
both sides. On the left is a plain
22:25
three, but on the right we split that
22:27
three into ones and hand one to each of
22:30
those parts. And here comes the eureka
22:34
moment Gauss had while writing this
22:36
proof. Those three expressions are
22:38
perfect squares. So it connects to
22:41
Legendre's three square theorem.
22:44
And the best part is this works in
22:46
reverse too.
22:48
Do you remember that a square can only
22:50
leave a remainder of zero or one modulo
22:53
4? Well, 8n + 3 leaves a
22:57
remainder of three. And the only way to
22:59
build a three out of zeros and ones is
23:01
by getting 1 + 1 + 1. So in every single
23:06
representation of 8n + 3 as a sum of
23:09
three squares all three squares are odd
23:12
which means that we can always write
23:14
them as (2x + 1)², (2y + 1)² and (2z
23:18
+ 1)² and run this whole computation
23:21
backwards.
23:23
Therefore a natural number n is a sum of
23:26
three triangular numbers if and only if
23:28
the number 8n + 3 can be written as a
23:31
sum of three perfect squares. And that
23:34
means we are actually done. Legendre's
23:37
three square theorem tells us that the
23:39
only numbers missing such a
23:40
representation are those of the form
23:43
4^a * (8b + 7) and 8n + 3 is never
23:48
one of them. So 8n + 3 always splits
23:53
into three squares
23:55
and n always splits into three
23:57
triangular numbers.
24:01
That's the Eureka theorem done. And with
24:04
it, the theorem this whole story was
24:06
building to — Fermat's polygonal number
24:09
theorem — is finally complete.
```

### The end (?)

```
24:13
And that's where our journey really ends
24:18
or does it? We've mainly talked about
24:21
three squares case, but what about two
24:23
squares or four squares? How do you
24:25
tackle those? Also representing integers
24:28
as sums of polygonal numbers is a
24:30
classic problem of additive number
24:32
theory, a standalone field of
24:34
mathematics full of magnificent results.
24:37
Even my own future is tangled up in it
24:40
because in October I'm starting a PhD on
24:43
a topic that has me using Legendre's three square
24:46
theorem all the time. Case in point that
24:50
this subject and this journey is far far
24:54
from over. Who would have thought that
24:56
this silly picture hides so much
24:59
mathematics?
```
