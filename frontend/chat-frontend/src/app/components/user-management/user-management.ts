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

  username = '';
  password = '';
  age = 18;
  role = 'user';

  message = '';
  error = '';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadUsers();
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
        this.error = 'Could not load users.';
      }
    });

  }

  createUser() {

    this.message = '';
    this.error = '';

    this.http.post<any>(
      'http://localhost:3000/api/users',
      {
        username: this.username,
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
}