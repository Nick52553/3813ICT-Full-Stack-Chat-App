import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { Login } from './login';
import { API, TEST_USERS, loginAs, serverError, testProviders } from '../../testing/test-utils';

describe('Login', () => {
  let component: Login;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    loginAs(null);

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: testProviders
    }).compileComponents();

    component = TestBed.createComponent(Login).componentInstance;
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    http.verify();
    loginAs(null);
  });

  it('shows field errors and sends nothing when the form is empty', () => {
    component.login();

    expect(component.errors.username).toBe('Please enter your username');
    expect(component.errors.password).toBe('Please enter your password');
    http.expectNone(`${API}/login`);
  });

  it('logs in, remembers the user and opens the groups page', () => {
    component.username = '  bobby  ';
    component.password = 'Bobby123';

    component.login();

    const req = http.expectOne(`${API}/login`);
    expect(req.request.body).toEqual({ username: 'bobby', password: 'Bobby123' });
    req.flush(TEST_USERS.user);

    expect(JSON.parse(localStorage.getItem('currentUser')!).username).toBe('bobby');
    expect(navigate).toHaveBeenCalledWith(['/groups']);
  });

  it("shows the server's message for a wrong password", () => {
    component.username = 'bobby';
    component.password = 'nope';
    component.login();

    const { body, opts } = serverError(401, 'Invalid username or password');
    http.expectOne(`${API}/login`).flush(body, opts);

    expect(component.loginError).toBe('Invalid username or password');
    expect(component.submitting).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('explains when the server cannot be reached', () => {
    component.username = 'bobby';
    component.password = 'Bobby123';
    component.login();

    http.expectOne(`${API}/login`).error(new ProgressEvent('error'));

    expect(component.loginError).toContain('Could not reach the server');
  });

  it('ignores a second click while logging in', () => {
    component.username = 'bobby';
    component.password = 'Bobby123';

    component.login();
    component.login();

    expect(http.match(`${API}/login`).length).toBe(1);
  });
});
