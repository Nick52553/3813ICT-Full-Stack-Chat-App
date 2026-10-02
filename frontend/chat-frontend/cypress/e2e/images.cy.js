// E2E: profile pictures and images in chat.

describe('Images', () => {

  it('uploads a profile picture and shows it', () => {
    cy.visitAs('bobby', '/profile');

    cy.get('input[type=file]').selectFile('cypress/fixtures/picture.png', { force: true });

    cy.contains('Profile picture updated');
    cy.get('img.profile-avatar-image')
      .should('have.attr', 'src')
      .and('match', /\/uploads\/avatars\/.+\.png$/);

    cy.contains('button', 'Remove').click();
    cy.contains('Profile picture removed');
    cy.get('img.profile-avatar-image').should('not.exist');
  });

  it('refuses a file that is not an image', () => {
    cy.visitAs('bobby', '/profile');

    cy.get('input[type=file]').selectFile('cypress/fixtures/notes.txt', { force: true });

    cy.contains('[role=alert]', 'Only PNG, JPG and GIF images are allowed');
  });

  it('sends an image with a caption in chat', () => {
    cy.visitAs('bobby', '/chat/1/1');
    cy.contains('LIVE');

    cy.get('input[type=file]').selectFile('cypress/fixtures/picture.png', { force: true });
    cy.get('.image-preview').should('contain', 'picture.png');

    cy.get('input[aria-label=Message]').type('look at this');
    cy.contains('button', 'Send').click();

    cy.get('.image-preview').should('not.exist');
    cy.contains('.message', 'look at this')
      .find('img.message-image')
      .should('have.attr', 'src')
      .and('match', /\/uploads\/chat\/.+\.png$/);
  });
});
