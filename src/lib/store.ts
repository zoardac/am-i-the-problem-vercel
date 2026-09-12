import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface CaseRecord {
  id: string;
  createdAt: string;
  yourSide: string;
  theirSide: string;
  category: string;
  votesYou: number;
  votesThem: number;
  verdict?: string;
}

// On Vercel (and most serverless platforms) the project directory is read-only
// and each invocation may hit a different, short-lived instance — /tmp is the
// only writable path, and even that doesn't persist or share across instances.
// This file-based store is fine for local dev and single-instance demos only.
// Before relying on this in production on Vercel, swap it for Vercel KV,
// Postgres, Turso, or similar. See README.md.
const DATA_DIR = process.env.VERCEL
  ? '/tmp/am-i-the-problem-data'
  : path.resolve(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'cases.json');

async function ensureFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify([]), 'utf-8');
  }
}

export async function readCases(): Promise<CaseRecord[]> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, 'utf-8');
  try {
    return JSON.parse(raw) as CaseRecord[];
  } catch {
    return [];
  }
}

export async function writeCases(cases: CaseRecord[]): Promise<void> {
  await ensureFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(cases, null, 2), 'utf-8');
}

export async function getCase(id: string): Promise<CaseRecord | undefined> {
  const cases = await readCases();
  return cases.find((c) => c.id === id);
}

export async function addCase(record: CaseRecord): Promise<void> {
  const cases = await readCases();
  cases.unshift(record);
  await writeCases(cases);
}

export async function castVote(id: string, side: 'you' | 'them'): Promise<CaseRecord | undefined> {
  const cases = await readCases();
  const record = cases.find((c) => c.id === id);
  if (!record) return undefined;
  if (side === 'you') record.votesYou += 1;
  else record.votesThem += 1;
  await writeCases(cases);
  return record;
}

export async function listRecentCases(limit = 12): Promise<CaseRecord[]> {
  const cases = await readCases();
  return cases.slice(0, limit);
}
