import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { Navbar } from './navbar';
import { TEST_USERS, loginAs, testProviders } from '../../testing/test-utils';

// Create the navbar for a user and return its link targets.
async function linksFor(user: object) {

  loginAs(user);

  const fixture = TestBed.createComponent(Navbar);
  fixture.detectChanges();
  await fixture.whenStable();

  const links = (fixture.nativeElement as HTMLElement).querySelectorAll('a[href]');
  return Array.from(links).map(a => a.getAttribute('href'));
}

describe('Navbar', () => {

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: testProviders
    }).compileComponents();
  });

  afterEach(() => loginAs(null));

  it('shows regular users only the everyday pages', async () => {
    const links = await linksFor(TEST_USERS.user);

    expect(links).toContain('/groups');
    expect(links).not.toContain('/groups/manage');
    expect(links).not.toContain('/user-management');
  });

  it('shows group admins the management pages but not user admin', async () => {
    const links = await linksFor(TEST_USERS.groupAdmin);

    expect(links).toContain('/groups/manage');
    expect(links).toContain('/channels/manage');
    expect(links).not.toContain('/user-management');
    expect(links).not.toContain('/audit-log');
  });

  it('shows the Super Admin everything', async () => {
    const links = await linksFor(TEST_USERS.superAdmin);

    expect(links).toContain('/user-management');
    expect(links).toContain('/audit-log');
  });

  it('logout forgets the user and goes to the login page', () => {
    loginAs(TEST_USERS.user);
    const navbar = TestBed.createComponent(Navbar).componentInstance;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    navbar.logout();

    expect(localStorage.getItem('currentUser')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
