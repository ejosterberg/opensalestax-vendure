// SPDX-License-Identifier: Apache-2.0

import type { TaxLine } from '@vendure/common/lib/generated-types';
import {
  Logger,
  type CalculateTaxLinesArgs,
  type Injector,
  type TaxLineCalculationStrategy,
} from '@vendure/core';

import { loadConfig } from '../lib/config';
import {
  OpenSalesTaxAPIError,
  OpenSalesTaxClient,
  type Address,
  type CalculationResult,
  type LineItem,
} from '@ejosterberg/opensalestax';
import type {
  LoadedConfig,
  OpenSalesTaxCategory,
  OpenSalesTaxPluginOptions,
} from '../types';

const LOGGER_CTX = 'OpenSalesTaxPlugin';
const ZIP_REGEX = /^\d{5}(-\d{4})?$/;
const SUPPORTED_CURRENCY = 'USD';
const SUPPORTED_COUNTRY = 'US';

/**
 * Vendure `TaxLineCalculationStrategy` that routes tax calculation
 * through a self-hosted OpenSalesTax engine.
 *
 * Lifecycle:
 *   1. Vendure calls `init(injector)` once at startup. We resolve the
 *      merged plugin config + options, build the HTTP client, and run a
 *      `/v1/health` probe so engine reachability problems surface at
 *      server-start (not first-checkout time).
 *   2. Vendure calls `calculate(args)` per `OrderLine` whenever order
 *      totals are recomputed.
 *
 * Gating (constitution §5):
 *   - `ctx.currencyCode === "USD"` — else return `[]`
 *   - `order.shippingAddress.countryCode === "US"` — else return `[]`
 *   - `order.shippingAddress.postalCode` matches `^\d{5}(-\d{4})?$` —
 *     else return `[]`
 *
 * On any of these gates returning `[]`, Vendure's built-in `TaxRate`
 * pipeline takes over.
 *
 * Error handling (constitution §8):
 *   - Default fail-soft: engine errors return `[]` and log a warning
 *   - Opt-in fail-hard via `failHard: true` / `OSTAX_FAIL_HARD=1`:
 *     engine errors throw, surfacing as Vendure order errors
 */
export class OstaxTaxLineStrategy implements TaxLineCalculationStrategy {
  private config!: LoadedConfig;
  private client!: OpenSalesTaxClient;
  private readonly initialOptions: OpenSalesTaxPluginOptions | undefined;

  constructor(options?: OpenSalesTaxPluginOptions) {
    this.initialOptions = options;
  }

  async init(_injector: Injector): Promise<void> {
    this.config = loadConfig(this.initialOptions ?? {});
    const clientOptions: {
      baseUrl: string;
      timeoutMs: number;
      apiKey?: string;
      allowPrivate: boolean;
    } = {
      baseUrl: this.config.apiUrl,
      timeoutMs: this.config.timeoutMs,
      // Vendure deployments commonly run the engine on the same
      // private network. The SDK's SSRF defense is off by default
      // for this deployment shape.
      allowPrivate: true,
    };
    if (this.config.apiToken !== undefined) {
      clientOptions.apiKey = this.config.apiToken;
    }
    this.client = new OpenSalesTaxClient(clientOptions);

    if (this.config.apiUrl.startsWith('http://')) {
      Logger.warn(
        `OSTAX_API_URL is plaintext (http://). Use https:// in production.`,
        LOGGER_CTX,
      );
    }

    // healthCheck() is never-throws: returns { ok, error?, version?,
    // databaseConnected?, rttMs }. No try/catch needed.
    const health = await this.client.healthCheck();
    if (health.ok) {
      Logger.info(
        `OpenSalesTax engine reachable: version=${health.version} db=${health.databaseConnected} rtt=${health.rttMs}ms`,
        LOGGER_CTX,
      );
    } else {
      Logger.warn(
        `OpenSalesTax engine health check failed at startup: ${health.error}. ` +
          `Strategy will still register; calls will ${this.config.failHard ? 'throw' : 'fall back to []'} until engine is reachable.`,
        LOGGER_CTX,
      );
    }
  }

  async calculate(args: CalculateTaxLinesArgs): Promise<TaxLine[]> {
    const { ctx, order, orderLine } = args;

    // Gate 1: USD only
    if (ctx.currencyCode !== SUPPORTED_CURRENCY) {
      Logger.debug(
        `skip: currency=${ctx.currencyCode}`,
        LOGGER_CTX,
      );
      return [];
    }

    const address = order.shippingAddress;

    // Gate 2: US ship-to only
    if (address?.countryCode !== SUPPORTED_COUNTRY) {
      Logger.debug(`skip: country=${address?.countryCode ?? 'none'}`, LOGGER_CTX);
      return [];
    }

    // Gate 3: ZIP must be present and valid
    const postalCode = address.postalCode ?? '';
    if (!ZIP_REGEX.test(postalCode)) {
      Logger.debug(`skip: invalid_zip`, LOGGER_CTX);
      return [];
    }
    const zip5 = postalCode.slice(0, 5);

    // Gate 4: per-state nexus filter (v1.2.0). Allowlist takes precedence
    // when set; otherwise denylist; if neither, no filter (v1.1 behavior).
    const province = address.province ?? undefined;
    if (this.config.enabledStates !== null) {
      if (province === undefined || !this.config.enabledStates.has(province)) {
        Logger.debug(`skip: nexus_filter province=${province ?? 'none'}`, LOGGER_CTX);
        return [];
      }
    } else if (
      this.config.disabledStates !== null &&
      province !== undefined &&
      this.config.disabledStates.has(province)
    ) {
      Logger.debug(`skip: nexus_filter province=${province}`, LOGGER_CTX);
      return [];
    }

    // Resolve the OST category for this line. Empty string = skip.
    const category = this.resolveCategory(args);
    if (category === '') {
      Logger.debug(
        `skip: tax_category=${args.applicableTaxRate?.category?.name ?? 'unmapped'} mapped_to_skip`,
        LOGGER_CTX,
      );
      return [];
    }

    // Build a single-line OST request for this order line.
    const amountStr = centsToDecimalString(orderLine.proratedUnitPrice);
    const ostAddress: Address = { zip5 };
    const lineItems: LineItem[] = [{ amount: amountStr, category }];

    let response: CalculationResult;
    try {
      response = await this.client.calculate(ostAddress, lineItems);
    } catch (err) {
      return this.handleError(err);
    }

    const line = response.lines[0];
    if (!line || !Array.isArray(line.jurisdictions) || line.jurisdictions.length === 0) {
      Logger.debug(`engine returned no jurisdictions; returning []`, LOGGER_CTX);
      return [];
    }

    const taxLines: TaxLine[] = [];
    for (const j of line.jurisdictions) {
      const rate = Number.parseFloat(j.ratePct);
      if (!Number.isFinite(rate) || rate <= 0) continue;
      taxLines.push({
        description: formatDescription(j.type, j.name),
        taxRate: rate,
      });
    }

    return taxLines;
  }

  /**
   * Maps the order line's `applicableTaxRate.category.name` to one of
   * OST's six categories (or `''` for skip) via the
   * `categoryByTaxCategoryName` plugin option, with fallback to
   * `defaultCategory`.
   */
  private resolveCategory(args: CalculateTaxLinesArgs): OpenSalesTaxCategory {
    const name = args.applicableTaxRate?.category?.name;
    const mapped = name === undefined ? undefined : this.config.categoryByTaxCategoryName[name];
    return mapped ?? this.config.defaultCategory;
  }

  private handleError(err: unknown): TaxLine[] {
    const status = err instanceof OpenSalesTaxAPIError ? err.statusCode : undefined;
    const message = err instanceof Error ? err.message : String(err);

    if (this.config.failHard) {
      Logger.error(
        `engine error (fail-hard): status=${status ?? 'n/a'}; ${message}`,
        LOGGER_CTX,
      );
      throw err instanceof Error ? err : new Error(message);
    }

    Logger.warn(
      `engine error (fail-soft, returning []): status=${status ?? 'n/a'}; ${message}`,
      LOGGER_CTX,
    );
    return [];
  }
}

/** Cents → "X.XX" decimal string (no thousands separator, no rounding). */
function centsToDecimalString(cents: number): string {
  const safe = Number.isFinite(cents) ? Math.round(cents) : 0;
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe);
  const dollars = Math.floor(abs / 100);
  const remainder = (abs % 100).toString().padStart(2, '0');
  return `${sign}${dollars}.${remainder}`;
}

/** Build a human-readable TaxLine description from OST jurisdiction fields. */
function formatDescription(type: string, name: string): string {
  const safeName = (name ?? '').trim() || 'Sales Tax';
  const safeType = (type ?? '').trim();
  if (!safeType) return safeName;
  // Title-case the type for display, e.g. "STATE" → "State".
  const formattedType =
    safeType.charAt(0).toUpperCase() + safeType.slice(1).toLowerCase();
  return `${safeName} (${formattedType})`;
}
