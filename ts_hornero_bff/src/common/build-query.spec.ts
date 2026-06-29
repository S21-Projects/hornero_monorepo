import { buildQuery } from './build-query';

describe('buildQuery', () => {
  it('returns empty string when all params are undefined', () => {
    expect(buildQuery({ page: undefined, size: undefined, sort: undefined })).toBe('');
  });

  it('returns empty string when all params are empty strings', () => {
    expect(buildQuery({ page: '', size: '' })).toBe('');
  });

  it('returns empty string when called with an empty object', () => {
    expect(buildQuery({})).toBe('');
  });

  it('includes all defined params with correct key names', () => {
    const result = buildQuery({ page: '0', size: '20', sort: 'id,asc' });
    expect(result).toBe('?page=0&size=20&sort=id%2Casc');
  });

  it('omits undefined values and includes only defined ones', () => {
    const result = buildQuery({ page: '1', size: undefined, sort: 'id,asc' });
    expect(result).toBe('?page=1&sort=id%2Casc');
  });

  it('omits empty-string values and includes only non-empty ones', () => {
    const result = buildQuery({ page: '0', size: '', sort: 'nombre,desc' });
    expect(result).toBe('?page=0&sort=nombre%2Cdesc');
  });

  it('preserves exact param names (e.g. organizacionId)', () => {
    const result = buildQuery({ organizacionId: '5' });
    expect(result).toBe('?organizacionId=5');
  });

  it('encodes comma in sort value (URLSearchParams percent-encodes reserved chars)', () => {
    const result = buildQuery({ sort: 'id,asc' });
    expect(result).toBe('?sort=id%2Casc');
  });

  it('encodes injection attempt: & and = in value cannot add extra params', () => {
    const result = buildQuery({ sort: 'id&organizacionId=999' });
    expect(result).toBe('?sort=id%26organizacionId%3D999');
    expect(result).not.toContain('organizacionId=999');
  });
});
