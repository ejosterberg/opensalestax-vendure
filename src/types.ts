// SPDX-License-Identifier: Apache-2.0

/**
 * Public types for the @ejosterberg/vendure-plugin-opensalestax plugin.
 */

/**
 * Options accepted by `OpenSalesTaxPlugin.init({...})`.
 *
 * Merged with environment variables at plugin init time:
 *   - `apiUrl`     ← `OSTAX_API_URL`      (required; validated as http:/https:)
 *   - `apiToken`   ← `OSTAX_API_TOKEN`    (optional; sent as `X-API-Key`)
 *   - `failHard`   ← `OSTAX_FAIL_HARD=1`  (default `false` — fail-soft)
 *   - `timeoutMs`  ← `OSTAX_TIMEOUT_MS`   (default `5000`)
 *
 * Options passed explicitly via `init()` take priority over env vars.
 */
export interface OpenSalesTaxPluginOptions {
  /**
   * Base URL of the OpenSalesTax engine, e.g. `http://10.32.161.126:8080`.
   * Must be `http:` or `https:`. Required.
   */
  apiUrl?: string;

  /**
   * Optional API token for the engine. Sent as the `X-API-Key` header.
   * Most self-hosted deployments do not require this.
   */
  apiToken?: string;

  /**
   * When true, engine errors throw (Vendure surfaces this as an order
   * error in the admin). When false (default), engine errors return
   * an empty `TaxLine[]` and Vendure's built-in `TaxRate` pipeline
   * takes over (constitution §8 — fail-soft).
   */
  failHard?: boolean;

  /**
   * Per-request timeout in milliseconds. Default `5000`.
   */
  timeoutMs?: number;
}

/**
 * Frozen, validated configuration produced by `loadConfig()`.
 * Internal — do not depend on this shape from merchant code.
 */
export interface LoadedConfig {
  readonly apiUrl: string;
  readonly apiToken: string | undefined;
  readonly failHard: boolean;
  readonly timeoutMs: number;
}
