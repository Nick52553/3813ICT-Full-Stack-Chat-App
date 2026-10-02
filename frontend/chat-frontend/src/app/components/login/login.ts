import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { hasErrors, httpErrorMessage, validateRequired } from '../../utils/validation';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink
  ],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {

  username = '';
  password = '';

  // Set once Login is pressed, so errors don't show
  // before the user has had a chance to type.
  submitted = false;
  submitting = false;

  loginError = '';

  constructor(
    private router: Router,
    private http: HttpClient
  ) {}

  // Only checks the fields are filled in - password
  // strength is checked when an account is created.
  get errors() {
    return {
      username: validateRequired(this.username.trim(), 'Please enter your username'),
      password: validateRequired(this.password, 'Please enter your password')
    };
  }

  login() {

    this.submitted = true;
    this.loginError = '';

    if (hasErrors(this.errors) || this.submitting) {
      return;
    }

    this.submitting = true;

    this.http.post<any>(
      'http://localhost:3000/api/login',
      {
        username: this.username.trim(),
        password: this.password
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

        this.submitting = false;

        this.loginError = httpErrorMessage(error, 'Could not log in. Please try again.');
      }

    });
  }
}
