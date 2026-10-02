// E2E: real-time chat. Cypress drives bobby in the browser;
// ben is a second person connected over a real socket from
// Node (see the otherUser* tasks in cypress.config.js).

const BEN = 2;
const GENERAL = 1;

describe('Chat', () => {

  it('reaches a channel through the groups and channels pages', () => {
    cy.visitAs('bobby', '/groups');

    cy.contains('.group-card', 'Gaming').contains('View Channels').click();
    cy.contains('General').parents().contains('Open Chat').first().click();

    cy.location('pathname').should('eq', '/chat/1/1');
    cy.contains('h1', 'General');
    cy.contains('LIVE');
  });

  it('sends a message that is saved and still there after reloading', () => {
    cy.visitAs('bobby', '/chat/1/1');
    cy.contains('LIVE');

    cy.get('input[aria-label=Message]').type('Hello from Cypress{enter}');

    cy.contains('.message', 'Hello from Cypress');
    cy.get('input[aria-label=Message]').should('have.value', '');

    cy.reload();
    cy.contains('.message', 'Hello from Cypress');
  });

  it('shows another user joining, typing, chatting and leaving - live', () => {
    cy.visitAs('bobby', '/chat/1/1');
    cy.contains('LIVE');

    cy.task('otherUserJoins', { userId: BEN, channelId: GENERAL });
    cy.contains('ben joined the channel');
    cy.contains('.online-users', '2 online');

    cy.task('otherUserTypes', { userId: BEN, channelId: GENERAL });
    cy.contains('.typing-indicator', 'ben is typing…');

    cy.task('otherUserSends', { userId: BEN, channelId: GENERAL, text: 'Hi bobby, live!' });
    cy.contains('.message', 'Hi bobby, live!');
    cy.get('.typing-indicator').should('not.contain', 'ben');

    cy.task('otherUserLeaves', { userId: BEN });
    cy.contains('ben left the channel');
    cy.contains('.online-users', '1 online');
  });

  it("deletes your own message for everyone, but not other people's", () => {
    cy.task('otherUserJoins', { userId: BEN, channelId: GENERAL });
    cy.task('otherUserSends', { userId: BEN, channelId: GENERAL, text: "ben's message" });

    cy.visitAs('bobby', '/chat/1/1');
    cy.get('input[aria-label=Message]').type('mine to delete{enter}');

    cy.contains('.message', "ben's message").find('.delete-message-button').should('not.exist');
    cy.contains('.message', 'mine to delete').find('.delete-message-button').click();

    cy.get('.messages').should('not.contain', 'mine to delete');
  });

  it("explains when you aren't a member of a channel", () => {
    // bobby is in group 1 but not in its "Raids" channel.
    cy.visitAs('bobby', '/chat/1/2');

    cy.contains('[role=alert]', 'You are not a member of this channel');
  });
});
