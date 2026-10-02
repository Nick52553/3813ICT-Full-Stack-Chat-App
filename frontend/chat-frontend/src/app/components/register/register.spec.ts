import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { Register } from './register';
import { API, loginAs, serverError, testProviders } from '../../testing/test-utils';

describe('Register (first Super Admin)', () => {
  let component: Register;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    loginAs(null);

    await TestBed.configureTestingModule({
      imports: [Register],
      providers: testProviders
    }).compileComponents();

    component = TestBed.createComponent(Register).componentInstance;
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    http.verify();
    loginAs(null);
  });

  it('requires an age and a confirmed password', () => {
    Object.assign(component, { username: 'admin', password: 'Admin1234', confirmPassword: '', age: null });

    component.register();

    expect(component.errors.confirmPassword).toBe('Please confirm your password');
    expect(component.errors.age).toBe('Age must be a whole number');
    http.expectNone(`${API}/bootstrap`);
  });

  it('creates the Super Admin and logs them in', () => {
    Object.assign(component, { username: 'admin', password: 'Admin1234', confirmPassword: 'Admin1234', age: 40 });

    component.register();

    const req = http.expectOne(`${API}/bootstrap`);
    expect(req.request.body).toEqual({ username: 'admin', password: 'Admin1234', age: 40 });
    req.flush({ id: 1, username: 'admin', role: 'superAdmin' });

    expect(navigate).toHaveBeenCalledWith(['/groups']);
  });

  it('goes to login if someone else already finished set-up', () => {
    Object.assign(component, { username: 'admin', password: 'Admin1234', confirmPassword: 'Admin1234', age: 40 });
    component.register();

    const { body, opts } = serverError(403, 'Super Admin has already been set up');
    http.expectOne(`${API}/bootstrap`).flush(body, opts);

    expect(component.registerMessage).toBe('Super Admin has already been set up');
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
