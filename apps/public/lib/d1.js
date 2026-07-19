import 'server-only';

import { envValue } from './env';

function accountId() {
  return envValue('D1_ACCOUNT_ID', 'CLOUDFLARE_ACCOUNT_ID', 'R2_ACCOUNT_ID');
}

function databaseId() {
  return envValue('D1_DATABASE_ID');
}

function apiToken() {
  return envValue('D1_API_TOKEN', 'CLOUDFLARE_API_TOKEN');
}

function apiBaseUrl() {
  return envValue('D1_API_BASE_URL') || 'https://api.cloudflare.com/client/v4';
}

function queryCacheTtlMs() {
  const configured = Number(envValue('D1_QUERY_CACHE_TTL_MS'));
  return Number.isFinite(configured) && configured >= 0 ? configured : 5 * 60 * 1000;
}

function queryCache() {
  globalThis.__jntukD1QueryCache ||= new Map();
  return globalThis.__jntukD1QueryCache;
}

function cacheKey(sql, params) {
  return JSON.stringify([sql.trim().replace(/\s+/g, ' '), params]);
}

function readCachedQuery(key) {
  const ttl = queryCacheTtlMs();
  if (ttl <= 0) return null;

  const cache = queryCache();
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > ttl) {
    cache.delete(key);
    return null;
  }
  return entry.rows;
}

function writeCachedQuery(key, rows) {
  const ttl = queryCacheTtlMs();
  if (ttl <= 0) return;

  const cache = queryCache();
  if (cache.size >= 200) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { createdAt: Date.now(), rows });
}

export function clearD1QueryCache() {
  queryCache().clear();
}

export function isD1Configured() {
  return Boolean(accountId() && databaseId() && apiToken());
}

export async function d1Query(sql, params = [], { noCache = false } = {}) {
  if (!isD1Configured()) {
    throw new Error('Cloudflare D1 is not configured.');
  }

  const canCache = !noCache && /^\s*select\b/i.test(sql);
  const key = canCache ? cacheKey(sql, params) : null;
  const cachedRows = key ? readCachedQuery(key) : null;
  if (cachedRows) return cachedRows;

  const response = await fetch(`${apiBaseUrl().replace(/\/$/, '')}/accounts/${accountId()}/d1/database/${databaseId()}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql, params }),
    cache: 'no-store'
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`D1 returned a non-JSON response: HTTP ${response.status}`);
  }

  if (!response.ok || data.success === false) {
    const message = (data.errors || []).map((error) => error.message || String(error)).join('; ') || response.statusText;
    throw new Error(`D1 query failed: ${message}`);
  }

  const result = data.result || [];
  if (Array.isArray(result)) {
    const first = result[0] || {};
    if (first.success === false) throw new Error(first.error || 'D1 statement failed.');
    const rows = first.results || [];
    if (key) writeCachedQuery(key, rows);
    return rows;
  }
  if (result.success === false) throw new Error(result.error || 'D1 statement failed.');
  const rows = result.results || [];
  if (key) writeCachedQuery(key, rows);
  return rows;
}
