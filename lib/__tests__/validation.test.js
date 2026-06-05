import { isValidEmail, isValidPhone, validateCustomerInfo } from '../validation';

describe('isValidEmail', () => {
  test.each([
    ['hector@example.com', true],
    ['h.p+ride@sub.domain.co', true],
    ['no-at-sign', false],
    ['two@@example.com', false],
    ['spaces in@example.com', false],
    ['@example.com', false],
    ['user@domain', false], // no TLD
    ['', false],
    [null, false],
  ])('%s → %s', (input, expected) => {
    expect(isValidEmail(input)).toBe(expected);
  });
});

describe('isValidPhone', () => {
  test.each([
    ['7875551234', true],
    ['(787) 555-1234', true],
    ['+1 787 555 1234', true],
    ['555-1234', true],
    ['12345', false], // too short
    ['call me maybe', false],
    ['', false],
    [null, false],
  ])('%s → %s', (input, expected) => {
    expect(isValidPhone(input)).toBe(expected);
  });
});

describe('validateCustomerInfo', () => {
  const valid = { firstName: 'Hector', lastName: 'Padilla', email: 'h@example.com', phone: '7875551234' };

  test('valid customer → empty string', () => {
    expect(validateCustomerInfo(valid)).toBe('');
  });

  test('missing field → fill all fields', () => {
    expect(validateCustomerInfo({ ...valid, firstName: ' ' })).toBe('Please fill all fields');
  });

  test('bad email → email message', () => {
    expect(validateCustomerInfo({ ...valid, email: 'nope' })).toBe('Please enter a valid email address');
  });

  test('bad phone → phone message', () => {
    expect(validateCustomerInfo({ ...valid, phone: 'abc' })).toBe('Please enter a valid phone number');
  });

  test('no argument → fill all fields', () => {
    expect(validateCustomerInfo()).toBe('Please fill all fields');
  });
});
