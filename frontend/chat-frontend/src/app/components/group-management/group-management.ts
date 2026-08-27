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

  // --------------------------------------------------
  // DATA
  // --------------------------------------------------

  groups: any[] = [];
  users: any[] = [];
  pendingRequests: any[] = [];

  // --------------------------------------------------
  // SELECTED ITEMS
  // --------------------------------------------------

  selectedGroupId: number | null = null;
  selectedUserId: number | null = null;
  selectedAdminId: number | null = null;

  // --------------------------------------------------
  // CREATE GROUP FORM
  // --------------------------------------------------

  groupName = '';
  description = '';
  ageLimit = 0;

  // --------------------------------------------------
  // MESSAGES
  // --------------------------------------------------

  message = '';
  error = '';

  // --------------------------------------------------
  // CURRENT USER
  // --------------------------------------------------

  currentUser: any = JSON.parse(
    localStorage.getItem('currentUser') ||
    '{"id":0,"username":"User","role":"user"}'
  );

  constructor(
    private http: HttpClient
  ) {}

  // --------------------------------------------------
  // INITIALISE
  // --------------------------------------------------

  ngOnInit() {

    this.loadGroups();
    this.loadUsers();
    this.loadPendingRequests();

  }

  // --------------------------------------------------
  // LOAD GROUPS
  // --------------------------------------------------

  loadGroups() {

    this.http.get<any[]>(
      'http://localhost:3000/api/groups'
    ).subscribe({

      next: groups => {
        this.groups = groups;
      },

      error: error => {
        console.error(
          'Could not load groups:',
          error
        );

        this.error =
          'Could not load groups.';
      }

    });

  }

  // --------------------------------------------------
  // LOAD USERS
  // --------------------------------------------------

  loadUsers() {

    this.http.get<any[]>(
      'http://localhost:3000/api/users'
    ).subscribe({

      next: users => {
        this.users = users;
      },

      error: error => {
        console.error(
          'Could not load users:',
          error
        );

        this.error =
          'Could not load users.';
      }

    });

  }

  // --------------------------------------------------
  // LOAD PENDING REQUESTS
  // --------------------------------------------------

  loadPendingRequests() {

    this.http.get<any[]>(
      'http://localhost:3000/api/requests?status=pending'
    ).subscribe({

      next: requests => {

        // Group Admin deals with:
        // - channel requests
        // - ban/removal requests

        this.pendingRequests =
          requests.filter(
            request =>
              request.type === 'channel' ||
              request.type === 'ban' ||
              request.type === 'groupRemoval'
          );

      },

      error: error => {

        console.error(
          'Could not load requests:',
          error
        );

        this.error =
          'Could not load pending requests.';
      }

    });

  }

  // --------------------------------------------------
  // CREATE GROUP
  // --------------------------------------------------

  createGroup() {

    this.message = '';
    this.error = '';

    if (!this.groupName.trim()) {

      this.error =
        'Please enter a group name.';

      return;
    }

    this.http.post<any>(
      'http://localhost:3000/api/groups',
      {
        name: this.groupName.trim(),
        description: this.description.trim(),
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

        console.error(
          'Could not create group:',
          error
        );

        this.error =
          error.error?.message ||
          'Could not create group.';

      }

    });

  }

  // --------------------------------------------------
  // ADD MEMBER TO GROUP
  // --------------------------------------------------

  addMember() {

    this.message = '';
    this.error = '';

    if (
      this.selectedGroupId === null ||
      this.selectedUserId === null
    ) {

      this.error =
        'Please select both a group and a user.';

      return;
    }

    this.http.post<any>(
      `http://localhost:3000/api/groups/${this.selectedGroupId}/members`,
      {
        userId: this.selectedUserId
      }
    ).subscribe({

      next: () => {

        this.message =
          'User added to group successfully.';

        this.loadGroups();

      },

      error: error => {

        console.error(
          'Could not add member:',
          error
        );

        this.error =
          error.error?.message ||
          'Could not add user to group.';

      }

    });

  }

  // --------------------------------------------------
  // ASSIGN GROUP ADMIN
  // --------------------------------------------------

  assignAdmin() {

    this.message = '';
    this.error = '';

    if (
      this.selectedGroupId === null ||
      this.selectedAdminId === null
    ) {

      this.error =
        'Please select both a group and a user.';

      return;
    }

    this.http.post<any>(
      `http://localhost:3000/api/groups/${this.selectedGroupId}/admins`,
      {
        userId: this.selectedAdminId
      }
    ).subscribe({

      next: () => {

        this.message =
          'Group admin assigned successfully.';

        this.loadGroups();

      },

      error: error => {

        console.error(
          'Could not assign admin:',
          error
        );

        this.error =
          error.error?.message ||
          'Could not assign group admin.';

      }

    });

  }

  // --------------------------------------------------
  // ACCEPT / DENY REQUEST
  // --------------------------------------------------

  reviewRequest(
    requestId: number,
    status: 'approved' | 'denied'
  ) {

    this.message = '';
    this.error = '';

    this.http.put<any>(
      `http://localhost:3000/api/requests/${requestId}`,
      {
        status: status,
        reviewerId: this.currentUser.id
      }
    ).subscribe({

      next: response => {

        if (status === 'approved') {

          this.message =
            response.message ||
            'Request approved and changes applied.';

        } else {

          this.message =
            'Request denied.';

        }

        // Refresh everything after action
        this.loadPendingRequests();
        this.loadGroups();

      },

      error: error => {

        console.error(
          'Could not review request:',
          error
        );

        this.error =
          error.error?.message ||
          'Could not review request.';

      }

    });

  }

}