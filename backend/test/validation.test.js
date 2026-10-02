// Unit tests: validation.js (no database or server needed).

const { expect } = require('chai');
const v = require('../validation');

describe('Unit: validation rules', () => {

  describe('validateUsername', () => {

    it('accepts plain names and email addresses', () => {
      expect(v.validateUsername('supernick')).to.equal(null);
      expect(v.validateUsername('bobby@bobby.com')).to.equal(null);
    });

    it('rejects missing, too short and too long names', () => {
      expect(v.validateUsername(undefined)).to.equal('Username is required');
      expect(v.validateUsername('ab')).to.match(/3-50 characters/);
      expect(v.validateUsername('a'.repeat(51))).to.match(/3-50 characters/);
    });

    it('rejects spaces and symbols', () => {
      expect(v.validateUsername('two words')).to.match(/can only contain/);
      expect(v.validateUsername('<script>')).to.match(/can only contain/);
    });

    it('rejects non-string values such as Mongo operators', () => {
      expect(v.validateUsername({ $ne: '' })).to.equal('Username is required');
    });
  });

  describe('validatePassword', () => {

    it('accepts 8+ characters with an uppercase letter', () => {
      expect(v.validatePassword('Password1')).to.equal(null);
    });

    it('rejects short, lowercase-only and overly long passwords', () => {
      expect(v.validatePassword('Pass1')).to.match(/at least 8/);
      expect(v.validatePassword('password1')).to.match(/uppercase/);
      expect(v.validatePassword('A'.repeat(101))).to.match(/at most 100/);
    });
  });

  describe('validateAge', () => {

    it('accepts whole numbers 13-120, as numbers or numeric strings', () => {
      expect(v.validateAge(13)).to.equal(null);
      expect(v.validateAge('120')).to.equal(null);
    });

    it('rejects out-of-range, decimal and non-numeric ages', () => {
      expect(v.validateAge(12)).to.match(/between 13 and 120/);
      expect(v.validateAge(20.5)).to.equal('Age must be a whole number');
      expect(v.validateAge('25abc')).to.equal('Age must be a whole number');
      expect(v.validateAge(undefined)).to.equal('Age must be a whole number');
    });
  });

  describe('other rules', () => {

    it('validateRole only allows the three known roles', () => {
      expect(v.validateRole('groupAdmin')).to.equal(null);
      expect(v.validateRole('god')).to.match(/Role must be/);
    });

    it('validateName uses the given label', () => {
      expect(v.validateName('', 'Channel name')).to.equal('Channel name is required');
      expect(v.validateName('x', 'Group name')).to.match(/Group name must be 2-50/);
    });

    it('descriptions and reasons are optional but limited to 300 characters', () => {
      expect(v.validateDescription(undefined)).to.equal(null);
      expect(v.validateDescription('d'.repeat(301))).to.match(/at most 300/);
      expect(v.validateReason(42)).to.equal('Reason must be text');
    });

    it('validateAgeLimit allows none, or 0-120', () => {
      expect(v.validateAgeLimit(undefined)).to.equal(null);
      expect(v.validateAgeLimit(0)).to.equal(null);
      expect(v.validateAgeLimit(-1)).to.match(/between 0 and 120/);
    });

    it('firstError returns the first problem, or null', () => {
      expect(v.firstError(null, 'A', 'B')).to.equal('A');
      expect(v.firstError(null, null)).to.equal(null);
    });
  });
});
