import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { ChannelList } from './channel-list';
import { API, TEST_USERS, loginAs, testProviders } from '../../testing/test-utils';

describe('ChannelList', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    loginAs(TEST_USERS.user);

    await TestBed.configureTestingModule({
      imports: [ChannelList],
      providers: [
        ...testProviders,
        // As if the user opened /channels/1
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ groupId: '1' }) } }
        }
      ]
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    loginAs(null);
  });

  it("loads the group's name and channels from the URL's group id", () => {
    const fixture = TestBed.createComponent(ChannelList);
    fixture.detectChanges();

    http.expectOne(`${API}/groups/1/channels`).flush([
      { id: 1, groupId: 1, name: 'General', memberIds: [3] },
      { id: 2, groupId: 1, name: 'Raids', memberIds: [] }
    ]);
    http.expectOne(`${API}/groups/1`).flush({ id: 1, name: 'Gaming' });

    const component = fixture.componentInstance;
    expect(component.groupName).toBe('Gaming');
    expect(component.channels.map(c => c.name)).toEqual(['General', 'Raids']);
  });

  it('links each channel to its chat window', () => {
    const fixture = TestBed.createComponent(ChannelList);
    fixture.detectChanges();

    http.expectOne(`${API}/groups/1/channels`).flush([{ id: 7, groupId: 1, name: 'General', memberIds: [] }]);
    http.expectOne(`${API}/groups/1`).flush({ id: 1, name: 'Gaming' });
    fixture.detectChanges();

    const link = (fixture.nativeElement as HTMLElement).querySelector('a.open-button');
    expect(link?.getAttribute('href')).toBe('/chat/1/7');
  });
});
