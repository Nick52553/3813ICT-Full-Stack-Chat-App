import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { Requests } from './requests';
import { API, TEST_USERS, loginAs, serverError, testProviders } from '../../testing/test-utils';

describe('Requests', () => {
  let component: Requests;
  let http: HttpTestingController;

  beforeEach(async () => {
    loginAs(TEST_USERS.user);

    await TestBed.configureTestingModule({
      imports: [Requests],
      providers: testProviders
    }).compileComponents();

    // No detectChanges: these tests call methods directly,
    // so the groups/users lists aren't requested.
    component = TestBed.createComponent(Requests).componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    loginAs(null);
  });

  // Submit the current form and return the body that was sent.
  function submitAndCapture() {
    component.submitRequest();
    const req = http.expectOne(`${API}/requests`);
    const body = req.request.body;
    req.flush({});
    return body;
  }

  it('only checks the fields on the current tab', () => {
    component.selectType('join');

    expect(Object.keys(component.errors)).toEqual(['selectedGroup']);
  });

  it('switching tabs hides errors from the last attempt', () => {
    component.submitRequest();
    expect(component.submitted).toBe(true);

    component.selectType('channel');

    expect(component.submitted).toBe(false);
  });

  it('a new-group request needs a valid name', () => {
    component.groupName = 'x';

    component.submitRequest();

    expect(component.errors.groupName).toContain('2-50');
    http.expectNone(`${API}/requests`);
  });

  it('sends a new-group request', () => {
    Object.assign(component, { groupName: ' Chess ', groupDescription: ' Strategy ', groupAgeLimit: 12 });

    expect(submitAndCapture()).toEqual({
      type: 'group', requesterId: 3, name: 'Chess', description: 'Strategy', ageLimit: 12
    });
    expect(component.message).toBe('Request submitted successfully.');
    expect(component.groupName).toBe('');
  });

  it('sends a join request with a numeric group id', () => {
    component.selectType('join');
    component.selectedGroup = '2';

    expect(submitAndCapture()).toEqual({ type: 'join', requesterId: 3, groupId: 2 });
  });

  it('a channel request needs a group and a name', () => {
    component.selectType('channel');

    component.submitRequest();

    expect(component.errors.selectedGroup).toBe('Please choose a group');
    expect(component.errors.channelName).toBe('Channel name is required');
    http.expectNone(`${API}/requests`);
  });

  it('sends a removal request with an optional reason', () => {
    component.selectType('ban');
    Object.assign(component, { selectedGroup: '1', selectedUser: '5', banReason: '  spam  ' });

    expect(submitAndCapture()).toEqual({
      type: 'ban', requesterId: 3, groupId: 1, targetUserId: 5, reason: 'spam'
    });
  });

  it("shows the server's reason when a request is refused", () => {
    component.selectType('join');
    component.selectedGroup = '1';
    component.submitRequest();

    const { body, opts } = serverError(403, 'You must be at least 18 years old to join this group');
    http.expectOne(`${API}/requests`).flush(body, opts);

    expect(component.error).toBe('You must be at least 18 years old to join this group');
    expect(component.submitting).toBe(false);
  });
});
