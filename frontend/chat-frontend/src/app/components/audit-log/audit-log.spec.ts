import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { AuditLog } from './audit-log';
import { API, TEST_USERS, loginAs, serverError, testProviders } from '../../testing/test-utils';

describe('AuditLog', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    loginAs(TEST_USERS.superAdmin);

    await TestBed.configureTestingModule({
      imports: [AuditLog],
      providers: testProviders
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    loginAs(null);
  });

  it("asks for the log as the logged-in user and shows the entries", () => {
    const fixture = TestBed.createComponent(AuditLog);
    fixture.detectChanges();

    http.expectOne(`${API}/audit?requesterId=1`).flush([
      { id: 2, action: 'user.deleted', actorId: 1, details: {}, timestamp: '2026-10-01T00:00:00Z' },
      { id: 1, action: 'user.created', actorId: 4, details: {}, timestamp: '2026-09-30T00:00:00Z' }
    ]);

    expect(fixture.componentInstance.entries.length).toBe(2);
  });

  it("shows the server's message when access is refused", () => {
    const fixture = TestBed.createComponent(AuditLog);
    fixture.detectChanges();

    const { body, opts } = serverError(403, 'Only the Super Admin can view the audit log');
    http.expectOne(`${API}/audit?requesterId=1`).flush(body, opts);

    expect(fixture.componentInstance.error).toBe('Only the Super Admin can view the audit log');
  });
});
