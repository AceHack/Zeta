// The four sanitizer shapes, measured one variable at a time. A previous
// attempt on src/Core.TypeScript/observe/realtime-client.ts assumed
// `js/log-injection` refuses a character RANGE and named CR and LF explicitly
// ahead of it. That hypothesis was tested and refuted - the alert survived and
// merely moved line. These four files say what the discriminator actually is.
//
// `StringReplaceSanitizer` holds only when `StringReplaceCall.replaces(old,
// new)` has `new = ""`. The REGEX shape is irrelevant; the REPLACEMENT is the
// whole thing. `exactNewlineToSpace` is the shape that ships today, and it is
// the one that stays loud.
import * as http from "node:http";

http
  .createServer((req, res) => {
    const note = String(req.headers["x-note"] ?? "");

    // SILENT: exact \n, empty replacement - the shape the query matches.
    console.warn("exactToEmpty:", note.replace(/\n/gu, ""));

    // SILENT: character CLASS, empty replacement. The range was never the issue.
    console.warn("classToEmpty:", note.replace(/[\r\n]/gu, ""));

    // LOUD: exact \n, but replaced with a space. This is the discriminator.
    console.warn("exactToSpace:", note.replace(/\n/gu, " "));

    // LOUD: the shipping shape - whole C0/DEL/C1 class mapped to a space, which
    // is strictly SAFER than the two silent ones above and still reported.
    // eslint-disable-next-line no-control-regex
    console.warn("shipping:", note.replace(/[\u0000-\u001F\u007F-\u009F]/gu, " "));

    res.end("ok");
  })
  .listen(0);
