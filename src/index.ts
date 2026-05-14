// SPDX-License-Identifier: Apache-2.0

/**
 * Public entry point for `@ejosterberg/vendure-plugin-opensalestax`.
 *
 * Merchants typically only need `OpenSalesTaxPlugin`:
 *
 * ```ts
 * import { OpenSalesTaxPlugin } from '@ejosterberg/vendure-plugin-opensalestax';
 * ```
 *
 * The strategy class and types are re-exported so advanced users can
 * subclass the strategy or inspect the loaded config.
 */

export { OpenSalesTaxPlugin } from './opensalestax.plugin';
export { OstaxTaxLineStrategy } from './strategies/ostax-tax-line.strategy';
export { OstaxTaxZoneStrategy } from './strategies/ostax-tax-zone.strategy';
export { loadConfig } from './lib/config';
export {
  OpenSalesTaxClient,
  OpenSalesTaxApiError,
  type OpenSalesTaxClientOptions,
  type CalculateRequest,
  type CalculateResponse,
  type CalculatedLine,
  type CalculateLineItem,
  type JurisdictionRate,
  type HealthResponse,
} from './lib/ostax-client';
export type { OpenSalesTaxPluginOptions, OpenSalesTaxCategory, LoadedConfig } from './types';
