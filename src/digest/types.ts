// Plan morning-digest § 1. The contract every part of § 2 builds against: commit this first.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, once parsed.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job for the night. Times keep the offset from the log (styleguide).
export type DigestRow = {
  job: string;
  owner: string | null; // null renders as —
  runs: number; // lines for this job
  retries: number; // lines with status "retry"
  lastStatus: RunStatus;
  lastError: string | null; // error of the last line that had one
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string; // YYYY-MM-DD, the file name
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that didn't parse: counted, never thrown
};

// null when runs/<night>.jsonl doesn't exist (the routes answer 404). An empty file is a Night
// with no rows ("nothing ran").
export type ReadNight = (runsDir: string, night: string) => Night | null;
