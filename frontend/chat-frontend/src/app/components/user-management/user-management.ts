import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Navbar } from '../navbar/navbar';

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

  createUser() {

    this.message = '';
    this.error = '';

    if (!this.username.trim()) {

      this.error =
        'Please enter a username.';

      return;
    }

    if (!this.password) {

      this.error =
        'Please enter a password.';

      return;
    }

    if (this.password.length < 8) {

      this.error =
        'Password must be at least 8 characters.';

      return;
    }

    if (!/[A-Z]/.test(this.password)) {

      this.error =
        'Password must contain at least one uppercase letter.';

      return;
    }

    this.http.post<any>(
      'http://localhost:3000/api/users',
      {
        username: this.username.trim(),
        password: this.password,
        age: this.age,
        role: this.role
      }
    ).subscribe({

      next: user => {

        this.message =
          `${user.username} was created successfully.`;

        this.username = '';
        this.password = '';
        this.age = 18;
        this.role = 'user';

        this.loadUsers();

      },

      error: error => {

        this.error =
          error.error?.message ||
          'Could not create user.';

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