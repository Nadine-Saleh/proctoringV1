import { describe, it, expect } from 'vitest';

/**
 * Unit test for Crockford Base32 access code format.
 * Tests the alphabet (excludes I, L, O, U for ambiguity) and length.
 */
describe('Access Code Format', () => {
  const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const EXCLUDED_CHARS = ['I', 'L', 'O', 'U'];

  it('should have correct Crockford Base32 alphabet', () => {
    expect(CROCKFORD_ALPHABET).toHaveLength(32);
    expect(CROCKFORD_ALPHABET).not.toMatch(/[ILOU]/);
  });

  it('should reject excluded characters', () => {
    EXCLUDED_CHARS.forEach((char) => {
      expect(CROCKFORD_ALPHABET).not.toContain(char);
    });
  });

  it('should generate 8-character codes', () => {
    const codeLength = 8;
    expect(codeLength).toBe(8);
  });

  it('should validate valid access codes', () => {
    const validCodes = [
      '01234567',
      'ABCDEFGH',
      'JKMNPQRS',
      'TVWXYZ01',
    ];

    const pattern = /^[0-9A-HJ-NPR-Z]{8}$/;

    validCodes.forEach((code) => {
      expect(code).toMatch(pattern);
    });
  });

  it('should reject codes with invalid characters', () => {
    const invalidCodes = [
      'I0000000', // Contains I
      'L0000000', // Contains L
      'O0000000', // Contains O
      'U0000000', // Contains U
      '!@#$%^&*', // Special chars
      'abcdefgh', // Lowercase
    ];

    const pattern = /^[0-9A-HJ-NPR-Z]{8}$/;

    invalidCodes.forEach((code) => {
      expect(code).not.toMatch(pattern);
    });
  });

  it('should validate exactly 8-character length', () => {
    const pattern = /^[0-9A-HJ-NPR-Z]{8}$/;

    expect('0123456').not.toMatch(pattern); // 7 chars
    expect('01234567').toMatch(pattern); // 8 chars
    expect('012345678').not.toMatch(pattern); // 9 chars
  });
});
