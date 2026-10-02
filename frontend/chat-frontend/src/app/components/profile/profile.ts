import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Navbar } from '../navbar/navbar';
import {
  IMAGE_ACCEPT,
  SERVER_URL,
  imageSrc,
  validateImageFile
} from '../../utils/images';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, Navbar],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile {

  // A getter rather than a copied field, so the shared
  // constant is read when the template renders.
  get imageAccept() { return IMAGE_ACCEPT; }

  currentUser: any = JSON.parse(
    localStorage.getItem('currentUser') ||
    '{"username":"User","age":0,"role":"user"}'
  );

  uploading = false;
  errorMessage = '';
  successMessage = '';

  constructor(private http: HttpClient) {}

  get initials(): string {
    return this.currentUser.username
      .substring(0, 2)
      .toUpperCase();
  }

  get avatarSrc(): string | null {
    return imageSrc(this.currentUser.avatarUrl);
  }

  get roleName(): string {

    switch (this.currentUser.role) {

      case 'superAdmin':
        return 'Super Admin';

      case 'groupAdmin':
        return 'Group Admin';

      default:
        return 'Regular User';

    }

  }

  // Called when a file is picked in the hidden file input.
  onAvatarSelected(event: Event) {

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    // Reset so picking the same file again still fires.
    input.value = '';

    if (!file) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    const problem = validateImageFile(file);

    if (problem) {
      this.errorMessage = problem;
      return;
    }

    const form = new FormData();
    form.append('avatar', file);
    form.append('requesterId', String(this.currentUser.id));

    this.uploading = true;

    this.http.post<any>(
      `${SERVER_URL}/api/users/${this.currentUser.id}/avatar`,
      form
    ).subscribe({

      next: user => {
        this.saveUser(user);
        this.successMessage = 'Profile picture updated';
        this.uploading = false;
      },

      error: error => {
        this.errorMessage =
          error.error?.message || 'Could not upload the picture';
        this.uploading = false;
      }

    });
  }

  removeAvatar() {

    this.errorMessage = '';
    this.successMessage = '';
    this.uploading = true;

    this.http.delete<any>(
      `${SERVER_URL}/api/users/${this.currentUser.id}/avatar`,
      { params: { requesterId: this.currentUser.id } }
    ).subscribe({

      next: user => {
        this.saveUser(user);
        this.successMessage = 'Profile picture removed';
        this.uploading = false;
      },

      error: error => {
        this.errorMessage =
          error.error?.message || 'Could not remove the picture';
        this.uploading = false;
      }

    });
  }

  // Keep the stored login in sync so other pages
  // (e.g. the chat window) see the new picture.
  private saveUser(user: any) {
    this.currentUser = { ...this.currentUser, ...user };
    localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
  }
}
