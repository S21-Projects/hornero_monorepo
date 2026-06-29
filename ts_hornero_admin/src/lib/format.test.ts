import { describe, it, expect } from 'vitest';
import { formatFecha } from './format';

describe('formatFecha', () => {
  it('formats a mid-year date as DD/MM/YYYY', () => {
    expect(formatFecha('2025-03-15')).toBe('15/03/2025');
  });

  it('formats New Year date without UTC off-by-one', () => {
    // new Date("2025-01-01") in UTC-3 would give 2024-12-31.
    // formatFecha must parse as local calendar date.
    expect(formatFecha('2025-01-01')).toBe('01/01/2025');
  });

  it('returns "—" for undefined', () => {
    expect(formatFecha(undefined)).toBe('—');
  });

  it('returns "—" for empty string', () => {
    expect(formatFecha('')).toBe('—');
  });

  it('pads single-digit day and month', () => {
    expect(formatFecha('2024-06-05')).toBe('05/06/2024');
  });
});
