# Scott Vokes — "Data Structures: The Code That Isn't There" (Strange Loop 2012) — spoken transcript (Aaron-forwarded)

**Ferried:** 2026-08-01 by Aaron (`infoq-12-sep-datastructures.mp3`, 37 MB, ~39 min).

**Transcribed:** locally, free, no upload — `mlx-community/parakeet-tdt-0.6b-v2` (NVIDIA Parakeet TDT via MLX), 114 s on Apple Silicon.

**Model choice was measured, not assumed.** whisper-large-v3-turbo ran faster (61 s) but wrote **"Prologue" 9 times out of 9** where the speaker says **Prolog**; parakeet got it right 8 of 9. For a talk whose core section is a Prolog technique that is not a cosmetic difference. See `.claude/skills/speech-to-text/SKILL.md`.

**This is the SPOKEN half.** The slide capture is the companion doc `2026-08-01-scott-vokes-…-difference-lists-holes-rolling-hash-aaron-forwarded.md`. Terms appearing on slides but never spoken — "Gordon Bell", "Tridgell" — are absent here, correctly.

**Verbatim, lightly segmented by sentence boundaries. Not corrected — ASR errors are left in place so a reader can judge them.**

---

**[0:00:00]** This presentation was recorded at StrangeLoop 2012 in St.

**[0:00:04]** Louis.

**[0:00:04]** This audio file and others like it are available for free download at InfoQ.com.

**[0:00:09]** I'm Scott Vokes, and I'm going to talk about how to make data structures do a lot of your hard work for you.

**[0:00:15]** So I ran across this quote a couple years ago, and it just wormed its way into my brain.

**[0:00:21]** This is from Ralph William Gosper, also known as Bill Gosper, who was one of the really old school artificial intelligence lab people.

**[0:00:29]** A data structure is just a stupid programming language.

**[0:00:33]** And I get what he's saying in that, but that struck me as maybe being a little bit overly negative.

**[0:00:39]** There's a lot of good things about data structures being so dumb and simple and narrow in what it is they're capable of.

**[0:00:46]** And maybe it might be better off treating a data structure like a tiny virtual machine.

**[0:00:50]** Because you can analyze it in isolation, know all of the design trade-offs that are going to go into it, and be able to tell, predict very, very realistically how it'll behave in a lot of scenarios.

**[0:01:02]** And so there's a bunch of just basic CS101 data structures.

**[0:01:05]** There's linked lists, arrays, hash tables, binary trees.

**[0:01:09]** And probably all of you have a pretty good idea how each of those would behave in different circumstances.

**[0:01:15]** But it's possible to make things go horribly wrong if you choose the wrong one of those in a simple situation.

**[0:01:22]** For example, I saw that there was a very brief performance regression with Ruby.

**[0:01:28]** I have the bit.ly link on there if you want to read more about that.

**[0:01:31]** Sometime around Ruby 1.9.2, and I never personally witnessed this, but apparently, if you were starting Ruby up and you had a Rails app, which tends to have lots and lots of small files, it went from, say, taking a couple seconds to start up to taking tens of seconds.

**[0:01:51]** And that was because they switched the implementation of opening up new files, checking if files were already open to use a list instead of using a hash table, which in practice tends to play out a lot like this magic trick, where you say, okay, shh, pick a card.

**[0:02:09]** And somebody picks a card and hands the deck back to you.

**[0:02:12]** And then you say, is this your card?

**[0:02:14]** No?

**[0:02:14]** Okay, how about this?

**[0:02:16]** How about this?

**[0:02:17]** How about this?

**[0:02:19]** How about this?

**[0:02:20]** How about this?

**[0:02:21]** Ta-da!

**[0:02:23]** And every time it opened a new file, that deck got progressively larger.

**[0:02:28]** So it would have to zip through possibly hundreds, possibly thousands of files.

**[0:02:34]** And in big O notation, that is commonly referred to as fail.

**[0:02:42]** So somebody realized pretty quickly that that had gone horribly wrong and switched it back out to use a hash, which is a much more sensible choice for there.

**[0:02:51]** Because using a list would lead to a lot of completely unnecessary, very redundant work.

**[0:02:58]** And oh, this is not working.

**[0:03:01]** Okay.

**[0:03:02]** And another thing that comes out of using a hash there instead of a list is that the data structure itself is doing a lot of work in limit it's eliminating that redundant work because in choosing one file it's already ruled out the vast majority of things it would have to look at otherwise and so there's also this quote here about the most reliable parts of the system being the ones that don't even need to be there in the first place and I started really thinking about how good choice of data structures could subtract more and more of the code that actually has to manually do something in systems as a very major point for their reliability and ultimately it comes down to like if you have a bottle and you want to fill it especially if it has a very narrow neck you can take an eyedropper and go blip blip blip into it and fill it up gradually and make sure that you don't drip on the table around it or something like that or you can just use a funnel which is only going to do what you want it to do it's not capable of anything else and so you need to put a lot less effort into just manually checking that it does the right thing so ultimately the choice of data structures set the path of least resistance for what your program is going to do also the data structures have a major tendency to bubble up to the surface in terms of just lots of little uh unexpected characteristics in their behavior like if you look at git and mercurial uh to my understanding and it's it's been a while since i really looked into the internals of either of them so this may not be true anymore but i'm pretty sure it was the case a while ago uh git stores all of its content in one flat database and its branches and such whereas mercurial stores its its uh changes in a file specific database so if you want to move a file and then it moves all of the chunks of data patches and such for it to a new file it actually has to do a lot more work whereas in git it can just say oh okay uh this file name is now this and it doesn't actually have to move the content and uh so these internal data formats have a really nasty way of leaking out to the core of the system they're leaky abstractions the important thing with choice of data structures is you're probably not going to know what an ideal one is for whatever it is you're trying to do but as long as you don't paint yourself into a corner and you can change them down the line you can really improve that situation but enough about the basics because those are not terribly exciting data structures uh I'm sure many of you have implemented several of them, studied them in school and that kind of thing.

**[0:05:48]** But here's a couple more advanced data structures and some lessons that I think are embodied in them.

**[0:05:54]** So first off, there's one called a skip list.

**[0:06:00]** And I'm just going to build that up from kind of basic principles.

**[0:06:09]** If you take an ordered linked list, so here we have just a series of numbers that don't really have any significance, but they're in ascending order.

**[0:06:19]** And just so that the list has definite anchors on it, it starts out with negative infinity and positive infinity at the end.

**[0:06:27]** And then if you add an express lane on it, like some subways have, where if you want to go from the beginning, you go point by point through it, but there's another higher level of it that skips maybe about half of them.

**[0:06:40]** And if you know that you want to get much further towards the end anyway, you can skip along on that for quite a while and then transfer over.

**[0:06:48]** And if you add another one like that, at another level, then that will skip even more of them.

**[0:06:55]** And really at that point, it starts looking kind of like a balanced binary tree, like this.

**[0:07:02]** And this has a very nice sort of quality to it, where if you start at the beginning, the top row you can get in constant time in one step.

**[0:07:11]** The next row you can get to in two steps because you have to compare and then branch to the left or the right if it's less or greater.

**[0:07:17]** And then three steps and then four steps.

**[0:07:20]** And in four steps, you can already address quite a bit of content.

**[0:07:24]** And so a skip list structured ideally like this would look like this with some deliberate stylistic echoes of it.

**[0:07:32]** And the numbers here are probably too small and hard to read, but it doesn't matter.

**[0:07:35]** It's still just 1 to 15.

**[0:07:40]** So but there's a very, very tall one in the middle, and then most of them are actually one level tall.

**[0:07:46]** About half of those are one further up, half further are another level taller.

**[0:07:53]** But how do we balance that?

**[0:07:55]** Because to get that sort of ideally balanced kind of structure, you need to know all of the content that's ultimately going to go in.

**[0:08:02]** And that's a problem because oftentimes these data structures are built up incrementally.

**[0:08:06]** They're built up from streams of data that may not all be available at the same time ever.

**[0:08:12]** But the thing is, it doesn't have to be perfect.

**[0:08:14]** In fact, if you look at real trees in nature, they're not ever perfectly balanced.

**[0:08:19]** They're just balanced enough that they don't keel over.

**[0:08:24]** Another thing too is they grow up.

**[0:08:26]** I don't know if any of you have ever noticed this.

**[0:08:30]** But I don't know, maybe they get to that in grad school or something.

**[0:08:33]** So you can build a skip list that is kind of balanced enough just by randomly assigning levels for it with a known probability distribution.

**[0:08:43]** So that if you look at one like this, about half of them have a level where they're one high, about half further two, about half further three and four and so on.

**[0:08:53]** So if you want to add a new point between these two here, say, to choose the level, you would start out at one and flip a coin, and if it's heads, then you add one level to it.

**[0:09:03]** If it's tails, you stop.

**[0:09:05]** And you keep flipping, and less and less of them will ultimately end up being very, very tall, but you still have that sort of idealized distribution.

**[0:09:14]** And it doesn't need to be exactly a 50% probability you can tweak that.

**[0:09:20]** But because it's about the proportions of the levels rather than the exact ordering of it, ultimately, you can completely shuffle them around like that and just assign the levels randomly as you build it up.

**[0:09:31]** And there are extraordinarily good odds that it will still behave pretty close to optimally.

**[0:09:39]** And these actually have exactly the same counts of distributions.

**[0:09:43]** It's maybe a little bit difficult for the human eye to exactly see the same counts, but you can tell that there's a lot of them that are very, very short.

**[0:09:55]** And this made me think of a property that I like to call acting like roundabouts, not traffic lights.

**[0:10:01]** I don't know if there are roundabouts in the St.

**[0:10:03]** Louis area.

**[0:10:04]** Okay, cool.

**[0:10:05]** So a traffic light is a sort of centralized coordinating authority, which can become a bottleneck, and it's a single point of failure.

**[0:10:14]** Everything in the system has to interact with that in order for the system to manifest its overall behavior.

**[0:10:21]** Whereas a roundabout, you pull up to it and you look at the other cards around you, and if there's somebody coming, you give them right away.

**[0:10:28]** If the roundabout is empty, you can just slow down a little bit and go right through.

**[0:10:32]** And all of those decisions are very localized and based on just the immediate neighbors.

**[0:10:36]** And a sort of overall global order emerges from all of those decisions that are being made.

**[0:10:44]** It still controls traffic without there actually being any it that is running things.

**[0:10:50]** So back to the skip list.

**[0:10:52]** Another nice property with it is because most of these things only really need to be connected to their immediate neighbors because it's still just a forward link list and half of the nodes in there only have one forward pointer and half as many more only have two and so on, then if you have several modifications happening to this list concurrently, you can actually have almost half the list being inserted between at the same time without there being any real lot contention.

**[0:11:23]** But that's still a mutable data structure.

**[0:11:26]** The next data structure is about a list that's immutable that you're able to append to, which is somewhat unusual.

**[0:11:37]** I'll try to not talk into the bottle anymore.

**[0:11:39]** That does not sound good.

**[0:11:45]** And it's called a difference list, which is an idea from Prolog.

**[0:11:50]** Has anybody here used Prolog before outside of school?

**[0:11:54]** Just curious?

**[0:11:55]** No?

**[0:11:59]** Prologue has a lot of, oh, and Haskell has something called a difference list too.

**[0:12:04]** I don't quite follow what it does, but I don't think it's that closely related.

**[0:12:10]** It's rather odd that it has that name, but the name difference list itself is also somewhat odd.

**[0:12:16]** But this is not related to that at all, or if it is, only very, very loosely.

**[0:12:21]** There's a lot of other cool ideas in Prolog 2.

**[0:12:24]** The problem is that not that many people use it.

**[0:12:28]** There's a book called The Art of Prolog that I worked through a lot of the exercises in and picked up a whole bunch of really interesting ideas.

**[0:12:36]** It's probably not that practical as a language for full programming in its own right, but it makes a lot of sense, like as an embedded database or rules engine, something like data log, if any of you saw Michael Fogus' talk before.

**[0:12:51]** But okay, so back to the concept of the difference list and how you can have something that's immutable and yet you can still change it in that way.

**[0:12:59]** It becomes a sort of retroactive immutability in that if you append to the structure, it doesn't actually impact how you can reason about the structure because it behaves as if it had always been that way.

**[0:13:15]** So I need to take a little detour into Prolog and how that works first, just the idea of unification.

**[0:13:22]** If you look at this here, it says, does XYX match 12Z?

**[0:13:28]** And the uppercase letters, that's a Prolog convention that means that those are variables.

**[0:13:32]** You might be familiar with that from Erlang or something also.

**[0:13:35]** So it says, does XYX match 1, 2, and Z?

**[0:13:39]** And it says, yes.

**[0:13:40]** If X is 1, Y is 2, and Z is 1.

**[0:13:44]** And because X is both the first and last position right there, it knows that those both need to match to the same value.

**[0:13:50]** So then the 1 flows over from the first 2Z in the last slot.

**[0:13:57]** Does that make sense?

**[0:13:58]** Okay.

**[0:14:01]** But what you can also do in Prolog is have data structures that have little holes in them that are unbound values that are passed around.

**[0:14:09]** Ultimately, they may have some meaning, but they're not bound yet.

**[0:14:12]** But as soon as they have that meaning, then they're set forever.

**[0:14:16]** They're called logic variables, and they're away at a language level of explicitly modeling partial information, which is a very, very useful property.

**[0:14:25]** And so you can also unify this, and I have an H for the whole value, where it's matching XYH to 1, 2, Z, and it says, I don't know what Z or H are, but they have to match each other.

**[0:14:38]** Did any of you go to William Bird and the Mini Conron talk?

**[0:14:44]** So that talked about some of that a bit as well.

**[0:14:47]** But so this also gives you the ability to append to an immutable list, because if you have a reference to the end of it and it's not bound yet, you can just say, well, I have one, two, and a hole, and I want to bind that hole to be three in a hole, and then you have one, two, three, and a hole in a linked list like that.

**[0:15:07]** And you can fully reason about this as if it had always been that way, you just didn't know because you hadn't looked at it yet.

**[0:15:13]** It's kind of a Schrodinger's cat paradox sort of thing, if that helps.

**[0:15:18]** And so in Prolog, this looks like one, two, and then a tail of B.

**[0:15:24]** This is analogous to like a const in Lisp.

**[0:15:28]** A is one, two, and then a tail of B, and B is three and a tail of C, and then A is one, two, three, and then a tail of C.

**[0:15:38]** And then it says yes.

**[0:15:41]** So effectively, it's still immutable in terms of all of those nice guarantees that a lot of functional languages tend to have.

**[0:15:47]** It's just kind of unstuck in time.

**[0:15:49]** You don't need to have all of the information up front when you're constructing the list.

**[0:15:55]** It's also, you can do that a lot with lazy evaluation, but I think as an abstraction, it's maybe a little bit more fundamental.

**[0:16:03]** You can also build that out of streams, and it's a bit closer to futures of Thomas's, but it's, I think, the very, very core abstraction of that idea.

**[0:16:13]** Starting to lose my voice already.

**[0:16:22]** And also, you can apply it to more than just lists.

**[0:16:26]** Whether this would be necessarily useful merits some exploration.

**[0:16:29]** I've seen a couple interesting uses for difference dictionaries where it has a bunch of empty slots in it and you, the act of either looking in it to see if something is bound there, that can also actually bind it there.

**[0:16:47]** But in general, you can have a data structure that is effectively immutable, yet you can keep plugging things into it after the fact as more information becomes available.

**[0:16:56]** So okay, rolling along.

**[0:16:59]** The next one is, ooh, I'm going really fast.

**[0:17:04]** The next one is called a rolling hash, which is a really good way of finding matching or overlapping sequences in just a big buffer of raw binary data.

**[0:17:15]** So say you had like a genome or a very, very large binary file of that sort, and you wanted to look for chunks of it that were repeated, or you had multiple versions of the file and you wanted to find where those are duplicated.

**[0:17:31]** There's a lot of things that you could apply to that, and bioinformatics in particular has a lot of tricks, but I want to focus on rolling hashes in particular.

**[0:17:39]** And you might think that you could break it up into a bunch of blocks and just kind of hash everything against everything, especially though, since you'd have to look for things that are overlapping and shifted around a little bit and so on, then using typical hashing algorithms ends up being way too slow.

**[0:17:54]** So that's really a non-starter.

**[0:17:57]** But a rolling hash is something that you can point, you can fill a little window in it and then slide that over the whole thing and get successive hashes at each step.

**[0:18:07]** So it ends up looking kind of like this.

**[0:18:10]** Where I have the quick brown fox, and at each stage, it has a hash for that.

**[0:18:15]** Those are just hashes.

**[0:18:18]** And then it drops one letter off the beginning and then picks up one more and just goes tick-tick-tick over it.

**[0:18:26]** But that could be used for any raw binary data.

**[0:18:31]** And at one point, I tried fitting the actual formula for doing this on this slide.

**[0:18:38]** It would not realistically be readable, so I'm just going to include a citation later on for where to find a good example of that.

**[0:18:46]** But so it fills up a buffer and then it drops one and then takes another and then it has a new hash and you just keep rolling it over the rest of the data buffer and what you want to do with those hashes is your own call.

**[0:18:59]** But one very good use for this is rsync.

**[0:19:02]** Any of you have used that?

**[0:19:05]** Okay, cool, cool.

**[0:19:07]** That is used, that was created by Andrew Tregel, who is a CS researcher in Australia who is also working on Samba and the Linux kernel and a lot of open source stuff.

**[0:19:19]** And I suspect because Australia and New Zealand have really disproportionately contributed to data compression and trying to copy things across terrible internet connections and that sort of stuff that it speaks volumes about the quality of the internet access that they've had there.

**[0:19:37]** But that's really a great case of making a virtue out of a hardship.

**[0:19:41]** They also have a really good book called Managing Gigabytes, which is about all kinds of data compression, if that interests you.

**[0:19:46]** It's just very theoretically cool in the same way that cryptography or something is, whether or not you might ever have a cause to implement that sort of thing yourself.

**[0:19:56]** But so what he wanted to do was synchronize changes to a code base across a very, very slow network with a lot of latency and try to minimize the amount of passes back and forth and total bandwidth involved.

**[0:20:10]** And so the way he started off doing that was S and D here will be the source side and the destination side.

**[0:20:18]** So from and to.

**[0:20:20]** And he broke the file into several fixed width pieces.

**[0:20:24]** And then at the end here, there's just a little remainder bit that isn't quite as long as the others because things seldom end up fitting perfectly into fixed width blocks.

**[0:20:35]** And then hash each of those blocks.

**[0:20:38]** And if the block is the same on the opposite end, then it already has it and it doesn't need to send it.

**[0:20:44]** Otherwise it would grab that and then they'd be synchronized.

**[0:20:48]** But the problem with this approach is that if you add anything inside of it and shift things around or delete characters here and there and the length of it changes overall, it completely ruins everything because then all of those blocks now don't break along the same points.

**[0:21:08]** So what he wound up doing was breaking the source file into fixed width blocks and for each of those calculating both a SHA-1 hash and also a rolling hash value for those and sending all of those hashes.

**[0:21:23]** And then on the destination side, if it has some of the file content, then it sets up a rolling hash and steps over it.

**[0:21:31]** And every time the rolling hash matches any of the hashes that are there, then it will do the SHA-1 hash on that.

**[0:21:40]** And that way it can really reduce the amount of superfluous SHA-1 hashing that it needs to do, which is computationally pretty expensive if you have to do it at every single byte offset in the entire file.

**[0:21:50]** And then once it finds the parts of the file that it doesn't already have exactly, then it can just request those parts of it.

**[0:22:01]** So that's a much, much, a very greatly reduced amount of data that needs to be requested there.

**[0:22:11]** And if you want to get implementation details for a rolling hash, then one good place to look is inside his thesis, which is called Efficient Algorithms for Sorting and Synchronization.

**[0:22:22]** It's on page 64, and there's another chapter later in the book that talks about a couple other different formulas that work just as well, but slightly different trade-offs.

**[0:22:30]** But the bulk of it is pretty much on one page there.

**[0:22:33]** Look for a page that has a lot of sigmas on it.

**[0:22:39]** And in sending that way with rsync, he can do the total transfer with three passes.

**[0:22:45]** One to send out the hashes, one to send the hashes that it does not have, and then one to send the actual content.

**[0:22:52]** And probably that can be pipelined to some extent as it goes over different files.

**[0:22:56]** It can also be used for chunking data.

**[0:22:59]** So here, I have a file, and it's broken up into several different pieces, which are not quite the same length.

**[0:23:08]** But if you, say, turn a rolling hash on this file, and then everywhere that the hash is evenly divisible by some constant, say, 64, powers of 2 seem to be pretty convenient, then that's a good breaking point.

**[0:23:24]** And probabilistically, it will have a certain amount of breaks in there, because at each byte, there's about a 1 in 64 chance of it breaking, or whatever constant you choose.

**[0:23:34]** And also, generally, you say that you want to have a minimum block size and a maximum block size in case you have a file that is just all zeros or something like that, so that it'll still break in a pretty predictable manner.

**[0:23:47]** And then if you have multiple versions of a file, you can find duplicated chunks in it that way.

**[0:23:54]** And even if you change part of it in one spot, there's very, very good odds that because there's such a span between the minimum and maximum block sizes, it will tend to fall back in sync pretty quickly.

**[0:24:05]** So that way, if you have several versions of a file, that's very good at finding the content in it that's duplicated and just the couple immediate areas where it has been changed.

**[0:24:15]** And it can do that in a way that is very, very computationally inexpensive.

**[0:24:19]** So a rolling hash finds breaks deterministically, and it can cheaply match blocks across several files.

**[0:24:28]** Oh, that I'm on a mic.

**[0:24:29]** I'm sorry.

**[0:24:32]** Okay.

**[0:24:34]** So next up is a data structure that I invented.

**[0:24:36]** And as far as I know, nobody has done this before.

**[0:24:41]** There's a couple things that are somewhat similar to it, but I have not been able to find an exact match.

**[0:24:47]** And I call it a jump rope.

**[0:24:50]** This builds on some of the existing data structures that I mentioned in this talk.

**[0:24:56]** It's used for storing large binary strings where string can mean file.

**[0:25:01]** It works particularly well for something like a genetic genome that's very, very large.

**[0:25:07]** And it uses what's called content addressable storage, which means that the individual chunks of it, instead of being referenced by pointers by addresses in memory, it's actually referenced by the hash of the content.

**[0:25:19]** So if you have blocks in it that end up having the same content, it can actually just refer to one copy of it, and it automatically will duplicate them.

**[0:25:29]** And it's also a persistent data structure, if you are familiar with those, so that if you have multiple versions of something, most of the content that is the same can just be reused again, and it only, with a very, very small amount of overhead, needs to store extra for the content that has been changed or added or whatever.

**[0:25:49]** And also because it's immutable, it can be freely cached.

**[0:25:52]** And because it has content addressable storage, it can be freely cached anywhere.

**[0:25:57]** It doesn't matter where it's stored, as long as you're able to get the pieces of it.

**[0:26:02]** And because of the rolling hash and the content addressable storage, it also deduplicates all of the content for free.

**[0:26:09]** All in all, actually, it behaves kind of like a Git repo, except a Git repo is much better for lots and lots of small files, whereas a jump rope is much better for larger files, possibly several versions of larger files being changed incrementally.

**[0:26:26]** And it has three structural elements to it.

**[0:26:29]** One of which is a leaf, which is pretty simple.

**[0:26:32]** It's just a chunk of raw data.

**[0:26:34]** That's it.

**[0:26:36]** And then there's a limb, which is a series of content hashes, and then the lengths of the content stored inside of them.

**[0:26:44]** This is all in an array.

**[0:26:49]** And then there's a trunk, which structurally is very similar to a limb, except it also has this other node at the end of it, which has a content hash and a length that is typically much larger because it represents all the rest of the structure.

**[0:27:07]** And then it just needs some sort of p-value store to back that content.

**[0:27:10]** It doesn't matter whether it's being stored in a table in memory, if it's being stored in files on disk, if it's being stored in some sort of distributed hash table or something.

**[0:27:19]** You just need to be able to say, get some hash, and you get a jump rope node back, or set a hash to a value, to a jump rope node, and then get a success or possibly a failure, in which case it means your network is toast or something, and then you have to handle that in the application.

**[0:27:36]** So building it up incrementally, it starts out here, and this is the trunk of the jump rope, and this is a blob of content.

**[0:27:44]** And this would be something that would be coming from a rolling hash, being broken up into pieces that way.

**[0:27:51]** And I'll get into why that is later.

**[0:27:54]** So then you add one more, and then you add one more.

**[0:27:58]** And each time you add one, you check the hash of the most recently added thing to it, and much in the same way that the rolling hash checks whether it is evenly divisible by some, actually it's a remainder or a bit mask or something, but if the value for that masked for that is zero, then that's a break condition, and if it's the trunk, what it does is go up a level.

**[0:28:23]** So it goes from being an array of hashes to an array of arrays of hashes, and then the pieces go in there.

**[0:28:32]** And then every time any of those individual limbs that are not on the trunk have that sort of branching condition where the last hash placed into it is evenly divisible, then that limb is terminated.

**[0:28:46]** And then that whole limb is serialized out to just plain text of the hash space, the length, and a line break, and just flat text for that.

**[0:28:55]** And that is hashed and saved.

**[0:28:58]** And then the hash that's used for that actually becomes the next node inside of the limb that's up one level.

**[0:29:05]** And so that way, all of these individual limbs that are at the lowest depth of the structure have the content, and everything over that is just overhead.

**[0:29:13]** It's scaffolding that holds it together.

**[0:29:16]** And as it gets larger and larger, it ends up looking kind of like this.

**[0:29:21]** So you have an array, and then you have an array of arrays, and then you have an array of arrays of arrays, and so on and so on.

**[0:29:29]** And because you can decide the constant that's used to determine where it should break, you can choose not exactly, but within random bounds, the overall length of each of these on average.

**[0:29:41]** So typically, each one of these might be about 40 long or 64 long or something like that.

**[0:29:52]** And this, it may make sense to think of this as being kind of like a B tree that has been turned on its side.

**[0:30:00]** Or it also has some conceptual similarity to a skip list, but instead of using a random number as the source of entropy to determine where it is that it should go up extra levels and so on, it's instead using the hashes of the content placed in it, so it'll always be deterministic about the overall structure.

**[0:30:20]** And so if you want to seek into it and just get some particular byte range in it, because you know the lengths of all of the individual content, and if you have a limb that is referencing nodes inside of it that also reference other subnodes and subnodes and blah, blah, blah, and it's several levels before it gets down to the individual nodes of the actual content being stored in it, you know they're linked.

**[0:30:44]** It means it can just skim along the entire top of the structure and skip over large parts of it and then descend down into it at the point at which it matters.

**[0:30:53]** And also because each of those are represented as just flat text which is a series of hashes and each one of these blue dots here would be like maybe two kilobytes or so.

**[0:31:05]** Those can be effectively pulled in as one network read and you can start prefetching all of the part of the tree that you care about all in one go.

**[0:31:14]** So this is very very good for pipelining streaming content and that sort of thing.

**[0:31:23]** And so if you wanted to get a particular byte range in here you would say okay d is it less than 34,000?

**[0:31:30]** No.

**[0:31:31]** Okay keep going.

**[0:31:32]** Is it less than 40,000?

**[0:31:33]** No.

**[0:31:33]** Okay, okay, okay.

**[0:31:36]** And then it's if it's somewhere inside of that range there, then it would ascend up one level higher in the structure and just skim along to the point at which the content it's looking for resides.

**[0:31:47]** And also because it's using the rolling hash to set the breaks in a way that will be deter deterministic.

**[0:31:55]** Just a moment.

**[0:32:05]** I'm sure none of you want to hear me coughing very loudly again.

**[0:32:10]** Because it's breaking along deterministic lines and because there's very, very little of this structure that needs to change when the content changes.

**[0:32:22]** It can reuse most of this any time you change the file.

**[0:32:27]** So there's very, very little overhead in having a large file and having several versions of it stored inside.

**[0:32:34]** And with the default settings I have currently, which are pretty arbitrary and will be tweaked a bit more as I get more experience from working with this.

**[0:32:43]** Generally, there's just it's about two kilobytes for each of the overhead nodes and say 64 kilobytes or so for the content nodes.

**[0:32:50]** So there's about a 1 to 32 ratio of the overhead for the data that's stored in it.

**[0:32:56]** So you can fetch content from it in parallel.

**[0:32:59]** You can stream it from one place to another and you can mirror it trivially because all of the content is immutable and it doesn't matter where it is as long as you can get to it.

**[0:33:11]** So my use case for this is a distributed file system I've been working on called Scatterbrain.

**[0:33:16]** It's an archival file system.

**[0:33:19]** And it essentially takes the jump rope and then fans it out over a distributed hash table that's implemented somewhat like Amazon Dynamo.

**[0:33:29]** And I hope to get that out fairly soon.

**[0:33:32]** So all of these properties, there's randomization, which means that the overall structure of it, instead of having to control how all of it fits together, you can just do it randomly with bounds for how it should fill out and then it will tend to fall into expected patterns on average with arbitrarily high guarantees like 1% of the time or 0.1% of the time or 0.01, et cetera, percent of the time it will have bad performance, but you can tune that usually.

**[0:34:04]** There's persistence and immutability, which is good for being able to reuse a lot of the structure or have a reference to several versions of the same structure without having to do a lot of overhead.

**[0:34:16]** And there's the emergence from local behavior where if you put the same content in it, or no, the emergence from local behavior means that there's very, very little collisions if multiple things are working on the same data structure at the same time.

**[0:34:31]** And the lack of pointers means that all of the components of it just can be moved around wherever as long as they're accessible, which is very, very useful as things have to scale out horizontally.

**[0:34:43]** So, okay.

**[0:34:45]** And I'm from Atomic Object, which is hiring.

**[0:34:48]** We're in Grand Rapids, Michigan, and Detroit.

**[0:34:51]** And there's plenty of us here from there.

**[0:34:53]** So if you see anybody in an Atomic Object shirt, chat them up.

**[0:34:57]** And because I used a couple of Creative Commons images in the slides here, there's attributions.

**[0:35:02]** My slides will be on, apparently there's a repository for all of the slides for StrangeLoop.

**[0:35:09]** And I'm on Twitter.

**[0:35:10]** I'm Silent Bicycle, and I have a bunch of projects on GitHub.

**[0:35:14]** And there's a skiplist library there in C that I use quite a bit.

**[0:35:19]** And the rolling hash and some of the other stuff will land there as the distributed file system project is done, which is driving the development of a lot of those.

**[0:35:28]** And so looks like I have plenty of time for questions.

**[0:35:33]** You don't know the length of all of the content that will be in the jump rope overall necessarily.

**[0:35:38]** It's assumed that it's just streaming in piece by piece.

**[0:35:42]** And if you only ever need to have, say, 10 nodes in it or something, then it can keep it fairly short.

**[0:35:47]** But if in the end you're going to need thousands of nodes, then it will gradually grow up higher to be able to fan out wider for that.

**[0:35:55]** But that's something that's actually decided just based on the structure and the amount of data passing in as it goes.

**[0:36:01]** And then as soon as it reaches the end of the file, then it just pops all the different levels, ties it up, and then you have a hash for the head of it, which is then useful as a unique identifier for the entire structure.

**[0:36:13]** Yeah, SHA-1 hashes.

**[0:36:16]** That's pretty arbitrary.

**[0:36:17]** There's absolutely no reason why you couldn't use SHA-256 or MD5 or what have you.

**[0:36:23]** I'm using that because Git is using that.

**[0:36:27]** And I think most people are not terribly worried about Git repositories having hash collisions either.

**[0:36:33]** I think there's some line in Scott Chacon's book about the likelihood of a Git collision is about on par with your entire development team dying due to attacks by wolves, separate attacks or something like that.

**[0:36:47]** It seems well into the range at which you realistically don't have to worry about it.

**[0:36:52]** His question was that since it's a persistent data structure, wouldn't it be less work to do several inserts all at once in the way that Clojure does, I forget what they call that.

**[0:37:04]** Actually, it isn't ever changing the existing structure.

**[0:37:08]** What it's doing is building up the same file again with slightly different content.

**[0:37:12]** And because all of the individual components of it are structured based on the hash of the content, first locally, then surrounding, combining all of that local data, then fanning out and combining all of that local data and so on, all of the pieces that are identical will actually coalesce together to the existing stuff.

**[0:37:31]** Oh, oh yes, that's CAS is content addressable storage, which means that where stuff is located is actually determined by its hash, rather than, this is probably an overly specific definition.

**[0:37:45]** But it means that instead of a memory address saying where it is, its location is actually specified by its content.

**[0:37:54]** My current implementation of it is in a mix of C and Lua, because that's what I'm using for my distributed file system, in part because I'm very comfortable with both of those, and in part because I think that's probably the easiest thing to have be very, very portable across a lot of operating systems.

**[0:38:09]** I have an implementation, a very, very quick and dirty implementation of it in Erlang also.

**[0:38:14]** And both of those have a lot of tests, and I'm pretty confident that they work.

**[0:38:18]** I'm working on the network logic now for the node-denode communication layer for the file system, and I hope to wrap that up fairly soon.

**[0:38:28]** And that will all be on GitHub and probably BSV licensed.

**[0:38:31]** I haven't fully decided on that, but that's my most likely choice.

**[0:38:37]** Okay, any other questions?

**[0:38:45]** Okay, I guess that's it.
