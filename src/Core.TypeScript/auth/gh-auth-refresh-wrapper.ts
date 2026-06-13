import { spawn } from "bun";

export async function main(): Promise<number> {
  const scopes = process.argv.slice(2).join(",");
  if (!scopes) {
    console.error("Usage: bun run tools/auth/gh-auth-refresh-wrapper.ts <scopes>");
    return 1;
  }

  console.log(`Starting gh auth refresh for scopes: ${scopes}`);

  const proc = spawn({
    cmd: ["gh", "auth", "refresh", "-h", "github.com", "-s", scopes],
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });

  let codeCaptured = false;

  const handleOutput = async (stream: ReadableStream, isStderr: boolean) => {
    const out = isStderr ? process.stderr : process.stdout;
    // Per-invocation TextDecoder: TextDecoder is stateful (retains partial
    // multi-byte sequences between decode() calls). Two concurrent handleOutput
    // calls (stdout + stderr) sharing one decoder can corrupt cross-stream output.
    const decoder = new TextDecoder();
    // Buffer text across chunks: gh output may split prompts across
    // arbitrary chunk boundaries, so per-chunk includes() can miss them.
    let buffer = "";
    const PROMPT = "? Authenticate Git with your GitHub credentials?";
    let promptHandled = false;
    for await (const chunk of stream) {
      const text = decoder.decode(chunk);
      out.write(text);
      buffer += text;

      // Look for the Y/N prompt in accumulated buffer.
      if (!promptHandled && buffer.includes(PROMPT)) {
        proc.stdin.write("Y\n");
        proc.stdin.flush();
        promptHandled = true;
        // Trim consumed prompt to bound buffer growth.
        buffer = buffer.slice(buffer.indexOf(PROMPT) + PROMPT.length);
      }

      // Look for the one-time code in accumulated buffer.
      const codeMatch = buffer.match(/! First copy your one-time code: ([A-Z0-9-]+)/);
      if (codeMatch && !codeCaptured) {
        const code = codeMatch[1];
        codeCaptured = true;
        console.log(`\n\n`);
        console.log(`========================================================`);
        console.log(`🚀 ONE-TIME CODE CAPTURED: ${code} 🚀`);
        console.log(`========================================================`);
        console.log(`\n`);
        // gh waits at "Press Enter to open github.com in your browser..."
        // after printing the code. Pump a newline so the device flow
        // continues to the token-store step; without this the wrapper
        // hangs indefinitely because the child stdin is piped and the
        // operator can't satisfy the prompt manually.
        proc.stdin.write("\n");
        proc.stdin.flush();
      }

      // Keep buffer bounded across long sessions.
      if (buffer.length > 16384) {
        buffer = buffer.slice(-8192);
      }
    }
  };

  // Capture handler promises and await them before exit; otherwise
  // trailing stdout/stderr (e.g. the one-time code banner) can be
  // dropped when process.exit fires before the output pumps drain.
  const handlersPromise = Promise.all([
    handleOutput(proc.stdout, false),
    handleOutput(proc.stderr, true),
  ]).catch(console.error);

  const exitCode = await proc.exited;
  await handlersPromise;
  console.log(`\ngh auth refresh exited with code ${exitCode}`);
  return exitCode;
}

if (import.meta.main) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error("Error running wrapper:", err);
      process.exit(1);
    });
}
