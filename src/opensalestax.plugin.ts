// SPDX-License-Identifier: Apache-2.0

import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { OstaxTaxLineStrategy } from './strategies/ostax-tax-line.strategy';
import type { OpenSalesTaxPluginOptions } from './types';

/**
 * Vendure plugin that routes tax calculation through a self-hosted
 * OpenSalesTax engine for destination-based US sales tax.
 *
 * @example
 * ```ts
 * import { OpenSalesTaxPlugin } from '@ejosterberg/vendure-plugin-opensalestax';
 *
 * export const config: VendureConfig = {
 *   plugins: [
 *     OpenSalesTaxPlugin.init({
 *       apiUrl: process.env.OSTAX_API_URL!,
 *       failHard: process.env.OSTAX_FAIL_HARD === '1',
 *     }),
 *   ],
 * };
 * ```
 *
 * Architecture (constitution §2 + §7):
 *   - Pure in-process: no inbound HTTP routes, no webhooks, no JWT
 *   - Outbound only: calls the merchant's OpenSalesTax engine via HTTPS
 *   - Trust boundary is the merchant's Vendure host
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [],
  configuration: (config) => {
    config.taxOptions.taxLineCalculationStrategy = new OstaxTaxLineStrategy(
      OpenSalesTaxPlugin.options,
    );
    return config;
  },
  compatibility: '^3.0.0',
})
export class OpenSalesTaxPlugin {
  // Backing field — writable only via init(). Public surface is readonly.
  private static _options: OpenSalesTaxPluginOptions = {};

  /** Options captured by the most recent `init()` call. Read-only. */
  static get options(): Readonly<OpenSalesTaxPluginOptions> {
    return OpenSalesTaxPlugin._options;
  }

  /**
   * Merchant-facing configuration entry point. Pass options here in
   * `vendure-config.ts`; environment variables fill in any blanks.
   */
  static init(options: OpenSalesTaxPluginOptions = {}): typeof OpenSalesTaxPlugin {
    OpenSalesTaxPlugin._options = options;
    return OpenSalesTaxPlugin;
  }
}
