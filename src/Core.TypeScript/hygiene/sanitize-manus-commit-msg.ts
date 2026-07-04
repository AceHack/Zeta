// sanitize-manus-commit-msg.ts — pure strip of Manus/Lumen shell-wrapper leaks
// from commit message text (081KWN0JKJV / 081KWMY831H). Mirrors scripts/hooks/commit-msg.
//
// Observed leak (44763cdc1):
//   __manus_ec=$?; trap '' PIPE; printf "%d:%s\n" $__manus_ec "$PWD" 2>/dev/null >&3; trap - PIPEfeat: ...

/** Matches the Manus PROMPT_COMMAND epilogue when it leaks into a commit subject. */
export const MANUS_WRAPPER_RE =
  /__manus_ec=\$\?;\s*trap\s+''\s+PIPE;\s*printf\s+"%d:%s\\n"\s+\$__manus_ec\s+"\$PWD"\s+2>\/dev\/null\s+>&3;\s*trap\s+-\s+PIPE/g;

/** True when the commit *subject* still carries live wrapper plumbing (fail-closed).
 *  Bodies may mention `__manus_ec` in prose without being a leak. */
export function hasManusWrapperSignature(text: string): boolean {
  const subject = text.split("\n")[0] ?? "";
  return /__manus_ec|trap\s+''\s+PIPE/.test(subject);
}

/** Strip known wrapper epilogue; does not throw. */
export function sanitizeManusCommitMsg(text: string): string {
  return text.replace(MANUS_WRAPPER_RE, "");
}

export interface SanitizeCommitMsgResult {
  readonly text: string;
  readonly changed: boolean;
  readonly refused: boolean;
  readonly reason?: string;
}

/** Sanitize and apply fail-closed rules (empty subject / residual signature). */
export function sanitizeManusCommitMsgStrict(text: string): SanitizeCommitMsgResult {
  const cleaned = sanitizeManusCommitMsg(text);
  const changed = cleaned !== text;
  if (hasManusWrapperSignature(cleaned)) {
    return {
      text: cleaned,
      changed,
      refused: true,
      reason: "residual Manus/Lumen shell-wrapper signature",
    };
  }
  const first = (cleaned.split("\n")[0] ?? "").trim();
  if (first.length === 0) {
    return {
      text: cleaned,
      changed,
      refused: true,
      reason: "empty commit subject after sanitize",
    };
  }
  return { text: cleaned, changed, refused: false };
}
