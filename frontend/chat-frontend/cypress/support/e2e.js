// Runs before every spec file. Custom commands used by the
// end-to-end tests live here.

const API = 'http://localhost:3000/api';

// Every test starts from the same known data and logged out.
beforeEach(() => {
  cy.task('resetDb');
  cy.clearLocalStorage();
});

// Log in through the real API, then open `path` as that user.
// (The login form itself is tested in auth.cy.js - other
// specs skip it to stay fast and focused.)
Cypress.Commands.add('visitAs', (name, path) => {

  cy.task('users').then(users => {

    const { username, password } = users[name];

    cy.request('POST', `${API}/login`, { username, password }).then(({ body }) => {
      cy.visit(path, {
        onBeforeLoad(win) {
          win.localStorage.setItem('currentUser', JSON.stringify(body));
        }
      });
    });
  });
});

// Type into a form field found by its <label> text.
Cypress.Commands.add('fillField', (label, value) => {
  cy.contains('label', label)
    .invoke('attr', 'for')
    .then(id => {
      cy.get(`#${id}`).clear();
      if (value) {
        cy.get(`#${id}`).type(value);
      }
    });
});
