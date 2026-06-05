import { isAllowedPaymentUrl, tiersFromApi, addonsFromApi, fmtPerDay } from '../checkoutPolicies';

const HOSTS = ['ridefleetmanager.com', 'secure.payarc.net', 'accept.authorize.net'];

describe('isAllowedPaymentUrl', () => {
  describe('allowed', () => {
    test.each([
      ['https://ridefleetmanager.com/api/public/booking/trips/T1/payment-return'],
      ['https://secure.payarc.net/checkout'],
      ['https://accept.authorize.net/payment/payment'],
      ['https://sub.ridefleetmanager.com/anything'], // subdomain of allowed host
      ['about:blank'],
    ])('%s', (url) => {
      expect(isAllowedPaymentUrl(url, HOSTS)).toBe(true);
    });
  });

  describe('blocked', () => {
    test.each([
      ['http://ridefleetmanager.com/payment'], // not https
      ['https://evil.com/success'], // unrelated host with magic word
      ['https://ridefleetmanager.com.evil.com/x'], // lookalike suffix attack
      ['https://evilridefleetmanager.com/x'], // prefix lookalike
      ['https://notpayarc.net/x'],
      ['javascript:alert(1)'],
      ['data:text/html,<script>alert(1)</script>'],
      ['file:///etc/passwd'],
      ['not a url'],
      [''],
      [null],
      [undefined],
    ])('%s', (url) => {
      expect(isAllowedPaymentUrl(url, HOSTS)).toBe(false);
    });
  });

  test('uses the real config allowlist by default', () => {
    expect(isAllowedPaymentUrl('https://ridefleetmanager.com/x')).toBe(true);
    expect(isAllowedPaymentUrl('https://evil.com/x')).toBe(false);
  });
});

describe('fmtPerDay', () => {
  test.each([
    [0, 'Free'],
    [null, 'Free'],
    [undefined, 'Free'],
    [-5, 'Free'],
    [12, '$12/day'],
    [3.5, '$3.50/day'],
    ['22', '$22/day'],
  ])('%s → %s', (input, expected) => {
    expect(fmtPerDay(input)).toBe(expected);
  });
});

describe('tiersFromApi', () => {
  const apiTiers = {
    BASIC: { id: 'BASIC', label: 'Basic', pricePerDay: 0, deductibleReimbursementMax: 0, roadsideAssistance: false, description: 'No reimbursement.' },
    STANDARD: { id: 'STANDARD', label: 'Standard', pricePerDay: 12, deductibleReimbursementMax: 1000, roadsideAssistance: false, description: 'Up to $1,000.' },
    PREMIUM: { id: 'PREMIUM', label: 'Premium', pricePerDay: 22, deductibleReimbursementMax: 2500, roadsideAssistance: true, description: 'Up to $2,500.' },
  };

  test('maps backend shape to UI shape in fixed order', () => {
    const tiers = tiersFromApi(apiTiers);
    expect(tiers.map((t) => t.id)).toEqual(['BASIC', 'STANDARD', 'PREMIUM']);
    expect(tiers[0]).toMatchObject({ price: 'Free', deductible: 'N/A', limit: 'N/A' });
    expect(tiers[1]).toMatchObject({ price: '$12/day', deductible: 'Up to $1,000', limit: 'Host deductible', recommended: true });
    expect(tiers[2]).toMatchObject({ price: '$22/day', deductible: 'Up to $2,500', limit: 'Host deductible + roadside', recommended: false });
  });

  test('null/garbage input → null (caller keeps fallback)', () => {
    expect(tiersFromApi(null)).toBeNull();
    expect(tiersFromApi(undefined)).toBeNull();
    expect(tiersFromApi('nope')).toBeNull();
  });

  test('fewer than 2 recognized tiers → null', () => {
    expect(tiersFromApi({ BASIC: apiTiers.BASIC })).toBeNull();
    expect(tiersFromApi({ WEIRD: { id: 'WEIRD' } })).toBeNull();
  });

  test('unknown extra tiers are ignored, known ones kept', () => {
    const tiers = tiersFromApi({ ...apiTiers, PLATINUM: { id: 'PLATINUM', pricePerDay: 99 } });
    expect(tiers).toHaveLength(3);
  });
});

describe('addonsFromApi', () => {
  const apiAddons = {
    TIRE_PROTECTION: { id: 'TIRE_PROTECTION', label: 'Tire Protection', pricePerDay: 5, hostOffered: true, covers: ['Blowouts', 'Flats'] },
    TOLL_PASS: { id: 'TOLL_PASS', label: 'Toll Pass', pricePerDay: 3.5, hostOffered: true, description: 'Unlimited tolls.' },
  };

  test('maps with emoji label, price, covers list', () => {
    const addons = addonsFromApi(apiAddons);
    expect(addons).toHaveLength(2);
    expect(addons[0]).toMatchObject({ id: 'TIRE_PROTECTION', label: '🛞 Tire Protection', price: '$5/day', desc: 'Blowouts, Flats' });
    expect(addons[1]).toMatchObject({ price: '$3.50/day', desc: 'Unlimited tolls.' });
  });

  test('addons not offered by host are excluded', () => {
    const addons = addonsFromApi({ ...apiAddons, SECRET: { id: 'SECRET', pricePerDay: 1, hostOffered: false } });
    expect(addons.map((a) => a.id)).not.toContain('SECRET');
  });

  test('unknown addon id gets generic marker, not crash', () => {
    const addons = addonsFromApi({ NEW_THING: { id: 'NEW_THING', label: 'New Thing', pricePerDay: 2 } });
    expect(addons[0].label).toBe('✚ New Thing');
  });

  test('null/empty input → null', () => {
    expect(addonsFromApi(null)).toBeNull();
    expect(addonsFromApi({})).toBeNull();
  });
});
