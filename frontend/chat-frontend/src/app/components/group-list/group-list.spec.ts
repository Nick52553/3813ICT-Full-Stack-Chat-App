import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { GroupList } from './group-list';
import { API, TEST_USERS, loginAs, serverError, testProviders } from '../../testing/test-utils';

const GROUPS = [
  { id: 1, name: 'Gaming', ageLimit: 18, adminIds: [3], memberIds: [3] },
  { id: 2, name: 'Study', ageLimit: 0, adminIds: [], memberIds: [] }
];

describe('GroupList', () => {
  let fixture: ComponentFixture<GroupList>;
  let component: GroupList;
  let http: HttpTestingController;

  beforeEach(async () => {
    loginAs(TEST_USERS.user);

    await TestBed.configureTestingModule({
      imports: [GroupList],
      providers: testProviders
    }).compileComponents();

    fixture = TestBed.createComponent(GroupList);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    http.expectOne(`${API}/groups`).flush(GROUPS);
  });

  afterEach(() => {
    http.verify();
    loginAs(null);
  });

  it('loads groups from the server', () => {
    expect(component.groups.map(g => g.name)).toEqual(['Gaming', 'Study']);
  });

  it('knows which groups the user belongs to and admins', () => {
    expect(component.isMember(GROUPS[0])).toBe(true);
    expect(component.isAdmin(GROUPS[0])).toBe(true);
    expect(component.isMember(GROUPS[1])).toBe(false);
  });

  it('sends a join request for a group the user is not in', () => {
    component.requestToJoin(GROUPS[1]);

    const req = http.expectOne(`${API}/requests`);
    expect(req.request.body).toEqual({ type: 'join', requesterId: 3, groupId: 2 });

    req.flush({});
    expect(component.message).toContain('Study');
  });

  it('does not send a request for a group the user is already in', () => {
    component.requestToJoin(GROUPS[0]);

    http.expectNone(`${API}/requests`);
  });

  it("shows the server's reason when a join is refused", () => {
    component.requestToJoin(GROUPS[1]);

    const { body, opts } = serverError(403, 'You must be at least 18 years old to join this group');
    http.expectOne(`${API}/requests`).flush(body, opts);

    expect(component.error).toBe('You must be at least 18 years old to join this group');
  });
});
