/**
 * Resilient HTTP fetching utility with exponential backoff, jitter,
 * HTTP 429 Retry-After handling, and per-attempt timeout support.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3). */
  maxRetries?: number;
  /** Initial delay before first retry in milliseconds (default: 500). */
  initialDelayMs?: number;
  /** Maximum delay cap in milliseconds (default: 5000). */
  maxDelayMs?: number;
  /** Exponential backoff multiplier (default: 2). */
  backoffMultiplier?: number;
  /** HTTP status codes that trigger a retry (default: [408, 429, 500, 502, 503, 504]). */
  retryOnStatuses?: number[];
  /** Whether to retry on network errors such as TypeError, ECONNRESET, ETIMEDOUT (default: true). */
  retryOnNetworkErrors?: boolean;
  /** Per-request timeout in milliseconds (optional). */
  timeoutMs?: number;
  /** External AbortSignal to cancel all attempts. */
  signal?: AbortSignal;
  /** Optional callback fired on each retry. */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

const DEFAULT_RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];

/**
 * Parses the Retry-After header value if present.
 * Can be either a number of seconds or an HTTP Date string.
 */
function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) {
    const diff = dateMs - Date.now();
    return diff > 0 ? diff : 0;
  }
  return null;
}

/**
 * Calculates exponential backoff with full jitter:
 * delay = randomBetween(0, min(maxDelayMs, initialDelayMs * (multiplier ^ attempt)))
 */
function calculateBackoff(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  multiplier: number,
): number {
  const expDelay = initialDelayMs * Math.pow(multiplier, attempt);
  const capped = Math.min(maxDelayMs, expDelay);
  // Full jitter: uniformly distributed between 0.5 * capped and capped
  return Math.round(capped * (0.5 + Math.random() * 0.5));
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("Aborted"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(signal?.reason ?? new Error("Aborted"));
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Executes a fetch request with automatic retries for transient failures,
 * 429 rate limits, and gateway/server errors.
 */
export async function fetchWithRetry(
  url: string | URL,
  init?: RequestInit,
  options: RetryOptions = {},
  customFetch: typeof fetch = fetch,
): Promise<Response> {
  const {
    maxRetries = 3,
    initialDelayMs = 500,
    maxDelayMs = 5000,
    backoffMultiplier = 2,
    retryOnStatuses = DEFAULT_RETRYABLE_STATUSES,
    retryOnNetworkErrors = true,
    timeoutMs,
    signal,
    onRetry,
  } = options;

  let attempt = 0;

  while (true) {
    // Check if parent signal has already been aborted
    if (signal?.aborted) {
      throw signal.reason ?? new Error("Aborted");
    }

    // Set up per-attempt timeout if requested
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let attemptSignal = signal;

    if (timeoutMs && timeoutMs > 0) {
      const controller = new AbortController();
      timeoutId = setTimeout(() => {
        controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      if (signal) {
        signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
      }
      attemptSignal = controller.signal;
    }

    try {
      const response = await customFetch(url, {
        ...init,
        signal: attemptSignal,
      });

      if (timeoutId) clearTimeout(timeoutId);

      // If status is retryable and we haven't reached maxRetries
      if (retryOnStatuses.includes(response.status) && attempt < maxRetries) {
        const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
        const delayMs =
          retryAfterMs !== null
            ? Math.min(maxDelayMs, retryAfterMs)
            : calculateBackoff(attempt, initialDelayMs, maxDelayMs, backoffMultiplier);

        attempt++;
        if (onRetry) {
          onRetry(attempt, new Error(`HTTP ${response.status}`), delayMs);
        }

        await sleep(delayMs, signal);
        continue;
      }

      return response;
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);

      // Do not retry if caller explicitly aborted
      if (signal?.aborted) {
        throw signal.reason ?? err;
      }

      const isNetworkError =
        err instanceof TypeError ||
        (err instanceof Error &&
          (err.name === "AbortError" ||
            err.message.includes("fetch failed") ||
            err.message.includes("network") ||
            err.message.includes("timeout")));

      if (retryOnNetworkErrors && isNetworkError && attempt < maxRetries) {
        const delayMs = calculateBackoff(attempt, initialDelayMs, maxDelayMs, backoffMultiplier);
        attempt++;
        if (onRetry) {
          onRetry(attempt, err, delayMs);
        }
        await sleep(delayMs, signal);
        continue;
      }

      throw err;
    }
  }
}
