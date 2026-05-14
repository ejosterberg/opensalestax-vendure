// SPDX-License-Identifier: Apache-2.0

import nock from 'nock';

import {
  OpenSalesTaxApiError,
  OpenSalesTaxClient,
  type CalculateRequest,
  type CalculateResponse,
} from '../../src/lib/ostax-client';

const BASE_URL = 'http://engine.example.test';

describe('OpenSalesTaxClient', () => {
  beforeEach(() => {
    nock.cleanAll();
    nock.disableNetConnect();
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  describe('constructor', () => {
    it('accepts http: URLs', () => {
      expect(() => new OpenSalesTaxClient({ baseUrl: 'http://x.test' })).not.toThrow();
    });

    it('accepts https: URLs', () => {
      expect(() => new OpenSalesTaxClient({ baseUrl: 'https://x.test' })).not.toThrow();
    });

    it('rejects file: URLs', () => {
      expect(() => new OpenSalesTaxClient({ baseUrl: 'file:///etc/passwd' })).toThrow(
        OpenSalesTaxApiError,
      );
    });

    it('rejects javascript: URLs', () => {
      expect(() => new OpenSalesTaxClient({ baseUrl: 'javascript:alert(1)' })).toThrow();
    });

    it('rejects unparseable URLs', () => {
      expect(() => new OpenSalesTaxClient({ baseUrl: 'not a url' })).toThrow();
    });

    it('strips trailing slashes', async () => {
      const client = new OpenSalesTaxClient({ baseUrl: `${BASE_URL}///` });
      nock(BASE_URL).get('/v1/health').reply(200, {
        status: 'ok',
        version: '0.55.4',
        database_connected: true,
      });
      await expect(client.healthCheck()).resolves.toMatchObject({ status: 'ok' });
    });
  });

  describe('healthCheck', () => {
    it('returns the engine health payload', async () => {
      nock(BASE_URL).get('/v1/health').reply(200, {
        status: 'ok',
        version: '0.55.4',
        database_connected: true,
      });

      const client = new OpenSalesTaxClient({ baseUrl: BASE_URL });
      await expect(client.healthCheck()).resolves.toEqual({
        status: 'ok',
        version: '0.55.4',
        database_connected: true,
      });
    });

    it('throws OpenSalesTaxApiError on 5xx', async () => {
      nock(BASE_URL).get('/v1/health').reply(503, 'service down');

      const client = new OpenSalesTaxClient({ baseUrl: BASE_URL });
      await expect(client.healthCheck()).rejects.toThrow(OpenSalesTaxApiError);
    });

    it('includes the status code on the thrown error', async () => {
      nock(BASE_URL).get('/v1/health').reply(500, '');

      const client = new OpenSalesTaxClient({ baseUrl: BASE_URL });
      await expect(client.healthCheck()).rejects.toMatchObject({ status: 500 });
    });
  });

  describe('calculate', () => {
    const req: CalculateRequest = {
      address: { zip5: '55403' },
      line_items: [{ amount: '100.00', category: 'general' }],
    };

    const sampleResponse: CalculateResponse = {
      subtotal: '100.00',
      tax_total: '7.875',
      lines: [
        {
          amount: '100.00',
          category: 'general',
          tax: '7.875',
          rate_pct: '7.875',
          jurisdictions: [
            { type: 'STATE', name: 'Minnesota', rate_pct: '6.875', tax: '6.875' },
            { type: 'CITY', name: 'Minneapolis', rate_pct: '0.500', tax: '0.500' },
            { type: 'TRANSIT', name: 'Hennepin County Transit', rate_pct: '0.500', tax: '0.500' },
          ],
        },
      ],
    };

    it('POSTs the request body and returns the parsed response', async () => {
      nock(BASE_URL)
        .post('/v1/calculate', (body) => {
          expect(body).toEqual(req);
          return true;
        })
        .reply(200, sampleResponse);

      const client = new OpenSalesTaxClient({ baseUrl: BASE_URL });
      const res = await client.calculate(req);
      expect(res.tax_total).toBe('7.875');
      expect(res.lines[0]?.jurisdictions).toHaveLength(3);
    });

    it('sends X-API-Key header when apiKey is set', async () => {
      nock(BASE_URL, { reqheaders: { 'X-API-Key': 'secret-token' } })
        .post('/v1/calculate')
        .reply(200, sampleResponse);

      const client = new OpenSalesTaxClient({ baseUrl: BASE_URL, apiKey: 'secret-token' });
      await expect(client.calculate(req)).resolves.toBeDefined();
    });

    it('does NOT send X-API-Key header when apiKey is empty string', async () => {
      nock(BASE_URL, {
        badheaders: ['x-api-key'],
      })
        .post('/v1/calculate')
        .reply(200, sampleResponse);

      const client = new OpenSalesTaxClient({ baseUrl: BASE_URL, apiKey: '' });
      await expect(client.calculate(req)).resolves.toBeDefined();
    });

    it('throws on network errors', async () => {
      nock(BASE_URL).post('/v1/calculate').replyWithError('ECONNREFUSED');

      const client = new OpenSalesTaxClient({ baseUrl: BASE_URL });
      await expect(client.calculate(req)).rejects.toThrow(OpenSalesTaxApiError);
    });

    it('throws on malformed JSON', async () => {
      nock(BASE_URL)
        .post('/v1/calculate')
        .reply(200, 'not json at all', { 'Content-Type': 'application/json' });

      const client = new OpenSalesTaxClient({ baseUrl: BASE_URL });
      await expect(client.calculate(req)).rejects.toThrow(OpenSalesTaxApiError);
    });
  });
});
