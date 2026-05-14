// SPDX-License-Identifier: Apache-2.0

/**
 * Integration test for OpenSalesTaxPlugin.
 *
 * Boots a real Vendure server via @vendure/testing's in-memory sqljs DB,
 * loads the plugin, and asserts:
 *   - Vendure starts cleanly (no peer-dep crashes / decorator errors)
 *   - The plugin registers our strategy as the active
 *     `taxLineCalculationStrategy` on `config.taxOptions`
 *
 * The full order-flow assertion (place a MN order, see nonzero tax) is
 * exercised by the stage-05 demo deployment against a real Vendure dev
 * server. Keeping this integration spec minimal keeps the unit-test
 * loop fast (sqljs init alone is ~10 seconds).
 */

import nock from 'nock';
import { ConfigService, LanguageCode, mergeConfig } from '@vendure/core';
import type { InitialData } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import * as path from 'node:path';

import { OpenSalesTaxPlugin } from '../../src';
import { OstaxTaxLineStrategy } from '../../src/strategies/ostax-tax-line.strategy';
import { OstaxTaxZoneStrategy } from '../../src/strategies/ostax-tax-zone.strategy';

const minimalInitialData: InitialData = {
  defaultLanguage: LanguageCode.en,
  defaultZone: 'Americas',
  countries: [
    { name: 'United States of America', code: 'US', zone: 'Americas' },
  ],
  taxRates: [{ name: 'Standard Tax', percentage: 0 }],
  shippingMethods: [{ name: 'Standard Shipping', price: 500 }],
  paymentMethods: [],
  collections: [],
};

const ENGINE_URL = 'http://integration-engine.example.test';

registerInitializer(
  'sqljs',
  new SqljsInitializer(path.join(__dirname, '..', '..', '__data__')),
);

describe('OpenSalesTaxPlugin (integration)', () => {
  // The init() probe will hit /v1/health — answer it indefinitely.
  beforeAll(() => {
    nock.disableNetConnect();
    // Allow connections to localhost so the test server can talk to itself.
    nock.enableNetConnect((host) => host.includes('127.0.0.1') || host.includes('localhost'));
    nock(ENGINE_URL)
      .persist()
      .get('/v1/health')
      .reply(200, { status: 'ok', version: '0.55.4', database_connected: true });
  });

  afterAll(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  const config = mergeConfig(testConfig, {
    plugins: [
      OpenSalesTaxPlugin.init({
        apiUrl: ENGINE_URL,
        failHard: false,
      }),
    ],
  });

  const { server } = createTestEnvironment(config);

  beforeAll(async () => {
    await server.init({
      initialData: minimalInitialData,
      customerCount: 0,
    });
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  }, 60_000);

  it('boots Vendure cleanly with the plugin loaded', () => {
    expect(server.app).toBeDefined();
  });

  it('registers OstaxTaxLineStrategy as the active taxLineCalculationStrategy', () => {
    const configService = server.app.get(ConfigService);
    const strategy = configService.taxOptions.taxLineCalculationStrategy;
    expect(strategy).toBeInstanceOf(OstaxTaxLineStrategy);
  });

  it('registers OstaxTaxZoneStrategy as the active taxZoneStrategy', () => {
    const configService = server.app.get(ConfigService);
    const strategy = configService.taxOptions.taxZoneStrategy;
    expect(strategy).toBeInstanceOf(OstaxTaxZoneStrategy);
  });
});
