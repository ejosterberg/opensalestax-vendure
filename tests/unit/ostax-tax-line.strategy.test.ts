// SPDX-License-Identifier: Apache-2.0 OR GPL-2.0-or-later

import nock from 'nock';
import type {
  CalculateTaxLinesArgs,
  Injector,
  Order,
  OrderLine,
  RequestContext,
  TaxRate,
} from '@vendure/core';

import { OstaxTaxLineStrategy } from '../../src/strategies/ostax-tax-line.strategy';

const BASE_URL = 'http://strategy-engine.example.test';

function buildArgs(overrides: {
  currencyCode?: string;
  countryCode?: string | undefined;
  postalCode?: string | undefined;
  province?: string | undefined;
  proratedUnitPrice?: number;
  taxCategoryName?: string;
}): CalculateTaxLinesArgs {
  const ctx = { currencyCode: overrides.currencyCode ?? 'USD' } as Partial<RequestContext> as RequestContext;

  const order = {
    shippingAddress: {
      countryCode: overrides.countryCode,
      postalCode: overrides.postalCode,
      province: overrides.province,
    },
  } as Partial<Order> as Order;

  const orderLine = {
    proratedUnitPrice: overrides.proratedUnitPrice ?? 10000,
  } as Partial<OrderLine> as OrderLine;

  const applicableTaxRate = {
    value: 0,
    name: 'Placeholder',
    ...(overrides.taxCategoryName !== undefined
      ? { category: { name: overrides.taxCategoryName } }
      : {}),
  } as Partial<TaxRate> as TaxRate;

  return { ctx, order, orderLine, applicableTaxRate };
}

const fakeInjector = {} as Injector;

function sampleEngineResponse(jurisdictions: Array<{ type: string; name: string; rate_pct: string }>) {
  return {
    subtotal: '100.00',
    tax_total: '0',
    lines: [
      {
        amount: '100.00',
        category: 'general',
        tax: '0',
        rate_pct: '0',
        jurisdictions: jurisdictions.map((j) => ({ ...j, tax: '0' })),
        note: null,
      },
    ],
    disclaimer: 'Calculation only; not legal or tax advice.',
  };
}

describe('OstaxTaxLineStrategy', () => {
  beforeEach(() => {
    nock.cleanAll();
    nock.disableNetConnect();
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  async function makeStrategy(opts: {
    failHard?: boolean;
    categoryByTaxCategoryName?: Record<string, string>;
    defaultCategory?: string;
    enabledStates?: string[];
    disabledStates?: string[];
  } = {}) {
    // The init() probe will hit /v1/health â€” answer it so init succeeds.
    nock(BASE_URL).get('/v1/health').reply(200, {
      status: 'ok',
      version: '0.55.4',
      database_connected: true,
    });

    const strategy = new OstaxTaxLineStrategy({
      apiUrl: BASE_URL,
      failHard: opts.failHard ?? false,
      ...(opts.categoryByTaxCategoryName
        ? { categoryByTaxCategoryName: opts.categoryByTaxCategoryName as Record<string, never> }
        : {}),
      ...(opts.defaultCategory !== undefined
        ? { defaultCategory: opts.defaultCategory as never }
        : {}),
      ...(opts.enabledStates !== undefined ? { enabledStates: opts.enabledStates } : {}),
      ...(opts.disabledStates !== undefined ? { disabledStates: opts.disabledStates } : {}),
    });
    await strategy.init(fakeInjector);
    return strategy;
  }

  describe('gating', () => {
    it('returns [] for non-USD orders', async () => {
      const strategy = await makeStrategy();
      const lines = await strategy.calculate(
        buildArgs({ currencyCode: 'EUR', countryCode: 'US', postalCode: '55403' }),
      );
      expect(lines).toEqual([]);
    });

    it('returns [] for non-US shipping country', async () => {
      const strategy = await makeStrategy();
      const lines = await strategy.calculate(
        buildArgs({ currencyCode: 'USD', countryCode: 'CA', postalCode: 'M5V 3A8' }),
      );
      expect(lines).toEqual([]);
    });

    it('returns [] when shippingAddress is missing countryCode', async () => {
      const strategy = await makeStrategy();
      const lines = await strategy.calculate(
        buildArgs({ currencyCode: 'USD', countryCode: undefined, postalCode: '55403' }),
      );
      expect(lines).toEqual([]);
    });

    it('returns [] when ZIP is missing', async () => {
      const strategy = await makeStrategy();
      const lines = await strategy.calculate(
        buildArgs({ currencyCode: 'USD', countryCode: 'US', postalCode: undefined }),
      );
      expect(lines).toEqual([]);
    });

    it('returns [] when ZIP is malformed', async () => {
      const strategy = await makeStrategy();
      const lines = await strategy.calculate(
        buildArgs({ currencyCode: 'USD', countryCode: 'US', postalCode: 'ABCDE' }),
      );
      expect(lines).toEqual([]);
    });

    it('accepts ZIP+4 format (uses leading 5)', async () => {
      const strategy = await makeStrategy();
      nock(BASE_URL)
        .post('/v1/calculate', (body) => body.address.zip5 === '55403')
        .reply(200, sampleEngineResponse([{ type: 'STATE', name: 'Minnesota', rate_pct: '6.875' }]));

      const lines = await strategy.calculate(
        buildArgs({ currencyCode: 'USD', countryCode: 'US', postalCode: '55403-1234' }),
      );
      expect(lines).toHaveLength(1);
      expect(lines[0]?.taxRate).toBe(6.875);
    });
  });

  describe('happy path', () => {
    it('calls OST and maps jurisdictions to TaxLine[]', async () => {
      const strategy = await makeStrategy();
      nock(BASE_URL)
        .post('/v1/calculate', (body) => {
          expect(body).toEqual({
            address: { zip5: '55403' },
            line_items: [{ amount: '100.00', category: 'general' }],
          });
          return true;
        })
        .reply(
          200,
          sampleEngineResponse([
            { type: 'STATE', name: 'Minnesota', rate_pct: '6.875' },
            { type: 'CITY', name: 'Minneapolis', rate_pct: '0.500' },
            { type: 'TRANSIT', name: 'Hennepin Transit', rate_pct: '0.500' },
          ]),
        );

      const lines = await strategy.calculate(
        buildArgs({
          currencyCode: 'USD',
          countryCode: 'US',
          postalCode: '55403',
          proratedUnitPrice: 10000,
        }),
      );

      expect(lines).toHaveLength(3);
      expect(lines.map((l) => l.taxRate).reduce((a, b) => a + b, 0)).toBeCloseTo(7.875, 4);
      expect(lines[0]?.description).toContain('Minnesota');
      expect(lines[1]?.description).toContain('Minneapolis');
    });

    it('returns [] when engine returns no jurisdictions', async () => {
      const strategy = await makeStrategy();
      nock(BASE_URL).post('/v1/calculate').reply(200, sampleEngineResponse([]));

      const lines = await strategy.calculate(
        buildArgs({ currencyCode: 'USD', countryCode: 'US', postalCode: '55403' }),
      );
      expect(lines).toEqual([]);
    });

    it('skips jurisdictions with non-positive rates', async () => {
      const strategy = await makeStrategy();
      nock(BASE_URL)
        .post('/v1/calculate')
        .reply(
          200,
          sampleEngineResponse([
            { type: 'STATE', name: 'Oregon', rate_pct: '0' },
            { type: 'STATE', name: 'Minnesota', rate_pct: '6.875' },
          ]),
        );

      const lines = await strategy.calculate(
        buildArgs({ currencyCode: 'USD', countryCode: 'US', postalCode: '55403' }),
      );
      expect(lines).toHaveLength(1);
      expect(lines[0]?.description).toContain('Minnesota');
    });

    it('formats ProRated amount in dollars (cents â†’ "X.XX")', async () => {
      const strategy = await makeStrategy();
      nock(BASE_URL)
        .post('/v1/calculate', (body) => {
          expect(body.line_items[0].amount).toBe('12.34');
          return true;
        })
        .reply(200, sampleEngineResponse([]));

      await strategy.calculate(
        buildArgs({
          currencyCode: 'USD',
          countryCode: 'US',
          postalCode: '55403',
          proratedUnitPrice: 1234,
        }),
      );
    });

    it('handles single-digit cents correctly (5 cents â†’ "0.05")', async () => {
      const strategy = await makeStrategy();
      nock(BASE_URL)
        .post('/v1/calculate', (body) => {
          expect(body.line_items[0].amount).toBe('0.05');
          return true;
        })
        .reply(200, sampleEngineResponse([]));

      await strategy.calculate(
        buildArgs({
          currencyCode: 'USD',
          countryCode: 'US',
          postalCode: '55403',
          proratedUnitPrice: 5,
        }),
      );
    });
  });

  describe('error handling', () => {
    it('fail-soft (default): returns [] on engine 5xx', async () => {
      const strategy = await makeStrategy({ failHard: false });
      nock(BASE_URL).post('/v1/calculate').reply(503, 'down');

      const lines = await strategy.calculate(
        buildArgs({ currencyCode: 'USD', countryCode: 'US', postalCode: '55403' }),
      );
      expect(lines).toEqual([]);
    });

    it('fail-soft: returns [] on network error', async () => {
      const strategy = await makeStrategy({ failHard: false });
      nock(BASE_URL).post('/v1/calculate').replyWithError('ECONNREFUSED');

      const lines = await strategy.calculate(
        buildArgs({ currencyCode: 'USD', countryCode: 'US', postalCode: '55403' }),
      );
      expect(lines).toEqual([]);
    });

    it('fail-hard: throws on engine 5xx', async () => {
      const strategy = await makeStrategy({ failHard: true });
      nock(BASE_URL).post('/v1/calculate').reply(500, '');

      await expect(
        strategy.calculate(
          buildArgs({ currencyCode: 'USD', countryCode: 'US', postalCode: '55403' }),
        ),
      ).rejects.toThrow();
    });

    it('fail-hard: throws on network error', async () => {
      const strategy = await makeStrategy({ failHard: true });
      nock(BASE_URL).post('/v1/calculate').replyWithError('boom');

      await expect(
        strategy.calculate(
          buildArgs({ currencyCode: 'USD', countryCode: 'US', postalCode: '55403' }),
        ),
      ).rejects.toThrow();
    });
  });

  describe('category mapping (phase 03)', () => {
    it('uses the mapped OST category when TaxCategory name matches', async () => {
      const strategy = await makeStrategy({
        categoryByTaxCategoryName: { Clothing: 'clothing' },
      });
      nock(BASE_URL)
        .post('/v1/calculate', (body) => {
          expect(body.line_items[0].category).toBe('clothing');
          return true;
        })
        .reply(200, sampleEngineResponse([{ type: 'STATE', name: 'Minnesota', rate_pct: '6.875' }]));

      const lines = await strategy.calculate(
        buildArgs({
          currencyCode: 'USD',
          countryCode: 'US',
          postalCode: '55403',
          taxCategoryName: 'Clothing',
        }),
      );
      expect(lines).toHaveLength(1);
    });

    it('falls back to defaultCategory when TaxCategory name does not match the mapping', async () => {
      const strategy = await makeStrategy({
        categoryByTaxCategoryName: { Clothing: 'clothing' },
        defaultCategory: 'general',
      });
      nock(BASE_URL)
        .post('/v1/calculate', (body) => {
          expect(body.line_items[0].category).toBe('general');
          return true;
        })
        .reply(200, sampleEngineResponse([{ type: 'STATE', name: 'Minnesota', rate_pct: '6.875' }]));

      await strategy.calculate(
        buildArgs({
          currencyCode: 'USD',
          countryCode: 'US',
          postalCode: '55403',
          taxCategoryName: 'Standard',
        }),
      );
    });

    it("uses 'general' when no mapping and no defaultCategory are provided (preserves v1.0 behavior)", async () => {
      const strategy = await makeStrategy();
      nock(BASE_URL)
        .post('/v1/calculate', (body) => {
          expect(body.line_items[0].category).toBe('general');
          return true;
        })
        .reply(200, sampleEngineResponse([{ type: 'STATE', name: 'Minnesota', rate_pct: '6.875' }]));

      await strategy.calculate(
        buildArgs({ currencyCode: 'USD', countryCode: 'US', postalCode: '55403' }),
      );
    });

    it("returns [] without calling the engine when mapped category is '' (skip-line)", async () => {
      const strategy = await makeStrategy({
        categoryByTaxCategoryName: { 'Gift Cards': '' },
      });
      // No nock interceptor for /v1/calculate â€” if the engine is called, the
      // request will fail with an unmatched-request error and the test fails.
      const lines = await strategy.calculate(
        buildArgs({
          currencyCode: 'USD',
          countryCode: 'US',
          postalCode: '55403',
          taxCategoryName: 'Gift Cards',
        }),
      );
      expect(lines).toEqual([]);
    });

    it("returns [] without calling the engine when defaultCategory is '' and no mapping match", async () => {
      const strategy = await makeStrategy({ defaultCategory: '' });
      const lines = await strategy.calculate(
        buildArgs({
          currencyCode: 'USD',
          countryCode: 'US',
          postalCode: '55403',
          taxCategoryName: 'Anything',
        }),
      );
      expect(lines).toEqual([]);
    });
  });

  describe('nexus filter (phase 04)', () => {
    it('enabledStates includes ship-to: engine called', async () => {
      const strategy = await makeStrategy({ enabledStates: ['MN', 'WI'] });
      nock(BASE_URL)
        .post('/v1/calculate')
        .reply(200, sampleEngineResponse([{ type: 'STATE', name: 'Minnesota', rate_pct: '6.875' }]));
      const lines = await strategy.calculate(
        buildArgs({
          currencyCode: 'USD',
          countryCode: 'US',
          postalCode: '55403',
          province: 'MN',
        }),
      );
      expect(lines).toHaveLength(1);
    });

    it('enabledStates does NOT include ship-to: returns [] without engine call', async () => {
      const strategy = await makeStrategy({ enabledStates: ['MN', 'WI'] });
      // No nock interceptor â€” if engine called, the test fails with unmatched request
      const lines = await strategy.calculate(
        buildArgs({
          currencyCode: 'USD',
          countryCode: 'US',
          postalCode: '90210',
          province: 'CA',
        }),
      );
      expect(lines).toEqual([]);
    });

    it('enabledStates set + ship-to has no province: returns [] (conservative)', async () => {
      const strategy = await makeStrategy({ enabledStates: ['MN'] });
      const lines = await strategy.calculate(
        buildArgs({
          currencyCode: 'USD',
          countryCode: 'US',
          postalCode: '55403',
          province: undefined,
        }),
      );
      expect(lines).toEqual([]);
    });

    it('disabledStates includes ship-to: returns [] without engine call', async () => {
      const strategy = await makeStrategy({ disabledStates: ['CA', 'NY'] });
      const lines = await strategy.calculate(
        buildArgs({
          currencyCode: 'USD',
          countryCode: 'US',
          postalCode: '90210',
          province: 'CA',
        }),
      );
      expect(lines).toEqual([]);
    });

    it('disabledStates does NOT include ship-to: engine called', async () => {
      const strategy = await makeStrategy({ disabledStates: ['CA', 'NY'] });
      nock(BASE_URL)
        .post('/v1/calculate')
        .reply(200, sampleEngineResponse([{ type: 'STATE', name: 'Minnesota', rate_pct: '6.875' }]));
      const lines = await strategy.calculate(
        buildArgs({
          currencyCode: 'USD',
          countryCode: 'US',
          postalCode: '55403',
          province: 'MN',
        }),
      );
      expect(lines).toHaveLength(1);
    });

    it('disabledStates set + no province: engine called (denylist does not catch unknown)', async () => {
      const strategy = await makeStrategy({ disabledStates: ['CA'] });
      nock(BASE_URL)
        .post('/v1/calculate')
        .reply(200, sampleEngineResponse([{ type: 'STATE', name: 'Minnesota', rate_pct: '6.875' }]));
      const lines = await strategy.calculate(
        buildArgs({
          currencyCode: 'USD',
          countryCode: 'US',
          postalCode: '55403',
          province: undefined,
        }),
      );
      expect(lines).toHaveLength(1);
    });

    it('neither option set: engine called for any US ship-to (preserves v1.1)', async () => {
      const strategy = await makeStrategy();
      nock(BASE_URL)
        .post('/v1/calculate')
        .reply(200, sampleEngineResponse([{ type: 'STATE', name: 'Texas', rate_pct: '6.25' }]));
      const lines = await strategy.calculate(
        buildArgs({
          currencyCode: 'USD',
          countryCode: 'US',
          postalCode: '78701',
          province: 'TX',
        }),
      );
      expect(lines).toHaveLength(1);
    });
  });

  describe('init() health check', () => {
    it('does not throw when engine health probe fails', async () => {
      // Health probe returns 503; strategy should still initialize
      nock(BASE_URL).get('/v1/health').reply(503, '');

      const strategy = new OstaxTaxLineStrategy({
        apiUrl: BASE_URL,
        failHard: false,
      });
      await expect(strategy.init(fakeInjector)).resolves.toBeUndefined();
    });

    it('throws at init when apiUrl is invalid', async () => {
      const strategy = new OstaxTaxLineStrategy({ apiUrl: 'file:///etc/passwd' });
      await expect(strategy.init(fakeInjector)).rejects.toThrow();
    });
  });
});
