// SPDX-License-Identifier: Apache-2.0

import { loadConfig } from '../../src/lib/config';

describe('loadConfig', () => {
  const emptyEnv: NodeJS.ProcessEnv = {};

  describe('apiUrl', () => {
    it('throws when neither option nor env var is set', () => {
      expect(() => loadConfig({}, emptyEnv)).toThrow(/apiUrl is required/);
    });

    it('throws when apiUrl is empty string', () => {
      expect(() => loadConfig({ apiUrl: '' }, emptyEnv)).toThrow(/apiUrl is required/);
    });

    it('throws when apiUrl is whitespace', () => {
      expect(() => loadConfig({ apiUrl: '   ' }, emptyEnv)).toThrow(/apiUrl is required/);
    });

    it('uses options.apiUrl when set', () => {
      const cfg = loadConfig({ apiUrl: 'https://engine.example.test' }, emptyEnv);
      expect(cfg.apiUrl).toBe('https://engine.example.test');
    });

    it('falls back to OSTAX_API_URL env var', () => {
      const cfg = loadConfig({}, { OSTAX_API_URL: 'https://from-env.test' });
      expect(cfg.apiUrl).toBe('https://from-env.test');
    });

    it('options.apiUrl takes priority over env var', () => {
      const cfg = loadConfig(
        { apiUrl: 'https://from-options.test' },
        { OSTAX_API_URL: 'https://from-env.test' },
      );
      expect(cfg.apiUrl).toBe('https://from-options.test');
    });

    it('rejects malformed URLs', () => {
      expect(() => loadConfig({ apiUrl: 'not://valid url' }, emptyEnv)).toThrow(
        /not a valid URL/,
      );
    });

    it('rejects file: scheme', () => {
      expect(() => loadConfig({ apiUrl: 'file:///etc/passwd' }, emptyEnv)).toThrow(
        /scheme must be http: or https:/,
      );
    });

    it('rejects javascript: scheme', () => {
      expect(() =>
        loadConfig({ apiUrl: 'javascript:alert(1)' }, emptyEnv),
      ).toThrow();
    });

    it('accepts http: scheme (with allowance for local dev)', () => {
      const cfg = loadConfig({ apiUrl: 'http://localhost:8080' }, emptyEnv);
      expect(cfg.apiUrl).toBe('http://localhost:8080');
    });

    it('accepts https: scheme', () => {
      const cfg = loadConfig({ apiUrl: 'https://engine.prod' }, emptyEnv);
      expect(cfg.apiUrl).toBe('https://engine.prod');
    });
  });

  describe('apiToken', () => {
    it('defaults to undefined', () => {
      const cfg = loadConfig({ apiUrl: 'https://x.test' }, emptyEnv);
      expect(cfg.apiToken).toBeUndefined();
    });

    it('reads from options', () => {
      const cfg = loadConfig({ apiUrl: 'https://x.test', apiToken: 'tok' }, emptyEnv);
      expect(cfg.apiToken).toBe('tok');
    });

    it('reads from env var', () => {
      const cfg = loadConfig(
        { apiUrl: 'https://x.test' },
        { OSTAX_API_TOKEN: 'env-tok' },
      );
      expect(cfg.apiToken).toBe('env-tok');
    });

    it('treats empty-string env var as undefined', () => {
      const cfg = loadConfig(
        { apiUrl: 'https://x.test' },
        { OSTAX_API_TOKEN: '' },
      );
      expect(cfg.apiToken).toBeUndefined();
    });
  });

  describe('failHard', () => {
    it('defaults to false', () => {
      const cfg = loadConfig({ apiUrl: 'https://x.test' }, emptyEnv);
      expect(cfg.failHard).toBe(false);
    });

    it('reads true from options', () => {
      const cfg = loadConfig({ apiUrl: 'https://x.test', failHard: true }, emptyEnv);
      expect(cfg.failHard).toBe(true);
    });

    it('reads OSTAX_FAIL_HARD=1 as true', () => {
      const cfg = loadConfig(
        { apiUrl: 'https://x.test' },
        { OSTAX_FAIL_HARD: '1' },
      );
      expect(cfg.failHard).toBe(true);
    });

    it('reads OSTAX_FAIL_HARD=true as true', () => {
      const cfg = loadConfig(
        { apiUrl: 'https://x.test' },
        { OSTAX_FAIL_HARD: 'true' },
      );
      expect(cfg.failHard).toBe(true);
    });

    it('treats OSTAX_FAIL_HARD=0 as false', () => {
      const cfg = loadConfig(
        { apiUrl: 'https://x.test' },
        { OSTAX_FAIL_HARD: '0' },
      );
      expect(cfg.failHard).toBe(false);
    });

    it('options.failHard=false overrides env var', () => {
      const cfg = loadConfig(
        { apiUrl: 'https://x.test', failHard: false },
        { OSTAX_FAIL_HARD: '1' },
      );
      expect(cfg.failHard).toBe(false);
    });
  });

  describe('timeoutMs', () => {
    it('defaults to 5000', () => {
      const cfg = loadConfig({ apiUrl: 'https://x.test' }, emptyEnv);
      expect(cfg.timeoutMs).toBe(5000);
    });

    it('reads from options', () => {
      const cfg = loadConfig({ apiUrl: 'https://x.test', timeoutMs: 10000 }, emptyEnv);
      expect(cfg.timeoutMs).toBe(10000);
    });

    it('reads OSTAX_TIMEOUT_MS env var', () => {
      const cfg = loadConfig(
        { apiUrl: 'https://x.test' },
        { OSTAX_TIMEOUT_MS: '8000' },
      );
      expect(cfg.timeoutMs).toBe(8000);
    });

    it('throws on non-positive timeoutMs', () => {
      expect(() =>
        loadConfig({ apiUrl: 'https://x.test', timeoutMs: 0 }, emptyEnv),
      ).toThrow(/positive number/);
    });

    it('throws on negative timeoutMs', () => {
      expect(() =>
        loadConfig({ apiUrl: 'https://x.test', timeoutMs: -1 }, emptyEnv),
      ).toThrow(/positive number/);
    });
  });

  describe('immutability', () => {
    it('returns a frozen config object', () => {
      const cfg = loadConfig({ apiUrl: 'https://x.test' }, emptyEnv);
      expect(Object.isFrozen(cfg)).toBe(true);
    });
  });

  describe('categoryByTaxCategoryName', () => {
    it('defaults to an empty mapping when not provided', () => {
      const cfg = loadConfig({ apiUrl: 'https://x.test' }, emptyEnv);
      expect(cfg.categoryByTaxCategoryName).toEqual({});
    });

    it('accepts an empty mapping explicitly', () => {
      const cfg = loadConfig(
        { apiUrl: 'https://x.test', categoryByTaxCategoryName: {} },
        emptyEnv,
      );
      expect(cfg.categoryByTaxCategoryName).toEqual({});
    });

    it('accepts all six valid OST categories plus the empty-string skip', () => {
      const cfg = loadConfig(
        {
          apiUrl: 'https://x.test',
          categoryByTaxCategoryName: {
            A: 'general',
            B: 'clothing',
            C: 'groceries',
            D: 'prescription_drugs',
            E: 'prepared_food',
            F: 'digital_goods',
            G: '',
          },
        },
        emptyEnv,
      );
      expect(cfg.categoryByTaxCategoryName).toEqual({
        A: 'general',
        B: 'clothing',
        C: 'groceries',
        D: 'prescription_drugs',
        E: 'prepared_food',
        F: 'digital_goods',
        G: '',
      });
    });

    it('throws on an invalid OST category in the mapping', () => {
      expect(() =>
        loadConfig(
          {
            apiUrl: 'https://x.test',
            categoryByTaxCategoryName: { Standard: 'not_a_category' as never },
          },
          emptyEnv,
        ),
      ).toThrow(/invalid OST category/i);
    });

    it('error message lists every bad pairing, not just the first', () => {
      let err: unknown;
      try {
        loadConfig(
          {
            apiUrl: 'https://x.test',
            categoryByTaxCategoryName: {
              Standard: 'not_a_category' as never,
              Reduced: 'also_invalid' as never,
              Clothing: 'clothing',
            },
          },
          emptyEnv,
        );
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(Error);
      const msg = err instanceof Error ? err.message : '';
      expect(msg).toContain('Standard');
      expect(msg).toContain('Reduced');
      expect(msg).not.toContain('Clothing');
    });

    it('returns a frozen mapping (mutation throws in strict mode)', () => {
      const cfg = loadConfig(
        {
          apiUrl: 'https://x.test',
          categoryByTaxCategoryName: { Standard: 'general' },
        },
        emptyEnv,
      );
      expect(Object.isFrozen(cfg.categoryByTaxCategoryName)).toBe(true);
    });
  });

  describe('defaultCategory', () => {
    it("defaults to 'general'", () => {
      const cfg = loadConfig({ apiUrl: 'https://x.test' }, emptyEnv);
      expect(cfg.defaultCategory).toBe('general');
    });

    it('accepts any of the 7 valid values', () => {
      for (const value of [
        'general',
        'clothing',
        'groceries',
        'prescription_drugs',
        'prepared_food',
        'digital_goods',
        '',
      ] as const) {
        const cfg = loadConfig(
          { apiUrl: 'https://x.test', defaultCategory: value },
          emptyEnv,
        );
        expect(cfg.defaultCategory).toBe(value);
      }
    });

    it('throws on an invalid defaultCategory', () => {
      expect(() =>
        loadConfig(
          { apiUrl: 'https://x.test', defaultCategory: 'pizza' as never },
          emptyEnv,
        ),
      ).toThrow(/invalid defaultCategory/i);
    });
  });
});
