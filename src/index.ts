// SPDX-License-Identifier: Apache-2.0 OR GPL-2.0-or-later

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
// Re-export the SDK's public surface so downstream consumers can pull
// types from this plugin without taking an explicit
// `@ejosterberg/opensalestax` dep. Names mirror the SDK as of v0.1.0;
// the old `CalculateRequest` / `CalculateResponse` / `CalculateLineItem`
// names are replaced by SDK equivalents.
export {
  OpenSalesTaxClient,
  OpenSalesTaxAPIError,
  type OpenSalesTaxClientOptions,
  type Address,
  type LineItem,
  type CalculationResult,
  type CalculatedLine,
  type JurisdictionRate,
  type HealthResponse,
} from '@ejosterberg/opensalestax';
export type { OpenSalesTaxPluginOptions, OpenSalesTaxCategory, LoadedConfig } from './types';
