import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Navbar } from '../navbar/navbar';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [
    CommonModule,
    Navbar
  ],
  templateUrl: './audit-log.html',
  styleUrl: './audit-log.css'
})
export class AuditLog implements OnInit {

  entries: any[] = [];
  error = '';

  currentUser: any = JSON.parse(
    localStorage.getItem('currentUser') ||
    '{"id":0,"username":"User","role":"user"}'
  );

  constructor(
    private http: HttpClient
  ) {}

  ngOnInit() {

    this.http.get<any[]>(
      `http://localhost:3000/api/audit?requesterId=${this.currentUser.id}`
    ).subscribe({

      next: entries => {
        this.entries = entries;
      },

      error: error => {

        console.error(error);

        this.error =
          error.error?.message ||
          'Could not load the audit log.';

      }

    });

  }

}
