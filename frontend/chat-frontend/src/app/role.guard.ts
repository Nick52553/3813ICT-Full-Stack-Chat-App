import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export function roleGuard(
  allowedRoles: string[]
): CanActivateFn {

  return () => {

    const router = inject(Router);

    const storedUser =
      localStorage.getItem('currentUser');

    if (!storedUser) {
      return router.createUrlTree(['/login']);
    }

    const user = JSON.parse(storedUser);

    if (allowedRoles.includes(user.role)) {
      return true;
    }

    return router.createUrlTree(['/dashboard']);
  };
}

export const superAdminGuard =
  roleGuard(['superAdmin']);

export const groupAdminGuard =
  roleGuard(['superAdmin', 'groupAdmin']);