---
name: speech-to-text
description: Transcribe audio or video to text locally and free — talks, podcasts, meetings, voice notes. Picks the open ASR model by content type.
---

# speech-to-text

Local, free, no API key, no upload. Runs on the operator's machine so the audio never
leaves it — which is the point when the material is a private recording, a call, or an
unreleased talk.

## Carved sentence

> Transcribe locally with an open model, **pick the model by content type** (technical
> content needs proper-noun accuracy, not raw WER), and **report what the model could not
> hear** — a transcript that silently guesses a name is worse than one that marks it
> uncertain.

## Which model — measured, not assumed

Benchmarked 2026-08-01 on a 39-minute conference talk (Scott Vokes, Strange Loop 2012),
Apple M-series, both models local and free:

| | whisper-large-v3-turbo | **parakeet-tdt-0.6b-v2** |
|---|---|---|
| wall clock | **61 s** | 114 s |
| characters | 34,710 | 35,055 |
| segments | 1,583 (fine) | 312 (sentence) |
| **"Prolog" correct** | **0 / 9** — wrote "Prologue" every time | **8 / 9** |

**Whisper was faster; parakeet was more correct on domain vocabulary.** For a technical
talk that is the whole game — a transcript that says "Prologue" nine times is not a
transcript of a talk about Prolog. The Open ASR Leaderboard ranks on average WER and
reports parakeet as *faster*; on this machine and this file the speed ranking inverted.
**Benchmark on your own audio; leaderboard RTFx is batched throughput on other hardware.**

Defaults:

- **Technical / proper-noun-dense** (conference talks, papers read aloud, code review) →
  `mlx-community/parakeet-tdt-0.6b-v2`. English only.
- **Multilingual, or you need word-level timestamps** →
  `mlx-community/whisper-large-v3-turbo`.
- **Not Apple Silicon** → `faster-whisper` (CTranslate2) or NVIDIA NeMo for parakeet.

Check `https://huggingface.co/api/models?pipeline_tag=automatic-speech-recognition&sort=downloads`
before assuming these are still the best — the field moves, and adoption is a usable
proxy when the leaderboard Space will not render (it is a JS app; `WebFetch` cannot read it).

## Setup (once, in a scratch venv — do not touch system python)

```bash
SP=<scratchpad>            # session scratchpad, not the repo
python3 -m venv "$SP/wenv"
"$SP/wenv/bin/pip" install -q parakeet-mlx mlx-whisper
```

`ffmpeg` must be present (it is, via homebrew) — both packages shell out to it for
decoding. Any format ffmpeg reads works: mp3, m4a, wav, mp4, mkv.

## Run

```python
# parakeet — technical content
from parakeet_mlx import from_pretrained
m = from_pretrained("mlx-community/parakeet-tdt-0.6b-v2")
r = m.transcribe("talk.mp3")
r.text                                     # full transcript
[(s.start, s.end, s.text) for s in r.sentences]
```

```python
# whisper — multilingual / fine timestamps
import mlx_whisper
r = mlx_whisper.transcribe("talk.mp3",
        path_or_hf_repo="mlx-community/whisper-large-v3-turbo")
r["text"]; r["segments"]
```

Long files: both stream internally; a 39-minute file needs no chunking. Past ~2 h, split
on silence with ffmpeg first so a crash does not lose the whole run.

## Report what could not be heard

The failure mode is a fluent transcript that is confidently wrong. Guards:

1. **Run both models when the content is load-bearing.** Where they disagree is where the
   audio is ambiguous — that is a free uncertainty signal, and it is how the Prolog error
   above was caught. Same decorrelation discipline as everywhere else in this repo.
2. **Grep for the domain terms you expect.** If a talk is about rsync and "rsync" never
   appears, the model missed it — do not discover this after quoting the transcript.
3. **Count both spellings.** A term-frequency check that greps `prolog` will match
   `prologue` and score a wrong transcript as correct. That exact bug happened during this
   benchmark and inverted the result until corrected.
4. **Never present a transcript as verbatim without saying which model produced it.**
   Attribute it — `parakeet-tdt-0.6b-v2, 2026-08-01` — so a later reader can re-run.
5. **Slide text is not spoken text.** "Gordon Bell" and "Tridgell" appear on the Vokes
   slides and in **neither** transcript, because he never said them. A transcript is not a
   capture of the talk; pair it with the deck when both exist.

## Ferrying convention

Third-party talks go to `docs/research/ip-questionable/` with a
`…-verbatim-transcript-aaron-forwarded.md` suffix, per the standing rule that forwarded
material is preserved rather than curated. State the capture basis in the header (which
model, which pages, transcript vs slides) so nobody mistakes a paraphrase for a quote.

## Pointers

- `docs/research/ip-questionable/2026-08-01-scott-vokes-…-aaron-forwarded.md` — the ferry
  this skill was built during; slide capture, with this transcript as the spoken half
- `.claude/rules/always-preserve-ferries…` (memory) — forwarded material is others' memory
- `AlephZ-ai/blazor-samples` — Aaron's C# ASR stack. `ISpeechRecognizer.RecognizeAsync :
  IAsyncEnumerable<ReadOnlyMemory<byte>> -> IAsyncEnumerable<SpeechRecognitionResult>` is
  a Kleisli arrow, so recognizer and `IAudioConverter` compose by plain function
  composition. It is **one-directional** — no back-channel, so nothing can interrupt
  mid-stream, which is why barge-in is the hard part.
- **The duplex half is already built here**, and ASR is simply not wired into it yet:
  `src/Core.TypeScript/model-backend/four-corner.ts` (the shape — chat-completions is the
  projection where both feedback sinks are no-ops), `duplex-transport.ts`
  (`fourCornerOverDuplex`), and `multiplexed-duplex-transport.ts` (N channels over one
  socket, ZetaId-keyed, per-channel interrupt). Wiring speech in means giving the
  recognizer a `feedback-in` corner (VAD: "the user started talking" → interrupt the
  running generation) and a `feedback-out` corner (backpressure when the model outruns
  TTS). `src/Core/DebouncedOracle.fs` is the echolocation debounce with enforced `L > 0`
  — the guard that stops a loud speaker from blocking a quiet one.
