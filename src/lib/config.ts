// SPDX-License-Identifier: Apache-2.0

import type { LoadedConfig, OpenSalesTaxPluginOptions } from '../types';

/** Allowed URL schemes for the engine endpoint. SSRF mitigation. */
const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Merges `OpenSalesTaxPlugin.init({...})` options with environment
 * variable defaults and validates the result.
 *
 * Priority (highest first):
 *   1. Explicit values in `options`
 *   2. Environment variables (`OSTAX_API_URL`, `OSTAX_API_TOKEN`,
 *      `OSTAX_FAIL_HARD`, `OSTAX_TIMEOUT_MS`)
 *   3. Built-in defaults (`failHard=false`, `timeoutMs=5000`)
 *
 * Throws on:
 *   - Missing or empty `apiUrl`
 *   - Malformed `apiUrl` (not parseable as URL)
 *   - `apiUrl` scheme other than `http:` / `https:`
 *   - `timeoutMs` not a positive finite number
 */
export function loadConfig(
  options: OpenSalesTaxPluginOptions = {},
  env: NodeJS.ProcessEnv = process.env,
): LoadedConfig {
  const apiUrlRaw = options.apiUrl ?? env.OSTAX_API_URL;
  if (apiUrlRaw === undefined || apiUrlRaw.trim() === '') {
    throw new Error(
      '@ejosterberg/vendure-plugin-opensalestax: apiUrl is required. ' +
        'Pass it via OpenSalesTaxPlugin.init({ apiUrl }) or set OSTAX_API_URL.',
    );
  }
  const apiUrl = apiUrlRaw.trim();

  let parsed: URL;
  try {
    parsed = new URL(apiUrl);
  } catch {
    throw new Error(
      `@ejosterberg/vendure-plugin-opensalestax: apiUrl is not a valid URL: "${apiUrl}"`,
    );
  }
  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    throw new Error(
      `@ejosterberg/vendure-plugin-opensalestax: apiUrl scheme must be http: or https: ` +
        `(got "${parsed.protocol}")`,
    );
  }

  const apiTokenRaw = options.apiToken ?? env.OSTAX_API_TOKEN;
  const apiToken =
    apiTokenRaw === undefined || apiTokenRaw === '' ? undefined : apiTokenRaw;

  const failHard =
    options.failHard !== undefined
      ? options.failHard
      : env.OSTAX_FAIL_HARD === '1' || env.OSTAX_FAIL_HARD === 'true';

  const timeoutMsRaw = options.timeoutMs ?? parseEnvInt(env.OSTAX_TIMEOUT_MS);
  const timeoutMs = timeoutMsRaw ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(
      `@ejosterberg/vendure-plugin-opensalestax: timeoutMs must be a positive number ` +
        `(got ${String(timeoutMs)})`,
    );
  }

  return Object.freeze({
    apiUrl,
    apiToken,
    failHard,
    timeoutMs,
  });
}

function parseEnvInt(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? undefined : n;
}
