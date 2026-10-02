// E2E: each role sees and reaches only the pages it should.

describe('Permissions by role', () => {

  it('a regular user sees no admin links and is turned away from admin pages', () => {
    cy.visitAs('bobby', '/dashboard');

    cy.get('.navbar').should('not.contain', 'Group Management');
    cy.get('.navbar').should('not.contain', 'User Management');

    cy.visit('/user-management');
    cy.location('pathname').should('eq', '/dashboard');

    cy.visit('/groups/manage');
    cy.location('pathname').should('eq', '/dashboard');
  });

  it('a group admin can manage groups but not users', () => {
    cy.visitAs('ben', '/groups/manage');

    cy.location('pathname').should('eq', '/groups/manage');
    cy.get('.navbar').should('contain', 'Channel Management');
    cy.get('.navbar').should('not.contain', 'User Management');

    cy.visit('/audit-log');
    cy.location('pathname').should('eq', '/dashboard');
  });

  it('a group admin can open Channel Management from the navbar', () => {
    // Regression: /channels/manage used to be caught by the
    // /channels/:groupId route and show a channel list instead.
    cy.visitAs('ben', '/dashboard');

    cy.contains('.navbar a', 'Channel Management').click();

    cy.location('pathname').should('eq', '/channels/manage');
    cy.contains('h1', 'Channel Management');
  });

  it('a regular user cannot open Channel Management', () => {
    cy.visitAs('bobby', '/channels/manage');

    cy.location('pathname').should('eq', '/dashboard');
  });

  it('the Super Admin can reach user management and the audit log', () => {
    cy.visitAs('super', '/user-management');

    cy.contains('h1', 'User Management');
    cy.contains('bobby');

    cy.contains('.navbar a', 'Audit Log').click();
    cy.contains('h1', 'Audit Log');
  });

  it('the Super Admin creates a user, which is recorded in the audit log', () => {
    cy.visitAs('super', '/user-management');

    cy.fillField('Username', 'helper');
    cy.fillField('Password', 'Helper123');
    cy.get('#age').clear().type('28');
    cy.contains('button', 'Create User').click();

    cy.contains('helper was created successfully.');

    cy.contains('.navbar a', 'Audit Log').click();
    cy.contains('user.created');
  });
});
