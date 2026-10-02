import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Navbar } from '../navbar/navbar';
import {
  LIMITS,
  hasErrors,
  httpErrorMessage,
  validateAge,
  validatePassword,
  validateUsername
} from '../../utils/validation';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Navbar
  ],
  templateUrl: './user-management.html',
  styleUrl: './user-management.css'
})
export class UserManagement implements OnInit {

  users: any[] = [];

  pendingGroupRequests: any[] = [];

  username = '';
  password = '';
  age = 18;
  role = 'user';

  message = '';
  error = '';

  // A getter rather than a copied field, so the shared
  // constant is read when the template renders.
  get limits() { return LIMITS; }

  // Set once Create User is pressed, so field errors
  // don't show before the admin has typed anything.
  submitted = false;
  creating = false;

  currentUser: any = JSON.parse(
    localStorage.getItem('currentUser') ||
    '{"id":0,"username":"User","role":"user"}'
  );

  constructor(
    private http: HttpClient
  ) {}

  ngOnInit() {

    this.loadUsers();
    this.loadGroupRequests();

  }

  loadUsers() {

    this.http.get<any[]>(
      'http://localhost:3000/api/users'
    ).subscribe({

      next: users => {
        this.users = users;
      },

      error: error => {

        console.error(error);

        this.error =
          'Could not load users.';

      }

    });

  }

  // One entry per field: an error message, or null.
  get errors() {
    return {
      username: validateUsername(this.username),
      password: validatePassword(this.password),
      age: validateAge(this.age)
    };
  }

  createUser() {

    this.message = '';
    this.error = '';
    this.submitted = true;

    if (hasErrors(this.errors) || this.creating) {
      return;
    }

    this.creating = true;

    this.http.post<any>(
      'http://localhost:3000/api/users',
      {
        username: this.username.trim(),
        password: this.password,
        age: this.age,
        role: this.role,
        // The server only lets a Super Admin pick a role.
        requesterId: this.currentUser.id
      }
    ).subscribe({

      next: user => {

        this.message =
          `${user.username} was created successfully.`;

        this.username = '';
        this.password = '';
        this.age = 18;
        this.role = 'user';
        this.submitted = false;
        this.creating = false;

        this.loadUsers();

      },

      error: error => {

        this.creating = false;

        this.error =
          httpErrorMessage(error, 'Could not create user.');

      }

    });

  }

  deleteUser(userId: number) {

    this.message = '';
    this.error = '';

    this.http.delete<any>(
      `http://localhost:3000/api/users/${userId}?requesterId=${this.currentUser.id}`
    ).subscribe({

      next: () => {

        this.message = 'User deleted successfully.';

        this.loadUsers();

      },

      error: error => {

        console.error(error);

        this.error =
          error.error?.message ||
          'Could not delete user.';

      }

    });

  }

  loadGroupRequests() {

    this.http.get<any[]>(
      `http://localhost:3000/api/requests?status=pending&reviewerId=${this.currentUser.id}`
    ).subscribe({

      next: requests => {

        this.pendingGroupRequests =
          requests.filter(
            request =>
              request.type === 'group'
          );

      },

      error: error => {

        console.error(error);

        this.error =
          'Could not load group requests.';

      }

    });

  }

  reviewGroupRequest(
    requestId: number,
    status: 'approved' | 'denied'
  ) {

    this.message = '';
    this.error = '';

    this.http.put<any>(
      `http://localhost:3000/api/requests/${requestId}`,
      {
        status,
        reviewerId: this.currentUser.id
      }
    ).subscribe({

      next: response => {

        this.message =
          response.message ||
          (
            status === 'approved'
              ? 'Group request approved.'
              : 'Group request denied.'
          );

        this.loadGroupRequests();

      },

      error: error => {

        console.error(error);

        this.error =
          error.error?.message ||
          'Could not review group request.';

      }

    });

  }

}