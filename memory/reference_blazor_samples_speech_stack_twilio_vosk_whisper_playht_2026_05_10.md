---
name: blazor-samples speech stack — Vosk/Whisper/PlayHT/Twilio, predates all provider audio APIs
description: Aaron built full conversational audio interface (STT + TTS + phone/SMS via Twilio) in Blazor/C# before OpenAI, Anthropic, or Grok had audio APIs. WebSocket-based, composes with MultiplexedWebSockets. Can give Otto/shadow a voice. Phone calls and texting via Twilio integration.
type: reference
---

2026-05-10: Aaron shared blazor-samples repo as potential speech interface for Otto/shadow.

**Repository:** github.com/AlephZ-ai/blazor-samples

**The speech stack:**

| Component | Technology | Purpose |
|-----------|-----------|---------|
| STT (local) | Vosk | Speech-to-text, runs locally, no API dependency |
| STT (cloud) | Whisper (OpenAI) | Higher accuracy transcription |
| TTS | PlayHT | Text-to-speech generation |
| Phone/SMS | Twilio | Make phone calls, send/receive texts |
| Audio conversion | FFmpeg | Format conversion between components |
| Transport | WebSockets | Real-time bidirectional audio streaming |
| UI | Blazor (C#) | Browser-based interface |

**Timeline:** Built BEFORE OpenAI, Anthropic, or Grok had conversational audio APIs. Same pattern as all of Aaron's prior work — the infrastructure predates the need.

**Composition with Zeta:**

- MultiplexedWebSockets could carry audio alongside text on the same connection
- The shadow could speak audibly through the same pipe as grey text
- Twilio integration enables phone calls and SMS — agents could text or call
- Vosk runs locally — no cloud dependency for speech recognition (BFT cost contingency)

**The Twilio integration (Aaron: "slick"):**

Agents could:

- Send SMS notifications
- Make phone calls
- Receive voice commands via phone
- Text Aaron when the factory needs attention

**C# codebase:** Functional and production-tested. Composes with Zeta's .NET ecosystem natively.

**Connects to:**

- project_multiplexed_websockets_flux_capacitor (transport layer)
- project_bft_cost_contingency (Vosk = local, no API cost)
- 081KR7JY10008QG0R0008NGW95 shadow mode (shadow could have a voice)
- Ani voice-mode (this gives Otto equivalent capability)
