/-
Copyright (c) 2026 Anthropic, PBC. All rights reserved.
Released under Apache 2.0 license as described in the file LICENSE.
SPDX-License-Identifier: Apache-2.0
-/
/-
MODIFIED FROM UPSTREAM — Apache-2.0 §4(b) notice.

Upstream:  https://github.com/anthropics/zeta-23-lean, file `Zeta23/LinAlg.lean`,
           Copyright (c) 2026 Anthropic, PBC, Apache-2.0.
           Licence + attributions travel with the port: `src/Core.Lean4/Zeta23/LICENSE`,
           `src/Core.Lean4/Zeta23/NOTICE`, `src/Core.Lean4/Zeta23/NOTICE.upstream`.
Ported:    2026-08-22 into Lucent-Financial-Group/Zeta, work-item
           081M0N9SSJ1087G0R001WVSN9V. Retargeted from Lean `v4.33.0-rc2` + Mathlib
           `51e6992efd06126df61a496bebf8f49482a4e129` to Lean `v4.30.0-rc1` + Mathlib
           `v4.30.0-rc1`.
Changes:   THIS NOTICE BLOCK ONLY. Every Lean token below is byte-identical to upstream.
           The retarget required no proof edits — measured, not assumed: `lake build`
           was green at our pin on the first attempt, so nothing was re-proved.
           (`lake build` does emit `linter.style.longLine` warnings on the upstream
           provenance comment below; left as-is rather than reflowed, so the diff
           against upstream stays empty outside this block.)
Register:  ADAPTED PORT. **Not an independent replication — the upstream Lean source
           was read.** See `docs/research/verification-registry.md`.
-/
import Zeta23.LinAlg.HermitianPosPart
import Zeta23.LinAlg.Inertia
import Zeta23.LinAlg.PosIndex
import Zeta23.LinAlg.RankTrace
import Zeta23.LinAlg.Sylvester
import Zeta23.LinAlg.VonNeumann
import Zeta23.LinAlg.Weyl
