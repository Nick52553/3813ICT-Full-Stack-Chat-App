import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChannelManagement } from './channel-management';

describe('ChannelManagement', () => {
  let component: ChannelManagement;
  let fixture: ComponentFixture<ChannelManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChannelManagement],
    }).compileComponents();

    fixture = TestBed.createComponent(ChannelManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
