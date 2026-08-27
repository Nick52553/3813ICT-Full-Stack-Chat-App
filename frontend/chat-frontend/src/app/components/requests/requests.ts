import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Navbar } from '../navbar/navbar';

@Component({
  selector: 'app-requests',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Navbar
  ],
  templateUrl: './requests.html',
  styleUrl: './requests.css'
})
export class Requests implements OnInit {

  currentUser: any = JSON.parse(
    localStorage.getItem('currentUser') ||
    '{"id":0,"username":"User","role":"user"}'
  );

  requestType = 'group';

  groupName = '';
  groupDescription = '';
  groupAgeLimit = 0;

  channelName = '';
  channelDescription = '';
  selectedGroup = '';

  selectedUser = '';
  banReason = '';

  groups: any[] = [];
  users: any[] = [];

  message = '';
  error = '';

  constructor(
    private http: HttpClient
  ) {}

  ngOnInit() {

    this.loadGroups();
    this.loadUsers();

  }

  loadGroups() {

    this.http.get<any[]>(
      'http://localhost:3000/api/groups'
    ).subscribe({

      next: groups => {
        this.groups = groups;
      },

      error: error => {
        console.error(error);
        this.error = 'Could not load groups.';
      }

    });

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

  submitRequest() {

    this.message = '';
    this.error = '';

    let request: any;

    // ------------------------------
    // GROUP REQUEST
    // ------------------------------

    if (this.requestType === 'group') {

      if (!this.groupName.trim()) {

        this.error =
          'Please enter a group name.';

        return;
      }

      request = {

        type: 'group',

        requesterId:
          this.currentUser.id,

        name:
          this.groupName.trim(),

        description:
          this.groupDescription.trim(),

        ageLimit:
          this.groupAgeLimit

      };
    }

    // ------------------------------
    // CHANNEL REQUEST
    // ------------------------------

    if (this.requestType === 'channel') {

      if (
        !this.selectedGroup ||
        !this.channelName.trim()
      ) {

        this.error =
          'Please select a group and enter a channel name.';

        return;
      }

      request = {

        type: 'channel',

        requesterId:
          this.currentUser.id,

        groupId:
          Number(this.selectedGroup),

        name:
          this.channelName.trim(),

        description:
          this.channelDescription.trim()

      };
    }

    // ------------------------------
    // BAN / REMOVAL REQUEST
    // ------------------------------

    if (this.requestType === 'ban') {

      if (
        !this.selectedGroup ||
        !this.selectedUser
      ) {

        this.error =
          'Please select a group and user.';

        return;
      }

      request = {

        type: 'ban',

        requesterId:
          this.currentUser.id,

        groupId:
          Number(this.selectedGroup),

        targetUserId:
          Number(this.selectedUser),

        reason:
          this.banReason.trim()

      };
    }

    this.http.post<any>(
      'http://localhost:3000/api/requests',
      request
    ).subscribe({

      next: () => {

        this.message =
          'Request submitted successfully.';

        this.clearForm();

      },

      error: error => {

        console.error(error);

        this.error =
          error.error?.message ||
          'Could not submit request.';

      }

    });

  }

  clearForm() {

    this.groupName = '';
    this.groupDescription = '';
    this.groupAgeLimit = 0;

    this.channelName = '';
    this.channelDescription = '';

    this.selectedGroup = '';
    this.selectedUser = '';

    this.banReason = '';

  }

}