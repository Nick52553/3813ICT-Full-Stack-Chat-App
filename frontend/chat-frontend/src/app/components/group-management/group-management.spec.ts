import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { GroupManagement } from './group-management';
import { API, TEST_USERS, loginAs, serverError, testProviders } from '../../testing/test-utils';

describe('GroupManagement', () => {
  let fixture: ComponentFixture<GroupManagement>;
  let component: GroupManagement;
  let http: HttpTestingController;

  beforeEach(async () => {
    loginAs(TEST_USERS.groupAdmin);

    await TestBed.configureTestingModule({
      imports: [GroupManagement],
      providers: testProviders
    }).compileComponents();

    fixture = TestBed.createComponent(GroupManagement);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    loginAs(null);
  });

  it('loads groups, users, and the requests a group admin handles', () => {
    fixture.detectChanges();

    http.expectOne(`${API}/groups`).flush([{ id: 1, name: 'Gaming' }]);
    http.expectOne(`${API}/users`).flush([TEST_USERS.user]);
    http.expectOne(`${API}/requests?status=pending`).flush([
      { id: 1, type: 'group' },
      { id: 2, type: 'channel' },
      { id: 3, type: 'join' }
    ]);

    // New-group requests belong to the Super Admin's page.
    expect(component.pendingRequests.map(r => r.id)).toEqual([2, 3]);
  });

  describe('creating a group', () => {

    it('validates name, description and age limit first', () => {
      Object.assign(component, { groupName: 'x', description: 'd'.repeat(301), ageLimit: 200 });

      component.createGroup();

      expect(component.errors.groupName).toContain('2-50');
      expect(component.errors.description).toContain('300');
      expect(component.errors.ageLimit).toContain('between 0 and 120');
      http.expectNone(`${API}/groups`);
    });

    it('sends a trimmed group and resets the form', () => {
      Object.assign(component, { groupName: '  Music  ', description: ' Bands ', ageLimit: null });

      component.createGroup();

      const req = http.expectOne(r => r.method === 'POST' && r.url === `${API}/groups`);
      expect(req.request.body).toEqual({
        name: 'Music', description: 'Bands', ageLimit: 0, adminIds: [], memberIds: []
      });
      req.flush({ id: 3, name: 'Music' });

      expect(component.message).toContain('Music');
      expect(component.submitted).toBe(false);
      http.expectOne(`${API}/groups`).flush([]);
    });

    it('shows a duplicate-name error from the server', () => {
      component.groupName = 'Gaming';
      component.createGroup();

      const { body, opts } = serverError(409, 'A group with that name already exists');
      http.expectOne(`${API}/groups`).flush(body, opts);

      expect(component.error).toBe('A group with that name already exists');
    });
  });

  describe('members and admins', () => {

    it('asks for a group and a user before adding a member', () => {
      component.addMember();

      expect(component.error).toBe('Please select both a group and a user.');
      http.expectNone(() => true);
    });

    it('adds the selected user to the selected group', () => {
      Object.assign(component, { selectedGroupId: 1, selectedUserId: 3 });

      component.addMember();

      const req = http.expectOne(`${API}/groups/1/members`);
      expect(req.request.body).toEqual({ userId: 3 });
      req.flush({});
      http.expectOne(`${API}/groups`).flush([]);
    });

    it('promotes and demotes admins through the right endpoints', () => {
      Object.assign(component, { selectedGroupId: 1, selectedAdminId: 3 });

      component.assignAdmin();
      http.expectOne(`${API}/groups/1/admins`).flush({});
      http.expectOne(`${API}/groups`).flush([]);

      component.demoteAdmin();
      http.expectOne(`${API}/groups/1/admins/demote`).flush({});
      http.expectOne(`${API}/groups`).flush([]);

      expect(component.message).toBe('Group admin demoted successfully.');
    });
  });

  it('reviews a request as the logged-in admin', () => {
    component.reviewRequest(5, 'denied');

    const req = http.expectOne(`${API}/requests/5`);
    expect(req.request.body).toEqual({ status: 'denied', reviewerId: 2 });
    req.flush({ message: 'Request denied' });

    expect(component.message).toBe('Request denied.');
    http.expectOne(`${API}/requests?status=pending`).flush([]);
    http.expectOne(`${API}/groups`).flush([]);
  });
});
