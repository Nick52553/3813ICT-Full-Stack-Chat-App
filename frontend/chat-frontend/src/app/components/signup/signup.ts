import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

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

  username = '';
  password = '';
  dob = '';

  signupFailed = false;
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

  signup() {

    this.signupFailed = false;
    this.signupMessage = '';

    if (!this.username.trim() || !this.password || !this.dob) {

      this.signupFailed = true;
      this.signupMessage = 'Username, password and date of birth are required.';

      return;
    }

    const age = this.calculateAge(this.dob);

    this.http.post<any>(
      'http://localhost:3000/api/users',
      {
        username: this.username.trim(),
        password: this.password,
        age
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

        console.error('Signup failed:', error);

        this.signupFailed = true;

        this.signupMessage =
          error?.error?.message ||
          'Could not create your account.';
      }

    });
  }
}
