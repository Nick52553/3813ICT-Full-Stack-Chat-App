import { HttpErrorResponse } from '@angular/common/http';

import {
  hasErrors,
  httpErrorMessage,
  validateAge,
  validateAgeLimit,
  validateDescription,
  validateName,
  validatePassword,
  validatePasswordMatch,
  validateRequired,
  validateUsername
} from './validation';

describe('validation rules', () => {

  describe('validateUsername', () => {
    it('accepts plain names and emails', () => {
      expect(validateUsername('supernick')).toBeNull();
      expect(validateUsername('bobby@bobby.com')).toBeNull();
    });

    it('requires a value', () => {
      expect(validateUsername('   ')).toBe('Username is required');
    });

    it('enforces 3-50 characters', () => {
      expect(validateUsername('ab')).toBe('Username must be 3-50 characters');
      expect(validateUsername('a'.repeat(51))).toBe('Username must be 3-50 characters');
    });

    it('rejects spaces and symbols', () => {
      expect(validateUsername('bad name')).toContain('can only contain');
      expect(validateUsername('<script>')).toContain('can only contain');
    });
  });

  describe('validatePassword', () => {
    it('accepts 8+ characters with an uppercase letter', () => {
      expect(validatePassword('Password1')).toBeNull();
    });

    it('rejects short, missing and all-lowercase passwords', () => {
      expect(validatePassword('')).toBe('Password is required');
      expect(validatePassword('Pass1')).toBe('Password must be at least 8 characters');
      expect(validatePassword('password1')).toBe('Password must contain at least one uppercase letter');
    });
  });

  describe('validatePasswordMatch', () => {
    it('checks the confirmation matches', () => {
      expect(validatePasswordMatch('Password1', 'Password1')).toBeNull();
      expect(validatePasswordMatch('Password1', 'Password2')).toBe('Passwords do not match');
      expect(validatePasswordMatch('Password1', '')).toBe('Please confirm your password');
    });
  });

  describe('validateAge', () => {
    it('accepts whole numbers from 13 to 120', () => {
      expect(validateAge(13)).toBeNull();
      expect(validateAge('120')).toBeNull();
    });

    it('rejects out-of-range, fractional and empty values', () => {
      expect(validateAge(12)).toBe('Age must be between 13 and 120');
      expect(validateAge(121)).toBe('Age must be between 13 and 120');
      expect(validateAge(20.5)).toBe('Age must be a whole number');
      expect(validateAge(null)).toBe('Age must be a whole number');
    });
  });

  describe('validateName', () => {
    it('uses the label in its messages', () => {
      expect(validateName('', 'Group name')).toBe('Group name is required');
      expect(validateName('x', 'Channel name')).toBe('Channel name must be 2-50 characters');
      expect(validateName('  General  ', 'Channel name')).toBeNull();
    });
  });

  describe('optional fields', () => {
    it('allows an empty description but limits its length', () => {
      expect(validateDescription('')).toBeNull();
      expect(validateDescription('d'.repeat(301))).toBe('Description must be at most 300 characters');
    });

    it('allows no age limit, 0 to 120 otherwise', () => {
      expect(validateAgeLimit(null)).toBeNull();
      expect(validateAgeLimit(0)).toBeNull();
      expect(validateAgeLimit(-1)).toBe('Age limit must be between 0 and 120');
      expect(validateAgeLimit(500)).toBe('Age limit must be between 0 and 120');
    });
  });

  describe('helpers', () => {
    it('validateRequired treats null and empty string as missing', () => {
      expect(validateRequired(null, 'Pick one')).toBe('Pick one');
      expect(validateRequired('', 'Pick one')).toBe('Pick one');
      expect(validateRequired(0, 'Pick one')).toBeNull();
    });

    it('hasErrors spots any message', () => {
      expect(hasErrors({ a: null, b: undefined })).toBe(false);
      expect(hasErrors({ a: null, b: 'Wrong' })).toBe(true);
    });

    it('httpErrorMessage explains an unreachable server', () => {
      const offline = new HttpErrorResponse({ status: 0 });
      expect(httpErrorMessage(offline, 'fallback')).toContain('Could not reach the server');
    });

    it("httpErrorMessage prefers the server's message", () => {
      const conflict = new HttpErrorResponse({ status: 409, error: { message: 'Username already exists' } });
      const noBody = new HttpErrorResponse({ status: 500 });

      expect(httpErrorMessage(conflict, 'fallback')).toBe('Username already exists');
      expect(httpErrorMessage(noBody, 'fallback')).toBe('fallback');
    });
  });
});
