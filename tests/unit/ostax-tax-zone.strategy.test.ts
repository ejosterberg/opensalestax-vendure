// SPDX-License-Identifier: Apache-2.0

import { Logger } from '@vendure/core';
import type { Channel, Order, RequestContext, Zone } from '@vendure/core';

import { OstaxTaxZoneStrategy } from '../../src/strategies/ostax-tax-zone.strategy';

// Minimal fixture builders — typed via `as` casts so we don't have to
// instantiate the heavy real Vendure entities for unit tests.
function buildZone(name: string, members: Array<{ type: string; code: string }>): Zone {
  return { name, members } as Partial<Zone> as Zone;
}

const US_ZONE = buildZone('US', [{ type: 'country', code: 'US' }]);
const CA_ZONE = buildZone('CA', [{ type: 'country', code: 'CA' }]);
const UK_ZONE = buildZone('UK', [{ type: 'country', code: 'GB' }]);

const DEFAULT_ZONE = buildZone('Default', [{ type: 'country', code: 'XX' }]);
const channel = { defaultTaxZone: DEFAULT_ZONE } as Partial<Channel> as Channel;

const ctx = {} as RequestContext;

function buildOrder(countryCode: string | undefined): Order {
  return {
    shippingAddress: countryCode === undefined ? {} : { countryCode },
  } as Partial<Order> as Order;
}

describe('OstaxTaxZoneStrategy', () => {
  let strategy: OstaxTaxZoneStrategy;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    strategy = new OstaxTaxZoneStrategy();
    warnSpy = jest.spyOn(Logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('US shipping address with a US zone available', () => {
    it('returns the US zone (Z3 happy path)', () => {
      const zones = [US_ZONE, CA_ZONE];
      const result = strategy.determineTaxZone(ctx, zones, channel, buildOrder('US'));
      expect(result).toBe(US_ZONE);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('finds the US zone even when it is not first', () => {
      const zones = [CA_ZONE, UK_ZONE, US_ZONE];
      const result = strategy.determineTaxZone(ctx, zones, channel, buildOrder('US'));
      expect(result).toBe(US_ZONE);
    });
  });

  describe('US shipping address with no US zone configured (Z4)', () => {
    it('returns channel.defaultTaxZone', () => {
      const zones = [CA_ZONE, UK_ZONE];
      const result = strategy.determineTaxZone(ctx, zones, channel, buildOrder('US'));
      expect(result).toBe(DEFAULT_ZONE);
    });

    it('logs a one-shot WARN and only logs once across many calls', () => {
      const zones = [CA_ZONE];
      strategy.determineTaxZone(ctx, zones, channel, buildOrder('US'));
      strategy.determineTaxZone(ctx, zones, channel, buildOrder('US'));
      strategy.determineTaxZone(ctx, [...zones], channel, buildOrder('US'));
      strategy.determineTaxZone(ctx, [], channel, buildOrder('US'));
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toMatch(/No Zone with US country member/);
    });
  });

  describe('non-US orders (Z5)', () => {
    it('returns channel.defaultTaxZone for a CA shipping country', () => {
      const zones = [US_ZONE, CA_ZONE];
      const result = strategy.determineTaxZone(ctx, zones, channel, buildOrder('CA'));
      expect(result).toBe(DEFAULT_ZONE);
    });

    it('does not log a fallback WARN for non-US orders', () => {
      const zones = [US_ZONE];
      strategy.determineTaxZone(ctx, zones, channel, buildOrder('GB'));
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('no order context (Z6)', () => {
    it('returns channel.defaultTaxZone when order is undefined', () => {
      const zones = [US_ZONE, CA_ZONE];
      const result = strategy.determineTaxZone(ctx, zones, channel);
      expect(result).toBe(DEFAULT_ZONE);
    });

    it('returns channel.defaultTaxZone when order has no shippingAddress', () => {
      const zones = [US_ZONE];
      const order = {} as Partial<Order> as Order;
      const result = strategy.determineTaxZone(ctx, zones, channel, order);
      expect(result).toBe(DEFAULT_ZONE);
    });

    it('returns channel.defaultTaxZone when shippingAddress has no countryCode', () => {
      const zones = [US_ZONE];
      const order = { shippingAddress: {} } as Partial<Order> as Order;
      const result = strategy.determineTaxZone(ctx, zones, channel, order);
      expect(result).toBe(DEFAULT_ZONE);
    });
  });

  describe('memoization (Z7)', () => {
    // Behavioral test: after the first scan, mutate the zone's members so a
    // fresh scan would NOT find a US country. With memoization in place,
    // calling again with the same zones array reference returns the cached
    // (pre-mutation) result; calling with a NEW reference re-scans and falls
    // back.
    it('reuses the cached lookup when the zones array reference is unchanged', () => {
      const mutableUsZone: Zone = {
        name: 'US',
        members: [{ type: 'country', code: 'US' }],
      } as Partial<Zone> as Zone;
      const zones = [mutableUsZone];

      const first = strategy.determineTaxZone(ctx, zones, channel, buildOrder('US'));
      expect(first).toBe(mutableUsZone);

      // Mutate the zone so a re-scan would no longer match.
      (mutableUsZone as { members: Array<{ type: string; code: string }> }).members = [
        { type: 'country', code: 'CA' },
      ];

      // Same array reference → cache hit → returns the original (cached) zone
      const second = strategy.determineTaxZone(ctx, zones, channel, buildOrder('US'));
      expect(second).toBe(mutableUsZone);
    });

    it('re-scans when given a different zones array reference', () => {
      const mutableUsZone: Zone = {
        name: 'US',
        members: [{ type: 'country', code: 'US' }],
      } as Partial<Zone> as Zone;
      const zones1 = [mutableUsZone];

      const first = strategy.determineTaxZone(ctx, zones1, channel, buildOrder('US'));
      expect(first).toBe(mutableUsZone);

      // Mutate the zone, then pass a fresh array reference.
      (mutableUsZone as { members: Array<{ type: string; code: string }> }).members = [
        { type: 'country', code: 'CA' },
      ];
      const zones2 = [mutableUsZone];

      // New array → re-scan → no US match → fallback
      const second = strategy.determineTaxZone(ctx, zones2, channel, buildOrder('US'));
      expect(second).toBe(DEFAULT_ZONE);
    });
  });

  describe('member type filter', () => {
    it('ignores province-type members even if their code is "US"', () => {
      const provinceOnlyZone = buildZone('USStates', [{ type: 'province', code: 'US' }]);
      const zones = [provinceOnlyZone];
      const result = strategy.determineTaxZone(ctx, zones, channel, buildOrder('US'));
      // No matching country-type US member → falls back
      expect(result).toBe(DEFAULT_ZONE);
    });

    it('handles a zone with empty members array without crashing', () => {
      const emptyZone = buildZone('Empty', []);
      const zones = [emptyZone, US_ZONE];
      const result = strategy.determineTaxZone(ctx, zones, channel, buildOrder('US'));
      expect(result).toBe(US_ZONE);
    });

    it('handles a zone with undefined members without crashing', () => {
      const malformedZone = { name: 'Malformed' } as Partial<Zone> as Zone;
      const zones = [malformedZone, US_ZONE];
      const result = strategy.determineTaxZone(ctx, zones, channel, buildOrder('US'));
      expect(result).toBe(US_ZONE);
    });
  });
});
