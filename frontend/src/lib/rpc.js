import { ethers } from "ethers";

const BASE_RPC_URLS = String(import.meta.env.VITE_BASE_RPC_URLS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const DEFAULT_CHAIN_ID = Number(import.meta.env.VITE_BASE_CHAIN_ID || 8453);
const MAX_CONCURRENT_REQUESTS = Math.max(1, Number(import.meta.env.VITE_RPC_MAX_CONCURRENT || 4));
const MAX_RETRIES_PER_REQUEST = Math.max(0, Number(import.meta.env.VITE_RPC_MAX_RETRIES || 2));
const BASE_RETRY_DELAY_MS = Math.max(100, Number(import.meta.env.VITE_RPC_RETRY_DELAY_MS || 400));
const PROVIDER_COOLDOWN_MS = Math.max(500, Number(import.meta.env.VITE_RPC_PROVIDER_COOLDOWN_MS || 10_000));
const CACHE_LIMIT = Math.max(10, Number(import.meta.env.VITE_RPC_CACHE_LIMIT || 300));

function parseRpcUrls() {
  const configured = BASE_RPC_URLS
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set(configured)];
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function stringifyCacheValue(value) {
  return JSON.stringify(value, (_, current) => (typeof current === "bigint" ? current.toString() : current));
}

function toErrorMessage(error) {
  return [
    error?.shortMessage,
    error?.reason,
    error?.info?.error?.message,
    error?.error?.message,
    error?.message,
  ]
    .filter((value) => typeof value === "string" && value.trim())
    .join(" | ")
    .toLowerCase();
}

function isRetryableRpcError(error) {
  const message = toErrorMessage(error);
  const code = error?.code;
  const status = error?.status || error?.info?.response?.status || error?.error?.status;

  if ([429, 502, 503, 504].includes(Number(status))) {
    return true;
  }

  if (typeof code === "string") {
    const normalizedCode = code.toUpperCase();
    if ([
      "SERVER_ERROR",
      "NETWORK_ERROR",
      "TIMEOUT",
      "BAD_DATA",
      "UNKNOWN_ERROR",
      "ECONNRESET",
      "ETIMEDOUT",
    ].includes(normalizedCode)) {
      return true;
    }
  }

  return [
    "429",
    "rate limit",
    "too many requests",
    "timeout",
    "timed out",
    "socket hang up",
    "network error",
    "failed to fetch",
    "missing response",
    "gateway timeout",
    "temporarily unavailable",
    "service unavailable",
    "internal error",
    "header not found",
  ].some((fragment) => message.includes(fragment));
}

function isRateLimitRpcError(error) {
  const message = toErrorMessage(error);
  const status = error?.status || error?.info?.response?.status || error?.error?.status;

  return Number(status) === 429 || ["429", "rate limit", "too many requests"].some((fragment) => message.includes(fragment));
}

class RequestQueue {
  constructor(limit) {
    this.limit = limit;
    this.running = 0;
    this.queue = [];
  }

  enqueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.flush();
    });
  }

  flush() {
    while (this.running < this.limit && this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) return;

      this.running += 1;
      Promise.resolve()
        .then(next.task)
        .then(next.resolve, next.reject)
        .finally(() => {
          this.running -= 1;
          this.flush();
        });
    }
  }
}

const rpcQueue = new RequestQueue(MAX_CONCURRENT_REQUESTS);
const rpcCache = new Map();
const providerPool = parseRpcUrls().map((url, index) => ({
  id: `${index}:${url}`,
  index,
  url,
  provider: new ethers.JsonRpcProvider(url, DEFAULT_CHAIN_ID),
  failures: 0,
  active: 0,
  cooldownUntil: 0,
  lastSuccessAt: 0,
}));
let nextProviderCursor = 0;

function evictExpiredCacheEntries() {
  const now = Date.now();
  for (const [key, entry] of rpcCache.entries()) {
    if (!entry.inflight && entry.expiresAt <= now) {
      rpcCache.delete(key);
    }
  }

  if (rpcCache.size <= CACHE_LIMIT) return;

  const entries = [...rpcCache.entries()].sort((left, right) => left[1].createdAt - right[1].createdAt);
  while (rpcCache.size > CACHE_LIMIT && entries.length > 0) {
    const [oldestKey] = entries.shift();
    rpcCache.delete(oldestKey);
  }
}

function getCachedValue(cacheKey) {
  if (!cacheKey) return null;
  evictExpiredCacheEntries();

  const entry = rpcCache.get(cacheKey);
  if (!entry) return null;

  if (entry.inflight || entry.expiresAt > Date.now()) {
    return entry.value;
  }

  rpcCache.delete(cacheKey);
  return null;
}

function setCachedValue(cacheKey, value, ttlMs, inflight = false) {
  if (!cacheKey || ttlMs <= 0) return;
  rpcCache.set(cacheKey, {
    value,
    inflight,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
  });
  evictExpiredCacheEntries();
}

function clearInflightCache(cacheKey, nextValue, ttlMs) {
  if (!cacheKey || ttlMs <= 0) return;
  if (nextValue === undefined) {
    rpcCache.delete(cacheKey);
    return;
  }
  setCachedValue(cacheKey, Promise.resolve(nextValue), ttlMs, false);
}

function pickProvider(excludedIds = new Set()) {
  const now = Date.now();
  const eligible = providerPool
    .filter((entry) => entry.cooldownUntil <= now && !excludedIds.has(entry.id))
    .sort((left, right) => {
      if (left.active !== right.active) return left.active - right.active;
      if (left.failures !== right.failures) return left.failures - right.failures;
      if (left.lastSuccessAt !== right.lastSuccessAt) return left.lastSuccessAt - right.lastSuccessAt;
      return left.index - right.index;
    });

  return eligible[0] || providerPool.find((entry) => !excludedIds.has(entry.id)) || null;
}

function pickDistinctProviders(count) {
  if (!providerPool.length) return [];

  const now = Date.now();
  const eligible = providerPool
    .filter((entry) => entry.cooldownUntil <= now)
    .sort((left, right) => {
      if (left.active !== right.active) return left.active - right.active;
      if (left.failures !== right.failures) return left.failures - right.failures;
      return left.index - right.index;
    });

  const source = eligible.length ? eligible : [...providerPool];
  const startIndex = source.length ? nextProviderCursor % source.length : 0;
  const selected = [];

  for (let offset = 0; offset < source.length && selected.length < count; offset += 1) {
    const entry = source[(startIndex + offset) % source.length];
    if (!selected.some((current) => current.id === entry.id)) {
      selected.push(entry);
    }
  }

  nextProviderCursor += selected.length || 1;
  return selected;
}

function markProviderSuccess(entry) {
  entry.failures = 0;
  entry.cooldownUntil = 0;
  entry.lastSuccessAt = Date.now();
}

function markProviderFailure(entry, error) {
  entry.failures += 1;
  if (isRetryableRpcError(error)) {
    entry.cooldownUntil = Date.now() + PROVIDER_COOLDOWN_MS * Math.min(entry.failures, 3);
  }
}

export function hasRpcEndpoints() {
  return providerPool.length > 0;
}

export function getRpcEndpointCount() {
  return providerPool.length;
}

export function getPrimaryRpcUrl() {
  return providerPool[0]?.url || "";
}

export function getRpcUrls() {
  return providerPool.map((entry) => entry.url);
}

export async function runRpcRequest(executor, options = {}) {
  const {
    cacheKey = "",
    cacheTtlMs = 0,
    retries = MAX_RETRIES_PER_REQUEST,
    retryDelayMs = BASE_RETRY_DELAY_MS,
    preferredProviderId = "",
  } = options;

  if (!providerPool.length) {
    throw new Error("No RPC endpoints configured.");
  }

  const cached = getCachedValue(cacheKey);
  if (cached) {
    return cached;
  }

  const taskPromise = rpcQueue.enqueue(async () => {
    const attempted = new Set();
    let lastError = null;
    const maxAttempts = Math.max(1, Math.min(providerPool.length + retries, providerPool.length * (retries + 1)));

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const preferredProvider = preferredProviderId
        ? providerPool.find((entry) => entry.id === preferredProviderId && !attempted.has(entry.id))
        : null;
      const providerEntry =
        preferredProvider && preferredProvider.cooldownUntil <= Date.now()
          ? preferredProvider
          : pickProvider(attempted);
      if (!providerEntry) break;

      attempted.add(providerEntry.id);
      providerEntry.active += 1;

      try {
        const result = await executor(providerEntry.provider, {
          url: providerEntry.url,
          attempt,
          providerIndex: providerEntry.index,
        });
        markProviderSuccess(providerEntry);
        return result;
      } catch (error) {
        lastError = error;
        markProviderFailure(providerEntry, error);

        if (!isRetryableRpcError(error) && attempted.size >= 1) {
          throw error;
        }

        if (attempt < maxAttempts - 1 && !isRateLimitRpcError(error)) {
          await sleep(retryDelayMs * (attempt + 1));
        }
      } finally {
        providerEntry.active -= 1;
      }
    }

    throw lastError || new Error("All RPC providers failed.");
  });

  if (cacheKey && cacheTtlMs > 0) {
    setCachedValue(cacheKey, taskPromise, cacheTtlMs, true);
  }

  try {
    const result = await taskPromise;
    clearInflightCache(cacheKey, result, cacheTtlMs);
    return result;
  } catch (error) {
    clearInflightCache(cacheKey);
    throw error;
  }
}

export async function readContract({ address, abi, method, args = [], cacheKey, cacheTtlMs = 0, retries, retryDelayMs }) {
  const resolvedCacheKey = cacheKey || `contract:${String(address).toLowerCase()}:${method}:${stringifyCacheValue(args)}`;
  return runRpcRequest(
    (provider) => {
      const contract = new ethers.Contract(address, abi, provider);
      return contract[method](...args);
    },
    {
      cacheKey: resolvedCacheKey,
      cacheTtlMs,
      retries,
      retryDelayMs,
    }
  );
}

export async function readContractsDistributed(requests) {
  if (!Array.isArray(requests) || requests.length === 0) {
    return [];
  }

  const selectedProviders = pickDistinctProviders(requests.length);

  return Promise.all(
    requests.map((request, index) => {
      const preferredProvider = selectedProviders[index] || null;
      return runRpcRequest(
        (provider) => {
          const contract = new ethers.Contract(request.address, request.abi, provider);
          return contract[request.method](...(request.args || []));
        },
        {
          cacheKey: request.cacheKey,
          cacheTtlMs: request.cacheTtlMs || 0,
          retries: request.retries,
          retryDelayMs: request.retryDelayMs,
          preferredProviderId: preferredProvider?.id,
        }
      );
    })
  );
}
