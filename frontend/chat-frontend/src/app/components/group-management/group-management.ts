import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Navbar } from '../navbar/navbar';

@Component({
  selector: 'app-group-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Navbar
  ],
  templateUrl: './group-management.html',
  styleUrl: './group-management.css'
})
export class GroupManagement implements OnInit {

  groups: any[] = [];
  users: any[] = [];

  selectedGroupId: number | null = null;
  selectedUserId: number | null = null;
  selectedAdminId: number | null = null;

  groupName = '';
  description = '';
  ageLimit = 0;

  message = '';
  error = '';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadGroups();
    this.loadUsers();
  }

  loadGroups() {
    this.http.get<any[]>(
      'http://localhost:3000/api/groups'
    ).subscribe({
      next: groups => this.groups = groups,
      error: error => console.error(error)
    });
  }

  loadUsers() {
    this.http.get<any[]>(
      'http://localhost:3000/api/users'
    ).subscribe({
      next: users => this.users = users,
      error: error => console.error(error)
    });
  }

  createGroup() {

    this.message = '';
    this.error = '';

    this.http.post<any>(
      'http://localhost:3000/api/groups',
      {
        name: this.groupName,
        description: this.description,
        ageLimit: this.ageLimit,
        adminIds: [],
        memberIds: []
      }
    ).subscribe({

      next: group => {

        this.message =
          `${group.name} was created successfully.`;

        this.groupName = '';
        this.description = '';
        this.ageLimit = 0;

        this.loadGroups();
      },

      error: error => {

        this.error =
          error.error?.message ||
          'Could not create group.';
      }

    });
  }

  addMember() {

    if (!this.selectedGroupId || !this.selectedUserId) {
      return;
    }

    this.http.post<any>(
      `http://localhost:3000/api/groups/${this.selectedGroupId}/members`,
      {
        userId: this.selectedUserId
      }
    ).subscribe({

      next: () => {
        this.message = 'User added to group.';
        this.loadGroups();
      },

      error: error => {
        this.error =
          error.error?.message ||
          'Could not add user.';
      }

    });
  }

  assignAdmin() {

    if (!this.selectedGroupId || !this.selectedAdminId) {
      return;
    }

    this.http.post<any>(
      `http://localhost:3000/api/groups/${this.selectedGroupId}/admins`,
      {
        userId: this.selectedAdminId
      }
    ).subscribe({

      next: () => {
        this.message = 'Group admin assigned.';
        this.loadGroups();
      },

      error: error => {
        this.error =
          error.error?.message ||
          'Could not assign group admin.';
      }

    });
  }
}