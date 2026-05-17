// SPDX-License-Identifier: Apache-2.0 OR GPL-2.0-or-later

import { Logger } from '@vendure/core';
import type { Channel, Order, RequestContext, TaxZoneStrategy, Zone } from '@vendure/core';

const LOGGER_CTX = 'OpenSalesTaxPlugin';
const SUPPORTED_COUNTRY = 'US';

/**
 * Vendure `TaxZoneStrategy` implementation that auto-routes US shipping
 * orders to a Zone whose members include the United States as a country
 * region â€” without the merchant having to set
 * `channel.defaultTaxZone = US` manually.
 *
 * Behavior:
 * - If `order.shippingAddress.countryCode === "US"` AND a Zone exists
 *   in the merchant's data whose members include
 *   `{ type: 'country', code: 'US' }`: return that Zone.
 * - If a US ship-to order arrives but no US-containing Zone exists: log
 *   a one-shot WARN and return `channel.defaultTaxZone` (Vendure's
 *   normal behavior). Checkout still works; the merchant just gets a
 *   nudge to create a US Zone.
 * - For all other cases (no order context, non-US ship-to, etc.):
 *   return `channel.defaultTaxZone` unchanged. The plugin opts out and
 *   Vendure's default zone resolution applies.
 *
 * Performance: `determineTaxZone` is called *very* often per Vendure's
 * docs ("once per ProductVariant render, once per Order recompute").
 * We memoize the US-zone lookup against the `Zone[]` array reference
 * via a `WeakMap`. Vendure passes the same array reference within a
 * request lifecycle, collapsing per-request scans to one. When the
 * zone list is rebuilt (zone CRUD), the old array becomes
 * unreferenced and its cache entry is GCed automatically.
 */
export class OstaxTaxZoneStrategy implements TaxZoneStrategy {
  private readonly cache = new WeakMap<Zone[], Zone | null>();
  private warnedNoUsZone = false;

  determineTaxZone(
    _ctx: RequestContext,
    zones: Zone[],
    channel: Channel,
    order?: Order,
  ): Zone | undefined {
    const isUsOrder = order?.shippingAddress?.countryCode === SUPPORTED_COUNTRY;
    if (!isUsOrder) {
      return channel.defaultTaxZone;
    }

    const cached = this.cache.get(zones);
    if (cached !== undefined) {
      // cached is either null (no US zone found) or the resolved Zone.
      return cached ?? this.fallback(channel);
    }

    const found = this.findUsZone(zones);
    this.cache.set(zones, found ?? null);
    return found ?? this.fallback(channel);
  }

  private findUsZone(zones: Zone[]): Zone | undefined {
    for (const zone of zones) {
      const members = zone.members;
      if (!members) continue;
      for (const member of members) {
        if (member.type === 'country' && member.code === SUPPORTED_COUNTRY) {
          return zone;
        }
      }
    }
    return undefined;
  }

  private fallback(channel: Channel): Zone | undefined {
    if (!this.warnedNoUsZone) {
      Logger.warn(
        'No Zone with US country member found. Falling back to ' +
          'channel.defaultTaxZone. Create a Zone containing the United States ' +
          'in Settings -> Zones to silence this warning and ensure US orders ' +
          'are zoned correctly.',
        LOGGER_CTX,
      );
      this.warnedNoUsZone = true;
    }
    return channel.defaultTaxZone;
  }
}
