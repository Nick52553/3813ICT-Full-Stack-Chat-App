import { HttpErrorResponse } from '@angular/common/http';

// Form validation rules. These mirror backend/validation.js
// so users see the same message before and after submitting
// - keep the two files in sync.
//
// Each validator returns an error message, or null if OK.

export const LIMITS = {
  USERNAME_MIN: 3,
  USERNAME_MAX: 50,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 100,
  AGE_MIN: 13,
  AGE_MAX: 120,
  NAME_MIN: 2,
  NAME_MAX: 50,
  DESCRIPTION_MAX: 300,
  AGE_LIMIT_MIN: 0,
  AGE_LIMIT_MAX: 120,
  REASON_MAX: 300
};

const USERNAME_PATTERN = /^[A-Za-z0-9@._-]+$/;

const asText = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

// <input type="number"> gives a number, or null when empty.
function asWholeNumber(value: unknown): number | null {

  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : null;
  }

  if (typeof value === 'string' && /^\s*-?\d+\s*$/.test(value)) {
    return Number(value);
  }

  return null;
}

export function validateUsername(value: unknown): string | null {

  const username = asText(value);

  if (!username) {
    return 'Username is required';
  }

  if (username.length < LIMITS.USERNAME_MIN || username.length > LIMITS.USERNAME_MAX) {
    return `Username must be ${LIMITS.USERNAME_MIN}-${LIMITS.USERNAME_MAX} characters`;
  }

  if (!USERNAME_PATTERN.test(username)) {
    return 'Username can only contain letters, numbers and @ . _ -';
  }

  return null;
}

export function validatePassword(value: unknown): string | null {

  if (typeof value !== 'string' || !value) {
    return 'Password is required';
  }

  if (value.length < LIMITS.PASSWORD_MIN) {
    return `Password must be at least ${LIMITS.PASSWORD_MIN} characters`;
  }

  if (value.length > LIMITS.PASSWORD_MAX) {
    return `Password must be at most ${LIMITS.PASSWORD_MAX} characters`;
  }

  if (!/[A-Z]/.test(value)) {
    return 'Password must contain at least one uppercase letter';
  }

  return null;
}

export function validatePasswordMatch(password: string, confirm: string): string | null {

  if (!confirm) {
    return 'Please confirm your password';
  }

  return password === confirm ? null : 'Passwords do not match';
}

export function validateAge(value: unknown): string | null {

  const age = asWholeNumber(value);

  if (age === null) {
    return 'Age must be a whole number';
  }

  if (age < LIMITS.AGE_MIN || age > LIMITS.AGE_MAX) {
    return `Age must be between ${LIMITS.AGE_MIN} and ${LIMITS.AGE_MAX}`;
  }

  return null;
}

// Group and channel names. label is e.g. "Group name".
export function validateName(value: unknown, label: string): string | null {

  const name = asText(value);

  if (!name) {
    return `${label} is required`;
  }

  if (name.length < LIMITS.NAME_MIN || name.length > LIMITS.NAME_MAX) {
    return `${label} must be ${LIMITS.NAME_MIN}-${LIMITS.NAME_MAX} characters`;
  }

  return null;
}

export function validateDescription(value: unknown): string | null {
  return asText(value).length > LIMITS.DESCRIPTION_MAX
    ? `Description must be at most ${LIMITS.DESCRIPTION_MAX} characters`
    : null;
}

export function validateReason(value: unknown): string | null {
  return asText(value).length > LIMITS.REASON_MAX
    ? `Reason must be at most ${LIMITS.REASON_MAX} characters`
    : null;
}

export function validateAgeLimit(value: unknown): string | null {

  if (value === undefined || value === null || value === '') {
    return null;
  }

  const limit = asWholeNumber(value);

  if (limit === null) {
    return 'Age limit must be a whole number';
  }

  if (limit < LIMITS.AGE_LIMIT_MIN || limit > LIMITS.AGE_LIMIT_MAX) {
    return `Age limit must be between ${LIMITS.AGE_LIMIT_MIN} and ${LIMITS.AGE_LIMIT_MAX}`;
  }

  return null;
}

export function validateRequired(value: unknown, message: string): string | null {
  return value === null || value === undefined || value === ''
    ? message
    : null;
}

// True if a { field: message | null } object has any errors.
export function hasErrors(errors: Record<string, string | null | undefined>): boolean {
  return Object.values(errors).some(error => !!error);
}

// A friendly message for a failed HTTP request.
export function httpErrorMessage(error: HttpErrorResponse, fallback: string): string {

  // Status 0 = the request never reached the server.
  if (error.status === 0) {
    return 'Could not reach the server. Check that it is running and try again.';
  }

  return error.error?.message || fallback;
}
