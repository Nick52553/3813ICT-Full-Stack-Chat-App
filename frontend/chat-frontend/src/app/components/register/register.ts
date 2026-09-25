import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {

  username = '';
  password = '';
  age = '';

  registerFailed = false;
  registerMessage = '';

  constructor(
    private router: Router,
    private http: HttpClient
  ) {}

  register() {

    this.registerFailed = false;
    this.registerMessage = '';

    this.http.post<any>(
      'http://localhost:3000/api/bootstrap',
      {
        username: this.username,
        password: this.password,
        age: this.age
      }
    ).subscribe({

      next: (user) => {

        localStorage.setItem(
          'currentUser',
          JSON.stringify(user)
        );

        this.router.navigate(['/groups']);
      },

      error: (error) => {

        console.error('Registration failed:', error);

        this.registerFailed = true;

        this.registerMessage =
          error?.error?.message ||
          'Could not create the Super Admin account.';

        if (error.status === 403) {
          this.router.navigate(['/login']);
        }
      }

    });
  }
}
