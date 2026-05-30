type NodeProcessWritableStream = {
  write: (data: string) => boolean;
};

type NodeProcessHost = {
  argv: string[];
  env: Record<string, string | undefined>;
  stderr: NodeProcessWritableStream;
  stdout: NodeProcessWritableStream;
  exit: (code: number) => never;
  on: (event: string, listener: () => void) => void;
  off: (event: string, listener: () => void) => void;
};

declare const process: NodeProcessHost;
