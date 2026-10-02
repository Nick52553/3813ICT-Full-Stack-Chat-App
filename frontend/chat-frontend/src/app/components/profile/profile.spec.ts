import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { Profile } from './profile';

// Simulates picking a file in the hidden <input type="file">.
function fileEvent(file: File): Event {
  return { target: { files: [file], value: 'C:\\fakepath\\x' } } as unknown as Event;
}

describe('Profile', () => {
  let component: Profile;
  let fixture: ComponentFixture<Profile>;
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.setItem('currentUser', JSON.stringify({
      id: 2, username: 'bobby', age: 21, role: 'user', avatarUrl: null
    }));

    await TestBed.configureTestingModule({
      imports: [Profile],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Profile);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem('currentUser');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows initials when there is no picture', () => {
    expect(component.avatarSrc).toBeNull();
    expect(component.initials).toBe('BO');
  });

  it('rejects a file that is not an image without calling the server', () => {
    component.onAvatarSelected(fileEvent(new File(['x'], 'notes.txt', { type: 'text/plain' })));

    expect(component.errorMessage).toBe('Only PNG, JPG and GIF images are allowed');
    http.expectNone(() => true);
  });

  it('rejects an image over 2MB without calling the server', () => {
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' });

    component.onAvatarSelected(fileEvent(big));

    expect(component.errorMessage).toBe('Images must be 2MB or smaller');
    http.expectNone(() => true);
  });

  it('uploads a valid image and saves the new picture', () => {
    component.onAvatarSelected(fileEvent(new File(['png'], 'me.png', { type: 'image/png' })));

    const req = http.expectOne('http://localhost:3000/api/users/2/avatar');
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    expect((req.request.body as FormData).get('requesterId')).toBe('2');

    req.flush({ id: 2, username: 'bobby', age: 21, role: 'user', avatarUrl: '/uploads/avatars/a.png' });

    expect(component.avatarSrc).toBe('http://localhost:3000/uploads/avatars/a.png');
    expect(component.successMessage).toBe('Profile picture updated');
    expect(JSON.parse(localStorage.getItem('currentUser')!).avatarUrl).toBe('/uploads/avatars/a.png');
  });

  it("shows the server's message when an upload fails", () => {
    component.onAvatarSelected(fileEvent(new File(['png'], 'me.png', { type: 'image/png' })));

    http.expectOne('http://localhost:3000/api/users/2/avatar').flush(
      { message: 'Only PNG, JPG and GIF images are allowed' },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(component.errorMessage).toBe('Only PNG, JPG and GIF images are allowed');
    expect(component.uploading).toBe(false);
  });
});
