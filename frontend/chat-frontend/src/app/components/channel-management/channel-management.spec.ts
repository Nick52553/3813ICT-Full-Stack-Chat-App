import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { ChannelManagement } from './channel-management';
import { API, TEST_USERS, loginAs, serverError, testProviders } from '../../testing/test-utils';

describe('ChannelManagement', () => {
  let fixture: ComponentFixture<ChannelManagement>;
  let component: ChannelManagement;
  let http: HttpTestingController;

  beforeEach(async () => {
    loginAs(TEST_USERS.groupAdmin);

    await TestBed.configureTestingModule({
      imports: [ChannelManagement],
      providers: testProviders
    }).compileComponents();

    fixture = TestBed.createComponent(ChannelManagement);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    loginAs(null);
  });

  it('loads groups, users and channels for the dropdowns', () => {
    fixture.detectChanges();

    http.expectOne(`${API}/groups`).flush([{ id: 1, name: 'Gaming' }]);
    http.expectOne(`${API}/users`).flush([TEST_USERS.user]);
    http.expectOne(`${API}/channels`).flush([{ id: 1, name: 'General' }]);

    expect(component.groups.length).toBe(1);
    expect(component.channels.length).toBe(1);
  });

  it('requires a group and a valid channel name', () => {
    component.channelName = ' ';

    component.createChannel();

    expect(component.errors.groupId).toBe('Please choose a group');
    expect(component.errors.channelName).toBe('Channel name is required');
    http.expectNone(`${API}/channels`);
  });

  it('creates a trimmed channel in the chosen group', () => {
    Object.assign(component, { groupId: 1, channelName: '  Lobby  ', description: '  Hi  ' });

    component.createChannel();

    const req = http.expectOne(r => r.method === 'POST' && r.url === `${API}/channels`);
    expect(req.request.body).toEqual({ groupId: 1, name: 'Lobby', description: 'Hi', memberIds: [] });
    req.flush({ id: 4, name: 'Lobby' });

    expect(component.message).toContain('Lobby');
    http.expectOne(`${API}/channels`).flush([]);
  });

  it('shows a duplicate-name error from the server', () => {
    Object.assign(component, { groupId: 1, channelName: 'General' });
    component.createChannel();

    const { body, opts } = serverError(409, 'A channel with that name already exists');
    http.expectOne(`${API}/channels`).flush(body, opts);

    expect(component.error).toBe('A channel with that name already exists');
  });

  it('explains why Assign User does nothing without a selection', () => {
    component.assignUser();

    expect(component.error).toBe('Please select both a channel and a user.');
  });

  it('assigns the selected user to the selected channel', () => {
    Object.assign(component, { channelId: 2, userId: 3 });

    component.assignUser();

    const req = http.expectOne(`${API}/channels/2/members`);
    expect(req.request.body).toEqual({ userId: 3 });
    req.flush({});

    expect(component.message).toBe('User assigned to channel.');
    http.expectOne(`${API}/channels`).flush([]);
  });
});
