// E2E: the request -> approval workflow across two users.

describe('Requests', () => {

  it('blocks an underage user from asking to join an 18+ group', () => {
    // "young" is 15; Gaming has a minimum age of 18.
    cy.visitAs('young', '/groups');

    cy.contains('.group-card', 'Gaming').contains('Request to Join').click();

    cy.contains('.error-message', 'at least 18 years old');
  });

  it('a user requests a channel and the group admin approves it', () => {
    // bobby asks for a new channel in Gaming...
    cy.visitAs('bobby', '/requests');

    cy.contains('button', 'New Channel').click();
    cy.get('#channelGroup').select('Gaming');
    cy.fillField('Channel Name', 'Speedruns');
    cy.contains('button', 'Submit Channel Request').click();
    cy.contains('Request submitted successfully.');

    // ...ben, Gaming's admin, accepts it...
    cy.visitAs('ben', '/groups/manage');
    cy.contains('.request-review', 'Speedruns').contains('button', 'Accept').click();
    cy.contains('Request approved');

    // ...and bobby can now see it.
    cy.visitAs('bobby', '/channels/1');
    cy.contains('Speedruns');
  });

  it('validates a request form before sending it', () => {
    cy.visitAs('bobby', '/requests');

    cy.contains('button', 'New Channel').click();
    cy.contains('button', 'Submit Channel Request').click();

    cy.contains('.field-error', 'Please choose a group');
    cy.contains('.field-error', 'Channel name is required');
  });
});
