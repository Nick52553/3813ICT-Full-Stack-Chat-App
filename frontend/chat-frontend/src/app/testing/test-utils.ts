// Shared set-up for component and guard specs.
// Only imported by *.spec.ts files - never by the app.

import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

export const API = 'http://localhost:3000/api';

// What most components need: HttpClient (with requests
// captured by HttpTestingController instead of sent) and
// the router (for routerLink, ActivatedRoute, Router).
export const testProviders = [
  provideHttpClient(),
  provideHttpClientTesting(),
  provideRouter([])
];

export const TEST_USERS = {
  superAdmin: { id: 1, username: 'super', age: 30, role: 'superAdmin', avatarUrl: null },
  groupAdmin: { id: 2, username: 'ben', age: 37, role: 'groupAdmin', avatarUrl: null },
  user: { id: 3, username: 'bobby', age: 21, role: 'user', avatarUrl: null }
};

// Pretend this user is logged in. Call before creating
// the component - components read it in their constructor.
export function loginAs(user: object | null) {
  if (user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
  } else {
    localStorage.removeItem('currentUser');
  }
}

// An HTTP error response body like the server sends.
export const serverError = (status: number, message: string) => ({
  body: { message },
  opts: { status, statusText: 'Error' }
});
