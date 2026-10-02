// Storyboard screenshots for docs/Phase2.md - not a test suite.
// Each scene sets up realistic data, opens a screen as the
// right role, and saves it at desktop and mobile sizes.
//
// Run with: npm run docs:screenshots
// Output:   docs/screenshots/<scene>-desktop.png / -mobile.png

const API = 'http://localhost:3000/api';
const BEN = 2;
const GENERAL = 1;

const SIZES = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 }
];

// Screenshot the current page at every size.
function shoot(scene) {
  for (const size of SIZES) {
    cy.viewport(size.width, size.height);
    // Let the layout settle after resizing.
    cy.wait(400);
    cy.screenshot(`${scene}-${size.name}`, { capture: 'fullPage', overwrite: true });
  }
}

// Submit a request through the API as a given user.
function request(body) {
  cy.request('POST', `${API}/requests`, body);
}

describe('Storyboard', () => {

  it('01 login - with a failed attempt', () => {
    cy.visit('/login');
    cy.fillField('Username', 'bobby');
    cy.fillField('Password', 'WrongPass1');
    cy.contains('button', 'Login').click();
    cy.contains('[role=alert]', 'Invalid username or password');
    shoot('01-login');
  });

  it('02 register - first run', () => {
    cy.task('clearUsers');
    cy.visit('/register');
    cy.contains('Bootstrap Super Admin');
    shoot('02-register');
  });

  it('03 sign up - validation errors', () => {
    cy.visit('/signup');
    cy.fillField('Username', 'new user');
    cy.fillField('Password', 'short');
    cy.fillField('Confirm Password', 'other');
    cy.contains('button', 'Create Account').click();
    cy.contains('.field-error', 'Passwords do not match');
    shoot('03-signup');
  });

  it('04 dashboard', () => {
    cy.visitAs('bobby', '/dashboard');
    cy.contains('h1', 'Dashboard');
    shoot('04-dashboard');
  });

  it('05 groups', () => {
    cy.visitAs('bobby', '/groups');
    cy.contains('.group-card', 'Gaming');
    shoot('05-groups');
  });

  it('06 channels', () => {
    cy.visitAs('bobby', '/channels/1');
    cy.contains('General');
    shoot('06-channels');
  });

  it('07 profile - with a picture', () => {
    cy.visitAs('bobby', '/profile');
    cy.get('input[type=file]').selectFile('cypress/fixtures/storyboard-avatar.png', { force: true });
    cy.contains('Profile picture updated');
    shoot('07-profile');
  });

  it('08 chat - live conversation with an image', () => {
    // Give bobby a profile picture first.
    cy.visitAs('bobby', '/profile');
    cy.get('input[type=file]').selectFile('cypress/fixtures/storyboard-avatar.png', { force: true });
    cy.contains('Profile picture updated');

    cy.task('otherUserJoins', { userId: BEN, channelId: GENERAL });
    cy.task('otherUserSends', { userId: BEN, channelId: GENERAL, text: 'Anyone up for a game tonight?' });

    cy.visitAs('bobby', '/chat/1/1');
    cy.contains('LIVE');

    cy.get('input[aria-label=Message]').type('Yes! Just got back from the hike{enter}');
    cy.get('input[type=file]').selectFile('cypress/fixtures/storyboard-photo.png', { force: true });
    cy.get('input[aria-label=Message]').type('sunset from the lookout');
    cy.contains('button', 'Send').click();
    cy.contains('.message', 'sunset from the lookout');

    cy.task('otherUserSends', { userId: BEN, channelId: GENERAL, text: 'Nice! Starting at 8pm.' });
    cy.task('otherUserTypes', { userId: BEN, channelId: GENERAL });
    cy.contains('.typing-indicator', 'ben is typing');

    shoot('08-chat');
  });

  it('09 requests - new channel form with errors', () => {
    cy.visitAs('bobby', '/requests');
    cy.contains('button', 'New Channel').click();
    cy.contains('button', 'Submit Channel Request').click();
    cy.contains('.field-error', 'Channel name is required');
    shoot('09-requests');
  });

  it('10 group management - pending requests', () => {
    request({ type: 'channel', requesterId: 3, groupId: 1, name: 'Speedruns', description: 'Fastest times' });
    request({ type: 'join', requesterId: 5, groupId: 1 });
    request({ type: 'ban', requesterId: 2, groupId: 1, targetUserId: 3, reason: 'Spamming the channel' });

    cy.visitAs('ben', '/groups/manage');
    cy.contains('.request-review', 'Speedruns');
    shoot('10-group-management');
  });

  it('11 channel management', () => {
    cy.visitAs('ben', '/channels/manage');
    cy.contains('h1', 'Channel Management');
    shoot('11-channel-management');
  });

  it('12 user management - pending group request', () => {
    request({ type: 'group', requesterId: 3, name: 'Chess Club', description: 'Weekly online chess', ageLimit: 0 });

    cy.visitAs('super', '/user-management');
    cy.contains('Chess Club');
    shoot('12-user-management');
  });

  it('13 audit log', () => {
    // Generate some history.
    cy.request('POST', `${API}/users`, { username: 'helper', password: 'Helper123', age: 28, role: 'groupAdmin', requesterId: 1 });
    cy.request('POST', `${API}/groups/2/admins`, { userId: 6 });
    request({ type: 'join', requesterId: 5, groupId: 2 });
    cy.request('PUT', `${API}/requests/1`, { status: 'approved', reviewerId: 1 });

    cy.visitAs('super', '/audit-log');
    cy.contains('request.approved');
    shoot('13-audit-log');
  });
});
