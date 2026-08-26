import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChannelList } from './channel-list';

describe('ChannelList', () => {
  let component: ChannelList;
  let fixture: ComponentFixture<ChannelList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChannelList],
    }).compileComponents();

    fixture = TestBed.createComponent(ChannelList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
