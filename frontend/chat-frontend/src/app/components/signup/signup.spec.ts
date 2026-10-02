import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { Signup } from './signup';
import { API, loginAs, serverError, testProviders } from '../../testing/test-utils';

// YYYY-MM-DD in local time, like <input type="date"> gives.
// (toISOString would use UTC, which can be a different day.)
function localDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// A date of birth `years` years ago today.
function yearsAgo(years: number): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return localDate(date);
}

describe('Signup', () => {
  let component: Signup;
  let http: HttpTestingController;

  beforeEach(async () => {
    loginAs(null);

    await TestBed.configureTestingModule({
      imports: [Signup],
      providers: testProviders
    }).compileComponents();

    component = TestBed.createComponent(Signup).componentInstance;
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    http.verify();
    loginAs(null);
  });

  // Fill the form with valid values, then apply overrides.
  function fill(overrides: Partial<Signup> = {}) {
    Object.assign(component, {
      username: 'newbie',
      password: 'Newbie123',
      confirmPassword: 'Newbie123',
      dob: yearsAgo(20),
      ...overrides
    });
  }

  it('flags every problem and sends nothing', () => {
    fill({ username: 'a b', password: 'weak', confirmPassword: 'other', dob: '' });

    component.signup();

    expect(component.errors.username).toContain('can only contain');
    expect(component.errors.password).toContain('at least 8');
    expect(component.errors.confirmPassword).toBe('Passwords do not match');
    expect(component.errors.dob).toBe('Date of birth is required');
    http.expectNone(`${API}/users`);
  });

  it('rejects a birth date in the future', () => {
    fill({ dob: '2999-01-01' });

    expect(component.errors.dob).toBe('Date of birth cannot be in the future');
  });

  it('rejects anyone younger than 13', () => {
    fill({ dob: yearsAgo(12) });

    expect(component.errors.dob).toBe('Age must be between 13 and 120');
  });

  it('works out age correctly around a birthday', () => {
    const tomorrow = new Date();
    tomorrow.setFullYear(tomorrow.getFullYear() - 20);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Turns 20 tomorrow, so is still 19 today.
    expect(component.calculateAge(localDate(tomorrow))).toBe(19);
  });

  it('creates the account with the calculated age', () => {
    fill();

    component.signup();

    const req = http.expectOne(`${API}/users`);
    expect(req.request.body).toEqual({ username: 'newbie', password: 'Newbie123', age: 20 });
    req.flush({ id: 6, username: 'newbie', role: 'user' });

    expect(JSON.parse(localStorage.getItem('currentUser')!).id).toBe(6);
  });

  it('shows a taken-username error from the server', () => {
    fill();
    component.signup();

    const { body, opts } = serverError(409, 'Username already exists');
    http.expectOne(`${API}/users`).flush(body, opts);

    expect(component.signupMessage).toBe('Username already exists');
  });
});
