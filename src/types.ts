// SPDX-License-Identifier: Apache-2.0 OR GPL-2.0-or-later

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
 *   - `apiUrl`     â† `OSTAX_API_URL`      (required; validated as http:/https:)
 *   - `apiToken`   â† `OSTAX_API_TOKEN`    (optional; sent as `X-API-Key`)
 *   - `failHard`   â† `OSTAX_FAIL_HARD=1`  (default `false` â€” fail-soft)
 *   - `timeoutMs`  â† `OSTAX_TIMEOUT_MS`   (default `5000`)
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
   * takes over (constitution Â§8 â€” fail-soft).
   */
  failHard?: boolean;

  /**
   * Per-request timeout in milliseconds. Default `5000`.
   */
  timeoutMs?: number;

  /**
   * Maps Vendure `TaxCategory.name` â†’ OST category. The strategy
   * reads `args.applicableTaxRate.category.name` at calculation time
   * and looks it up here. Unmapped names fall back to
   * `defaultCategory`, then to `'general'`.
   *
   * Mapping a name to `''` (empty string) makes the strategy return
   * `[]` for that line â€” non-taxable, OST is not called.
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

  /**
   * Allowlist of US state codes (ISO 3166-2 subdivision codes,
   * uppercase 2-letter â€” e.g. 'MN', 'WI'). When set, the plugin
   * computes tax only for orders shipping to one of these states;
   * orders to other states return `[]` so Vendure's default
   * `TaxRate` pipeline takes over.
   *
   * Mutually exclusive with `disabledStates` â€” setting both throws
   * at plugin init.
   *
   * Empty array is treated as `undefined` (no filter) â€” footgun
   * mitigation. To disable the plugin for everyone, remove it
   * from your `plugins` array instead.
   *
   * @example
   * enabledStates: ['MN', 'WI', 'IA']  // collect only in those 3 states
   */
  enabledStates?: string[];

  /**
   * Denylist of US state codes (same format as `enabledStates`).
   * When set, the plugin returns `[]` for orders shipping to one
   * of these states; orders elsewhere compute as normal.
   *
   * Mutually exclusive with `enabledStates`.
   *
   * @example
   * disabledStates: ['MT', 'WY']  // skip these two; collect everywhere else
   */
  disabledStates?: string[];
}

/**
 * Frozen, validated configuration produced by `loadConfig()`.
 * Internal â€” do not depend on this shape from merchant code.
 */
export interface LoadedConfig {
  readonly apiUrl: string;
  readonly apiToken: string | undefined;
  readonly failHard: boolean;
  readonly timeoutMs: number;
  readonly categoryByTaxCategoryName: Readonly<Record<string, OpenSalesTaxCategory>>;
  readonly defaultCategory: OpenSalesTaxCategory;
  /** `null` = no filter; non-null Set = allowlist of US state codes. */
  readonly enabledStates: ReadonlySet<string> | null;
  /** `null` = no filter; non-null Set = denylist of US state codes. */
  readonly disabledStates: ReadonlySet<string> | null;
}
