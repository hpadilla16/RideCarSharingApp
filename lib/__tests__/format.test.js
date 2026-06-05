import { fmtMoney, fmtDate, vehicleLabel, locationLabel } from '../format';

describe('fmtMoney', () => {
  test('formats numbers as USD', () => {
    expect(fmtMoney(45)).toBe('$45.00');
    expect(fmtMoney(1234.5)).toBe('$1,234.50');
  });
  test('handles null/undefined/strings', () => {
    expect(fmtMoney(null)).toBe('$0.00');
    expect(fmtMoney(undefined)).toBe('$0.00');
    expect(fmtMoney('12.3')).toBe('$12.30');
  });
});

describe('fmtDate', () => {
  test('empty → empty string', () => {
    expect(fmtDate('')).toBe('');
    expect(fmtDate(null)).toBe('');
  });
  test('formats ISO date', () => {
    expect(fmtDate('2026-06-04T12:00:00Z')).toMatch(/Jun \d{1,2}, 2026/);
  });
});

describe('vehicleLabel', () => {
  test('builds label from vehicle fields', () => {
    expect(vehicleLabel({ vehicle: { year: 2024, make: 'Toyota', model: 'RAV4' } })).toBe('2024 Toyota RAV4');
  });
  test('skips missing fields', () => {
    expect(vehicleLabel({ vehicle: { make: 'Tesla', model: 'Model 3' } })).toBe('Tesla Model 3');
  });
  test('falls back to title then generic', () => {
    expect(vehicleLabel({ title: 'My Car' })).toBe('My Car');
    expect(vehicleLabel(null)).toBe('Vehicle');
  });
});

describe('locationLabel', () => {
  test('joins parts with pipe', () => {
    expect(locationLabel({ name: 'SJU Airport', city: 'Carolina', state: 'PR' })).toBe('SJU Airport | Carolina | PR');
  });
  test('empty for null', () => {
    expect(locationLabel(null)).toBe('');
  });
});
