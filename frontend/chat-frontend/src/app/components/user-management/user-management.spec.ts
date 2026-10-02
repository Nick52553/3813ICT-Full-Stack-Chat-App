import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { UserManagement } from './user-management';
import { API, TEST_USERS, loginAs, serverError, testProviders } from '../../testing/test-utils';

describe('UserManagement', () => {
  let fixture: ComponentFixture<UserManagement>;
  let component: UserManagement;
  let http: HttpTestingController;

  beforeEach(async () => {
    loginAs(TEST_USERS.superAdmin);

    await TestBed.configureTestingModule({
      imports: [UserManagement],
      providers: testProviders
    }).compileComponents();

    fixture = TestBed.createComponent(UserManagement);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    loginAs(null);
  });

  it('loads users and only the pending new-group requests', () => {
    fixture.detectChanges();

    http.expectOne(`${API}/users`).flush([TEST_USERS.user]);
    http.expectOne(`${API}/requests?status=pending&reviewerId=1`).flush([
      { id: 1, type: 'group', name: 'Chess' },
      { id: 2, type: 'channel', name: 'Lobby' }
    ]);

    expect(component.users.length).toBe(1);
    expect(component.pendingGroupRequests.map(r => r.name)).toEqual(['Chess']);
  });

  describe('creating a user', () => {

    it('validates before sending anything', () => {
      Object.assign(component, { username: 'x', password: 'short', age: 5 });

      component.createUser();

      expect(component.errors.username).toContain('3-50');
      expect(component.errors.password).toContain('at least 8');
      expect(component.errors.age).toContain('between 13 and 120');
      http.expectNone(`${API}/users`);
    });

    it('sends the chosen role with the Super Admin as requester', () => {
      Object.assign(component, { username: 'gadmin', password: 'Gadmin123', age: 30, role: 'groupAdmin' });

      component.createUser();

      const req = http.expectOne(r => r.method === 'POST' && r.url === `${API}/users`);
      expect(req.request.body).toEqual({
        username: 'gadmin', password: 'Gadmin123', age: 30, role: 'groupAdmin', requesterId: 1
      });
      req.flush({ id: 6, username: 'gadmin' });

      // Form resets and the list reloads.
      expect(component.username).toBe('');
      expect(component.message).toContain('gadmin');
      http.expectOne(`${API}/users`).flush([]);
    });

    it("shows the server's error", () => {
      Object.assign(component, { username: 'bobby', password: 'Bobby1234', age: 30 });
      component.createUser();

      const { body, opts } = serverError(409, 'Username already exists');
      http.expectOne(`${API}/users`).flush(body, opts);

      expect(component.error).toBe('Username already exists');
      expect(component.creating).toBe(false);
    });
  });

  it('deletes a user as the Super Admin', () => {
    component.deleteUser(3);

    const req = http.expectOne(`${API}/users/3?requesterId=1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'User deleted' });

    expect(component.message).toBe('User deleted successfully.');
    http.expectOne(`${API}/users`).flush([]);
  });

  it('approves a new-group request and refreshes the list', () => {
    component.reviewGroupRequest(4, 'approved');

    const req = http.expectOne(`${API}/requests/4`);
    expect(req.request.body).toEqual({ status: 'approved', reviewerId: 1 });
    req.flush({ message: 'Request approved and changes applied' });

    expect(component.message).toBe('Request approved and changes applied');
    http.expectOne(`${API}/requests?status=pending&reviewerId=1`).flush([]);
  });
});
