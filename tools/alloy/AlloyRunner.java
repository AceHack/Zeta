// Tiny headless Alloy driver — parses a `.als` file, runs EVERY
// `run` / `check` command in it, prints one line per command:
//
//     OK   <name>     (no counterexample / instance found as expected)
//     FAIL <name>  <reason>
//
// Exits 0 iff every command came out OK. Used by the F# test harness
// in `tests/Dbsp.Tests.FSharp/Formal/Alloy.Runner.Tests.fs`, which
// compiles this file via `javac` and then runs it against the
// alloy.jar shipped in `tools/alloy/alloy.jar`.
//
// Usage:
//     javac -cp alloy.jar AlloyRunner.java
//     java  -cp alloy.jar:. AlloyRunner path/to/Spec.als
//
// The binary SAT solver bundled with the Alloy jar is SAT4J (pure
// Java), so no native library setup is required.

import edu.mit.csail.sdg.alloy4.A4Reporter;
import edu.mit.csail.sdg.ast.Command;
import edu.mit.csail.sdg.ast.Module;
import edu.mit.csail.sdg.parser.CompUtil;
import edu.mit.csail.sdg.translator.A4Options;
import edu.mit.csail.sdg.translator.A4Solution;
import edu.mit.csail.sdg.translator.TranslateAlloyToKodkod;

public final class AlloyRunner {

    public static void main(String[] args) throws Exception {
        if (args.length < 1) {
            System.err.println("usage: AlloyRunner <path/to/Spec.als>");
            System.exit(2);
        }
        String path = args[0];
        A4Reporter rep = new A4Reporter();
        Module world = CompUtil.parseEverything_fromFile(rep, null, path);
        A4Options opts = new A4Options();
        opts.solver = A4Options.SatSolver.SAT4J;
        int failures = 0;
        for (Command cmd : world.getAllCommands()) {
            A4Solution sol = TranslateAlloyToKodkod.execute_command(
                rep, world.getAllReachableSigs(), cmd, opts);
            boolean ok;
            String label;
            // For a `check` assertion: we want NO counterexample (unsat).
            // For a `run`   predicate: we want SAT (instance found).
            if (cmd.check) {
                ok = !sol.satisfiable();
                label = "check  " + cmd.label;
            } else {
                ok = sol.satisfiable();
                label = "run    " + cmd.label;
            }
            if (ok) {
                System.out.println("OK   " + label);
            } else {
                System.out.println("FAIL " + label);
                failures += 1;
            }
        }
        if (failures > 0) {
            System.exit(1);
        }
    }
}
