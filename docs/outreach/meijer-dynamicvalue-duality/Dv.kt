/*
 * DynamicValue — a typed, homoiconic value tree where "what remains" (data) and
 * "what acts" (behaviour) are duals that contain each other.
 *
 * Minimal, self-contained reference (paste into any Kotlin playground). This is the *core
 * idea* only — the production system (F#/C#/Rust/TS) adds canonical serialization, golden
 * vectors, round-trip/injectivity proofs, and 4-language byte-locking on top of this shape.
 * Here we show just the elegant bone: μF (data) ⇄ νF (behaviour), self-representable.
 *
 * Lineage (named honestly): NOT Lisp — a *typed* descendant. The homoiconicity is Lisp's
 * (McCarthy); the duality is yours, Erik — observer/iterator, coSQL/SQL, μF/νF. The proper
 * algebraic home is a Cartesian closed category (Lambek; Elliott, "Compiling to Categories"),
 * and the probabilistic successor (below) sits near Church (Goodman et al.).
 */

// ── "what remains": the data poles (μF). A self-describing canonical value tree. ──
sealed interface Dv {
    data object Null : Dv
    data class B(val value: Boolean) : Dv
    data class I(val value: Long) : Dv
    data class F(val value: Double) : Dv
    data class S(val value: String) : Dv
    data class Arr(val items: List<Dv>) : Dv
    data class Obj(val fields: List<Pair<String, Dv>>) : Dv   // order-significant

    // ── "what acts": a behaviour AST embedded as a PEER node type (νF). ──
    // Code is just another shape of value living in the same tree (homoiconic).
    data class Expr(val node: Node) : Dv
}

// The behaviour algebra. Note Const/Quote: a Node *contains* a Dv — so code holds data,
// while Dv.Expr means data holds code. Each side contains the other: that is the duality,
// and the sealed-class tag is the discriminator — the little dot in each half of the yin-yang.
sealed interface Node {
    data class Const(val value: Dv) : Node            // data inside code
    data class Param(val name: String) : Node
    data class Call(val fn: String, val args: List<Node>) : Node
    data class Quote(val value: Dv) : Node            // lift ANY value into the AST (data → code)
}

// ── The two halves of the duality, as functions. ──

/** Lower / apply (νF → μF): execute behaviour into a value. Data is already lowered. */
fun run(d: Dv, env: Map<String, Dv> = emptyMap()): Dv =
    when (d) {
        is Dv.Expr -> eval(d.node, env)
        else -> d                                     // pure data evaluates to itself
    }

/** Lift / reify (μF → νF): turn any value into the behaviour that reproduces it. */
fun quote(d: Dv): Dv = Dv.Expr(Node.Quote(d))

fun eval(node: Node, env: Map<String, Dv>): Dv =
    when (node) {
        is Node.Const -> node.value
        is Node.Quote -> node.value
        is Node.Param -> env[node.name] ?: Dv.Null
        is Node.Call -> apply(node.fn, node.args.map { eval(it, env) })
    }

// a tiny builtin set, just to show the tree really executes
fun apply(fn: String, args: List<Dv>): Dv =
    when (fn) {
        "add" -> Dv.I(args.filterIsInstance<Dv.I>().sumOf { it.value })
        "concat" -> Dv.S(args.filterIsInstance<Dv.S>().joinToString("") { it.value })
        else -> Dv.Null
    }

fun main() {
    // code-in-data: a full behaviour tree living as a node in the value tree
    val program: Dv = Dv.Expr(
        Node.Call("add", listOf(Node.Const(Dv.I(2)), Node.Param("x")))
    )
    println(run(program, mapOf("x" to Dv.I(40))))     // I(value=42)

    // data-in-code, and the SELF-REPRESENTABLE law: run(quote(d)) == d for ALL d.
    val data: Dv = Dv.Obj(listOf("id" to Dv.I(7), "tags" to Dv.Arr(listOf(Dv.S("a"), Dv.S("b")))))
    check(run(quote(data)) == data)                   // the reflection fixpoint: μF ⇄ νF
    println("self-representable duality holds: run(quote(d)) == d")

    // mutual containment in one value: data holding code holding data.
    val nested: Dv = Dv.Obj(listOf("answer" to program, "raw" to data))
    println(run((nested as Dv.Obj).fields.first { it.first == "answer" }.second, mapOf("x" to Dv.I(40))))
}

/*
 * The probabilistic successor (the frontier, not shown in code here):
 * the sharp constructor tag (Null|B|I|...|Expr) becomes a *distribution* over tags that
 * sharpens with context — "soft" DynamicValue. The safety property is not "always certain"
 * but "always knows its uncertainty" (calibration; never falsely certain) — the value-axis
 * generalization of a three-valued (Kleene) logic where the middle value is never collapsed.
 * Nearest prior art: Church (probabilistic Lisp). That layer is research; this file is the
 * proven core's shape.
 */
