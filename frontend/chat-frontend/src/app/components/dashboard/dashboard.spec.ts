import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Dashboard } from './dashboard';
import { TEST_USERS, loginAs, testProviders } from '../../testing/test-utils';

describe('Dashboard', () => {
  let fixture: ComponentFixture<Dashboard>;

  beforeEach(async () => {
    loginAs(TEST_USERS.user);

    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: testProviders
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => loginAs(null));

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('includes the navigation bar', () => {
    expect((fixture.nativeElement as HTMLElement).querySelector('app-navbar')).not.toBeNull();
  });
});
