import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router, UrlTree } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';

import { authGuard } from './auth.guard';
import { groupAdminGuard, superAdminGuard } from './role.guard';
import { loginGuard, registerGuard } from './bootstrap.guard';
import { API, TEST_USERS, loginAs, testProviders } from './testing/test-utils';

// Guards are plain functions that use inject(), so run
// them inside Angular's injection context.
function run(guard: any): any {
  return TestBed.runInInjectionContext(() => guard({} as any, {} as any));
}

// The URL a guard redirects to, or true if it allows access.
function outcome(result: boolean | UrlTree): string | boolean {
  return result instanceof UrlTree
    ? TestBed.inject(Router).serializeUrl(result)
    : result;
}

describe('Route guards', () => {

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders });
  });

  afterEach(() => loginAs(null));

  describe('authGuard', () => {

    it('sends logged-out visitors to /login', () => {
      loginAs(null);
      expect(outcome(run(authGuard))).toBe('/login');
    });

    it('lets logged-in users through', () => {
      loginAs(TEST_USERS.user);
      expect(outcome(run(authGuard))).toBe(true);
    });
  });

  describe('role guards', () => {

    it('superAdminGuard only admits the Super Admin', () => {
      loginAs(TEST_USERS.superAdmin);
      expect(outcome(run(superAdminGuard))).toBe(true);

      loginAs(TEST_USERS.groupAdmin);
      expect(outcome(run(superAdminGuard))).toBe('/dashboard');
    });

    it('groupAdminGuard admits group admins and the Super Admin', () => {
      loginAs(TEST_USERS.groupAdmin);
      expect(outcome(run(groupAdminGuard))).toBe(true);

      loginAs(TEST_USERS.superAdmin);
      expect(outcome(run(groupAdminGuard))).toBe(true);
    });

    it('sends regular users to the dashboard and visitors to login', () => {
      loginAs(TEST_USERS.user);
      expect(outcome(run(groupAdminGuard))).toBe('/dashboard');

      loginAs(null);
      expect(outcome(run(groupAdminGuard))).toBe('/login');
    });
  });

  describe('first-run guards', () => {

    // Run an HTTP-based guard, answering its status check.
    async function runWithStatus(guard: any, reply: object | 'offline') {

      const result = firstValueFrom(run(guard) as Observable<boolean | UrlTree>);
      const req = TestBed.inject(HttpTestingController).expectOne(`${API}/bootstrap-status`);

      if (reply === 'offline') {
        req.error(new ProgressEvent('error'));
      } else {
        req.flush(reply);
      }

      return outcome(await result);
    }

    it('registerGuard only allows /register before set-up', async () => {
      expect(await runWithStatus(registerGuard, { needsBootstrap: true })).toBe(true);
      expect(await runWithStatus(registerGuard, { needsBootstrap: false })).toBe('/login');
    });

    it('loginGuard sends visitors to /register before set-up', async () => {
      expect(await runWithStatus(loginGuard, { needsBootstrap: true })).toBe('/register');
      expect(await runWithStatus(loginGuard, { needsBootstrap: false })).toBe(true);
    });

    it('fails safe when the server is unreachable', async () => {
      expect(await runWithStatus(registerGuard, 'offline')).toBe('/login');
      expect(await runWithStatus(loginGuard, 'offline')).toBe(true);
    });
  });
});
