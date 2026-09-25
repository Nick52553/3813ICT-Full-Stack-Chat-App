import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, catchError, of } from 'rxjs';

// Only lets a visitor onto /register while the app has
// zero users. Once a Super Admin exists, bounce to /login.
export const registerGuard: CanActivateFn = () => {

  const http = inject(HttpClient);
  const router = inject(Router);

  return http.get<any>(
    'http://localhost:3000/api/bootstrap-status'
  ).pipe(
    map(status =>
      status.needsBootstrap ?
        true :
        router.createUrlTree(['/login'])
    ),
    catchError(() => of(router.createUrlTree(['/login'])))
  );
};

// Keeps /login unreachable while the app has zero users -
// visitors get sent to /register to create the Super Admin.
export const loginGuard: CanActivateFn = () => {

  const http = inject(HttpClient);
  const router = inject(Router);

  return http.get<any>(
    'http://localhost:3000/api/bootstrap-status'
  ).pipe(
    map(status =>
      status.needsBootstrap ?
        router.createUrlTree(['/register']) :
        true
    ),
    catchError(() => of(true))
  );
};
