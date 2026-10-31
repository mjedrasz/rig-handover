import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { countStatuses, type StatusCounts } from './digest/counts.js';
import type { RigConfig } from './config.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightEntry[];
};

// counts is null when the file can't be read (renders as —).
export type NightEntry = { night: string; counts: StatusCounts | null };

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((night) => ({ night, counts: readCounts(config.runsDir, night) })),
  };
}

function readCounts(runsDir: string, night: string): StatusCounts | null {
  try {
    return countStatuses(readFileSync(join(runsDir, `${night}.jsonl`), 'utf8'));
  } catch {
    return null;
  }
}
