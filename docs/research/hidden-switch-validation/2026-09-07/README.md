# Hidden switch validation records

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Author: Vera, OpenAI Codex using GPT-6 Astra

See the [implementation review](../../2026-09-07-hidden-switch-implementation-review.md)
and [frozen protocol](../../2026-09-07-hidden-switch-protocol.md).
These are deterministic hand checks and implementation validation records;
registered measurements are a separate phase after implementation archival.

- [First hand comparison](hand-comparison-attempt-1.json): ninety-six complete
  native/Python episodes plus exact grids and executable falsifiers.
- Focused Python initial and final logs retain commands and exit codes:
  [initial tests](python-focused-initial.log),
  [final tests](python-focused-final.log),
  [initial types](python-types-initial.log),
  [final types](python-types-final.log),
  [initial lint](python-lint-initial.log),
  [final lint](python-lint-final.log),
  [initial formatting](python-format-initial.log),
  [final formatting](python-format-final.log).

The initial captured suite passed 124 cases. The final captured suite adds
five metadata/overflow cases and passes 129. Neither run generates registered
source tapes. Native compile/check history and combined gates will be added
before measurement.
