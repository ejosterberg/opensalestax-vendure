// SPDX-License-Identifier: Apache-2.0 OR GPL-2.0-or-later

import type { LoadedConfig, OpenSalesTaxCategory, OpenSalesTaxPluginOptions } from '../types';

/** Allowed URL schemes for the engine endpoint. SSRF mitigation. */
const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

const DEFAULT_TIMEOUT_MS = 5000;

/** OST engine's accepted tax category strings. Empty string = skip line. */
const VALID_CATEGORIES: ReadonlySet<OpenSalesTaxCategory> = new Set([
  'general',
  'clothing',
  'groceries',
  'prescription_drugs',
  'prepared_food',
  'digital_goods',
  '',
]);

function formatValidCategories(): string {
  return [...VALID_CATEGORIES].map((c) => (c === '' ? "'' (skip line)" : c)).join(', ');
}

/** US state codes are uppercase 2-letter (ISO 3166-2 subdivision). */
const STATE_CODE_REGEX = /^[A-Z]{2}$/;

/**
 * Validates a state-code list and returns a frozen Set, or `null`
 * when the input is undefined/empty. Throws on any invalid code,
 * with all bad codes listed in the error message.
 */
function normalizeStateList(
  raw: string[] | undefined,
  fieldName: string,
): ReadonlySet<string> | null {
  if (raw === undefined || raw.length === 0) return null;
  const invalid = raw.filter((s) => !STATE_CODE_REGEX.test(s));
  if (invalid.length > 0) {
    const quoted = invalid.map((s) => `"${s}"`).join(', ');
    throw new Error(
      '@ejosterberg/vendure-plugin-opensalestax: invalid state codes in ' +
        `${fieldName}: ${quoted}. ` +
        'Use uppercase 2-letter ISO 3166-2 codes (e.g. "MN", "WI").',
    );
  }
  const set = new Set(raw);
  Object.freeze(set);
  return set;
}

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
    options.failHard ?? (env.OSTAX_FAIL_HARD === '1' || env.OSTAX_FAIL_HARD === 'true');

  const timeoutMsRaw = options.timeoutMs ?? parseEnvInt(env.OSTAX_TIMEOUT_MS);
  const timeoutMs = timeoutMsRaw ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(
      `@ejosterberg/vendure-plugin-opensalestax: timeoutMs must be a positive number ` +
        `(got ${String(timeoutMs)})`,
    );
  }

  // Validate categoryByTaxCategoryName: every value must be a known OST category or ''.
  const rawMapping = options.categoryByTaxCategoryName ?? {};
  const invalidPairings: string[] = [];
  for (const [name, cat] of Object.entries(rawMapping)) {
    if (!VALID_CATEGORIES.has(cat)) {
      invalidPairings.push(`"${name}" => "${String(cat)}"`);
    }
  }
  if (invalidPairings.length > 0) {
    throw new Error(
      '@ejosterberg/vendure-plugin-opensalestax: invalid OST category in ' +
        `categoryByTaxCategoryName: ${invalidPairings.join(', ')}. ` +
        `Valid categories: ${formatValidCategories()}.`,
    );
  }
  const categoryByTaxCategoryName = Object.freeze({ ...rawMapping }) as Readonly<
    Record<string, OpenSalesTaxCategory>
  >;

  // Validate defaultCategory.
  const defaultCategory = options.defaultCategory ?? 'general';
  if (!VALID_CATEGORIES.has(defaultCategory)) {
    throw new Error(
      '@ejosterberg/vendure-plugin-opensalestax: invalid defaultCategory ' +
        `"${String(defaultCategory)}". Valid categories: ${formatValidCategories()}.`,
    );
  }

  // Per-state nexus filter: validate, normalize to frozen Set, enforce mutex.
  const enabledStates = normalizeStateList(options.enabledStates, 'enabledStates');
  const disabledStates = normalizeStateList(options.disabledStates, 'disabledStates');
  if (enabledStates !== null && disabledStates !== null) {
    throw new Error(
      '@ejosterberg/vendure-plugin-opensalestax: enabledStates and ' +
        'disabledStates are mutually exclusive â€” set one or the other, not both.',
    );
  }

  return Object.freeze({
    apiUrl,
    apiToken,
    failHard,
    timeoutMs,
    categoryByTaxCategoryName,
    defaultCategory,
    enabledStates,
    disabledStates,
  });
}

function parseEnvInt(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? undefined : n;
}
