---
title: "Intel SMM and SEAM — two hidden CPU operating modes (transcripts)"
date: 2026-08-14
source: Aaron-forwarded transcripts, 2026-08-14 — "you can save this to ip questionable if you want"
author_of_content: uncredited YouTube channel; the transcripts name no author. Zeta claims NO authorship and asserts NO license.
youtube_urls:
  - https://www.youtube.com/watch?v=sAw67SdBx4M   # SEAM — Secure Arbitration Mode
  - https://www.youtube.com/watch?v=2b763mBbDxY   # SMM — System Management Mode
provenance: forwarded verbatim by Aaron via Claude Code conversation; stored per docs/ip-questionable/README.md (notice-and-takedown, Aaron 2026-06-15).
status: VERBATIM as supplied. DO NOT republish externally.
analysis_lives_in: docs/research/2026-08-14-confidential-computing-on-consumer-hardware-tdx-sev-snp-and-the-honest-tier-split.md
accuracy_note: >
  The transcripts contain factual errors and a sensationalised frame. They are preserved
  AS SUPPLIED because a ferry is others' memory, not curated. Corrections live in the
  analysis doc, not here. Two to know before reading: SMM is System Management Mode, not
  "Service Management Mode"; and SEAM is the publicly documented foundation of Intel TDX,
  not an undocumented backdoor.
---

# Intel SMM and SEAM — VERBATIM (Aaron-forwarded)

> **IP note.** Third-party transcripts. Copyright is held by the video author/channel.
> Preserved for research and study with attribution, against link-rot; **do not republish
> externally.** Removal on good-faith request is a single-file delete — the analysis links
> here and does not depend on this file remaining present.

---

## A. SEAM — Secure Arbitration Mode (`sAw67SdBx4M`)

Do the NSA run a secret virtual machine on your computer next to your OS? Today we're going to
dive into another hidden operating mode of intel CPU's: Secure Arbitration Mode.

So today we're going to talk about something i found in this manual, the intel 64 / IA32
architectures, blah, blah, blah. Volume 3C and especially this chapter... "SEAM" - Secure
Arbitration Mode.

And you have probably heard about a SMM which I made a video about the other day. And you have
probably heard about Intel IME, which is a small computer living inside of your computer. But have
you heard about SEAM? Which is the most scary of them all?

So SEAM is a special hidden operating mode inside of the Intel CPU. And what it does is it mimics
another technology which is called VTx, Intel Virtualization Technology Extensions. It's also
called VMX. That is how you run a hardware based virtual machine on Intel CPUs. And SEAM is based
off of this technology, but has some important very odd differences.

So what it does is it's creating a hypervisor ... so it's called SEAM root operations. And this
hypervisor, which is totally transparent to the underlying virtual machines that it runs. And you
cannot even detect that SEAM is activated. And the only thing that can activate SEAM is your Bios.

So your Bios boot sequence can activate SEAM, and then it will create a virtual machine. And inside
of here, it will put your entire operating system and it will assign a piece of the hardware memory
addresses to this virtual machine where your OS is running. It looks like this is the whole memory
space, so you can't detect that it's only a part of that memory.

And it also runs another virtual machine somewhere in parallel with your OS. And this is called the
SEAM guest. And this is a piece of software which runs next to your operating system all of the
time. And you can't even see that it exists. And it can do pretty much what it wants.

But what the hypervisor does is it creates a memory space for that virtual machine as well. But
this memory space is very different. It is called the "SEAM range". So it's a range of hardware
memory addresses in RAM, which is allocated to this special virtual machine. And the interesting
thing with this memory range is that it is encrypted. And it's not encrypted in software. It's
encrypted in hardware. So your CPU... each time this virtual machine tries to read or write or
execute code in this memory range, your CPU automatically will decrypt and encrypt this memory.

So if you were to look at this memory space from, let's say, a special bootloader or something, you
would only see encrypted gibberish. And the encryption key ... it is stored inside of the SEAM
hypervisor, the SEAM root operation. And you cannot read these memory addresses... if you try to
access this, it will cause a general protection exception inside of the CPU. And if you somehow
bypasses that, let's say you modify some MSB in the boot sequence or you poison the cache somehow,
then if you try to read from this and actually execute the read instruction, it's going to fail
silently. So it will go through, and not produce an error, but it will only give you one bits as
output. And if you try to write to this location, it will not fail either, but it will not change
anything. So it will silently fail.

So why does this mode exist? Well, it's kind of hard to tell because to me, it looks like it is
specially crafted to run some nasty backdoor code Trojan inside of here. But that part, I don't
know. But the rest of this, everything that I have told you is inside of this manual right here.

So it talks about the SEAM root operation as the hypervisor. And it in turn has two different
modes. There's a loader mode that only one processor can be in at any time. So that's basically
like the kernel, so to speak. And then there are a couple of modules inside of the hypervisor and
this SEAM guest can call into this hypervisor and ask it to do things like make a report of other
virtual machines running on the system, like this Windows right here. Or it can ask for other
stuff.

And it says here certain platform operations may be required to enable SEAM. So it doesn't say how
it's enabled, only that certain platform operations is required. And until they are performed, seam
MAY be globally disabled. That's also an interesting choosing of words because Intel is very
specific with what kind of words they choose and: MAY be globally disabled. So that sounds to me
that like it might also always be enabled no matter what you do.

And there's this SEAMCALL CPU instruction, which it can use to call into this module. And there is
also something called SEAMOPS, which is another special instruction that it uses when it wants to
call into the kernel mode here. And here is this multi key total memory encryption, the TME-MK.
That is what's encrypting the memory by the cpu.

And software cannot... in Seam cannot leave the virtualized environment. And this is also
interesting because I talked about SMIs in my other video which is a special type of interrupt
which starts the Smm mode. And: ...entry to Seam root operation blocks SMIs. So system management
interrupts are masked in seam root operation. So the first thing that hypervisor does when it
starts up is it blocks all entries to smm. So you cannot go in that way, so to speak.

And here is what I said before: ...outside seam root operation access to the physical addresses in
the seam range... are aborted, meaning that writes are ignored and reads return values with all
bits set to one.

And it says that the encryption key is machine specific, and it's typically an ephemeral key.
That's a temporary key which is generated each time the platform is restarted. But it's Typically
an ephemeral key... that says to me that every machine has its own key and someone has that key,
right?

Execution invokes seam specific operation. It is used by seam modules to execute such operation.
That's the only thing it says about it.

## B. SMM — System Management Mode (`2b763mBbDxY`)

What is the highest level of permissions that you can have on a PC computer? Is it the root or
admin user? Is it a device driver running in kernel mode? Is it perhaps the vt-x root operation or
an mbr bootloader running in real mode? Or perhaps is it the BIOS? No, no, no, no. And no. One
thing has much more permissions than any of these. It is the most terrifying three letter acronym
in the English alphabet. SMM.

...breaking into your computer. Backdooring your computer. Remote-controlling your computer,
without you knowing about it, recovering all your passwords, listening to all your encrypted
network traffic, accessing your mounted crypto disks, or even breaking out of a virtual machine.

Did you know that all Intel CPUs from the 386 and onwards has a special operating mode? SMM. It is
pretty unknown. It is triggered by sending a special kind of interrupt signal to the CPU, either by
physically sending an electric signal to one of its pins or by triggering it through the PIC, the
interrupt controller. This can be done, for instance, by the chip-set listening to the computer bus
and triggering the interrupt signal if it detects some kind of network packet or some file on the
hard disk drive, etc.

When it is activated, it puts the entire operating system into a bubble or a cage, completely
pausing everything for a specified number of microseconds or milliseconds. During that time it runs
a specific program machine code and that code has access to everything. Everything. The whole
operating system, all memory and disk, even mounted encrypted disks. It has also access to all
hardware, including the network card. This means that it can send things through the internet
completely hidden. Even if you are running Wireshark at the time, it will not catch it.

It will also have access to any virtual machines that are running and it can even be triggered
through a virtual machine and breaking out of that virtual machine. When the program has run its
course, everything is resumed. The whole program only takes a fraction of a second. So your mouse
pointer will not even lag. It will not be detectable in any way.

It makes use of the memory address range 0x38 000. But it's a bit sneaky because if you were to
access that memory range normally, through your operating system or even through your own operating
system or a bootloader that you've coded, it's going to be redirected to the RAM as usual. But if
your computer is in SMM and you are trying to read or write to that location, it will redirect to
another RAM chip dedicated to SMM. It is called SMRAM, Service Management Ram. Its own little chip
on the motherboard. This is where the machine code instructions are located.

This all sounds like this was invented just for backdooring computers or breaking out of virtual
machines. And perhaps you are right. The purpose of SMM is very loosely defined. The manual says
something like "It can be used for powering down hardware devices or running OEM specific code."
Very weird. And what is OEM specific code? That's basically any system level code for anything for
any purpose.

And why is the SMM hidden in the manual? Because the manual itself is about the VT-X. That is the
hardware extensions in Intel processors for running virtual machines. About half, a little more
than half of the manual is about the VT-X and virtual machines, but it's also about SMM, and it's
not much of a correlation them between.

And before it enters SMM, it saves a copy of all the CPU registers and all running virtual machines
to SMRAM so it can put everything back, as it were, after the secret code has run.
