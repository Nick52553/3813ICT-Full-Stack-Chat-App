import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {

  username = '';
  password = '';

  loginFailed = false;

  constructor(
    private router: Router,
    private http: HttpClient
  ) {}

  login() {

    this.loginFailed = false;

    this.http.post<any>(
      'http://localhost:3000/api/login',
      {
        username: this.username,
        password: this.password
      }
    ).subscribe({

      next: (user) => {

        localStorage.setItem(
          'currentUser',
          JSON.stringify(user)
        );

        this.router.navigate(['/dashboard']);
      },

      error: (error) => {

        console.error('Login failed:', error);

        this.loginFailed = true;
      }

    });
  }
}