import { Redis } from '@upstash/redis';
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

const RECENT_INDEX_KEY = 'cases:index';
const MAX_INDEX_LENGTH = 200; // cap how many ids we track for the recent-list

const hasRedisConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const redis = hasRedisConfig
  ? new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    })
  : null;

function caseKey(id: string): string {
  return `case:${id}`;
}

// ---------- Redis-backed implementation (used on Vercel once KV is connected) ----------

async function redisGetCase(id: string): Promise<CaseRecord | undefined> {
  const record = await redis!.get<CaseRecord>(caseKey(id));
  return record ?? undefined;
}

async function redisAddCase(record: CaseRecord): Promise<void> {
  await redis!.set(caseKey(record.id), record);
  await redis!.lpush(RECENT_INDEX_KEY, record.id);
  await redis!.ltrim(RECENT_INDEX_KEY, 0, MAX_INDEX_LENGTH - 1);
}

async function redisCastVote(id: string, side: 'you' | 'them'): Promise<CaseRecord | undefined> {
  const record = await redisGetCase(id);
  if (!record) return undefined;
  if (side === 'you') record.votesYou += 1;
  else record.votesThem += 1;
  await redis!.set(caseKey(id), record);
  return record;
}

async function redisListRecentCases(limit: number): Promise<CaseRecord[]> {
  const ids = await redis!.lrange<string>(RECENT_INDEX_KEY, 0, limit - 1);
  if (!ids.length) return [];
  const records = await Promise.all(ids.map((id) => redisGetCase(id)));
  return records.filter((r): r is CaseRecord => Boolean(r));
}

// ---------- Local JSON-file fallback (used only when Redis env vars aren't set — local dev) ----------

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'cases.json');

async function ensureFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify([]), 'utf-8');
  }
}

async function fileReadCases(): Promise<CaseRecord[]> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, 'utf-8');
  try {
    return JSON.parse(raw) as CaseRecord[];
  } catch {
    return [];
  }
}

async function fileWriteCases(cases: CaseRecord[]): Promise<void> {
  await ensureFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(cases, null, 2), 'utf-8');
}

async function fileGetCase(id: string): Promise<CaseRecord | undefined> {
  const cases = await fileReadCases();
  return cases.find((c) => c.id === id);
}

async function fileAddCase(record: CaseRecord): Promise<void> {
  const cases = await fileReadCases();
  cases.unshift(record);
  await fileWriteCases(cases);
}

async function fileCastVote(id: string, side: 'you' | 'them'): Promise<CaseRecord | undefined> {
  const cases = await fileReadCases();
  const record = cases.find((c) => c.id === id);
  if (!record) return undefined;
  if (side === 'you') record.votesYou += 1;
  else record.votesThem += 1;
  await fileWriteCases(cases);
  return record;
}

async function fileListRecentCases(limit: number): Promise<CaseRecord[]> {
  const cases = await fileReadCases();
  return cases.slice(0, limit);
}

// ---------- Public API — picks Redis or file backend based on available config ----------

export async function getCase(id: string): Promise<CaseRecord | undefined> {
  return redis ? redisGetCase(id) : fileGetCase(id);
}

export async function addCase(record: CaseRecord): Promise<void> {
  return redis ? redisAddCase(record) : fileAddCase(record);
}

export async function castVote(id: string, side: 'you' | 'them'): Promise<CaseRecord | undefined> {
  return redis ? redisCastVote(id, side) : fileCastVote(id, side);
}

export async function listRecentCases(limit = 12): Promise<CaseRecord[]> {
  return redis ? redisListRecentCases(limit) : fileListRecentCases(limit);
}
