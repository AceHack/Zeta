using System.Collections.Generic;

namespace Zeta.Core.CSharp.Linq;

// ══════════════════════════════════════════════════════════════════════
//  The LINQ front end — the OTHER front end over the SAME plan.
//
//  STATUS: toy (`.claude/rules/toy-is-free-metered-must-be-earned.md`).
//  EXPERIMENTAL: every public type in this folder is a prototype surface,
//  not a contract. See
//  docs/research/2026-08-25-query-surfaces-computational-expression-and-linq-over-one-plan.md
//
//  ── Why BOTH IQueryable and IQbservable ──────────────────────────────
//  Erik Meijer's duality square, completed:
//
//                    | pull            | push
//    ----------------+-----------------+-------------------
//    in-memory       | IEnumerable<T>  | IObservable<T>
//    expression tree | IQueryable<T>   | IQbservable<T>
//
//  IQueryable is IEnumerable + expression trees — the query is *shipped*
//  somewhere to run rather than executed in place. IQbservable is that
//  same move applied to IObservable: expression trees over PUSH streams.
//  It is literally the type for "the same query, executed as a standing
//  subscription".
//
//  Anchors (Beacon):
//   • Meijer, "Subject/Observer is Dual to Iterator" (FIT / PLDI 2010) —
//     the duality that makes IObservable the dual of IEnumerable.
//   • Meijer, "Your Mouse is a Database" (ACM Queue 2012) — events as
//     rows; the framing the maintainer asked for by name.
//   • De Smet / the Reaqtor project — the worked engineering of the
//     fourth corner, and the Bonsai serialized-expression-tree model
//     that Zeta already ports in `src/Core/Bonsai.fs`.
//     See docs/PRIOR-ART-LIST.md.
//   • Barga, Goldstein, Ali, Hong, "Consistent Streaming Through Time"
//     (CIDR 2007) — CEDR, which shipped as SQL Server StreamInsight:
//     LINQ over temporal streams. The direct ancestor of this idea, and
//     the reason "SQL Server CEP" and "LINQ over streams" are one
//     lineage rather than two.
//   • Chandramouli et al., "Trill" (PVLDB 2014) — columnar and batched
//     INTERNALLY behind a streaming query surface; the existence proof
//     that vectorized execution and SQL-over-streams compose.
//
//  ── The load-bearing observation ─────────────────────────────────────
//  ONE translator reads both corners. `System.Linq.Queryable.Where` and
//  `QbservableOperators.Where` build structurally IDENTICAL
//  MethodCallExpressions — same name, same arity, same lambda shapes —
//  differing only in the declaring type. So PlanTranslator matches on
//  method NAME and ARITY, never on declaring type, and the pull and push
//  corners collapse onto one code path. That collapse is the duality
//  made mechanical rather than asserted.
//
//  Honest note on Rx: System.Reactive.Linq.Qbservable HAS a Join, but it
//  is Rx's DURATION-based join (left/right window selectors), not the
//  relational key-based join of the LINQ query pattern. The relational
//  join is not in Rx's vocabulary, so QbservableOperators supplies
//  query-pattern Where/Select/Join for the push corner. The
//  IQbservable<T> type and IQbservableProvider are Rx's own.
// ══════════════════════════════════════════════════════════════════════

/// <summary>
/// A query root that knows which named relation it stands for. Implemented
/// by both the pull and the push root, so <c>PlanTranslator</c> needs no
/// idea which corner of the duality square it is reading. EXPERIMENTAL.
/// </summary>
public interface IZetaSourceNode
{
    /// <summary>
    /// The relation name — what columns are qualified by in the plan.
    /// </summary>
    public string RelationName { get; }

    /// <summary>
    /// Declared column names. Echoed into the plan's canonical form.
    /// </summary>
    public IReadOnlyList<string> Columns { get; }
}
