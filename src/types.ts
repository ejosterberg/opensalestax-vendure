// SPDX-License-Identifier: Apache-2.0

/**
 * Public types for the @ejosterberg/vendure-plugin-opensalestax plugin.
 */

/**
 * The OST engine's six accepted tax categories, plus `''` meaning
 * "skip this line" (non-taxable). Used by `categoryByTaxCategoryName`
 * and `defaultCategory` plugin options.
 */
export type OpenSalesTaxCategory =
  | 'general'
  | 'clothing'
  | 'groceries'
  | 'prescription_drugs'
  | 'prepared_food'
  | 'digital_goods'
  | '';

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

  /**
   * Maps Vendure `TaxCategory.name` → OST category. The strategy
   * reads `args.applicableTaxRate.category.name` at calculation time
   * and looks it up here. Unmapped names fall back to
   * `defaultCategory`, then to `'general'`.
   *
   * Mapping a name to `''` (empty string) makes the strategy return
   * `[]` for that line — non-taxable, OST is not called.
   *
   * @example
   * categoryByTaxCategoryName: {
   *   'Clothing':       'clothing',
   *   'Food':           'groceries',
   *   'Digital Goods':  'digital_goods',
   *   'Gift Cards':     '',  // non-taxable
   * }
   */
  categoryByTaxCategoryName?: Record<string, OpenSalesTaxCategory>;

  /**
   * OST category sent for lines whose `TaxCategory.name` doesn't match
   * any entry in `categoryByTaxCategoryName` (or that have no
   * resolvable TaxCategory). Default `'general'`. Set to `''` to
   * make all unmapped lines non-taxable by default.
   */
  defaultCategory?: OpenSalesTaxCategory;
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
  readonly categoryByTaxCategoryName: Readonly<Record<string, OpenSalesTaxCategory>>;
  readonly defaultCategory: OpenSalesTaxCategory;
}
