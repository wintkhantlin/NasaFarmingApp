import { appeearsCredentials, SourceUnconfiguredError, type Env } from "../earthdata";
import { fetchWithRetry } from "../../network/fetch-with-retry";

/**
 * AppEEARS REST client (https://appeears.earthdatacloud.nasa.gov/api/). Server only.
 * Public product discovery needs no login; `login`, `task` and `bundle` calls do.
 */

export const APPEEARS_BASE = "https://appeears.earthdatacloud.nasa.gov/api";

export class AppeearsError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AppeearsError";
  }
}

export interface ClientOptions {
  fetch?: typeof fetch;
  signal?: AbortSignal;
  env?: Env;
}

type Json = Record<string, unknown>;

interface TokenCache {
  token: string;
  /** epoch ms */
  expires: number;
}
let cached: TokenCache | null = null;

/** Clears the in-memory token. Tests use it; so does a 401 retry. */
export function resetAppeearsToken(): void {
  cached = null;
}

export async function login(opts: ClientOptions = {}): Promise<string> {
  if (cached && cached.expires - Date.now() > 60_000) return cached.token;
  const creds = appeearsCredentials(opts.env);
  if (!creds) throw new SourceUnconfiguredError("appeears");
  const basic = Buffer.from(`${creds.username}:${creds.password}`).toString("base64");
  const res = await fetchWithRetry(
    `${APPEEARS_BASE}/login`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
      signal: opts.signal,
    },
    { signal: opts.signal, maxRetries: 2, initialDelayMs: 300 },
    opts.fetch ?? fetch,
  );
  if (!res.ok) throw new AppeearsError(`AppEEARS login failed (${res.status}).`, res.status);
  const body = (await res.json()) as Json;
  if (typeof body.token !== "string") throw new AppeearsError("AppEEARS login returned no token.");
  const expires = typeof body.expiration === "string" ? Date.parse(body.expiration) : Date.now() + 3_600_000;
  cached = { token: body.token, expires: Number.isFinite(expires) ? expires : Date.now() + 3_600_000 };
  return cached.token;
}

async function authed(path: string, init: RequestInit, opts: ClientOptions): Promise<Response> {
  const f = opts.fetch ?? fetch;
  const run = async () => {
    const token = await login(opts);
    return fetchWithRetry(
      `${APPEEARS_BASE}${path}`,
      {
        ...init,
        signal: opts.signal,
        headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` },
      },
      { signal: opts.signal, maxRetries: 2, initialDelayMs: 400 },
      f,
    );
  };
  let res = await run();
  if (res.status === 401) {
    resetAppeearsToken();
    res = await run();
  }
  return res;
}

export type TaskStatus = "pending" | "processing" | "done" | "error" | "unknown";

export async function submitTask(task: Json, opts: ClientOptions = {}): Promise<{ taskId: string }> {
  const res = await authed(
    "/task",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(task) },
    opts,
  );
  if (!res.ok) throw new AppeearsError(`AppEEARS rejected the task (${res.status}): ${await safeText(res)}`, res.status);
  const body = (await res.json()) as Json;
  if (typeof body.task_id !== "string") throw new AppeearsError("AppEEARS returned no task id.");
  return { taskId: body.task_id };
}

export async function getTask(taskId: string, opts: ClientOptions = {}): Promise<{ status: TaskStatus; raw: Json }> {
  const res = await authed(`/task/${encodeURIComponent(taskId)}`, { method: "GET" }, opts);
  if (!res.ok) throw new AppeearsError(`AppEEARS task lookup failed (${res.status}).`, res.status);
  const raw = (await res.json()) as Json;
  const s = typeof raw.status === "string" ? raw.status.toLowerCase() : "unknown";
  const status: TaskStatus = s === "done" || s === "error" ? s : s === "pending" || s === "queued" ? "pending" : s === "processing" ? "processing" : "unknown";
  return { status, raw };
}

export interface BundleFile {
  file_id: string;
  file_name: string;
  file_type?: string;
  file_size?: number;
}

export async function listBundle(taskId: string, opts: ClientOptions = {}): Promise<BundleFile[]> {
  const res = await authed(`/bundle/${encodeURIComponent(taskId)}`, { method: "GET" }, opts);
  if (!res.ok) throw new AppeearsError(`AppEEARS bundle lookup failed (${res.status}).`, res.status);
  const body = (await res.json()) as Json;
  return Array.isArray(body.files) ? (body.files as BundleFile[]) : [];
}

/** Downloads one result file. AppEEARS redirects to storage; the redirect is followed without the bearer token. */
export async function downloadFile(taskId: string, fileId: string, opts: ClientOptions = {}): Promise<ArrayBuffer> {
  const f = opts.fetch ?? fetch;
  const runInitial = async () => {
    const token = await login(opts);
    return fetchWithRetry(
      `${APPEEARS_BASE}/bundle/${encodeURIComponent(taskId)}/${encodeURIComponent(fileId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        redirect: "manual",
        signal: opts.signal,
      },
      { signal: opts.signal, maxRetries: 2, initialDelayMs: 300 },
      f,
    );
  };

  let first = await runInitial();
  if (first.status === 401) {
    resetAppeearsToken();
    first = await runInitial();
  }

  // Follow redirect to storage (e.g. AWS S3 presigned URL)
  if (first.status >= 300 && first.status < 400) {
    const rawLoc = first.headers.get("location");
    if (!rawLoc) throw new AppeearsError("AppEEARS redirect had no location.");
    const loc = rawLoc.startsWith("http") ? rawLoc : new URL(rawLoc, APPEEARS_BASE).toString();
    const res = await fetchWithRetry(
      loc,
      { signal: opts.signal },
      { signal: opts.signal, maxRetries: 3, initialDelayMs: 500, maxDelayMs: 4000 },
      f,
    );
    if (!res.ok) throw new AppeearsError(`Result download failed (${res.status}).`, res.status);

    const buffer = await res.arrayBuffer();
    const expectedLength = Number(res.headers.get("content-length"));
    if (!Number.isNaN(expectedLength) && expectedLength > 0 && buffer.byteLength < expectedLength) {
      throw new AppeearsError(`Truncated download: expected ${expectedLength} bytes, received ${buffer.byteLength}.`);
    }
    return buffer;
  }

  if (!first.ok) throw new AppeearsError(`Result download failed (${first.status}).`, first.status);

  const buffer = await first.arrayBuffer();
  const expectedLength = Number(first.headers.get("content-length"));
  if (!Number.isNaN(expectedLength) && expectedLength > 0 && buffer.byteLength < expectedLength) {
    throw new AppeearsError(`Truncated download: expected ${expectedLength} bytes, received ${buffer.byteLength}.`);
  }
  return buffer;
}

/** Public: no login needed. */
export async function getQuality(product: string, layer: string, opts: ClientOptions = {}): Promise<Json[]> {
  const res = await (opts.fetch ?? fetch)(`${APPEEARS_BASE}/quality/${encodeURIComponent(product)}/${encodeURIComponent(layer)}`, {
    signal: opts.signal,
  });
  if (!res.ok) throw new AppeearsError(`AppEEARS quality lookup failed (${res.status}).`, res.status);
  return (await res.json()) as Json[];
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "";
  }
}
