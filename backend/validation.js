// ====================================================
// INPUT VALIDATION
// ====================================================
// One set of rules for every route. The Angular app has
// a copy in src/app/utils/validation.ts - keep them in
// sync so users see the same messages on both sides.
//
// Each validator returns an error message, or null if
// the value is fine.

const LIMITS = {
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

const ROLES = ['user', 'groupAdmin', 'superAdmin'];

// Letters, numbers and @ . _ - (so emails work as usernames)
const USERNAME_PATTERN = /^[A-Za-z0-9@._-]+$/;

const asText = value =>
  typeof value === 'string' ? value.trim() : '';

// Accepts 25 or "25", but not 25.5, "25abc" or "".
function asWholeNumber(value) {

  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : null;
  }

  if (typeof value === 'string' && /^\s*-?\d+\s*$/.test(value)) {
    return Number(value);
  }

  return null;
}

function validateUsername(value) {

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

// Only for new passwords - login doesn't check strength,
// so accounts made before these rules still work.
function validatePassword(value) {

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

function validateAge(value) {

  const age = asWholeNumber(value);

  if (age === null) {
    return 'Age must be a whole number';
  }

  if (age < LIMITS.AGE_MIN || age > LIMITS.AGE_MAX) {
    return `Age must be between ${LIMITS.AGE_MIN} and ${LIMITS.AGE_MAX}`;
  }

  return null;
}

function validateRole(value) {
  return ROLES.includes(value)
    ? null
    : 'Role must be user, groupAdmin or superAdmin';
}

// Group and channel names. label is e.g. "Group name".
function validateName(value, label) {

  const name = asText(value);

  if (!name) {
    return `${label} is required`;
  }

  if (name.length < LIMITS.NAME_MIN || name.length > LIMITS.NAME_MAX) {
    return `${label} must be ${LIMITS.NAME_MIN}-${LIMITS.NAME_MAX} characters`;
  }

  return null;
}

// Optional free text, e.g. descriptions and reasons.
function validateOptionalText(value, label, max) {

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return `${label} must be text`;
  }

  if (value.trim().length > max) {
    return `${label} must be at most ${max} characters`;
  }

  return null;
}

function validateDescription(value) {
  return validateOptionalText(value, 'Description', LIMITS.DESCRIPTION_MAX);
}

function validateReason(value) {
  return validateOptionalText(value, 'Reason', LIMITS.REASON_MAX);
}

// Group minimum age. Optional - missing means no limit.
function validateAgeLimit(value) {

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

// Return the first error from a list of checks.
function firstError(...errors) {
  return errors.find(error => error) || null;
}

module.exports = {
  LIMITS,
  ROLES,
  validateUsername,
  validatePassword,
  validateAge,
  validateRole,
  validateName,
  validateDescription,
  validateReason,
  validateAgeLimit,
  firstError
};
