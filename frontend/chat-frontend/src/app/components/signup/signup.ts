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

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './signup.html',
  styleUrl: './signup.css'
})
export class Signup {

  // A getter rather than a copied field, so the shared
  // constant is read when the template renders.
  get limits() { return LIMITS; }

  username = '';
  password = '';
  confirmPassword = '';
  dob = '';

  // Latest date the date picker allows (today).
  readonly today = new Date().toISOString().slice(0, 10);

  // Set once Create Account is pressed, so errors don't
  // show before the user has had a chance to type.
  submitted = false;
  submitting = false;

  signupMessage = '';

  constructor(
    private router: Router,
    private http: HttpClient
  ) {}

  calculateAge(dob: string): number {

    const birthDate = new Date(dob);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

    const hasHadBirthdayThisYear =
      today.getMonth() > birthDate.getMonth() ||
      (
        today.getMonth() === birthDate.getMonth() &&
        today.getDate() >= birthDate.getDate()
      );

    if (!hasHadBirthdayThisYear) {
      age--;
    }

    return age;
  }

  validateDob(): string | null {

    if (!this.dob) {
      return 'Date of birth is required';
    }

    if (this.dob > this.today) {
      return 'Date of birth cannot be in the future';
    }

    return validateAge(this.calculateAge(this.dob));
  }

  // One entry per field: an error message, or null.
  get errors() {
    return {
      username: validateUsername(this.username),
      password: validatePassword(this.password),
      confirmPassword: validatePasswordMatch(this.password, this.confirmPassword),
      dob: this.validateDob()
    };
  }

  signup() {

    this.submitted = true;
    this.signupMessage = '';

    if (hasErrors(this.errors) || this.submitting) {
      return;
    }

    this.submitting = true;

    this.http.post<any>(
      'http://localhost:3000/api/users',
      {
        username: this.username.trim(),
        password: this.password,
        age: this.calculateAge(this.dob)
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

        this.signupMessage =
          httpErrorMessage(error, 'Could not create your account.');
      }

    });
  }
}
