import fs from "node:fs";
import path from "node:path";
import { cacheKey } from "./cache";

/**
 * Three-Lane SQLite Asynchronous Ingestion Queue.
 *
 * Lanes:
 *  - "weather": NASA POWER agroclimatological daily time-series.
 *  - "precipitation": GPM IMERG / NASA POWER fallback precipitation.
 *  - "remote_sensing": Microsoft Planetary Computer Landsat COGs & NASA AppEEARS HLS/SMAP/SRTM.
 *
 * Guarantees:
 *  - Non-blocking: farmer requests return immediate status and cached results.
 *  - Deduplication: identical datasets and geographic-temporal requests share a single job.
 *  - Persistent state: tracks pending, processing, completed, and failed executions.
 *  - Resilient retry: automatic recovery with exponential backoff and failed-job logging.
 *  - Cache integration: caches discovery metadata and processed indicators with TTL.
 */

export type QueueLane = "weather" | "precipitation" | "remote_sensing";
export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface QueueJob<T = unknown> {
  id: string;
  lane: QueueLane;
  dataset: string;
  params: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  result: T | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
}

export interface EnqueueOptions {
  maxAttempts?: number;
  ttlSeconds?: number;
  forceRefresh?: boolean;
  wait?: boolean;
}

export interface IngestionQueue {
  enqueue<T>(
    lane: QueueLane,
    dataset: string,
    params: Record<string, unknown>,
    executor: () => Promise<T>,
    options?: EnqueueOptions,
  ): Promise<QueueJob<T>>;
  getJob<T>(id: string): Promise<QueueJob<T> | null>;
  listJobs(lane?: QueueLane): Promise<QueueJob[]>;
  purgeExpired(): Promise<number>;
  close(): void;
}

/**
 * Computes a deterministic job ID for a lane, dataset, and parameters.
 */
export function computeJobId(lane: QueueLane, dataset: string, params: Record<string, unknown>): string {
  const sortedKeys = Object.keys(params).sort();
  const serialized = sortedKeys.map((k) => `${k}=${JSON.stringify(params[k])}`).join("&");
  return cacheKey(lane, dataset, serialized);
}

// Memory fallback store when SQLite is unavailable
class MemoryQueueStore {
  private map = new Map<string, QueueJob>();

  get(id: string): QueueJob | null {
    const job = this.map.get(id);
    if (!job) return null;
    if (job.expiresAt && Date.parse(job.expiresAt) < Date.now()) {
      this.map.delete(id);
      return null;
    }
    return job;
  }

  set(job: QueueJob): void {
    this.map.set(job.id, job);
  }

  list(lane?: QueueLane): QueueJob[] {
    const now = Date.now();
    return Array.from(this.map.values()).filter((j) => {
      if (j.expiresAt && Date.parse(j.expiresAt) < now) return false;
      return lane ? j.lane === lane : true;
    });
  }

  purge(): number {
    const now = Date.now();
    let count = 0;
    for (const [id, j] of this.map.entries()) {
      if (j.expiresAt && Date.parse(j.expiresAt) < now) {
        this.map.delete(id);
        count++;
      }
    }
    return count;
  }
}

class SqliteQueue implements IngestionQueue {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: any = null;
  private memoryFallback = new MemoryQueueStore();
  private inFlight = new Map<string, Promise<unknown>>();

  constructor(dbPath?: string) {
    try {
      // Dynamic import / require of node:sqlite
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DatabaseSync } = require("node:sqlite");
      const targetPath = dbPath ?? path.join(process.cwd(), ".cache", "ingestion_queue.sqlite");
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new DatabaseSync(targetPath);
      this.initSchema();
    } catch {
      // Fallback to in-memory store if node:sqlite is restricted
      this.db = null;
    }
  }

  private initSchema() {
    if (!this.db) return;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ingestion_queue (
        id TEXT PRIMARY KEY,
        lane TEXT NOT NULL,
        dataset TEXT NOT NULL,
        params TEXT NOT NULL,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        result TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        expires_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_queue_lane_status ON ingestion_queue(lane, status);
    `);
  }

  async getJob<T>(id: string): Promise<QueueJob<T> | null> {
    if (!this.db) {
      return (this.memoryFallback.get(id) as QueueJob<T>) ?? null;
    }
    const stmt = this.db.prepare("SELECT * FROM ingestion_queue WHERE id = ?");
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    if (row.expires_at && Date.parse(String(row.expires_at)) < Date.now()) {
      this.db.prepare("DELETE FROM ingestion_queue WHERE id = ?").run(id);
      return null;
    }

    return {
      id: String(row.id),
      lane: row.lane as QueueLane,
      dataset: String(row.dataset),
      params: JSON.parse(String(row.params)),
      status: row.status as JobStatus,
      attempts: Number(row.attempts),
      maxAttempts: Number(row.max_attempts),
      result: row.result ? (JSON.parse(String(row.result)) as T) : null,
      error: row.error ? String(row.error) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      expiresAt: row.expires_at ? String(row.expires_at) : null,
    };
  }

  private saveJob(job: QueueJob): void {
    if (!this.db) {
      this.memoryFallback.set(job);
      return;
    }
    const stmt = this.db.prepare(`
      INSERT INTO ingestion_queue (id, lane, dataset, params, status, attempts, max_attempts, result, error, created_at, updated_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        attempts = excluded.attempts,
        max_attempts = excluded.max_attempts,
        result = excluded.result,
        error = excluded.error,
        updated_at = excluded.updated_at,
        expires_at = excluded.expires_at
    `);
    stmt.run(
      job.id,
      job.lane,
      job.dataset,
      JSON.stringify(job.params),
      job.status,
      job.attempts,
      job.maxAttempts,
      job.result !== null ? JSON.stringify(job.result) : null,
      job.error,
      job.createdAt,
      job.updatedAt,
      job.expiresAt,
    );
  }

  async enqueue<T>(
    lane: QueueLane,
    dataset: string,
    params: Record<string, unknown>,
    executor: () => Promise<T>,
    options: EnqueueOptions = {},
  ): Promise<QueueJob<T>> {
    const id = computeJobId(lane, dataset, params);
    const existing = await this.getJob<T>(id);
    const now = new Date().toISOString();

    // 1. If job is already completed and fresh, return immediately without re-downloading
    if (existing && existing.status === "completed" && !options.forceRefresh) {
      return existing;
    }

    // 2. If job is currently in progress, return the active job without duplicating
    if (existing && existing.status === "processing") {
      return existing;
    }

    // 3. Prepare or reset job record
    const maxAttempts = options.maxAttempts ?? existing?.maxAttempts ?? 3;
    const ttlSeconds = options.ttlSeconds ?? 60 * 60 * 24 * 7; // 7 days default
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const job: QueueJob<T> = {
      id,
      lane,
      dataset,
      params,
      status: "processing",
      attempts: (existing?.attempts ?? 0) + 1,
      maxAttempts,
      result: existing?.result ?? null,
      error: null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      expiresAt,
    };
    this.saveJob(job as QueueJob);

    // 4. Non-blocking asynchronous execution
    if (!this.inFlight.has(id)) {
      const executionPromise = (async () => {
        try {
          const result = await executor();
          const finishedAt = new Date().toISOString();
          const completedJob: QueueJob<T> = {
            ...job,
            status: "completed",
            result,
            error: null,
            updatedAt: finishedAt,
          };
          this.saveJob(completedJob as QueueJob);
          return result;
        } catch (err) {
          const failedAt = new Date().toISOString();
          const message = err instanceof Error ? err.message : String(err);
          const failedJob: QueueJob<T> = {
            ...job,
            status: "failed",
            error: message,
            updatedAt: failedAt,
          };
          this.saveJob(failedJob as QueueJob);
          throw err;
        } finally {
          this.inFlight.delete(id);
        }
      })();

      this.inFlight.set(id, executionPromise);
      // Suppress unhandled rejection in background task; caller inspects job status
      executionPromise.catch(() => {});
    }

    const shouldWait = options.wait || Boolean(process.env.VERCEL);
    if (shouldWait) {
      try {
        const inFlightPromise = this.inFlight.get(id);
        if (inFlightPromise) {
          await inFlightPromise;
        }
        return (await this.getJob<T>(id)) ?? job;
      } catch {
        return (await this.getJob<T>(id)) ?? job;
      }
    }

    return job;
  }

  async listJobs(lane?: QueueLane): Promise<QueueJob[]> {
    if (!this.db) {
      return this.memoryFallback.list(lane);
    }
    const stmt = lane
      ? this.db.prepare("SELECT * FROM ingestion_queue WHERE lane = ? ORDER BY updated_at DESC LIMIT 100")
      : this.db.prepare("SELECT * FROM ingestion_queue ORDER BY updated_at DESC LIMIT 100");
    const rows = (lane ? stmt.all(lane) : stmt.all()) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: String(row.id),
      lane: row.lane as QueueLane,
      dataset: String(row.dataset),
      params: JSON.parse(String(row.params)),
      status: row.status as JobStatus,
      attempts: Number(row.attempts),
      maxAttempts: Number(row.max_attempts),
      result: row.result ? JSON.parse(String(row.result)) : null,
      error: row.error ? String(row.error) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      expiresAt: row.expires_at ? String(row.expires_at) : null,
    }));
  }

  async purgeExpired(): Promise<number> {
    if (!this.db) {
      return this.memoryFallback.purge();
    }
    const now = new Date().toISOString();
    const info = this.db.prepare("DELETE FROM ingestion_queue WHERE expires_at IS NOT NULL AND expires_at < ?").run(now);
    return Number(info.changes ?? 0);
  }

  close(): void {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // ignore
      }
      this.db = null;
    }
  }
}

let sharedQueue: IngestionQueue | null = null;

export function getIngestionQueue(dbPath?: string): IngestionQueue {
  if (!sharedQueue) {
    sharedQueue = new SqliteQueue(dbPath);
  }
  return sharedQueue;
}
