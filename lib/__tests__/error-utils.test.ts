import { isNetworkError } from '../error-utils';

describe('error-utils', () => {
  describe('isNetworkError', () => {
    it('returns false for null or undefined', () => {
      expect(isNetworkError(null)).toBe(false);
      expect(isNetworkError(undefined)).toBe(false);
    });

    it('returns true for network error messages', () => {
      expect(isNetworkError({ message: 'Network request failed' })).toBe(true);
      expect(isNetworkError({ message: 'Failed to fetch' })).toBe(true);
      expect(isNetworkError({ message: 'Offline' })).toBe(true);
      expect(isNetworkError({ message: 'Connection timeout' })).toBe(true);
    });

    it('returns true for network error strings', () => {
      expect(isNetworkError('Network error')).toBe(true);
      expect(isNetworkError('ECONNREFUSED')).toBe(true);
      expect(isNetworkError('ENOTFOUND')).toBe(true);
    });

    it('returns false for non-network errors', () => {
      expect(isNetworkError({ message: 'Validation error' })).toBe(false);
      expect(isNetworkError({ message: 'Invalid input' })).toBe(false);
      expect(isNetworkError('Some other error')).toBe(false);
    });

    it('handles error objects with toString method', () => {
      const error = {
        toString: () => 'Network request failed',
      };
      expect(isNetworkError(error)).toBe(true);
    });
  });
});

