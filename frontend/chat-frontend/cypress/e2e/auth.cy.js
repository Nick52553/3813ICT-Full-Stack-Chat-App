// E2E: logging in, logging out and signing up through the real UI.

describe('Login and logout', () => {

  it('sends logged-out visitors to the login page', () => {
    cy.visit('/groups');

    cy.location('pathname').should('eq', '/login');
  });

  it('shows field errors when the form is empty', () => {
    cy.visit('/login');

    cy.contains('button', 'Login').click();

    cy.contains('.field-error', 'Please enter your username');
    cy.contains('.field-error', 'Please enter your password');
    cy.location('pathname').should('eq', '/login');
  });

  it('rejects a wrong password with a clear message', () => {
    cy.visit('/login');

    cy.fillField('Username', 'bobby');
    cy.fillField('Password', 'WrongPass1');
    cy.contains('button', 'Login').click();

    cy.contains('[role=alert]', 'Invalid username or password');
    cy.location('pathname').should('eq', '/login');
  });

  it('logs in, shows the groups, and logs out again', () => {
    cy.visit('/login');

    cy.fillField('Username', 'bobby');
    cy.fillField('Password', 'Bobby123');
    cy.contains('button', 'Login').click();

    cy.location('pathname').should('eq', '/groups');
    cy.contains('.group-card', 'Gaming');
    cy.contains('.navbar', 'bobby');

    cy.contains('button', 'Logout').click();

    cy.location('pathname').should('eq', '/login');
    cy.visit('/groups');
    cy.location('pathname').should('eq', '/login');
  });
});

describe('Sign up', () => {

  it('explains every problem and does not create the account', () => {
    cy.visit('/signup');

    cy.fillField('Username', 'a b');
    cy.fillField('Password', 'short');
    cy.fillField('Confirm Password', 'different');
    cy.contains('button', 'Create Account').click();

    cy.contains('.field-error', 'can only contain');
    cy.contains('.field-error', 'at least 8 characters');
    cy.contains('.field-error', 'Passwords do not match');
    cy.contains('.field-error', 'Date of birth is required');
    cy.location('pathname').should('eq', '/signup');
  });

  it('creates an account and logs the new user in', () => {
    cy.visit('/signup');

    cy.fillField('Username', 'newbie');
    cy.fillField('Password', 'Newbie123');
    cy.fillField('Confirm Password', 'Newbie123');
    cy.fillField('Date of Birth', '2000-05-20');
    cy.contains('button', 'Create Account').click();

    cy.location('pathname').should('eq', '/groups');
    cy.contains('.navbar', 'newbie');
  });

  it('shows the server error for a taken username', () => {
    cy.visit('/signup');

    cy.fillField('Username', 'bobby');
    cy.fillField('Password', 'Bobby1234');
    cy.fillField('Confirm Password', 'Bobby1234');
    cy.fillField('Date of Birth', '2000-05-20');
    cy.contains('button', 'Create Account').click();

    cy.contains('[role=alert]', 'Username already exists');
  });
});
