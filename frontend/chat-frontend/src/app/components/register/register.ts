import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import {
  LIMITS,
  hasErrors,
  httpErrorMessage,
  validateAge,
  validatePassword,
  validatePasswordMatch,
  validateUsername
} from '../../utils/validation';

// First-run page: creates the Super Admin account.
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

  readonly limits = LIMITS;

  username = '';
  password = '';
  confirmPassword = '';
  age: number | null = null;

  // Set once Register is pressed, so errors don't show
  // before the user has had a chance to type.
  submitted = false;
  submitting = false;

  registerMessage = '';

  constructor(
    private router: Router,
    private http: HttpClient
  ) {}

  // One entry per field: an error message, or null.
  get errors() {
    return {
      username: validateUsername(this.username),
      password: validatePassword(this.password),
      confirmPassword: validatePasswordMatch(this.password, this.confirmPassword),
      age: validateAge(this.age)
    };
  }

  register() {

    this.submitted = true;
    this.registerMessage = '';

    if (hasErrors(this.errors) || this.submitting) {
      return;
    }

    this.submitting = true;

    this.http.post<any>(
      'http://localhost:3000/api/bootstrap',
      {
        username: this.username.trim(),
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

        this.submitting = false;

        this.registerMessage = httpErrorMessage(
          error,
          'Could not create the Super Admin account.'
        );

        // Someone else already finished set-up.
        if (error.status === 403) {
          this.router.navigate(['/login']);
        }
      }

    });
  }
}
